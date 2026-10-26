/**
 * Everything `AppAuth` needs, but for what only a host knows: the Postgres
 * client, the site it serves, its secrets, who may sign up and how mail leaves.
 */
import { Persistence, storage, users } from "@recensio/db/schema/identity";
import { EmailDelivery, Hooks, Proofs, Sessions, Auth, Email } from "@yielded/auth";
import * as WorkerdPasswordlessServices from "@yielded/auth/WorkerdPasswordlessServices";
import { Database, databaseLayer } from "@yielded/auth-persistence-drizzle/Postgres";
import { and, eq, isNull, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { AppAuth } from "./auth";
import { Claims, RETURN_TARGET } from "./contract";
import { Mail } from "./mail";
import * as Targets from "./targets";

export interface Settings {
  /** The one origin browsers reach the site at, `https://recensio.example`. Auth trusts no other. */
  readonly origin: string;
  /** Signs the codes. 32 random bytes, base64url. */
  readonly proofKey: Redacted.Redacted<string>;
  /** Ties a sign-in to the browser that started it. 32 other random bytes, base64url. */
  readonly bindingKey: Redacted.Redacted<string>;
}

export class Configuration extends Context.Service<Configuration, Settings>()(
  "@recensio/identity/Configuration",
) {}

const claimsOf = Effect.fn("Identity.claims")(function* (subjectId: string) {
  const db = yield* Database;
  const [row] = yield* db.select().from(users).where(eq(users.id, subjectId));
  if (row === undefined || !row.enabled) return yield* Effect.fail("unknown user" as const);
  return yield* Schema.decodeEffect(Claims)({ email: row.email, name: row.name });
});

/**
 * Stored sessions, read with the user's claims as they are now rather than as
 * they were at sign-in: a new name shows at once, and a disabled user's
 * session stops working on its next request. One more query per session read.
 */
const stored = Layer.effect(
  AppAuth.sessions.StatefulSessionPersistence,
  Effect.gen(function* () {
    const db = yield* Database;
    const persisted = yield* AppAuth.sessions.StatefulSessionPersistence;

    return {
      ...persisted,
      verify: (input) =>
        Effect.gen(function* () {
          const session = yield* persisted.verify(input);
          const current = yield* claimsOf(session.subjectId).pipe(
            Effect.provideService(Database, db),
            Effect.mapError((error) =>
              error === "unknown user"
                ? Sessions.SessionInvalid.make({})
                : Sessions.SessionUnavailable.make({}),
            ),
          );
          return { ...session, claims: current };
        }),
    };
  }),
).pipe(
  // Sessions and proofs: the library's composed layer over the managed tables.
  Layer.provideMerge(Persistence.layer.pipe(Layer.provide(Persistence.Config.layer(storage)))),
);

/** What a new session carries. Also where an account becomes confirmed. */
const claims = Layer.effect(
  AppAuth.strategies.email.SessionClaims,
  Effect.gen(function* () {
    const db = yield* Database;
    return {
      // Asked once per sign-in, after the code was consumed and before the
      // session exists: the first time this runs for a user, their mailbox has
      // just been proven.
      resolve: ({ subjectId }) =>
        db
          .update(users)
          .set({ confirmedAt: sql`now()` })
          .where(and(eq(users.id, subjectId), isNull(users.confirmedAt)))
          .pipe(
            Effect.andThen(claimsOf(subjectId).pipe(Effect.provideService(Database, db))),
            Effect.mapError(() => Email.EmailUnavailable.make({})),
          ),
    };
  }),
);

const delivery = Layer.effect(
  EmailDelivery.EmailDelivery,
  Effect.gen(function* () {
    const mail = yield* Mail.Service;
    return EmailDelivery.EmailDelivery.of({
      send: (message) =>
        mail
          .send({ to: message.to, subject: message.subject, text: Redacted.value(message.text) })
          // The provider's answer does not say whether the message left.
          .pipe(Effect.mapError(() => EmailDelivery.EmailAcceptanceUnknown.make({}))),
    });
  }),
);

const keyring = (material: Redacted.Redacted<string>) => ({
  activeKeyId: "v1",
  keys: [{ id: "v1", material }],
});

const configured = Layer.unwrap(
  Effect.gen(function* () {
    const settings = yield* Configuration;
    return Layer.mergeAll(
      Proofs.ProofKeys.layer(keyring(settings.proofKey)),
      Auth.RequestBindingConfig.layer({
        keyring: keyring(settings.bindingKey),
        lifetimeMillis: 600_000,
        generation: 1,
      }),
    );
  }),
);

/**
 * `AppAuth`, ready to serve. Build it per request: the library captures the
 * Postgres client it is built on, and a worker's client belongs to one request.
 *
 * Requires `Configuration`, `Mail.Service`, `SignUpPolicy.Service`, and the
 * request's `PgClient` and `SqlClient`.
 */
export const layer = AppAuth.layer.pipe(
  // The code is mailed before the answer leaves. The library's default hands
  // it to a fiber that would die with the per-request build.
  Layer.provide(Proofs.ProofDispatchScheduler.layerInline),
  Layer.provideMerge(
    Layer.mergeAll(
      claims,
      Targets.layer,
      delivery,
      // The only place a completed email sign-in may land.
      Email.EmailReturnTargets.exactRoutes([RETURN_TARGET]),
    ),
  ),
  Layer.provideMerge(stored),
  Layer.provideMerge(configured),
  Layer.provideMerge(databaseLayer),
  Layer.provideMerge(Hooks.LifecycleHooks.empty),
  Layer.provideMerge(WorkerdPasswordlessServices.layer),
);

export * as Identity from "./service";

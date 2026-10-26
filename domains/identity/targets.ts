/**
 * Who a sign-in code may be sent to: anyone with an account, and anyone the
 * sign-up policy lets open one. This is what makes one code enough for a new
 * person. The auth library only sends a code to an address it can find, so an
 * unknown address gets its account just before the library looks it up.
 */
import { storage, users } from "@recensio/db/schema/identity";
import { Email } from "@yielded/auth";
import { makeStorageMappings } from "@yielded/auth-persistence/Adapter";
import { Database, makeEmailSignInServices } from "@yielded/auth-persistence-drizzle/Postgres";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import { BASE_PATH } from "./contract";
import { SignUpPolicy } from "./policy";
import { newUserId } from "./types";

/**
 * WORKAROUND, yielded 0.1.0-beta.46. Only the request that sends a code may
 * create an account. The library calls the lookup again when sign-in
 * completes, and that step is not behind its per-client limiter: without this
 * check anyone could create accounts through it at will. The lookup is not
 * told which step it serves, so it reads the path of the request at hand,
 * which is the `requestEmailCode` action of `./contract`.
 *
 * On an upgrade: check that `Email.signInRequest` still admits the client
 * before it calls the lookup, and that the action name here still matches
 * the contract. Sign-up through `Email.makeRegistration` is the library's
 * own way, at the price of a second code.
 */
const sendsCode = Effect.map(
  Effect.serviceOption(HttpServerRequest.HttpServerRequest),
  (request) =>
    Option.isSome(request) &&
    new URL(request.value.url, "http://localhost").pathname === `${BASE_PATH}/requestEmailCode`,
);

export const layer = Layer.effect(
  Email.EmailSignInTargets,
  Effect.gen(function* () {
    // The library's own Drizzle handle, over the request's client.
    const db = yield* Database;
    const policy = yield* SignUpPolicy.Service;
    const email = yield* (yield* makeStorageMappings(storage)).emails();
    const { identifiers, credentials, emailCredentials } = storage.schema;
    const { allocateCredentialId, allocateRevision } = email;
    if (allocateCredentialId === undefined || allocateRevision === undefined)
      return yield* Effect.die("the auth library's email mapping no longer allocates ids");

    /**
     * WORKAROUND, yielded 0.1.0-beta.46. `makeStorageMappings` erases table
     * types, so the mapping and every row it encodes are cast with `as never`
     * on their way back into the library's own typed functions. The tables
     * are the managed ones: no value is reinterpreted.
     *
     * On an upgrade: remove the casts and see whether it still typechecks.
     */
    const stored = (yield* makeEmailSignInServices(email as never)).emailSignInTargets;

    /** The four rows a sign-in looks for, written with the encoders the library's own account creation uses. */
    const provision = Effect.fn("Identity.provision")(function* (
      moduleId: string,
      identifier: { readonly namespace: string; readonly value: string },
    ) {
      const id = yield* newUserId;
      const credentialId = yield* allocateCredentialId;
      const credentialRevision = yield* allocateRevision;
      const bindingRevision = yield* allocateRevision;
      const securityRevision = yield* allocateRevision;

      yield* db.transaction((tx) =>
        Effect.gen(function* () {
          // The unique (namespace, value) key decides a race: the loser writes nothing.
          const claimed = yield* tx
            .insert(identifiers)
            .values(
              // The library only finds a verified address, so this says verified
              // before anyone proved it. `users.confirmedAt` is the truth.
              email.identifier.encodeVerifiedInsert({
                identifier,
                subjectId: id,
                verifiedAtMillis: Date.now(),
                bindingRevision,
              }) as never,
            )
            .onConflictDoNothing()
            .returning();
          if (claimed.length === 0) return;

          yield* tx.insert(users).values({ id, securityRevision, email: identifier.value });
          yield* tx.insert(emailCredentials).values(
            email.credential.encodeVerifiedInsert({
              moduleId,
              subjectId: id,
              credentialId,
              identifier,
              credentialRevision,
            }) as never,
          );
          yield* tx.insert(credentials).values(
            email.authorityCredential.encodeInsert({
              subjectId: id,
              credentialId,
              revision: credentialRevision,
            }) as never,
          );
        }),
      );
    });

    return Email.EmailSignInTargets.of({
      lookup: (input) =>
        Effect.gen(function* () {
          const found = yield* stored.lookup(input);
          if (Option.isSome(found) || !(yield* sendsCode)) return found;
          // Refused: the library answers as it does for any address it cannot
          // find, with an ordinary receipt and no mail.
          if (!(yield* policy.allows(input.identifier.value))) return found;

          yield* provision(input.moduleId, input.identifier).pipe(
            Effect.tapCause((cause) => Effect.logError("an account could not be created", cause)),
            Effect.mapError(() => Email.EmailUnavailable.make({})),
          );
          return yield* stored.lookup(input);
        }),
    });
  }),
);

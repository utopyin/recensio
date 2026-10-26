/** How a call proves who makes it: the session cookie the auth routes set. */
import { Authenticated, CurrentUser, Unauthenticated } from "@recensio/identity/access";
import { AppAuth } from "@recensio/identity/auth";
import { User, UserId } from "@recensio/identity/types";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Cookies from "effect/http/Cookies";

/**
 * Who makes a request, from the session cookie named `cookie` in its
 * `headers`: one session lookup. A missing, unknown, expired or revoked
 * session is `Unauthenticated`, and so is a session store that cannot answer.
 */
export const identify = Effect.fnUntraced(function* (
  cookie: string,
  headers: Readonly<Record<string, string | undefined>>,
) {
  const auth = yield* AppAuth;
  const credential = Cookies.parseHeader(headers["cookie"] ?? "")[cookie];
  if (credential === undefined) return yield* new Unauthenticated();

  const session = yield* auth
    .verifySession(Redacted.make(credential))
    .pipe(Effect.mapError(() => new Unauthenticated()));

  return new User({ id: UserId.make(session.subjectId), ...session.claims });
});

/** `Authenticated` for calls that carry `cookie`. */
export const layer = (cookie: string) =>
  Layer.effect(
    Authenticated,
    Effect.gen(function* () {
      const auth = yield* AppAuth;

      return Authenticated.of((effect, { headers }) =>
        Effect.gen(function* () {
          const user = yield* identify(cookie, headers).pipe(Effect.provideService(AppAuth, auth));
          return yield* effect.pipe(Effect.provideService(CurrentUser, user));
        }),
      );
    }),
  );

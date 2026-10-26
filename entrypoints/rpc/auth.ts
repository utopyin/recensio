/** The auth routes, and what a request must carry for them to work. */
import { AppAuth } from "@recensio/identity/auth";
import { Http, Proofs } from "@yielded/auth";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as HttpServerRequest from "effect/http/HttpServerRequest";

/**
 * Every action of the auth contract as a route under `/api/auth`, for a site
 * served at `origin`. The routes set the cookies, and refuse a write whose
 * `Origin` header is not `origin` or that lacks the client's CSRF header.
 * `cookie` is the name of the one that holds the session.
 */
export const make = (origin: string) => {
  // Browsers only take a `__Host-` cookie over https; plain http is local development.
  const secure = origin.startsWith("https:");
  const prefix = secure ? "__Host-recensio-" : "recensio-";

  return {
    routes: Http.make(AppAuth, { origin, cookie: { prefix, secure } }).routes(),
    cookie: `${prefix}session`,
  };
};

/**
 * Tells auth which client a request comes from. It limits how many codes one
 * client may ask for, and would otherwise read the socket's peer, which is
 * the website worker for every request. The website forwards the address it
 * saw; that is trustworthy only because nothing but the website reaches this
 * API. Without the header a code request fails and everything else works.
 */
export const withClientAddress = <A, E, R>(handler: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const address = request.headers["cf-connecting-ip"];

    return yield* Effect.provideService(
      handler,
      Proofs.ProofRequestContext,
      address === undefined
        ? Effect.fail(Proofs.ProofUnavailable.make({}))
        : Effect.succeed({ networkKey: Redacted.make(address) }),
    );
  });

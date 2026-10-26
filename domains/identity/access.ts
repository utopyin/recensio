/**
 * What a request contract needs to say "signed-in users only", and what a
 * handler reads to know who is asking.
 *
 * LEAF MODULE: imports only leaf types and `effect`.
 */
import * as Context from "effect/Context";
import * as Schema from "effect/Schema";
import * as RpcMiddleware from "effect/rpc/RpcMiddleware";
import type { User } from "./types";

/** The user the request at hand was made by. */
export class CurrentUser extends Context.Service<CurrentUser, User>()(
  "@recensio/identity/CurrentUser",
) {}

/** Nobody is signed in, or the session is no longer valid. */
export class Unauthenticated extends Schema.TaggedError<
  Unauthenticated,
  { readonly brand: unique symbol }
>()("Identity.Unauthenticated", {}) {}

/**
 * Attach to a request group with `.middleware(Authenticated)`: a call without
 * a valid session fails with `Unauthenticated`, and its handler can read
 * `CurrentUser`. The entrypoint supplies how the session is found.
 */
export class Authenticated extends RpcMiddleware.Service<
  Authenticated,
  { provides: CurrentUser }
>()("@recensio/identity/Authenticated", { error: Unauthenticated }) {}

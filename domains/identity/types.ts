/**
 * Who signs in, as every other module sees them.
 *
 * LEAF MODULE: imports only `effect`.
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

/** A fresh `UserId`. */
export const newUserId = Effect.sync(() => UserId.make(crypto.randomUUID()));

/** Someone who signs in. */
export class User extends Schema.Class<User, { readonly brand: unique symbol }>("Identity.User")({
  id: UserId,
  /** Lower case. How they are reached, and what they sign in with. */
  email: Schema.String,
  /** What the app calls them. `null` until they say. */
  name: Schema.NullOr(Schema.String),
}) {}

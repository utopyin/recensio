/**
 * Every call the browser may make of the API, as one RPC group. The server
 * (`./index`) handles exactly these and the website's client calls them by
 * name, so a change here is a type error on both sides.
 *
 * LEAF MODULE: imports only `effect` and the contract modules of the domains
 * it assembles (`@recensio/<domain>/rpc`). No handler, no service, no
 * database: the website bundles it.
 */
import * as Schema from "effect/Schema";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";

/** Where the API answers calls. The website forwards it without rewriting. */
export const PATH = "/api/rpc";

/** The API is up and reaches its database. */
export class Health extends Schema.Class<Health, { readonly brand: unique symbol }>("Rpc.Health")({
  /** The database's own clock, as it answered. */
  database: Schema.String,
}) {}

/**
 * The database did not answer. Why stays on the server, in its log: the
 * browser only learns that the call failed.
 */
export class Unavailable extends Schema.TaggedError<
  Unavailable,
  { readonly brand: unique symbol }
>()("Rpc.Unavailable", {}) {}

/** What the API says about itself rather than about any domain. */
export const SystemRpcs = RpcGroup.make(
  Rpc.make("system.health", { success: Health, error: Unavailable }),
);

/** The whole contract. A domain adds its group here with `.merge`. */
export const Rpcs = SystemRpcs;

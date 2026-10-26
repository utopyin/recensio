import type * as PgClient from "@effect/sql-pg/PgClient";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

/**
 * The Postgres client `Database.Service` runs on, for the request at hand.
 * A host yields it when a library has to be handed the client itself (auth),
 * so that library and the app's queries share one connection. Domains never
 * need it: their door is `Database.Service`.
 */
export class Service extends Context.Service<Service, Effect.Effect<PgClient.PgClient>>()(
  "@recensio/db/Client",
) {}

export * as Client from "./client";

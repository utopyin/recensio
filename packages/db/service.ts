import type * as Drizzle from "@alchemy.run/drizzle/Postgres";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { relations } from "./schema/relations";

export type Instance = Effect.Success<
  ReturnType<typeof Drizzle.Postgres<typeof relations, never, never>>
>;

/**
 * The Drizzle instance, typed with every table and relation of `./schema`.
 * Domains query their tables (`@recensio/db/schema/<domain>`) through it.
 * Query Effects require `Alchemy.RuntimeContext`.
 *
 * @example
 * const db = yield* Database.Service
 * const rows = yield* db.select().from(reviews);
 */
export class Service extends Context.Service<Service, Instance>()("@recensio/db/Database") {}

export * as Database from "./service";

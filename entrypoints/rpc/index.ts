import { Database } from "@recensio/db/service";
import { sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import { Health, PATH, Rpcs, Unavailable } from "./contract";
import { ambient } from "./runtime";

const handlers = Rpcs.toLayer({
  "system.health": () =>
    Effect.gen(function* () {
      const db = yield* Database.Service;
      const {
        rows: [row],
      } = yield* db.execute<{ now: string }>(sql`select now()::text as now`);
      return new Health({ database: row?.now ?? "" });
    }).pipe(
      Effect.tapCause((cause) => Effect.logError("system.health failed", cause)),
      Effect.mapError(() => new Unavailable()),
      ambient,
    ),
});

/**
 * Every route of the API, as one router layer: `POST /api/rpc`, the contract
 * of `./contract`, over HTTP with NDJSON. `protocol: "http"` is explicit, the
 * default is websocket. Requires the services the handlers use.
 */
export const layer = RpcServer.layerHttp({ group: Rpcs, path: PATH, protocol: "http" }).pipe(
  Layer.provide(handlers),
  Layer.provide(RpcSerialization.layerNdjson),
);

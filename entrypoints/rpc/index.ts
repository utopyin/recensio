import { CurrentUser } from "@recensio/identity/access";
import { Identity } from "@recensio/identity/service";
import { Database } from "@recensio/db/service";
import { sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import * as Access from "./access";
import * as Auth from "./auth";
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

  "identity.me": () => Effect.service(CurrentUser),
});

/**
 * `POST /api/rpc`: the contract of `./contract`, over HTTP with NDJSON.
 * `protocol: "http"` is explicit, the default is websocket.
 */
const rpc = RpcServer.layerHttp({ group: Rpcs, path: PATH, protocol: "http" }).pipe(
  Layer.provide(handlers),
  Layer.provide(RpcSerialization.layerNdjson),
);

/**
 * Every route of the API, as one router layer, all under `/api`: the auth
 * actions (`/api/auth/*`) and the calls (`/api/rpc`). Requires the services
 * the handlers use, auth (`Identity.layer`) and its `Identity.Configuration`.
 */
export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const { origin } = yield* Identity.Configuration;
    const auth = Auth.make(origin);

    return Layer.mergeAll(auth.routes, rpc.pipe(Layer.provide(Access.layer(auth.cookie))));
  }),
);

export const { withClientAddress } = Auth;

export { measured } from "./metrics";

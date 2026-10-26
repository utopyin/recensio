/**
 * The typed API client, as atoms. Errors decode back to the tagged instances
 * the server failed with, so UI code branches on `_tag` the way the server
 * does; `RpcClientError` is the "network broke" bucket.
 *
 * Read with `Api.query(tag, payload)` and write with `Api.mutation(tag)`,
 * through the `@effect/atom-react` hooks. A mutation that changes what a query
 * reads names the same `reactivityKeys`, and the query loads again.
 */
import { PATH, Rpcs } from "@recensio/rpc/contract";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcSerialization from "effect/rpc/RpcSerialization";

/**
 * Browser: same-origin `/api/rpc`, through the route that forwards `/api/*`
 * to the API worker. While a page renders on the server there is no origin to
 * call, so the layer never builds and every query stays in its initial state
 * until the browser takes over.
 */
const protocol = Layer.unwrap(
  Effect.suspend(() =>
    typeof window === "undefined"
      ? Effect.never
      : Effect.succeed(
          RpcClient.layerProtocolHttp({ url: new URL(PATH, window.location.origin).toString() }),
        ),
  ),
).pipe(Layer.provide([RpcSerialization.layerNdjson, FetchHttpClient.layer]));

export class Api extends AtomRpc.Service<Api>()("@recensio/web/Api", {
  group: Rpcs,
  protocol,
}) {}

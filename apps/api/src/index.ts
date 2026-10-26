import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Postgres from "@recensio/db/database";
import * as Routes from "@recensio/rpc";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

/**
 * The API worker. Its init runs at plan time (registering the Hyperdrive it
 * binds) and at runtime (building the router once per isolate). Reached
 * only through the website's service binding: the website forwards `/api/*`,
 * and every route is in `@recensio/rpc`.
 */
export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  {
    main: import.meta.url,
  },
  Effect.gen(function* () {
    const handler = yield* HttpRouter.toHttpEffect(Routes.layer);

    return {
      fetch: handler.pipe(
        Effect.catchCause((cause) =>
          Effect.logError("request failed", cause).pipe(
            Effect.as(HttpServerResponse.text("Internal error", { status: 500 })),
          ),
        ),
      ),
    };
  }).pipe(Effect.provide(Postgres.layer)),
) {}

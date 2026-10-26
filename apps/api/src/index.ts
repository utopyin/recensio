import * as Cloudflare from "@alchemy.run/cloudflare";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Client } from "@recensio/db/client";
import * as Postgres from "@recensio/db/database";
import { Database } from "@recensio/db/service";
import { SignUpPolicy } from "@recensio/identity/policy";
import { Identity } from "@recensio/identity/service";
import * as Routes from "@recensio/rpc";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Etag from "effect/http/Etag";
import * as HttpPlatform from "effect/http/HttpPlatform";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerError from "effect/http/HttpServerError";
import * as SqlClient from "effect/sql/SqlClient";
import { configuration } from "./configuration";
import * as Mail from "./mail";

/** The auth routes are built with `HttpApiBuilder`, which asks for a platform even though no file is served. */
const platform = HttpPlatform.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(Etag.layerWeak, Path.layer, FileSystem.layerNoop({}))),
);

/**
 * The API worker. Its init runs at plan time (registering the Hyperdrive and
 * the mail binding) and at runtime (once per isolate). Reached only through
 * the website's service binding: the website forwards `/api/*`, and every
 * route is in `@recensio/rpc`.
 */
export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  {
    main: import.meta.url,
    // No public URL: only the website reaches the API, over its service binding.
    workersDev: false,
  },
  Effect.gen(function* () {
    const db = yield* Database.Service;
    const postgres = yield* Client.Service;
    const { settings, signUp } = yield* configuration;
    const mail = yield* Mail.make;
    const deployment = Layer.mergeAll(SignUpPolicy.fromPatterns(signUp), mail, platform);

    return {
      // Auth captures the Postgres client it is built on, and a worker's client
      // belongs to one request: auth, and the router over it, are built per request.
      fetch: Effect.gen(function* () {
        const client = yield* postgres;
        const request = yield* HttpServerRequest.HttpServerRequest;
        const handler = yield* HttpRouter.toHttpEffect(
          Routes.layer.pipe(
            Layer.provide(Identity.layer),
            Layer.provide(deployment),
            Layer.provide(Layer.succeed(Identity.Configuration, settings(request.originalUrl))),
          ),
        ).pipe(
          Effect.provideService(PgClient.PgClient, client),
          Effect.provideService(SqlClient.SqlClient, client),
          Effect.provideService(Database.Service, db),
          // A build that fails is a misconfiguration or a database that is away.
          Effect.orDie,
        );
        return yield* Routes.withClientAddress(handler).pipe(
          Effect.provideService(Database.Service, db),
        );
      }).pipe(
        // A route that does not exist is a 404; only a server fault is logged.
        Effect.catchCause((cause) =>
          HttpServerError.causeResponse(cause).pipe(
            Effect.tap(([response, reported]) =>
              response.status >= 500 ? Effect.logError("request failed", reported) : Effect.void,
            ),
            Effect.map(([response]) => response),
          ),
        ),
      ),
    };
  }).pipe(Effect.provide([Postgres.layer, Cloudflare.Email.SendBinding])),
) {}

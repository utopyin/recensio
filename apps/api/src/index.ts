import * as Cloudflare from "@alchemy.run/cloudflare";
import { Database } from "@recensio/db/service";
import { sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Postgres from "@recensio/db/database";

/**
 * The API worker. Its init runs at plan time (registering the Hyperdrive it
 * binds) and at runtime (building the services once per isolate). Reached
 * only through the website's service binding: the website forwards `/api/*`.
 */
export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  {
    main: import.meta.url,
  },
  Effect.gen(function* () {
    const db = yield* Database.Service;

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const { pathname } = new URL(request.url, "http://api");

        if (pathname === "/api/health") {
          const {
            rows: [row],
          } = yield* db.execute<{ now: string }>(sql`select now()::text as now`);
          return yield* HttpServerResponse.json({ ok: true, database: row?.now ?? null });
        }

        return HttpServerResponse.text("Not found", { status: 404 });
      }).pipe(
        Effect.catchCause((cause) =>
          Effect.logError("request failed", cause).pipe(
            Effect.as(HttpServerResponse.text("Internal error", { status: 500 })),
          ),
        ),
      ),
    };
  }).pipe(Effect.provide(Postgres.layer)),
) {}

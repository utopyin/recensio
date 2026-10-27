import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Metric from "effect/Metric";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import type * as HttpServerResponse from "effect/http/HttpServerResponse";
import { PATH } from "./contract";

const count = Metric.counter("recensio.http.request.count", {
  description: "HTTP requests",
  incremental: true,
  attributes: { unit: "{request}" },
});

const duration = Metric.histogram("recensio.http.request.duration", {
  description: "HTTP request duration",
  boundaries: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  attributes: { unit: "s" },
});

const METHODS = new Set(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]);

/** The surfaces of `./index`. A path is never a dimension: an auth action would be. */
const ROUTES = [PATH, "/api/auth"];

const route = (url: string) => {
  const path = new URL(url, "http://localhost").pathname;
  return ROUTES.find((prefix) => path === prefix || path.startsWith(`${prefix}/`)) ?? "unmatched";
};

/**
 * Counts and times every request by method, surface and status, and writes
 * the same three on the request's span.
 */
export const measured = <E, R>(
  self: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  E,
  R | HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const startedAt = yield* Clock.currentTimeMillis;
    const exit = yield* Effect.exit(self);
    const finishedAt = yield* Clock.currentTimeMillis;

    const attributes = {
      "http.request.method": METHODS.has(request.method) ? request.method : "OTHER",
      "http.route": route(request.url),
      "http.response.status_code": String(Exit.isSuccess(exit) ? exit.value.status : 500),
    };
    yield* Effect.annotateCurrentSpan(attributes);
    yield* Metric.update(Metric.withAttributes(count, attributes), 1);
    yield* Metric.update(
      Metric.withAttributes(duration, attributes),
      Math.max(0, finishedAt - startedAt) / 1_000,
    );

    return yield* exit;
  });

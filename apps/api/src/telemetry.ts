import * as Axiom from "@alchemy.run/axiom";
import * as Alchemy from "alchemy";
import * as Output from "alchemy/Output";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/** The collector `alchemy dev` exports to: OTLP over HTTP, where `bun run otel` listens. */
const LOCAL = "http://localhost:4318";

/** `service.name` of everything the API worker emits. */
const SERVICE = "recensio-api";

/*
 * What only the stack reads is a function, from here to `axiom`: each is
 * called past the runtime check in `layer` and nowhere else, so the worker's
 * bundle holds none of it. See `@recensio/db/database`.
 */

/**
 * Two datasets per stage, since dataset names are global to the Axiom
 * organization. `events` holds the traces and the logs together, so a log
 * sits beside the spans of its trace. Axiom keeps metrics in a kind of their own.
 */
const dataset = (id: string, name: "events" | "metrics") =>
  Axiom.Dataset(
    id,
    Effect.map(Alchemy.Stack, ({ stage }) => ({
      name: `recensio-${stage}-${name}`,
      kind: name === "events" ? ("axiom:events:v1" as const) : ("otel:metrics:v1" as const),
      description: `Recensio ${name === "events" ? "traces and logs" : "metrics"}, stage '${stage}'`,
    })),
  );

type Dataset = ReturnType<typeof dataset>;

/**
 * What the worker holds: a token that can write to the two datasets and do
 * nothing else. The Axiom credentials of the deploy create it and never leave
 * the machine that deploys.
 */
const ingest = (events: Dataset, metrics: Dataset) =>
  Axiom.ApiToken(
    "TelemetryIngest",
    Effect.all([Alchemy.Stack, events, metrics]).pipe(
      Effect.map(([{ stage }, events, metrics]) => ({
        name: `recensio-${stage}-ingest`,
        description: `Ingest only, for the Recensio datasets of stage '${stage}'`,
        // The datasets' outputs rather than their names, so the token is made after them.
        datasetCapabilities: Output.all(events.name, metrics.name).pipe(
          Output.map((names) =>
            Object.fromEntries(names.map((name) => [name, { ingest: ["create"] }])),
          ),
        ),
      })),
    ),
  );

const axiom = () => {
  const events = dataset("TelemetryEvents", "events");
  const metrics = dataset("TelemetryMetrics", "metrics");
  return Axiom.Telemetry({
    token: ingest(events, metrics),
    traces: events,
    logs: events,
    metrics,
    serviceName: SERVICE,
  });
};

/**
 * Where the spans, logs and metrics Effect already produces go: Axiom on a
 * deploy, the local collector under `alchemy dev`. Building it binds the
 * endpoints and the token to the worker. Alchemy then exports every event as
 * its scope closes, after the response, and a collector that is away costs a
 * failed request and nothing else.
 */
export const layer = Layer.unwrap(
  Effect.gen(function* () {
    // In the worker the bound values are all that matters, and alchemy reads
    // them by default. The bundler folds this flag to `true`.
    if (globalThis.__ALCHEMY_RUNTIME__) return Layer.empty;
    if (yield* Alchemy.ALCHEMY_DEV) {
      return Alchemy.Telemetry.layerOtlp({ url: LOCAL, serviceName: SERVICE });
    }
    return axiom();
  }).pipe(Effect.orDie),
);

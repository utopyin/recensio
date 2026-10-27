# Recensio

## Layout

Four tiers, four directories — see [docs/architecture/CONTEXT.md](docs/architecture/CONTEXT.md):

| Directory      | Packages                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `packages/`    | `@recensio/db` (Postgres, Drizzle, every table, migrations), `@recensio/ui` (shadcn on Base UI) |
| `domains/`     | none yet                                                                                        |
| `entrypoints/` | none yet                                                                                        |
| `apps/`        | `@recensio/api` (Worker), `@recensio/web` (TanStack Start)                                      |

Infrastructure is Cloudflare, declared in `alchemy.run.ts`: a Hyperdrive in front of Postgres (migrations generated from the Drizzle schema with `bun run db:generate`), the API worker, and the website bound to it by a service binding.

`repos/` holds the sources of Alchemy, Drizzle and Effect as squashed `git subtree`s, for reference only.

## Run

```bash
bun install
bun run dev          # alchemy dev: Docker Postgres, migrations, the API worker and the site; open the `websiteUrl` it prints
bun run otel         # optional: a local collector for the API's telemetry, with HyperDX at http://localhost:3004
```

`bun run check` lints, formats and type-checks every workspace. `bun run deploy` / `bun run destroy` manage the Cloudflare stack through Alchemy, with the values of `.env.prod` (see `.env.prod.example`). Connect Cloudflare first with `bunx alchemy profile edit --add Cloudflare`.

## Telemetry

The API worker exports what Effect already produces: `Effect.fn` and `Effect.withSpan` spans, `Effect.log` records and `Metric` updates. Alchemy wraps each request and sends the three signals over OTLP when it ends, after the response. `apps/api/src/telemetry.ts` only says where to.

- **Under `alchemy dev`**: `http://localhost:4318`. `bun run otel` starts a collector there (ClickStack, container `recensio-otel`, HyperDX at `http://localhost:3004`). It takes the same ports as pecule's, so one runs at a time. With no collector the export fails unseen. From a terminal: `docker exec recensio-otel clickhouse-client --query "..."` on `otel_traces`, `otel_logs` and `otel_metrics_*`.
- **On a deploy**: Axiom. The stack creates `recensio-<stage>-events` (traces and logs together) and `recensio-<stage>-metrics`, and an ingest-only token bound to the worker as a secret. CI deploys with the `AXIOM_TOKEN` secret of the `prod` environment: a token `stacks/github.ts` creates from the Axiom entry of the `admin` profile, allowed to manage datasets and API tokens and nothing else. It never reaches the worker. `alchemy dev` leaves the Axiom providers out, so it needs no Axiom login.
- **Identity**: `service.name` is `recensio-api`; every signal carries `alchemy.stack` and `alchemy.stage`.
- **Requests**: `Routes.measured` (`entrypoints/rpc/metrics.ts`) counts and times each one as `recensio.http.request.count` and `recensio.http.request.duration`, by method, surface (`/api/rpc`, `/api/auth`) and status. A dimension stays a short closed list: never a path, an id or an error message.
- **Never exported**: personal data. No email address, name, sign-in code or SQL parameter in a span attribute, a log or a metric. Our own ids are fine.

The website worker and the browser export nothing; the website strips trace headers before forwarding to the API, so each trace starts there.

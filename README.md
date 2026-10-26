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
```

`bun run check` lints, formats and type-checks every workspace. `bun run deploy` / `bun run destroy` manage the Cloudflare stack through Alchemy, with the values of `.env.prod` (see `.env.prod.example`). Connect Cloudflare first with `bunx alchemy profile edit --add Cloudflare`.

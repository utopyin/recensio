## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Think long term

When approaching a fix, ask yourself if the issue is a sign of a deeper problem. If that's the case, propose the local, minimal fix and if relevant, explain the deeper fix.

Example: The user requests to fix a bug where we a billing policy in the frontend does not match the billing policy in the backend. The easy fix is to change either one of the two policies, and the actual long-term fix is to ensure frontend and backend share the same source of truth and logical piece.

When approaching a new feature, don't just try to model the least amount of code or changes. You own every new feature and must think long term. Think beyond this feature, and how it fits into the overall architecture, domains it touches, and how it interacts with existing features.

We very rarely write test files, so by default you should not think about test coverage if not mentionned explicitely by the user.

## Architecture

Packages live in four tiers — `packages/`, `domains/`, `entrypoints/`, `apps/` — and may only depend downward or sideways, never in a cycle. Read `docs/architecture/CONTEXT.md` before adding a package or a cross-package import. Plans live in `docs/plans/`.

## Vendored Repositories

This project vendors external repositories under `repos/` as `git subtree`s, squashed, each pinned to the tag of the version in the root Bun catalog.

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under `repos/`
- Do not import from `repos/` - application code should continue importing from normal package dependencies

When the catalog moves, move the subtree with it (`git subtree pull --prefix=repos/<name> <url> <tag> --squash`):

| Directory        | Upstream                                          | Tag              |
| ---------------- | ------------------------------------------------- | ---------------- |
| `repos/alchemy/` | `https://github.com/alchemy-run/alchemy.git`      | `v2.0.0-beta.84` |
| `repos/drizzle/` | `https://github.com/drizzle-team/drizzle-orm.git` | `v1.0.0-rc.5`    |
| `repos/effect/`  | `https://github.com/Effect-TS/effect.git`         | `effect@4.0.6`   |

`repos/effect/` is the canonical **Effect v4** source. Before writing or migrating any Effect code, read `repos/effect/LLMS.md` and the relevant guide under `repos/effect/migration/` (e.g. `services.md`, `error-handling.md`, `cause.md`, `v3-to-v4.md`). Trust this vendored source over web search or training data, which often reflect Effect v3 or a different v4 beta.

`repos/drizzle/` is Drizzle ORM/Kit, the 1.0 rc line (`main` upstream is still 0.4x and must not be used as reference). The Effect integration lives in `drizzle-orm/src/effect-*` (bundled, not a separate package); this app uses the `effect-postgres` driver through `@alchemy.run/drizzle/Postgres`.

`repos/alchemy/` is Alchemy v2. Providers are split into packages: `alchemy` is the core (`Stack`, state, `alchemy/Command`), and each provider is `@alchemy.run/<name>` (`packages/<name>` in the repo: `cloudflare`, `docker`, `drizzle`, …). Its `examples/` (notably `cloudflare-website-tanstack-start` and `cloudflare-tanstack-rpc-drizzle`) and `website/src/content/docs/` are the reference for resources, bindings and the Infrastructure-as-Layer pattern.

Use `repos/` for examples of idiomatic usage, tests, module structure, and API design. Treat it as the source of truth for Effect patterns.

## Stack

Infrastructure is Cloudflare, declared in `alchemy.run.ts`: the API worker (`apps/api`), a Hyperdrive in front of Postgres, and the website (`apps/web`, TanStack Start) bound to the API by a service binding.

**Everything the browser calls is same-origin.** The website forwards `/api/*` to the API worker unchanged (`apps/web/src/routes/api/$.ts`). The API has no public route of its own.

**Local state.** `alchemy dev` keeps its state under `.alchemy/` and needs no Cloudflare login; a deploy keeps its state in the Cloudflare account. It runs one Docker container, declared in the stack and adopted by name: `recensio-postgres` (`postgres:18`, port 54340, volume `recensio-postgres-data`). It keeps running when `alchemy dev` stops.

**Database.** Postgres behind a Cloudflare Hyperdrive, all of it in `packages/db`. `database.ts` declares the Hyperdrive (the Docker container under `alchemy dev`, the origin in `.env.deploy` on a deploy), the migration step, Drizzle Studio, and `layer`, which gives a worker `Database.Service`. Every table of this app is `rec_<name>`, and `@recensio/db/table` is the only table factory. Migrations are SQL files under `packages/db/migrations`: `bun run db:generate` writes one from `packages/db/schema`, and the stack applies the pending ones on `alchemy dev` and on deploy (`bun run db:migrate` does it by hand, against `DATABASE_URL`).

What only the stack reads must stay out of the worker bundle. Put it in a module only `alchemy.run.ts` imports, or in a function called past `globalThis.__ALCHEMY_RUNTIME__`, as `packages/db/database.ts` does.

## Ownership

A domain owns its concept end to end: its types, its ids, its rules and its contract. Tier 1 only holds mechanism that knows no concept, with one exception:

- **Tables are the exception.** Every table lives in `@recensio/db`, not in its domain: `packages/db/schema/<domain>.ts`, one file per domain, which may hold several tables, each declared with `@recensio/db/table`. Every relation lives in the single `packages/db/schema/relations.ts`, cross-domain ones included. A new domain file is listed in `schema/index.ts`. The point is one schema that the migrations, the relations and the typed `Database.Service` all read. A domain imports its tables from `@recensio/db/schema/<domain>` and is still the only package that writes to them. Nothing in `packages/db` may hold domain behaviour: columns, constraints, indexes and relations only.
- `@recensio/db` is also the Drizzle instance (`Database.Service`, typed with the whole schema and its relations, so `db.query.<table>` works), the Hyperdrive resource and its layer (`database.ts`), the migrator and the migrations.
- `@recensio/ui` is shadcn on Base UI (`base-nova`), with Tabler icons (`@tabler/icons-react`). Add a component with `bunx shadcn@latest add <name>` from `packages/ui`; it lands in `packages/ui/src/<name>.tsx` and is imported as `@recensio/ui/<name>`.

`bun run check:deps` (`scripts/deps.ts`, part of `bun run check`) fails on an upward import, a cycle between packages, an undeclared or unused `@recensio/*` dependency, or a relative import that leaves its package.

## Patched dependencies

`patches/` holds `bun patch` fixes for upstream bugs, listed in `patchedDependencies` in the root `package.json`. Each says why in a `Patched (recensio)` comment. Drop the patch when the version that fixes it lands, and check it still applies whenever the package moves.

- `@alchemy.run/cloudflare` (`src/Workers/ViteChild.ts`): under Bun, alchemy loads its `src/*.ts` even from `node_modules`. When `node` is on the PATH, `alchemy dev` starts the website's Vite server in a Node child and hands it the `.ts` runner, which Node cannot load from `node_modules`. Without the patch, the website never starts under `alchemy dev`. The patch hands the child the built `lib/*.js` runner.

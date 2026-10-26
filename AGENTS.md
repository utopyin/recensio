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

Use `repos/` for examples of idiomatic usage of Alchemy@2, Effect@4, Drizzle@2, tests, module structure, and API design. Treat it as the source of truth for Effect patterns.

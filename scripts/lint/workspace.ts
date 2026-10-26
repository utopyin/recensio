/**
 * The workspace packages, read from the root manifest's `workspaces` and each
 * package's own `package.json`, and the graph their declared dependencies make.
 * See `docs/architecture/CONTEXT.md`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, repoPath } from "./paths.ts";

/** Lowest first. `scripts` is tooling: it sits with the apps, imported by nobody. */
export const TIERS = ["packages", "domains", "entrypoints", "apps"] as const;

export interface Package {
  readonly name: string;
  /** Relative to the repository root. */
  readonly dir: string;
  readonly tier: number;
  readonly declared: ReadonlySet<string>;
}

export const PREFIX = "@recensio/";

/** The workspace package a specifier names, `@recensio/db` for `@recensio/db/schema/identity`. */
export const workspaceName = (specifier: string) =>
  specifier.startsWith(PREFIX) ? specifier.split("/").slice(0, 2).join("/") : null;

let packages: Map<string, Package> | undefined;

export const workspace = (): ReadonlyMap<string, Package> => (packages ??= load());

/** The workspace package `filename` belongs to, if any. */
export const packageOf = (filename: string) => {
  const path = repoPath(filename);
  for (const pkg of workspace().values()) if (path.startsWith(`${pkg.dir}/`)) return pkg;
  return null;
};

/** The declared path `from → … → to` between two packages, or `null` when there is none. */
export const pathBetween = (from: string, to: string): Array<string> | null => {
  const previous = new Map<string, string | null>([[from, null]]);
  const queue = [from];

  for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
    if (current === to) {
      const path: Array<string> = [];
      for (let at: string | null = to; at !== null; at = previous.get(at) ?? null) path.unshift(at);
      return path;
    }
    for (const next of workspace().get(current)?.declared ?? []) {
      if (previous.has(next) || !workspace().has(next)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }

  return null;
};

const tierOf = (dir: string) =>
  dir === "scripts" ? TIERS.length - 1 : TIERS.indexOf(dir.split("/")[0] as (typeof TIERS)[number]);

function load() {
  const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
    workspaces: { packages: Array<string> };
  };
  const dirs = manifest.workspaces.packages.flatMap((pattern) => {
    if (!pattern.endsWith("/*")) return [pattern];
    const parent = pattern.slice(0, -2);
    return existsSync(join(ROOT, parent))
      ? readdirSync(join(ROOT, parent)).map((entry) => `${parent}/${entry}`)
      : [];
  });

  return new Map(
    dirs
      .filter((dir) => existsSync(join(ROOT, dir, "package.json")))
      .map((dir): [string, Package] => {
        const pkg = JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf8")) as {
          name: string;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        return [
          pkg.name,
          {
            name: pkg.name,
            dir,
            tier: tierOf(dir),
            declared: new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })),
          },
        ];
      }),
  );
}

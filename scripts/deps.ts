/**
 * Enforces the package architecture (`docs/architecture/CONTEXT.md`):
 *
 * - a package only imports packages of its own tier or a lower one;
 * - the package graph has no cycle;
 * - every `@recensio/*` import is declared in the importer's `package.json`,
 *   so the graph checked here is the real one;
 * - no relative import leaves its package (apps and scripts, which sit at the
 *   top, may reach the root stack file).
 *
 * `bun run check:deps`; part of `bun run check`.
 */
import { Glob } from "bun";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
/** Lowest first. `scripts` is tooling: it sits with the apps, imported by nobody. */
const TIERS = ["packages", "domains", "entrypoints", "apps"] as const;

interface Package {
  readonly name: string;
  readonly dir: string;
  readonly tier: number;
  readonly declared: ReadonlySet<string>;
}

const tierOf = (dir: string): number => {
  const top = dir.split("/")[0] ?? "";
  return top === "scripts" ? TIERS.length - 1 : TIERS.indexOf(top as (typeof TIERS)[number]);
};

const packages = new Map<string, Package>();
for await (const file of new Glob("{packages,domains,entrypoints,apps}/*/package.json").scan(
  ROOT,
)) {
  const manifest = (await Bun.file(join(ROOT, file)).json()) as {
    name: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const dir = dirname(file);
  packages.set(manifest.name, {
    name: manifest.name,
    dir,
    tier: tierOf(dir),
    declared: new Set(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })),
  });
}
{
  const manifest = (await Bun.file(join(ROOT, "scripts/package.json")).json()) as {
    name: string;
    dependencies?: Record<string, string>;
  };
  packages.set(manifest.name, {
    name: manifest.name,
    dir: "scripts",
    tier: tierOf("scripts"),
    declared: new Set(Object.keys(manifest.dependencies ?? {})),
  });
}

const problems: Array<string> = [];
const edges = new Map<string, Set<string>>();

const IMPORT = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

for (const pkg of packages.values()) {
  const used = new Set<string>();
  for await (const file of new Glob("**/*.{ts,tsx}").scan(join(ROOT, pkg.dir))) {
    if (file.includes("node_modules/") || file.endsWith(".gen.ts")) continue;
    const path = join(pkg.dir, file);
    const source = await Bun.file(join(ROOT, path)).text();

    for (const [, specifier = ""] of source.matchAll(IMPORT)) {
      if (specifier.startsWith("@recensio/")) {
        used.add(specifier.split("/").slice(0, 2).join("/"));
      } else if (specifier.startsWith(".")) {
        const target = relative(ROOT, resolve(ROOT, dirname(path), specifier));
        const escapes = target !== pkg.dir && !target.startsWith(`${pkg.dir}/`);
        // The top tier may read the stack definition at the root, and nothing else outside itself.
        const allowed = pkg.tier === TIERS.length - 1 && target === "alchemy.run";
        if (escapes && !allowed)
          problems.push(`${path}: relative import leaves the package: ${specifier}`);
      }
    }
  }

  used.delete(pkg.name);
  edges.set(pkg.name, used);
  for (const dependency of used) {
    const target = packages.get(dependency);
    if (target === undefined) {
      problems.push(`${pkg.name}: imports unknown package ${dependency}`);
      continue;
    }
    if (!pkg.declared.has(dependency)) {
      problems.push(`${pkg.name}: imports ${dependency} without declaring it in package.json`);
    }
    if (target.tier > pkg.tier) {
      problems.push(
        `${pkg.name} (${TIERS[pkg.tier]}) imports ${dependency} (${TIERS[target.tier]}): upward edge`,
      );
    }
  }
  for (const dependency of pkg.declared) {
    if (dependency.startsWith("@recensio/") && !used.has(dependency)) {
      problems.push(`${pkg.name}: declares ${dependency} but never imports it`);
    }
  }
}

// Cycles: depth-first, reporting each loop once by its path.
const state = new Map<string, "visiting" | "done">();
const visit = (name: string, path: ReadonlyArray<string>): void => {
  if (state.get(name) === "done") return;
  if (state.get(name) === "visiting") {
    problems.push(`cycle: ${[...path.slice(path.indexOf(name)), name].join(" → ")}`);
    return;
  }
  state.set(name, "visiting");
  for (const dependency of edges.get(name) ?? []) visit(dependency, [...path, name]);
  state.set(name, "done");
};
for (const name of packages.keys()) visit(name, []);

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`dependencies: ${packages.size} packages, no upward edge, no cycle`);

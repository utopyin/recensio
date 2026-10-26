import { dirname, resolve } from "node:path";
import { onSpecifier } from "../imports.ts";
import { repoPath } from "../paths.ts";
import type { Rule } from "../types.ts";
import { packageOf, TIERS } from "../workspace.ts";

/** The one file outside a package the top tier may reach: the stack definition. */
const STACK = "alchemy.run";

/** A relative import stays inside its package: anything else goes through a package's exports. */
export const relativeImports: Rule = {
  create(context) {
    const owner = packageOf(context.filename);
    if (owner === null) return {};

    return onSpecifier((specifier, node) => {
      if (!specifier.startsWith(".")) return;
      const target = repoPath(resolve(dirname(context.filename), specifier));
      if (target === owner.dir || target.startsWith(`${owner.dir}/`)) return;
      if (owner.tier === TIERS.length - 1 && target.replace(/\.ts$/, "") === STACK) return;

      context.report({
        node,
        message: `${specifier} leaves ${owner.name}. Import another package by its name.`,
      });
    });
  },
};

import { onSpecifier } from "../imports.ts";
import type { Rule } from "../types.ts";
import { packageOf, pathBetween, workspace, workspaceName } from "../workspace.ts";

/**
 * A `@recensio/*` import names a package that exists, is declared in the
 * importer's `package.json` (so the graph checked here is the real one), and
 * does not already depend on the importer.
 */
export const workspaceImports: Rule = {
  create(context) {
    const owner = packageOf(context.filename);
    if (owner === null) return {};

    return onSpecifier((specifier, node) => {
      const target = workspaceName(specifier);
      if (target === null || target === owner.name) return;

      if (!workspace().has(target)) {
        context.report({ node, message: `${owner.name} imports unknown package ${target}.` });
        return;
      }
      if (!owner.declared.has(target))
        context.report({
          node,
          message: `${owner.name} imports ${target} without declaring it in package.json.`,
        });

      const cycle = pathBetween(target, owner.name);
      if (cycle !== null)
        context.report({
          node,
          message: `cycle: ${[owner.name, ...cycle].join(" → ")}. Break it; no package depends on itself.`,
        });
    });
  },
};

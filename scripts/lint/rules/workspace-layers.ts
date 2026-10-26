import { onSpecifier } from "../imports.ts";
import type { Rule } from "../types.ts";
import { packageOf, TIERS, workspace, workspaceName } from "../workspace.ts";

/** A package imports its own tier or a lower one, never a higher one. */
export const workspaceLayers: Rule = {
  create(context) {
    const owner = packageOf(context.filename);
    if (owner === null) return {};

    return onSpecifier((specifier, node) => {
      const name = workspaceName(specifier);
      const target = name === null ? undefined : workspace().get(name);
      if (target === undefined || target.tier <= owner.tier) return;

      context.report({
        node,
        message: `${owner.name} (${TIERS[owner.tier]}) imports ${target.name} (${TIERS[target.tier]}): upward edge. Move what it needs down a tier.`,
      });
    });
  },
};

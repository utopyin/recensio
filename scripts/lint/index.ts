/**
 * Recensio's own lint rules, loaded by `oxlint.config.ts`. They enforce the
 * package architecture of `docs/architecture/CONTEXT.md` file by file. Node
 * loads these modules as they are: relative imports keep their `.ts`.
 */
import { relativeImports } from "./rules/relative-imports.ts";
import { workspaceImports } from "./rules/workspace-imports.ts";
import { workspaceLayers } from "./rules/workspace-layers.ts";

export default {
  meta: { name: "recensio" },
  rules: {
    "relative-imports": relativeImports,
    "workspace-imports": workspaceImports,
    "workspace-layers": workspaceLayers,
  },
};

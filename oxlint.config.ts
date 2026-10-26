import { defineConfig, type DummyRuleMap } from "oxlint";
import { recommended } from "@effect/tsgo/oxlint-presets";

export default defineConfig({
  ignorePatterns: ["repos", "**/routeTree.gen.ts", "packages/db/migrations"],
  extends: [recommended],
  // The package architecture (`docs/architecture/CONTEXT.md`): see `scripts/lint`.
  jsPlugins: ["./scripts/lint/index.ts"],
  overrides: [
    {
      files: ["apps/web/**/*", "packages/ui/**/*", "scripts/**/*"],
      rules: Object.keys(recommended.rules ?? {}).reduce((acc, key) => {
        acc[key] = "off";
        return acc;
      }, {} as DummyRuleMap),
    },
    {
      // Node loads the lint plugin as it is, and needs the extensions.
      files: ["scripts/lint/**/*"],
      rules: { "import/extensions": "off" },
    },
    {
      // State that outlives a component is an atom: see `apps/web/AGENTS.md`.
      files: ["apps/web/**/*"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "react",
                importNames: ["createContext", "useContext"],
                message:
                  "Shared client state is an atom (effect/reactivity/Atom), read with @effect/atom-react hooks. See apps/web/AGENTS.md.",
              },
            ],
          },
        ],
      },
    },
  ],
  rules: {
    "recensio/workspace-layers": "error",
    "recensio/workspace-imports": "error",
    "recensio/relative-imports": "error",
    "import/extensions": ["error", "never"],
    // effect/http and effect/rpc are unstable modules; flagging every use is noise.
    "effecttsgo/unstable-api-usage": "off",
  },
});

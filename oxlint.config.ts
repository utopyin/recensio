import { defineConfig, type DummyRuleMap } from "oxlint";
import { recommended } from "@effect/tsgo/oxlint-presets";

export default defineConfig({
  ignorePatterns: ["repos", "**/routeTree.gen.ts", "packages/db/migrations"],
  extends: [recommended],
  overrides: [
    {
      files: ["apps/web/**/*", "packages/ui/**/*", "scripts/**/*"],
      rules: Object.keys(recommended.rules ?? {}).reduce((acc, key) => {
        acc[key] = "off";
        return acc;
      }, {} as DummyRuleMap),
    },
  ],
  rules: {
    "import/extensions": ["error", "never"],
    // effect/http and effect/rpc are unstable modules; flagging every use is noise.
    "effecttsgo/unstable-api-usage": "off",
  },
});

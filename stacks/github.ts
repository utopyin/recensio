/**
 * What CI needs to deploy, written into the GitHub repository: a Cloudflare
 * token scoped to this stack, the `prod` environment that holds it, the
 * deploy settings, and the label that asks for a deploy. Deploy it once, and
 * again whenever `.env.prod` changes or a credential rotates:
 *
 *   bun alchemy deploy --config stacks/github.ts --profile admin
 *
 * The `admin` profile must be allowed to create Cloudflare API tokens (the
 * Global API Key, or a token with `API Tokens Write`), and GitHub auth comes
 * from `gh auth token` or `GITHUB_TOKEN`.
 */
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as GitHub from "@alchemy.run/github";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

const repo = { owner: "utopyin", repository: "recensio" } as const;

/** The label a pull request carries to be deployed once merged. Read by `.github/workflows/ci.yml`. */
export const DEPLOY_LABEL = "prod";

export default Alchemy.Stack(
  "RecensioGitHub",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const { accountId } = yield* yield* Cloudflare.CloudflareEnvironment;
    const account = `com.cloudflare.api.account.${accountId}`;

    // What `alchemy deploy` of the app stack touches, and nothing else.
    const token = yield* Cloudflare.ApiToken.AccountApiToken("CIToken", {
      accountId,
      policies: [
        {
          effect: "allow",
          permissionGroups: [
            "Workers Scripts Write",
            "Hyperdrive Write",
            "Email Sending Write",
            "Account Settings Read",
            "Workers Tail Read",
            // `Cloudflare.state()` reads its bearer token from the Secrets Store
            // through a binding, which takes Write.
            "Secrets Store Write",
          ],
          resources: { [account]: "*" },
        },
        {
          // The website's custom domain.
          effect: "allow",
          permissionGroups: ["Zone Read", "DNS Write", "Workers Routes Write"],
          resources: { [account]: { "com.cloudflare.api.account.zone.*": "*" } },
        },
      ],
    });

    // Only a job that names this environment sees its secrets: pull request
    // checks never do.
    const environment = yield* GitHub.Environment("ProdEnvironment", { ...repo, name: "prod" });

    yield* GitHub.Secret("CloudflareApiToken", {
      ...repo,
      environment,
      name: "CLOUDFLARE_API_TOKEN",
      value: token.value,
    });
    yield* GitHub.Secret("CloudflareAccountId", {
      ...repo,
      environment,
      name: "CLOUDFLARE_ACCOUNT_ID",
      value: Redacted.make(accountId),
    });

    // The deploy settings, as one secret holding `.env.prod` whole: CI writes
    // it back to the file and deploys as a local `bun run deploy` does.
    const fs = yield* FileSystem.FileSystem;
    yield* GitHub.Secret("EnvDeploy", {
      ...repo,
      environment,
      name: "ENV_DEPLOY",
      value: Redacted.make(yield* fs.readFileString(".env.prod")),
    });

    yield* GitHub.Label("DeployLabel", {
      ...repo,
      name: DEPLOY_LABEL,
      color: "b60205",
      description: "Deploy to production once merged",
    });
  }).pipe(Effect.orDie),
);

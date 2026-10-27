import * as Axiom from "@alchemy.run/axiom";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Docker from "@alchemy.run/docker";
import * as Alchemy from "alchemy";
import * as Command from "alchemy/Command";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import Api from "./apps/api/src/index";
import { Hyperdrive, Studio } from "@recensio/db/database";

/**
 * The website: TanStack Start, with the API worker bound as `API`. A deploy
 * serves it on `SITE_DOMAIN` only: auth trusts that one origin (see
 * `apps/api/src/configuration.ts`), so a `workers.dev` URL would serve pages
 * nobody could sign in on.
 */
export const Website = Cloudflare.Website.Vite(
  "Website",
  Effect.gen(function* () {
    const site = { rootDir: "apps/web", env: { API: Api } };
    if (yield* Alchemy.ALCHEMY_DEV) return site;
    return { ...site, domain: yield* Config.String("SITE_DOMAIN"), workersDev: false };
  }).pipe(Effect.orDie),
);

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;

/**
 * Axiom holds the telemetry of a deploy (`apps/api/src/telemetry.ts`). Its
 * dataset provider reads its credentials when it is built, planned or not, so
 * `alchemy dev` leaves the providers out and still needs no Axiom login.
 */
const Telemetry = Layer.unwrap(
  Effect.gen(function* () {
    const dev = yield* Alchemy.ALCHEMY_DEV;
    return dev ? Layer.empty : Axiom.providers();
  }).pipe(Effect.orDie),
);

export default Alchemy.Stack(
  "Recensio",
  {
    providers: Docker.providers().pipe(
      Layer.provideMerge(Command.providers()),
      Layer.provideMerge(Cloudflare.providers()),
      Layer.provideMerge(Telemetry),
    ),
    // `alchemy dev` runs every resource on this machine, so its state stays here too
    // and no Cloudflare login is needed. A deploy keeps its state in the account.
    state: Layer.unwrap(
      Effect.gen(function* () {
        const dev = yield* Alchemy.ALCHEMY_DEV;
        return dev ? Alchemy.localState() : Cloudflare.state();
      }).pipe(Effect.orDie),
    ),
  },
  Effect.gen(function* () {
    const api = yield* Api;
    const website = yield* Website;
    const hyperdrive = yield* Hyperdrive;
    const dev = yield* Alchemy.ALCHEMY_DEV;
    // Only under `alchemy dev`, and after the database it reads exists.
    const studio = dev ? yield* Studio() : undefined;

    return {
      apiUrl: api.url.as<string>(),
      websiteUrl: website.url.as<string>(),
      hyperdriveId: hyperdrive.hyperdriveId,
      studioUrl: studio?.url,
    };
  }),
);

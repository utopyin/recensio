import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Docker from "@alchemy.run/docker";
import * as Alchemy from "alchemy";
import * as Command from "alchemy/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import Api from "./apps/api/src/index";
import { Hyperdrive, Studio } from "@recensio/db/database";

/** The website: TanStack Start, with the API worker bound as `API`. */
export const Website = Cloudflare.Website.Vite("Website", {
  rootDir: "apps/web",
  env: { API: Api },
});

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;

export default Alchemy.Stack(
  "Recensio",
  {
    providers: Docker.providers().pipe(
      Layer.provideMerge(Command.providers()),
      Layer.provideMerge(Cloudflare.providers()),
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

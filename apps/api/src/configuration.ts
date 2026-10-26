import type { Identity } from "@recensio/identity/service";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

/** Local development only: these two are in the repository, so they protect nothing. */
const DEV_KEYS = {
  proof: "cmVjZW5zaW8tZGV2LXByb29mLWtleS1ub3Qtc2VjcmV0",
  binding: "cmVjZW5zaW8tZGV2LWJpbmRpbmcta2V5LW5vdC1zZWNyZXQ",
};

/**
 * What auth must be told about this deployment. A secret has a default under
 * `alchemy dev` and none on a deploy, which then fails for lack of it.
 */
export const configuration = Effect.gen(function* () {
  const dev = yield* Alchemy.ALCHEMY_DEV;
  const secret = (name: string, local: string) =>
    dev
      ? Config.Redacted(name).pipe(Config.withDefault(Redacted.make(local)))
      : Config.Redacted(name);

  const keys = {
    proofKey: yield* secret("AUTH_PROOF_KEY", DEV_KEYS.proof),
    bindingKey: yield* secret("AUTH_BINDING_KEY", DEV_KEYS.binding),
  };
  // Where browsers reach the website: the only origin auth trusts. On a
  // deploy, the domain the stack serves the website on (`alchemy.run.ts`).
  // `alchemy dev` serves the website on whichever port is free, so there it is
  // the origin the request came through, which the website forwards untouched.
  const site = dev ? Option.none() : Option.some(`https://${yield* Config.String("SITE_DOMAIN")}`);

  return {
    /** The settings to serve the request at `url` with. A deploy never reads `url`. */
    settings: (url: string): Identity.Settings => ({
      ...keys,
      origin: Option.getOrElse(site, () => new URL(url).origin),
    }),
    // Who may open an account: exact addresses, `*@domain`, or `*` for anyone.
    // Anyone under `alchemy dev`; nobody on a deploy that does not say.
    signUp: yield* Config.String("SIGN_UP_ALLOWED_EMAILS").pipe(Config.withDefault(dev ? "*" : "")),
  };
});

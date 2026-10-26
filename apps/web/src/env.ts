import * as Cloudflare from "cloudflare:workers";
import type { WebsiteEnv } from "../../../alchemy.run";

// Under TanStack Start's dev server, `env` from "cloudflare:workers" cannot be
// read at the top level of a module: each read goes through this proxy instead.
export const env = new Proxy({} as WebsiteEnv, {
  get(_, property) {
    return Cloudflare.env[property as keyof typeof Cloudflare.env];
  },
});

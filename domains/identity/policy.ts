/**
 * Who may open an account. It only gates the first code sent to an address
 * nobody has used: someone who already has an account always signs in.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export interface Interface {
  /** Whether a first code may be sent to this address, which creates its account. */
  readonly allows: (email: string) => Effect.Effect<boolean>;
}

export class Service extends Context.Service<Service, Interface>()(
  "@recensio/identity/SignUpPolicy",
) {}

/**
 * From a comma-separated list of patterns: an exact address, `*@domain` for
 * everyone at that domain and no other, or `*` for anyone. An empty list lets
 * nobody in. Case does not matter.
 */
export const fromPatterns = (patterns: string) => {
  const entries = patterns
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== "");
  const anyone = entries.includes("*");
  const addresses = new Set(entries.filter((entry) => !entry.startsWith("*")));
  // Kept with its `@`, and compared with everything from the address's last `@` on:
  // `*@example.com` takes `a@example.com`, not `a@evil-example.com` or `a@example.com.evil.org`.
  const domains = new Set(
    entries.filter((entry) => entry.startsWith("*@")).map((entry) => entry.slice(1)),
  );

  return Layer.succeed(
    Service,
    Service.of({
      allows: (email) =>
        Effect.sync(() => {
          const address = email.trim().toLowerCase();
          return (
            anyone || addresses.has(address) || domains.has(address.slice(address.lastIndexOf("@")))
          );
        }),
    }),
  );
};

export * as SignUpPolicy from "./policy";

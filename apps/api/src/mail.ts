import * as Cloudflare from "@alchemy.run/cloudflare";
import { Mail } from "@recensio/identity/mail";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/** Who sign-in codes come from. In production: an address on a domain Cloudflare may send for. */
const from = Config.String("AUTH_EMAIL_FROM").pipe(Config.withDefault("recensio@localhost"));

/** The worker's `send_email` binding. */
export const Sender = Cloudflare.Email.SendEmail("AuthEmail", {});

/**
 * Sign-in mail through Cloudflare's email binding. Yield it while the worker
 * is being constructed; the layer it returns is built per request, because
 * sending needs the request's runtime context.
 *
 * Under `alchemy dev` nothing leaves the machine: the message is written to
 * `.alchemy/local/email`, and its text, code included, to the worker log.
 */
export const make = Effect.gen(function* () {
  const binding = yield* Cloudflare.Email.Send(yield* Sender);
  const sender = yield* from;
  const dev = yield* Alchemy.ALCHEMY_DEV;

  return Layer.effect(
    Mail.Service,
    Effect.gen(function* () {
      const runtime = yield* Alchemy.RuntimeContext;

      return Mail.Service.of({
        send: (message) =>
          Effect.gen(function* () {
            if (dev) yield* Effect.log(`MAIL to=${message.to} ${JSON.stringify(message.text)}`);
            yield* binding.send({ from: sender, ...message });
          }).pipe(
            Effect.provideService(Alchemy.RuntimeContext, runtime),
            Effect.mapError((cause) => new Mail.MailError({ cause })),
          ),
      });
    }),
  );
});

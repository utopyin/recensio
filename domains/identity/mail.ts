/** How mail leaves: sign-in codes. The app decides: a log line in dev, a provider in production. */
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/** A message ready to send. `text` holds a code that lets someone in: never log it outside development. */
export interface Message {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/** The provider did not take the message, or did not say. The code request fails. */
export class MailError extends Schema.TaggedError<MailError, { readonly brand: unique symbol }>()(
  "Identity.MailError",
  { cause: Schema.Unknown },
) {}

export interface Interface {
  readonly send: (message: Message) => Effect.Effect<void, MailError>;
}

export class Service extends Context.Service<Service, Interface>()("@recensio/identity/Mail") {}

export * as Mail from "./mail";

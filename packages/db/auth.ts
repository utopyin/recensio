/**
 * What auth stores with the data, and under which names: shared by the tables
 * (`./schema/identity`) and the contract of the identity domain.
 *
 * LEAF MODULE: imports only `effect`. The website bundles it.
 */
import * as Schema from "effect/Schema";

/** Names every auth service key and stored module. Stored with the data: never change it. */
export const NAMESPACE = "recensio/Auth";

/** Stored with every email credential: never change it. */
export const EMAIL_NAMESPACE = "recensio/email";

/** What a session carries. Read again from `rec_users` on every request. */
export const Claims = Schema.Struct({
  email: Schema.String,
  /** `null` until the user has said what to call them: the sign of a first sign-in. */
  name: Schema.NullOr(Schema.String),
});

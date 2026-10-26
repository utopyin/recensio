/**
 * What the browser may ask of auth, and what a session carries. The server
 * mounts exactly these actions and the website's client calls them by name.
 *
 * LEAF MODULE: imports only `effect`, the auth library's contract helpers and
 * what `@recensio/db/auth` says is stored. No key, no storage, no server
 * configuration: the website bundles it.
 */
import { Claims, NAMESPACE } from "@recensio/db/auth";
import {
  AuthContract,
  Email,
  Hooks,
  Operations,
  Proofs,
  Schema as AuthSchema,
} from "@yielded/auth";
import * as Schema from "effect/Schema";

export { Claims };

/**
 * Where the browser reaches auth. The auth client resolves each action against
 * the site's origin, so the API serves these paths as they are and the website
 * forwards them without rewriting.
 */
export const BASE_PATH = "/api/auth";

/** Where a completed email sign-in may land. The server refuses any other target. */
export const RETURN_TARGET = "/";

const EmailFailure = Schema.Union([
  Email.EmailRejected,
  Email.EmailUnavailable,
  Email.EmailActionRequired,
  Email.EmailMethodUnsupported,
  Hooks.HookDenied,
]);

const signIn = {
  flowId: Operations.RequestBindingFlowId,
  // Decoding trims and lower-cases the address, so `A@x.com` and `a@x.com` are one account.
  email: Schema.String.check(Schema.isMaxLength(320)).pipe(Schema.decodeTo(AuthSchema.Email)),
  returnTarget: Schema.String.check(Schema.isMaxLength(2048)),
};

export const AuthApi = AuthContract.make(NAMESPACE, {
  basePath: BASE_PATH,
  claims: Claims,
  actions: (sessions) => ({
    // One code signs anyone in: begin, request the code, complete with it.
    beginEmailSignIn: AuthContract.action({
      payload: Schema.Struct({ flowId: Operations.RequestBindingFlowId }),
      success: Operations.RequestBindingPublic,
      error: EmailFailure,
      mode: "mutation",
      credentials: true,
      method: "beginSignIn",
      strategy: "email",
    }),
    /** Sends the code. The one step that may create an account: see `./targets`. */
    requestEmailCode: AuthContract.action({
      payload: Schema.Struct({
        ...signIn,
        requestId: Proofs.ProofRequestId,
        locale: Schema.NonEmptyString.check(Schema.isMaxLength(64)),
      }),
      success: Proofs.ProofRequestReceipt,
      error: EmailFailure,
      mode: "mutation",
      credentials: true,
      method: "signIn",
      strategy: "email",
      requestFields: { requestBinding: "request-binding" },
    }),
    completeEmailSignIn: AuthContract.action({
      payload: Schema.Struct({
        ...signIn,
        reference: Proofs.ProofReference,
        secret: Schema.RedactedFromValue(Schema.String.check(Schema.isMaxLength(4096))),
      }),
      success: Schema.Struct({
        completion: sessions.CompletionResult,
        returnTarget: Email.SafeReturnTarget,
      }),
      error: EmailFailure,
      mode: "mutation",
      credentials: true,
      replay: "single-use",
      method: "completeSignIn",
      strategy: "email",
      requestFields: { requestBinding: "request-binding" },
      subject: {
        fromSuccess: (value) =>
          value.completion._tag === "Authenticated"
            ? value.completion.session.subjectId
            : undefined,
        sessionFromSuccess: (value) =>
          value.completion._tag === "Authenticated" ? value.completion.session : undefined,
      },
    }),
  }),
});

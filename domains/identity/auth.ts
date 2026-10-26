/** The contract bound to how people sign in. Building it does nothing: `./service` supplies what it needs. */
import { EMAIL_NAMESPACE } from "@recensio/db/auth";
import { sessions } from "@recensio/db/schema/identity";
import { Auth, Email } from "@yielded/auth";
import { AuthApi } from "./contract";

/** A code sent by email. No password. */
export const AppAuth = Auth.make(AuthApi, {
  sessions,
  strategies: { email: Email.makeCode({ namespace: EMAIL_NAMESPACE }) },
  defaultStrategy: "email",
});

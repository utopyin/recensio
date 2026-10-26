/**
 * The identity domain's tables: `rec_users`, and the auth library's own
 * tables under `rec_auth_`, attached to it. The library lays its tables out
 * from an auth definition, so the one it lays them out from is here too.
 */
import { Auth, Email, Schema as AuthSchema, Sessions } from "@yielded/auth";
import { AuthPersistence } from "@yielded/auth-persistence-drizzle/Postgres";
import { boolean, text, timestamp } from "drizzle-orm/pg-core";
import * as Effect from "effect/Effect";
import { Claims, EMAIL_NAMESPACE, NAMESPACE } from "../auth";
import { named } from "../config";
import { table } from "../table";

/** Someone who signs in. A row exists from the moment a code is sent to a new address. */
export const users = table("users", {
  id: text().primaryKey(),
  /** A disabled user cannot sign in and has no valid session. */
  enabled: boolean().notNull().default(true),
  /** Changes whenever what the user signs in with changes; a session issued under another one is void. */
  securityRevision: text().notNull(),
  /** Lower case, as the auth library normalises it. */
  email: text().notNull(),
  /** What the app calls them. Absent until they say. */
  name: text(),
  createdAt: timestamp({ withTimezone: true, mode: "string" }).notNull().defaultNow(),
  /** When a code sent to the address was first entered. Until then nobody has proven they own it. */
  confirmedAt: timestamp({ withTimezone: true, mode: "string" }),
});

/** Sessions are rows: signing out revokes one, and disabling a user voids all of theirs. */
export const sessions = Sessions.stateful();

/** What it takes to be signed in: having held the mailbox within the last five minutes. */
export const requirement = Sessions.AuthenticationRequirement.make({
  alternatives: [
    {
      factors: ["possession"],
      userVerified: false,
      phishingResistant: false,
      minimumCredentials: 1,
    },
  ],
  maximumAgeMillis: 300_000,
});

/**
 * WORKAROUND, yielded 0.1.0-beta.46. The definition storage is laid out and
 * built from, not the one requests are served with (`@recensio/identity/auth`).
 * The library's composed storage refuses a definition that holds
 * `Email.makeCode` ("Use explicit services for strategies without composed
 * persistence support") and lays out no proof or email tables for it. This
 * one shares the namespace and the sessions, so its service keys are the ones
 * the served definition asks for, and holds `Email.makeAddresses` instead,
 * which the library does know how to store. Address management is not
 * exposed anywhere.
 *
 * On an upgrade: try `AuthPersistence.make` on the served definition. If its
 * layer builds and the layout lists the proof and email tables, delete this.
 */
export const StorageAuth = Auth.make(NAMESPACE, {
  claims: Claims,
  sessions,
  strategies: {
    emailAddresses: Email.makeAddresses({
      namespace: EMAIL_NAMESPACE,
      addresses: { maximumEvidenceAgeMillis: 300_000, requireImmediateInvalidation: true },
    }),
  },
});

export const Persistence = AuthPersistence.make(StorageAuth);

/**
 * Which table plays which role. The library names a table `rec_auth_<role>`
 * with the role in camelCase (`rec_auth_emailCredentials`), unlike our own.
 */
export const storage = Persistence.managed({
  prefix: named("auth"),
  subjects: {
    table: users,
    id: "id",
    status: "enabled",
    activeValue: true,
    securityRevision: "securityRevision",
    idCodec: AuthSchema.SubjectId,
    requirements: () => Effect.succeed(requirement),
  },
});

/**
 * The auth library's tables, one named export each: drizzle-kit only sees a
 * table that is a named export. Nothing queries them through these names.
 */
export const {
  identifiers: authIdentifiers,
  credentials: authCredentials,
  sessions: authSessions,
  pending: authPending,
  emailCredentials: authEmailCredentials,
  proofs: authProofs,
} = storage.schema;

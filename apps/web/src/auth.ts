/**
 * Signing in and out, as atoms. Each step of a sign-in is a write atom a page
 * runs with `useAtomSet(atom, { mode: "promise" })`. The session itself is
 * read on the server before a page renders (`session`), so a signed-in page
 * never shows a signed-out state.
 */
import { AuthApi, RETURN_TARGET } from "@recensio/identity/contract";
import { UserId } from "@recensio/identity/types";
import { Client, type Proofs } from "@yielded/auth";
import { useRouteContext } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import { env } from "@/env";

/** Who is signed in, as the pages need it. */
export interface Session {
  readonly id: UserId;
  readonly email: string;
  /** `null` until the user has said what to call them. */
  readonly name: string | null;
}

/**
 * The auth client calls the contract's paths on this origin. On the server
 * there is no origin and no call is ever made: the atoms stay idle there.
 */
const AppClient = Client.make(AuthApi, {
  baseUrl: typeof window === "undefined" ? "http://localhost" : window.location.origin,
});

/**
 * The steps below run on a runtime of their own, not on the auth library's
 * atoms (`Atom.make` of `@yielded/auth`). That runtime belongs to the account
 * that is signed in and interrupts whatever runs on it when the account
 * changes, which is exactly what a successful sign-in does.
 */
const runtime = Atom.runtime(AppClient.layerFetch);

const id = () => crypto.randomUUID();

/** A code that was asked for and not entered yet. */
export interface Pending {
  readonly flowId: string;
  readonly email: string;
  readonly reference: typeof Proofs.ProofReference.Type;
}

/**
 * Sends a code to an address, or a new code for one still `Pending`. The
 * answer is the same whether or not the address may sign in, so it says
 * nothing about who has an account. A new code must be asked for in the
 * attempt of the code it replaces: while a code still works, the server
 * sends no other to a new attempt.
 */
export const requestCode = runtime
  .fn<string | Pending>()(
    Effect.fn("Auth.requestCode")(function* (target) {
      const client = yield* AppClient;
      const again = typeof target !== "string";
      const email = again ? target.email : target;
      const flowId = again ? target.flowId : id();
      if (!again) yield* client.auth.beginEmailSignIn({ flowId });
      const receipt = yield* client.auth.requestEmailCode({
        flowId,
        email,
        returnTarget: RETURN_TARGET,
        requestId: id(),
        locale: navigator.language,
      });
      return { flowId, email, reference: receipt.reference } satisfies Pending;
    }),
  )
  .pipe(Atom.keepAlive);

/** Enters the code. On success the browser holds a session. */
export const enterCode = runtime
  .fn<{ readonly pending: Pending; readonly code: string }>()(
    Effect.fn("Auth.enterCode")(function* ({ pending, code }) {
      const client = yield* AppClient;
      const { completion } = yield* client.auth.completeEmailSignIn({
        flowId: pending.flowId,
        email: pending.email,
        returnTarget: RETURN_TARGET,
        reference: pending.reference,
        secret: code,
      });
      if (completion._tag !== "Authenticated") return yield* Effect.fail("not signed in" as const);
    }),
  )
  .pipe(Atom.keepAlive);

/** Ends the session, here and on the server. */
export const signOut = runtime
  .fn<void>()(
    Effect.fn("Auth.signOut")(function* () {
      const client = yield* AppClient;
      yield* client.auth.signOut();
    }),
  )
  .pipe(Atom.keepAlive);

/**
 * Who the request at hand is signed in as, asked of the API with the
 * browser's own cookie. Runs on the server; a route calls it before it
 * renders, and the answer reaches the browser with the page.
 */
const current = createServerFn({ method: "GET" }).handler(async (): Promise<Session | null> => {
  const { origin } = new URL(getRequest().url);
  const cookie = getRequestHeader("cookie");
  // As the browser would ask: at this site's address, from this site, with
  // the header that tells auth the call is not a cross-site form.
  const response = await env.API.fetch(
    new Request(new URL("/api/auth/getSession", origin), {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-effect-auth-csrf": "1",
        ...(cookie === undefined ? {} : { cookie }),
      },
      body: "{}",
    }),
  );
  if (!response.ok) return null;
  const body = (await response.json()) as {
    readonly value?: {
      readonly subjectId: string;
      readonly claims: { readonly email: string; readonly name: string | null };
    } | null;
  };
  const session = body.value;
  return session ? { id: UserId.make(session.subjectId), ...session.claims } : null;
});

let known: Promise<Session | null> | undefined;

/**
 * `current`, asked once per page load in the browser: moving between pages
 * does not ask again. A session that ends meanwhile shows on the next call,
 * which fails with `Unauthenticated`.
 */
export const session = (): Promise<Session | null> =>
  typeof window === "undefined" ? current() : (known ??= current());

/** Call after anything that changes who is signed in. */
export const forget = (): void => {
  known = undefined;
};

/**
 * The signed-in user, on any page under the `_app` layout. The router loaded
 * it before the page rendered and stays its source of truth.
 */
export const useSession = (): Session =>
  useRouteContext({ from: "/_app", select: (c) => c.session });

export * as Auth from "./auth";

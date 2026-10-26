import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { Auth } from "@/auth";

/**
 * Every page of the app, behind a session. The session is asked for before
 * anything renders: on the first load that happens on the server, so a
 * visitor who is not signed in gets a redirect and never the app.
 */
export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = await Auth.session();
    if (session === null) throw redirect({ to: "/sign-in" });
    return { session };
  },
  component: Outlet,
});

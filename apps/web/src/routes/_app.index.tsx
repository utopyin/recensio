import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks";
import { Button } from "@recensio/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useState } from "react";

import { Auth } from "@/auth";
import { Api } from "@/rpc";
import { ThemeToggle } from "@/theme";

/** Whether the API reaches the database, asked once per page load. */
const health = Api.query("system.health", undefined);

export const Route = createFileRoute("/_app/")({
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recensio</h1>
        <ThemeToggle />
      </div>
      <Status />
      <Account />
    </main>
  );
}

function Status() {
  const result = useAtomValue(health);
  return (
    <p className="text-muted-foreground text-sm">
      {AsyncResult.match(result, {
        onInitial: () => "Asking the API…",
        onFailure: () => "The API did not answer.",
        onSuccess: ({ value }) => `API and database up — database time ${value.database}`,
      })}
    </p>
  );
}

function Account() {
  const { email } = Auth.useSession();
  const signOut = useAtomSet(Auth.signOut, { mode: "promise" });
  const [busy, setBusy] = useState(false);

  const leave = () => {
    setBusy(true);
    // Whether or not the server answered, this browser is done with the session.
    void signOut().finally(() => {
      Auth.forget();
      window.location.assign("/sign-in");
    });
  };

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>
        Signed in as <span className="font-medium">{email}</span>
      </span>
      <Button variant="outline" size="sm" disabled={busy} onClick={leave}>
        {busy ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}

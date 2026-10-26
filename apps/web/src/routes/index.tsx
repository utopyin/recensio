import { useAtomValue } from "@effect/atom-react/Hooks";
import { createFileRoute } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { Api } from "@/rpc";
import { ThemeToggle } from "@/theme";

/** Whether the API reaches the database, asked once per page load. */
const health = Api.query("system.health", undefined);

export const Route = createFileRoute("/")({
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

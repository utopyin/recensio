import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { env } from "@/env";
import { ThemeToggle } from "@/theme";

interface Health {
  readonly ok: boolean;
  readonly database: string | null;
}

/** Asks the API, over the service binding, whether it reaches the database. */
const health = createServerFn({ method: "GET" }).handler(async (): Promise<Health> => {
  const response = await env.API.fetch("https://api/api/health");
  if (!response.ok) return { ok: false, database: null };
  return (await response.json()) as Health;
});

export const Route = createFileRoute("/")({
  loader: () => health(),
  component: Home,
});

function Home() {
  const { ok, database } = Route.useLoaderData();
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recensio</h1>
        <ThemeToggle />
      </div>
      <p className="text-muted-foreground text-sm">
        {ok ? `API and database up — database time ${database}` : "The API did not answer."}
      </p>
    </main>
  );
}

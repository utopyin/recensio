import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/env";

/**
 * Everything under `/api` goes to the API worker over the service binding,
 * unchanged: same method, path, query, body and headers, less the trace
 * context. The browser only ever talks to this origin, which is what lets the
 * session cookie be same-site and auth trust a single `Origin`.
 */
const forward = ({ request }: { readonly request: Request }) => {
  const headers = new Headers(request.headers);
  // The API limits code requests per client and cannot see the client itself.
  // Cloudflare sets this header on every request it hands us, over anything the
  // browser sent; only a local dev server has none.
  headers.set("cf-connecting-ip", request.headers.get("cf-connecting-ip") ?? "127.0.0.1");

  // A trace starts at the API. The browser's clients name a parent span that is
  // exported nowhere, and the API would hang its own under it.
  for (const name of ["traceparent", "tracestate", "b3"]) headers.delete(name);

  return env.API.fetch(new Request(request, { headers, redirect: "manual" }));
};

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: forward,
      POST: forward,
      PUT: forward,
      PATCH: forward,
      DELETE: forward,
    },
  },
});

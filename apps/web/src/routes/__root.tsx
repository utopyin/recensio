import { RegistryProvider } from "@effect/atom-react/RegistryContext";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { themeScript } from "@/theme";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Recensio" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    scripts: [{ children: themeScript }],
  }),
  shellComponent: RootDocument,
  component: Root,
});

function Root() {
  return (
    // One registry per rendered app: on the server that is one per request.
    <RegistryProvider>
      <Outlet />
    </RegistryProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

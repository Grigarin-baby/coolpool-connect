import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "antd/dist/reset.css";
import "../antd-reset-overrides.css";

import appCss from "../styles.css?url";

const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Cabin:ital,wght@0,400..700;1,400..700&family=Lexend:wght@100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Roboto+Slab:wght@100..900&display=swap";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-4">
      <div className="max-w-md text-center">
        <div className="text-8xl font-bold text-gradient-primary">404</div>
        <h2 className="mt-4 text-2xl font-semibold">Off the route</h2>
        <p className="mt-2 text-muted-foreground">
          This page doesn't exist on our map. Let's get you back on track.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-3xl bg-gradient-primary px-6 h-12 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-95 transition-base"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Coolpool — Smart intercity ride-sharing" },
      {
        name: "description",
        content:
          "Share rides between cities. Hosts post trips, travelers book the seats they need. Fair, dynamic, per-kilometer pricing.",
      },
      { name: "author", content: "Coolpool" },
      { property: "og:title", content: "Coolpool — Smart intercity ride-sharing" },
      {
        property: "og:description",
        content: "Share rides between cities with fair per-kilometer pricing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: GOOGLE_FONTS_CSS },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}


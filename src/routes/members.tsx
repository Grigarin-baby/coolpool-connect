import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { Loader2, MapPin, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { parseTravelerResumeRedirectParam } from "@/lib/travelerResumeRedirect";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";

export const Route = createFileRoute("/members")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: parseTravelerResumeRedirectParam(search.redirect),
    google_auth: search.google_auth === "failed" ? ("failed" as const) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Traveler member — Coolpool" },
      {
        name: "description",
        content: "Join as a Coolpool traveler to search routes and book seats.",
      },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const navigate = useNavigate();
  const { redirect, google_auth } = Route.useSearch();
  const { user, loading, roles, signIn, signUp, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [name, setName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      if (roles.length === 0) return;
      if (redirect) {
        void navigate({ href: redirect });
        return;
      }
      void navigate({ to: "/" });
    }
  }, [user, loading, roles, navigate, redirect]);

  useEffect(() => {
    if (google_auth !== "failed") return;
    toast.error("Google sign-in was cancelled or failed.");
    void navigate({
      to: "/members",
      search: { redirect: redirect ?? undefined, google_auth: undefined },
      replace: true,
    });
  }, [google_auth, navigate, redirect]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(signInEmail, signInPassword);
      toast.success("Signed in — let's find your ride.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signUp(name, signUpEmail, signUpPassword);
      toast.success("Welcome — you're ready to book.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create account.");
    } finally {
      setBusy(false);
    }
  };

  const bookingHint = redirect?.startsWith("/booking/");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <div className="relative border-b border-border/60 bg-linear-to-br from-teal-500/7 via-background to-background dark:from-teal-400/6">
          <div className="container mx-auto px-4 py-10 md:py-14 max-w-6xl grid lg:grid-cols-[minmax(0,1fr)_420px] gap-10 lg:gap-14 items-start">
            <div className="space-y-8 order-2 lg:order-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-400">
                  Travelers only
                </p>
                <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
                  Your seat on shared rides
                </h1>
                <p className="mt-4 text-muted-foreground text-lg leading-relaxed max-w-md">
                  This page is only for people booking seats — not for hosting or driving. Search a
                  route, pick seats, and manage trips under My trips.
                </p>
              </div>

              <ul className="space-y-4 max-w-md">
                <li className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl bg-teal-500/15 text-teal-800 dark:text-teal-300">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-medium">Find intercity routes</p>
                    <p className="text-sm text-muted-foreground">
                      Match trips that fit your from / to cities.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl bg-teal-500/15 text-teal-800 dark:text-teal-300">
                    <Ticket className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-medium">Choose seats on the map</p>
                    <p className="text-sm text-muted-foreground">
                      See the vehicle layout and pick available spots.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl bg-teal-500/15 text-teal-800 dark:text-teal-300">
                    <Users className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-medium">One account for riding</p>
                    <p className="text-sm text-muted-foreground">
                      Same login across search, booking, and My trips.
                    </p>
                  </div>
                </li>
              </ul>

              <p className="text-sm text-muted-foreground pt-2">
                Driving or operating routes?{" "}
                <Link
                  to="/driver/login"
                  className="font-semibold text-teal-700 dark:text-teal-400 hover:underline"
                >
                  Driver portal
                </Link>{" "}
                or{" "}
                <Link
                  to="/auth"
                  search={{ redirect: undefined }}
                  className="font-semibold text-teal-700 dark:text-teal-400 hover:underline"
                >
                  Host & admin login
                </Link>
                .
              </p>
            </div>

            <div className="order-1 lg:order-2 w-full">
              <div className="rounded-2xl border border-teal-500/25 bg-card shadow-xl shadow-teal-950/5 dark:shadow-black/40 p-6 sm:p-8">
                <h2 className="text-xl font-bold tracking-tight">
                  {bookingHint ? "Sign in to finish booking" : "Traveler account"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {bookingHint
                    ? "We'll take you back to your seats after you sign in or register."
                    : "Sign in or create a free traveler profile."}
                </p>

                <GoogleLoginButton busy={busy} redirect={redirect} className="mt-6" />

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-[11px] font-semibold uppercase tracking-wide">
                    <span className="bg-card px-2 text-muted-foreground">Or email</span>
                  </div>
                </div>

                <div className="mt-0 flex rounded-3xl border border-border bg-muted/40 p-1">
                  <button
                    type="button"
                    className={`flex-1 rounded-3xl py-2.5 text-sm font-semibold transition-colors ${
                      mode === "signin"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setMode("signin")}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-3xl py-2.5 text-sm font-semibold transition-colors ${
                      mode === "signup"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setMode("signup")}
                  >
                    New traveler
                  </button>
                </div>

                {mode === "signin" ? (
                  <form onSubmit={handleSignIn} className="mt-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mem-si-email">Email</Label>
                      <Input
                        id="mem-si-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        className="h-11 rounded-3xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mem-si-password">Password</Label>
                      <Input
                        id="mem-si-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        className="h-11 rounded-3xl"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full rounded-3xl bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue as traveler"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleSignUp} className="mt-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mem-su-name">Full name</Label>
                      <Input
                        id="mem-su-name"
                        required
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-11 rounded-3xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mem-su-email">Email</Label>
                      <Input
                        id="mem-su-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        className="h-11 rounded-3xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mem-su-password">Password</Label>
                      <Input
                        id="mem-su-password"
                        type="password"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        className="h-11 rounded-3xl"
                      />
                      <p className="text-xs text-muted-foreground">At least 6 characters.</p>
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full rounded-3xl bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Create traveler account"
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

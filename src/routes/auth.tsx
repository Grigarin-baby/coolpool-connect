import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Coolpool" },
      {
        name: "description",
        content: "Sign in or create your Coolpool account to book and host rides.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading, roles, signIn, signUp, isAdmin, isDriver } = useAuth();
  const [busy, setBusy] = useState(false);

  // Sign in
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign up
  const [name, setName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      // Wait until role resolution completes to avoid premature fallback to "/".
      if (roles.length === 0) return;
      if (isAdmin) navigate({ to: "/admin/dashboard" });
      else if (isDriver) navigate({ to: "/driver/dashboard" });
      else navigate({ to: "/" });
    }
  }, [user, loading, roles, isAdmin, isDriver, navigate]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(signInEmail, signInPassword);
      toast.success("Welcome back!");
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
      toast.success("Account created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <header className="container mx-auto px-4 py-6 max-w-7xl">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="h-9 w-9 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">Coolpool</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md p-8 rounded-3xl shadow-elevated border-border/60 bg-card/95 backdrop-blur-xl">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Welcome to Coolpool</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Sign in or create an account to get started.
            </p>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-full p-1 bg-secondary">
              <TabsTrigger value="signin" className="rounded-full">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full">
                Sign up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="si-email">Email</Label>
                  <Input
                    id="si-email"
                    type="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="si-password">Password</Label>
                  <Input
                    id="si-password"
                    type="password"
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Full name</Label>
                  <Input
                    id="su-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">Email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    required
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-password">Password</Label>
                  <Input
                    id="su-password"
                    type="password"
                    required
                    minLength={6}
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">Minimum 6 characters.</p>
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </main>
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
import { useState, type FormEvent, useEffect } from "react";
import { Sparkles, Loader2, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Login — Hosts & admins — Coolpool" },
      {
        name: "description",
        content: "Sign in to manage trips, onboarding, and dashboards.",
      },
    ],
  }),
  component: AuthPage,
});

function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-12 rounded-3xl border-border/80 bg-background/80 pr-10 form-control-lg placeholder:text-sm",
          "[&::-ms-reveal]:hidden [&::-ms-clear]:hidden",
        )}
      />
      <button
        type="button"
        className="absolute right-0 top-0 z-10 flex h-11 w-10 items-center justify-center rounded-3xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff className="h-4 w-4 shrink-0" aria-hidden /> : <Eye className="h-4 w-4 shrink-0" aria-hidden />}
      </button>
    </div>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading, roles, signIn, signUp, isAdmin, isDriver, becomeRideHost } = useAuth();
  const [busy, setBusy] = useState(false);
  const [showPhoneStep, setShowPhoneStep] = useState(false);
  const [phone, setPhone] = useState("");

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [name, setName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      if (isAdmin) void navigate({ to: "/admin/dashboard" });
      else if (isDriver) void navigate({ to: "/driver/dashboard" });
      else if (roles.includes("user") && roles.length === 1) {
        // If they are just a user/traveler but on the host auth page, 
        // we offer them to become a host by providing a phone number.
        setShowPhoneStep(true);
      }
      else if (roles.length > 0) void navigate({ to: "/" });
      else {
        // No roles at all - new signup
        setShowPhoneStep(true);
      }
    }
  }, [user, loading, roles, isAdmin, isDriver, navigate]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(signInEmail, signInPassword);
      toast.success("Logged in.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to log in.");
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
      setShowPhoneStep(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create account.");
    } finally {
      setBusy(false);
    }
  };

  const handleBecomeHost = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone) {
      toast.error("Phone number is required.");
      return;
    }
    setBusy(true);
    try {
      await becomeRideHost(phone);
      toast.success("Welcome! You are now a Ride Host.");
      void navigate({ to: "/driver/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete registration.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-hero flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-mesh opacity-75 pointer-events-none" />
      <div className="absolute top-1/4 right-0 h-72 w-72 rounded-3xl bg-primary-glow/25 blur-3xl pointer-events-none" />

      <header className="relative shrink-0 container mx-auto px-4 sm:px-5 py-4 max-w-7xl">
        <Link
          to="/"
          className="inline-flex items-center group rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        >
          <img src={logo} alt="Coolpool Logo" className="h-16 w-auto object-contain" />
        </Link>
      </header>

      <main className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-5 py-6 min-h-0">
        <Card className="w-full max-w-[380px] p-6 sm:p-7 rounded-3xl shadow-elevated border-border/70 bg-card/92 backdrop-blur-xl ring-1 ring-primary/10">
          {showPhoneStep ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-primary text-primary-foreground shadow-glow">
                  <Sparkles className="h-6 w-6" aria-hidden />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">One last step</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter your phone number to start hosting rides.
                </p>
              </div>

              <form onSubmit={handleBecomeHost} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-base font-medium">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    placeholder="+91 98765 43210"
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 rounded-3xl border-border/80 bg-background/80 form-control-lg placeholder:text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full rounded-3xl h-11 font-semibold shadow-glow mt-2"
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Start Hosting"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full rounded-3xl text-xs"
                  onClick={() => setShowPhoneStep(false)}
                  disabled={busy}
                >
                  Back to login
                </Button>
              </form>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center mb-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-primary text-primary-foreground shadow-glow">
                  <Shield className="h-6 w-6" aria-hidden />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary mb-1.5">
                  Hosts &amp; admins
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-balance">Login</h1>
              </div>

              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-3xl h-10 p-1 bg-muted/80 border border-border/60">
                  <TabsTrigger value="login" className="rounded-3xl data-[state=active]:shadow-soft text-sm font-semibold">
                    Login
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-3xl data-[state=active]:shadow-soft text-sm font-semibold">
                    Sign up
                  </TabsTrigger>
                </TabsList>
                
                <GoogleLoginButton busy={busy} className="mt-6 !rounded-3xl" successUrl="/auth" />

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-[10px] font-semibold uppercase tracking-wider">
                    <span className="bg-card px-2 text-muted-foreground">Or email password</span>
                  </div>
                </div>

                <TabsContent value="login" className="mt-0 outline-none">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="si-email" className="text-base font-medium">
                        Email
                      </Label>
                      <Input
                        id="si-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={signInEmail}
                        placeholder="you@company.com"
                        onChange={(e) => setSignInEmail(e.target.value)}
                        className="h-12 rounded-3xl border-border/80 bg-background/80 form-control-lg placeholder:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="si-password" className="text-base font-medium">
                        Password
                      </Label>
                      <PasswordField
                        id="si-password"
                        value={signInPassword}
                        onChange={setSignInPassword}
                        autoComplete="current-password"
                        required
                        placeholder="Enter your password"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="hero"
                      size="lg"
                      className="w-full rounded-3xl h-11 font-semibold shadow-glow mt-1"
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-6 outline-none">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="su-name" className="text-base font-medium">
                        Full name
                      </Label>
                      <Input
                        id="su-name"
                        autoComplete="name"
                        required
                        value={name}
                        placeholder="Jane Doe"
                        onChange={(e) => setName(e.target.value)}
                        className="h-12 rounded-3xl border-border/80 bg-background/80 form-control-lg placeholder:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="su-email" className="text-base font-medium">
                        Email
                      </Label>
                      <Input
                        id="su-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={signUpEmail}
                        placeholder="you@company.com"
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        className="h-12 rounded-3xl border-border/80 bg-background/80 form-control-lg placeholder:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="su-password" className="text-base font-medium">
                        Password
                      </Label>
                      <PasswordField
                        id="su-password"
                        value={signUpPassword}
                        onChange={setSignUpPassword}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        placeholder="Create a password (min. 6 characters)"
                      />
                      <p className="text-sm text-muted-foreground">At least 6 characters.</p>
                    </div>
                    <Button
                      type="submit"
                      variant="hero"
                      size="lg"
                      className="w-full rounded-3xl h-11 font-semibold shadow-glow mt-1"
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}

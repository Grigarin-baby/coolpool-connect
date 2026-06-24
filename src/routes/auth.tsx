import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
import { useState, type FormEvent, useEffect, useRef } from "react";
import { Sparkles, Loader2, Shield, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { PhoneOtpLogin } from "@/components/PhoneOtpLogin";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Login — Hosts & admins — Coolpool" },
      {
        name: "description",
        content: "Sign in to manage trips, onboarding, and dashboards.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: AuthPage,
});

/** 4-digit PIN entered as separate boxes (digits only). */
function PinField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <InputOTP
      id={id}
      maxLength={4}
      value={value}
      onChange={(v) => onChange(v.replace(/\D/g, ""))}
      inputMode="numeric"
      containerClassName="w-full"
    >
      <InputOTPGroup className="grid w-full grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className="h-14 w-full rounded-2xl border border-border/80 bg-background/80 text-2xl font-bold first:rounded-2xl last:rounded-2xl"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

function PhoneField({
  id,
  number,
  onNumberChange,
}: {
  id: string;
  number: string;
  onNumberChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base font-medium">
        Phone number
      </Label>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        required
        value={number}
        placeholder="9876543210"
        onChange={(e) => onNumberChange(e.target.value)}
        style={{ fontSize: "2rem", lineHeight: 1.1, letterSpacing: "0.725rem" }}
        className="h-16 w-full rounded-3xl border-border/80 bg-background/80 font-bold placeholder:text-muted-foreground/40"
      />
    </div>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const {
    user,
    loading,
    roles,
    signIn,
    signInWithPhonePassword,
    signUpWithPhonePassword,
    isAdmin,
    isDriver,
    becomeRideHost,
    requestPasswordRecovery,
  } = useAuth();
  const [busy, setBusy] = useState(false);
  const [showPhoneStep, setShowPhoneStep] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [phone, setPhone] = useState("");
  const [tab, setTab] = useState<"login" | "signup" | "admin">("login");
  const autoHostRef = useRef(false);

  const [siNumber, setSiNumber] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [name, setName] = useState("");
  const [suNumber, setSuNumber] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    if (isAdmin) {
      void navigate({ to: "/admin/dashboard" });
      return;
    }
    if (isDriver) {
      void navigate({ to: "/driver/dashboard" });
      return;
    }

    const onlyUser = (roles.includes("user") && roles.length === 1) || roles.length === 0;
    if (!onlyUser && roles.length > 0) {
      void navigate({ to: "/" });
      return;
    }

    // They need to be onboarded as a host. If we already captured a phone
    // during phone+password signup, reuse it instead of asking again.
    const storedPhone = (user.prefs as Record<string, unknown> | undefined)?.phone;
    if (typeof storedPhone === "string" && storedPhone.trim() && !autoHostRef.current) {
      autoHostRef.current = true;
      void (async () => {
        try {
          await becomeRideHost(storedPhone);
          toast.success("Welcome! You are now a Ride Host.");
          void navigate({ to: "/driver/dashboard" });
        } catch {
          // Fall back to manual entry if onboarding fails.
          autoHostRef.current = false;
          setPhone(storedPhone);
          setShowPhoneStep(true);
        }
      })();
      return;
    }

    // No phone on record (e.g. Google sign-in) — ask for it once.
    if (!autoHostRef.current) setShowPhoneStep(true);
  }, [user, loading, roles, isAdmin, isDriver, navigate, becomeRideHost]);

  const toE164 = (num: string) => `+91${num.replace(/[^\d]/g, "")}`;

  const handleSignIn = async (e?: FormEvent) => {
    e?.preventDefault();
    if (siNumber.replace(/[^\d]/g, "").length < 6) {
      toast.error("Enter a valid phone number.");
      return;
    }
    setBusy(true);
    try {
      await signInWithPhonePassword(toE164(siNumber), signInPassword);
      toast.success("Logged in.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to log in.");
    } finally {
      setBusy(false);
    }
  };

  // Auto-submit when the 4-digit PIN is fully entered (and phone is valid).
  useEffect(() => {
    if (
      tab !== "login" ||
      otpMode ||
      busy ||
      signInPassword.length !== 4 ||
      siNumber.replace(/[^\d]/g, "").length < 10
    ) {
      return;
    }
    void handleSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signInPassword]);

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    if (suNumber.replace(/[^\d]/g, "").length < 6) {
      toast.error("Enter a valid phone number.");
      return;
    }
    if (!/^\d{4}$/.test(signUpPassword)) {
      toast.error("Password must be exactly 4 digits.");
      return;
    }
    setBusy(true);
    try {
      await signUpWithPhonePassword(name, toE164(suNumber), signUpPassword);
      toast.success("Account created.");
      // Phone was already captured during signup and saved to prefs — the
      // useEffect picks it up and auto-onboards the host. No extra step.
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create account.");
    } finally {
      setBusy(false);
    }
  };

  const handleAdminSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword) {
      toast.error("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      await signIn(adminEmail.trim(), adminPassword);
      toast.success("Logged in.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to log in.");
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = adminEmail.trim();
    if (!email) {
      toast.error("Enter your email above, then tap “Forgot password?”.");
      return;
    }
    setBusy(true);
    try {
      await requestPasswordRecovery(email);
      toast.success("Password reset link sent — check your email inbox.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the reset email.");
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
    <div
      className="min-h-dvh bg-gradient-hero flex flex-col relative overflow-hidden"
      style={{ fontFamily: "'Open Sans', system-ui, sans-serif" }}
    >
      <div className="absolute inset-0 bg-gradient-mesh opacity-75 pointer-events-none" />
      <div className="absolute top-1/4 right-0 h-72 w-72 rounded-3xl bg-primary-glow/25 blur-3xl pointer-events-none" />

      <header className="relative shrink-0 container mx-auto px-4 sm:px-5 py-4 max-w-7xl flex items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center group rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        >
          <img src={logo} alt="Coolpool Logo" className="h-12 sm:h-16 w-auto object-contain" />
        </Link>
        <Link
          to="/"
          aria-label="Back to home"
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/70 backdrop-blur-md px-3 sm:px-4 py-2 text-sm font-semibold text-foreground shadow-sm hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Home</span>
        </Link>
      </header>

      <main className="relative flex-1 flex flex-col items-center justify-center px-3 sm:px-5 py-6 min-h-0">
        <Card className="w-full max-w-[460px] p-5 sm:p-7 rounded-3xl shadow-elevated border-border/70 bg-card/92 backdrop-blur-xl ring-1 ring-primary/10">
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
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-primary text-primary-foreground shadow-glow">
                  <Shield className="h-6 w-6" aria-hidden />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                  Hosts &amp; admins
                </p>
              </div>

              <Tabs
                value={tab}
                className="w-full"
                onValueChange={(v) => {
                  setTab(v as "login" | "signup" | "admin");
                  setOtpMode(false);
                }}
              >
                <TabsList className="relative grid w-full grid-cols-3 rounded-3xl h-11 p-1 bg-[#f4d8f9] border border-border/60 overflow-hidden">
                  <span
                    aria-hidden
                    className="absolute top-1 bottom-1 left-1 w-[calc(33.333%-0.25rem)] rounded-3xl bg-white shadow-soft transition-transform duration-300 ease-out"
                    style={{
                      transform:
                        tab === "admin"
                          ? "translateX(200%)"
                          : tab === "signup"
                            ? "translateX(100%)"
                            : "translateX(0)",
                    }}
                  />
                  <TabsTrigger
                    value="login"
                    className="relative z-10 rounded-3xl text-sm font-semibold bg-transparent text-muted-foreground transition-colors duration-300 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground"
                  >
                    Login
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="relative z-10 rounded-3xl text-sm font-semibold bg-transparent text-muted-foreground transition-colors duration-300 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground"
                  >
                    Sign up
                  </TabsTrigger>
                  <TabsTrigger
                    value="admin"
                    className="relative z-10 rounded-3xl text-sm font-semibold bg-transparent text-muted-foreground transition-colors duration-300 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground"
                  >
                    Admin
                  </TabsTrigger>
                </TabsList>

                <GoogleLoginButton busy={busy} className="mt-6 !rounded-3xl" successUrl="/auth" />

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-[10px] font-semibold uppercase tracking-wider">
                    <span className="bg-card px-2 text-muted-foreground">
                      OR
                    </span>
                  </div>
                </div>

                <TabsContent value="login" className="mt-0 outline-none">
                  {otpMode ? (
                    <div className="animate-in fade-in duration-300">
                      <PhoneOtpLogin
                        idPrefix="auth"
                        submitClassName="bg-gradient-primary text-primary-foreground shadow-glow"
                      />
                      <button
                        type="button"
                        className="mt-4 w-full text-center text-sm font-medium text-primary hover:underline"
                        onClick={() => setOtpMode(false)}
                      >
                        Log in with password
                      </button>
                    </div>
                  ) : (
                    <>
                      <form onSubmit={handleSignIn} className="space-y-2">
                        <PhoneField
                          id="si-phone"
                          number={siNumber}
                          onNumberChange={setSiNumber}
                        />
                        <div className="space-y-2">
                          <Label htmlFor="si-password" className="text-base font-medium">
                            Password
                          </Label>
                          <PinField
                            id="si-password"
                            value={signInPassword}
                            onChange={setSignInPassword}
                          />
                        </div>
                        <Button
                          type="submit"
                          variant="hero"
                          size="lg"
                          style={{ color: "#fff" }}
                          className="w-full rounded-3xl h-11 font-semibold shadow-glow mt-1"
                          disabled={busy}
                        >
                          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
                        </Button>
                      </form>
                      <button
                        type="button"
                        className="mt-5 w-full text-center text-sm font-medium text-primary hover:underline"
                        onClick={() => setOtpMode(true)}
                      >
                        Log in with OTP
                      </button>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="signup" className="mt-6 outline-none">
                  <form onSubmit={handleSignUp} className="space-y-2">
                    <div className="space-y-2">
                      <Label htmlFor="su-name" className="text-base font-medium">
                        Full name
                      </Label>
                      <Input
                        id="su-name"
                        autoComplete="name"
                        required
                        value={name}
                        placeholder="Kiran Kumar"
                        onChange={(e) => setName(e.target.value)}
                        style={{ fontSize: "2rem", lineHeight: 1.1 }}
                        className="h-16 w-full rounded-3xl border-border/80 bg-background/80 font-bold placeholder:text-muted-foreground/40"
                      />
                    </div>
                    <PhoneField
                      id="su-phone"
                      number={suNumber}
                      onNumberChange={setSuNumber}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="su-password" className="text-base font-medium">
                        Password
                      </Label>
                      <PinField
                        id="su-password"
                        value={signUpPassword}
                        onChange={setSignUpPassword}
                      />

                    </div>
                    <Button
                      type="submit"
                      variant="hero"
                      size="lg"
                      style={{ color: "#fff" }}
                      className="w-full rounded-3xl h-11 font-semibold shadow-glow mt-1"
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="admin" className="mt-0 outline-none">
                  <form onSubmit={handleAdminSignIn} className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="admin-email" className="text-base font-medium">
                        Email
                      </Label>
                      <Input
                        id="admin-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={adminEmail}
                        placeholder="admin@coolpool.in"
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="h-12 rounded-3xl border-border/80 bg-background/80 form-control-lg placeholder:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-password" className="text-base font-medium">
                        Password
                      </Label>
                      <Input
                        id="admin-password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={adminPassword}
                        placeholder="••••••••"
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="h-12 rounded-3xl border-border/80 bg-background/80 form-control-lg placeholder:text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="ml-auto block text-xs font-semibold text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Button
                      type="submit"
                      variant="hero"
                      size="lg"
                      style={{ color: "#fff" }}
                      className="w-full rounded-3xl h-11 font-semibold shadow-glow mt-1"
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Admin Login"}
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

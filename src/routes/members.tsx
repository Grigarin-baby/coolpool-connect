import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { Loader2, MapPin, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { parseTravelerResumeRedirectParam } from "@/lib/travelerResumeRedirect";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { OtpDigitsField } from "@/components/OtpDigitsField";
import { useResendCooldown } from "@/hooks/useResendCooldown";

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
  component: MembersPage,
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
      <Label htmlFor={id} className="text-base">
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

function MembersPage() {
  const navigate = useNavigate();
  const { redirect, google_auth } = Route.useSearch();
  const {
    user,
    loading,
    roles,
    signInWithPhonePassword,
    signUpWithPhonePassword,
    requestPasswordRecovery,
    sendSignupOtp,
    verifySignupOtp,
  } = useAuth();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [siNumber, setSiNumber] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [name, setName] = useState("");
  const [suNumber, setSuNumber] = useState("");
  const [suGender, setSuGender] = useState<"male" | "female" | "">("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suOtpStep, setSuOtpStep] = useState<"form" | "otp">("form");
  const [suOtpCode, setSuOtpCode] = useState("");
  const signupOtpCooldown = useResendCooldown();
  const [recoverEmail, setRecoverEmail] = useState("");
  const [showRecover, setShowRecover] = useState(false);

  const handleForgotPassword = async () => {
    const email = recoverEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter the email you signed up with.");
      return;
    }
    setBusy(true);
    try {
      await requestPasswordRecovery(email);
      toast.success("Password reset link sent — check your email inbox.");
      setShowRecover(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't find an account with that email.");
    } finally {
      setBusy(false);
    }
  };

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
      toast.success("Signed in — let's find your ride.");
    } catch (error) {
      // Wrong PIN, or the account no longer exists (e.g. it was deleted).
      // Appwrite returns a 401 "Invalid credentials" in both cases — guide the
      // user to create a fresh account.
      const msg = error instanceof Error ? error.message : "";
      if (/invalid credentials|user.*not.*found|missing|401/i.test(msg)) {
        toast.error("No account found for these details. Please sign up to create a new account.");
        setMode("signup");
        setSuNumber(siNumber);
      } else {
        toast.error(msg || "Unable to sign in.");
      }
    } finally {
      setBusy(false);
    }
  };

  // Auto-submit when the 4-digit PIN is fully entered (and phone is valid).
  useEffect(() => {
    if (
      mode !== "signin" ||
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
    if (!name.trim()) {
      toast.error("Enter your full name.");
      return;
    }
    if (suNumber.replace(/[^\d]/g, "").length < 6) {
      toast.error("Enter a valid phone number.");
      return;
    }
    if (!suGender) {
      toast.error("Select your gender.");
      return;
    }
    if (!/^\d{4}$/.test(signUpPassword)) {
      toast.error("Password must be exactly 4 digits.");
      return;
    }
    setBusy(true);
    try {
      // Prove phone ownership with an SMS OTP before creating the account.
      await sendSignupOtp(toE164(suNumber));
      setSuOtpStep("otp");
      signupOtpCooldown.start();
      toast.success(`OTP sent to ${toE164(suNumber)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the OTP.");
    } finally {
      setBusy(false);
    }
  };

  const handleResendSignUpOtp = async () => {
    setBusy(true);
    try {
      await sendSignupOtp(toE164(suNumber));
      signupOtpCooldown.start();
      toast.success("OTP resent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resend the OTP.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifySignUpOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    if (suOtpCode.length !== 4 || busy) return;
    setBusy(true);
    try {
      await verifySignupOtp(toE164(suNumber), suOtpCode);
      await signUpWithPhonePassword(
        name,
        toE164(suNumber),
        signUpPassword,
        suEmail.trim() || undefined,
        suGender || undefined,
      );
      toast.success("Welcome — you're ready to book.");
      setSuOtpStep("form");
      setSuOtpCode("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid OTP.");
      setSuOtpCode("");
    } finally {
      setBusy(false);
    }
  };

  // Auto-verify the instant the 4th digit is typed — no extra tap needed.
  useEffect(() => {
    if (suOtpStep !== "otp" || suOtpCode.length !== 4 || busy) return;
    void handleVerifySignUpOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suOtpCode, suOtpStep]);

  const bookingHint = redirect?.startsWith("/booking/");

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      style={{ fontFamily: "'Open Sans', system-ui, sans-serif" }}
    >
      <SiteHeader />

      <main className="flex-1 pt-20 md:pt-10">
        <div className="relative border-b border-border/60 bg-linear-to-br from-teal-500/7 via-background to-background dark:from-teal-400/6">
          <div className="container mx-auto px-3 sm:px-4 py-10 md:py-14 max-w-6xl grid lg:grid-cols-[minmax(0,1fr)_480px] gap-10 lg:gap-14 items-start">
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
              <div className="rounded-2xl border border-teal-500/25 bg-card shadow-xl shadow-teal-950/5 dark:shadow-black/40 p-4 sm:p-8">
                <p className="text-sm text-muted-foreground">
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
                    <span className="bg-card px-2 text-muted-foreground">OR</span>
                  </div>
                </div>

                <div className="relative mt-0 grid grid-cols-2 rounded-3xl border border-border bg-[#f4d8f9] p-1 overflow-hidden">
                  <span
                    aria-hidden
                    className="absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-3xl bg-white shadow-sm transition-transform duration-300 ease-out"
                    style={{
                      transform: mode === "signup" ? "translateX(100%)" : "translateX(0)",
                    }}
                  />
                  <button
                    type="button"
                    className={`relative z-10 rounded-3xl py-2.5 text-sm font-semibold transition-colors duration-300 ${
                      mode === "signin"
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => {
                      setMode("signin");
                      setShowRecover(false);
                      setSuOtpStep("form");
                      setSuOtpCode("");
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={`relative z-10 rounded-3xl py-2.5 text-sm font-semibold transition-colors duration-300 ${
                      mode === "signup"
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => {
                      setMode("signup");
                      setShowRecover(false);
                    }}
                  >
                    New traveler
                  </button>
                </div>

                {mode === "signin" ? (
                  <>
                    <form onSubmit={handleSignIn} className="mt-6 space-y-2">
                      <PhoneField
                        id="mem-si-phone"
                        number={siNumber}
                        onNumberChange={setSiNumber}
                      />
                      <div className="space-y-2">
                        <Label htmlFor="mem-si-password" className="text-base">
                          Password
                        </Label>
                        <PinField
                          id="mem-si-password"
                          value={signInPassword}
                          onChange={setSignInPassword}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRecover((v) => !v)}
                          className="ml-auto block text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
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
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Continue as traveler"
                        )}
                      </Button>
                    </form>
                    {showRecover && (
                      <div className="mt-4 space-y-2 rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
                        <p className="text-sm font-semibold text-gray-800">Reset your password</p>
                        <p className="text-xs text-gray-500">
                          Enter the email you added at signup — we&apos;ll send a reset link.
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="email"
                            value={recoverEmail}
                            onChange={(e) => setRecoverEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="h-11 rounded-xl"
                          />
                          <Button
                            type="button"
                            onClick={handleForgotPassword}
                            disabled={busy}
                            className="h-11 shrink-0 rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                          >
                            Send
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : suOtpStep === "otp" ? (
                  <div className="mt-6 space-y-4">
                    <div className="space-y-2 text-center">
                      <Label className="text-base">Enter the 4-digit code</Label>
                      <p className="text-sm text-muted-foreground">
                        Sent to <span className="font-semibold">{toE164(suNumber)}</span>
                      </p>
                      <div className="flex justify-center pt-1">
                        <OtpDigitsField
                          id="mem-su-otp"
                          value={suOtpCode}
                          onChange={setSuOtpCode}
                          autoFocus
                          disabled={busy}
                        />
                      </div>
                    </div>
                    {busy && (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                      </div>
                    )}
                    <button
                      type="button"
                      className="w-full text-center text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                      disabled={busy || !signupOtpCooldown.canResend}
                      onClick={handleResendSignUpOtp}
                    >
                      {signupOtpCooldown.canResend
                        ? "Resend OTP"
                        : `Resend OTP in ${signupOtpCooldown.remaining}s`}
                    </button>
                    <button
                      type="button"
                      className="w-full text-center text-xs font-medium text-muted-foreground hover:underline"
                      disabled={busy}
                      onClick={() => {
                        setSuOtpStep("form");
                        setSuOtpCode("");
                      }}
                    >
                      Change number
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSignUp} className="mt-6 space-y-2">
                    <div className="space-y-2">
                      <Label htmlFor="mem-su-name" className="text-base">
                        Full name
                      </Label>
                      <Input
                        id="mem-su-name"
                        required
                        autoComplete="name"
                        value={name}
                        placeholder="Kiran Kumar"
                        onChange={(e) => setName(e.target.value)}
                        style={{ fontSize: "2rem", lineHeight: 1.1 }}
                        className="h-16 w-full rounded-3xl border-border/80 bg-background/80 font-bold placeholder:text-muted-foreground/40"
                      />
                    </div>
                    <PhoneField id="mem-su-phone" number={suNumber} onNumberChange={setSuNumber} />
                    <div className="space-y-2">
                      <Label className="text-base">Gender</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["male", "female"] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setSuGender((prev) => (prev === g ? "" : g))}
                            className={`h-11 rounded-2xl border text-sm font-semibold capitalize transition ${
                              suGender === g
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/80 bg-background/80 text-muted-foreground"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mem-su-password" className="text-base">
                        Password
                      </Label>
                      <PinField
                        id="mem-su-password"
                        value={signUpPassword}
                        onChange={setSignUpPassword}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mem-su-email" className="text-base">
                        Email{" "}
                        <span className="text-sm font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="mem-su-email"
                        type="email"
                        autoComplete="email"
                        value={suEmail}
                        placeholder="you@example.com"
                        onChange={(e) => setSuEmail(e.target.value)}
                        className="h-12 rounded-3xl border-border/80 bg-background/80"
                      />
                      <p className="text-xs text-muted-foreground">
                        Optional, but your password can only be reset through this email.
                      </p>
                    </div>
                    <Button
                      type="submit"
                      variant="hero"
                      size="lg"
                      style={{ color: "#fff" }}
                      className="w-full rounded-3xl h-11 font-semibold shadow-glow mt-1"
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
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

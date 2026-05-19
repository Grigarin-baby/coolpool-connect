import { useState, type FormEvent } from "react";
import { Loader2, Phone, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isFirebaseConfigured } from "@/integrations/firebase/client";
import { cn } from "@/lib/utils";

export const COUNTRY_CODES = [
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+65", label: "🇸🇬 +65" },
];

interface PhoneOtpLoginProps {
  /** Called after a successful Appwrite session is established. */
  onSuccess?: () => void;
  /** Tailwind classes for the primary submit button (page accent color). */
  submitClassName?: string;
  /** Unique prefix so reCAPTCHA + field ids don't collide across pages. */
  idPrefix: string;
}

export function PhoneOtpLogin({ onSuccess, submitClassName, idPrefix }: PhoneOtpLoginProps) {
  const { sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [dialCode, setDialCode] = useState("+91");
  const [localNumber, setLocalNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  const recaptchaId = `${idPrefix}-recaptcha`;
  const configured = isFirebaseConfigured();
  const e164 = `${dialCode}${localNumber.replace(/[^\d]/g, "")}`;

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    const digits = localNumber.replace(/[^\d]/g, "");
    if (digits.length < 6) {
      toast.error("Enter a valid phone number.");
      return;
    }
    setBusy(true);
    try {
      await sendPhoneOtp(e164, recaptchaId);
      setStep("otp");
      toast.success(`OTP sent to ${e164}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send OTP.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    try {
      await verifyPhoneOtp(otp);
      toast.success("Logged in.");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid OTP.");
      setOtp("");
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <div className="rounded-3xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800">
        Phone login isn't configured yet. Add the <code>VITE_FIREBASE_*</code> keys from{" "}
        <code>FIREBASE_OTP_SETUP.md</code> to enable it.
      </div>
    );
  }

  return (
    <div>
      {step === "phone" ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-phone`} className="text-base font-medium">
              Phone number
            </Label>
            <div className="flex gap-2">
              <select
                aria-label="Country code"
                value={dialCode}
                onChange={(e) => setDialCode(e.target.value)}
                className="h-12 rounded-3xl border border-border/80 bg-background/80 px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Input
                id={`${idPrefix}-phone`}
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                required
                value={localNumber}
                placeholder="98765 43210"
                onChange={(e) => setLocalNumber(e.target.value)}
                className="h-12 flex-1 rounded-3xl border-border/80 bg-background/80 form-control-lg placeholder:text-sm"
              />
            </div>
          </div>
          <Button
            type="submit"
            size="lg"
            className={cn("w-full rounded-3xl h-11 font-semibold", submitClassName)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Phone className="mr-2 h-4 w-4" /> Send OTP
              </>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2 text-center">
            <Label className="text-base font-medium">Enter the 6-digit code</Label>
            <p className="text-sm text-muted-foreground">
              Sent to <span className="font-semibold">{e164}</span>
            </p>
            <div className="flex justify-center pt-1">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <Button
            type="submit"
            size="lg"
            className={cn("w-full rounded-3xl h-11 font-semibold", submitClassName)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" /> Verify &amp; continue
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-3xl text-xs"
            disabled={busy}
            onClick={() => {
              setStep("phone");
              setOtp("");
            }}
          >
            <ArrowLeft className="mr-1 h-3 w-3" /> Change number
          </Button>
        </form>
      )}

      {/* Invisible reCAPTCHA mount — Firebase requires this in the DOM. */}
      <div id={recaptchaId} />
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { Loader2, Phone, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface PhoneOtpLoginProps {
  /** Called after a successful Appwrite session is established. */
  onSuccess?: () => void;
  /** Tailwind classes for the primary submit button (page accent color). */
  submitClassName?: string;
  /** Unique prefix so field ids don't collide across pages. */
  idPrefix: string;
}

export function PhoneOtpLogin({ onSuccess, submitClassName, idPrefix }: PhoneOtpLoginProps) {
  const { sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [localNumber, setLocalNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  const e164 = `+91${localNumber.replace(/[^\d]/g, "")}`;

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    const digits = localNumber.replace(/[^\d]/g, "");
    if (digits.length < 6) {
      toast.error("Enter a valid phone number.");
      return;
    }
    setBusy(true);
    try {
      await sendPhoneOtp(e164);
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
    if (otp.length !== 4) {
      toast.error("Enter the 4-digit code.");
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

  return (
    <div>
      {step === "phone" ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-phone`} className="text-base font-medium">
              Phone number
            </Label>
            <Input
              id={`${idPrefix}-phone`}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              value={localNumber}
              placeholder="9876543210"
              onChange={(e) => setLocalNumber(e.target.value)}
              style={{ fontSize: "2rem", lineHeight: 1.1, letterSpacing: "0.725rem" }}
              className="h-16 w-full rounded-3xl border-border/80 bg-background/80 font-bold placeholder:text-muted-foreground/40"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            style={{ color: "#fff" }}
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
            <Label className="text-base font-medium">Enter the 4-digit code</Label>
            <p className="text-sm text-muted-foreground">
              Sent to <span className="font-semibold">{e164}</span>
            </p>
            <div className="flex justify-center pt-1">
              <InputOTP
                maxLength={4}
                value={otp}
                onChange={setOtp}
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <Button
            type="submit"
            size="lg"
            style={{ color: "#fff" }}
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
    </div>
  );
}

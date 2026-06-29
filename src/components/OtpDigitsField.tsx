import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface OtpDigitsFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Number of digits. Defaults to 4 — Coolpool's standard OTP length. */
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * Big, password-PIN-sized digit boxes for OTP entry — same visual weight as
 * the 4-digit account PIN field, just for one-time codes.
 */
export function OtpDigitsField({
  id,
  value,
  onChange,
  length = 4,
  autoFocus,
  disabled,
}: OtpDigitsFieldProps) {
  return (
    <InputOTP
      id={id}
      maxLength={length}
      value={value}
      onChange={(v) => onChange(v.replace(/\D/g, ""))}
      inputMode="numeric"
      autoFocus={autoFocus}
      disabled={disabled}
      containerClassName="w-full justify-center"
    >
      <InputOTPGroup
        className="grid w-full gap-3"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
      >
        {Array.from({ length }, (_, i) => (
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

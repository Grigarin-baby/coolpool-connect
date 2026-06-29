import { useEffect, useRef, useState } from "react";

/** Countdown (in seconds) gating a "Resend OTP" button. Call start() right after sending. */
export function useResendCooldown(seconds = 30) {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (remaining <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [remaining]);

  return {
    remaining,
    canResend: remaining <= 0,
    start: () => setRemaining(seconds),
  };
}

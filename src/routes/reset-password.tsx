import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ResetSearch {
  userId?: string;
  secret?: string;
}

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    userId: typeof search.userId === "string" ? search.userId : undefined,
    secret: typeof search.secret === "string" ? search.secret : undefined,
  }),
  head: () => ({
    meta: [{ title: "Reset password - Coolpool" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { userId, secret } = Route.useSearch();
  const { completePasswordRecovery, deriveAccountSecret } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !userId || !secret;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 10) {
      toast.error("Enter your registered phone number.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      toast.error("New PIN must be exactly 4 digits.");
      return;
    }
    if (pin !== confirm) {
      toast.error("PINs don't match.");
      return;
    }
    setBusy(true);
    try {
      const phoneE164 = digits.length === 10 ? `+91${digits}` : `+${digits}`;
      const newSecret = await deriveAccountSecret(phoneE164, pin);
      await completePasswordRecovery(userId!, secret!, newSecret);
      setDone(true);
      toast.success("PIN updated. You can now sign in with your new PIN.");
      setTimeout(() => navigate({ to: "/members", search: {} as never }), 1500);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "This reset link is invalid or has expired.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#fffafd]">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
        <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-black text-gray-900">Reset your password</h1>
          {invalidLink ? (
            <p className="mt-3 text-sm text-gray-500">
              This reset link is missing or invalid. Please request a new one from the
              login screen.
            </p>
          ) : done ? (
            <p className="mt-3 text-sm text-emerald-600">
              Your password has been updated. Redirecting to sign in…
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-phone">Registered phone number</Label>
                <Input
                  id="reset-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pin">New 4-digit PIN</Label>
                <Input
                  id="new-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pin">Confirm new PIN</Label>
                <Input
                  id="confirm-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                />
              </div>
              <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl">
                {busy ? "Updating…" : "Update PIN"}
              </Button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

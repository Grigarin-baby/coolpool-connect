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
  const { completePasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !userId || !secret;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await completePasswordRecovery(userId!, secret!, password);
      setDone(true);
      toast.success("Password updated. You can now sign in.");
      setTimeout(() => navigate({ to: "/auth" }), 1500);
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
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>
              <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl">
                {busy ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

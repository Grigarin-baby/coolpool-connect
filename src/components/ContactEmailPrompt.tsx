import { useState } from "react";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DISMISS_KEY = "coolpool-contact-email-dismissed";

/**
 * Subtle, non-blocking nudge asking phone-login users to add a contact email
 * (stored in profile prefs — used for receipts/updates and future recovery).
 * Shows only for phone-synthetic accounts that haven't added a real email,
 * and can be dismissed without interrupting the flow.
 */
export function ContactEmailPrompt() {
  const { user, saveContactEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );

  const isPhoneUser = !!user?.email && user.email.endsWith("@phone.coolpool.in");
  const hasEmail = !!(user?.prefs as { email?: string } | undefined)?.email;

  if (!user || !isPhoneUser || hasEmail || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const save = async () => {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await saveContactEmail(value);
      toast.success("Email saved — thanks!");
      setDismissed(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save your email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">Add your email (optional)</p>
          <p className="mt-0.5 text-xs text-gray-500">
            So we can send you booking receipts and ride updates.
          </p>
          <div className="mt-3 flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-10 rounded-xl"
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
              }}
            />
            <Button onClick={save} disabled={busy} className="h-10 shrink-0 rounded-xl px-4">
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

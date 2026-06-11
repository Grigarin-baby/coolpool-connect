import { useState } from "react";
import { Bell, X } from "lucide-react";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";

export function NotificationPermissionPrompt() {
  const { permission, supported, request } = useNotificationPermission();
  const [dismissed, setDismissed] = useState(false);

  if (!supported || permission !== "default" || dismissed) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <Bell className="h-5 w-5 shrink-0 text-emerald-600" />
      <p className="flex-1 text-sm font-medium text-emerald-800">
        Turn on notifications to get alerts for trip updates and bookings.
      </p>
      <button
        type="button"
        onClick={() => void request()}
        className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
      >
        Enable
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-emerald-500 hover:text-emerald-700"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

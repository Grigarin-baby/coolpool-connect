import type { Trip } from "@/lib/domain";

export function getTripShareUrl(tripId: string): string {
  return `${window.location.origin}/ride/${tripId}`;
}

export async function shareTrip(trip: Pick<Trip, "id" | "fromLocation" | "toLocation">): Promise<"shared" | "copied" | "failed"> {
  return shareLink({
    title: "Coolpool ride",
    text: `Join my ride from ${trip.fromLocation} to ${trip.toLocation} on Coolpool!`,
    url: getTripShareUrl(trip.id),
  });
}

/** Share an arbitrary URL via the native sheet, with clipboard fallbacks. */
export async function shareLink(shareData: {
  title: string;
  text: string;
  url: string;
}): Promise<"shared" | "copied" | "failed"> {
  const url = shareData.url;

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch (err) {
      // User dismissed the share sheet — treat as success, not failure.
      if ((err as Error).name === "AbortError") return "shared";
      // Otherwise fall through to clipboard copy.
    }
  }

  // Modern Clipboard API (requires a secure context; may be blocked in iframes).
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
  } catch {
    // Fall through to the legacy copy path below.
  }

  // Legacy fallback: works without the Clipboard API permission.
  if (copyWithExecCommand(url)) {
    return "copied";
  }

  return "failed";
}

function copyWithExecCommand(text: string): boolean {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

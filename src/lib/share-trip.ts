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

  // Only use the native share sheet on touch/mobile devices. On desktop,
  // navigator.share exists in some browsers (e.g. Chrome on Windows) but
  // frequently rejects immediately with AbortError when there are no share
  // targets — which made "Share" silently do nothing. Desktop falls straight
  // through to the clipboard copy so the user always gets feedback.
  if (navigator.share && isLikelyMobile()) {
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

/** True on phones/tablets, where the native share sheet is the better UX. */
function isLikelyMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  // iPadOS reports a desktop UA but is touch-first.
  return navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua);
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

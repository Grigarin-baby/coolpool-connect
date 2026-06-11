// Browser ("Chrome-style") notification helpers — service worker registration,
// permission management, and showing notifications from within the app.

export function isNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isNotificationSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (err) {
    console.error("Service worker registration failed", err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";
  return Notification.requestPermission();
}

interface AppNotificationOptions extends NotificationOptions {
  url?: string;
}

export async function showAppNotification(
  title: string,
  options: AppNotificationOptions = {},
): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  const { url, data, ...rest } = options;
  const finalOptions: NotificationOptions = {
    icon: "/notification-icon.png",
    badge: "/notification-icon.png",
    ...rest,
    data: { url: url || "/", ...(data as Record<string, unknown> | undefined) },
  };

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.showNotification(title, finalOptions);
      return;
    }
  } catch (err) {
    console.error("Failed to show notification via service worker", err);
  }

  try {
    new Notification(title, finalOptions);
  } catch (err) {
    console.error("Failed to show notification", err);
  }
}

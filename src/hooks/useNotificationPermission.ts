import { useCallback, useEffect, useState } from "react";
import {
  getNotificationPermission,
  isNotificationSupported,
  registerServiceWorker,
  requestNotificationPermission,
} from "@/lib/notifications";

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );

  useEffect(() => {
    setPermission(getNotificationPermission());
    void registerServiceWorker();
  }, []);

  const request = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  return {
    permission,
    supported: isNotificationSupported(),
    request,
  };
}

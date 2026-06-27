// SERVER-ONLY. Site-wide lockout switch. Controlled purely by a server env
// var (SITE_LOCKED) — never baked into the client bundle, never toggleable
// from any in-app UI. The only way to flip it is editing the server's env
// file and restarting/redeploying the container.
import { createServerFn } from "@tanstack/react-start";

function readEnv(name: string): string {
  return (typeof process !== "undefined" ? (process.env?.[name] ?? "") : "").trim();
}

const DEFAULT_MESSAGE =
  "Access is temporarily paused. Please ask the platform owner to settle the pending balance to restore access.";

export const getSiteLockStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ locked: boolean; message: string }> => {
    const locked = readEnv("SITE_LOCKED").toLowerCase() === "true";
    const message = readEnv("SITE_LOCK_MESSAGE") || DEFAULT_MESSAGE;
    return { locked, message };
  },
);

// SERVER-ONLY. Mints human-readable trip codes (see lib/tripCode.ts). Trip
// creation itself stays client-side (the host's own Appwrite session writes
// the trip document) — this just reserves the next sequence number, the one
// part that needs the admin API key.
import { createServerFn } from "@tanstack/react-start";
import { Client, Databases } from "node-appwrite";
import { formatTripCode } from "@/lib/tripCode";
import { nextTripCodeSequence } from "@/integrations/appwrite/trip-code-counter.server";

function readEnv(name: string): string {
  return (typeof process !== "undefined" ? (process.env?.[name] ?? "") : "").trim();
}

function adminClient(): Client {
  const endpoint = readEnv("VITE_APPWRITE_ENDPOINT") || readEnv("APPWRITE_ENDPOINT");
  const project = readEnv("VITE_APPWRITE_PROJECT_ID") || readEnv("APPWRITE_PROJECT_ID");
  const key = readEnv("APPWRITE_API_KEY");
  if (!endpoint || !project || !key) {
    throw new Error("Appwrite admin credentials are not configured on the server.");
  }
  return new Client().setEndpoint(endpoint).setProject(project).setKey(key);
}

/** Mints the next globally-unique trip code (e.g. "2606-CPTR-0001") for a brand-new trip. */
export const mintTripCode = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ code: string }> => {
    const databases = new Databases(adminClient());
    const sequence = await nextTripCodeSequence(databases);
    const code = formatTripCode({ createdAt: new Date(), sequence });
    return { code };
  },
);

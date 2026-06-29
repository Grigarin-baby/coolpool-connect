// SERVER-ONLY. Shared counter for minting trip codes (see lib/tripCode.ts).
// Mirrors member-code-counter.server.ts — same get-then-write approach since
// this Appwrite version's atomic increment endpoint isn't available.
import { Databases } from "node-appwrite";

function readEnv(name: string): string {
  return (typeof process !== "undefined" ? (process.env?.[name] ?? "") : "").trim();
}

function countersEnv() {
  const db = readEnv("VITE_APPWRITE_DATABASE_ID") || readEnv("APPWRITE_DATABASE_ID");
  const countersCol = readEnv("VITE_APPWRITE_COLLECTION_COUNTERS") || "coolpool_counters";
  if (!db) throw new Error("Appwrite database is not configured on the server.");
  return { db, countersCol };
}

const TRIP_CODE_COUNTER_DOC_ID = "trip_code_seq";

/**
 * Reserves the next trip-code sequence number, creating the counter doc on
 * first use. A get+update has a tiny race window under concurrent trip
 * creation (two trips could land on the same sequence), but that's purely
 * cosmetic — trip codes don't need to be perfectly gap-free.
 */
export async function nextTripCodeSequence(databases: Databases): Promise<number> {
  const { db, countersCol } = countersEnv();
  let current = 0;
  try {
    const doc = await databases.getDocument(db, countersCol, TRIP_CODE_COUNTER_DOC_ID);
    current = Number((doc as unknown as { value: number }).value) || 0;
  } catch {
    // Doc doesn't exist yet — first call ever.
    try {
      await databases.createDocument(db, countersCol, TRIP_CODE_COUNTER_DOC_ID, { value: 1 });
      return 1;
    } catch {
      // Lost a creation race — re-read what the winner just wrote.
      const doc = await databases.getDocument(db, countersCol, TRIP_CODE_COUNTER_DOC_ID);
      current = Number((doc as unknown as { value: number }).value) || 0;
    }
  }

  const next = current + 1;
  await databases.updateDocument(db, countersCol, TRIP_CODE_COUNTER_DOC_ID, { value: next });
  return next;
}

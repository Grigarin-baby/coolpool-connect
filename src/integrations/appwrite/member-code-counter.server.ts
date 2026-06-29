// SERVER-ONLY. Shared counter for minting member codes (see lib/memberCode.ts).
// Used by account-server.ts (admin-created users) and the PowersText
// OTP-login bridge (a first-time login via OTP creates an account too, so
// it needs to mint a code the same way signup does).
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

const MEMBER_CODE_COUNTER_DOC_ID = "member_code_seq";

/**
 * Reserves the next member-code sequence number, creating the counter doc on
 * first use. Uses a plain read-then-write rather than Appwrite's
 * incrementDocumentAttribute — that endpoint isn't available on every
 * Appwrite server version (confirmed "Route not found" on our 1.7.4
 * instance) and broke every signup. A get+update has a tiny race window
 * under concurrent signups (two users could land on the same sequence), but
 * that's purely cosmetic — member codes don't need to be perfectly gap-free.
 */
export async function nextMemberCodeSequence(databases: Databases): Promise<number> {
  const { db, countersCol } = countersEnv();
  let current = 0;
  try {
    const doc = await databases.getDocument(db, countersCol, MEMBER_CODE_COUNTER_DOC_ID);
    current = Number((doc as unknown as { value: number }).value) || 0;
  } catch {
    // Doc doesn't exist yet — first call ever.
    try {
      await databases.createDocument(db, countersCol, MEMBER_CODE_COUNTER_DOC_ID, { value: 1 });
      return 1;
    } catch {
      // Lost a creation race — re-read what the winner just wrote.
      const doc = await databases.getDocument(db, countersCol, MEMBER_CODE_COUNTER_DOC_ID);
      current = Number((doc as unknown as { value: number }).value) || 0;
    }
  }

  const next = current + 1;
  await databases.updateDocument(db, countersCol, MEMBER_CODE_COUNTER_DOC_ID, { value: next });
  return next;
}

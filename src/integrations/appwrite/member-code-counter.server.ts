// SERVER-ONLY. Shared atomic counter for minting member codes (see
// lib/memberCode.ts). Used by account-server.ts (admin-created users) and
// the PowersText OTP-login bridge (a first-time login via OTP creates an
// account too, so it needs to mint a code the same way signup does).
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

/** Atomically reserves the next member-code sequence number, creating the counter doc on first use. */
export async function nextMemberCodeSequence(databases: Databases): Promise<number> {
  const { db, countersCol } = countersEnv();
  try {
    const doc = await databases.incrementDocumentAttribute(
      db,
      countersCol,
      MEMBER_CODE_COUNTER_DOC_ID,
      "value",
      1,
    );
    return Number((doc as unknown as { value: number }).value);
  } catch {
    // First call ever (or doc missing) — seed it. A rare double-create race
    // here just means two users land on sequence 1; harmless cosmetically.
    try {
      await databases.createDocument(db, countersCol, MEMBER_CODE_COUNTER_DOC_ID, { value: 1 });
      return 1;
    } catch {
      const doc = await databases.incrementDocumentAttribute(
        db,
        countersCol,
        MEMBER_CODE_COUNTER_DOC_ID,
        "value",
        1,
      );
      return Number((doc as unknown as { value: number }).value);
    }
  }
}

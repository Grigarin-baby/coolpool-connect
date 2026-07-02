// Syncs prefs.memberCode → coolpool_drivers.member_code for hosts whose
// driver doc is missing the code. This happens when users received their
// member code via the client-side backfillMemberCode (login-time, prefs-only)
// rather than via the original setup-member-codes.mjs script.
//
// Run with:  node --env-file=.env scripts/sync-member-codes-to-driver-docs.mjs
import { Client, Databases, Users, Query } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "";
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";
const driversCol = process.env.VITE_APPWRITE_COLLECTION_DRIVERS || "coolpool_drivers";

if (!endpoint || !projectId || !databaseId || !apiKey) {
  throw new Error(
    "Missing env: APPWRITE_API_KEY plus endpoint/project/database (APPWRITE_* or VITE_APPWRITE_*).",
  );
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const users = new Users(client);

async function listAllDriverDocsWithoutCode() {
  const all = [];
  let cursor;
  for (;;) {
    const queries = [Query.isNull("member_code"), Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await databases.listDocuments(databaseId, driversCol, queries);
    all.push(...page.documents);
    if (page.documents.length < 100) break;
    cursor = page.documents[page.documents.length - 1].$id;
  }
  return all;
}

async function main() {
  console.log(`Target: ${endpoint}  db=${databaseId}  collection=${driversCol}\n`);

  const docs = await listAllDriverDocsWithoutCode();
  console.log(`Found ${docs.length} driver doc(s) with no member_code.\n`);

  let synced = 0;
  let skipped = 0;

  for (const doc of docs) {
    const userId = doc.user_id;
    if (!userId) { skipped++; continue; }

    let prefs;
    try {
      const u = await users.get(userId);
      prefs = u.prefs ?? {};
    } catch {
      console.warn(`  ! Could not fetch user ${userId} — skipping`);
      skipped++;
      continue;
    }

    const code = typeof prefs.memberCode === "string" ? prefs.memberCode : null;
    if (!code) {
      console.log(`  - ${userId}: no prefs.memberCode yet — skipping`);
      skipped++;
      continue;
    }

    await databases.updateDocument(databaseId, driversCol, doc.$id, { member_code: code });
    console.log(`  ✓ ${userId}: set member_code = ${code}`);
    synced++;
  }

  console.log(`\nDone. Synced: ${synced}, skipped: ${skipped}.`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

// Adds gross_amount + platform_fee to coolpool_payout_requests, then backfills
// existing documents that predate commission tracking so every payout request
// has a stored (not reverse-engineered-on-read) commission figure.
//
// Run with:  node --env-file=.env scripts/add-payout-commission-fields.mjs
import { Client, Databases, Query } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "";
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";
const collectionId =
  process.env.VITE_APPWRITE_COLLECTION_PAYOUT_REQUESTS || "coolpool_payout_requests";

if (!endpoint || !projectId || !databaseId || !apiKey) {
  throw new Error(
    "Missing env: APPWRITE_API_KEY plus endpoint/project/database (APPWRITE_* or VITE_APPWRITE_*).",
  );
}

const PLATFORM_FEE_PERCENT = 5;

/** Reverse-estimate of the gross amount that funded a net payout (flat % fee). */
function estimateGrossFromNet(net) {
  return Math.round(Math.max(0, net) / (1 - PLATFORM_FEE_PERCENT / 100));
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function ensureFloatAttribute(key) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createFloatAttribute(databaseId, collectionId, key, false);
    console.log(`Created attribute: ${collectionId}.${key}`);
  }
}

async function waitForAttribute(key) {
  for (let i = 0; i < 20; i++) {
    try {
      const attr = await databases.getAttribute(databaseId, collectionId, key);
      if (attr.status === "available") return true;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function backfill() {
  let cursor;
  let updated = 0;
  let skipped = 0;
  for (;;) {
    const queries = [Query.limit(100), Query.isNull("gross_amount")];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await databases.listDocuments(databaseId, collectionId, queries);
    if (page.documents.length === 0) break;

    for (const doc of page.documents) {
      const amount = Number(doc.amount || 0);
      if (amount <= 0) {
        skipped++;
        continue;
      }
      const grossAmount = estimateGrossFromNet(amount);
      const platformFee = Math.max(0, grossAmount - amount);
      await databases.updateDocument(databaseId, collectionId, doc.$id, {
        gross_amount: grossAmount,
        platform_fee: platformFee,
      });
      updated++;
    }
    cursor = page.documents[page.documents.length - 1].$id;
    if (page.documents.length < 100) break;
  }
  console.log(`Backfilled ${updated} payout request(s), skipped ${skipped} with no amount.`);
}

async function main() {
  console.log(`Target: ${endpoint}  db=${databaseId}  collection=${collectionId}\n`);

  console.log("1) Attributes");
  await ensureFloatAttribute("gross_amount");
  await ensureFloatAttribute("platform_fee");

  console.log("\n2) Waiting for attributes to become available");
  const ready = await Promise.all([
    waitForAttribute("gross_amount"),
    waitForAttribute("platform_fee"),
  ]);
  if (!ready.every(Boolean)) {
    console.error("Attributes did not become available in time — re-run this script.");
    process.exit(1);
  }

  console.log("\n3) Backfilling legacy payout requests");
  await backfill();

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

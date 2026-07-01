// Adds trip_id, trip_route, trip_date to coolpool_payout_requests so that
// per-trip payout requests can be tracked individually.
//
// Run with:  node --env-file=.env scripts/add-payout-trip-fields.mjs
import { Client, Databases } from "node-appwrite";

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

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function ensureStringAttribute(key, size = 255) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createStringAttribute(databaseId, collectionId, key, size, false, null, false);
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

async function main() {
  console.log(`Target: ${endpoint}  db=${databaseId}  collection=${collectionId}\n`);

  console.log("1) Adding trip attributes");
  await ensureStringAttribute("trip_id", 36);
  await ensureStringAttribute("trip_route", 255);
  await ensureStringAttribute("trip_date", 64);

  console.log("\n2) Waiting for attributes to become available");
  const ready = await Promise.all([
    waitForAttribute("trip_id"),
    waitForAttribute("trip_route"),
    waitForAttribute("trip_date"),
  ]);
  if (!ready.every(Boolean)) {
    console.error("Attributes did not become available in time — re-run this script.");
    process.exit(1);
  }

  console.log("\nDone. Existing payout requests will have null trip_id (shown as history).");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

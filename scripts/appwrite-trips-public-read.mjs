/**
 * Grant read("any") on every document in coolpool_trips so guests can call listTrips from /search.
 * Keeps update/delete on the trip host (host_id).
 *
 * Usage (from repo root):
 *   node --env-file=.env scripts/appwrite-trips-public-read.mjs
 *
 * Requires: APPWRITE_API_KEY
 * Endpoint/project/database: APPWRITE_* or VITE_APPWRITE_* (same as Vite client).
 * Optional: APPWRITE_COLLECTION_TRIPS / VITE_APPWRITE_COLLECTION_TRIPS (default coolpool_trips)
 */
import { Client, Databases, Permission, Query, Role } from "node-appwrite";

const endpoint =
  process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "";
const projectId =
  process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId =
  process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";
const collectionId =
  process.env.APPWRITE_COLLECTION_TRIPS ||
  process.env.VITE_APPWRITE_COLLECTION_TRIPS ||
  "coolpool_trips";

if (!endpoint || !projectId || !databaseId || !apiKey) {
  throw new Error(
    "Missing env: set APPWRITE_API_KEY plus endpoint/project/database " +
      "(APPWRITE_* or VITE_APPWRITE_*).",
  );
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function listAllTripDocuments() {
  const out = [];
  let lastId = null;
  const pageSize = 100;

  for (;;) {
    const queries = [Query.orderAsc("$id"), Query.limit(pageSize)];
    if (lastId) queries.push(Query.cursorAfter(lastId));

    const batch = await databases.listDocuments({
      databaseId,
      collectionId,
      queries,
    });

    out.push(...batch.documents);
    if (batch.documents.length < pageSize) break;
    lastId = batch.documents[batch.documents.length - 1].$id;
  }

  return out;
}

async function run() {
  const docs = await listAllTripDocuments();
  console.log(`Found ${docs.length} document(s) in ${collectionId}`);

  let updated = 0;
  for (const doc of docs) {
    const hostId = String(doc.host_id);
    const permissions = [
      Permission.read(Role.any()),
      Permission.update(Role.user(hostId)),
      Permission.delete(Role.user(hostId)),
    ];

    await databases.updateDocument({
      databaseId,
      collectionId,
      documentId: doc.$id,
      permissions,
    });

    console.log(`Updated permissions: ${doc.$id} (host ${hostId})`);
    updated++;
  }

  console.log(`Done. Updated ${updated} document(s). Anonymous /search listTrips should see them now.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

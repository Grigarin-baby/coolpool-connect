// Sets up the human-readable trip-ID system (e.g. "2606-CPTR-0001"):
//   1. Ensures coolpool_counters (the global sequence) exists.
//   2. Adds the trip_code attribute to coolpool_trips if missing.
//   3. Backfills every existing trip that doesn't have a trip code yet, in
//      creation order, then leaves the counter pointing at the next free
//      sequence number.
//
// Run with:  node --env-file=.env scripts/setup-trip-codes.mjs
import { Client, Databases, Query } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "";
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";
const countersCol = process.env.VITE_APPWRITE_COLLECTION_COUNTERS || "coolpool_counters";
const tripsCol = process.env.VITE_APPWRITE_COLLECTION_TRIPS || process.env.APPWRITE_COLLECTION_TRIPS || "";
const COUNTER_DOC_ID = "trip_code_seq";

if (!endpoint || !projectId || !databaseId || !apiKey || !tripsCol) {
  throw new Error(
    "Missing env: APPWRITE_API_KEY plus endpoint/project/database/trips-collection (APPWRITE_* or VITE_APPWRITE_*).",
  );
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

function formatTripCode({ createdAt, sequence }) {
  const yy = String(createdAt.getUTCFullYear()).slice(-2);
  const mm = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  const seq = String(Math.max(0, sequence));
  const seqPadded = seq.length >= 4 ? seq : seq.padStart(4, "0");
  return `${yy}${mm}-CPTR-${seqPadded}`;
}

async function ensureCountersCollection() {
  try {
    await databases.getCollection(databaseId, countersCol);
    console.log(`Collection exists: ${countersCol}`);
  } catch {
    await databases.createCollection(databaseId, countersCol, "Coolpool Counters", [], true, true);
    await databases.createIntegerAttribute(databaseId, countersCol, "value", true);
    console.log(`Created collection + attribute: ${countersCol}.value`);
  }
}

async function ensureTripCodeAttribute() {
  try {
    await databases.getAttribute(databaseId, tripsCol, "trip_code");
    console.log(`Attribute exists: ${tripsCol}.trip_code`);
  } catch {
    await databases.createStringAttribute(databaseId, tripsCol, "trip_code", 24, false);
    console.log(`Created attribute: ${tripsCol}.trip_code`);
  }
}

async function waitForAttribute() {
  for (let i = 0; i < 20; i++) {
    try {
      const attr = await databases.getAttribute(databaseId, tripsCol, "trip_code");
      if (attr.status === "available") return true;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function listAllTrips() {
  const all = [];
  let cursor;
  for (;;) {
    const queries = [Query.limit(100), Query.orderAsc("$createdAt")];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await databases.listDocuments(databaseId, tripsCol, queries);
    all.push(...page.documents);
    if (page.documents.length < 100) break;
    cursor = page.documents[page.documents.length - 1].$id;
  }
  return all;
}

async function backfill() {
  const allTrips = await listAllTrips();
  console.log(`Found ${allTrips.length} total trips.`);

  let sequence = 0;
  let assigned = 0;
  for (const trip of allTrips) {
    if (trip.trip_code) continue;

    sequence += 1;
    const code = formatTripCode({ createdAt: new Date(trip.$createdAt), sequence });
    await databases.updateDocument(databaseId, tripsCol, trip.$id, { trip_code: code });
    assigned++;
  }

  console.log(`Assigned ${assigned} new trip code(s). Final sequence: ${sequence}.`);

  if (sequence > 0) {
    try {
      await databases.getDocument(databaseId, countersCol, COUNTER_DOC_ID);
      await databases.updateDocument(databaseId, countersCol, COUNTER_DOC_ID, { value: sequence });
    } catch {
      await databases.createDocument(databaseId, countersCol, COUNTER_DOC_ID, { value: sequence });
    }
    console.log(`Counter ${countersCol}/${COUNTER_DOC_ID} set to ${sequence}.`);
  }
}

async function main() {
  console.log(`Target: ${endpoint}  db=${databaseId}\n`);

  console.log("1) Counters collection");
  await ensureCountersCollection();

  console.log("\n2) trip_code attribute");
  await ensureTripCodeAttribute();

  console.log("\n3) Waiting for attribute to become available");
  await waitForAttribute();

  console.log("\n4) Backfilling existing trips");
  await backfill();

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

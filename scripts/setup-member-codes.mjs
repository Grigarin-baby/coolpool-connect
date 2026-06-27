// Sets up the human-readable member-ID system (e.g. "2606cpgm0001"):
//   1. Creates coolpool_counters (the global sequence) if missing.
//   2. Adds member_code/gender attributes to coolpool_drivers if missing.
//   3. Backfills every existing Appwrite user (and matching driver doc, if
//      any) that doesn't have a member code yet, in account-creation order,
//      then leaves the counter pointing at the next free sequence number.
//
// Run with:  node --env-file=.env scripts/setup-member-codes.mjs
import { Client, Databases, Users, Query } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "";
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";
const countersCol = process.env.VITE_APPWRITE_COLLECTION_COUNTERS || "coolpool_counters";
const driversCol = process.env.VITE_APPWRITE_COLLECTION_DRIVERS || "coolpool_drivers";
const COUNTER_DOC_ID = "member_code_seq";

if (!endpoint || !projectId || !databaseId || !apiKey) {
  throw new Error(
    "Missing env: APPWRITE_API_KEY plus endpoint/project/database (APPWRITE_* or VITE_APPWRITE_*).",
  );
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const users = new Users(client);

function normalizeGenderChar(gender) {
  const g = String(gender ?? "").trim().toLowerCase();
  if (g === "male" || g === "m") return "m";
  if (g === "female" || g === "f") return "f";
  return "x";
}

function formatMemberCode({ createdAt, role, gender, sequence }) {
  const yy = String(createdAt.getUTCFullYear()).slice(-2);
  const mm = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  const roleChar = role === "host" ? "h" : "g";
  const genderChar = normalizeGenderChar(gender);
  const seq = String(Math.max(0, sequence));
  const seqPadded = seq.length >= 4 ? seq : seq.padStart(4, "0");
  return `${yy}${mm}cp${roleChar}${genderChar}${seqPadded}`;
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

async function ensureDriverAttributes() {
  for (const [key, create] of [
    ["member_code", () => databases.createStringAttribute(databaseId, driversCol, "member_code", 24, false)],
    ["gender", () => databases.createStringAttribute(databaseId, driversCol, "gender", 16, false)],
  ]) {
    try {
      await databases.getAttribute(databaseId, driversCol, key);
      console.log(`Attribute exists: ${driversCol}.${key}`);
    } catch {
      await create();
      console.log(`Created attribute: ${driversCol}.${key}`);
    }
  }
}

async function waitForAttribute(collectionId, key) {
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

async function listAllUsers() {
  const all = [];
  let cursor;
  for (;;) {
    const queries = [Query.limit(100), Query.orderAsc("$createdAt")];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await users.list(queries);
    all.push(...page.users);
    if (page.users.length < 100) break;
    cursor = page.users[page.users.length - 1].$id;
  }
  return all;
}

async function findDriverDocByUserId(userId) {
  const res = await databases.listDocuments(databaseId, driversCol, [
    Query.equal("user_id", userId),
    Query.limit(1),
  ]);
  return res.documents[0] ?? null;
}

async function backfill() {
  const allUsers = await listAllUsers();
  console.log(`Found ${allUsers.length} total Appwrite users.`);

  let sequence = 0;
  let assigned = 0;
  for (const u of allUsers) {
    const prefs = u.prefs ?? {};
    if (typeof prefs.memberCode === "string" && prefs.memberCode) continue;

    sequence += 1;
    const roles = Array.isArray(prefs.roles) ? prefs.roles : [];
    const role = roles.includes("driver") ? "host" : "guest";
    const gender = typeof prefs.gender === "string" ? prefs.gender : undefined;
    const code = formatMemberCode({
      createdAt: new Date(u.$createdAt),
      role,
      gender,
      sequence,
    });

    await users.updatePrefs(u.$id, { ...prefs, memberCode: code });
    assigned++;

    if (role === "host") {
      try {
        const doc = await findDriverDocByUserId(u.$id);
        if (doc && !doc.member_code) {
          await databases.updateDocument(databaseId, driversCol, doc.$id, {
            member_code: code,
            gender: doc.gender || gender || null,
          });
        }
      } catch (err) {
        console.warn(`  ! Could not backfill driver doc for ${u.$id}:`, err?.message || err);
      }
    }
  }

  console.log(`Assigned ${assigned} new member code(s). Final sequence: ${sequence}.`);

  // Point the counter at the next free number so live signups continue from here.
  try {
    await databases.getDocument(databaseId, countersCol, COUNTER_DOC_ID);
    await databases.updateDocument(databaseId, countersCol, COUNTER_DOC_ID, { value: sequence });
  } catch {
    await databases.createDocument(databaseId, countersCol, COUNTER_DOC_ID, { value: sequence });
  }
  console.log(`Counter ${countersCol}/${COUNTER_DOC_ID} set to ${sequence}.`);
}

async function main() {
  console.log(`Target: ${endpoint}  db=${databaseId}\n`);

  console.log("1) Counters collection");
  await ensureCountersCollection();

  console.log("\n2) Driver attributes");
  await ensureDriverAttributes();

  console.log("\n3) Waiting for attributes to become available");
  await Promise.all([
    waitForAttribute(driversCol, "member_code"),
    waitForAttribute(driversCol, "gender"),
  ]);

  console.log("\n4) Backfilling existing users");
  await backfill();

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

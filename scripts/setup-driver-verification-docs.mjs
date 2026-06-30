// Adds the identity-verification attributes to the drivers collection:
//   id_doc_type   — "aadhar" | "license", which document the host uploaded
//   id_front_doc  — storage file ID, front side
//   id_back_doc   — storage file ID, back side
//   selfie_doc    — storage file ID, optional live selfie
//
// Run with:  node --env-file=.env scripts/setup-driver-verification-docs.mjs
import { Client, Databases } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "";
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";
const driversCol =
  process.env.VITE_APPWRITE_COLLECTION_DRIVERS || process.env.APPWRITE_COLLECTION_DRIVERS || "";

if (!endpoint || !projectId || !databaseId || !apiKey || !driversCol) {
  throw new Error(
    "Missing env: APPWRITE_API_KEY plus endpoint/project/database/drivers-collection (APPWRITE_* or VITE_APPWRITE_*).",
  );
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

const ATTRS = [
  { key: "id_doc_type", size: 16 },
  { key: "id_front_doc", size: 64 },
  { key: "id_back_doc", size: 64 },
  { key: "selfie_doc", size: 64 },
];

async function ensureAttribute(key, size) {
  try {
    await databases.getAttribute(databaseId, driversCol, key);
    console.log(`Attribute exists: ${driversCol}.${key}`);
  } catch {
    await databases.createStringAttribute(databaseId, driversCol, key, size, false);
    console.log(`Created attribute: ${driversCol}.${key}`);
  }
}

async function waitForAttribute(key) {
  for (let i = 0; i < 20; i++) {
    try {
      const attr = await databases.getAttribute(databaseId, driversCol, key);
      if (attr.status === "available") return true;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  console.log(`Target: ${endpoint}  db=${databaseId}  collection=${driversCol}\n`);
  for (const { key, size } of ATTRS) {
    await ensureAttribute(key, size);
    await waitForAttribute(key);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

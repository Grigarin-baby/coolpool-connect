import { Client, Databases } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "";
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";

if (!endpoint || !projectId || !databaseId || !apiKey) {
  throw new Error(
    "Missing env: APPWRITE_API_KEY plus endpoint/project/database (APPWRITE_* or VITE_APPWRITE_*).",
  );
}

const COLLECTIONS = {
  drivers: "coolpool_drivers",
  vehicles: "coolpool_vehicles",
};

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function ensureEnumAttribute(collectionId, key, elements, required = false, def = undefined) {
  try {
    const existing = await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
    if (existing.type !== "enum") {
      console.warn(
        `Attribute ${collectionId}.${key} exists as type "${existing.type}", not enum. ` +
          `Please replace it manually in Appwrite Console with enum values: ${elements.join(", ")}`,
      );
    }
  } catch {
    await databases.createEnumAttribute(databaseId, collectionId, key, elements, required, def);
    console.log(`Created enum attribute: ${collectionId}.${key} = [${elements.join(", ")}]`);
  }
}

async function ensureStringAttribute(collectionId, key, size, required = false, def = undefined) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createStringAttribute(databaseId, collectionId, key, size, required, def);
    console.log(`Created attribute: ${collectionId}.${key}`);
  }
}

async function ensureIndex(collectionId, key, type, attributes) {
  try {
    await databases.getIndex(databaseId, collectionId, key);
    console.log(`Index exists: ${collectionId}.${key}`);
  } catch {
    try {
      await databases.createIndex(databaseId, collectionId, key, type, attributes);
      console.log(`Created index: ${collectionId}.${key}`);
    } catch (error) {
      console.warn(
        `Skipped index (will retry later if needed): ${collectionId}.${key}`,
        error?.message || error,
      );
    }
  }
}

async function run() {
  // Drivers — verification workflow. Default "approved" so existing,
  // already-operating drivers aren't retroactively blocked.
  await ensureEnumAttribute(
    COLLECTIONS.drivers,
    "verification_status",
    ["pending", "approved", "rejected"],
    false,
    "approved",
  );
  await ensureStringAttribute(COLLECTIONS.drivers, "verification_note", 500, false);

  // Vehicles — verification workflow. Same default rationale.
  await ensureEnumAttribute(
    COLLECTIONS.vehicles,
    "verification_status",
    ["pending", "approved", "rejected"],
    false,
    "approved",
  );
  await ensureStringAttribute(COLLECTIONS.vehicles, "verification_note", 500, false);

  await ensureIndex(COLLECTIONS.drivers, "idx_drivers_verification_status", "key", [
    "verification_status",
  ]);
  await ensureIndex(COLLECTIONS.vehicles, "idx_vehicles_verification_status", "key", [
    "verification_status",
  ]);

  console.log("Admin migration complete.");
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

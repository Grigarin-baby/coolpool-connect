import { Client, Databases, Permission, Role } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "";
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";

if (!endpoint || !projectId || !databaseId || !apiKey) {
  throw new Error("Missing env vars. Need APPWRITE_API_KEY + endpoint/project/database.");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

const REVIEWS_COLLECTION_ID = "coolpool_reviews";
const DRIVERS_COLLECTION_ID = "coolpool_drivers";

async function ensureAttribute(collectionId, type, key, opts = {}) {
  try {
    if (type === "string") {
      await databases.createStringAttribute(databaseId, collectionId, key, opts.size ?? 255, opts.required ?? false, opts.default ?? null);
    } else if (type === "integer") {
      await databases.createIntegerAttribute(databaseId, collectionId, key, opts.required ?? false, opts.min, opts.max, opts.default ?? null);
    } else if (type === "float") {
      await databases.createFloatAttribute(databaseId, collectionId, key, opts.required ?? false, opts.min, opts.max, opts.default ?? null);
    } else if (type === "stringArray") {
      await databases.createStringAttribute(databaseId, collectionId, key, opts.size ?? 255, opts.required ?? false, null, true);
    } else if (type === "datetime") {
      await databases.createDatetimeAttribute(databaseId, collectionId, key, opts.required ?? false, null);
    }
    console.log(`  Created attribute: ${key} (${type})`);
  } catch (e) {
    if (e?.code === 409 || e?.type === "attribute_already_exists") {
      console.log(`  Attribute exists: ${key}`);
    } else {
      throw e;
    }
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // 1. Create coolpool_reviews collection
  try {
    await databases.createCollection(
      databaseId,
      REVIEWS_COLLECTION_ID,
      "Reviews",
      [
        Permission.read(Role.any()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
      ],
      false,
    );
    console.log("Created collection: coolpool_reviews");
  } catch (e) {
    if (e?.code === 409 || e?.type === "collection_already_exists") {
      console.log("Collection exists: coolpool_reviews");
    } else {
      throw e;
    }
  }

  await sleep(500);

  // 2. Add attributes to reviews collection
  console.log("Adding attributes to coolpool_reviews...");
  await ensureAttribute(REVIEWS_COLLECTION_ID, "string", "trip_id", { required: true });
  await sleep(300);
  await ensureAttribute(REVIEWS_COLLECTION_ID, "string", "booking_id", { required: true });
  await sleep(300);
  await ensureAttribute(REVIEWS_COLLECTION_ID, "string", "from_user_id", { required: true });
  await sleep(300);
  await ensureAttribute(REVIEWS_COLLECTION_ID, "string", "to_user_id", { required: true });
  await sleep(300);
  await ensureAttribute(REVIEWS_COLLECTION_ID, "string", "direction", { required: true, size: 20 });
  await sleep(300);
  await ensureAttribute(REVIEWS_COLLECTION_ID, "integer", "stars", { required: true, min: 1, max: 5 });
  await sleep(300);
  await ensureAttribute(REVIEWS_COLLECTION_ID, "stringArray", "tags", { required: false });
  await sleep(300);
  await ensureAttribute(REVIEWS_COLLECTION_ID, "datetime", "created_at", { required: true });
  await sleep(300);

  // 3. Create index on to_user_id for fast lookups
  try {
    await databases.createIndex(databaseId, REVIEWS_COLLECTION_ID, "idx_to_user_id", "key", ["to_user_id"]);
    console.log("Created index: idx_to_user_id");
  } catch (e) {
    if (e?.code === 409 || e?.type === "index_already_exists") {
      console.log("Index exists: idx_to_user_id");
    } else {
      console.warn("Index creation failed (non-fatal):", e?.message);
    }
  }

  await sleep(500);

  try {
    await databases.createIndex(databaseId, REVIEWS_COLLECTION_ID, "idx_booking_direction", "key", ["booking_id", "direction"]);
    console.log("Created index: idx_booking_direction");
  } catch (e) {
    if (e?.code === 409 || e?.type === "index_already_exists") {
      console.log("Index exists: idx_booking_direction");
    } else {
      console.warn("Index creation failed (non-fatal):", e?.message);
    }
  }

  // 4. Add rating_avg and rating_count to coolpool_drivers
  console.log("Adding rating fields to coolpool_drivers...");
  await sleep(300);
  await ensureAttribute(DRIVERS_COLLECTION_ID, "float", "rating_avg", { required: false, default: 0 });
  await sleep(300);
  await ensureAttribute(DRIVERS_COLLECTION_ID, "integer", "rating_count", { required: false, default: 0 });

  console.log("\nDone! Add this to your .env:");
  console.log("VITE_APPWRITE_COLLECTION_REVIEWS=coolpool_reviews");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

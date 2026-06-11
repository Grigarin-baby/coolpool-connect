import { Client, Databases, Permission, Role } from "node-appwrite";

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
  bankAccounts: "coolpool_bank_accounts",
  payoutRequests: "coolpool_payout_requests",
};

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function ensureCollection(collectionId, name) {
  try {
    await databases.getCollection(databaseId, collectionId);
    console.log(`Collection exists: ${collectionId}`);
  } catch {
    await databases.createCollection(databaseId, collectionId, name, [], true, true);
    console.log(`Created collection: ${collectionId}`);
  }
}

async function setCollectionPermissions(collectionId, name) {
  await databases.updateCollection(
    databaseId,
    collectionId,
    name,
    [
      Permission.read(Role.users()),
      Permission.create(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ],
    true, // documentSecurity
    true, // enabled
  );
  console.log(`Permissions set: ${collectionId}`);
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

async function ensureFloatAttribute(collectionId, key, required = false, def = undefined) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createFloatAttribute(
      databaseId,
      collectionId,
      key,
      required,
      undefined,
      undefined,
      def,
    );
    console.log(`Created attribute: ${collectionId}.${key}`);
  }
}

async function ensureDatetimeAttribute(collectionId, key, required = false, def = undefined) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createDatetimeAttribute(databaseId, collectionId, key, required, def);
    console.log(`Created attribute: ${collectionId}.${key}`);
  }
}

async function ensureEnumAttribute(collectionId, key, elements, required = false, def = undefined) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createEnumAttribute(databaseId, collectionId, key, elements, required, def);
    console.log(`Created enum attribute: ${collectionId}.${key} = [${elements.join(", ")}]`);
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
  await ensureCollection(COLLECTIONS.bankAccounts, "Bank Accounts");
  await ensureCollection(COLLECTIONS.payoutRequests, "Payout Requests");

  // Bank accounts — one per driver/host, holds payout destination details.
  // razorpay_* fields are reserved for the future RazorpayX integration.
  await ensureStringAttribute(COLLECTIONS.bankAccounts, "driver_user_id", 64, true);
  await ensureStringAttribute(COLLECTIONS.bankAccounts, "account_holder_name", 120, true);
  await ensureStringAttribute(COLLECTIONS.bankAccounts, "account_number", 32, true);
  await ensureStringAttribute(COLLECTIONS.bankAccounts, "ifsc_code", 16, true);
  await ensureStringAttribute(COLLECTIONS.bankAccounts, "upi_id", 80, false);
  await ensureStringAttribute(COLLECTIONS.bankAccounts, "razorpay_contact_id", 64, false);
  await ensureStringAttribute(COLLECTIONS.bankAccounts, "razorpay_fund_account_id", 64, false);

  await ensureIndex(COLLECTIONS.bankAccounts, "idx_bank_accounts_driver_user_id", "unique", [
    "driver_user_id",
  ]);

  // Payout requests — a request/ledger row per withdrawal. Status maps cleanly
  // onto a future RazorpayX payout: pending -> processing -> paid, or rejected.
  await ensureStringAttribute(COLLECTIONS.payoutRequests, "driver_user_id", 64, true);
  await ensureFloatAttribute(COLLECTIONS.payoutRequests, "amount", true);
  await ensureEnumAttribute(
    COLLECTIONS.payoutRequests,
    "status",
    ["pending", "processing", "paid", "rejected"],
    false,
    "pending",
  );
  await ensureDatetimeAttribute(COLLECTIONS.payoutRequests, "requested_at", true);
  await ensureDatetimeAttribute(COLLECTIONS.payoutRequests, "processed_at", false);
  await ensureStringAttribute(COLLECTIONS.payoutRequests, "payment_reference", 100, false);
  await ensureStringAttribute(COLLECTIONS.payoutRequests, "admin_note", 500, false);
  // Snapshot of the bank details at request time, so later edits to the
  // driver's saved account don't retroactively change historical requests.
  await ensureStringAttribute(COLLECTIONS.payoutRequests, "account_holder_name", 120, false);
  await ensureStringAttribute(COLLECTIONS.payoutRequests, "account_number", 32, false);
  await ensureStringAttribute(COLLECTIONS.payoutRequests, "ifsc_code", 16, false);
  await ensureStringAttribute(COLLECTIONS.payoutRequests, "upi_id", 80, false);

  await ensureIndex(COLLECTIONS.payoutRequests, "idx_payout_requests_driver_user_id", "key", [
    "driver_user_id",
  ]);
  await ensureIndex(COLLECTIONS.payoutRequests, "idx_payout_requests_status", "key", ["status"]);

  await setCollectionPermissions(COLLECTIONS.bankAccounts, "Bank Accounts");
  await setCollectionPermissions(COLLECTIONS.payoutRequests, "Payout Requests");

  console.log("Payouts migration complete.");
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

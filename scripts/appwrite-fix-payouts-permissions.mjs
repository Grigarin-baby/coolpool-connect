import { Client, Databases, Users, Query, Permission, Role } from "node-appwrite";

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
  userRoles: process.env.VITE_APPWRITE_COLLECTION_USER_ROLES || "coolpool_user_roles",
  bankAccounts: "coolpool_bank_accounts",
  payoutRequests: "coolpool_payout_requests",
};

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const users = new Users(client);

async function main() {
  // 1. Tag every user with the "admin" role (coolpool_user_roles) with an
  //    Appwrite label so collection permissions can target Role.label("admin").
  const adminRoleDocs = await databases.listDocuments(databaseId, COLLECTIONS.userRoles, [
    Query.equal("role", "admin"),
    Query.limit(100),
  ]);
  const adminUserIds = [...new Set(adminRoleDocs.documents.map((d) => d.user_id))];
  console.log("Admin user ids:", adminUserIds);

  for (const userId of adminUserIds) {
    const u = await users.get(userId);
    const labels = new Set(u.labels || []);
    if (!labels.has("admin")) {
      labels.add("admin");
      await users.updateLabels(userId, [...labels]);
      console.log(`Labeled user ${userId} as admin`);
    } else {
      console.log(`User ${userId} already labeled admin`);
    }
  }

  // 2. coolpool_bank_accounts: only allow creating documents at the
  //    collection level. Read/update/delete are granted per-document to the
  //    owning driver only (set in upsertBankAccount).
  await databases.updateCollection(
    databaseId,
    COLLECTIONS.bankAccounts,
    "coolpool_bank_accounts",
    [Permission.create(Role.users())],
    true, // documentSecurity
    true, // enabled
  );
  console.log("Tightened permissions: coolpool_bank_accounts");

  // 3. coolpool_payout_requests: drivers can create their own request
  //    (document-level read granted to the driver in createPayoutRequest);
  //    admins can read/update everything via the "admin" label.
  await databases.updateCollection(
    databaseId,
    COLLECTIONS.payoutRequests,
    "coolpool_payout_requests",
    [
      Permission.create(Role.users()),
      Permission.read(Role.label("admin")),
      Permission.update(Role.label("admin")),
    ],
    true, // documentSecurity
    true, // enabled
  );
  console.log("Tightened permissions: coolpool_payout_requests");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

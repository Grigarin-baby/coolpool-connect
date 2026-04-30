import { Client, Databases, Query } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const databaseId = process.env.APPWRITE_DATABASE_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !databaseId || !apiKey) {
  throw new Error(
    "Missing one or more required env vars: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID, APPWRITE_API_KEY",
  );
}

const COLLECTIONS = {
  drivers: process.env.APPWRITE_COLLECTION_DRIVERS || "coolpool_drivers",
  vehicles: process.env.APPWRITE_COLLECTION_VEHICLES || "coolpool_vehicles",
  userRoles: process.env.APPWRITE_COLLECTION_USER_ROLES || "coolpool_user_roles",
};

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function deleteAllInCollection(collectionId) {
  let deleted = 0;
  while (true) {
    const batch = await databases.listDocuments(databaseId, collectionId, [Query.limit(100)]);
    if (batch.documents.length === 0) break;
    for (const doc of batch.documents) {
      await databases.deleteDocument(databaseId, collectionId, doc.$id);
      deleted += 1;
    }
  }
  return deleted;
}

async function deleteDriverRolesOnly() {
  let deleted = 0;
  while (true) {
    const batch = await databases.listDocuments(databaseId, COLLECTIONS.userRoles, [
      Query.equal("role", "driver"),
      Query.limit(100),
    ]);
    if (batch.documents.length === 0) break;
    for (const doc of batch.documents) {
      await databases.deleteDocument(databaseId, COLLECTIONS.userRoles, doc.$id);
      deleted += 1;
    }
  }
  return deleted;
}

async function run() {
  const driversDeleted = await deleteAllInCollection(COLLECTIONS.drivers);
  const vehiclesDeleted = await deleteAllInCollection(COLLECTIONS.vehicles);
  const driverRolesDeleted = await deleteDriverRolesOnly();

  console.log("Driver-related DB cleanup complete.");
  console.log(
    JSON.stringify(
      {
        driversDeleted,
        vehiclesDeleted,
        driverRolesDeleted,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exit(1);
});

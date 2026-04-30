import { Client, Databases, Query } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const databaseId = process.env.APPWRITE_DATABASE_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const collectionId = process.env.APPWRITE_COLLECTION_USER_ROLES || "coolpool_user_roles";

if (!endpoint || !projectId || !databaseId || !apiKey) {
  throw new Error(
    "Missing one or more required env vars: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID, APPWRITE_API_KEY",
  );
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function run() {
  let deleted = 0;

  while (true) {
    const page = await databases.listDocuments(databaseId, collectionId, [Query.limit(100)]);
    if (page.documents.length === 0) break;

    for (const doc of page.documents) {
      await databases.deleteDocument(databaseId, collectionId, doc.$id);
      deleted += 1;
    }
  }

  const remaining = await databases.listDocuments(databaseId, collectionId, [Query.limit(1)]);
  console.log(`Cleared ${collectionId}. Deleted: ${deleted}. Remaining: ${remaining.total}.`);
}

run().catch((error) => {
  console.error("Failed to clear user roles:", error);
  process.exit(1);
});

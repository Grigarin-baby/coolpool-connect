import { Client, Databases, Query } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);
const databaseId = process.env.APPWRITE_DATABASE_ID;
const tripsCollection = process.env.APPWRITE_COLLECTION_TRIPS || "coolpool_trips";

const result = await db.listDocuments(databaseId, tripsCollection, [
  Query.limit(50),
  Query.orderDesc("$createdAt"),
]);

console.log(
  JSON.stringify(
    {
      total: result.total,
      documents: result.documents.map((doc) => ({
        id: doc.$id,
        from: doc.from_location,
        to: doc.to_location,
        status: doc.status,
        permissions: doc.$permissions,
      })),
    },
    null,
    2,
  ),
);

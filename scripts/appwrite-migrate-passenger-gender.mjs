import { Client, Databases } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "";
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";

if (!endpoint || !projectId || !databaseId || !apiKey) {
  throw new Error("Missing env vars. Need APPWRITE_API_KEY + endpoint/project/database.");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function ensureStringAttribute(collectionId, key, size) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createStringAttribute(databaseId, collectionId, key, size, false);
    console.log(`Created attribute: ${collectionId}.${key}`);
  }
}

async function ensureEnumAttribute(collectionId, key, values) {
  try {
    await databases.getAttribute(databaseId, collectionId, key);
    console.log(`Attribute exists: ${collectionId}.${key}`);
  } catch {
    await databases.createEnumAttribute(databaseId, collectionId, key, values, false);
    console.log(`Created attribute: ${collectionId}.${key}`);
  }
}

await ensureStringAttribute("coolpool_bookings", "passengers_json", 4000);
await ensureEnumAttribute("coolpool_trip_seat_reservations", "gender", ["male", "female"]);

console.log("Passenger gender migration complete.");

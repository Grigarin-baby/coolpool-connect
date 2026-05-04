import { Client, Databases, ID, Permission, Role } from "node-appwrite";
import { config } from "dotenv";
config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT || "http://localhost/v1";
const projectId = process.env.VITE_APPWRITE_PROJECT_ID || "coolpool";
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || "coolpool_db";
// We need a user session to test client permissions.
// But we only have node-appwrite API key here.
// Instead, let's just inspect the collection permissions.

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);

async function checkCollections() {
  try {
    const collections = [
      "coolpool_bookings",
      "coolpool_trip_seat_reservations",
      "coolpool_trips"
    ];
    for (const c of collections) {
      const col = await databases.getCollection(databaseId, c);
      console.log(`\nCollection: ${c}`);
      console.log(`Document Security: ${col.documentSecurity}`);
      console.log(`Permissions:`, col.$permissions);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

checkCollections();

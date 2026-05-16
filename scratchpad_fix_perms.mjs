import { Client, Databases, Permission, Role } from "node-appwrite";
import { config } from "dotenv";
config();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT || "http://localhost/v1";
const projectId = process.env.VITE_APPWRITE_PROJECT_ID || "coolpool";
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || "coolpool_db";

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);

async function fixPermissions() {
  try {
    const permissions = [
      Permission.create(Role.users()),
      Permission.read(Role.any()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ];
    await databases.updateCollection(
      databaseId,
      "coolpool_trip_seat_reservations",
      "Trip seat reservations",
      permissions,
      true,
      true,
    );
    console.log("Successfully updated coolpool_trip_seat_reservations permissions!");
  } catch (err) {
    console.error("Error updating permissions:", err.message);
  }
}

fixPermissions();

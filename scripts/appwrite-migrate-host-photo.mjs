// Adds the photo_url attribute to the drivers collection (host profile photos).
// Run with: node --env-file=.env scripts/appwrite-migrate-host-photo.mjs

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

const DRIVERS = "coolpool_drivers";

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

try {
  await databases.getAttribute(databaseId, DRIVERS, "photo_url");
  console.log(`Attribute exists: ${DRIVERS}.photo_url`);
} catch {
  await databases.createStringAttribute(databaseId, DRIVERS, "photo_url", 2000, false);
  console.log(`Created attribute: ${DRIVERS}.photo_url`);
}

console.log("Host photo migration complete.");

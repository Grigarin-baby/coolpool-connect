// Adds the pets_allowed ride preference to the drivers collection.
// Run with: node --env-file=.env scripts/appwrite-migrate-pets.mjs

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
  await databases.getAttribute(databaseId, DRIVERS, "pets_allowed");
  console.log(`Attribute exists: ${DRIVERS}.pets_allowed`);
} catch {
  await databases.createBooleanAttribute(databaseId, DRIVERS, "pets_allowed", false, undefined);
  console.log(`Created attribute: ${DRIVERS}.pets_allowed`);
}

console.log("Pets migration complete.");

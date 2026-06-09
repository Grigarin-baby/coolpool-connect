import { Client, Users, ID, Databases } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || "";
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID || "";
const collectionId =
  process.env.APPWRITE_COLLECTION_USER_ROLES ||
  process.env.VITE_APPWRITE_COLLECTION_USER_ROLES ||
  "";
const adminEmail = process.env.ADMIN_EMAIL || "";
const adminPassword = process.env.ADMIN_PASSWORD || "";
const adminName = process.env.ADMIN_NAME || "Admin";

const missing = [];
if (!endpoint) missing.push("APPWRITE_ENDPOINT (or VITE_APPWRITE_ENDPOINT)");
if (!projectId) missing.push("APPWRITE_PROJECT_ID (or VITE_APPWRITE_PROJECT_ID)");
if (!apiKey) missing.push("APPWRITE_API_KEY");
if (!databaseId) missing.push("APPWRITE_DATABASE_ID (or VITE_APPWRITE_DATABASE_ID)");
if (!collectionId) {
  missing.push("APPWRITE_COLLECTION_USER_ROLES (or VITE_APPWRITE_COLLECTION_USER_ROLES)");
}
if (!adminEmail) missing.push("ADMIN_EMAIL");
if (!adminPassword) missing.push("ADMIN_PASSWORD");

if (missing.length) {
  console.error("Missing required environment variables:\n  - " + missing.join("\n  - "));
  console.error("\nAdd them to .env, then run: npm run admin:create");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const users = new Users(client);
const databases = new Databases(client);

async function run() {
  let userId;

  try {
    const list = await users.list();
    const existing = list.users.find((u) => u.email === adminEmail);
    if (existing) {
      console.log("User already exists:", existing.$id);
      userId = existing.$id;
    } else {
      const user = await users.create(ID.unique(), adminEmail, undefined, adminPassword, adminName);
      userId = user.$id;
      console.log("Created user:", userId);
    }

    await users.updatePrefs(userId, { roles: ["admin"], fullName: adminName });

    const rolesList = await databases.listDocuments(databaseId, collectionId, [
      `equal("user_id", ["${userId}"])`,
      `equal("role", ["admin"])`,
    ]);

    if (rolesList.total === 0) {
      await databases.createDocument(databaseId, collectionId, ID.unique(), {
        user_id: userId,
        role: "admin",
      });
      console.log("Added admin role to collection");
    } else {
      console.log("Admin role already exists in collection");
    }
    console.log(`Admin account setup complete for ${adminEmail}`);
  } catch (error) {
    console.error("Error creating admin:", error);
    process.exit(1);
  }
}

run();

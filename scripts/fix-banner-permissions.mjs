import { Client, Databases, Storage, Permission, Role } from "node-appwrite";

const endpoint =
  process.env.VITE_APPWRITE_ENDPOINT ||
  process.env.APPWRITE_ENDPOINT ||
  "http://appwrite-ljdtlive600781krllbzu915.187.127.156.240.sslip.io/v1";
const projectId =
  process.env.VITE_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID || "69f23e9d003845289bcc";
const apiKey =
  process.env.APPWRITE_API_KEY ||
  "standard_d503d4236869eb07a0d51b1a9c2999a6da1952de5b98c3bda53af793e37c432cb89ce24a02ec185cf55c2673bcc34c24738a24579765d56a1dbf23c7868449824ac307d3f4144528d61c9f040fc10cc6ac065692fa8a9aed109cf4d6e6200d7caadb948295eca4058b7472fbee79be241c8acbdd8cbcdd7199918a10cc2af360";

const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || "69f2e5f6000a532410c0";
const collectionId = process.env.VITE_APPWRITE_COLLECTION_HERO_BANNERS || "coolpool_hero_banners";
const bucketId = process.env.VITE_APPWRITE_BANNERS_BUCKET_ID || "coolpool_banners_bucket";

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);

async function run() {
  try {
    // Update collection permissions
    await databases.updateCollection(
      databaseId,
      collectionId,
      "Hero Banners",
      [
        Permission.read(Role.any()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ],
      true, // documentLevelSecurity
      true, // enabled
    );
    console.log("Collection permissions updated successfully!");

    // Update bucket permissions
    await storage.updateBucket(
      bucketId,
      "Banner Images",
      [
        Permission.read(Role.any()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ],
      false, // fileSecurity
      true, // enabled
      5000000,
      ["jpg", "jpeg", "png", "gif", "webp", "svg"],
      "none",
      false,
      false,
    );
    console.log("Bucket permissions updated successfully!");
  } catch (error) {
    console.error("Error updating permissions:", error);
  }
}

run();

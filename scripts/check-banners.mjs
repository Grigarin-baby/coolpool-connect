import { Client, Databases, Storage } from "node-appwrite";

const endpoint =
  process.env.VITE_APPWRITE_ENDPOINT ||
  process.env.APPWRITE_ENDPOINT ||
  "http://appwrite-ljdtlive600781krllbzu915.187.127.156.240.sslip.io/v1";
const projectId =
  process.env.VITE_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID || "69f23e9d003845289bcc";
const apiKey = process.env.APPWRITE_API_KEY;

if (!apiKey) {
  throw new Error("Missing APPWRITE_API_KEY environment variable.");
}

const databaseId = process.env.VITE_APPWRITE_DATABASE_ID || "69f2e5f6000a532410c0";
const collectionId = process.env.VITE_APPWRITE_COLLECTION_HERO_BANNERS || "coolpool_hero_banners";
const bucketId = process.env.VITE_APPWRITE_BANNERS_BUCKET_ID || "coolpool_banners_bucket";

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function run() {
  const result = await databases.listDocuments(databaseId, collectionId);
  console.log("Total banners:", result.total);
  result.documents.forEach((doc, i) => {
    console.log(`Banner ${i}:`, doc);
  });
}

run();

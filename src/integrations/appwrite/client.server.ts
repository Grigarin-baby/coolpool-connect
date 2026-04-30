import { Client, Databases, Users } from "node-appwrite";

function getServerConfig() {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ||
    "http://appwrite-ljdtlive600781krllbzu915.187.127.156.240.sslip.io/v1";
  const projectId = process.env.APPWRITE_PROJECT_ID || "69f23e9d003845289bcc";
  const databaseId = process.env.APPWRITE_DATABASE_ID || "69f2e5f6000a532410c0";
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing APPWRITE_API_KEY environment variable.");
  }

  return { endpoint, projectId, databaseId, apiKey };
}

const config = getServerConfig();

const serverClient = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectId)
  .setKey(config.apiKey);

export const appwriteUsers = new Users(serverClient);
export const appwriteDatabases = new Databases(serverClient);
export const appwriteServerConfig = config;

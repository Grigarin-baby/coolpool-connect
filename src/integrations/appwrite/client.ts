import { Account, Client, Databases, Storage } from "appwrite";

function getClientConfig() {
  const endpoint =
    import.meta.env.VITE_APPWRITE_ENDPOINT ||
    process.env.APPWRITE_ENDPOINT ||
    "http://appwrite-ljdtlive600781krllbzu915.187.127.156.240.sslip.io/v1";
  const projectId =
    import.meta.env.VITE_APPWRITE_PROJECT_ID ||
    process.env.APPWRITE_PROJECT_ID ||
    "69f23e9d003845289bcc";
  const databaseId =
    import.meta.env.VITE_APPWRITE_DATABASE_ID ||
    process.env.APPWRITE_DATABASE_ID ||
    "69f2e5f6000a532410c0";
  const driverDocsBucketId =
    import.meta.env.VITE_APPWRITE_DRIVER_DOCS_BUCKET_ID ||
    process.env.APPWRITE_DRIVER_DOCS_BUCKET_ID ||
    "69f312e500186db2d785";
  // Browser integrations must use VITE_* env vars only.
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  return { endpoint, projectId, databaseId, driverDocsBucketId, googleMapsApiKey };
}

const config = getClientConfig();
const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const appwriteConfig = config;

import { Account, Avatars, Client, Databases, Storage } from "appwrite";

function getClientConfig() {
  const endpoint =
    import.meta.env.VITE_APPWRITE_ENDPOINT ||
    process.env.APPWRITE_ENDPOINT ||
    "https://coolpool.in/v1";
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

  const bannersBucketId =
    import.meta.env.VITE_APPWRITE_BANNERS_BUCKET_ID ||
    process.env.APPWRITE_BANNERS_BUCKET_ID ||
    "coolpool_banners_bucket";

  return { endpoint, projectId, databaseId, driverDocsBucketId, bannersBucketId, googleMapsApiKey };
}

const config = getClientConfig();
const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const avatars = new Avatars(client);
export const appwriteConfig = config;

/** Returns the URL for a user's initials avatar (Appwrite built-in).
 *  Falls back to undefined if name is empty. */
export function getUserAvatarUrl(name: string, size = 64): string | undefined {
  if (!name?.trim()) return undefined;
  return avatars.getInitials(name, size, size).toString();
}

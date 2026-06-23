// SERVER-ONLY. Resolves a phone number to the Appwrite login email using an
// admin API key. Needed because travellers who add a real email at signup use
// that email as their account identity, but log in with phone + PIN — so we
// must look up the email by phone. Existing (email-less) accounts keep their
// synthetic phone email and never reach this resolver (login tries the
// synthetic email first).
import { createServerFn } from "@tanstack/react-start";
import { Client, Users, Account, Databases, Query, ID } from "node-appwrite";

function readEnv(name: string): string {
  return (typeof process !== "undefined" ? (process.env?.[name] ?? "") : "").trim();
}

function appwriteEnv() {
  const endpoint = readEnv("VITE_APPWRITE_ENDPOINT") || readEnv("APPWRITE_ENDPOINT");
  const project = readEnv("VITE_APPWRITE_PROJECT_ID") || readEnv("APPWRITE_PROJECT_ID");
  const key = readEnv("APPWRITE_API_KEY");
  if (!endpoint || !project || !key) {
    throw new Error("Appwrite admin credentials are not configured on the server.");
  }
  return { endpoint, project, key };
}

function adminClient(): Client {
  const { endpoint, project, key } = appwriteEnv();
  return new Client().setEndpoint(endpoint).setProject(project).setKey(key);
}

function adminUsers(): Users {
  return new Users(adminClient());
}

/** Returns the login email for a phone number, or null if no account matches. */
export const lookupLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) => ({
    phone: String(input?.phone ?? "").trim(),
  }))
  .handler(async ({ data }): Promise<{ email: string | null }> => {
    if (!data.phone) return { email: null };
    const users = adminUsers();
    const res = await users.list([Query.equal("phone", data.phone), Query.limit(1)]);
    const u = res.users[0];
    return { email: u?.email ?? null };
  });

/**
 * Permanently deletes the *caller's own* login account (verified via a JWT the
 * client mints with account.createJWT()). The account's data — trips, vehicles,
 * bookings, profile — is KEPT under the old user id so admins retain the full
 * record; their scheduled trips are paused so nobody can book a removed host.
 * An archive row is written to the deleted_accounts collection.
 */
export const deleteOwnAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { jwt: string }) => ({ jwt: String(input?.jwt ?? "").trim() }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    if (!data.jwt) throw new Error("Missing authentication.");
    const { endpoint, project } = appwriteEnv();

    // 1. Verify ownership: resolve the JWT to the calling user.
    const jwtClient = new Client().setEndpoint(endpoint).setProject(project).setJWT(data.jwt);
    const me = await new Account(jwtClient).get();
    const userId = me.$id;

    const admin = adminClient();
    const databases = new Databases(admin);
    const users = new Users(admin);
    const db = readEnv("VITE_APPWRITE_DATABASE_ID") || readEnv("APPWRITE_DATABASE_ID");
    const tripsCol = readEnv("VITE_APPWRITE_COLLECTION_TRIPS") || "coolpool_trips";
    const deletedCol =
      readEnv("VITE_APPWRITE_COLLECTION_DELETED_ACCOUNTS") || "coolpool_deleted_accounts";

    // 2. Archive a metadata row (the live data stays put, keyed by user_id).
    const prefs = (me.prefs ?? {}) as Record<string, unknown>;
    const roles = Array.isArray(prefs.roles) ? (prefs.roles as string[]).join(",") : "";
    try {
      await databases.createDocument(db, deletedCol, ID.unique(), {
        user_id: userId,
        full_name: me.name || String(prefs.fullName ?? ""),
        phone: me.phone || String(prefs.phone ?? ""),
        email: me.email || String(prefs.email ?? ""),
        roles,
        deleted_at: new Date().toISOString(),
      });
    } catch {
      /* archive is best-effort — never block the deletion on it */
    }

    // 3. Pause the host's upcoming trips so they vanish from search (kept, not deleted).
    try {
      const trips = await databases.listDocuments(db, tripsCol, [
        Query.equal("host_id", userId),
        Query.limit(200),
      ]);
      for (const t of trips.documents) {
        if (t.status === "scheduled" || t.status === "in_progress") {
          await databases.updateDocument(db, tripsCol, t.$id, { active: false });
        }
      }
    } catch {
      /* non-fatal */
    }

    // 4. Delete the login account itself — kills all sessions, blocks re-login.
    await users.delete(userId);

    return { ok: true };
  });

// SERVER-ONLY. Bridges a Firebase phone verification into an Appwrite session.
//
// The browser sends the Firebase ID token it received after a successful OTP.
// We independently verify that token with Google, extract the verified phone
// number, find/create the matching Appwrite user, and return a short-lived
// Appwrite session token. The browser then exchanges it for a real session.
//
// The browser can NEVER mint a session on its own — it always goes through
// this verified path. The Appwrite admin key stays server-side.
import { createServerFn } from "@tanstack/react-start";
import { Client, Users, Query, ID } from "node-appwrite";

interface BridgeResult {
  userId: string;
  secret: string;
}

function readEnv(name: string, fallback?: string): string {
  const fromProcess =
    typeof process !== "undefined" ? process.env?.[name] : undefined;
  return (fromProcess || fallback || "").trim();
}

const APPWRITE_ENDPOINT = readEnv(
  "APPWRITE_ENDPOINT",
  import.meta.env.VITE_APPWRITE_ENDPOINT as string,
);
const APPWRITE_PROJECT_ID = readEnv(
  "APPWRITE_PROJECT_ID",
  import.meta.env.VITE_APPWRITE_PROJECT_ID as string,
);
const APPWRITE_API_KEY = readEnv("APPWRITE_API_KEY");
// Firebase Web API key is public; safe to also read the VITE_ value as fallback.
const FIREBASE_WEB_API_KEY = readEnv(
  "FIREBASE_WEB_API_KEY",
  import.meta.env.VITE_FIREBASE_API_KEY as string,
);

interface FirebaseLookupUser {
  localId: string;
  phoneNumber?: string;
  email?: string;
}

/** Verifies the Firebase ID token via Google Identity Toolkit (Workers-safe, no firebase-admin). */
async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseLookupUser> {
  if (!FIREBASE_WEB_API_KEY) {
    throw new Error("FIREBASE_WEB_API_KEY is not configured on the server.");
  }
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!res.ok) {
    throw new Error("Could not verify the phone login. Please try again.");
  }
  const data = (await res.json()) as { users?: FirebaseLookupUser[] };
  const fbUser = data.users?.[0];
  if (!fbUser?.phoneNumber) {
    throw new Error("Phone number was not verified. Please request a new OTP.");
  }
  return fbUser;
}

function appwriteAdmin(): Users {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    throw new Error(
      "Appwrite server credentials missing (APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY).",
    );
  }
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);
  return new Users(client);
}

/**
 * Exchanges a verified Firebase ID token for an Appwrite session token.
 * Input: { data: { idToken } }. Output: { userId, secret }.
 */
export const exchangeFirebaseTokenForAppwrite = createServerFn({ method: "POST" })
  .inputValidator((input: { idToken: string }) => {
    if (!input || typeof input.idToken !== "string" || input.idToken.length < 20) {
      throw new Error("Missing Firebase token.");
    }
    return { idToken: input.idToken };
  })
  .handler(async ({ data }): Promise<BridgeResult> => {
    const fbUser = await verifyFirebaseIdToken(data.idToken);
    const phone = fbUser.phoneNumber!;
    const users = appwriteAdmin();

    // Find an existing Appwrite user for this phone, else create one.
    let userId: string | null = null;
    try {
      const existing = await users.list([Query.equal("phone", phone)]);
      if (existing.total > 0) userId = existing.users[0].$id;
    } catch {
      // listing may fail on some Appwrite configs; fall through to create.
    }

    if (!userId) {
      const created = await users.create(ID.unique(), undefined, phone);
      userId = created.$id;
      try {
        await users.updatePrefs(userId, { roles: ["user"] });
      } catch {
        // prefs are best-effort; useAuth falls back to "user" anyway.
      }
    }

    // Mint a server-side custom token the browser swaps for a session.
    const token = await users.createToken(userId);
    return { userId: token.userId, secret: token.secret };
  });

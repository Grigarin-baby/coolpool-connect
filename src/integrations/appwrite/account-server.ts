// SERVER-ONLY. Resolves a phone number to the Appwrite login email using an
// admin API key. Needed because travellers who add a real email at signup use
// that email as their account identity, but log in with phone + PIN — so we
// must look up the email by phone. Existing (email-less) accounts keep their
// synthetic phone email and never reach this resolver (login tries the
// synthetic email first).
import { createServerFn } from "@tanstack/react-start";
import { Client, Users, Query } from "node-appwrite";

function readEnv(name: string): string {
  return (typeof process !== "undefined" ? (process.env?.[name] ?? "") : "").trim();
}

function adminUsers(): Users {
  const endpoint = readEnv("VITE_APPWRITE_ENDPOINT") || readEnv("APPWRITE_ENDPOINT");
  const project = readEnv("VITE_APPWRITE_PROJECT_ID") || readEnv("APPWRITE_PROJECT_ID");
  const key = readEnv("APPWRITE_API_KEY");
  if (!endpoint || !project || !key) {
    throw new Error("Appwrite admin credentials are not configured on the server.");
  }
  const client = new Client().setEndpoint(endpoint).setProject(project).setKey(key);
  return new Users(client);
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

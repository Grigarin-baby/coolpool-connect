import { account } from "@/integrations/appwrite/client";
import { adminResetPassword, adminCreateUser } from "@/integrations/appwrite/account-server";

// Client helpers: mint a short-lived JWT proving the caller is signed in, then
// call the admin-only server functions (which re-verify admin server-side).

export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  const { jwt } = await account.createJWT();
  await adminResetPassword({ data: { jwt, userId, newPassword } });
}

export async function createUserAsAdmin(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "host" | "guest";
  gender?: string;
}): Promise<{ userId: string }> {
  const { jwt } = await account.createJWT();
  const res = await adminCreateUser({ data: { jwt, ...input } });
  return { userId: res.userId };
}

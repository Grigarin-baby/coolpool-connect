import { account } from "@/integrations/appwrite/client";
import {
  adminCreateUser,
  adminListPayoutRequests,
  adminResetPassword,
  adminUpdatePayoutRequestStatus,
} from "@/integrations/appwrite/account-server";
import type { PayoutRequest, PayoutStatus } from "@/lib/domain";

// Client helpers: mint a short-lived JWT proving the caller is signed in, then
// call the admin-only server functions (which re-verify admin server-side).

function withTimeout<T>(promise: Promise<T>, message: string, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

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
  licenseNumber?: string;
}): Promise<{ userId: string }> {
  const { jwt } = await account.createJWT();
  const res = await adminCreateUser({ data: { jwt, ...input } });
  return { userId: res.userId };
}

export async function listPayoutRequestsAsAdmin(limit = 500): Promise<PayoutRequest[]> {
  const { jwt } = await account.createJWT();
  return adminListPayoutRequests({ data: { jwt, limit } });
}

export async function updatePayoutRequestAsAdmin(
  requestId: string,
  input: {
    status: PayoutStatus;
    paymentReference?: string | null;
    adminNote?: string | null;
  },
): Promise<PayoutRequest> {
  const { jwt } = await account.createJWT();
  return withTimeout(
    adminUpdatePayoutRequestStatus({
      data: {
        jwt,
        requestId,
        status: input.status,
        paymentReference: input.paymentReference,
        adminNote: input.adminNote,
      },
    }),
    "Payout update is taking too long. Please reload localhost and try again.",
  );
}

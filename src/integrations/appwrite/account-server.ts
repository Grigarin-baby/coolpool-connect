// SERVER-ONLY. Resolves a phone number to the Appwrite login email using an
// admin API key. Needed because travellers who add a real email at signup use
// that email as their account identity, but log in with phone + PIN — so we
// must look up the email by phone. Existing (email-less) accounts keep their
// synthetic phone email and never reach this resolver (login tries the
// synthetic email first).
import { createServerFn } from "@tanstack/react-start";
import { Client, Users, Account, Databases, Query, ID } from "node-appwrite";
import { normalizeEmail, normalizeLicense, normalizePhone } from "@/lib/identity-normalizers";
import type { PayoutRequest, PayoutStatus } from "@/lib/domain";

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

function payoutEnv() {
  const db = readEnv("VITE_APPWRITE_DATABASE_ID") || readEnv("APPWRITE_DATABASE_ID");
  const payoutsCol =
    readEnv("VITE_APPWRITE_COLLECTION_PAYOUT_REQUESTS") ||
    readEnv("APPWRITE_COLLECTION_PAYOUT_REQUESTS") ||
    "coolpool_payout_requests";
  if (!db || !payoutsCol) {
    throw new Error("Appwrite payout collection is not configured on the server.");
  }
  return { db, payoutsCol };
}

function toPayoutRequest(doc: any): PayoutRequest {
  return {
    id: String(doc.$id || ""),
    driverUserId: String(doc.driver_user_id || ""),
    amount: Number(doc.amount || 0),
    grossAmount: doc.gross_amount != null ? Number(doc.gross_amount) : null,
    platformFee: doc.platform_fee != null ? Number(doc.platform_fee) : null,
    status: String(doc.status || "pending") as PayoutStatus,
    requestedAt: String(doc.requested_at || doc.$createdAt || ""),
    processedAt: doc.processed_at ? String(doc.processed_at) : null,
    paymentReference: doc.payment_reference ? String(doc.payment_reference) : null,
    adminNote: doc.admin_note ? String(doc.admin_note) : null,
    accountHolderName: String(doc.account_holder_name || ""),
    accountNumber: String(doc.account_number || ""),
    ifscCode: String(doc.ifsc_code || ""),
    upiId: doc.upi_id ? String(doc.upi_id) : null,
  };
}

function normalizePayoutStatus(status: string): PayoutStatus {
  if (
    status === "pending" ||
    status === "processing" ||
    status === "paid" ||
    status === "rejected"
  ) {
    return status;
  }
  throw new Error("Invalid payout status.");
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

/** Verify the JWT belongs to an admin; throws otherwise. */
async function assertAdmin(jwt: string): Promise<void> {
  if (!jwt) throw new Error("Missing authentication.");
  const { endpoint, project } = appwriteEnv();
  const jwtClient = new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt);
  const me = await new Account(jwtClient).get();
  const roles = (me.prefs as Record<string, unknown> | undefined)?.roles;
  if (!Array.isArray(roles) || !roles.includes("admin")) {
    throw new Error("Admin access required.");
  }
}

type DriverIdentityInput = {
  phone?: string;
  email?: string;
  licenseNumber?: string;
  allowedUserId?: string;
};

function driverDuplicateMessage(kind: "phone" | "email" | "license", driver: any): string {
  const value =
    kind === "phone"
      ? String(driver.phone || "")
      : kind === "email"
        ? String(driver.email || "")
        : String(driver.license_number || "");
  return `A host/driver with this ${kind} already exists: ${String(driver.full_name || "Existing driver")} (${value || String(driver.user_id || driver.$id)}).`;
}

async function listDriverDocuments(
  databases: Databases,
  db: string,
  driversCol: string,
): Promise<any[]> {
  const docs: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await databases.listDocuments(db, driversCol, [
      Query.limit(100),
      Query.offset(offset),
    ]);
    docs.push(...page.documents);
    if (page.documents.length < 100) break;
  }
  return docs;
}

async function assertNoDuplicateDriverIdentity(
  databases: Databases,
  db: string,
  driversCol: string,
  input: DriverIdentityInput,
): Promise<void> {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const license = normalizeLicense(input.licenseNumber);
  if (!phone && !email && !license) return;

  const drivers = await listDriverDocuments(databases, db, driversCol);
  for (const driver of drivers) {
    if (input.allowedUserId && String(driver.user_id || "") === input.allowedUserId) continue;
    if (phone && normalizePhone(driver.phone) === phone) {
      throw new Error(driverDuplicateMessage("phone", driver));
    }
    if (email && normalizeEmail(driver.email) === email) {
      throw new Error(driverDuplicateMessage("email", driver));
    }
    if (license && normalizeLicense(driver.license_number) === license) {
      throw new Error(driverDuplicateMessage("license", driver));
    }
  }
}

/** Admin sets a new password for any user. */
export const adminResetPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { jwt: string; userId: string; newPassword: string }) => ({
    jwt: String(input?.jwt ?? "").trim(),
    userId: String(input?.userId ?? "").trim(),
    newPassword: String(input?.newPassword ?? ""),
  }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    await assertAdmin(data.jwt);
    if (!data.userId) throw new Error("Missing user.");
    if (data.newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
    await new Users(adminClient()).updatePassword(data.userId, data.newPassword);
    return { ok: true };
  });

/** Admin-only payout listing using the API key, so host-owned request docs are visible. */
export const adminListPayoutRequests = createServerFn({ method: "POST" })
  .inputValidator((input: { jwt: string; limit?: number }) => ({
    jwt: String(input?.jwt ?? "").trim(),
    limit: Number(input?.limit ?? 500),
  }))
  .handler(async ({ data }): Promise<PayoutRequest[]> => {
    await assertAdmin(data.jwt);
    const { db, payoutsCol } = payoutEnv();
    const databases = new Databases(adminClient());
    const limit = Math.min(Math.max(Number.isFinite(data.limit) ? data.limit : 500, 1), 500);
    const docs: any[] = [];

    for (let offset = 0; docs.length < limit; offset += 100) {
      const pageSize = Math.min(100, limit - docs.length);
      const page = await databases.listDocuments(db, payoutsCol, [
        Query.orderDesc("requested_at"),
        Query.limit(pageSize),
        Query.offset(offset),
      ]);
      docs.push(...page.documents);
      if (page.documents.length < pageSize) break;
    }

    return docs.map(toPayoutRequest);
  });

/** Admin-only payout status updates using the API key. */
export const adminUpdatePayoutRequestStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      jwt: string;
      requestId: string;
      status: PayoutStatus;
      paymentReference?: string | null;
      adminNote?: string | null;
    }) => ({
      jwt: String(input?.jwt ?? "").trim(),
      requestId: String(input?.requestId ?? "").trim(),
      status: normalizePayoutStatus(String(input?.status ?? "pending")),
      paymentReference:
        input?.paymentReference == null ? null : String(input.paymentReference).trim(),
      adminNote: input?.adminNote == null ? null : String(input.adminNote).trim(),
    }),
  )
  .handler(async ({ data }): Promise<PayoutRequest> => {
    await assertAdmin(data.jwt);
    if (!data.requestId) throw new Error("Missing payout request.");
    const { db, payoutsCol } = payoutEnv();
    const payload: Record<string, string> = {
      status: data.status,
    };
    if (data.paymentReference) payload.payment_reference = data.paymentReference;
    if (data.adminNote) payload.admin_note = data.adminNote;
    if (data.status === "paid" || data.status === "rejected") {
      payload.processed_at = new Date().toISOString();
    }
    const doc = await new Databases(adminClient()).updateDocument(
      db,
      payoutsCol,
      data.requestId,
      payload,
    );
    return toPayoutRequest(doc);
  });

/** Admin creates a new host or guest account. */
export const adminCreateUser = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      jwt: string;
      name: string;
      email: string;
      phone?: string;
      password: string;
      role: "host" | "guest";
      gender?: string;
      licenseNumber?: string;
    }) => ({
      jwt: String(input?.jwt ?? "").trim(),
      name: String(input?.name ?? "").trim(),
      email: String(input?.email ?? "").trim(),
      phone: String(input?.phone ?? "").trim(),
      password: String(input?.password ?? ""),
      role: input?.role === "host" ? ("host" as const) : ("guest" as const),
      gender: String(input?.gender ?? "").trim(),
      licenseNumber: String(input?.licenseNumber ?? "").trim(),
    }),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; userId: string }> => {
    await assertAdmin(data.jwt);
    if (!data.email || !data.name) throw new Error("Name and email are required.");
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters.");

    const users = new Users(adminClient());
    // Reuse an existing account with this email if present.
    const existing = await users.list([Query.equal("email", data.email), Query.limit(1)]);
    let userId = existing.users[0]?.$id;
    if (data.role === "host") {
      const db = readEnv("VITE_APPWRITE_DATABASE_ID") || readEnv("APPWRITE_DATABASE_ID");
      const driversCol = readEnv("VITE_APPWRITE_COLLECTION_DRIVERS") || "coolpool_drivers";
      await assertNoDuplicateDriverIdentity(new Databases(adminClient()), db, driversCol, {
        phone: data.phone,
        email: data.email,
        licenseNumber: data.licenseNumber,
        allowedUserId: userId,
      });
    }
    if (userId) {
      await users.updatePassword(userId, data.password);
    } else {
      const created = await users.create(
        ID.unique(),
        data.email,
        undefined,
        data.password,
        data.name,
      );
      userId = created.$id;
    }

    const roles = data.role === "host" ? ["driver", "user"] : ["user"];
    await users.updatePrefs(userId, {
      roles,
      fullName: data.name,
      phone: data.phone || undefined,
      gender: data.gender || undefined,
    });

    // A host needs a driver profile to appear in Host Management.
    if (data.role === "host") {
      const db = readEnv("VITE_APPWRITE_DATABASE_ID") || readEnv("APPWRITE_DATABASE_ID");
      const driversCol = readEnv("VITE_APPWRITE_COLLECTION_DRIVERS") || "coolpool_drivers";
      const databases = new Databases(adminClient());
      try {
        const found = await databases.listDocuments(db, driversCol, [
          Query.equal("user_id", userId),
          Query.limit(1),
        ]);
        if (found.total === 0) {
          await databases.createDocument(db, driversCol, ID.unique(), {
            user_id: userId,
            full_name: data.name,
            email: data.email,
            phone: data.phone || "",
            license_number: "",
            city: "",
            verification_status: "approved",
          });
        }
      } catch {
        /* profile creation best-effort — account + roles already set */
      }
    }

    return { ok: true, userId };
  });

// SERVER-ONLY. Phone OTP via PowersText (bulk.powerstext.in), a raw SMS
// gateway that does not generate, store, or verify codes for us. We own the
// OTP lifecycle: generate a code, store it (with expiry + attempt count) in
// an Appwrite collection, send it via PowersText's HTTP API, and verify it
// ourselves when the user types it back in. This is the only OTP provider —
// it replaced an earlier MSG91-based login flow.
//
// Used for three flows where phone ownership must be proven before a
// sensitive action: (1) signup verification, (2) password reset, (3)
// passwordless login (finds or creates the Appwrite account and bridges a
// session, the same way the old MSG91 login flow did).
import { createServerFn } from "@tanstack/react-start";
import { Client, Databases, Users, Query, ID } from "node-appwrite";
import { formatMemberCode } from "@/lib/memberCode";
import { nextMemberCodeSequence } from "@/integrations/appwrite/member-code-counter.server";

export type OtpPurpose = "signup" | "password_reset" | "login";

function readEnv(name: string): string {
  return (typeof process !== "undefined" ? (process.env?.[name] ?? "") : "").trim();
}

const POWERSTEXT_AUTH_KEY = readEnv("POWERSTEXT_AUTH_KEY");
const POWERSTEXT_SENDER_ID = readEnv("POWERSTEXT_SENDER_ID");
const POWERSTEXT_ROUTE = readEnv("POWERSTEXT_ROUTE") || "1";
const POWERSTEXT_TEMPLATE_ID = readEnv("POWERSTEXT_TEMPLATE_ID");
const POWERSTEXT_BASE_URL =
  readEnv("POWERSTEXT_BASE_URL") || "https://bulk.powerstext.in/http-tokenkeyapi.php";
// DLT-approved template text. Must match the registered template verbatim
// apart from the OTP digits, or the carrier will reject the SMS.
const POWERSTEXT_MESSAGE_TEMPLATE =
  readEnv("POWERSTEXT_MESSAGE_TEMPLATE") || "Dear Customer Your Login otp is {OTP} DE";

const OTP_LENGTH = 4;
const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;

const PHONE_E164 = /^\+\d{8,15}$/;

function assertPowerstextConfigured(): void {
  if (!POWERSTEXT_AUTH_KEY || !POWERSTEXT_SENDER_ID || !POWERSTEXT_TEMPLATE_ID) {
    throw new Error(
      "SMS OTP is not configured on the server (POWERSTEXT_AUTH_KEY / POWERSTEXT_SENDER_ID / POWERSTEXT_TEMPLATE_ID).",
    );
  }
}

/** PowersText expects a plain 10-digit Indian mobile number, no "+91". */
function toPowerstextMobile(phoneE164: string): string {
  const digits = phoneE164.replace(/[^\d]/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  const n = Math.floor(Math.random() * max);
  return String(n).padStart(OTP_LENGTH, "0");
}

function appwriteEnv() {
  const endpoint = readEnv("VITE_APPWRITE_ENDPOINT") || readEnv("APPWRITE_ENDPOINT");
  const project = readEnv("VITE_APPWRITE_PROJECT_ID") || readEnv("APPWRITE_PROJECT_ID");
  const key = readEnv("APPWRITE_API_KEY");
  const db = readEnv("VITE_APPWRITE_DATABASE_ID") || readEnv("APPWRITE_DATABASE_ID");
  const otpCol = readEnv("VITE_APPWRITE_COLLECTION_OTP_CODES") || "coolpool_otp_codes";
  if (!endpoint || !project || !key || !db) {
    throw new Error("Appwrite admin credentials are not configured on the server.");
  }
  return { endpoint, project, key, db, otpCol };
}

function adminClient(): Client {
  const { endpoint, project, key } = appwriteEnv();
  return new Client().setEndpoint(endpoint).setProject(project).setKey(key);
}

/** One pending OTP per (phone, purpose) — the doc id is deterministic so a resend overwrites it. */
function otpDocId(phoneE164: string, purpose: OtpPurpose): string {
  return `otp_${purpose}_${phoneE164.replace(/[^\d]/g, "")}`;
}

interface OtpDoc {
  code: string;
  expires_at: string;
  attempts?: number;
}

/** Loads, checks, and consumes a one-time OTP doc. Throws if invalid/expired/exhausted. */
async function consumeOtp(
  databases: Databases,
  db: string,
  otpCol: string,
  docId: string,
  code: string,
): Promise<void> {
  let doc: OtpDoc;
  try {
    doc = (await databases.getDocument(db, otpCol, docId)) as unknown as OtpDoc;
  } catch {
    throw new Error("Invalid or expired code. Please request a new OTP.");
  }

  const expired = !doc.expires_at || new Date(doc.expires_at).getTime() < Date.now();
  const tooManyAttempts = (doc.attempts ?? 0) >= MAX_ATTEMPTS;
  if (expired || tooManyAttempts || doc.code !== code) {
    if (!expired && !tooManyAttempts) {
      await databases
        .updateDocument(db, otpCol, docId, { attempts: (doc.attempts ?? 0) + 1 })
        .catch(() => {});
    }
    throw new Error("Invalid or expired code. Please request a new OTP.");
  }

  await databases.deleteDocument(db, otpCol, docId).catch(() => {});
}

function isValidPurpose(purpose: unknown): purpose is OtpPurpose {
  return purpose === "signup" || purpose === "password_reset" || purpose === "login";
}

/**
 * Sends a 4-digit SMS OTP to an E.164 phone number via PowersText.
 * Input: { data: { phone, purpose } }. Output: { sent: true }.
 */
export const sendPowerstextOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; purpose: OtpPurpose }) => {
    const phone = String(input?.phone || "").trim();
    const purpose = input?.purpose;
    if (!PHONE_E164.test(phone)) {
      throw new Error("Enter a valid phone number.");
    }
    if (!isValidPurpose(purpose)) {
      throw new Error("Invalid OTP request.");
    }
    return { phone, purpose };
  })
  .handler(async ({ data }): Promise<{ sent: true }> => {
    assertPowerstextConfigured();
    const { db, otpCol } = appwriteEnv();
    const databases = new Databases(adminClient());

    // Block signup for a number that already has an account — before any SMS is
    // sent — so the user is steered to sign in instead of wasting an OTP and
    // hitting a 409 only after verifying. (login/password_reset need the number
    // to exist, so they are intentionally not checked here.)
    if (data.purpose === "signup") {
      const users = new Users(adminClient());
      const existing = await users.list([Query.equal("phone", data.phone), Query.limit(1)]);
      if (existing.total > 0) {
        throw new Error("This phone number is already registered. Please sign in instead.");
      }
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000).toISOString();
    const docId = otpDocId(data.phone, data.purpose);
    const payload = {
      phone: data.phone,
      code,
      purpose: data.purpose,
      expires_at: expiresAt,
      attempts: 0,
    };
    try {
      await databases.updateDocument(db, otpCol, docId, payload);
    } catch {
      await databases.createDocument(db, otpCol, docId, payload);
    }

    const message = POWERSTEXT_MESSAGE_TEMPLATE.replace("{OTP}", code);
    const url = new URL(POWERSTEXT_BASE_URL);
    url.searchParams.set("authentic-key", POWERSTEXT_AUTH_KEY);
    url.searchParams.set("senderid", POWERSTEXT_SENDER_ID);
    url.searchParams.set("route", POWERSTEXT_ROUTE);
    url.searchParams.set("number", toPowerstextMobile(data.phone));
    url.searchParams.set("message", message);
    url.searchParams.set("templateid", POWERSTEXT_TEMPLATE_ID);

    const res = await fetch(url.toString(), { method: "GET" });
    const text = await res.text().catch(() => "");
    if (
      !res.ok ||
      /provide valid|kindly provide|no number found|not enough balance|valid route-id|shouldn't blank/i.test(
        text,
      )
    ) {
      throw new Error("Could not send the OTP. Please try again.");
    }
    return { sent: true };
  });

/**
 * Verifies a previously-sent OTP and consumes it (one-time use). Does NOT
 * perform the signup/reset action itself — callers gate their next step on
 * { verified: true }.
 * Input: { data: { phone, code, purpose } }. Output: { verified: true }.
 */
export const verifyPowerstextOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; code: string; purpose: OtpPurpose }) => {
    const phone = String(input?.phone || "").trim();
    const code = String(input?.code || "").replace(/\D/g, "");
    const purpose = input?.purpose;
    if (!PHONE_E164.test(phone)) {
      throw new Error("Invalid phone number.");
    }
    if (code.length !== OTP_LENGTH) {
      throw new Error(`Enter the ${OTP_LENGTH}-digit code from the SMS.`);
    }
    if (!isValidPurpose(purpose)) {
      throw new Error("Invalid OTP request.");
    }
    return { phone, code, purpose };
  })
  .handler(async ({ data }): Promise<{ verified: true }> => {
    const { db, otpCol } = appwriteEnv();
    const databases = new Databases(adminClient());
    const docId = otpDocId(data.phone, data.purpose);
    await consumeOtp(databases, db, otpCol, docId, data.code);
    return { verified: true };
  });

/**
 * Resets a traveller's PIN by phone, gated on a fresh OTP for purpose
 * "password_reset". Re-checks and consumes the OTP at the moment of reset
 * (rather than trusting a prior "verified" client state) so the code can't
 * be replayed. `secret` is the already-derived Appwrite password (see
 * useAuth's derivePassword) — the server never sees the raw 4-digit PIN.
 * Input: { data: { phone, code, secret } }. Output: { ok: true }.
 */
export const resetPasswordWithPowerstextOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; code: string; secret: string }) => {
    const phone = String(input?.phone || "").trim();
    const code = String(input?.code || "").replace(/\D/g, "");
    const secret = String(input?.secret || "").trim();
    if (!PHONE_E164.test(phone)) {
      throw new Error("Invalid phone number.");
    }
    if (code.length !== OTP_LENGTH) {
      throw new Error(`Enter the ${OTP_LENGTH}-digit code from the SMS.`);
    }
    if (!secret) {
      throw new Error("Missing new password.");
    }
    return { phone, code, secret };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { db, otpCol } = appwriteEnv();
    const databases = new Databases(adminClient());
    const docId = otpDocId(data.phone, "password_reset");
    await consumeOtp(databases, db, otpCol, docId, data.code);

    const users = new Users(adminClient());
    const existing = await users.list([Query.equal("phone", data.phone), Query.limit(1)]);
    const userId = existing.users[0]?.$id;
    if (!userId) {
      throw new Error("No account found for this phone number.");
    }
    await users.updatePassword(userId, data.secret);
    return { ok: true };
  });

/**
 * Verifies a "login" OTP, then finds or creates the Appwrite account for
 * this phone number and mints a session token — passwordless login (and
 * implicit signup for a brand-new phone). The client swaps the returned
 * userId/secret for a real session via account.createSession().
 * Input: { data: { phone, code } }. Output: { userId, secret }.
 */
export const loginWithPowerstextOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; code: string }) => {
    const phone = String(input?.phone || "").trim();
    const code = String(input?.code || "").replace(/\D/g, "");
    if (!PHONE_E164.test(phone)) {
      throw new Error("Invalid phone number.");
    }
    if (code.length !== OTP_LENGTH) {
      throw new Error(`Enter the ${OTP_LENGTH}-digit code from the SMS.`);
    }
    return { phone, code };
  })
  .handler(async ({ data }): Promise<{ userId: string; secret: string }> => {
    const { db, otpCol } = appwriteEnv();
    const databases = new Databases(adminClient());
    const docId = otpDocId(data.phone, "login");
    await consumeOtp(databases, db, otpCol, docId, data.code);

    const users = new Users(adminClient());
    let userId: string | null = null;
    try {
      const existing = await users.list([Query.equal("phone", data.phone), Query.limit(1)]);
      if (existing.total > 0) userId = existing.users[0].$id;
    } catch {
      // listing may fail on some Appwrite configs; fall through to create.
    }

    if (!userId) {
      const created = await users.create(ID.unique(), undefined, data.phone);
      userId = created.$id;
      try {
        const sequence = await nextMemberCodeSequence(databases);
        const memberCode = formatMemberCode({
          createdAt: new Date(),
          role: "guest",
          gender: undefined,
          sequence,
        });
        await users.updatePrefs(userId, { roles: ["user"], memberCode });
      } catch {
        // prefs/member-code are best-effort; useAuth falls back to "user" anyway.
      }
    }

    const token = await users.createToken(userId);
    return { userId: token.userId, secret: token.secret };
  });

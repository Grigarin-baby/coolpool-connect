// SERVER-ONLY. Phone OTP via MSG91, bridged into an Appwrite session.
//
// MSG91 owns code generation, delivery, expiry and verification — we never see
// or store the code. The browser asks the server to (1) send an SMS OTP and
// (2) check the code the user typed. On a successful check the server
// finds/creates the matching Appwrite user and returns a short-lived session
// token the browser swaps for a real session.
//
// The MSG91 auth key stays server-side and is never bundled for the browser.
// The browser can NEVER mint a session on its own.
import { createServerFn } from "@tanstack/react-start";
import { Client, Users, Query, ID } from "node-appwrite";

interface BridgeResult {
  userId: string;
  secret: string;
}

function readEnv(name: string, fallback?: string): string {
  const fromProcess = typeof process !== "undefined" ? process.env?.[name] : undefined;
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

const MSG91_AUTH_KEY = readEnv("MSG91_AUTH_KEY");
const MSG91_TEMPLATE_ID = readEnv("MSG91_TEMPLATE_ID");
const MSG91_SENDER_ID = readEnv("MSG91_SENDER_ID");

const MSG91_BASE = "https://control.msg91.com/api/v5/otp";
const OTP_LENGTH = 4;
const OTP_EXPIRY_MINUTES = 5;

const PHONE_E164 = /^\+\d{8,15}$/;

function assertMsg91Configured(): void {
  if (!MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID) {
    throw new Error(
      "Phone login is not configured on the server (MSG91_AUTH_KEY / MSG91_TEMPLATE_ID).",
    );
  }
}

/** MSG91 expects the mobile number with country code but WITHOUT a leading "+". */
function toMsg91Mobile(phoneE164: string): string {
  return phoneE164.replace(/[^\d]/g, "");
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
 * Sends an SMS OTP to an E.164 phone number via MSG91.
 * Input: { data: { phone } }. Output: { sent: true }.
 */
export const sendMsg91Otp = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) => {
    const phone = String(input?.phone || "").trim();
    if (!PHONE_E164.test(phone)) {
      throw new Error("Enter a valid phone number.");
    }
    return { phone };
  })
  .handler(async ({ data }): Promise<{ sent: true }> => {
    assertMsg91Configured();

    const url = new URL(MSG91_BASE);
    url.searchParams.set("template_id", MSG91_TEMPLATE_ID);
    url.searchParams.set("mobile", toMsg91Mobile(data.phone));
    url.searchParams.set("otp_length", String(OTP_LENGTH));
    url.searchParams.set("otp_expiry", String(OTP_EXPIRY_MINUTES));
    if (MSG91_SENDER_ID) url.searchParams.set("sender", MSG91_SENDER_ID);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        authkey: MSG91_AUTH_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const result = (await res.json().catch(() => ({}))) as {
      type?: string;
      message?: string;
    };
    if (!res.ok || result.type !== "success") {
      throw new Error(result.message || "Could not send the OTP. Please try again.");
    }
    return { sent: true };
  });

/**
 * Checks the OTP the user typed with MSG91. On success, finds/creates the
 * Appwrite user for this phone and mints a session token.
 * Input: { data: { phone, code } }. Output: { userId, secret }.
 */
export const verifyMsg91Otp = createServerFn({ method: "POST" })
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
  .handler(async ({ data }): Promise<BridgeResult> => {
    assertMsg91Configured();

    const url = new URL(`${MSG91_BASE}/verify`);
    url.searchParams.set("mobile", toMsg91Mobile(data.phone));
    url.searchParams.set("otp", data.code);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { authkey: MSG91_AUTH_KEY },
    });
    const result = (await res.json().catch(() => ({}))) as {
      type?: string;
      message?: string;
    };
    if (!res.ok || result.type !== "success") {
      throw new Error("Invalid or expired code. Please request a new OTP.");
    }

    // Phone ownership is proven — find or create the Appwrite user.
    const users = appwriteAdmin();
    let userId: string | null = null;
    try {
      const existing = await users.list([Query.equal("phone", data.phone)]);
      if (existing.total > 0) userId = existing.users[0].$id;
    } catch {
      // listing may fail on some Appwrite configs; fall through to create.
    }

    if (!userId) {
      const created = await users.create(ID.unique(), undefined, data.phone);
      userId = created.$id;
      try {
        await users.updatePrefs(userId, { roles: ["user"] });
      } catch {
        // prefs are best-effort; useAuth falls back to "user" anyway.
      }
    }

    const token = await users.createToken(userId);
    return { userId: token.userId, secret: token.secret };
  });

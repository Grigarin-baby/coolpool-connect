import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ID, OAuthProvider, type Models } from "appwrite";
import { account } from "@/integrations/appwrite/client";
import { listUserRoles, assignRole, upsertDriverProfile } from "@/data/appwrite-repository";
import type { AppRole } from "@/lib/domain";
import { parseTravelerResumeRedirectParam } from "@/lib/travelerResumeRedirect";
import {
  lookupLoginEmail,
  deleteOwnAccount,
  mintMemberCode,
} from "@/integrations/appwrite/account-server";
import {
  sendPowerstextOtp,
  verifyPowerstextOtp,
  resetPasswordWithPowerstextOtp,
  loginWithPowerstextOtp,
} from "@/integrations/powerstext/otp";

export interface MemberGoogleOAuthOptions {
  resumeRedirect?: string;
  successUrl?: string;
}

type AppwriteUser = Models.User<Models.Preferences>;

interface AuthContextValue {
  session: { userId: string } | null;
  user: AppwriteUser | null;
  roles: AppRole[];
  loading: boolean;
  isDriver: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  /** Logs in with phone number + password (phone is the identity). */
  signInWithPhonePassword: (phoneE164: string, password: string) => Promise<void>;
  /** Creates an account with name + phone number + password (+ optional email/gender). */
  signUpWithPhonePassword: (
    name: string,
    phoneE164: string,
    password: string,
    contactEmail?: string,
    gender?: string,
  ) => Promise<void>;
  /** Derives the Appwrite secret from a phone + PIN (used for PIN reset). */
  deriveAccountSecret: (phoneE164: string, password: string) => Promise<string>;
  /** Sends a passwordless-login SMS OTP (via PowersText) to an E.164 phone number. */
  sendLoginOtp: (phoneE164: string) => Promise<void>;
  /** Verifies the login OTP, finding/creating the account, and signs the user into Appwrite. */
  verifyLoginOtp: (phoneE164: string, code: string) => Promise<void>;
  /** Starts Appwrite Google OAuth (redirects away). Configure Google in Appwrite Auth settings. */
  signInWithGoogle: (opts?: MemberGoogleOAuthOptions) => void;
  signOut: () => Promise<void>;
  /** Permanently deletes the caller's own account (data archived for admins). */
  deleteAccount: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  becomeRideHost: (phone: string) => Promise<void>;
  /** Sends a password-recovery email (for email/password accounts). */
  requestPasswordRecovery: (email: string) => Promise<void>;
  /** Completes recovery using the userId+secret from the email link. */
  completePasswordRecovery: (userId: string, secret: string, password: string) => Promise<void>;
  /** Saves the signed-in user's contact email to their profile prefs. */
  saveContactEmail: (email: string) => Promise<void>;
  /** Sends an SMS OTP (via PowersText) to prove phone ownership before signup. */
  sendSignupOtp: (phoneE164: string) => Promise<void>;
  /** Verifies the signup OTP. Does not create the account — call signUpWithPhonePassword after. */
  verifySignupOtp: (phoneE164: string, code: string) => Promise<void>;
  /** Sends an SMS OTP (via PowersText) to a registered phone, to authorize a PIN reset. */
  sendPasswordResetOtp: (phoneE164: string) => Promise<void>;
  /** Verifies the reset OTP and sets a new PIN for the account with this phone. */
  resetPasswordWithOtp: (phoneE164: string, code: string, newPin: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Appwrite requires passwords of 8+ chars. The client wants 4–6 char user
 * passwords, so the short password (salted with the phone number) is hashed to
 * a deterministic, strong, fixed-length secret that is what Appwrite actually
 * stores. Same phone + same short password always yields the same secret.
 */
async function derivePassword(phoneE164: string, raw: string): Promise<string> {
  const digits = phoneE164.replace(/[^\d]/g, "");
  const bytes = new TextEncoder().encode(`coolpool:${digits}:${raw}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `cp_${hex}`;
}

/**
 * Accounts created via Google OAuth (or any account that predates the
 * member-code system) never went through signUpWithPhonePassword, so they
 * have no prefs.memberCode. Mint one on the next session refresh and persist
 * it — best-effort, never blocks sign-in.
 */
async function backfillMemberCode(currentUser: AppwriteUser): Promise<AppwriteUser> {
  const prefs = (currentUser.prefs ?? {}) as Record<string, unknown>;
  if (typeof prefs.memberCode === "string" && prefs.memberCode) return currentUser;
  try {
    const roles = Array.isArray(prefs.roles) ? (prefs.roles as string[]) : [];
    const role = roles.includes("driver") ? "host" : "guest";
    const gender = typeof prefs.gender === "string" ? prefs.gender : undefined;
    const { code } = await mintMemberCode({ data: { role, gender } });
    await account.updatePrefs({ ...prefs, memberCode: code });
    return await account.get();
  } catch {
    return currentUser;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ userId: string } | null>(null);
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (currentUser: AppwriteUser) => {
    try {
      const dbRoles = await listUserRoles(currentUser.$id);
      if (dbRoles.length > 0) {
        setRoles(dbRoles);
        return;
      }
    } catch {
      // Fallback to prefs when backend collections are not configured yet.
    }

    const candidateRoles = currentUser.prefs?.roles;
    if (!Array.isArray(candidateRoles)) {
      setRoles(["user"]);
      return;
    }

    const parsedRoles = candidateRoles.filter((role): role is AppRole =>
      ["admin", "driver", "user"].includes(String(role)),
    );
    setRoles(parsedRoles.length > 0 ? parsedRoles : ["user"]);
  };

  const refreshSession = useCallback(async () => {
    try {
      const currentUser = await account.get();
      setSession({ userId: currentUser.$id });
      await loadRoles(currentUser);
      setUser(await backfillMemberCode(currentUser));
    } catch {
      setUser(null);
      setSession(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const refreshRoles = async () => {
    if (user) await loadRoles(user);
  };

  const signIn = async (email: string, password: string) => {
    await account.createEmailPasswordSession(email, password);
    await refreshSession();
  };

  const requestPasswordRecovery = async (email: string) => {
    const envOrigin = import.meta.env.VITE_APP_ORIGIN?.replace(/\/$/, "");
    const origin = envOrigin || window.location.origin;
    await account.createRecovery(email, `${origin}/reset-password`);
  };

  const completePasswordRecovery = async (userId: string, secret: string, password: string) => {
    await account.updateRecovery(userId, secret, password);
  };

  const saveContactEmail = async (email: string) => {
    await account.updatePrefs({ ...(user?.prefs || {}), email });
    await refreshSession();
  };

  const signUp = async (name: string, email: string, password: string) => {
    await account.create(ID.unique(), email, password, name);
    await account.createEmailPasswordSession(email, password);
    await account.updatePrefs({ roles: ["user"], fullName: name });
    await refreshSession();
  };

  // Appwrite has no native phone+password session, so the phone becomes a
  // deterministic synthetic email. The user only ever sees/enters the phone.
  const phoneToEmail = (phoneE164: string) =>
    `u${phoneE164.replace(/[^\d]/g, "")}@phone.coolpool.in`;

  const signInWithPhonePassword = async (phoneE164: string, password: string) => {
    const secret = await derivePassword(phoneE164, password);
    try {
      // Existing accounts (and new ones without an email) use the synthetic
      // phone email — try it first so existing users are completely unaffected.
      await account.createEmailPasswordSession(phoneToEmail(phoneE164), secret);
    } catch (err) {
      // Newer accounts that added a real email at signup use it as their login
      // identity. Resolve the email by phone and retry.
      let resolved: string | null = null;
      try {
        const res = await lookupLoginEmail({ data: { phone: phoneE164 } });
        resolved = res.email;
      } catch {
        /* resolver unavailable — fall through to original error */
      }
      if (resolved && resolved !== phoneToEmail(phoneE164)) {
        await account.createEmailPasswordSession(resolved, secret);
      } else {
        throw err;
      }
    }
    await refreshSession();
  };

  const signUpWithPhonePassword = async (
    name: string,
    phoneE164: string,
    password: string,
    contactEmail?: string,
    gender?: string,
  ) => {
    const realEmail = contactEmail?.trim() || "";
    // When the traveller provides a real email, use it as the login identity so
    // password recovery emails actually reach them. Otherwise fall back to the
    // synthetic phone email (recovery isn't available for those accounts).
    const email = realEmail || phoneToEmail(phoneE164);
    const secret = await derivePassword(phoneE164, password);
    // Mint the human-readable member ID before creating the account — cheap
    // and harmless to do even if account creation fails right after.
    const { code: memberCode } = await mintMemberCode({ data: { role: "guest", gender } });
    try {
      await account.create(ID.unique(), email, secret, name);
    } catch (error) {
      const appwriteError = error as { code?: number; type?: string; message?: string };
      const alreadyExists =
        appwriteError?.code === 409 ||
        appwriteError?.type === "user_already_exists" ||
        /already exists/i.test(appwriteError?.message ?? "");
      if (alreadyExists) {
        throw new Error("An account with this phone number already exists. Please log in instead.");
      }
      throw error;
    }
    await account.createEmailPasswordSession(email, secret);
    await account.updatePrefs({
      roles: ["user"],
      fullName: name,
      phone: phoneE164,
      memberCode,
      ...(gender ? { gender } : {}),
      ...(realEmail ? { email: realEmail } : {}),
    });
    // Always set the phone field so phone+PIN login can resolve this account
    // back from its (possibly real) email. Best-effort.
    try {
      await account.updatePhone(phoneE164, secret);
    } catch {
      /* phone provider off or number already linked — non-fatal */
    }
    await refreshSession();
  };

  const sendLoginOtp = async (phoneE164: string) => {
    await sendPowerstextOtp({ data: { phone: phoneE164, purpose: "login" } });
  };

  const verifyLoginOtp = async (phoneE164: string, code: string) => {
    const { userId, secret } = await loginWithPowerstextOtp({ data: { phone: phoneE164, code } });
    // Clear any leftover anonymous/previous session before swapping in the new one.
    try {
      await account.deleteSession("current");
    } catch {
      /* no existing session */
    }
    await account.createSession(userId, secret);
    await refreshSession();
  };

  const sendSignupOtp = async (phoneE164: string) => {
    await sendPowerstextOtp({ data: { phone: phoneE164, purpose: "signup" } });
  };

  const verifySignupOtp = async (phoneE164: string, code: string) => {
    await verifyPowerstextOtp({ data: { phone: phoneE164, code, purpose: "signup" } });
  };

  const sendPasswordResetOtp = async (phoneE164: string) => {
    await sendPowerstextOtp({ data: { phone: phoneE164, purpose: "password_reset" } });
  };

  const resetPasswordWithOtp = async (phoneE164: string, code: string, newPin: string) => {
    const secret = await derivePassword(phoneE164, newPin);
    await resetPasswordWithPowerstextOtp({ data: { phone: phoneE164, code, secret } });
  };

  const signInWithGoogle = useCallback((opts?: MemberGoogleOAuthOptions) => {
    if (typeof window === "undefined") return;
    const envOrigin = import.meta.env.VITE_APP_ORIGIN?.replace(/\/$/, "");
    const origin = envOrigin || window.location.origin;

    let success = opts?.successUrl ? `${origin}${opts.successUrl}` : `${origin}/members`;
    const safeRedirect = opts?.resumeRedirect
      ? parseTravelerResumeRedirectParam(opts.resumeRedirect)
      : undefined;
    if (safeRedirect && !opts?.successUrl) {
      success = `${origin}/members?redirect=${encodeURIComponent(safeRedirect)}`;
    }

    const failureParams = new URLSearchParams({ google_auth: "failed" });
    if (safeRedirect) failureParams.set("redirect", safeRedirect);
    const failure = opts?.successUrl
      ? `${origin}${opts.successUrl}?google_auth=failed`
      : `${origin}/members?${failureParams.toString()}`;

    try {
      account.createOAuth2Session({
        provider: OAuthProvider.Google,
        success,
        failure,
      });
    } catch (error) {
      console.error("Google OAuth error:", error);
      throw error;
    }
  }, []);

  const becomeRideHost = async (phone: string) => {
    if (!user) throw new Error("Not logged in");
    const prefs = (user.prefs ?? {}) as Record<string, unknown>;
    await upsertDriverProfile({
      userId: user.$id,
      fullName: user.name,
      email: user.email,
      phone,
      licenseNumber: "",
      city: "",
      // Carry over the existing member code/gender — becoming a host doesn't
      // mint a new ID, the account keeps the one assigned at signup.
      memberCode: typeof prefs.memberCode === "string" ? prefs.memberCode : null,
      gender: typeof prefs.gender === "string" ? prefs.gender : null,
    });
    await assignRole(user.$id, "driver");
    const existingRoles = Array.isArray(user.prefs?.roles) ? user.prefs.roles : [];
    await account.updatePrefs({
      ...user.prefs,
      roles: Array.from(new Set([...existingRoles, "driver"])),
    });
    await refreshSession();
  };

  const signOut = async () => {
    try {
      await account.deleteSession("current");
    } finally {
      await refreshSession();
      if (typeof window !== "undefined") {
        window.location.assign("/");
      }
    }
  };

  /**
   * Permanently deletes the user's own login account via the admin server
   * function (proven by a short-lived JWT). Their data is archived/kept for
   * admins; here we just tear down the local session afterwards.
   */
  const deleteAccount = async () => {
    const { jwt } = await account.createJWT();
    await deleteOwnAccount({ data: { jwt } });
    // The account no longer exists server-side; clear any local session state.
    try {
      await account.deleteSession("current");
    } catch {
      /* already invalid — fine */
    }
    setSession(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        roles,
        loading,
        isDriver: roles.includes("driver"),
        // Admin must come from the Appwrite-native label, never from `roles`
        // (sourced from prefs/db, both of which a user can self-edit) — see
        // assertAdmin() in account-server.ts for the matching server-side check.
        isAdmin: !!user?.labels?.includes("admin"),
        signIn,
        signUp,
        signInWithPhonePassword,
        signUpWithPhonePassword,
        sendLoginOtp,
        verifyLoginOtp,
        signInWithGoogle,
        signOut,
        refreshRoles,
        becomeRideHost,
        requestPasswordRecovery,
        completePasswordRecovery,
        saveContactEmail,
        deriveAccountSecret: derivePassword,
        deleteAccount,
        sendSignupOtp,
        verifySignupOtp,
        sendPasswordResetOtp,
        resetPasswordWithOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

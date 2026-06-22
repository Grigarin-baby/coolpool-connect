import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ID, OAuthProvider, type Models } from "appwrite";
import { account } from "@/integrations/appwrite/client";
import { listUserRoles, assignRole, upsertDriverProfile } from "@/data/appwrite-repository";
import type { AppRole } from "@/lib/domain";
import { parseTravelerResumeRedirectParam } from "@/lib/travelerResumeRedirect";
import { sendMsg91Otp, verifyMsg91Otp } from "@/integrations/msg91/otp";

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
  /** Creates an account with name + phone number + password. */
  signUpWithPhonePassword: (
    name: string,
    phoneE164: string,
    password: string,
  ) => Promise<void>;
  /** Sends an SMS OTP via MSG91 to an E.164 phone number. */
  sendPhoneOtp: (phoneE164: string) => Promise<void>;
  /** Verifies the OTP (for the last number sent to) and signs the user into Appwrite. */
  verifyPhoneOtp: (code: string) => Promise<void>;
  /** Starts Appwrite Google OAuth (redirects away). Configure Google in Appwrite Auth settings. */
  signInWithGoogle: (opts?: MemberGoogleOAuthOptions) => void;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  becomeRideHost: (phone: string) => Promise<void>;
  /** Sends a password-recovery email (for email/password accounts). */
  requestPasswordRecovery: (email: string) => Promise<void>;
  /** Completes recovery using the userId+secret from the email link. */
  completePasswordRecovery: (userId: string, secret: string, password: string) => Promise<void>;
  /** Saves the signed-in user's contact email to their profile prefs. */
  saveContactEmail: (email: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ userId: string } | null>(null);
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  /** The E.164 number the current OTP was sent to (MSG91 verify needs it again). */
  const otpPhone = useRef<string | null>(null);

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
      setUser(currentUser);
      setSession({ userId: currentUser.$id });
      await loadRoles(currentUser);
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

  const completePasswordRecovery = async (
    userId: string,
    secret: string,
    password: string,
  ) => {
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
    await account.createEmailPasswordSession(phoneToEmail(phoneE164), secret);
    await refreshSession();
  };

  const signUpWithPhonePassword = async (
    name: string,
    phoneE164: string,
    password: string,
  ) => {
    const email = phoneToEmail(phoneE164);
    const secret = await derivePassword(phoneE164, password);
    try {
      await account.create(ID.unique(), email, secret, name);
    } catch (error) {
      const appwriteError = error as { code?: number; type?: string; message?: string };
      const alreadyExists =
        appwriteError?.code === 409 ||
        appwriteError?.type === "user_already_exists" ||
        /already exists/i.test(appwriteError?.message ?? "");
      if (alreadyExists) {
        throw new Error(
          "An account with this phone number already exists. Please log in instead.",
        );
      }
      throw error;
    }
    await account.createEmailPasswordSession(email, secret);
    await account.updatePrefs({ roles: ["user"], fullName: name, phone: phoneE164 });
    // Link the real phone so OTP login resolves to the same account. Best-effort.
    try {
      await account.updatePhone(phoneE164, secret);
    } catch {
      /* phone provider off or number already linked — non-fatal */
    }
    await refreshSession();
  };

  const sendPhoneOtp = async (phoneE164: string) => {
    await sendMsg91Otp({ data: { phone: phoneE164 } });
    otpPhone.current = phoneE164;
  };

  const verifyPhoneOtp = async (code: string) => {
    const phone = otpPhone.current;
    if (!phone) {
      throw new Error("Request an OTP first.");
    }
    const { userId, secret } = await verifyMsg91Otp({ data: { phone, code } });
    // Clear any leftover anonymous/previous session before swapping in the new one.
    try {
      await account.deleteSession("current");
    } catch {
      /* no existing session */
    }
    await account.createSession(userId, secret);
    otpPhone.current = null;
    await refreshSession();
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
    await upsertDriverProfile({
      userId: user.$id,
      fullName: user.name,
      email: user.email,
      phone,
      licenseNumber: "",
      city: "",
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

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        roles,
        loading,
        isDriver: roles.includes("driver"),
        isAdmin: roles.includes("admin"),
        signIn,
        signUp,
        signInWithPhonePassword,
        signUpWithPhonePassword,
        sendPhoneOtp,
        verifyPhoneOtp,
        signInWithGoogle,
        signOut,
        refreshRoles,
        becomeRideHost,
        requestPasswordRecovery,
        completePasswordRecovery,
        saveContactEmail,
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

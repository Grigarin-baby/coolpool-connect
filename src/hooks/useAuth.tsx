import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ID, OAuthProvider, type Models } from "appwrite";
import { account } from "@/integrations/appwrite/client";
import { listUserRoles, assignRole, upsertDriverProfile } from "@/data/appwrite-repository";
import type { AppRole } from "@/lib/domain";
import { parseTravelerResumeRedirectParam } from "@/lib/travelerResumeRedirect";

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
  /** Starts Appwrite Google OAuth (redirects away). Configure Google in Appwrite Auth settings. */
  signInWithGoogle: (opts?: MemberGoogleOAuthOptions) => void;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  becomeRideHost: (phone: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

  const signUp = async (name: string, email: string, password: string) => {
    await account.create(ID.unique(), email, password, name);
    await account.createEmailPasswordSession(email, password);
    await account.updatePrefs({ roles: ["user"], fullName: name });
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
    const failure = opts?.successUrl ? `${origin}${opts.successUrl}?google_auth=failed` : `${origin}/members?${failureParams.toString()}`;

    account.createOAuth2Session({
      provider: OAuthProvider.Google,
      success,
      failure,
    });
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
        signInWithGoogle,
        signOut,
        refreshRoles,
        becomeRideHost,
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


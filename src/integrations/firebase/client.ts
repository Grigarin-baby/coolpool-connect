// Firebase is used ONLY to verify phone ownership via SMS OTP.
// Session/identity remains Appwrite (see bridge.server.ts + useAuth).
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
}

let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase phone login is not configured. Add VITE_FIREBASE_* values to .env (see FIREBASE_OTP_SETUP.md).",
    );
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig as Record<string, string>);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  auth.useDeviceLanguage();
  return auth;
}

let recaptcha: RecaptchaVerifier | null = null;

/**
 * Creates (once) an invisible reCAPTCHA bound to a container element.
 * Firebase requires this for web phone auth; the user never sees it
 * unless Firebase escalates to a challenge.
 */
export function ensureRecaptcha(containerId: string): RecaptchaVerifier {
  if (recaptcha) return recaptcha;
  recaptcha = new RecaptchaVerifier(getFirebaseAuth(), containerId, { size: "invisible" });
  return recaptcha;
}

/** Fully disposes the reCAPTCHA so a fresh one is created next attempt. */
export function resetRecaptcha(): void {
  try {
    recaptcha?.clear();
  } catch {
    /* ignore */
  }
  recaptcha = null;
}

/** Sends an SMS OTP to an E.164 phone number. Returns the confirmation handle. */
export async function sendOtp(
  phoneE164: string,
  containerId: string,
): Promise<ConfirmationResult> {
  const verifier = ensureRecaptcha(containerId);
  try {
    return await signInWithPhoneNumber(getFirebaseAuth(), phoneE164, verifier);
  } catch (error) {
    // A failed send can leave reCAPTCHA in a stuck state — rebuild it next try.
    resetRecaptcha();
    throw error;
  }
}

/**
 * Confirms the OTP the user typed and returns a Firebase ID token.
 * That token is proof-of-phone-ownership the server bridge will verify.
 */
export async function confirmOtp(
  confirmation: ConfirmationResult,
  code: string,
): Promise<string> {
  const credential = await confirmation.confirm(code);
  return credential.user.getIdToken();
}

export type { ConfirmationResult };

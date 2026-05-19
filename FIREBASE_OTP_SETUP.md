# Phone + OTP Login via Firebase — Setup Guide (2026)

This project's identity/session/role system is **Appwrite**. Firebase is used **only** to
verify that a person controls a phone number (send + check the OTP). A small in-repo
**TanStack Start server function** then validates Firebase's token and mints an **Appwrite
session**, so every existing dashboard, role check, and booking flow keeps working unchanged.

```
User → enters phone → Firebase sends SMS OTP → user enters OTP
     → Firebase returns an ID token (proof the phone is verified)
     → our server fn verifies that token with Google + creates/looks up the
       Appwrite user by phone + returns an Appwrite session token
     → browser exchanges it for an Appwrite session → logged in (roles intact)
```

Phone+OTP is added as the **primary** login method. Google sign-in and email/password
are kept as secondary options on both the member (`/members`) and host/admin (`/auth`) pages.

---

## PART 1 — What YOU must do (Firebase console, ~20 min)

> **Console layout note (2026 redesign).** The Firebase console is now a flat product
> list in the **left sidebar** (no more big "Build / Release" accordion groups), with a
> **"Search Firebase" box at the very top** of every page. Google reshuffles labels
> often, so each step below names the *feature* and the reliable path — if a path differs
> in your console, type the feature name (e.g. "Authentication", "App Check", "Usage and
> billing") into that top search box and it will jump you straight there.

### 1. Create / pick a Firebase project
1. Go to <https://console.firebase.google.com>.
2. Click **Create a project** (or **Add project**), or open an existing one. Name it
   (e.g. `coolpool`).
3. The wizard asks about **Gemini in Firebase** and **Google Analytics** — both are
   optional for this; you can skip/decline them.

### 2. Upgrade to the Blaze plan (required in 2026)
Phone Authentication SMS is **not** available on the free Spark plan anymore.
- Click the **plan badge / "Upgrade"** button at the **bottom of the left sidebar**
  (it shows your current "Spark" plan). *Alternative path:* gear **⚙ next to "Project
  Overview" → Project settings → "Usage and billing" tab → "Details & settings" →
  "Modify plan".*
- In the dialog choose **Blaze – Pay as you go** → **Continue** → select or create a
  **Cloud Billing account** → **Confirm**.
- Still in **Usage and billing → Details & settings**, set a **Budget alert**
  (e.g. $10/month) so runaway SMS usage notifies you.

### 3. Enable Phone authentication
1. Left sidebar → **Build** group → **Authentication** (or search "Authentication").
2. First time only: click **Get started**.
3. Open the **Sign-in method** tab → **Add new provider** (newer console) → choose
   **Phone** → toggle **Enable** → **Save**.

### 4. Add test phone numbers (avoid burning real SMS while developing)
1. Authentication → **Settings** tab → expand the **Phone numbers for testing**
   panel (collapsed accordion near the bottom).
2. Add e.g. `+91 99999 99999` with a fixed code like `123456` → **Add**.
   Logging in with that exact number during dev accepts `123456` without sending SMS.

### 5. Register a Web app and copy the config
1. Gear **⚙ next to "Project Overview"** (top-left) → **Project settings**.
2. Stay on the **General** tab → scroll to **Your apps** → click the **web icon
   `</>`** ("Add app" if none exist yet).
3. Give it a nickname (e.g. `coolpool-web`) → **Register app**.
   **Do NOT** enable Firebase Hosting — skip that screen.
4. The **"Add Firebase SDK"** screen shows a `firebaseConfig` object. Copy:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`
   - (`messagingSenderId` not needed)

   You can reopen this anytime: **Project settings → General → Your apps → SDK setup
   and configuration → Config**.

### 6. Authorize your domains
Authentication → **Settings** tab → **Authorized domains** section → **Add domain**:
- `localhost` (local dev — usually present by default)
- your production domain (e.g. `coolpool.in`)
- any preview/staging domains you use

> Web phone auth needs reCAPTCHA. New projects get **reCAPTCHA Enterprise wired up
> automatically** (no key to copy) — it stays invisible unless Google escalates to a
> challenge. The only common gotcha is a **missing authorized domain** above, which
> surfaces as `auth/captcha-check-failed` or `auth/invalid-app-credential`.

### 7. (Recommended) Enable App Check before production
1. Left sidebar → **App Check** (under the **Build**/**Release & Monitor** area, or
   search "App Check").
2. **Apps** tab → select your **web app** → **Register** with the
   **reCAPTCHA Enterprise** provider (reCAPTCHA v3 also works).
3. Under **APIs**, set **Authentication** enforcement to **Monitor** first, then
   **Enforce** once your traffic looks clean.

This stops bots from draining your paid SMS quota. Optional for the first local test,
but do it before you go live.

---

## PART 2 — Environment variables (paste into `.env`)

Placeholders are already added to `.env` (see the `# --- Firebase Phone OTP ---` block).
Fill them with the values from step 5:

```
# Browser (Vite) — safe to expose; these are public Firebase web keys
VITE_FIREBASE_API_KEY="AIza...your web apiKey..."
VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef..."

# Server-only — used by the bridge to validate the Firebase token.
# This is the SAME value as VITE_FIREBASE_API_KEY (Firebase Web API key).
FIREBASE_WEB_API_KEY="AIza...same web apiKey..."
```

Notes:
- The Firebase Web `apiKey` is **not a secret** — it only identifies the project; it is
  meant to ship in browser bundles. Security comes from authorized domains + App Check.
- `APPWRITE_API_KEY` (already in `.env`) is reused by the server bridge to mint sessions.
  Keep that one secret — it is server-only and never bundled for the browser.

---

## PART 3 — What the code does (already implemented for you)

| File | Role |
|---|---|
| `src/integrations/firebase/client.ts` | Initializes Firebase, invisible reCAPTCHA, `sendOtp`, `confirmOtp`. |
| `src/integrations/firebase/bridge.ts` | `createServerFn` whose handler runs server-side only: verifies the Firebase ID token via Google Identity Toolkit, finds/creates the Appwrite user by phone, returns an Appwrite session token. |
| `src/hooks/useAuth.tsx` | New `sendPhoneOtp(phone)` / `verifyPhoneOtp(code)` driving the full flow. |
| `src/routes/auth.tsx`, `src/routes/members.tsx` | New primary **Phone** tab (phone → OTP), Google + email/password kept as secondary. |

Phone numbers are normalized to **E.164** (e.g. `+919876543210`). The login form defaults
to the `+91` (India) country code; users can edit the prefix for other countries.

---

## PART 4 — Test it

1. `npm run dev`.
2. Open `/members` (passenger) or `/auth` (host/admin).
3. The **Phone** tab is selected by default. Enter the **test number** from step 4
   (e.g. `+919999999999`) → **Send OTP** → enter the fixed code (`123456`) → logged in.
4. For a real number, a real SMS is sent (Blaze billing applies — typically well under
   ₹1 / $0.01 per SMS depending on provider/region).

### Common errors
| Message | Fix |
|---|---|
| `auth/billing-not-enabled` | Blaze plan not active (Part 1 step 2). |
| `auth/captcha-check-failed` / `auth/invalid-app-credential` | Domain not in Authorized domains (step 6). |
| `auth/too-many-requests` | Rate-limited; use a test number while developing. |
| `auth/invalid-phone-number` | Number not in E.164 (must be `+<country><number>`). |
| Bridge "Phone not verified" | Firebase token had no phone claim — re-run the OTP step. |

---

## Security model (why this is safe)

- The browser can never create an Appwrite session on its own from a phone number —
  it only ever gets one **after** the server function has independently verified the
  Firebase ID token with Google. A forged/guessed phone number alone is useless.
- The Appwrite admin API key stays server-side (Cloudflare Worker / server fn runtime),
  never shipped to the browser.
- Add Firebase **App Check** (Part 1 step 7) before production to stop SMS-quota abuse.

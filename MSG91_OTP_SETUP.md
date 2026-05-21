# Phone OTP — MSG91 setup

Coolpool uses **MSG91** for SMS OTP login on `/auth` (hosts/admins) and
`/members` (travelers). MSG91 generates, delivers, expires and verifies the
code — the app never sees or stores it.

## How it works

1. Browser calls the server function `sendMsg91Otp(phone)` → MSG91 sends an SMS.
2. User types the 4-digit code; browser calls `verifyMsg91Otp(phone, code)`.
3. On success, the server finds/creates the Appwrite user for that phone and
   mints a short-lived session token; the browser swaps it for a real session.

The MSG91 auth key lives **only on the server** — never in the browser bundle.

## One-time MSG91 setup

1. Create an MSG91 account → <https://msg91.com>.
2. Copy your **Auth Key** (MSG91 panel → top-right profile → *Auth Key*).
3. Complete **DLT registration** (mandatory for India): MSG91 onboards your
   Principal Entity, **Sender ID** (6 characters, e.g. `CLPOOL`), and the OTP
   message template on the telecom DLT portal. This usually takes 1–2 business
   days.
4. In the MSG91 panel, create an **OTP template** whose body contains the
   `##OTP##` variable, registered for a **4-digit** code. Copy its **Template ID**.

## Environment variables

Add these to `.env` (server-only — do **not** add a `VITE_` prefix):

```
MSG91_AUTH_KEY="..."
MSG91_TEMPLATE_ID="..."
MSG91_SENDER_ID="CLPOOL"
```

`MSG91_SENDER_ID` is optional but recommended. Restart the dev server after
editing `.env`.

## Important notes

- **DLT is mandatory** — MSG91 cannot deliver OTP SMS to +91 numbers until your
  DLT entity, Sender ID, and OTP template are all approved.
- The OTP template must be registered for a **4-digit** code, matching the app.
  The code length and expiry are set in `src/integrations/msg91/otp.ts`
  (`OTP_LENGTH`, `OTP_EXPIRY_MINUTES` — currently 4 digits, 5 minutes). If you
  change the length, also update the `InputOTP` boxes in
  `src/components/PhoneOtpLogin.tsx`.
- MSG91 expects the mobile number with country code and **no `+`**
  (e.g. `919876543210`) — the server strips the `+` automatically.

## Relevant code

- `src/integrations/msg91/otp.ts` — server functions `sendMsg91Otp` / `verifyMsg91Otp`
- `src/hooks/useAuth.tsx` — `sendPhoneOtp` / `verifyPhoneOtp`
- `src/components/PhoneOtpLogin.tsx` — shared OTP UI

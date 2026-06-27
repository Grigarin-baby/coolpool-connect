#!/usr/bin/env node
// Creates the `coolpool_otp_codes` Appwrite collection used to store
// short-lived SMS OTPs (signup verification + password reset) sent via
// PowersText. Idempotent: safe to re-run.
//
// Run with:  node --env-file=.env scripts/create-otp-codes-collection.mjs

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const collectionId =
  process.env.VITE_APPWRITE_COLLECTION_OTP_CODES || "coolpool_otp_codes";

for (const [k, v] of Object.entries({
  VITE_APPWRITE_ENDPOINT: endpoint,
  VITE_APPWRITE_PROJECT_ID: projectId,
  APPWRITE_API_KEY: apiKey,
  VITE_APPWRITE_DATABASE_ID: databaseId,
})) {
  if (!v) {
    console.error(`Missing ${k} in environment (.env).`);
    process.exit(1);
  }
}

const base = endpoint.replace(/\/$/, "");
const headers = {
  "Content-Type": "application/json",
  "X-Appwrite-Project": projectId,
  "X-Appwrite-Key": apiKey,
};

async function api(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

function okOrExists(r, label) {
  if (r.ok) {
    console.log(`  ✓ ${label}`);
    return true;
  }
  if (r.status === 409) {
    console.log(`  • ${label} already exists — skipping`);
    return true;
  }
  console.error(`  ✗ ${label} failed (${r.status}):`, r.json?.message || r.json);
  return false;
}

async function main() {
  console.log(`Target: ${base}  db=${databaseId}  collection=${collectionId}\n`);

  console.log("1) Collection");
  const col = await api("POST", `/databases/${databaseId}/collections`, {
    collectionId,
    name: "Coolpool OTP Codes",
    // Server (admin key) only — no client read/write. The browser never sees
    // these documents; it only calls the createServerFn wrappers.
    permissions: [],
    documentSecurity: false,
  });
  if (!okOrExists(col, "create collection")) process.exit(1);

  console.log("2) Attributes");
  const attrs = [
    ["string", "phone", { key: "phone", size: 32, required: true }],
    ["string", "code", { key: "code", size: 16, required: true }],
    ["string", "purpose", { key: "purpose", size: 32, required: true }],
    ["datetime", "expires_at", { key: "expires_at", required: true }],
    ["integer", "attempts", { key: "attempts", required: false, default: 0 }],
  ];
  for (const [type, label, body] of attrs) {
    const r = await api(
      "POST",
      `/databases/${databaseId}/collections/${collectionId}/attributes/${type}`,
      body,
    );
    okOrExists(r, `attribute ${label} (${type})`);
  }

  console.log("\nDone. Set this in your .env if not already present:");
  console.log(`VITE_APPWRITE_COLLECTION_OTP_CODES="${collectionId}"`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

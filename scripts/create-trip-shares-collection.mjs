#!/usr/bin/env node
// Creates the `coolpool_trip_shares` Appwrite collection used by the public
// "Track Ride" safety links. Idempotent: safe to re-run.
//
// Run with:  node --env-file=.env scripts/create-trip-shares-collection.mjs

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const collectionId =
  process.env.VITE_APPWRITE_COLLECTION_TRIP_SHARES || "coolpool_trip_shares";

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

// Treat "already exists" (409) as success so the script is idempotent.
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

async function waitForAttribute(key) {
  for (let i = 0; i < 20; i++) {
    const r = await api(
      "GET",
      `/databases/${databaseId}/collections/${collectionId}/attributes/${key}`,
    );
    if (r.ok && r.json.status === "available") return true;
    await new Promise((res) => setTimeout(res, 500));
  }
  return false;
}

async function main() {
  console.log(`Target: ${base}  db=${databaseId}  collection=${collectionId}\n`);

  console.log("1) Collection");
  const col = await api("POST", `/databases/${databaseId}/collections`, {
    collectionId,
    name: "Coolpool Trip Shares",
    // Public read (the unauthenticated /track page lists by token), logged-in
    // travelers/hosts can create. No PII stored here.
    permissions: ['read("any")', 'create("users")'],
    documentSecurity: true,
  });
  if (!okOrExists(col, "create collection")) process.exit(1);

  console.log("2) Attributes");
  const attrs = [
    ["string", "token", { key: "token", size: 64, required: true }],
    ["string", "trip_id", { key: "trip_id", size: 64, required: true }],
    ["string", "role", { key: "role", size: 16, required: true }],
    ["string", "booking_id", { key: "booking_id", size: 64, required: false }],
    ["datetime", "expires_at", { key: "expires_at", required: false }],
    ["boolean", "revoked", { key: "revoked", required: false, default: false }],
  ];
  for (const [type, label, body] of attrs) {
    const r = await api(
      "POST",
      `/databases/${databaseId}/collections/${collectionId}/attributes/${type}`,
      body,
    );
    okOrExists(r, `attribute ${label} (${type})`);
  }

  console.log("3) Index on token");
  if (await waitForAttribute("token")) {
    const idx = await api(
      "POST",
      `/databases/${databaseId}/collections/${collectionId}/indexes`,
      { key: "token_idx", type: "key", attributes: ["token"], orders: ["ASC"] },
    );
    okOrExists(idx, "index token_idx");
  } else {
    console.error("  ✗ token attribute not ready in time — create the index manually later.");
  }

  console.log("\nDone. Set this in your .env if not already present:");
  console.log(`VITE_APPWRITE_COLLECTION_TRIP_SHARES="${collectionId}"`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

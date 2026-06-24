#!/usr/bin/env node
// One-time migration: grant public read on existing CAR PHOTOS and HOST PROFILE
// PHOTOS so they render on public pages (ride details, result cards). Sensitive
// KYC docs (RC/insurance) are NOT touched — they stay private.
// Idempotent; safe to re-run.
//
//   node --env-file=.env scripts/make-photos-public.mjs

const base = process.env.VITE_APPWRITE_ENDPOINT.replace(/\/$/, "");
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const bucketId = process.env.VITE_APPWRITE_DRIVER_DOCS_BUCKET_ID;
const vehiclesCol = process.env.VITE_APPWRITE_COLLECTION_VEHICLES;
const driversCol = process.env.VITE_APPWRITE_COLLECTION_DRIVERS;

const headers = {
  "Content-Type": "application/json",
  "X-Appwrite-Project": projectId,
  "X-Appwrite-Key": apiKey,
};

async function api(method, path, body) {
  // Retry transient network failures (this environment's outbound is flaky).
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json;
      try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
      return { ok: res.ok, status: res.status, json };
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function listAll(col) {
  const docs = [];
  let cursor = null;
  for (let page = 0; page < 50; page++) {
    const queries = [{ method: "limit", values: [100] }];
    if (cursor) queries.push({ method: "cursorAfter", values: [cursor] });
    const qs = queries.map((q) => `queries[]=${encodeURIComponent(JSON.stringify(q))}`).join("&");
    const r = await api("GET", `/databases/${databaseId}/collections/${col}/documents?${qs}`);
    if (!r.ok) throw new Error(`list ${col} failed: ${r.status} ${JSON.stringify(r.json)}`);
    const batch = r.json.documents || [];
    docs.push(...batch);
    if (batch.length < 100) break;
    cursor = batch[batch.length - 1].$id;
  }
  return docs;
}

function fileIdFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const m = url.match(/\/files\/([^/]+)\//);
  return m ? m[1] : null;
}

async function makePublic(fileId) {
  // PUT updates permissions; read(any) added, keeping the file otherwise intact.
  const r = await api("PUT", `/storage/buckets/${bucketId}/files/${fileId}`, {
    permissions: ['read("any")'],
  });
  return r;
}

async function main() {
  for (const [k, v] of Object.entries({ base, projectId, apiKey, databaseId, bucketId, vehiclesCol })) {
    if (!v) { console.error(`Missing ${k} in .env`); process.exit(1); }
  }

  console.log("Collecting public photo file IDs...\n");
  const fileIds = new Set();

  const vehicles = await listAll(vehiclesCol);
  let carCount = 0;
  for (const v of vehicles) {
    if (Array.isArray(v.car_images)) for (const id of v.car_images) { if (id) { fileIds.add(String(id)); carCount++; } }
  }
  console.log(`  car photos: ${carCount}`);

  let photoCount = 0;
  if (driversCol) {
    const drivers = await listAll(driversCol);
    for (const d of drivers) {
      const id = fileIdFromUrl(d.photo_url || d.photoUrl);
      if (id) { fileIds.add(id); photoCount++; }
    }
  }
  console.log(`  profile photos: ${photoCount}`);
  console.log(`  unique files to update: ${fileIds.size}\n`);

  let ok = 0, skip = 0, fail = 0;
  for (const fileId of fileIds) {
    const r = await makePublic(fileId);
    if (r.ok) { ok++; }
    else if (r.status === 404) { skip++; } // file deleted/missing
    else { fail++; console.error(`  ✗ ${fileId}: ${r.status} ${r.json?.message || ""}`); }
  }
  console.log(`\nDone. updated=${ok} missing=${skip} failed=${fail}`);
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });

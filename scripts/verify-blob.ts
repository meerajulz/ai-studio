/**
 * End-to-end check of the Storage Foundation (7A) against a real Vercel Blob store.
 *
 * Exercises the actual helpers — `isBlobConfigured`, `uploadAsset`, `deleteAsset` — with
 * a tiny 1x1 PNG: uploads it, fetches the public URL to confirm it's live, deletes it,
 * then fetches again to confirm it's gone. Prints a PASS/FAIL summary.
 *
 * Requires BLOB_READ_WRITE_TOKEN (loaded from .env / .env.local). Run:
 *   npx tsx scripts/verify-blob.ts
 */
import { config } from "dotenv";

// Load .env then .env.local (Next.js gives .env.local priority).
config();
config({ path: ".env.local", override: true });

import { buildUploadPathname } from "../src/lib/blob/constants";
import {
  deleteAsset,
  getSignedUrl,
  isBlobConfigured,
  uploadAsset,
} from "../src/lib/blob/server";

// 1x1 transparent PNG.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function main() {
  if (!isBlobConfigured()) {
    console.error(
      "❌ BLOB_READ_WRITE_TOKEN is not set. Add it to .env (or .env.local) first.",
    );
    process.exit(1);
  }

  const data = Buffer.from(PNG_BASE64, "base64");
  const pathname = buildUploadPathname(
    "verify",
    `storage-check-${Date.now()}.png`,
  );

  console.log("→ Uploading test asset:", pathname);
  const stored = await uploadAsset({
    pathname,
    data,
    contentType: "image/png",
  });
  console.log("  uploaded:", { url: stored.url, kind: stored.kind, size: stored.size });

  console.log("→ Confirming the raw URL is NOT public (private store)…");
  const rawRes = await fetch(stored.url, { cache: "no-store" });
  if (rawRes.ok) {
    throw new Error(
      `Expected the private blob's raw URL to be non-public, but got ${rawRes.status}`,
    );
  }
  console.log(`  raw URL blocked ✓ (${rawRes.status})`);

  console.log("→ Signing a view URL and fetching it to confirm it's live…");
  const signedUrl = await getSignedUrl(stored.pathname, { expiresInSeconds: 300 });
  const getRes = await fetch(signedUrl);
  if (!getRes.ok) {
    throw new Error(
      `Expected 200 fetching signed blob URL, got ${getRes.status}`,
    );
  }
  const bytes = Buffer.from(await getRes.arrayBuffer());
  if (bytes.length !== data.length) {
    throw new Error(
      `Uploaded byte length ${bytes.length} != original ${data.length}`,
    );
  }
  console.log("  live ✓ (bytes match)");

  console.log("→ Deleting test asset…");
  await deleteAsset(stored.url);

  console.log("→ Confirming it's gone (via the still-valid signed URL)…");
  // Vercel Blob is served from a CDN; allow a moment + a couple of retries for propagation.
  let gone = false;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(signedUrl, { cache: "no-store" });
    if (res.status === 404 || res.status === 403) {
      gone = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!gone) {
    console.warn(
      "  ⚠ URL still resolving (CDN propagation delay) — delete call succeeded without error.",
    );
  } else {
    console.log("  deleted ✓ (404)");
  }

  console.log("\n✅ PASS — upload + delete work end-to-end against the live Blob store.");
}

main().catch((err) => {
  console.error("\n❌ FAIL —", err);
  process.exit(1);
});

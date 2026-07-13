/**
 * End-to-end check of the Upload System (7B) — the MEDIA layer — against the real private
 * Blob store and the real database. Complements scripts/verify-blob.ts (which checks the
 * lower blob layer).
 *
 * It creates throwaway users + a project, then verifies the full asset lifecycle:
 *   ✓ persist an uploaded image + video (metadata → Prisma)
 *   ✓ signed URL generation (private store: raw URL is 403, signed URL serves the bytes)
 *   ✓ list a project's uploads (owner-scoped, each with a fresh signed URL)
 *   ✓ owner authorization (another user can't list / delete / persist into the project)
 *   ✓ delete an uploaded file (blob removed + record removed)
 * Everything it creates is torn down in a `finally`, so the database is left clean.
 *
 * Requires BLOB_READ_WRITE_TOKEN + DATABASE_URL (loaded from .env / .env.local). Run:
 *   npx tsx scripts/verify-uploads.ts
 */
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

import { buildUploadPathname } from "../src/lib/blob/constants";
import {
  deleteAsset,
  isBlobConfigured,
  uploadAsset,
} from "../src/lib/blob/server";
import { prisma } from "../src/lib/db";
import {
  deleteUpload,
  listProjectUploads,
  persistUpload,
} from "../src/lib/media/server";

// 1x1 transparent PNG.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function expectThrows(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch {
    console.log(`  denied ✓ (${label})`);
    return;
  }
  throw new Error(`Expected "${label}" to be denied, but it succeeded.`);
}

async function main() {
  if (!isBlobConfigured()) {
    console.error("❌ BLOB_READ_WRITE_TOKEN is not set. Add it to .env(.local) first.");
    process.exit(1);
  }

  const stamp = Date.now();
  const createdBlobUrls: string[] = [];
  let ownerId: string | undefined;
  let otherId: string | undefined;

  try {
    const owner = await prisma.user.create({
      data: { name: "Verify Owner", email: `verify-owner-${stamp}@example.test` },
    });
    ownerId = owner.id;
    const other = await prisma.user.create({
      data: { name: "Verify Other", email: `verify-other-${stamp}@example.test` },
    });
    otherId = other.id;
    const project = await prisma.project.create({
      data: { userId: owner.id, name: `Verify Project ${stamp}` },
    });
    console.log("→ Created throwaway owner, other user, and project.");

    async function uploadAndPersist(
      filename: string,
      contentType: string,
      data: Buffer,
      dims: { width?: number; height?: number; durationSeconds?: number },
    ) {
      const stored = await uploadAsset({
        pathname: buildUploadPathname(project.id, filename),
        data,
        contentType,
      });
      createdBlobUrls.push(stored.url);
      return persistUpload(owner.id, {
        projectId: project.id,
        pathname: stored.pathname,
        blobUrl: stored.url,
        contentType: stored.contentType,
        size: stored.size,
        originalFilename: filename,
        ...dims,
      });
    }

    console.log("→ Uploading + persisting an image and a video…");
    const image = await uploadAndPersist("verify.png", "image/png", Buffer.from(PNG_BASE64, "base64"), {
      width: 1,
      height: 1,
    });
    const video = await uploadAndPersist(
      "verify.mp4",
      "video/mp4",
      Buffer.from("fake-mp4-bytes-for-verification"),
      { width: 1280, height: 720, durationSeconds: 3 },
    );
    console.log(`  image ${image.type} ✓  ·  video ${video.type} ✓`);
    if (image.type !== "IMAGE" || video.type !== "VIDEO") {
      throw new Error("Media type was not derived correctly from the MIME type.");
    }
    if (video.durationSeconds !== 3 || video.width !== 1280) {
      throw new Error("Video metadata was not persisted.");
    }

    console.log("→ Signed URL: raw private URL is blocked, signed URL serves bytes…");
    const rawRes = await fetch(image.url.replace(/\?.*$/, ""), { cache: "no-store" });
    if (rawRes.ok) throw new Error(`Expected the raw blob URL to be blocked, got ${rawRes.status}`);
    const signedRes = await fetch(image.url);
    if (!signedRes.ok) throw new Error(`Expected 200 from the signed URL, got ${signedRes.status}`);
    console.log(`  raw blocked (${rawRes.status}) ✓  ·  signed serves (200) ✓`);

    console.log("→ Listing the project's uploads (owner-scoped, signed URLs)…");
    const list = await listProjectUploads(owner.id, project.id);
    if (list.length !== 2) throw new Error(`Expected 2 uploads, got ${list.length}`);
    if (!list.every((a) => a.url.includes("?"))) throw new Error("List did not return signed URLs.");
    console.log(`  listed ${list.length} assets with signed URLs ✓`);

    console.log("→ Owner authorization: a different user is denied…");
    await expectThrows("other user lists the project", () => listProjectUploads(other.id, project.id));
    await expectThrows("other user deletes an asset", () => deleteUpload(other.id, image.id));
    await expectThrows("other user persists into the project", () =>
      persistUpload(other.id, {
        projectId: project.id,
        pathname: buildUploadPathname(project.id, "evil.png"),
        blobUrl: "https://example.test/evil.png",
        contentType: "image/png",
        size: 100,
        originalFilename: "evil.png",
      }),
    );

    console.log("→ Deleting both uploads (blob + record)…");
    await deleteUpload(owner.id, image.id);
    await deleteUpload(owner.id, video.id);
    const after = await listProjectUploads(owner.id, project.id);
    if (after.length !== 0) throw new Error(`Expected 0 uploads after delete, got ${after.length}`);
    console.log("  deleted ✓ (project now has 0 uploads)");

    console.log("\n✅ PASS — Upload System works end-to-end against the live Blob store + DB.");
  } finally {
    // Best-effort cleanup so the database + store are left clean.
    if (createdBlobUrls.length) {
      await deleteAsset(createdBlobUrls).catch(() => {});
    }
    if (ownerId) await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
    if (otherId) await prisma.user.delete({ where: { id: otherId } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error("\n❌ FAIL —", err);
  process.exit(1);
});

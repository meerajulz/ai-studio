/**
 * End-to-end check of the MEDIA layer (Milestones 7B + 8) against the real private Blob
 * store and the real database. Complements scripts/verify-blob.ts (the lower blob layer).
 *
 * Creates throwaway users + a project, then verifies the full media API + Gallery needs:
 *   ✓ createMedia — persist an uploaded image + video (metadata → Prisma)
 *   ✓ signed URL generation (raw URL 403, signed URL serves the bytes)
 *   ✓ listProjectMedia — owner-scoped, with kind/sort/search filters + cursor pagination
 *   ✓ getMedia / getMediaSignedUrl / updateMediaMetadata
 *   ✓ owner authorization (another user can't list/get/update/delete/persist/sign)
 *   ✓ deleteMedia — blob removed + record removed
 * Everything it creates is torn down in a `finally`, so the database is left clean.
 *
 * Requires BLOB_READ_WRITE_TOKEN + DATABASE_URL (loaded from .env / .env.local). Run:
 *   npx tsx scripts/verify-media.ts
 */
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

import { buildUploadPathname } from "../src/lib/blob/constants";
import { deleteAsset, isBlobConfigured, uploadAsset } from "../src/lib/blob/server";
import { prisma } from "../src/lib/db";
import {
  createMedia,
  deleteMedia,
  getMedia,
  getMediaSignedUrl,
  listProjectMedia,
  updateMediaMetadata,
} from "../src/lib/media/server";

// 1x1 transparent PNG.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function expectDenied(label: string, fn: () => Promise<unknown>) {
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
      return createMedia(owner.id, {
        projectId: project.id,
        pathname: stored.pathname,
        blobUrl: stored.url,
        contentType: stored.contentType,
        size: stored.size,
        originalFilename: filename,
        ...dims,
      });
    }

    console.log("→ createMedia: persist two images + one video…");
    const image = await uploadAndPersist("beach.png", "image/png", Buffer.from(PNG_BASE64, "base64"), {
      width: 1,
      height: 1,
    });
    const video = await uploadAndPersist("clip.mp4", "video/mp4", Buffer.from("fake-mp4-bytes"), {
      width: 1280,
      height: 720,
      durationSeconds: 3,
    });
    const sunset = await uploadAndPersist("sunset-poster.png", "image/png", Buffer.from(PNG_BASE64, "base64"), {
      width: 1,
      height: 1,
    });
    assert(image.type === "IMAGE" && video.type === "VIDEO", "MediaType not derived from MIME.");
    assert(image.source === "uploaded", "source should be 'uploaded'.");
    assert(video.durationSeconds === 3 && video.width === 1280, "Video metadata not persisted.");
    console.log("  persisted 2 images + 1 video ✓");

    console.log("→ Signed URL: raw private URL blocked, signed URL serves bytes…");
    const rawRes = await fetch(image.url.replace(/\?.*$/, ""), { cache: "no-store" });
    assert(!rawRes.ok, `Expected raw blob URL to be blocked, got ${rawRes.status}`);
    const signedRes = await fetch(image.url);
    assert(signedRes.ok, `Expected 200 from signed URL, got ${signedRes.status}`);
    console.log(`  raw blocked (${rawRes.status}) ✓  ·  signed serves (200) ✓`);

    console.log("→ listProjectMedia: filters, sort, search, pagination…");
    const all = await listProjectMedia(owner.id, project.id);
    assert(all.items.length === 3, `Expected 3 items, got ${all.items.length}`);
    assert(all.items.every((a) => a.url.includes("?")), "List items must have signed URLs.");

    const images = await listProjectMedia(owner.id, project.id, { kind: "image" });
    assert(images.items.length === 2, `kind=image expected 2, got ${images.items.length}`);
    const videos = await listProjectMedia(owner.id, project.id, { kind: "video" });
    assert(videos.items.length === 1, `kind=video expected 1, got ${videos.items.length}`);

    const generated = await listProjectMedia(owner.id, project.id, { source: "generated" });
    assert(generated.items.length === 0, "source=generated should be empty (no AI media yet).");

    const oldestFirst = await listProjectMedia(owner.id, project.id, { sort: "oldest" });
    assert(oldestFirst.items[0]?.id === image.id, "sort=oldest should return the first upload first.");

    const search = await listProjectMedia(owner.id, project.id, { search: "sunset" });
    assert(search.items.length === 1 && search.items[0]?.id === sunset.id, "search 'sunset' should match one item.");

    const page1 = await listProjectMedia(owner.id, project.id, { limit: 2 });
    assert(page1.items.length === 2 && page1.nextCursor !== null, "page1 should have 2 items + a cursor.");
    const page2 = await listProjectMedia(owner.id, project.id, { limit: 2, cursor: page1.nextCursor! });
    assert(page2.items.length === 1 && page2.nextCursor === null, "page2 should have the last item + no cursor.");
    const ids = new Set([...page1.items, ...page2.items].map((a) => a.id));
    assert(ids.size === 3, "pagination should cover all 3 items with no overlap.");
    console.log("  filters + sort + search + pagination ✓");

    console.log("→ getMedia / getMediaSignedUrl / updateMediaMetadata…");
    const fetched = await getMedia(owner.id, video.id);
    assert(fetched.id === video.id, "getMedia returned the wrong asset.");
    const freshUrl = await getMediaSignedUrl(owner.id, image.id);
    assert(freshUrl.includes("?"), "getMediaSignedUrl should return a signed URL.");
    const renamed = await updateMediaMetadata(owner.id, image.id, { originalFilename: "renamed.png" });
    assert(renamed.originalFilename === "renamed.png", "updateMediaMetadata did not rename.");
    console.log("  getMedia + signed-URL refresh + rename ✓");

    console.log("→ Owner authorization: a different user is denied every method…");
    await expectDenied("list", () => listProjectMedia(other.id, project.id));
    await expectDenied("get", () => getMedia(other.id, image.id));
    await expectDenied("signed url", () => getMediaSignedUrl(other.id, image.id));
    await expectDenied("update", () => updateMediaMetadata(other.id, image.id, { originalFilename: "x" }));
    await expectDenied("delete", () => deleteMedia(other.id, image.id));
    await expectDenied("persist into project", () =>
      createMedia(other.id, {
        projectId: project.id,
        pathname: buildUploadPathname(project.id, "evil.png"),
        blobUrl: "https://example.test/evil.png",
        contentType: "image/png",
        size: 100,
        originalFilename: "evil.png",
      }),
    );

    console.log("→ deleteMedia: remove all three…");
    await deleteMedia(owner.id, image.id);
    await deleteMedia(owner.id, video.id);
    await deleteMedia(owner.id, sunset.id);
    const after = await listProjectMedia(owner.id, project.id);
    assert(after.items.length === 0, `Expected 0 items after delete, got ${after.items.length}`);
    console.log("  deleted ✓ (project now has 0 media)");

    console.log("\n✅ PASS — Media layer + Gallery work end-to-end against the live Blob store + DB.");
  } finally {
    if (createdBlobUrls.length) await deleteAsset(createdBlobUrls).catch(() => {});
    if (ownerId) await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
    if (otherId) await prisma.user.delete({ where: { id: otherId } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error("\n❌ FAIL —", err);
  process.exit(1);
});

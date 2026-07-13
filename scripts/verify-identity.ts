/**
 * End-to-end check of the Identity Manager (Milestone 9A) against the real private Blob
 * store and the real database. Complements verify-blob.ts / verify-media.ts.
 *
 * Verifies (all owner-scoped, media via the media layer — never Blob directly):
 *   ✓ Identity CRUD                    ✓ Create from a Gallery selection (mediaIds)
 *   ✓ Training media add/remove/reorder/favorite/role
 *   ✓ Hero Image (auto on first media + explicit set)
 *   ✓ Status transitions DRAFT → ACTIVE → DRAFT; Archive / Restore (→ ACTIVE with media)
 *   ✓ List filters (active default excludes archived; archived; all)
 *   ✓ Owner authorization (another user denied every operation)
 *   ✓ Signed URL loading (hero + training media)   ✓ cross-project media rejected
 *   ✓ Delete (links gone, underlying media untouched)
 * Everything created is torn down in a `finally`.
 *
 * Run: npx tsx scripts/verify-identity.ts
 */
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

import { buildUploadPathname } from "../src/lib/blob/constants";
import { deleteAsset, isBlobConfigured, uploadAsset } from "../src/lib/blob/server";
import { prisma } from "../src/lib/db";
import { createMedia, getMediaByIds } from "../src/lib/media/server";
import {
  addTrainingMedia,
  archiveIdentity,
  createIdentity,
  deleteIdentity,
  getIdentity,
  listIdentities,
  removeTrainingMedia,
  reorderTrainingMedia,
  restoreIdentity,
  setHeroImage,
  setTrainingMediaFavorite,
  setTrainingMediaRole,
} from "../src/lib/identity/server";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
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
    console.error("❌ BLOB_READ_WRITE_TOKEN is not set.");
    process.exit(1);
  }

  const stamp = Date.now();
  const blobUrls: string[] = [];
  let ownerId: string | undefined;
  let otherId: string | undefined;

  try {
    const owner = await prisma.user.create({
      data: { name: "Verify Owner", email: `id-owner-${stamp}@example.test` },
    });
    ownerId = owner.id;
    const other = await prisma.user.create({
      data: { name: "Verify Other", email: `id-other-${stamp}@example.test` },
    });
    otherId = other.id;
    const project = await prisma.project.create({
      data: { userId: owner.id, name: `Verify Project ${stamp}` },
    });
    const project2 = await prisma.project.create({
      data: { userId: owner.id, name: `Other Project ${stamp}` },
    });
    console.log("→ Created owner, other user, and two projects.");

    async function makeMedia(projectId: string, filename: string) {
      const stored = await uploadAsset({
        pathname: buildUploadPathname(projectId, filename),
        data: Buffer.from(PNG_BASE64, "base64"),
        contentType: "image/png",
      });
      blobUrls.push(stored.url);
      return createMedia(owner.id, {
        projectId,
        pathname: stored.pathname,
        blobUrl: stored.url,
        contentType: stored.contentType,
        size: stored.size,
        originalFilename: filename,
        width: 1,
        height: 1,
      });
    }

    const m1 = await makeMedia(project.id, "a.png");
    const m2 = await makeMedia(project.id, "b.png");
    const m3 = await makeMedia(project.id, "c.png");
    const foreign = await makeMedia(project2.id, "foreign.png");
    console.log("→ Uploaded 3 media in project + 1 in a second project.");

    // CRUD + DRAFT
    console.log("→ createIdentity (empty) starts DRAFT…");
    let emma = await createIdentity(owner.id, project.id, { name: "Emma" });
    assert(emma.status === "DRAFT", "New identity should be DRAFT.");
    assert(emma.mediaCount === 0 && emma.heroImageId === null, "Empty identity should have no media/hero.");

    // DRAFT → ACTIVE via first training media; hero auto-set; signed URLs
    console.log("→ addTrainingMedia → DRAFT→ACTIVE, hero auto-set, signed URLs…");
    emma = await addTrainingMedia(owner.id, emma.id, [m1.id, m2.id]);
    assert(emma.status === "ACTIVE", "Adding media should activate.");
    assert(emma.mediaCount === 2, "Should have 2 training media.");
    assert(emma.heroImageId === m1.id, "Hero should auto-set to the first media.");
    assert(!!emma.heroImageUrl && emma.heroImageUrl.includes("?"), "Hero URL should be signed.");
    assert(emma.trainingMedia.every((t) => t.media.url.includes("?")), "Training URLs should be signed.");

    // cross-project media rejected
    console.log("→ cross-project media is rejected…");
    emma = await addTrainingMedia(owner.id, emma.id, [foreign.id]);
    assert(emma.mediaCount === 2, "Media from another project must not be added.");

    // Create from Gallery selection
    console.log("→ createIdentity from a selection (mediaIds)…");
    let duo = await createIdentity(owner.id, project.id, {
      name: "Duo",
      description: "two",
      mediaIds: [m2.id, m3.id],
    });
    assert(duo.status === "ACTIVE" && duo.mediaCount === 2, "Selection create should be ACTIVE w/ 2 media.");
    assert(duo.heroImageId === m2.id, "Hero should be the first selected media.");

    // Hero, favorite, role, reorder
    console.log("→ setHeroImage / favorite / role / reorder…");
    emma = await setHeroImage(owner.id, emma.id, m2.id);
    assert(emma.heroImageId === m2.id, "setHeroImage failed.");
    const firstLink = emma.trainingMedia[0]!;
    emma = await setTrainingMediaFavorite(owner.id, emma.id, firstLink.linkId, true);
    assert(emma.trainingMedia.find((t) => t.linkId === firstLink.linkId)!.isFavorite, "favorite failed.");
    emma = await setTrainingMediaRole(owner.id, emma.id, firstLink.linkId, "PRIMARY");
    assert(emma.trainingMedia.find((t) => t.linkId === firstLink.linkId)!.role === "PRIMARY", "role failed.");
    const reversed = [...emma.trainingMedia].reverse().map((t) => t.linkId);
    emma = await reorderTrainingMedia(owner.id, emma.id, reversed);
    assert(emma.trainingMedia.map((t) => t.linkId).join() === reversed.join(), "reorder failed.");

    // ACTIVE → DRAFT by removing all media
    console.log("→ remove all training media → ACTIVE→DRAFT, hero cleared…");
    for (const t of [...emma.trainingMedia]) {
      emma = await removeTrainingMedia(owner.id, emma.id, t.linkId);
    }
    assert(emma.status === "DRAFT", "Removing all media should return to DRAFT.");
    assert(emma.mediaCount === 0 && emma.heroImageId === null, "Hero should clear when empty.");

    // Archive / Restore (restore → ACTIVE because duo has media)
    console.log("→ archive + restore…");
    duo = await archiveIdentity(owner.id, duo.id);
    assert(duo.status === "ARCHIVED", "archive failed.");
    let activeList = await listIdentities(owner.id, project.id, { status: "active" });
    assert(!activeList.some((i) => i.id === duo.id), "Archived identity must be hidden from 'active'.");
    const archivedList = await listIdentities(owner.id, project.id, { status: "archived" });
    assert(archivedList.some((i) => i.id === duo.id), "Archived filter should show it.");
    duo = await restoreIdentity(owner.id, duo.id);
    assert(duo.status === "ACTIVE", "Restore with media should be ACTIVE.");

    // List "all"
    const all = await listIdentities(owner.id, project.id, { status: "all" });
    assert(all.length === 2, `Expected 2 identities, got ${all.length}`);

    // Owner authorization
    console.log("→ owner authorization: another user denied…");
    await expectDenied("list", () => listIdentities(other.id, project.id));
    await expectDenied("get", () => getIdentity(other.id, emma.id));
    await expectDenied("add media", () => addTrainingMedia(other.id, emma.id, [m1.id]));
    await expectDenied("archive", () => archiveIdentity(other.id, emma.id));
    await expectDenied("delete", () => deleteIdentity(other.id, emma.id));
    await expectDenied("create in project", () =>
      createIdentity(other.id, project.id, { name: "Nope" }),
    );

    // Delete — links gone, media untouched
    console.log("→ delete identity (media survives)…");
    await deleteIdentity(owner.id, duo.id);
    activeList = await listIdentities(owner.id, project.id, { status: "all" });
    assert(!activeList.some((i) => i.id === duo.id), "Deleted identity should be gone.");
    const survivors = await getMediaByIds(owner.id, [m2.id, m3.id]);
    assert(survivors.length === 2, "Underlying media must NOT be deleted with the identity.");

    console.log("\n✅ PASS — Identity Manager works end-to-end against the live Blob store + DB.");
  } finally {
    if (blobUrls.length) await deleteAsset(blobUrls).catch(() => {});
    if (ownerId) await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
    if (otherId) await prisma.user.delete({ where: { id: otherId } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error("\n❌ FAIL —", err);
  process.exit(1);
});

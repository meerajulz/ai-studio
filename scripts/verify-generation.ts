/**
 * End-to-end check of AI generation (Milestone 10 — First Light) against the live Blob store
 * + DB. Two parts:
 *   A. Media union (no provider token needed): a GeneratedMedia persisted via the media layer
 *      shows up in the Gallery as source:"generated", is signable, owner-scoped, deletable.
 *   B. Real Hugging Face generation (needs HF token): prompt → image → Blob → DB → Gallery.
 * Everything created is torn down in a `finally`.
 *
 * Run: npx tsx scripts/verify-generation.ts
 */
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

import { isImageProviderConfigured } from "../src/lib/ai";
import { deleteAsset, isBlobConfigured } from "../src/lib/blob/server";
import { GenerationStatus, MediaType, prisma } from "../src/lib/db";
import { generateImage } from "../src/lib/generation/server";
import {
  createGeneratedMedia,
  deleteMedia,
  getMedia,
  listProjectMedia,
} from "../src/lib/media/server";

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
  let ownerId: string | undefined;
  let otherId: string | undefined;

  try {
    const owner = await prisma.user.create({
      data: { name: "Verify Owner", email: `gen-owner-${stamp}@example.test` },
    });
    ownerId = owner.id;
    const other = await prisma.user.create({
      data: { name: "Verify Other", email: `gen-other-${stamp}@example.test` },
    });
    otherId = other.id;
    const project = await prisma.project.create({
      data: { userId: owner.id, name: `Verify Project ${stamp}` },
    });
    console.log("→ Created owner, other user, and project.");

    // ── Part A — media union (no provider needed) ──────────────────────────
    console.log("\n== Part A: generated media surfaces in the Gallery ==");
    const generation = await prisma.generation.create({
      data: {
        userId: owner.id,
        projectId: project.id,
        type: MediaType.IMAGE,
        prompt: "test",
        provider: "test",
        model: "test",
        status: GenerationStatus.SUCCEEDED,
      },
      select: { id: true },
    });
    const genMedia = await createGeneratedMedia(owner.id, {
      projectId: project.id,
      generationId: generation.id,
      data: Buffer.from(PNG_BASE64, "base64"),
      contentType: "image/png",
      originalFilename: "gen-test.png",
    });
    assert(genMedia.source === "generated", "createGeneratedMedia should be source 'generated'.");

    const generatedOnly = await listProjectMedia(owner.id, project.id, { source: "generated" });
    assert(generatedOnly.items.length === 1, "Generated filter should return 1 item.");
    assert(generatedOnly.items[0]!.source === "generated", "…tagged generated.");
    assert(generatedOnly.items[0]!.url.includes("?"), "…with a signed URL.");

    const all = await listProjectMedia(owner.id, project.id, { source: "all" });
    assert(all.items.some((m) => m.id === genMedia.id), "Gallery (all) should include generated media.");
    const uploadedOnly = await listProjectMedia(owner.id, project.id, { source: "uploaded" });
    assert(!uploadedOnly.items.some((m) => m.id === genMedia.id), "Uploaded filter must exclude generated.");

    const fetched = await getMedia(owner.id, genMedia.id);
    assert(fetched.source === "generated", "getMedia should resolve generated media.");

    console.log("  generated media in Gallery + signed + filters ✓");
    await expectDenied("other lists project", () => listProjectMedia(other.id, project.id));
    await expectDenied("other gets generated media", () => getMedia(other.id, genMedia.id));
    await expectDenied("other deletes generated media", () => deleteMedia(other.id, genMedia.id));

    await deleteMedia(owner.id, genMedia.id);
    const afterDelete = await listProjectMedia(owner.id, project.id, { source: "all" });
    assert(!afterDelete.items.some((m) => m.id === genMedia.id), "Deleted generated media should be gone.");
    const genRow = await prisma.generation.findUnique({ where: { id: generation.id } });
    assert(genRow !== null, "Deleting the media keeps the Generation history row.");
    console.log("  owner authorization + delete (Generation row survives) ✓");

    // ── Part B — real Hugging Face generation ──────────────────────────────
    console.log("\n== Part B: real Hugging Face generation ==");
    if (!isImageProviderConfigured()) {
      console.log("  ⚠ SKIPPED — no HF token (set HUGGINGFACE_API_KEY or HF_TOKEN in .env.local).");
    } else {
      console.log("  generating (this can take 10–40s)…");
      const result = await generateImage(owner.id, project.id, {
        prompt: "a single red apple on a plain white background, studio photo",
      });
      assert(result.media.source === "generated", "Generated asset should be source 'generated'.");
      assert(result.media.url.includes("?"), "Generated asset should have a signed URL.");

      const signed = await fetch(result.media.url);
      assert(signed.ok, `Signed URL should serve the image, got ${signed.status}`);
      const bytes = Buffer.from(await signed.arrayBuffer());
      assert(bytes.length > 1000, "Generated image should be a real (non-trivial) image.");

      const gen = await prisma.generation.findUnique({ where: { id: result.generationId } });
      assert(gen?.status === "SUCCEEDED", "Generation should be SUCCEEDED.");
      assert(gen?.provider === "huggingface" && !!gen?.model, "Generation should record provider + model.");

      const inGallery = await listProjectMedia(owner.id, project.id, { source: "generated" });
      assert(inGallery.items.some((m) => m.id === result.media.id), "Generated image should appear in the Gallery.");
      console.log(`  ✓ generated ${bytes.length} bytes with model ${gen?.model}; in Blob + DB + Gallery`);

      await deleteMedia(owner.id, result.media.id);
    }

    console.log("\n✅ PASS — generation pipeline verified end-to-end against the live Blob store + DB.");
  } finally {
    // Delete any blobs we created (user deletion won't remove external blobs), then the users.
    if (ownerId) {
      const [ups, gens] = await Promise.all([
        prisma.uploadedMedia.findMany({ where: { userId: ownerId }, select: { blobUrl: true } }),
        prisma.generatedMedia.findMany({ where: { userId: ownerId }, select: { blobUrl: true } }),
      ]).catch(() => [[], []] as const);
      const urls = [...ups, ...gens].map((r) => r.blobUrl);
      if (urls.length) await deleteAsset(urls).catch(() => {});
      await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
    }
    if (otherId) await prisma.user.delete({ where: { id: otherId } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error("\n❌ FAIL —", err);
  process.exit(1);
});

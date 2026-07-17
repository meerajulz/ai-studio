/**
 * Identity layer types — the contract feature code depends on. An Identity is a reusable,
 * project-scoped subject (person, character, pet, product, brand, object, …) built from
 * curated **training media** linked out of the media layer. Provider-agnostic (no AI here).
 * See docs/IDENTITIES.md, TRAINING_MEDIA.md.
 */
import type { MediaAsset } from "@/lib/media/types";
import type { MediaKnowledgeSummary } from "@/lib/vision";

export type IdentityStatusValue = "DRAFT" | "ACTIVE" | "ARCHIVED";

/**
 * A minimal, passive snapshot of an identity for generation-time reasoning (Milestone 14).
 * Deliberately light — name/description + a couple of signals, no signed media. The generation
 * layer maps this into the Creative Director's `IdentityContext`.
 */
export type IdentityContextInfo = {
  id: string;
  name: string;
  description: string | null;
  hasHeroImage: boolean;
  trainingMediaCount: number;
};

/**
 * The VISUAL side of an identity (Milestone 15) — signed reference-image URLs a capable provider
 * can use for identity preservation. Prepares the architecture only; the Creative Director never
 * sees this (it reasons in text). LoRA/embeddings/training are explicitly out of scope.
 */
export type IdentityVisualPackage = {
  heroImageUrl: string | null;
  bestPortraitUrl: string | null;
  bestFullBodyUrl: string | null;
  referenceImageUrls: string[];
  metadata: { totalMedia: number };
};

export type TrainingMediaRoleValue =
  | "PRIMARY"
  | "SECONDARY"
  | "VIDEO"
  | "POSE"
  | "STYLE"
  | "OTHER";

export const TRAINING_MEDIA_ROLES: TrainingMediaRoleValue[] = [
  "PRIMARY",
  "SECONDARY",
  "VIDEO",
  "POSE",
  "STYLE",
  "OTHER",
];

/** A row in the Identity list — enough for a card. `heroImageUrl` is signed (or null). */
export type IdentitySummary = {
  id: string;
  name: string;
  description: string | null;
  status: IdentityStatusValue;
  mediaCount: number;
  heroImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** One curated training-media link + the signed `MediaAsset` it points at. */
export type TrainingMediaItem = {
  linkId: string; // IdentityMedia id
  media: MediaAsset; // signed, from the media layer
  position: number;
  isFavorite: boolean;
  role: TrainingMediaRoleValue;
  /** Persisted Vision knowledge summary (Milestone 20); null until the image is analyzed. */
  knowledge: MediaKnowledgeSummary | null;
};

/** Full identity detail for the detail page (Overview + Training Media). */
export type IdentityDetail = {
  id: string;
  name: string;
  description: string | null;
  status: IdentityStatusValue;
  heroImageId: string | null; // = displayImageId
  heroImageUrl: string | null; // signed
  mediaCount: number;
  createdAt: Date;
  updatedAt: Date;
  trainingMedia: TrainingMediaItem[];
};

/** List filter — default "active" shows the working set (DRAFT + ACTIVE, i.e. not archived). */
export type IdentityStatusFilter = "active" | "draft" | "archived" | "all";
export type IdentitySort = "newest" | "oldest" | "name";

export type ListIdentitiesOptions = {
  status?: IdentityStatusFilter;
  search?: string;
  sort?: IdentitySort;
};

export type CreateIdentityInput = {
  name: string;
  description?: string;
  /** Optional media to pre-link (e.g. from a Gallery selection). Owner + project validated. */
  mediaIds?: string[];
};

export type UpdateIdentityInput = {
  name?: string;
  description?: string;
};

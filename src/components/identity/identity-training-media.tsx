"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Plus } from "lucide-react";

import {
  useRemoveTrainingMedia,
  useReorderTrainingMedia,
  useSetHeroImage,
  useSetTrainingMediaFavorite,
  useSetTrainingMediaRole,
} from "@/hooks/use-identities";
import type {
  IdentityDetail,
  TrainingMediaItem,
  TrainingMediaRoleValue,
} from "@/lib/identity/types";
import type { MediaAsset } from "@/lib/media/types";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { MediaViewer } from "@/components/media/media-viewer";
import { TrainingMediaCard } from "./training-media-card";
import { TrainingMediaSelector } from "./training-media-selector";

type IdentityTrainingMediaProps = {
  projectId: string;
  identity: IdentityDetail;
};

/** The Training Media sub-tab: curated media grid + add-from-Gallery + per-link actions. */
export function IdentityTrainingMedia({
  projectId,
  identity,
}: IdentityTrainingMediaProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [viewing, setViewing] = useState<MediaAsset | null>(null);

  const setHeroMut = useSetHeroImage(identity.id);
  const favoriteMut = useSetTrainingMediaFavorite(identity.id);
  const roleMut = useSetTrainingMediaRole(identity.id);
  const removeMut = useRemoveTrainingMedia(identity.id);
  const reorderMut = useReorderTrainingMedia(identity.id);

  const linkedMediaIds = useMemo(
    () => new Set(identity.trainingMedia.map((t) => t.media.id)),
    [identity.trainingMedia],
  );

  async function run(promise: Promise<unknown>, errorMsg: string) {
    try {
      await promise;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : errorMsg);
    }
  }

  function move(item: TrainingMediaItem, direction: "up" | "down") {
    const ids = identity.trainingMedia.map((t) => t.linkId);
    const index = ids.indexOf(item.linkId);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[index], ids[swapWith]] = [ids[swapWith], ids[index]];
    void run(reorderMut.mutateAsync(ids), "Couldn't reorder");
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {identity.mediaCount} training {identity.mediaCount === 1 ? "item" : "items"}
        </p>
        <Button onClick={() => setSelectorOpen(true)}>
          <Plus className="size-4" />
          Add media
        </Button>
      </div>

      {identity.trainingMedia.length === 0 ? (
        <EmptyState
          icon={ImagePlus}
          title="No training media yet"
          description="Add images or videos from the Gallery to represent this identity."
          action={
            <Button onClick={() => setSelectorOpen(true)}>
              <Plus className="size-4" />
              Add media
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {identity.trainingMedia.map((item, index) => (
            <TrainingMediaCard
              key={item.linkId}
              item={item}
              isHero={identity.heroImageId === item.media.id}
              isFirst={index === 0}
              isLast={index === identity.trainingMedia.length - 1}
              onOpen={(it) => setViewing(it.media)}
              onSetHero={(it) =>
                run(setHeroMut.mutateAsync(it.media.id), "Couldn't set Hero Image")
              }
              onToggleFavorite={(it) =>
                run(
                  favoriteMut.mutateAsync({
                    linkId: it.linkId,
                    isFavorite: !it.isFavorite,
                  }),
                  "Couldn't update favorite",
                )
              }
              onSetRole={(it, role: TrainingMediaRoleValue) =>
                run(
                  roleMut.mutateAsync({ linkId: it.linkId, role }),
                  "Couldn't set role",
                )
              }
              onMove={move}
              onRemove={(it) =>
                run(removeMut.mutateAsync(it.linkId), "Couldn't remove media")
              }
            />
          ))}
        </div>
      )}

      <MediaViewer
        media={viewing}
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />

      <TrainingMediaSelector
        projectId={projectId}
        identityId={identity.id}
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        linkedMediaIds={linkedMediaIds}
      />
    </div>
  );
}

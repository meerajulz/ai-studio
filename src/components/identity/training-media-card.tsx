"use client";

import {
  ArrowLeft,
  ArrowRight,
  ImageDown,
  MoreHorizontal,
  Play,
  Star,
  Trash2,
} from "lucide-react";

import {
  TRAINING_MEDIA_ROLES,
  type TrainingMediaItem,
  type TrainingMediaRoleValue,
} from "@/lib/identity/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TrainingMediaCardProps = {
  item: TrainingMediaItem;
  isHero: boolean;
  isFirst: boolean;
  isLast: boolean;
  onOpen: (item: TrainingMediaItem) => void;
  onSetHero: (item: TrainingMediaItem) => void;
  onToggleFavorite: (item: TrainingMediaItem) => void;
  onSetRole: (item: TrainingMediaItem, role: TrainingMediaRoleValue) => void;
  onMove: (item: TrainingMediaItem, direction: "up" | "down") => void;
  onRemove: (item: TrainingMediaItem) => void;
};

/** A training-media tile: media thumbnail + hero/favorite/role/reorder/remove affordances. */
export function TrainingMediaCard({
  item,
  isHero,
  isFirst,
  isLast,
  onOpen,
  onSetHero,
  onToggleFavorite,
  onSetRole,
  onMove,
  onRemove,
}: TrainingMediaCardProps) {
  const { media } = item;
  const isVideo = media.type === "VIDEO";

  return (
    <div className="bg-card group relative overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-label={`Open ${media.originalFilename ?? "media"}`}
        className="bg-muted relative flex aspect-square w-full items-center justify-center overflow-hidden"
      >
        {isVideo ? (
          <>
            <video
              src={`${media.url}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/50 p-2 text-white">
                <Play className="size-5" />
              </span>
            </span>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url}
            alt={media.originalFilename ?? "Training media"}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}

        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <Badge variant="secondary">{media.type}</Badge>
          {isHero ? <Badge>Hero</Badge> : null}
        </div>
      </button>

      {/* Favorite toggle */}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={item.isFavorite ? "Unfavorite" : "Favorite"}
        onClick={() => onToggleFavorite(item)}
        className="absolute right-9 top-2 bg-black/30 text-white hover:bg-black/50 hover:text-white"
      >
        <Star className={cn("size-4", item.isFavorite && "fill-current")} />
      </Button>

      {/* Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Training media actions"
              className="absolute right-2 top-2 bg-black/30 text-white hover:bg-black/50 hover:text-white"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onSetHero(item)} disabled={isHero}>
            <ImageDown className="size-4" />
            Set as Hero Image
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onMove(item, "up")}
            disabled={isFirst}
          >
            <ArrowLeft className="size-4" />
            Move earlier
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onMove(item, "down")}
            disabled={isLast}
          >
            <ArrowRight className="size-4" />
            Move later
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onRemove(item)}>
            <Trash2 className="size-4" />
            Remove from identity
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center gap-2 p-2">
        <Select
          value={item.role}
          onValueChange={(value) =>
            onSetRole(item, value as TrainingMediaRoleValue)
          }
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRAINING_MEDIA_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

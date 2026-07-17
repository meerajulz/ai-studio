"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export type PickerImage = {
  mediaId: string;
  url: string;
  analyzed: boolean;
  badges: string[]; // "Anchor" | "Face" | "Body" | "Tattoos" | "Hair" | "Smile"
};

type Props = {
  images: PickerImage[];
  selected: string[]; // ordered media ids
  onChange: (ordered: string[]) => void;
  max: number;
  disabled?: boolean;
};

/**
 * DEV-only manual reference picker (Milestone 20). Pick EXACTLY which analyzed training images are
 * sent — and in what order — to isolate identity drift. The ordered strip is the exact order sent to
 * the provider. Pure UI; only rendered in development.
 */
export function ManualReferencePicker({ images, selected, onChange, max, disabled }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const byId = new Map(images.map((i) => [i.mediaId, i] as const));
  const orderOf = (id: string) => selected.indexOf(id);

  function toggle(id: string) {
    if (disabled) return;
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...selected];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      {selected.length ? (
        <div>
          <p className="text-muted-foreground mb-1 text-xs">
            Sending in this exact order (drag to reorder):
          </p>
          <div className="flex flex-wrap gap-2">
            {selected.map((id, i) => {
              const img = byId.get(id);
              if (!img) return null;
              return (
                <div
                  key={id}
                  draggable={!disabled}
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) reorder(dragIndex, i);
                    setDragIndex(null);
                  }}
                  className={cn("relative w-20 cursor-move", dragIndex === i && "opacity-50")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="size-20 rounded border object-cover" />
                  <span className="bg-primary text-primary-foreground absolute left-1 top-1 rounded px-1 text-[10px]">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white"
                    aria-label="Remove"
                  >
                    <X className="size-3" />
                  </button>
                  {img.badges.length ? (
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {img.badges.map((b) => (
                        <span key={b} className="bg-muted rounded px-1 text-[9px]">
                          {b}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Click thumbnails to pick references (max {max}). The anchor is NOT auto-added in manual mode.
        </p>
      )}

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {images.map((img) => {
          const order = orderOf(img.mediaId);
          return (
            <button
              key={img.mediaId}
              type="button"
              disabled={disabled || !img.analyzed}
              onClick={() => toggle(img.mediaId)}
              title={img.analyzed ? img.badges.join(", ") || "analyzed" : "Not analyzed — Analyze library first"}
              className={cn(
                "relative overflow-hidden rounded border",
                order >= 0 && "ring-primary ring-2",
                !img.analyzed && "opacity-40",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="aspect-square w-full object-cover" />
              {order >= 0 ? (
                <span className="bg-primary text-primary-foreground absolute left-1 top-1 rounded px-1 text-[10px]">
                  {order + 1}
                </span>
              ) : null}
              {!img.analyzed ? (
                <span className="absolute inset-x-0 bottom-0 bg-black/70 text-center text-[9px] text-white">
                  not analyzed
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

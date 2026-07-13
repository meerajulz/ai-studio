"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

import { ALLOWED_MIME_TYPES } from "@/lib/blob/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type UploadDropzoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
};

/** Drag & drop + click-to-browse target. Accepts multiple images and videos. */
export function UploadDropzone({
  onFiles,
  disabled,
  className,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    onFiles(Array.from(fileList));
  }

  return (
    <div
      data-slot="upload-dropzone"
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center transition-colors",
        dragging && "border-primary bg-accent/50",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <UploadCloud className="text-muted-foreground size-8" />
      <div className="grid gap-1">
        <h3 className="text-sm font-medium">Drag & drop media here</h3>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          Images (JPG, PNG, WebP) up to 10 MB · Videos (MP4, MOV, WebM) up to
          200 MB.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Browse files
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_MIME_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
    </div>
  );
}

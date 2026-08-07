"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/constants";

export function ImageDropzone({
  label,
  file,
  onChange,
  accentClass,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  accentClass: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(selected: File | null) {
    setError(null);
    if (!selected) {
      onChange(null);
      setPreview(null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(selected.type)) {
      setError("Use JPG, PNG, or WebP.");
      return;
    }
    if (selected.size > MAX_IMAGE_BYTES) {
      setError("Max file size is 8MB.");
      return;
    }
    onChange(selected);
    setPreview(URL.createObjectURL(selected));
  }

  return (
    <div className="flex-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
          file ? "border-transparent" : "border-border hover:border-muted"
        )}
      >
        {preview ? (
          <Image src={preview} alt={label} fill className="object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted">
            <ImagePlus size={26} />
            <span className="text-sm font-medium">{label}</span>
          </div>
        )}
        {file && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleFile(null);
            }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
          >
            <X size={16} />
          </span>
        )}
        <span className={cn("absolute bottom-0 left-0 right-0 h-1", accentClass)} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {error && <p className="mt-1.5 text-xs text-accent-right">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPost } from "@/lib/actions/posts";
import { useAuth } from "@/components/providers/auth-provider";
import { ImageDropzone } from "./image-dropzone";
import { PillSelect } from "@/components/ui/pill-select";
import { Button } from "@/components/ui/button";
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from "@/lib/constants";
import type { Category } from "@/lib/types";

export function CreatePostForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const { user } = useAuth();

  const [imageLeft, setImageLeft] = useState<File | null>(null);
  const [imageRight, setImageRight] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(imageLeft && imageRight && title.trim()) && !submitting;

  async function uploadImage(file: File): Promise<string> {
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(path, file, { cacheControl: "31536000" });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from("post-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !imageLeft || !imageRight || !user) return;

    setSubmitting(true);
    setError(null);
    try {
      const [imageLeftUrl, imageRightUrl] = await Promise.all([
        uploadImage(imageLeft),
        uploadImage(imageRight),
      ]);

      const { id } = await createPost({
        title: title.trim(),
        description: description.trim() || undefined,
        categoryId,
        imageLeftUrl,
        imageRightUrl,
      });

      router.push(`/post/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">New comparison</h1>
      <p className="mt-1.5 text-sm text-muted">Two options. One question. Let intuition decide.</p>

      <div className="mt-6 flex gap-3">
        <ImageDropzone
          label="Left image"
          file={imageLeft}
          onChange={setImageLeft}
          accentClass="bg-accent-left"
        />
        <ImageDropzone
          label="Right image"
          file={imageRight}
          onChange={setImageRight}
          accentClass="bg-accent-right"
        />
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LENGTH))}
            placeholder="Which one? *"
            required
            className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-[16px] outline-none placeholder:text-muted focus:border-accent"
          />
          <p className="mt-1 text-right text-xs text-muted">
            {title.length}/{MAX_TITLE_LENGTH}
          </p>
        </div>

        <div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
            placeholder="Add context (optional)"
            rows={3}
            className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-[15px] outline-none placeholder:text-muted focus:border-accent"
          />
          <p className="mt-1 text-right text-xs text-muted">
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium text-muted">Category (optional)</h2>
          <PillSelect
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={categoryId}
            onChange={setCategoryId}
          />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-accent-right">{error}</p>}

      <Button type="submit" size="lg" className="mt-8 w-full" disabled={!canSubmit}>
        {submitting ? <Loader2 size={18} className="animate-spin" /> : "Post comparison"}
      </Button>
    </form>
  );
}

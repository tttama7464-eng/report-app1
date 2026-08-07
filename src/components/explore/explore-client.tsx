"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { getExplorePosts } from "@/lib/actions/posts";
import { PostThumbnail } from "./post-thumbnail";
import { cn } from "@/lib/utils";
import type { Category, FeedPost } from "@/lib/types";

type Sort = "trending" | "newest";

export function ExploreClient({
  categories,
  initialPosts,
}: {
  categories: Category[];
  initialPosts: FeedPost[];
}) {
  const [search, setSearch] = useState("");
  const [categorySlug, setCategorySlug] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<Sort>("newest");
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const results = await getExplorePosts({
          search: search || undefined,
          categorySlug,
          sort,
        });
        setPosts(results);
      });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, categorySlug, sort]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <div className="relative">
        <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search comparisons"
          className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-[15px] outline-none placeholder:text-muted focus:border-accent"
        />
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {(["newest", "trending"] as Sort[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors",
              sort === s ? "bg-foreground text-background" : "bg-surface text-muted hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
        <div className="mx-1 w-px shrink-0 self-stretch bg-border" />
        <button
          onClick={() => setCategorySlug(undefined)}
          className={cn(
            "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            !categorySlug ? "bg-foreground text-background" : "bg-surface text-muted hover:text-foreground"
          )}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategorySlug(categorySlug === c.slug ? undefined : c.slug)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              categorySlug === c.slug
                ? "bg-foreground text-background"
                : "bg-surface text-muted hover:text-foreground"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "mt-6 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4 lg:grid-cols-5",
          isPending && "opacity-60 transition-opacity"
        )}
      >
        {posts.map((post) => (
          <PostThumbnail key={post.id} post={post} />
        ))}
      </div>

      {posts.length === 0 && !isPending && (
        <p className="mt-16 text-center text-sm text-muted">No comparisons found.</p>
      )}
    </div>
  );
}

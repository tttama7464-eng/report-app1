"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFeedPosts } from "@/lib/actions/posts";
import { ComparisonCard } from "./comparison-card";
import { FeedEmptyState } from "./feed-empty-state";
import type { FeedPost } from "@/lib/types";

export function Feed({ initialPosts }: { initialPosts: FeedPost[] }) {
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(initialPosts.length === 0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || exhausted) return;
    loadingRef.current = true;
    setLoading(true);

    const cursor = posts.length > 0 ? posts[posts.length - 1]?.createdAt : undefined;
    try {
      const next = await getFeedPosts(cursor, 8);
      if (next.length === 0) {
        setExhausted(true);
      } else {
        setPosts((prev) => [...prev, ...next]);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [posts, exhausted]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "150% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  if (posts.length === 0 && exhausted) {
    return <FeedEmptyState />;
  }

  return (
    <div className="no-scrollbar h-[calc(100dvh-4.25rem)] snap-y-mandatory overflow-y-scroll md:h-[calc(100dvh-4rem)]">
      {posts.map((post, i) => (
        <div key={post.id} className="h-full snap-start">
          <ComparisonCard post={post} />
          {i === posts.length - 3 && <div ref={sentinelRef} />}
        </div>
      ))}
      {loading && (
        <div className="flex h-24 items-center justify-center text-sm text-muted">
          Loading more…
        </div>
      )}
    </div>
  );
}

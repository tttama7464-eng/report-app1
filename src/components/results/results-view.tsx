"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { getPostResults, castVote } from "@/lib/actions/votes";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";
import { ResultsBar } from "./results-bar";
import { FilterPanel } from "./filter-panel";
import type { FeedPost, ResultBreakdown, ResultFilters, VoteChoice } from "@/lib/types";

export function ResultsView({
  post,
  initialResults,
  initialVote,
}: {
  post: FeedPost;
  initialResults: ResultBreakdown;
  initialVote: VoteChoice | null;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [filters, setFilters] = useState<ResultFilters>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [results, setResults] = useState(initialResults);
  const [myVote, setMyVote] = useState(initialVote);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await getPostResults(post.id, filters);
        setResults(r);
      });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, post.id]);

  async function handleVote(choice: VoteChoice) {
    if (myVote) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/post/${post.id}`)}`);
      return;
    }
    setMyVote(choice);
    const result = await castVote(post.id, choice);
    setMyVote(result.choice);
    const r = await getPostResults(post.id, filters);
    setResults(r);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{post.title}</h1>
        {post.description && <p className="mt-1.5 text-muted">{post.description}</p>}
        <div className="mt-2 flex items-center gap-2 text-sm text-muted">
          <span>@{post.username ?? "anonymous"}</span>
          {post.categoryName && (
            <>
              <span>·</span>
              <span>{post.categoryName}</span>
            </>
          )}
        </div>
      </div>

      {!myVote && (
        <p className="mb-2 text-center text-xs text-muted">Tap an image below to cast your vote</p>
      )}

      <div
        className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}
        role="group"
        aria-label="Comparison results"
      >
        {!myVote ? (
          <div className="grid grid-cols-2 gap-3">
            <VoteImage src={post.imageLeftUrl} onClick={() => handleVote("left")} />
            <VoteImage src={post.imageRightUrl} onClick={() => handleVote("right")} />
          </div>
        ) : (
          <ResultsBar
            imageLeftUrl={post.imageLeftUrl}
            imageRightUrl={post.imageRightUrl}
            results={results}
          />
        )}
      </div>

      {myVote && (
        <div className="mt-8">
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            open={filterOpen}
            onToggle={() => setFilterOpen((v) => !v)}
          />
        </div>
      )}
    </div>
  );
}

function VoteImage({ src, onClick }: { src: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative aspect-square w-full overflow-hidden rounded-2xl bg-surface"
    >
      <Image src={src} alt="" fill sizes="50vw" className="object-cover" />
    </button>
  );
}

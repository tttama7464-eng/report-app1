"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart2 } from "lucide-react";
import { castVote } from "@/lib/actions/votes";
import { useAuth } from "@/components/providers/auth-provider";
import { VoteResultOverlay } from "./vote-result-overlay";
import { cn, formatCount } from "@/lib/utils";
import type { FeedPost, VoteChoice } from "@/lib/types";

export function ComparisonCard({ post }: { post: FeedPost }) {
  const router = useRouter();
  const { user } = useAuth();
  const [voted, setVoted] = useState<VoteChoice | null>(null);
  const [counts, setCounts] = useState({ left: post.leftVotes, right: post.rightVotes });
  const [pending, setPending] = useState(false);

  const total = counts.left + counts.right;
  const leftPct = total === 0 ? 50 : Math.round((counts.left / total) * 100);
  const rightPct = 100 - leftPct;

  async function handleVote(choice: VoteChoice) {
    if (voted || pending) return;

    if (!user) {
      router.push(`/login?next=${encodeURIComponent("/")}`);
      return;
    }

    setPending(true);
    setVoted(choice);
    try {
      const result = await castVote(post.id, choice);
      setCounts({ left: result.leftVotes, right: result.rightVotes });
      if (result.alreadyVoted) setVoted(result.choice);
    } catch {
      setVoted(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="relative flex h-full w-full snap-start flex-col">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold leading-tight">{post.title}</h2>
          {post.description && (
            <p className="mt-0.5 truncate text-sm text-muted">{post.description}</p>
          )}
        </div>
        {post.categoryName && (
          <span className="shrink-0 rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted">
            {post.categoryName}
          </span>
        )}
      </div>

      <div className="relative flex-1 grid grid-cols-2 gap-1 px-1">
        <VoteHalf
          side="left"
          imageUrl={post.imageLeftUrl}
          disabled={voted !== null}
          onVote={() => handleVote("left")}
        >
          {voted && <VoteResultOverlay side="left" percent={leftPct} chosen={voted} />}
        </VoteHalf>

        <VoteHalf
          side="right"
          imageUrl={post.imageRightUrl}
          disabled={voted !== null}
          onVote={() => handleVote("right")}
        >
          {voted && <VoteResultOverlay side="right" percent={rightPct} chosen={voted} />}
        </VoteHalf>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-xs font-bold shadow-lg ring-1 ring-border">
            VS
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 text-sm text-muted">
        <span>@{post.username ?? "anonymous"}</span>
        <button
          onClick={() => router.push(`/post/${post.id}`)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:bg-surface hover:text-foreground"
        >
          <BarChart2 size={15} />
          {formatCount(total)} votes
        </button>
      </div>
    </section>
  );
}

function VoteHalf({
  side,
  imageUrl,
  disabled,
  onVote,
  children,
}: {
  side: "left" | "right";
  imageUrl: string;
  disabled: boolean;
  onVote: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onVote}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-surface",
        side === "left" ? "rounded-tr-md" : "rounded-tl-md"
      )}
    >
      <Image
        src={imageUrl}
        alt={`${side} option`}
        fill
        sizes="50vw"
        className="object-cover"
        priority={false}
      />
      <AnimatePresence>{children}</AnimatePresence>
    </motion.button>
  );
}

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FeedEmptyState() {
  return (
    <div className="flex h-[calc(100dvh-4.25rem)] flex-col items-center justify-center gap-4 px-6 text-center md:h-[calc(100dvh-4rem)]">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-muted">
        <Sparkles size={24} />
      </div>
      <div>
        <h2 className="text-lg font-semibold">You&apos;re all caught up</h2>
        <p className="mt-1 text-sm text-muted">
          No new comparisons right now. Be the first to post one.
        </p>
      </div>
      <Link href="/create">
        <Button>Create a comparison</Button>
      </Link>
    </div>
  );
}

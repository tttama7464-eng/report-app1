"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { ResultBreakdown } from "@/lib/types";

export function ResultsBar({
  imageLeftUrl,
  imageRightUrl,
  results,
}: {
  imageLeftUrl: string;
  imageRightUrl: string;
  results: ResultBreakdown;
}) {
  const leftPct = results.total === 0 ? 50 : results.leftPct;
  const rightPct = results.total === 0 ? 50 : results.rightPct;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center">
          <div className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl">
            <Image src={imageLeftUrl} alt="Left option" fill className="object-cover" />
          </div>
          <p className="mt-2 text-2xl font-bold text-accent-left">{leftPct}%</p>
          <p className="text-xs text-muted">{results.leftCount} votes</p>
        </div>
        <div className="text-center">
          <div className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl">
            <Image src={imageRightUrl} alt="Right option" fill className="object-cover" />
          </div>
          <p className="mt-2 text-2xl font-bold text-accent-right">{rightPct}%</p>
          <p className="text-xs text-muted">{results.rightCount} votes</p>
        </div>
      </div>

      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-surface">
        <motion.div
          animate={{ width: `${leftPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="h-full bg-accent-left"
        />
        <motion.div
          animate={{ width: `${rightPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="h-full bg-accent-right"
        />
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        {results.total} {results.total === 1 ? "vote" : "votes"} total
      </p>
    </div>
  );
}

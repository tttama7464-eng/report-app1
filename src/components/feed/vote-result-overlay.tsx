"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { VoteChoice } from "@/lib/types";

export function VoteResultOverlay({
  side,
  percent,
  chosen,
}: {
  side: "left" | "right";
  percent: number;
  chosen: VoteChoice;
}) {
  const isMine = chosen === side;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4"
    >
      <div className="mb-2 flex items-center justify-between text-white">
        <span className="text-2xl font-bold tabular-nums drop-shadow">{percent}%</span>
        {isMine && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              side === "left" ? "bg-accent-left" : "bg-accent-right"
            )}
          >
            Your pick
          </motion.span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className={cn("h-full rounded-full", side === "left" ? "bg-accent-left" : "bg-accent-right")}
        />
      </div>
    </motion.div>
  );
}

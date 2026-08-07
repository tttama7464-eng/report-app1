"use server";

import { createClient } from "@/lib/supabase/server";
import type { ResultBreakdown, ResultFilters, VoteChoice } from "@/lib/types";

export interface CastVoteResult {
  leftVotes: number;
  rightVotes: number;
  choice: VoteChoice;
  alreadyVoted: boolean;
}

export async function castVote(postId: string, choice: VoteChoice): Promise<CastVoteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("cast_vote", { p_post_id: postId, p_choice: choice })
    .single();

  if (error) {
    if (error.message.includes("already_voted") || error.code === "23505") {
      const { data: existing } = await supabase
        .from("votes")
        .select("choice")
        .eq("post_id", postId)
        .maybeSingle();
      const { data: post } = await supabase
        .from("posts")
        .select("left_votes, right_votes")
        .eq("id", postId)
        .single();
      return {
        leftVotes: post?.left_votes ?? 0,
        rightVotes: post?.right_votes ?? 0,
        choice: (existing?.choice as VoteChoice) ?? choice,
        alreadyVoted: true,
      };
    }
    throw new Error(error.message);
  }

  return {
    leftVotes: data!.left_votes,
    rightVotes: data!.right_votes,
    choice: data!.user_choice,
    alreadyVoted: false,
  };
}

export async function getPostResults(
  postId: string,
  filters: ResultFilters = {}
): Promise<ResultBreakdown> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_post_results", {
      p_post_id: postId,
      p_country: filters.country ?? null,
      p_age_group: filters.ageGroup ?? null,
      p_gender: filters.gender ?? null,
      p_occupation: filters.occupation ?? null,
      p_creative_field: filters.creativeField ?? null,
    })
    .single();

  if (error) throw new Error(error.message);

  return {
    leftCount: Number(data!.left_count),
    rightCount: Number(data!.right_count),
    total: Number(data!.total),
    leftPct: Number(data!.left_pct),
    rightPct: Number(data!.right_pct),
  };
}

export async function getMyVoteForPost(postId: string): Promise<VoteChoice | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("votes")
    .select("choice")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  return (data?.choice as VoteChoice) ?? null;
}

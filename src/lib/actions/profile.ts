"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AgeGroup, CreativeField, Gender, Profile, ProfileStats } from "@/lib/types";

function mapProfile(row: {
  id: string;
  username: string | null;
  avatar_url: string | null;
  country: string | null;
  age_group: AgeGroup | null;
  gender: Gender | null;
  occupation: string | null;
  creative_field: CreativeField | null;
  onboarded: boolean;
  created_at: string;
}): Profile {
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url,
    country: row.country,
    ageGroup: row.age_group,
    gender: row.gender,
    occupation: row.occupation,
    creativeField: row.creative_field,
    onboarded: row.onboarded,
    createdAt: row.created_at,
  };
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapProfile(data) : null;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getProfile(user.id);
}

export interface UpdateProfileInput {
  username?: string;
  country?: string | null;
  ageGroup?: AgeGroup | null;
  gender?: Gender | null;
  occupation?: string | null;
  creativeField?: CreativeField | null;
  onboarded?: boolean;
}

export async function updateProfile(input: UpdateProfileInput): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({
      ...(input.username !== undefined ? { username: input.username } : {}),
      country: input.country ?? null,
      age_group: input.ageGroup ?? null,
      gender: input.gender ?? null,
      occupation: input.occupation ?? null,
      creative_field: input.creativeField ?? null,
      ...(input.onboarded !== undefined ? { onboarded: input.onboarded } : {}),
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_profile_stats", { p_user_id: userId })
    .single();

  if (error) throw new Error(error.message);

  return {
    postCount: Number(data!.post_count),
    totalVotesReceived: Number(data!.total_votes_received),
    mostPopularPostId: data!.most_popular_post_id,
  };
}

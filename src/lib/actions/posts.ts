"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Category, FeedPost } from "@/lib/types";

function mapFeedRow(row: {
  id: string;
  title: string;
  description: string | null;
  image_left_url: string;
  image_right_url: string;
  left_votes: number;
  right_votes: number;
  total_votes: number;
  created_at: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  category_id: string | null;
  category_name: string | null;
}): FeedPost {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageLeftUrl: row.image_left_url,
    imageRightUrl: row.image_right_url,
    leftVotes: row.left_votes,
    rightVotes: row.right_votes,
    totalVotes: row.total_votes,
    createdAt: row.created_at,
    userId: row.user_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    categoryId: row.category_id,
    categoryName: row.category_name,
  };
}

export async function getFeedPosts(cursor?: string, limit = 8): Promise<FeedPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_feed_posts", {
    p_limit: limit,
    p_cursor: cursor ?? null,
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFeedRow);
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    sortOrder: c.sort_order,
  }));
}

export async function getPost(postId: string): Promise<FeedPost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, title, description, image_left_url, image_right_url, left_votes, right_votes, total_votes, created_at, user_id, category_id, profiles(username, avatar_url), categories(name)"
    )
    .eq("id", postId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
  const category = Array.isArray(data.categories) ? data.categories[0] : data.categories;

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    imageLeftUrl: data.image_left_url,
    imageRightUrl: data.image_right_url,
    leftVotes: data.left_votes,
    rightVotes: data.right_votes,
    totalVotes: data.total_votes,
    createdAt: data.created_at,
    userId: data.user_id,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    categoryId: data.category_id,
    categoryName: category?.name ?? null,
  };
}

export interface ExploreQuery {
  search?: string;
  categorySlug?: string;
  sort?: "trending" | "newest";
  cursor?: string;
  limit?: number;
}

export async function getExplorePosts({
  search,
  categorySlug,
  sort = "newest",
  cursor,
  limit = 20,
}: ExploreQuery): Promise<FeedPost[]> {
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select(
      "id, title, description, image_left_url, image_right_url, left_votes, right_votes, total_votes, created_at, user_id, category_id, profiles(username, avatar_url), categories!inner(name, slug)"
    );

  if (search) {
    query = query.ilike("title", `%${search}%`);
  }
  if (categorySlug) {
    query = query.eq("categories.slug", categorySlug);
  }

  if (sort === "trending") {
    query = query.order("total_votes", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (cursor) {
    query = sort === "trending"
      ? query.lt("total_votes", Number(cursor))
      : query.lt("created_at", cursor);
  }

  const { data, error } = await query.limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((d) => {
    const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
    const category = Array.isArray(d.categories) ? d.categories[0] : d.categories;
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      imageLeftUrl: d.image_left_url,
      imageRightUrl: d.image_right_url,
      leftVotes: d.left_votes,
      rightVotes: d.right_votes,
      totalVotes: d.total_votes,
      createdAt: d.created_at,
      userId: d.user_id,
      username: profile?.username ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      categoryId: d.category_id,
      categoryName: category?.name ?? null,
    };
  });
}

export async function getUserPosts(userId: string): Promise<FeedPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, title, description, image_left_url, image_right_url, left_votes, right_votes, total_votes, created_at, user_id, category_id, profiles(username, avatar_url), categories(name)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((d) => {
    const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
    const category = Array.isArray(d.categories) ? d.categories[0] : d.categories;
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      imageLeftUrl: d.image_left_url,
      imageRightUrl: d.image_right_url,
      leftVotes: d.left_votes,
      rightVotes: d.right_votes,
      totalVotes: d.total_votes,
      createdAt: d.created_at,
      userId: d.user_id,
      username: profile?.username ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      categoryId: d.category_id,
      categoryName: category?.name ?? null,
    };
  });
}

export interface CreatePostInput {
  title: string;
  description?: string;
  categoryId?: string | null;
  imageLeftUrl: string;
  imageRightUrl: string;
}

export async function createPost(input: CreatePostInput): Promise<{ id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("not_authenticated");

  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      title: input.title,
      description: input.description || null,
      category_id: input.categoryId || null,
      image_left_url: input.imageLeftUrl,
      image_right_url: input.imageRightUrl,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/explore");
  return { id: data.id };
}

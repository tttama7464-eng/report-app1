import { getCategories, getExplorePosts } from "@/lib/actions/posts";
import { ExploreClient } from "@/components/explore/explore-client";

export default async function ExplorePage() {
  const [categories, initialPosts] = await Promise.all([
    getCategories(),
    getExplorePosts({ sort: "newest" }),
  ]);

  return <ExploreClient categories={categories} initialPosts={initialPosts} />;
}

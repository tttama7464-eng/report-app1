import { getFeedPosts } from "@/lib/actions/posts";
import { Feed } from "@/components/feed/feed";

export default async function HomePage() {
  const initialPosts = await getFeedPosts(undefined, 8);
  return <Feed initialPosts={initialPosts} />;
}

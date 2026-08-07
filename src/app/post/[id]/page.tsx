import { notFound } from "next/navigation";
import { getPost } from "@/lib/actions/posts";
import { getMyVoteForPost, getPostResults } from "@/lib/actions/votes";
import { ResultsView } from "@/components/results/results-view";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();

  const [results, myVote] = await Promise.all([
    getPostResults(id),
    getMyVoteForPost(id),
  ]);

  return <ResultsView post={post} initialResults={results} initialVote={myVote} />;
}

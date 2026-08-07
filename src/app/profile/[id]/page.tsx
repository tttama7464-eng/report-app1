import { notFound } from "next/navigation";
import { getCurrentUser, getProfile, getProfileStats } from "@/lib/actions/profile";
import { getUserPosts } from "@/lib/actions/posts";
import { ProfileView } from "@/components/profile/profile-view";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, currentUser] = await Promise.all([getProfile(id), getCurrentUser()]);
  if (!profile) notFound();

  const [stats, posts] = await Promise.all([getProfileStats(id), getUserPosts(id)]);

  return (
    <ProfileView
      profile={profile}
      stats={stats}
      posts={posts}
      isOwnProfile={currentUser?.id === id}
    />
  );
}

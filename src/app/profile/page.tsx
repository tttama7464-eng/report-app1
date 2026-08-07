import { redirect } from "next/navigation";
import { getCurrentUser, getProfile, getProfileStats } from "@/lib/actions/profile";
import { getUserPosts } from "@/lib/actions/posts";
import { ProfileView } from "@/components/profile/profile-view";

export default async function OwnProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  const [profile, stats, posts] = await Promise.all([
    getProfile(user.id),
    getProfileStats(user.id),
    getUserPosts(user.id),
  ]);

  if (!profile) redirect("/onboarding");

  return <ProfileView profile={profile} stats={stats} posts={posts} isOwnProfile />;
}

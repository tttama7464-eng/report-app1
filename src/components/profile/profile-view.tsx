import Link from "next/link";
import Image from "next/image";
import { Award, Pencil, User as UserIcon } from "lucide-react";
import { PostThumbnail } from "@/components/explore/post-thumbnail";
import { formatCount } from "@/lib/utils";
import { AGE_GROUPS, CREATIVE_FIELDS } from "@/lib/constants";
import type { FeedPost, Profile, ProfileStats } from "@/lib/types";

export function ProfileView({
  profile,
  stats,
  posts,
  isOwnProfile,
}: {
  profile: Profile;
  stats: ProfileStats;
  posts: FeedPost[];
  isOwnProfile: boolean;
}) {
  const mostPopular = posts.find((p) => p.id === stats.mostPopularPostId);
  const ageLabel = AGE_GROUPS.find((a) => a.value === profile.ageGroup)?.label;
  const fieldLabel = CREATIVE_FIELDS.find((f) => f.value === profile.creativeField)?.label;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface text-muted">
          {profile.avatarUrl ? (
            <Image src={profile.avatarUrl} alt="" width={64} height={64} className="object-cover" />
          ) : (
            <UserIcon size={28} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">
            @{profile.username ?? "anonymous"}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted">
            {[profile.country, ageLabel, fieldLabel].filter(Boolean).join(" · ") || "No profile details yet"}
          </p>
        </div>
        {isOwnProfile && (
          <Link
            href="/onboarding"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted hover:text-foreground"
          >
            <Pencil size={15} />
          </Link>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <StatCard label="Comparisons posted" value={formatCount(stats.postCount)} />
        <StatCard label="Total votes received" value={formatCount(stats.totalVotesReceived)} />
      </div>

      {mostPopular && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted">
            <Award size={15} />
            Most popular comparison
          </div>
          <div className="max-w-[240px]">
            <PostThumbnail post={mostPopular} />
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-muted">
          {isOwnProfile ? "Your comparisons" : "Comparisons"}
        </h2>
        {posts.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No comparisons posted yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {posts.map((post) => (
              <PostThumbnail key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/50 p-4">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

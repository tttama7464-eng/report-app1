import Link from "next/link";
import Image from "next/image";
import { formatCount } from "@/lib/utils";
import type { FeedPost } from "@/lib/types";

export function PostThumbnail({ post }: { post: FeedPost }) {
  return (
    <Link href={`/post/${post.id}`} className="group block">
      <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl">
        <div className="relative aspect-square">
          <Image
            src={post.imageLeftUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 20vw, 50vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        </div>
        <div className="relative aspect-square">
          <Image
            src={post.imageRightUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 20vw, 50vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        </div>
      </div>
      <p className="mt-1.5 truncate text-sm font-medium">{post.title}</p>
      <p className="text-xs text-muted">{formatCount(post.totalVotes)} votes</p>
    </Link>
  );
}

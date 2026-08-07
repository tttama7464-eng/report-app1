import type { AgeGroup, CreativeField, Gender, VoteChoice } from "./database";

export type { AgeGroup, CreativeField, Gender, VoteChoice };

export interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface Profile {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  country: string | null;
  ageGroup: AgeGroup | null;
  gender: Gender | null;
  occupation: string | null;
  creativeField: CreativeField | null;
  onboarded: boolean;
  createdAt: string;
}

export interface FeedPost {
  id: string;
  title: string;
  description: string | null;
  imageLeftUrl: string;
  imageRightUrl: string;
  leftVotes: number;
  rightVotes: number;
  totalVotes: number;
  createdAt: string;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
}

export interface ResultBreakdown {
  leftCount: number;
  rightCount: number;
  total: number;
  leftPct: number;
  rightPct: number;
}

export interface ResultFilters {
  country?: string;
  ageGroup?: AgeGroup;
  gender?: Gender;
  occupation?: string;
  creativeField?: CreativeField;
}

export interface ProfileStats {
  postCount: number;
  totalVotesReceived: number;
  mostPopularPostId: string | null;
}

import type { AgeGroup, CreativeField, Gender } from "@/lib/types/database";

export const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: "10s", label: "10s" },
  { value: "20s", label: "20s" },
  { value: "30s", label: "30s" },
  { value: "40s", label: "40s" },
  { value: "50s", label: "50s" },
  { value: "60s_plus", label: "60+" },
];

export const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const CREATIVE_FIELDS: { value: CreativeField; label: string }[] = [
  { value: "designer", label: "Designer" },
  { value: "artist", label: "Artist" },
  { value: "musician", label: "Musician" },
  { value: "architect", label: "Architect" },
  { value: "photographer", label: "Photographer" },
  { value: "fashion", label: "Fashion" },
  { value: "student", label: "Student" },
  { value: "other", label: "Other" },
];

// Slugs match supabase/schema.sql seed data.
export const CATEGORY_SLUGS = [
  "fashion",
  "art",
  "logo",
  "photography",
  "interior",
  "food",
  "architecture",
  "other",
] as const;

export const COUNTRIES = [
  "United States", "Japan", "Italy", "France", "Germany", "United Kingdom",
  "South Korea", "China", "Brazil", "Canada", "Australia", "Spain",
  "Netherlands", "Sweden", "India", "Mexico", "Other",
];

export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

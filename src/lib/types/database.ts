// Hand-written mirror of supabase/schema.sql, shaped like the output of
// `supabase gen types typescript` so it satisfies @supabase/supabase-js's
// GenericSchema constraints (Tables/Views/Functions/Enums/CompositeTypes).
// Regenerate with the CLI once the project is linked and this file can be
// replaced wholesale without touching call sites.

export type AgeGroup = "10s" | "20s" | "30s" | "40s" | "50s" | "60s_plus";
export type Gender = "male" | "female" | "other" | "prefer_not_to_say";
export type CreativeField =
  | "designer"
  | "artist"
  | "musician"
  | "architect"
  | "photographer"
  | "fashion"
  | "student"
  | "other";
export type VoteChoice = "left" | "right";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          country: string | null;
          age_group: AgeGroup | null;
          gender: Gender | null;
          occupation: string | null;
          creative_field: CreativeField | null;
          onboarded: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          country?: string | null;
          age_group?: AgeGroup | null;
          gender?: Gender | null;
          occupation?: string | null;
          creative_field?: CreativeField | null;
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          country?: string | null;
          age_group?: AgeGroup | null;
          gender?: Gender | null;
          occupation?: string | null;
          creative_field?: CreativeField | null;
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          title: string;
          description: string | null;
          image_left_url: string;
          image_right_url: string;
          left_votes: number;
          right_votes: number;
          total_votes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          title: string;
          description?: string | null;
          image_left_url: string;
          image_right_url: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          title?: string;
          description?: string | null;
          image_left_url?: string;
          image_right_url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      votes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          choice: VoteChoice;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          choice: VoteChoice;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          choice?: VoteChoice;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "votes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      cast_vote: {
        Args: { p_post_id: string; p_choice: VoteChoice };
        Returns: { left_votes: number; right_votes: number; user_choice: VoteChoice }[];
      };
      get_feed_posts: {
        Args: { p_limit?: number; p_cursor?: string | null };
        Returns: {
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
        }[];
      };
      get_post_results: {
        Args: {
          p_post_id: string;
          p_country?: string | null;
          p_age_group?: AgeGroup | null;
          p_gender?: Gender | null;
          p_occupation?: string | null;
          p_creative_field?: CreativeField | null;
        };
        Returns: {
          left_count: number;
          right_count: number;
          total: number;
          left_pct: number;
          right_pct: number;
        }[];
      };
      get_profile_stats: {
        Args: { p_user_id: string };
        Returns: {
          post_count: number;
          total_votes_received: number;
          most_popular_post_id: string | null;
        }[];
      };
    };
    Enums: {
      age_group: AgeGroup;
      gender_type: Gender;
      creative_field: CreativeField;
      vote_choice: VoteChoice;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

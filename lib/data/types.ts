// Hand-written to match supabase/migrations/ (0001_init.sql, 0002_ratings.sql), shaped like the
// output of `supabase gen types typescript` so it works with
// createClient<Database>(). Keep in sync with every migration.
//
// Postgres -> TS: uuid, text, date, timestamptz -> string; int, smallint, numeric -> number.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          user_id: string;
          /** null = main category */
          parent_id: string | null;
          /** 1-40 chars after trim; unique among active siblings, case-insensitive */
          name: string;
          /** #RRGGBB; subcategories store their parent's color (set by trigger) */
          color: string;
          sort_order: number;
          /** null = active */
          archived_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          parent_id?: string | null;
          name: string;
          color: string;
          sort_order: number;
          archived_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          parent_id?: string | null;
          name?: string;
          color?: string;
          sort_order?: number;
          archived_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_parent_same_user_fkey";
            columns: ["parent_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      entries: {
        Row: {
          user_id: string;
          category_id: string;
          /** YYYY-MM-DD */
          day: string;
          /** 0-24 in 0.25 steps (numeric(4,2)); 0 means delete the row */
          hours: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          category_id: string;
          day: string;
          hours: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          category_id?: string;
          day?: string;
          hours?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entries_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entries_category_same_user_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      ratings: {
        Row: {
          user_id: string;
          /** A main category (parent_id null); enforced by trigger */
          category_id: string;
          /** YYYY-MM-DD */
          day: string;
          /** Integer 0-10 (smallint) */
          score: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          category_id: string;
          day: string;
          score: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          category_id?: string;
          day?: string;
          score?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ratings_category_same_user_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      /** Not executable by anon/authenticated; runs from the auth.users insert trigger. */
      seed_default_categories: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicTables = Database["public"]["Tables"];

export type CategoryRow = PublicTables["categories"]["Row"];
export type CategoryInsert = PublicTables["categories"]["Insert"];
export type CategoryUpdate = PublicTables["categories"]["Update"];

export type EntryRow = PublicTables["entries"]["Row"];
export type EntryInsert = PublicTables["entries"]["Insert"];
export type EntryUpdate = PublicTables["entries"]["Update"];

export type RatingRow = PublicTables["ratings"]["Row"];
export type RatingInsert = PublicTables["ratings"]["Insert"];
export type RatingUpdate = PublicTables["ratings"]["Update"];

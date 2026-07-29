/**
 * Hand-maintained mirror of `supabase/migrations/0001_init.sql`.
 *
 * Once the project exists you can regenerate this file instead of editing it:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 *
 * `total_calories` is a generated column, so it is present on Row but absent
 * from Insert and Update — the database computes it and the client cannot set
 * it. That asymmetry is deliberate and the compiler enforces it.
 */

export type FoodSource = 'search' | 'barcode' | 'photo' | 'manual';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type WeightUnit = 'kg' | 'lb';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          daily_calorie_goal: number;
          weight_unit: WeightUnit;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          daily_calorie_goal?: number;
          weight_unit?: WeightUnit;
        };
        Update: {
          daily_calorie_goal?: number;
          weight_unit?: WeightUnit;
        };
        Relationships: [];
      };
      food_entries: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          brand: string | null;
          calories_per_serving: number;
          serving_quantity: number;
          serving_unit: string;
          total_calories: number;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          source: FoodSource;
          meal_type: MealType | null;
          barcode: string | null;
          image_path: string | null;
          consumed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          brand?: string | null;
          calories_per_serving: number;
          serving_quantity: number;
          serving_unit: string;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          source: FoodSource;
          meal_type?: MealType | null;
          barcode?: string | null;
          image_path?: string | null;
          consumed_at?: string;
        };
        Update: {
          name?: string;
          brand?: string | null;
          calories_per_serving?: number;
          serving_quantity?: number;
          serving_unit?: string;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          meal_type?: MealType | null;
          barcode?: string | null;
          image_path?: string | null;
          consumed_at?: string;
        };
        Relationships: [];
      };
      weight_entries: {
        Row: {
          id: string;
          user_id: string;
          weight_kg: number;
          recorded_on: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          weight_kg: number;
          recorded_on?: string;
        };
        Update: {
          weight_kg?: number;
          recorded_on?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type FoodEntryRow = Database['public']['Tables']['food_entries']['Row'];
export type FoodEntryInsert = Database['public']['Tables']['food_entries']['Insert'];
export type FoodEntryUpdate = Database['public']['Tables']['food_entries']['Update'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type WeightEntryRow = Database['public']['Tables']['weight_entries']['Row'];

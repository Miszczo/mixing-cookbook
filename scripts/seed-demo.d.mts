import type { SupabaseClient } from "@supabase/supabase-js";

export interface DemoSeedCounts {
  daw_profiles: number;
  plugins: number;
  tracks: number;
  track_recipe_progress: number;
  recipes: number;
  listening_notes: number;
}

export function seedDemo(client: SupabaseClient, userId: string): Promise<DemoSeedCounts>;

import { createClient } from '@supabase/supabase-js';

// Supabase configuration with project URL and Publishable / Anon Key
const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://vrujjlytlbjezesupoxq.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_y7TO_O4yXG54m-czqOkvNQ_KlqyVaBN';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Helper to check whether Supabase connection is currently active and reachable
 */
export async function checkSupabaseConnection(): Promise<{ success: boolean; message: string; farmCount?: number }> {
  try {
    const { data, error, count } = await supabase
      .from('Farms')
      .select('*', { count: 'exact', head: false });

    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Connected successfully to Supabase Cloud Database', farmCount: data?.length || 0 };
  } catch (err: any) {
    return { success: false, message: err.message || 'Unknown network error' };
  }
}

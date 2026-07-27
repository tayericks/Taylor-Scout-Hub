import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && anonKey);
export const supabase = configured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export async function fetchShows() {
  if (!configured) return [];
  const { data, error } = await supabase.rpc('list_accessible_shows');
  if (error) throw error;
  return (data || []).map((row) => ({
    ...(row.payload && typeof row.payload === 'object' ? row.payload : {}),
    id: row.show_id,
    name: row.show_name || row.payload?.name || 'Untitled Show',
    role: row.role || 'member',
    updatedAt: row.updated_at,
  }));
}

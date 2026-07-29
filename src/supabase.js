import { createSharedCookieStorage } from './sharedAuthStorage';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && anonKey);
export const supabase = configured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: createSharedCookieStorage() } })
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


export async function submitShowRequest(request) {
  if (!configured) throw new Error('Supabase is not configured.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in.');
  const { data, error } = await supabase.from('show_requests').insert({
    requested_by: user.id,
    requester_email: user.email || null,
    show_name: request.showName.trim(),
    season: request.season.trim() || null,
    production_company: request.company.trim() || null,
    requested_access: request.accessType,
    notes: request.notes.trim() || null,
    status: 'pending'
  }).select().single();
  if (error) throw error;
  return data;
}

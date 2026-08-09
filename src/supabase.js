import { createSharedCookieStorage } from './sharedAuthStorage';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && anonKey);
export const supabase = configured
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: createSharedCookieStorage() } })
  : null;

const legacyPermissions = role => ({
  tools: Object.fromEntries(['hub','budget','bible','calendar','locations','scout-route'].map(tool => [tool, role === 'viewer' ? 'read' : 'write'])),
  location_ids: null,
  episode_ids: null,
  lifecycle: role === 'owner'
});

export async function fetchShows() {
  if (!configured) return [];
  const { data, error } = await supabase.rpc('list_accessible_shows');
  if (error) throw error;
  return (data || []).map((row) => {
    const permissions = row.permissions || legacyPermissions(row.role || 'viewer');
    return {
      ...(row.payload && typeof row.payload === 'object' ? row.payload : {}),
      id: row.show_id,
      name: row.show_name || row.payload?.name || 'Untitled Show',
      role: row.role || 'member',
      canInvite: Boolean(row.can_invite),
      permissions,
      updatedAt: row.updated_at,
    };
  }).filter(show => show.role === 'owner' || ['read','write'].includes(show.permissions?.tools?.hub));
}

export async function listShowMembers(showId) {
  if (!configured) return [];
  const { data, error } = await supabase.rpc('list_show_members', { p_show_id: showId });
  if (error) throw error;
  return (data || []).map(row => ({
    userId: row.user_id,
    email: row.email || '',
    name: row.display_name || row.email || 'Teammate',
    role: row.role,
    status: row.status,
    canInvite: Boolean(row.can_invite),
    permissions: row.permissions || (row.status === 'active' ? legacyPermissions(row.role) : null),
  }));
}

export async function setShowMemberPermissions(showId, userId, permissions) {
  if (!configured) throw new Error('Supabase is not configured.');
  if (!userId) throw new Error('Choose an active teammate first.');
  const { error } = await supabase.rpc('set_show_member_permissions', {
    p_show_id: showId,
    p_user_id: userId,
    p_permissions: permissions,
  });
  if (error) {
    if (error.code === '42883') throw new Error('The Taylor Scout permissions migration has not been installed yet.');
    throw error;
  }
}

export async function getMyShowPermissions(showId) {
  if (!configured) return null;
  const { data, error } = await supabase.rpc('get_my_show_permissions', { p_show_id: showId });
  if (!error) return data;
  if (error.code !== '42883') throw error;
  const { data: role, error: roleError } = await supabase.rpc('show_access_role', { p_show_id: showId });
  if (roleError) throw roleError;
  return legacyPermissions(role || 'viewer');
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

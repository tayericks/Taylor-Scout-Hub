import { createSharedCookieStorage } from './sharedAuthStorage';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && anonKey);
export const supabase = configured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: createSharedCookieStorage()
      }
    })
  : null;

function throwIf(error) {
  if (error) throw error;
}

export async function fetchShows() {
  if (!configured) return [];
  const { data, error } = await supabase.rpc('list_accessible_shows');
  throwIf(error);
  const rows = data || [];
  const showIds = rows.map(row => row.show_id).filter(Boolean);
  let settings = [];
  if (showIds.length) {
    const response = await supabase
      .from('production_settings')
      .select('show_id,production_type,season,production_company,sign_code,logo_url,cover_image_url,theme,preferences')
      .in('show_id', showIds);
    if (!response.error) settings = response.data || [];
  }
  const settingsByShow = new Map(settings.map(row => [row.show_id, row]));
  return rows.map((row) => {
    const legacy = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const production = settingsByShow.get(row.show_id) || {};
    return {
      ...legacy,
      id: row.show_id,
      name: row.show_name || legacy.name || 'Untitled Production',
      role: row.role || 'member',
      updatedAt: row.updated_at,
      productionType: production.production_type || 'episodic',
      season: production.season || legacy.season || '',
      company: production.production_company || legacy.company || '',
      signCode: production.sign_code || '',
      logo: production.logo_url || legacy.logo || '',
      coverImage: production.cover_image_url || '',
      theme: production.theme || null,
      preferences: production.preferences || {}
    };
  });
}

export async function createProduction(input) {
  const units = (input.units || []).map((unit, index) => ({
    id: unit.id || crypto.randomUUID(),
    parent_id: unit.parentId || null,
    kind: unit.kind || 'episode',
    code: unit.code || null,
    name: unit.name || `Unit ${index + 1}`,
    sort_order: index,
    metadata: unit.metadata || {}
  }));
  const { data, error } = await supabase.rpc('create_production_core', {
    p_name: input.name.trim(),
    p_production_type: input.productionType,
    p_season: input.season?.trim() || null,
    p_company: input.company?.trim() || null,
    p_sign_code: input.signCode?.trim() || null,
    p_logo_url: input.logo || null,
    p_theme: input.theme || {},
    p_preferences: input.preferences || {},
    p_units: units
  });
  throwIf(error);

  const invitationResults = await Promise.all((input.invites || []).filter(invite => invite.email?.trim()).map(async invite => {
    const result = await supabase.rpc('invite_show_member', {
      p_show_id: data,
      p_email: invite.email.trim(),
      p_role: invite.role || 'viewer'
    });
    return result.error ? `${invite.email}: ${result.error.message}` : null;
  }));
  const warnings = invitationResults.filter(Boolean);
  return { showId: data, warnings };
}

export async function fetchProductionCore(showId) {
  const [settingsResult, unitsResult, setsResult, setUnitsResult, scenesResult, setScenesResult, locationsResult, locationSetsResult] = await Promise.all([
    supabase.from('production_settings').select('*').eq('show_id', showId).maybeSingle(),
    supabase.from('production_units').select('*').eq('show_id', showId).eq('active', true).order('sort_order').order('name'),
    supabase.from('production_sets').select('*').eq('show_id', showId).order('sort_order').order('name'),
    supabase.from('production_set_units').select('set_id,unit_id').eq('show_id', showId),
    supabase.from('production_scenes').select('*').eq('show_id', showId).order('sort_order').order('scene_number'),
    supabase.from('production_set_scenes').select('set_id,scene_id').eq('show_id', showId),
    supabase.from('production_locations').select('id,location_name,address,city,state,postal_code,area,status,is_final,notes,metadata,updated_at').eq('show_id', showId),
    supabase.from('production_location_sets').select('location_id,set_id,unit_id').eq('show_id', showId)
  ]);
  [settingsResult, unitsResult, setsResult, setUnitsResult, scenesResult, setScenesResult, locationsResult, locationSetsResult].forEach(result => throwIf(result.error));

  const unitIdsBySet = new Map();
  for (const link of setUnitsResult.data || []) {
    const ids = unitIdsBySet.get(link.set_id) || [];
    ids.push(link.unit_id);
    unitIdsBySet.set(link.set_id, ids);
  }
  const scenesById = new Map((scenesResult.data || []).map(scene => [scene.id, scene]));
  const scenesBySet = new Map();
  for (const link of setScenesResult.data || []) {
    const scenes = scenesBySet.get(link.set_id) || [];
    const scene = scenesById.get(link.scene_id);
    if (scene) scenes.push(scene);
    scenesBySet.set(link.set_id, scenes);
  }
  const locationsById = new Map((locationsResult.data || []).map(location => [location.id, location]));
  const selectedLocationsBySet = new Map();
  for (const link of locationSetsResult.data || []) {
    const location = locationsById.get(link.location_id);
    const locked = location?.is_final || String(location?.status || '').toLowerCase() === 'selected';
    if (!location || location.metadata?.archived_at || !locked) continue;
    const linked = selectedLocationsBySet.get(link.set_id) || [];
    if (!linked.some(item => item.id === location.id)) linked.push(location);
    selectedLocationsBySet.set(link.set_id, linked);
  }
  return {
    settings: settingsResult.data,
    units: unitsResult.data || [],
    sets: (setsResult.data || []).map(set => ({
      ...set,
      unitIds: unitIdsBySet.get(set.id) || [],
      scenes: scenesBySet.get(set.id) || [],
      selectedLocations: selectedLocationsBySet.get(set.id) || []
    }))
  };
}

export async function saveProductionSet(showId, record) {
  const { data, error } = await supabase.rpc('save_production_set', {
    p_show_id: showId,
    p_set_id: record.id || null,
    p_name: record.name,
    p_set_number: record.set_number || null,
    p_int_ext: record.int_ext || 'INT',
    p_work_type: record.work_type || 'tbd',
    p_day_night: record.day_night || 'DAY',
    p_page_count: record.page_count === '' || record.page_count == null ? null : Number(record.page_count),
    p_requirements: record.requirements || null,
    p_notes: record.notes || null,
    p_sort_order: Number(record.sort_order || 0),
    p_parent_set_id: record.parent_set_id || null,
    p_unit_ids: record.unitIds || [],
    p_scenes: record.scenes || []
  });
  throwIf(error);
  return data;
}

export async function deleteProductionSet(showId, setId) {
  const { error } = await supabase.rpc('delete_production_set', { p_show_id: showId, p_set_id: setId });
  throwIf(error);
}

export async function reorderProductionSets(showId, setIds) {
  const { error } = await supabase.rpc('reorder_production_sets', { p_show_id: showId, p_set_ids: setIds });
  throwIf(error);
}

export async function updateProductionSettings(showId, patch) {
  const { data, error } = await supabase
    .from('production_settings')
    .update(patch)
    .eq('show_id', showId)
    .select()
    .single();
  throwIf(error);
  return data;
}

export const TOOL_PERMISSION_KEYS = [
  'set_list', 'calendar', 'scout_route', 'location_list',
  'budget', 'bible', 'waypoint', 'wrap_book'
];

export async function fetchShowTeamPermissions(showId) {
  const [membersResult, permissionsResult] = await Promise.all([
    supabase.rpc('list_show_members', { p_show_id: showId }),
    supabase
      .from('show_tool_permissions')
      .select('user_id,tool_key,access_level,scope,job_title')
      .eq('show_id', showId)
  ]);
  throwIf(membersResult.error);
  throwIf(permissionsResult.error);

  const permissionsByUser = new Map();
  for (const permission of permissionsResult.data || []) {
    const values = permissionsByUser.get(permission.user_id) || {};
    values[permission.tool_key] = permission.access_level;
    permissionsByUser.set(permission.user_id, values);
  }

  return (membersResult.data || []).map((member) => {
    const saved = permissionsByUser.get(member.user_id) || {};
    const owner = member.role === 'owner';
    return {
      id: member.user_id || `pending:${member.email}`,
      userId: member.user_id,
      name: member.display_name || member.email || 'Pending teammate',
      email: member.email || '',
      role: member.role || 'viewer',
      status: member.status || 'active',
      permissions: Object.fromEntries(TOOL_PERMISSION_KEYS.map(toolKey => [
        toolKey,
        owner ? 'admin' : (saved[toolKey] || 'view')
      ]))
    };
  });
}

export async function saveShowTeamPermissions(showId, members) {
  const rows = members
    .filter(member => member.userId && member.role !== 'owner' && member.status === 'active')
    .flatMap(member => TOOL_PERMISSION_KEYS.map(toolKey => ({
      show_id: showId,
      user_id: member.userId,
      tool_key: toolKey,
      access_level: member.permissions?.[toolKey] || 'view',
      scope: { type: 'show' }
    })));
  if (!rows.length) return;
  const { error } = await supabase
    .from('show_tool_permissions')
    .upsert(rows, { onConflict: 'show_id,user_id,tool_key' });
  throwIf(error);
}

export async function inviteShowMember(showId, email, role = 'viewer') {
  const { data, error } = await supabase.rpc('invite_show_member', {
    p_show_id: showId,
    p_email: email.trim(),
    p_role: role
  });
  throwIf(error);
  return data;
}

export async function fetchMyToolAccess(showId, toolKey) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  throwIf(userError);
  if (!user) return 'none';
  const { data, error } = await supabase
    .from('show_tool_permissions')
    .select('access_level')
    .eq('show_id', showId)
    .eq('user_id', user.id)
    .eq('tool_key', toolKey)
    .maybeSingle();
  throwIf(error);
  return data?.access_level || 'view';
}

export function subscribeProductionCore(showId, onChange) {
  const tables = [
    'production_settings','production_units','production_sets','production_set_units',
    'production_scenes','production_set_scenes','production_locations','production_location_sets'
  ];
  let channel = supabase.channel(`production-core:${showId}`);
  tables.forEach(table => {
    channel = channel.on('postgres_changes', {
      event: '*', schema: 'public', table, filter: `show_id=eq.${showId}`
    }, onChange);
  });
  channel.subscribe();
  return () => { supabase.removeChannel(channel); };
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
  throwIf(error);
  return data;
}

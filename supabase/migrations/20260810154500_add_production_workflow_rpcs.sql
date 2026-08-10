-- Atomic entry points for the Create Production and Set List workflows.

create or replace function public.create_production_core(
  p_name text,
  p_production_type text,
  p_season text default null,
  p_company text default null,
  p_sign_code text default null,
  p_logo_url text default null,
  p_theme jsonb default '{}'::jsonb,
  p_preferences jsonb default '{}'::jsonb,
  p_units jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_show_id uuid := gen_random_uuid();
  v_payload jsonb;
  v_episodes jsonb;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'Production name is required.';
  end if;
  if p_production_type not in ('episodic','feature','commercial','short_film','music_video','branded','custom') then
    raise exception 'Unsupported production type.';
  end if;
  if jsonb_typeof(coalesce(p_units, '[]'::jsonb)) <> 'array' then
    raise exception 'Production units must be an array.';
  end if;
  if jsonb_typeof(coalesce(p_theme, '{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_preferences, '{}'::jsonb)) <> 'object' then
    raise exception 'Theme and preferences must be objects.';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('id', unit.item->>'id', 'name', unit.item->>'name') order by unit.ordinality)
      filter (where coalesce(unit.item->>'kind', 'episode') = 'episode'),
    '[]'::jsonb
  )
  into v_episodes
  from jsonb_array_elements(coalesce(p_units, '[]'::jsonb)) with ordinality as unit(item, ordinality);

  v_payload := jsonb_build_object(
    'id', v_show_id,
    'name', btrim(p_name),
    'season', coalesce(btrim(p_season), ''),
    'company', coalesce(btrim(p_company), ''),
    'logo', coalesce(p_logo_url, ''),
    'episodes', v_episodes,
    'itineraries', '[]'::jsonb,
    'commonPlaces', '[]'::jsonb,
    'locationLibrary', '[]'::jsonb,
    'productionOffice', '{}'::jsonb
  );

  insert into public.shows (id, user_id, owner_id, name, payload, show_data)
  values (v_show_id, v_user_id, v_user_id, btrim(p_name), v_payload, v_payload);

  insert into public.production_settings (
    show_id, production_type, season, production_company, sign_code, logo_url,
    theme, preferences, created_by, updated_by
  ) values (
    v_show_id, p_production_type, nullif(btrim(p_season), ''), nullif(btrim(p_company), ''),
    nullif(btrim(p_sign_code), ''), nullif(p_logo_url, ''),
    jsonb_build_object(
      'primary', coalesce(nullif(p_theme->>'primary', ''), '#061f33'),
      'secondary', coalesce(nullif(p_theme->>'secondary', ''), '#0b2e46'),
      'accent', coalesce(nullif(p_theme->>'accent', ''), '#2fb5b2'),
      'font', coalesce(nullif(p_theme->>'font', ''), 'Inter')
    ),
    coalesce(p_preferences, '{}'::jsonb), v_user_id, v_user_id
  );

  insert into public.production_units (
    id, show_id, parent_id, kind, code, name, sort_order, metadata, created_by, updated_by
  )
  select
    (unit.item->>'id')::uuid,
    v_show_id,
    nullif(unit.item->>'parent_id', '')::uuid,
    coalesce(nullif(unit.item->>'kind', ''), 'episode'),
    nullif(btrim(unit.item->>'code'), ''),
    coalesce(nullif(btrim(unit.item->>'name'), ''), 'Unit ' || unit.ordinality::text),
    coalesce((unit.item->>'sort_order')::integer, (unit.ordinality - 1)::integer),
    coalesce(unit.item->'metadata', '{}'::jsonb),
    v_user_id,
    v_user_id
  from jsonb_array_elements(coalesce(p_units, '[]'::jsonb)) with ordinality as unit(item, ordinality);

  insert into public.show_tool_permissions (show_id, user_id, tool_key, access_level, job_title, granted_by)
  select v_show_id, v_user_id, tool_key, 'admin', 'Production owner', v_user_id
  from unnest(array[
    'show_setup','set_list','scout_route','location_list','calendar','budget','bible',
    'waypoint','producer_overview','wrap_book'
  ]) as tool_key;

  return v_show_id;
end;
$$;

revoke all on function public.create_production_core(text,text,text,text,text,text,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.create_production_core(text,text,text,text,text,text,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.save_production_set(
  p_show_id uuid,
  p_set_id uuid,
  p_name text,
  p_set_number text,
  p_int_ext text,
  p_work_type text,
  p_day_night text,
  p_page_count numeric,
  p_requirements text,
  p_notes text,
  p_sort_order integer,
  p_parent_set_id uuid,
  p_unit_ids uuid[],
  p_scenes jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_set_id uuid := coalesce(p_set_id, gen_random_uuid());
  v_scene jsonb;
  v_scene_id uuid;
  v_unit_id uuid;
  v_scene_number text;
begin
  if not (
    public.is_show_owner(p_show_id)
    or exists (
      select 1 from public.show_tool_permissions p
      where p.show_id = p_show_id
        and p.user_id = (select auth.uid())
        and p.tool_key = 'set_list'
        and p.access_level in ('edit','admin')
    )
  ) then
    raise exception 'You do not have Set List edit access.';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'Set name is required.';
  end if;

  insert into public.production_sets (
    id, show_id, parent_set_id, set_number, name, int_ext, work_type, day_night,
    page_count, requirements, notes, sort_order
  ) values (
    v_set_id, p_show_id, p_parent_set_id, nullif(btrim(p_set_number), ''), btrim(p_name),
    coalesce(nullif(p_int_ext, ''), 'INT'), coalesce(nullif(p_work_type, ''), 'tbd'),
    coalesce(nullif(p_day_night, ''), 'DAY'), p_page_count,
    nullif(btrim(p_requirements), ''), nullif(btrim(p_notes), ''), coalesce(p_sort_order, 0)
  )
  on conflict (id) do update set
    parent_set_id = excluded.parent_set_id,
    set_number = excluded.set_number,
    name = excluded.name,
    int_ext = excluded.int_ext,
    work_type = excluded.work_type,
    day_night = excluded.day_night,
    page_count = excluded.page_count,
    requirements = excluded.requirements,
    notes = excluded.notes,
    sort_order = excluded.sort_order
  where production_sets.show_id = excluded.show_id;

  delete from public.production_set_units where show_id = p_show_id and set_id = v_set_id;
  insert into public.production_set_units (show_id, set_id, unit_id)
  select p_show_id, v_set_id, unit_id
  from (select distinct unnest(coalesce(p_unit_ids, '{}'::uuid[])) as unit_id) units;

  delete from public.production_set_scenes where show_id = p_show_id and set_id = v_set_id;
  for v_scene in select value from jsonb_array_elements(coalesce(p_scenes, '[]'::jsonb))
  loop
    v_scene_number := nullif(btrim(v_scene->>'scene_number'), '');
    if v_scene_number is null then
      continue;
    end if;
    v_unit_id := nullif(v_scene->>'unit_id', '')::uuid;

    select s.id into v_scene_id
    from public.production_scenes s
    where s.show_id = p_show_id
      and s.scene_number = v_scene_number
      and s.unit_id is not distinct from v_unit_id
    limit 1;

    if v_scene_id is null then
      v_scene_id := gen_random_uuid();
      insert into public.production_scenes (
        id, show_id, unit_id, scene_number, page_count, description, sort_order
      ) values (
        v_scene_id, p_show_id, v_unit_id, v_scene_number,
        nullif(v_scene->>'page_count', '')::numeric,
        nullif(btrim(v_scene->>'description'), ''),
        coalesce((v_scene->>'sort_order')::integer, 0)
      );
    else
      update public.production_scenes set
        page_count = coalesce(nullif(v_scene->>'page_count', '')::numeric, page_count),
        description = coalesce(nullif(btrim(v_scene->>'description'), ''), description),
        sort_order = coalesce((v_scene->>'sort_order')::integer, sort_order)
      where id = v_scene_id and show_id = p_show_id;
    end if;

    insert into public.production_set_scenes (show_id, set_id, scene_id)
    values (p_show_id, v_set_id, v_scene_id)
    on conflict do nothing;
  end loop;

  return v_set_id;
end;
$$;

revoke all on function public.save_production_set(uuid,uuid,text,text,text,text,text,numeric,text,text,integer,uuid,uuid[],jsonb) from public, anon;
grant execute on function public.save_production_set(uuid,uuid,text,text,text,text,text,numeric,text,text,integer,uuid,uuid[],jsonb) to authenticated;

create or replace function public.reorder_production_sets(p_show_id uuid, p_set_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (
    public.is_show_owner(p_show_id)
    or exists (
      select 1 from public.show_tool_permissions p
      where p.show_id = p_show_id
        and p.user_id = (select auth.uid())
        and p.tool_key = 'set_list'
        and p.access_level in ('edit','admin')
    )
  ) then
    raise exception 'You do not have Set List edit access.';
  end if;

  update public.production_sets s
  set sort_order = ordered.ordinality - 1
  from unnest(coalesce(p_set_ids, '{}'::uuid[])) with ordinality as ordered(id, ordinality)
  where s.show_id = p_show_id and s.id = ordered.id;
end;
$$;

revoke all on function public.reorder_production_sets(uuid,uuid[]) from public, anon;
grant execute on function public.reorder_production_sets(uuid,uuid[]) to authenticated;

create or replace function public.delete_production_set(p_show_id uuid, p_set_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (
    public.is_show_owner(p_show_id)
    or exists (
      select 1 from public.show_tool_permissions p
      where p.show_id = p_show_id
        and p.user_id = (select auth.uid())
        and p.tool_key = 'set_list'
        and p.access_level in ('edit','admin')
    )
  ) then
    raise exception 'You do not have Set List edit access.';
  end if;

  update public.production_sets
  set parent_set_id = null
  where show_id = p_show_id and parent_set_id = p_set_id;

  delete from public.production_sets where show_id = p_show_id and id = p_set_id;
end;
$$;

revoke all on function public.delete_production_set(uuid,uuid) from public, anon;
grant execute on function public.delete_production_set(uuid,uuid) to authenticated;

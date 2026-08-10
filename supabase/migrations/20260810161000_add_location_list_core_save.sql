-- Save the canonical location and all of its Set List links in one transaction.

create policy production_locations_tool_insert on public.production_locations for insert to authenticated
  with check (exists (
    select 1 from public.show_tool_permissions p
    where p.show_id = production_locations.show_id
      and p.user_id = (select auth.uid())
      and p.tool_key = 'location_list'
      and p.access_level in ('edit','admin')
  ));

create policy production_locations_tool_update on public.production_locations for update to authenticated
  using (exists (
    select 1 from public.show_tool_permissions p
    where p.show_id = production_locations.show_id
      and p.user_id = (select auth.uid())
      and p.tool_key = 'location_list'
      and p.access_level in ('edit','admin')
  ))
  with check (exists (
    select 1 from public.show_tool_permissions p
    where p.show_id = production_locations.show_id
      and p.user_id = (select auth.uid())
      and p.tool_key = 'location_list'
      and p.access_level in ('edit','admin')
  ));

create policy production_locations_tool_delete on public.production_locations for delete to authenticated
  using (exists (
    select 1 from public.show_tool_permissions p
    where p.show_id = production_locations.show_id
      and p.user_id = (select auth.uid())
      and p.tool_key = 'location_list'
      and p.access_level in ('edit','admin')
  ));

create or replace function public.save_location_list_record(
  p_show_id uuid,
  p_location_id uuid,
  p_record jsonb,
  p_links jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_link jsonb;
  v_set_id uuid;
  v_unit_id uuid;
  v_set_name text := '';
  v_unit_name text := '';
  v_primary_unit_id uuid;
  v_current_metadata jsonb := '{}'::jsonb;
  v_metadata jsonb;
  v_work_type text;
  v_link_count integer := 0;
begin
  if p_location_id is null then
    raise exception 'Location ID is required.';
  end if;
  if not (
    public.is_show_owner(p_show_id)
    or public.can_edit_show(p_show_id)
    or public.can_edit_scout_show(p_show_id)
    or exists (
      select 1 from public.show_tool_permissions p
      where p.show_id = p_show_id
        and p.user_id = (select auth.uid())
        and p.tool_key = 'location_list'
        and p.access_level in ('edit','admin')
    )
  ) then
    raise exception 'You do not have Location List edit access.';
  end if;
  if jsonb_typeof(coalesce(p_record, '{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid Location List save payload.';
  end if;
  if exists (
    select 1 from public.tool_documents d
    where d.show_id = p_show_id and d.tool_key = 'location-tombstone:' || p_location_id::text
  ) then
    raise exception 'This location was permanently deleted and cannot be recreated.';
  end if;

  select coalesce(l.metadata, '{}'::jsonb)
  into v_current_metadata
  from public.production_locations l
  where l.show_id = p_show_id and l.id = p_location_id;

  if v_current_metadata ? 'archived_at' then
    raise exception 'Restore this location before editing it.';
  end if;

  for v_link in select value from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
  loop
    v_set_id := nullif(v_link->>'set_id', '')::uuid;
    v_unit_id := nullif(v_link->>'unit_id', '')::uuid;
    if v_set_id is null then
      continue;
    end if;

    select s.name, s.work_type into v_set_name, v_work_type
    from public.production_sets s
    where s.id = v_set_id and s.show_id = p_show_id;
    if not found then
      raise exception 'A selected set does not belong to this production.';
    end if;
    if v_work_type <> 'location' then
      raise exception 'Only On Location sets can be linked to scouting records.';
    end if;

    if v_unit_id is not null then
      select u.name into v_unit_name
      from public.production_units u
      where u.id = v_unit_id and u.show_id = p_show_id and u.active;
      if not found then
        raise exception 'A selected episode or unit does not belong to this production.';
      end if;
      if exists (select 1 from public.production_set_units su where su.show_id = p_show_id and su.set_id = v_set_id)
        and not exists (select 1 from public.production_set_units su where su.show_id = p_show_id and su.set_id = v_set_id and su.unit_id = v_unit_id) then
        raise exception 'That set is not assigned to the selected episode or unit.';
      end if;
    else
      v_unit_name := '';
    end if;

    v_link_count := v_link_count + 1;
    if v_link_count = 1 then
      v_primary_unit_id := v_unit_id;
    end if;
  end loop;

  -- Re-read the first link so the legacy display columns remain compatible with older tools.
  if v_link_count > 0 then
    select s.name, coalesce(u.name, ''), u.id
    into v_set_name, v_unit_name, v_primary_unit_id
    from (
      select item, ordinality
      from jsonb_array_elements(p_links) with ordinality source(item, ordinality)
      where nullif(item->>'set_id', '') is not null
    ) link
    join public.production_sets s on s.id = (link.item->>'set_id')::uuid and s.show_id = p_show_id
    left join public.production_units u on u.id = nullif(link.item->>'unit_id', '')::uuid and u.show_id = p_show_id
    order by link.ordinality
    limit 1;
  else
    v_set_name := '';
    v_unit_name := '';
    v_primary_unit_id := null;
  end if;

  v_metadata := coalesce(v_current_metadata, '{}'::jsonb)
    || coalesce(p_record->'metadata', '{}'::jsonb)
    || jsonb_build_object('canonical_location_id', p_location_id);

  insert into public.production_locations (
    id, show_id, episode_id, episode_name, set_name, location_name, address, city, state,
    postal_code, area, contact_name, contact_phone, contact_email, scout_name, scout_date,
    status, notes, is_final, source, metadata, created_by, updated_by, updated_at
  ) values (
    p_location_id, p_show_id, v_primary_unit_id::text, nullif(v_unit_name, ''), v_set_name,
    coalesce(nullif(btrim(p_record->>'name'), ''), 'Untitled Location'),
    coalesce(p_record->>'address', ''), coalesce(p_record->>'city', ''), coalesce(p_record->>'state', ''),
    coalesce(p_record->>'zip', ''), coalesce(p_record->>'area', ''), coalesce(p_record->>'contact', ''),
    coalesce(p_record->>'phone', ''), coalesce(p_record->>'email', ''), coalesce(p_record->>'scout', ''),
    nullif(p_record->>'date', '')::date, coalesce(nullif(p_record->>'status', ''), 'Needed'),
    coalesce(p_record->>'notes', ''), coalesce((p_record->>'isFinal')::boolean, false),
    'location_list', v_metadata, (select auth.uid()), (select auth.uid()), now()
  )
  on conflict (id) do update set
    episode_id = excluded.episode_id,
    episode_name = excluded.episode_name,
    set_name = excluded.set_name,
    location_name = excluded.location_name,
    address = excluded.address,
    city = excluded.city,
    state = excluded.state,
    postal_code = excluded.postal_code,
    area = excluded.area,
    contact_name = excluded.contact_name,
    contact_phone = excluded.contact_phone,
    contact_email = excluded.contact_email,
    scout_name = excluded.scout_name,
    scout_date = excluded.scout_date,
    status = excluded.status,
    notes = excluded.notes,
    is_final = excluded.is_final,
    source = excluded.source,
    metadata = excluded.metadata,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  where production_locations.show_id = excluded.show_id;

  delete from public.production_location_sets
  where show_id = p_show_id and location_id = p_location_id;

  insert into public.production_location_sets (show_id, location_id, set_id, unit_id)
  select distinct p_show_id, p_location_id, (link.item->>'set_id')::uuid, nullif(link.item->>'unit_id', '')::uuid
  from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) as link(item)
  where nullif(link.item->>'set_id', '') is not null
  on conflict do nothing;

  return p_location_id;
end;
$$;

revoke all on function public.save_location_list_record(uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.save_location_list_record(uuid,uuid,jsonb,jsonb) to authenticated;

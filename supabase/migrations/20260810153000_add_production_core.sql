-- Taylor Scout production core.
-- Additive only: existing shows, tool payloads, locations, budgets, and Bibles remain untouched.

-- Composite references below guarantee that linked records always belong to the same production.
create unique index if not exists production_locations_id_show_idx
  on public.production_locations(id, show_id);

create table if not exists public.production_settings (
  show_id uuid primary key references public.shows(id) on delete cascade,
  production_type text not null default 'episodic'
    check (production_type in ('episodic','feature','commercial','short_film','music_video','branded','custom')),
  season text,
  production_company text,
  sign_code text,
  logo_url text,
  cover_image_url text,
  theme jsonb not null default '{"primary":"#061f33","secondary":"#0b2e46","accent":"#2fb5b2","font":"Inter"}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_units (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  parent_id uuid,
  kind text not null default 'episode'
    check (kind in ('block','episode','spot','unit','custom')),
  code text,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, show_id),
  foreign key (parent_id, show_id) references public.production_units(id, show_id) on delete cascade
);

create table if not exists public.production_sets (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  parent_set_id uuid,
  set_number text,
  name text not null,
  int_ext text not null default 'INT' check (int_ext in ('INT','EXT','I/E','OTHER')),
  work_type text not null default 'tbd' check (work_type in ('location','stage','tbd')),
  day_night text not null default 'DAY' check (day_night in ('DAY','NIGHT','D/N','OTHER')),
  page_count numeric(8,3),
  requirements text,
  notes text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, show_id),
  foreign key (parent_set_id, show_id) references public.production_sets(id, show_id) on delete restrict
);

create table if not exists public.production_set_units (
  show_id uuid not null references public.shows(id) on delete cascade,
  set_id uuid not null,
  unit_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (set_id, unit_id),
  foreign key (set_id, show_id) references public.production_sets(id, show_id) on delete cascade,
  foreign key (unit_id, show_id) references public.production_units(id, show_id) on delete cascade
);

create table if not exists public.production_scenes (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  unit_id uuid,
  scene_number text not null,
  page_count numeric(8,3),
  description text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, show_id),
  foreign key (unit_id, show_id) references public.production_units(id, show_id) on delete cascade
);

create table if not exists public.production_set_scenes (
  show_id uuid not null references public.shows(id) on delete cascade,
  set_id uuid not null,
  scene_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (set_id, scene_id),
  foreign key (set_id, show_id) references public.production_sets(id, show_id) on delete cascade,
  foreign key (scene_id, show_id) references public.production_scenes(id, show_id) on delete cascade
);

create table if not exists public.production_location_sets (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  location_id uuid not null,
  set_id uuid not null,
  unit_id uuid,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (location_id, show_id) references public.production_locations(id, show_id) on delete cascade,
  foreign key (set_id, show_id) references public.production_sets(id, show_id) on delete cascade,
  foreign key (unit_id, show_id) references public.production_units(id, show_id) on delete set null (unit_id)
);

create table if not exists public.show_tool_permissions (
  show_id uuid not null references public.shows(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_key text not null,
  access_level text not null default 'view' check (access_level in ('none','view','edit','admin')),
  scope jsonb not null default '{"type":"show"}'::jsonb,
  job_title text,
  granted_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (show_id, user_id, tool_key)
);

create table if not exists public.production_imports (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  source_type text not null,
  source_name text not null,
  status text not null default 'review' check (status in ('uploaded','parsing','review','approved','rejected','failed')),
  detected_counts jsonb not null default '{}'::jsonb,
  review_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_documents (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  unit_id uuid,
  set_id uuid,
  location_id uuid,
  document_type text not null,
  source_tool text,
  title text not null,
  storage_path text,
  privacy_level text not null default 'production' check (privacy_level in ('production','locations','producer','financial','private')),
  is_final boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id, show_id) references public.production_units(id, show_id) on delete set null (unit_id),
  foreign key (set_id, show_id) references public.production_sets(id, show_id) on delete set null (set_id),
  foreign key (location_id, show_id) references public.production_locations(id, show_id) on delete set null (location_id)
);

create index if not exists production_units_show_sort_idx on public.production_units(show_id, kind, sort_order);
create unique index if not exists production_units_show_code_idx
  on public.production_units(show_id, kind, lower(code))
  where code is not null and btrim(code) <> '';
create index if not exists production_units_parent_idx on public.production_units(parent_id);
create index if not exists production_sets_show_sort_idx on public.production_sets(show_id, sort_order);
create index if not exists production_sets_parent_idx on public.production_sets(parent_set_id);
create index if not exists production_sets_work_type_idx on public.production_sets(show_id, work_type);
create index if not exists production_set_units_show_unit_idx on public.production_set_units(show_id, unit_id);
create index if not exists production_scenes_show_unit_idx on public.production_scenes(show_id, unit_id, scene_number);
create unique index if not exists production_scenes_identity_idx
  on public.production_scenes(show_id, coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(scene_number));
create index if not exists production_set_scenes_show_scene_idx on public.production_set_scenes(show_id, scene_id);
create index if not exists production_location_sets_show_set_idx on public.production_location_sets(show_id, set_id);
create index if not exists production_location_sets_location_idx on public.production_location_sets(location_id);
create index if not exists production_location_sets_unit_idx on public.production_location_sets(unit_id);
create unique index if not exists production_location_sets_identity_idx
  on public.production_location_sets(location_id, set_id, coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists show_tool_permissions_user_idx on public.show_tool_permissions(user_id, show_id);
create index if not exists production_imports_show_idx on public.production_imports(show_id, created_at desc);
create index if not exists production_documents_show_idx on public.production_documents(show_id, document_type);
create index if not exists production_documents_unit_set_idx on public.production_documents(unit_id, set_id);
create index if not exists production_documents_location_idx on public.production_documents(location_id);

-- Postgres does not index foreign keys automatically. These keep cascades and permission lookups bounded.
create index if not exists production_settings_created_by_idx on public.production_settings(created_by);
create index if not exists production_settings_updated_by_idx on public.production_settings(updated_by);
create index if not exists production_units_created_by_idx on public.production_units(created_by);
create index if not exists production_units_updated_by_idx on public.production_units(updated_by);
create index if not exists production_sets_created_by_idx on public.production_sets(created_by);
create index if not exists production_sets_updated_by_idx on public.production_sets(updated_by);
create index if not exists production_scenes_created_by_idx on public.production_scenes(created_by);
create index if not exists production_scenes_updated_by_idx on public.production_scenes(updated_by);
create index if not exists production_location_sets_created_by_idx on public.production_location_sets(created_by);
create index if not exists show_tool_permissions_granted_by_idx on public.show_tool_permissions(granted_by);
create index if not exists production_imports_created_by_idx on public.production_imports(created_by);
create index if not exists production_documents_created_by_idx on public.production_documents(created_by);
create index if not exists production_documents_updated_by_idx on public.production_documents(updated_by);

-- Keep autosaved records auditable without requiring every client to remember the timestamp.
create or replace function public.set_production_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create or replace function public.set_production_updated_at_without_user()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger production_settings_updated_at before update on public.production_settings
  for each row execute function public.set_production_updated_at();
create trigger production_units_updated_at before update on public.production_units
  for each row execute function public.set_production_updated_at();
create trigger production_sets_updated_at before update on public.production_sets
  for each row execute function public.set_production_updated_at();
create trigger production_scenes_updated_at before update on public.production_scenes
  for each row execute function public.set_production_updated_at();
create trigger show_tool_permissions_updated_at before update on public.show_tool_permissions
  for each row execute function public.set_production_updated_at_without_user();
create trigger production_imports_updated_at before update on public.production_imports
  for each row execute function public.set_production_updated_at_without_user();
create trigger production_documents_updated_at before update on public.production_documents
  for each row execute function public.set_production_updated_at();

alter table public.production_settings enable row level security;
alter table public.production_units enable row level security;
alter table public.production_sets enable row level security;
alter table public.production_set_units enable row level security;
alter table public.production_scenes enable row level security;
alter table public.production_set_scenes enable row level security;
alter table public.production_location_sets enable row level security;
alter table public.show_tool_permissions enable row level security;
alter table public.production_imports enable row level security;
alter table public.production_documents enable row level security;

grant select, insert, update, delete on public.production_settings to authenticated;
grant select, insert, update, delete on public.production_units to authenticated;
grant select, insert, update, delete on public.production_sets to authenticated;
grant select, insert, update, delete on public.production_set_units to authenticated;
grant select, insert, update, delete on public.production_scenes to authenticated;
grant select, insert, update, delete on public.production_set_scenes to authenticated;
grant select, insert, update, delete on public.production_location_sets to authenticated;
grant select, insert, update, delete on public.show_tool_permissions to authenticated;
grant select, insert, update, delete on public.production_imports to authenticated;
grant select, insert, update, delete on public.production_documents to authenticated;

create policy production_settings_select on public.production_settings for select to authenticated
  using (public.show_access_role(show_id) is not null);
create policy production_settings_insert on public.production_settings for insert to authenticated
  with check (public.is_show_owner(show_id));
create policy production_settings_update on public.production_settings for update to authenticated
  using (public.is_show_owner(show_id) or exists (
    select 1 from public.show_tool_permissions p where p.show_id=production_settings.show_id and p.user_id=(select auth.uid()) and p.tool_key='show_setup' and p.access_level in ('edit','admin')
  )) with check (public.is_show_owner(show_id) or exists (
    select 1 from public.show_tool_permissions p where p.show_id=production_settings.show_id and p.user_id=(select auth.uid()) and p.tool_key='show_setup' and p.access_level in ('edit','admin')
  ));
create policy production_settings_delete on public.production_settings for delete to authenticated
  using (public.is_show_owner(show_id));

create policy production_units_select on public.production_units for select to authenticated
  using (public.show_access_role(show_id) is not null);
create policy production_units_insert on public.production_units for insert to authenticated
  with check (public.is_show_owner(show_id) or exists (
    select 1 from public.show_tool_permissions p where p.show_id=production_units.show_id and p.user_id=(select auth.uid()) and p.tool_key='show_setup' and p.access_level in ('edit','admin')
  ));
create policy production_units_update on public.production_units for update to authenticated
  using (public.is_show_owner(show_id) or exists (
    select 1 from public.show_tool_permissions p where p.show_id=production_units.show_id and p.user_id=(select auth.uid()) and p.tool_key='show_setup' and p.access_level in ('edit','admin')
  )) with check (public.is_show_owner(show_id) or exists (
    select 1 from public.show_tool_permissions p where p.show_id=production_units.show_id and p.user_id=(select auth.uid()) and p.tool_key='show_setup' and p.access_level in ('edit','admin')
  ));
create policy production_units_delete on public.production_units for delete to authenticated
  using (public.is_show_owner(show_id) or exists (
    select 1 from public.show_tool_permissions p where p.show_id=production_units.show_id and p.user_id=(select auth.uid()) and p.tool_key='show_setup' and p.access_level in ('edit','admin')
  ));

create policy production_sets_select on public.production_sets for select to authenticated
  using (public.show_access_role(show_id) is not null);
create policy production_sets_insert on public.production_sets for insert to authenticated
  with check (public.is_show_owner(show_id) or exists (
    select 1 from public.show_tool_permissions p where p.show_id=production_sets.show_id and p.user_id=(select auth.uid()) and p.tool_key='set_list' and p.access_level in ('edit','admin')
  ));
create policy production_sets_update on public.production_sets for update to authenticated
  using (public.is_show_owner(show_id) or exists (
    select 1 from public.show_tool_permissions p where p.show_id=production_sets.show_id and p.user_id=(select auth.uid()) and p.tool_key='set_list' and p.access_level in ('edit','admin')
  )) with check (public.is_show_owner(show_id) or exists (
    select 1 from public.show_tool_permissions p where p.show_id=production_sets.show_id and p.user_id=(select auth.uid()) and p.tool_key='set_list' and p.access_level in ('edit','admin')
  ));
create policy production_sets_delete on public.production_sets for delete to authenticated
  using (public.is_show_owner(show_id) or exists (
    select 1 from public.show_tool_permissions p where p.show_id=production_sets.show_id and p.user_id=(select auth.uid()) and p.tool_key='set_list' and p.access_level in ('edit','admin')
  ));

create policy production_set_units_select on public.production_set_units for select to authenticated using (public.show_access_role(show_id) is not null);
create policy production_set_units_insert on public.production_set_units for insert to authenticated with check (
  public.is_show_owner(show_id) or exists (select 1 from public.show_tool_permissions p where p.show_id=production_set_units.show_id and p.user_id=(select auth.uid()) and p.tool_key='set_list' and p.access_level in ('edit','admin'))
);
create policy production_set_units_delete on public.production_set_units for delete to authenticated using (
  public.is_show_owner(show_id) or exists (select 1 from public.show_tool_permissions p where p.show_id=production_set_units.show_id and p.user_id=(select auth.uid()) and p.tool_key='set_list' and p.access_level in ('edit','admin'))
);

create policy production_scenes_select on public.production_scenes for select to authenticated using (public.show_access_role(show_id) is not null);
create policy production_scenes_insert on public.production_scenes for insert to authenticated with check (
  public.is_show_owner(show_id) or exists (select 1 from public.show_tool_permissions p where p.show_id=production_scenes.show_id and p.user_id=(select auth.uid()) and p.tool_key='set_list' and p.access_level in ('edit','admin'))
);
create policy production_scenes_update on public.production_scenes for update to authenticated
  using (public.is_show_owner(show_id) or exists (select 1 from public.show_tool_permissions p where p.show_id=production_scenes.show_id and p.user_id=(select auth.uid()) and p.tool_key='set_list' and p.access_level in ('edit','admin')))
  with check (public.is_show_owner(show_id) or exists (select 1 from public.show_tool_permissions p where p.show_id=production_scenes.show_id and p.user_id=(select auth.uid()) and p.tool_key='set_list' and p.access_level in ('edit','admin')));
create policy production_scenes_delete on public.production_scenes for delete to authenticated using (
  public.is_show_owner(show_id) or exists (select 1 from public.show_tool_permissions p where p.show_id=production_scenes.show_id and p.user_id=(select auth.uid()) and p.tool_key='set_list' and p.access_level in ('edit','admin'))
);

create policy production_set_scenes_select on public.production_set_scenes for select to authenticated using (public.show_access_role(show_id) is not null);
create policy production_set_scenes_insert on public.production_set_scenes for insert to authenticated with check (
  public.is_show_owner(show_id) or exists (select 1 from public.show_tool_permissions p where p.show_id=production_set_scenes.show_id and p.user_id=(select auth.uid()) and p.tool_key='set_list' and p.access_level in ('edit','admin'))
);
create policy production_set_scenes_delete on public.production_set_scenes for delete to authenticated using (
  public.is_show_owner(show_id) or exists (select 1 from public.show_tool_permissions p where p.show_id=production_set_scenes.show_id and p.user_id=(select auth.uid()) and p.tool_key='set_list' and p.access_level in ('edit','admin'))
);

create policy production_location_sets_select on public.production_location_sets for select to authenticated using (public.show_access_role(show_id) is not null);
create policy production_location_sets_insert on public.production_location_sets for insert to authenticated with check (
  public.is_show_owner(show_id) or exists (select 1 from public.show_tool_permissions p where p.show_id=production_location_sets.show_id and p.user_id=(select auth.uid()) and p.tool_key='location_list' and p.access_level in ('edit','admin')) or public.can_edit_show(show_id)
);
create policy production_location_sets_delete on public.production_location_sets for delete to authenticated using (
  public.is_show_owner(show_id) or exists (select 1 from public.show_tool_permissions p where p.show_id=production_location_sets.show_id and p.user_id=(select auth.uid()) and p.tool_key='location_list' and p.access_level in ('edit','admin')) or public.can_edit_show(show_id)
);

create policy show_tool_permissions_select on public.show_tool_permissions for select to authenticated
  using (public.is_show_owner(show_id) or user_id=(select auth.uid()));
create policy show_tool_permissions_insert on public.show_tool_permissions for insert to authenticated with check (public.is_show_owner(show_id));
create policy show_tool_permissions_update on public.show_tool_permissions for update to authenticated using (public.is_show_owner(show_id)) with check (public.is_show_owner(show_id));
create policy show_tool_permissions_delete on public.show_tool_permissions for delete to authenticated using (public.is_show_owner(show_id));

create policy production_imports_select on public.production_imports for select to authenticated using (public.show_access_role(show_id) is not null);
create policy production_imports_insert on public.production_imports for insert to authenticated with check (public.is_show_owner(show_id));
create policy production_imports_update on public.production_imports for update to authenticated using (public.is_show_owner(show_id)) with check (public.is_show_owner(show_id));
create policy production_imports_delete on public.production_imports for delete to authenticated using (public.is_show_owner(show_id));

create policy production_documents_select on public.production_documents for select to authenticated using (public.show_access_role(show_id) is not null);
create policy production_documents_insert on public.production_documents for insert to authenticated with check (public.can_edit_show(show_id));
create policy production_documents_update on public.production_documents for update to authenticated using (public.can_edit_show(show_id)) with check (public.can_edit_show(show_id));
create policy production_documents_delete on public.production_documents for delete to authenticated using (public.is_show_owner(show_id));

-- Preserve the current production identity and episode list while moving them into canonical tables.
insert into public.production_settings (show_id, production_type, season, production_company, logo_url, created_by, updated_by)
select s.id, 'episodic', nullif(s.payload->>'season',''), nullif(s.payload->>'company',''), nullif(s.payload->>'logo',''), s.owner_id, s.owner_id
from public.shows s
on conflict (show_id) do nothing;

insert into public.production_units (id, show_id, kind, code, name, sort_order, created_by, updated_by)
select
  (episode.item->>'id')::uuid,
  s.id,
  'episode',
  nullif(regexp_replace(coalesce(episode.item->>'name',''), '^.*?([0-9]+).*$', '\1'), coalesce(episode.item->>'name','')),
  coalesce(nullif(episode.item->>'name',''), 'Episode ' || episode.ordinality::text),
  (episode.ordinality - 1)::integer,
  s.owner_id,
  s.owner_id
from public.shows s
cross join lateral jsonb_array_elements(coalesce(s.payload->'episodes','[]'::jsonb)) with ordinality as episode(item, ordinality)
where episode.item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict (id) do nothing;

-- Realtime keeps Set List and Location List synchronized without twitching active editors.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'production_settings',
    'production_units',
    'production_sets',
    'production_set_units',
    'production_scenes',
    'production_set_scenes',
    'production_location_sets'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

-- Taylor Scout Set Prep Folder v1 + shared set staffing model.
-- Additive only.

create or replace function public.can_edit_set_prep(p_show_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_show_owner(p_show_id)
    or exists (
      select 1 from public.show_tool_permissions p
      where p.show_id=p_show_id and p.user_id=(select auth.uid())
        and p.tool_key='set_prep' and p.access_level in ('edit','admin')
    )
    or (
      not exists (
        select 1 from public.show_tool_permissions p
        where p.show_id=p_show_id and p.user_id=(select auth.uid()) and p.tool_key='set_prep'
      )
      and public.can_edit_show(p_show_id)
    );
$$;

create or replace function public.can_edit_set_staffing(p_show_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_show_owner(p_show_id)
    or exists (
      select 1 from public.show_tool_permissions p
      where p.show_id=p_show_id and p.user_id=(select auth.uid())
        and p.tool_key in ('calendar','set_prep') and p.access_level in ('edit','admin')
    )
    or public.can_edit_show(p_show_id);
$$;

grant execute on function public.can_edit_set_prep(uuid) to authenticated;
grant execute on function public.can_edit_set_staffing(uuid) to authenticated;

create table if not exists public.production_set_staffing (
  show_id uuid not null references public.shows(id) on delete cascade,
  set_id uuid not null,
  key_name text,
  alm_names jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (show_id,set_id),
  foreign key (set_id,show_id) references public.production_sets(id,show_id) on delete cascade
);

create table if not exists public.production_set_staffing_overrides (
  show_id uuid not null references public.shows(id) on delete cascade,
  set_id uuid not null,
  work_date date not null,
  key_name text,
  alm_names jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (show_id,set_id,work_date),
  foreign key (set_id,show_id) references public.production_sets(id,show_id) on delete cascade
);

create table if not exists public.set_prep_folders (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  folder_key text not null,
  unit_id uuid,
  set_id uuid not null,
  location_id uuid,
  statuses jsonb not null default '{}'::jsonb,
  pinned_info jsonb not null default '[]'::jsonb,
  sections jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(show_id,folder_key),
  foreign key (unit_id,show_id) references public.production_units(id,show_id) on delete set null(unit_id),
  foreign key (set_id,show_id) references public.production_sets(id,show_id) on delete cascade,
  foreign key (location_id,show_id) references public.production_locations(id,show_id) on delete set null(location_id)
);

create index if not exists production_set_staffing_set_idx on public.production_set_staffing(set_id);
create index if not exists production_set_staffing_overrides_date_idx on public.production_set_staffing_overrides(show_id,work_date,set_id);
create index if not exists set_prep_folders_show_unit_idx on public.set_prep_folders(show_id,unit_id,set_id);
create index if not exists set_prep_folders_location_idx on public.set_prep_folders(location_id);

drop trigger if exists production_set_staffing_updated_at on public.production_set_staffing;
create trigger production_set_staffing_updated_at before update on public.production_set_staffing
for each row execute function public.set_production_updated_at();
drop trigger if exists production_set_staffing_overrides_updated_at on public.production_set_staffing_overrides;
create trigger production_set_staffing_overrides_updated_at before update on public.production_set_staffing_overrides
for each row execute function public.set_production_updated_at();
drop trigger if exists set_prep_folders_updated_at on public.set_prep_folders;
create trigger set_prep_folders_updated_at before update on public.set_prep_folders
for each row execute function public.set_production_updated_at();

alter table public.production_set_staffing enable row level security;
alter table public.production_set_staffing_overrides enable row level security;
alter table public.set_prep_folders enable row level security;

grant select,insert,update,delete on public.production_set_staffing to authenticated;
grant select,insert,update,delete on public.production_set_staffing_overrides to authenticated;
grant select,insert,update,delete on public.set_prep_folders to authenticated;

drop policy if exists production_set_staffing_select on public.production_set_staffing;
create policy production_set_staffing_select on public.production_set_staffing for select to authenticated using (public.show_access_role(show_id) is not null);
drop policy if exists production_set_staffing_insert on public.production_set_staffing;
create policy production_set_staffing_insert on public.production_set_staffing for insert to authenticated with check (public.can_edit_set_staffing(show_id));
drop policy if exists production_set_staffing_update on public.production_set_staffing;
create policy production_set_staffing_update on public.production_set_staffing for update to authenticated using (public.can_edit_set_staffing(show_id)) with check (public.can_edit_set_staffing(show_id));
drop policy if exists production_set_staffing_delete on public.production_set_staffing;
create policy production_set_staffing_delete on public.production_set_staffing for delete to authenticated using (public.can_edit_set_staffing(show_id));

drop policy if exists production_set_staffing_overrides_select on public.production_set_staffing_overrides;
create policy production_set_staffing_overrides_select on public.production_set_staffing_overrides for select to authenticated using (public.show_access_role(show_id) is not null);
drop policy if exists production_set_staffing_overrides_insert on public.production_set_staffing_overrides;
create policy production_set_staffing_overrides_insert on public.production_set_staffing_overrides for insert to authenticated with check (public.can_edit_set_staffing(show_id));
drop policy if exists production_set_staffing_overrides_update on public.production_set_staffing_overrides;
create policy production_set_staffing_overrides_update on public.production_set_staffing_overrides for update to authenticated using (public.can_edit_set_staffing(show_id)) with check (public.can_edit_set_staffing(show_id));
drop policy if exists production_set_staffing_overrides_delete on public.production_set_staffing_overrides;
create policy production_set_staffing_overrides_delete on public.production_set_staffing_overrides for delete to authenticated using (public.can_edit_set_staffing(show_id));

drop policy if exists set_prep_folders_select on public.set_prep_folders;
create policy set_prep_folders_select on public.set_prep_folders for select to authenticated using (public.show_access_role(show_id) is not null);
drop policy if exists set_prep_folders_insert on public.set_prep_folders;
create policy set_prep_folders_insert on public.set_prep_folders for insert to authenticated with check (public.can_edit_set_prep(show_id));
drop policy if exists set_prep_folders_update on public.set_prep_folders;
create policy set_prep_folders_update on public.set_prep_folders for update to authenticated using (public.can_edit_set_prep(show_id)) with check (public.can_edit_set_prep(show_id));
drop policy if exists set_prep_folders_delete on public.set_prep_folders;
create policy set_prep_folders_delete on public.set_prep_folders for delete to authenticated using (public.can_edit_set_prep(show_id));

do $$
declare table_name text;
begin
  foreach table_name in array array['production_set_staffing','production_set_staffing_overrides','set_prep_folders']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=table_name
    ) then execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end;
$$;

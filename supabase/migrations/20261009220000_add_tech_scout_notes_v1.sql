-- Taylor Scout Tech Scout Notes v1
-- Additive, production-scoped collaboration for tech scout notes and photos.

create or replace function public.can_edit_tech_scout(p_show_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_show_owner(p_show_id)
    or exists (
      select 1
      from public.show_tool_permissions p
      where p.show_id = p_show_id
        and p.user_id = (select auth.uid())
        and p.tool_key = 'tech_scout'
        and p.access_level in ('edit','admin')
    )
    or (
      not exists (
        select 1
        from public.show_tool_permissions p
        where p.show_id = p_show_id
          and p.user_id = (select auth.uid())
          and p.tool_key = 'tech_scout'
      )
      and public.can_edit_show(p_show_id)
    );
$$;

grant execute on function public.can_edit_tech_scout(uuid) to authenticated;

create table if not exists public.tech_scout_departments (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, show_id)
);

create unique index if not exists tech_scout_departments_name_idx
  on public.tech_scout_departments(show_id, lower(name));
create index if not exists tech_scout_departments_show_sort_idx
  on public.tech_scout_departments(show_id, sort_order, name);

create table if not exists public.tech_scout_notes (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  unit_id uuid,
  set_id uuid not null,
  location_id uuid,
  department_id uuid not null,
  body text not null check (btrim(body) <> ''),
  is_action_item boolean not null default false,
  created_by uuid references auth.users(id) default auth.uid(),
  updated_by uuid references auth.users(id) default auth.uid(),
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, show_id),
  foreign key (unit_id, show_id) references public.production_units(id, show_id) on delete set null (unit_id),
  foreign key (set_id, show_id) references public.production_sets(id, show_id) on delete cascade,
  foreign key (location_id, show_id) references public.production_locations(id, show_id) on delete set null (location_id),
  foreign key (department_id, show_id) references public.tech_scout_departments(id, show_id) on delete restrict
);

create index if not exists tech_scout_notes_target_idx
  on public.tech_scout_notes(show_id, unit_id, set_id, location_id, department_id, created_at);
create index if not exists tech_scout_notes_created_by_idx
  on public.tech_scout_notes(created_by);

create table if not exists public.tech_scout_note_photos (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  note_id uuid not null,
  storage_path text not null,
  file_name text,
  mime_type text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (note_id, show_id) references public.tech_scout_notes(id, show_id) on delete cascade
);

create index if not exists tech_scout_note_photos_note_idx
  on public.tech_scout_note_photos(show_id, note_id);

drop trigger if exists tech_scout_departments_updated_at on public.tech_scout_departments;
create trigger tech_scout_departments_updated_at before update on public.tech_scout_departments
  for each row execute function public.set_production_updated_at();

drop trigger if exists tech_scout_notes_updated_at on public.tech_scout_notes;
create trigger tech_scout_notes_updated_at before update on public.tech_scout_notes
  for each row execute function public.set_production_updated_at();

alter table public.tech_scout_departments enable row level security;
alter table public.tech_scout_notes enable row level security;
alter table public.tech_scout_note_photos enable row level security;

grant select, insert, update, delete on public.tech_scout_departments to authenticated;
grant select, insert, update, delete on public.tech_scout_notes to authenticated;
grant select, insert, update, delete on public.tech_scout_note_photos to authenticated;

drop policy if exists tech_scout_departments_select on public.tech_scout_departments;
create policy tech_scout_departments_select on public.tech_scout_departments for select to authenticated
  using (public.show_access_role(show_id) is not null);
drop policy if exists tech_scout_departments_insert on public.tech_scout_departments;
create policy tech_scout_departments_insert on public.tech_scout_departments for insert to authenticated
  with check (public.can_edit_tech_scout(show_id));
drop policy if exists tech_scout_departments_update on public.tech_scout_departments;
create policy tech_scout_departments_update on public.tech_scout_departments for update to authenticated
  using (public.can_edit_tech_scout(show_id)) with check (public.can_edit_tech_scout(show_id));
drop policy if exists tech_scout_departments_delete on public.tech_scout_departments;
create policy tech_scout_departments_delete on public.tech_scout_departments for delete to authenticated
  using (public.can_edit_tech_scout(show_id));

drop policy if exists tech_scout_notes_select on public.tech_scout_notes;
create policy tech_scout_notes_select on public.tech_scout_notes for select to authenticated
  using (public.show_access_role(show_id) is not null);
drop policy if exists tech_scout_notes_insert on public.tech_scout_notes;
create policy tech_scout_notes_insert on public.tech_scout_notes for insert to authenticated
  with check (public.can_edit_tech_scout(show_id));
drop policy if exists tech_scout_notes_update on public.tech_scout_notes;
create policy tech_scout_notes_update on public.tech_scout_notes for update to authenticated
  using (public.can_edit_tech_scout(show_id)) with check (public.can_edit_tech_scout(show_id));
drop policy if exists tech_scout_notes_delete on public.tech_scout_notes;
create policy tech_scout_notes_delete on public.tech_scout_notes for delete to authenticated
  using (public.can_edit_tech_scout(show_id));

drop policy if exists tech_scout_note_photos_select on public.tech_scout_note_photos;
create policy tech_scout_note_photos_select on public.tech_scout_note_photos for select to authenticated
  using (public.show_access_role(show_id) is not null);
drop policy if exists tech_scout_note_photos_insert on public.tech_scout_note_photos;
create policy tech_scout_note_photos_insert on public.tech_scout_note_photos for insert to authenticated
  with check (public.can_edit_tech_scout(show_id));
drop policy if exists tech_scout_note_photos_delete on public.tech_scout_note_photos;
create policy tech_scout_note_photos_delete on public.tech_scout_note_photos for delete to authenticated
  using (public.can_edit_tech_scout(show_id));

insert into public.tech_scout_departments (show_id, name, sort_order)
select s.id, d.name, d.sort_order
from public.shows s
cross join (values
  ('General', 0),
  ('Art Department / Construction', 10),
  ('Set Dressing', 20),
  ('Grip', 30),
  ('Electric', 40),
  ('Fixtures', 50),
  ('SPFX', 60),
  ('Transportation', 70),
  ('Locations / Misc', 80)
) as d(name, sort_order)
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tech-scout-notes',
  'tech-scout-notes',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tech_scout_storage_select on storage.objects;
create policy tech_scout_storage_select on storage.objects for select to authenticated
using (
  bucket_id = 'tech-scout-notes'
  and public.show_access_role(((storage.foldername(name))[1])::uuid) is not null
);

drop policy if exists tech_scout_storage_insert on storage.objects;
create policy tech_scout_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'tech-scout-notes'
  and public.can_edit_tech_scout(((storage.foldername(name))[1])::uuid)
);

drop policy if exists tech_scout_storage_update on storage.objects;
create policy tech_scout_storage_update on storage.objects for update to authenticated
using (
  bucket_id = 'tech-scout-notes'
  and public.can_edit_tech_scout(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'tech-scout-notes'
  and public.can_edit_tech_scout(((storage.foldername(name))[1])::uuid)
);

drop policy if exists tech_scout_storage_delete on storage.objects;
create policy tech_scout_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'tech-scout-notes'
  and public.can_edit_tech_scout(((storage.foldername(name))[1])::uuid)
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tech_scout_departments',
    'tech_scout_notes',
    'tech_scout_note_photos'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

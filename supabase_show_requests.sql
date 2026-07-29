-- Taylor Scout: gated new-show requests
create table if not exists public.show_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete cascade,
  requester_email text,
  show_name text not null,
  season text,
  production_company text,
  requested_access text not null default 'Production workspace',
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','declined','activated')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.show_requests enable row level security;

drop policy if exists "Users can submit show requests" on public.show_requests;
create policy "Users can submit show requests" on public.show_requests
for insert to authenticated with check (requested_by = auth.uid());

drop policy if exists "Users can view their show requests" on public.show_requests;
create policy "Users can view their show requests" on public.show_requests
for select to authenticated using (requested_by = auth.uid());

create index if not exists show_requests_requested_by_idx on public.show_requests(requested_by);
create index if not exists show_requests_status_idx on public.show_requests(status);

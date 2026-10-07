-- Hisapo cloud schema. Paste into Supabase → SQL Editor → Run. Safe to run once on a new project.

-- A workspace is one business; everyone in it shares the same stations and transactions.
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'İşletmem',
  invite_code text unique not null default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Stations and transactions, one row each, stored as the app's own JSON.
create table if not exists public.records (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('station', 'tx')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (workspace_id, kind, id)
);
create index if not exists records_workspace_updated on public.records (workspace_id, updated_at);

-- The server stamps every change, so devices pull by server time, not their own clocks.
create or replace function public.touch_record() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
for each row execute function public.touch_record();

create or replace function public.is_member(ws uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from workspace_members where workspace_id = ws and user_id = auth.uid());
$$;

-- Create a workspace and become its owner.
create or replace function public.create_workspace(ws_name text default 'İşletmem')
returns public.workspaces
language plpgsql security definer set search_path = public as $$
declare ws workspaces;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into workspaces (name, created_by) values (coalesce(nullif(trim(ws_name), ''), 'İşletmem'), auth.uid())
  returning * into ws;
  insert into workspace_members (workspace_id, user_id, email, role)
  values (ws.id, auth.uid(), auth.jwt() ->> 'email', 'owner');
  return ws;
end $$;

-- Join a workspace with its invite code.
create or replace function public.join_workspace(code text)
returns public.workspaces
language plpgsql security definer set search_path = public as $$
declare ws workspaces;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into ws from workspaces where invite_code = upper(trim(code));
  if ws.id is null then raise exception 'invalid invite code'; end if;
  insert into workspace_members (workspace_id, user_id, email)
  values (ws.id, auth.uid(), auth.jwt() ->> 'email')
  on conflict do nothing;
  return ws;
end $$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.records enable row level security;

drop policy if exists "members read workspace" on public.workspaces;
create policy "members read workspace" on public.workspaces
  for select using (public.is_member(id));

drop policy if exists "members rename workspace" on public.workspaces;
create policy "members rename workspace" on public.workspaces
  for update using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists "members see members" on public.workspace_members;
create policy "members see members" on public.workspace_members
  for select using (public.is_member(workspace_id));

drop policy if exists "leave workspace" on public.workspace_members;
create policy "leave workspace" on public.workspace_members
  for delete using (user_id = auth.uid());

drop policy if exists "members read records" on public.records;
create policy "members read records" on public.records
  for select using (public.is_member(workspace_id));

drop policy if exists "members add records" on public.records;
create policy "members add records" on public.records
  for insert with check (public.is_member(workspace_id));

drop policy if exists "members change records" on public.records;
create policy "members change records" on public.records
  for update using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

revoke all on function public.create_workspace(text) from public, anon;
revoke all on function public.join_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.join_workspace(text) to authenticated;

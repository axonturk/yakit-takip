-- Hisapo cloud schema. Paste into Supabase → SQL Editor → Run. Safe to run again after updates: it only adds what is missing.

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
alter table public.records add column if not exists created_by uuid;

create or replace function public.touch_record() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  new.created_by := case when tg_op = 'INSERT' then auth.uid() else old.created_by end;
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

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.records enable row level security;

drop policy if exists "members read workspace" on public.workspaces;
create policy "members read workspace" on public.workspaces
  for select using (public.is_member(id));

drop policy if exists "members see members" on public.workspace_members;
create policy "members see members" on public.workspace_members
  for select using (public.is_member(workspace_id));

drop policy if exists "leave workspace" on public.workspace_members;
create policy "leave workspace" on public.workspace_members
  for delete using (user_id = auth.uid());

drop policy if exists "members read records" on public.records;
create policy "members read records" on public.records
  for select using (public.is_member(workspace_id));

revoke all on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;

-- Change history: who changed which record, when, and what it was before.
-- Written only by the trigger below; members can read it, nobody can edit it.
create table if not exists public.record_log (
  log_id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null,
  id text not null,
  action text not null check (action in ('create', 'update', 'delete')),
  data jsonb,
  previous jsonb,
  changed_at timestamptz not null default clock_timestamp(),
  changed_by uuid,
  changed_by_email text
);
create index if not exists record_log_recent on public.record_log (workspace_id, changed_at desc);
create index if not exists record_log_record on public.record_log (workspace_id, kind, id, changed_at desc);

create or replace function public.log_record() returns trigger
language plpgsql security definer set search_path = public as $$
declare act text;
begin
  if tg_op = 'INSERT' then
    act := case when new.deleted then 'delete' else 'create' end;
  elsif old.deleted = new.deleted and old.data is not distinct from new.data then
    return null;
  elsif new.deleted then
    act := 'delete';
  elsif old.deleted then
    act := 'create';
  else
    act := 'update';
  end if;
  insert into record_log (workspace_id, kind, id, action, data, previous, changed_by, changed_by_email)
  values (
    new.workspace_id, new.kind, new.id, act, new.data,
    case when tg_op = 'UPDATE' then old.data end,
    auth.uid(), auth.jwt() ->> 'email'
  );
  return null;
end $$;

drop trigger if exists records_log on public.records;
create trigger records_log after insert or update on public.records
for each row execute function public.log_record();

alter table public.record_log enable row level security;
drop policy if exists "members read log" on public.record_log;
create policy "members read log" on public.record_log
  for select using (public.is_member(workspace_id));

-- Anonymous app health: daily opens and error messages. No amounts, names or e-mails.
-- Anyone can add a row; only the project owner sees them (Table Editor → app_events).
create table if not exists public.app_events (
  event_id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  device text not null check (char_length(device) <= 64),
  kind text not null check (kind in ('open', 'error')),
  version text check (char_length(version) <= 32),
  message text check (char_length(message) <= 500),
  detail text check (char_length(detail) <= 4000),
  info jsonb check (pg_column_size(info) <= 2000)
);
create index if not exists app_events_at on public.app_events (at desc);

alter table public.app_events enable row level security;
drop policy if exists "anyone reports" on public.app_events;
create policy "anyone reports" on public.app_events
  for insert to anon, authenticated with check (true);

-- Roles (Faz 3): owner and manager ("member") run the ledger; a driver only enters fuel purchases
-- and may change or delete only the purchases they entered.
alter table public.workspaces add column if not exists driver_code text unique
  default upper(substr(md5(random()::text || clock_timestamp()::text || 'driver'), 1, 8));
alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members add constraint workspace_members_role_check
  check (role in ('owner', 'member', 'driver'));
alter table public.workspace_members add column if not exists plate text;
alter table public.workspace_members add column if not exists monthly_limit numeric;

create or replace function public.member_role(ws uuid) returns text
language sql security definer stable set search_path = public as $$
  select role from workspace_members where workspace_id = ws and user_id = auth.uid();
$$;

-- The manager code adds a manager, the driver code adds a driver. Existing members keep their role.
create or replace function public.join_workspace(code text)
returns public.workspaces
language plpgsql security definer set search_path = public as $$
declare ws workspaces; r text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into ws from workspaces where invite_code = upper(trim(code));
  if ws.id is not null then
    r := 'member';
  else
    select * into ws from workspaces where driver_code = upper(trim(code));
    r := 'driver';
  end if;
  if ws.id is null then raise exception 'invalid invite code'; end if;
  insert into workspace_members (workspace_id, user_id, email, role)
  values (ws.id, auth.uid(), auth.jwt() ->> 'email', r)
  on conflict do nothing;
  return ws;
end $$;

-- Owner sets a member's role, default plate and monthly limit. The owner row itself is not changed here.
create or replace function public.update_member(ws uuid, member uuid, new_role text, new_plate text, new_limit numeric)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if member_role(ws) is distinct from 'owner' then raise exception 'only the owner can change members'; end if;
  if new_role not in ('member', 'driver') then raise exception 'invalid role'; end if;
  update workspace_members
     set role = new_role, plate = nullif(trim(new_plate), ''), monthly_limit = new_limit
   where workspace_id = ws and user_id = member and role <> 'owner';
end $$;

create or replace function public.remove_member(ws uuid, member uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if member_role(ws) is distinct from 'owner' then raise exception 'only the owner can remove members'; end if;
  delete from workspace_members where workspace_id = ws and user_id = member and role <> 'owner';
end $$;

revoke all on function public.join_workspace(text) from public, anon;
grant execute on function public.join_workspace(text) to authenticated;
revoke all on function public.update_member(uuid, uuid, text, text, numeric) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.update_member(uuid, uuid, text, text, numeric) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

drop policy if exists "members rename workspace" on public.workspaces;
create policy "members rename workspace" on public.workspaces
  for update using (public.member_role(id) in ('owner', 'member'))
  with check (public.member_role(id) in ('owner', 'member'));

drop policy if exists "members add records" on public.records;
create policy "members add records" on public.records
  for insert with check (
    public.is_member(workspace_id) and (
      public.member_role(workspace_id) <> 'driver'
      or (kind = 'tx' and (deleted or (data ->> 'type' = 'expense' and coalesce(data ->> 'kind', '') = '')))
    )
  );

drop policy if exists "members change records" on public.records;
create policy "members change records" on public.records
  for update using (
    public.is_member(workspace_id) and (
      public.member_role(workspace_id) <> 'driver' or (kind = 'tx' and created_by = auth.uid())
    )
  ) with check (
    public.is_member(workspace_id) and (
      public.member_role(workspace_id) <> 'driver'
      or (kind = 'tx' and (deleted or (data ->> 'type' = 'expense' and coalesce(data ->> 'kind', '') = '')))
    )
  );

-- Receipt photos (Faz 3B): private bucket, one folder per workspace (<workspace id>/<photo id>.jpg).
-- Members can see and add photos of their workspace; photos are never overwritten.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.is_member_folder(object_name text) returns boolean
language plpgsql security definer stable set search_path = public as $$
begin
  return public.is_member(split_part(object_name, '/', 1)::uuid);
exception when invalid_text_representation then
  return false;
end $$;

drop policy if exists "members read receipts" on storage.objects;
create policy "members read receipts" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.is_member_folder(name));

drop policy if exists "members add receipts" on storage.objects;
create policy "members add receipts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_member_folder(name));

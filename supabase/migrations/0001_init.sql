-- HoldOff — initial schema
--
-- Design rule: store the least that makes the product work.
--
-- Message drafts, conversation text, contact names and phone numbers are NEVER stored here.
-- They stay on the user's device. HoldOff's users include people with anxiety and people in
-- recovery; a breach of what they nearly sent would be far worse than a breach of an email
-- list, so that data is simply not collected. Anything added to this schema later should have
-- to justify itself against that.
--
-- Apply with: psql "$SUPABASE_DB_URL" -f 0001_init.sql
-- or paste into the Supabase SQL editor.

-- IMPORTANT — holdoff-production is not an empty project. The previous agent created
-- `leads`, `email_events`, `sms_events`, `routing_tasks`, `webhook_log` and `waitlist` in
-- the public schema for the marketing and outreach side of the business. This migration must
-- not touch any of them.
--
-- In particular there is ALREADY a `public.waitlist`. An earlier draft of this file created it
-- with `if not exists`, which would have silently skipped the existing table and then applied
-- this file's indexes and grants to a table with different columns. That is the worst kind of
-- failure: it reports success and leaves the schema half-changed. Waitlist handling is
-- therefore deliberately NOT in this migration — see 0002 below.

begin;

-- Refuse to run if anything this file creates is already present, rather than merging into it
-- blind. Better to stop and be read by a human than to half-apply.
do $$
declare
    clashes text;
begin
    select string_agg(c.relname, ', ')
      into clashes
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relname in ('profiles', 'deletion_requests');

    if clashes is not null then
        raise exception
            'Refusing to run: public.% already exists. Inspect it before applying this file.',
            clashes;
    end if;
end $$;

-- citext gives case-insensitive email comparison, so Alex@ and alex@ cannot both sign up.
-- Supabase ships the extension but does not enable it by default.
create extension if not exists citext;

-- ── profiles ───────────────────────────────────────────────────────────────────
-- One row per authenticated user. Accounts are optional in the app; a profile only
-- exists for someone who chose to sign up.

create table if not exists public.profiles (
    id                uuid primary key references auth.users (id) on delete cascade,
    email             text        not null,
    -- Entitlement. Set by the service role only — never by the user, see the grants below.
    is_premium        boolean     not null default false,
    premium_source    text,                       -- 'manual' | 'play' | 'stripe' | null
    premium_until     timestamptz,                -- null = no expiry / not premium
    -- Self-reported, from the in-app quiz. Optional, and the user can clear it.
    attachment_style  text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),

    constraint profiles_attachment_style_check
        check (attachment_style is null or length(attachment_style) <= 64),
    constraint profiles_premium_source_check
        check (premium_source is null or premium_source in ('manual', 'play', 'stripe'))
);

comment on table public.profiles is
    'One row per signed-up user. Deliberately contains no message content and no contacts.';

-- ── deletion_requests ──────────────────────────────────────────────────────────
-- Google Play requires a reachable way to request account and data deletion, and
-- requires that requests actually get honoured. Tracking them in a table is what makes
-- that auditable rather than a promise.

create table if not exists public.deletion_requests (
    id           bigint generated always as identity primary key,
    email        citext      not null,
    -- Null when the request arrives from someone not signed in, which is allowed:
    -- a user must be able to ask for deletion even if they cannot get into the account.
    user_id      uuid references auth.users (id) on delete set null,
    status       text        not null default 'received',
    note         text,
    requested_at timestamptz not null default now(),
    completed_at timestamptz,

    constraint deletion_requests_status_check
        check (status in ('received', 'in_progress', 'completed', 'rejected')),
    constraint deletion_requests_note_len_check
        check (note is null or length(note) <= 1000)
);

create index if not exists deletion_requests_open_idx
    on public.deletion_requests (requested_at)
    where status <> 'completed';

comment on table public.deletion_requests is
    'Audit trail for data-deletion requests. Play requires these be actioned, so they are logged.';

-- ── updated_at maintenance ─────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
    before update on public.profiles
    for each row execute function public.touch_updated_at();

-- ── profile creation on signup ─────────────────────────────────────────────────
-- Supabase Auth owns auth.users. This mirrors the minimum into public.profiles so the
-- app has somewhere to hang entitlement without querying the auth schema directly.
--
-- security definer because it writes a table the new user has no rights on yet;
-- search_path is pinned so the definer rights cannot be abused through a shadowed name.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ── row level security ─────────────────────────────────────────────────────────
-- Every table is deny-by-default. The anon key ships inside a public APK and must be
-- treated as known to an attacker, so these policies are the only real boundary.

alter table public.profiles          enable row level security;
alter table public.deletion_requests enable row level security;

-- profiles: a user sees and edits their own row, and nothing else. No policy for anon,
-- so an unauthenticated caller gets nothing at all.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
    for select to authenticated
    using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
    for update to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- deletion_requests: anyone may file one, nobody may read them back.
drop policy if exists deletion_requests_public_insert on public.deletion_requests;
create policy deletion_requests_public_insert on public.deletion_requests
    for insert to anon, authenticated
    with check (true);

-- ── column privileges ──────────────────────────────────────────────────────────
-- RLS decides which ROWS a user may touch; it cannot stop them writing a column they
-- should not. Without this, profiles_update_own would let any signed-in user set
-- is_premium = true on their own row and grant themselves premium for free.

revoke update on public.profiles from anon, authenticated;
grant  update (attachment_style) on public.profiles to authenticated;

-- The public never needs to enumerate this.
--
-- Consequence for the client: supabase-js and PostgREST ask for the inserted row back by
-- default, which needs SELECT and will therefore fail here. Inserts into deletion_requests
-- must send `Prefer: return=minimal` — in supabase-js, .insert(row) with no .select() chained.
revoke select on public.deletion_requests from anon, authenticated;

commit;

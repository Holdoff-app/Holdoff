-- READ-ONLY. Run this and read the output before writing anything to public.waitlist.
--
-- `public.waitlist` already exists in holdoff-production, created by the previous agent for the
-- marketing site. Its columns, constraints and RLS policies have never been inspected from this
-- workspace. The app must not insert into it, and no policy should be changed on it, until the
-- shape below is known — the site may depend on it, and it may already hold real signups.
--
-- Nothing here modifies anything. Safe to run against production.

-- 1. Columns and types.
select ordinal_position, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'waitlist'
 order by ordinal_position;

-- 2. Constraints and indexes — in particular whether email is already unique, and whether it is
--    text or citext, which decides if 'Alex@' and 'alex@' can both be present.
select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.waitlist'::regclass;

select indexname, indexdef from pg_indexes
 where schemaname = 'public' and tablename = 'waitlist';

-- 3. RLS state and policies. Memory says "public can insert but not read"; verify rather than
--    trust it, because an over-permissive select policy here would be an email leak.
select relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
  from pg_class where oid = 'public.waitlist'::regclass;

select policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'waitlist';

-- 4. Table-level grants to the two roles reachable with the public anon key.
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'waitlist'
   and grantee in ('anon', 'authenticated')
 order by grantee, privilege_type;

-- 5. How much is actually in there. Row count only — do NOT select the addresses.
--
--    This number is the answer to "how big is the waitlist", which has been unsourced for a
--    while. Whatever it says is the only citable figure, and it stays internal until it has
--    been checked for test rows and duplicates.
select count(*) as total_rows,
       count(distinct lower(email::text)) as distinct_emails,
       min(created_at) as first_signup,
       max(created_at) as last_signup
  from public.waitlist;

-- PROJ-1 QA follow-up: fix the two Low-severity findings from the QA review.

-- BUG-1: users.email was NOT NULL, which would break sign-up if a future non-email
-- auth provider (phone/anonymous) ever created a user with a null email. Relax it;
-- magic-link still always supplies an email.
alter table public.users alter column email drop not null;

-- BUG-2: scope RLS policies TO authenticated (best practice) instead of the implicit
-- `public` role. Functionally equivalent (the auth.uid() qual already denies anon),
-- but avoids evaluating the policies for anonymous requests and is more explicit.

-- public.users
drop policy "Users can view own profile" on public.users;
create policy "Users can view own profile"
  on public.users for select to authenticated
  using ((select auth.uid()) = id);

drop policy "Users can insert own profile" on public.users;
create policy "Users can insert own profile"
  on public.users for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy "Users can update own profile" on public.users;
create policy "Users can update own profile"
  on public.users for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- storage.objects
drop policy "Users can view own photos" on storage.objects;
create policy "Users can view own photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy "Users can upload own photos" on storage.objects;
create policy "Users can upload own photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy "Users can update own photos" on storage.objects;
create policy "Users can update own photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy "Users can delete own photos" on storage.objects;
create policy "Users can delete own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

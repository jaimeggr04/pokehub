-- Acceso con Google, subida de avatares y borrado de cuenta.

-- ---------------------------------------------------------------------------
-- 1. El alta por OAuth no trae ni `username` ni `display_name` en los
--    metadatos: Google manda `name` / `full_name` y `picture` / `avatar_url`.
--    Se reaprovechan para que el perfil nazca ya con nombre y foto.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base_username text;
  final_username text;
  n int := 0;
begin
  base_username := regexp_replace(
    coalesce(
      nullif(meta->>'username', ''),
      nullif(meta->>'preferred_username', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    '[^A-Za-z0-9_]', '', 'g');

  if char_length(base_username) < 3 then
    base_username := 'trainer' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base_username := substr(base_username, 1, 20);

  final_username := base_username;
  while exists (select 1 from public.profiles p where p.username::text = final_username) loop
    n := n + 1;
    final_username := substr(base_username, 1, 20 - char_length(n::text)) || n::text;
  end loop;

  insert into public.profiles (id, username, display_name, bio, avatar_url)
  values (
    new.id,
    final_username::public.citext,
    left(coalesce(
      nullif(meta->>'display_name', ''),
      nullif(meta->>'full_name', ''),
      nullif(meta->>'name', ''),
      final_username
    ), 40),
    left(coalesce(meta->>'bio', ''), 250),
    nullif(coalesce(meta->>'avatar_url', meta->>'picture'), '')
  );
  return new;
end; $$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Borrado de cuenta desde Configuración. Al eliminar la fila de auth.users
--    el resto cae en cascada (profiles -> teams -> builds, likes, follows…).
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = me;
end; $$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Bucket público de avatares. Cada usuario sólo puede escribir dentro de la
--    carpeta que lleva su propio uuid.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_read_all" on storage.objects;
create policy "avatars_read_all" on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

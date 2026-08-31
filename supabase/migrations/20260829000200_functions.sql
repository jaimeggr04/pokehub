-- Funciones y triggers de PokeHub

create or replace function public.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger teams_touch before update on public.teams
  for each row execute function public.touch_updated_at();

-- Crea el perfil automáticamente al registrarse, con nombre de usuario único.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare base_username text; final_username text; n int := 0;
begin
  base_username := regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
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
  insert into public.profiles (id, username, display_name, bio)
  values (new.id, final_username::public.citext,
          coalesce(new.raw_user_meta_data->>'display_name', final_username),
          left(coalesce(new.raw_user_meta_data->>'bio', ''), 250));
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Contadores desnormalizados (evitan un count(*) por tarjeta del feed).
create or replace function public.sync_like_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.teams set like_count = like_count + 1 where id = new.team_id;
  elsif tg_op = 'DELETE' then
    update public.teams set like_count = greatest(like_count - 1, 0) where id = old.team_id;
  end if;
  return null;
end; $$;
create trigger likes_count_trg after insert or delete on public.likes
  for each row execute function public.sync_like_count();

create or replace function public.sync_comment_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.teams set comment_count = comment_count + 1 where id = new.team_id;
  elsif tg_op = 'DELETE' then
    update public.teams set comment_count = greatest(comment_count - 1, 0) where id = old.team_id;
  end if;
  return null;
end; $$;
create trigger comments_count_trg after insert or delete on public.comments
  for each row execute function public.sync_comment_count();

create or replace function public.bump_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return null;
end; $$;
create trigger messages_bump_trg after insert on public.messages
  for each row execute function public.bump_conversation();

-- Evita recursión en las políticas RLS del chat.
create or replace function public.is_conversation_member(conv_id uuid, uid uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.conversation_participants cp
                 where cp.conversation_id = conv_id and cp.user_id = uid);
$$;

-- Abre (o reutiliza) un chat 1 a 1.
create or replace function public.get_or_create_dm(other_user uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); conv uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if me = other_user then raise exception 'cannot dm yourself'; end if;

  select cp.conversation_id into conv
  from public.conversation_participants cp
  join public.conversation_participants cp2
    on cp2.conversation_id = cp.conversation_id and cp2.user_id = other_user
  where cp.user_id = me
  group by cp.conversation_id having count(*) = 1
  limit 1;

  if conv is not null then return conv; end if;

  insert into public.conversations default values returning id into conv;
  insert into public.conversation_participants (conversation_id, user_id)
  values (conv, me), (conv, other_user);
  return conv;
end; $$;

create or replace function public.suggested_users(limit_count int default 5)
returns table (id uuid, username citext, display_name text, bio text, avatar_url text, follower_count bigint)
language sql security invoker stable set search_path = '' as $$
  select p.id, p.username, p.display_name, p.bio, p.avatar_url,
         (select count(*) from public.follows f where f.following_id = p.id) as follower_count
  from public.profiles p
  where p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and not exists (select 1 from public.follows f
                    where f.follower_id = auth.uid() and f.following_id = p.id)
  order by follower_count desc, p.created_at asc
  limit limit_count;
$$;

-- Permite iniciar sesión con el nombre de usuario SIN exponer emails:
-- sólo devuelve el email cuando la contraseña ya es correcta.
create or replace function public.email_for_login(uname text, pw text)
returns text language sql security definer stable set search_path = '' as $$
  select u.email::text
  from auth.users u join public.profiles p on p.id = u.id
  where p.username::text = lower(uname)
    and u.encrypted_password = extensions.crypt(pw, u.encrypted_password)
  limit 1;
$$;
revoke all on function public.email_for_login(text, text) from public;
grant execute on function public.email_for_login(text, text) to anon, authenticated;

create or replace function public.search_profiles(q text, limit_count int default 10)
returns table (id uuid, username citext, display_name text, bio text, avatar_url text, team_count bigint)
language sql security invoker stable set search_path = 'public' as $$
  select p.id, p.username, p.display_name, p.bio, p.avatar_url,
         (select count(*) from public.teams t where t.user_id = p.id and t.is_public) as team_count
  from public.profiles p
  where q <> '' and (p.username::text ilike '%' || lower(q) || '%'
                     or coalesce(p.display_name, '') ilike '%' || q || '%')
  order by (p.username::text = lower(q)) desc,
           similarity(p.username::text, lower(q)) desc, p.username
  limit least(limit_count, 50);
$$;

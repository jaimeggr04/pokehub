-- Row Level Security: nadie escribe filas de otra persona.
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.builds enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create policy "profiles_select_all" on public.profiles for select to anon, authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "teams_select_public" on public.teams for select to anon, authenticated
  using (is_public or user_id = (select auth.uid()));
create policy "teams_insert_own" on public.teams for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "teams_update_own" on public.teams for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "teams_delete_own" on public.teams for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "builds_select" on public.builds for select to anon, authenticated
  using (exists (select 1 from public.teams t
                 where t.id = team_id and (t.is_public or t.user_id = (select auth.uid()))));
create policy "builds_write_own" on public.builds for all to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.teams t where t.id = team_id and t.user_id = (select auth.uid())));

create policy "likes_select_all" on public.likes for select to anon, authenticated using (true);
create policy "likes_insert_own" on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "likes_delete_own" on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "comments_select_all" on public.comments for select to anon, authenticated using (true);
create policy "comments_insert_own" on public.comments for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "comments_delete_own" on public.comments for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "follows_select_all" on public.follows for select to anon, authenticated using (true);
create policy "follows_insert_own" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));
create policy "follows_delete_own" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()));

create policy "conversations_select_member" on public.conversations for select to authenticated
  using (public.is_conversation_member(id, (select auth.uid())));
create policy "participants_select_member" on public.conversation_participants for select to authenticated
  using (public.is_conversation_member(conversation_id, (select auth.uid())));
create policy "participants_update_own" on public.conversation_participants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "messages_select_member" on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id, (select auth.uid())));
create policy "messages_insert_member" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid())
              and public.is_conversation_member(conversation_id, (select auth.uid())));
create policy "messages_delete_own" on public.messages for delete to authenticated
  using (sender_id = (select auth.uid()));

-- Chat en tiempo real
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- Endurecer permisos: las funciones de trigger no deben exponerse en la API REST.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_like_count() from public, anon, authenticated;
revoke all on function public.sync_comment_count() from public, anon, authenticated;
revoke all on function public.bump_conversation() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

revoke all on function public.get_or_create_dm(uuid) from public, anon;
grant execute on function public.get_or_create_dm(uuid) to authenticated;
revoke all on function public.is_conversation_member(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;

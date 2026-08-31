-- PokeHub · esquema inicial (migración del dump MySQL a Postgres)
create extension if not exists citext;
create extension if not exists pg_trgm;

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     citext not null unique,
  display_name text,
  bio          text not null default '',
  avatar_url   text,
  is_premium   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint bio_len check (char_length(bio) <= 250)
);
create index profiles_username_trgm on public.profiles using gin (username gin_trgm_ops);

create table public.teams (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  description   text not null default '',
  format        text not null default 'VGC',
  is_public     boolean not null default true,
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint team_name_len check (char_length(name) between 1 and 40),
  constraint team_desc_len check (char_length(description) <= 1000)
);
create index teams_user_id_idx on public.teams(user_id);
create index teams_created_at_idx on public.teams(created_at desc);

-- Una fila por Pokémon (el modelo antiguo usaba 6 columnas FK en `team_ids`).
create table public.builds (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  slot         smallint not null check (slot between 1 and 6),
  pokemon_id   integer not null,
  pokemon_name text not null,
  nickname     text,
  gender       text not null default 'unknown' check (gender in ('male','female','unknown')),
  level        smallint not null default 50 check (level between 1 and 100),
  shiny        boolean not null default false,
  ability      text,
  item         text,
  nature       text,
  tera_type    text,
  moves        text[] not null default '{}',
  hp_ivs smallint not null default 31 check (hp_ivs between 0 and 31),
  atk_ivs smallint not null default 31 check (atk_ivs between 0 and 31),
  def_ivs smallint not null default 31 check (def_ivs between 0 and 31),
  spa_ivs smallint not null default 31 check (spa_ivs between 0 and 31),
  spd_ivs smallint not null default 31 check (spd_ivs between 0 and 31),
  spe_ivs smallint not null default 31 check (spe_ivs between 0 and 31),
  hp_evs smallint not null default 0 check (hp_evs between 0 and 252),
  atk_evs smallint not null default 0 check (atk_evs between 0 and 252),
  def_evs smallint not null default 0 check (def_evs between 0 and 252),
  spa_evs smallint not null default 0 check (spa_evs between 0 and 252),
  spd_evs smallint not null default 0 check (spd_evs between 0 and 252),
  spe_evs smallint not null default 0 check (spe_evs between 0 and 252),
  unique (team_id, slot),
  constraint moves_max_4 check (array_length(moves, 1) is null or array_length(moves, 1) <= 4),
  constraint evs_total check (hp_evs + atk_evs + def_evs + spa_evs + spd_evs + spe_evs <= 508)
);
create index builds_team_id_idx on public.builds(team_id);
create index builds_pokemon_id_idx on public.builds(pokemon_id);

create table public.likes (
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index likes_user_id_idx on public.likes(user_id);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  constraint comment_len check (char_length(body) between 1 and 500)
);
create index comments_team_id_idx on public.comments(team_id, created_at desc);

create table public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);
create index follows_following_idx on public.follows(following_id);

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  last_read_at    timestamptz not null default 'epoch',
  primary key (conversation_id, user_id)
);
create index conv_participants_user_idx on public.conversation_participants(user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now(),
  constraint message_len check (char_length(body) between 1 and 2000)
);
create index messages_conversation_idx on public.messages(conversation_id, created_at desc);

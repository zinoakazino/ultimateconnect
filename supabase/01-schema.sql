-- =====================================================================================
-- Ultimate Connect : base de données (Supabase / Postgres)
--
-- A exécuter UNE FOIS dans le « SQL Editor » du projet Supabase fait pour cette appli
-- (vérifiez la référence du projet dans l'adresse du navigateur avant de lancer !).
-- Le script peut être relancé sans risque : il ne supprime aucune donnée.
-- Ensuite, lancez 02-seed.sql (codes d'inscription, voyage, les deux groupes et leurs vols, la liste des participants,
-- programme, guide).
-- =====================================================================================

-- ---------- garde-fou : ce fichier ne doit jamais tourner dans le projet d'une autre appli ----------
-- Il ajoute des règles sur les inscriptions (auth.users) : dans le projet d'une boutique, il bloquerait ses clients.
-- Si le projet contient déjà des tables qui ne sont pas les nôtres, on s'arrête ici, sans rien modifier.
do $$
declare other text;
begin
  select string_agg(tablename, ', ' order by tablename) into other
  from pg_tables
  where schemaname = 'public'
    and tablename not in ('config', 'profiles', 'trip', 'trip_groups', 'roster', 'schedule', 'places', 'chat_meta', 'messages',
                          'dm_threads', 'dm_messages', 'notifications', 'broadcasts', 'checkins', 'checkin_responses',
                          'help_requests', 'spatial_ref_sys');
  if other is not null then
    raise exception 'STOP : ce projet Supabase contient deja d''autres tables (%). Ne lancez pas ce fichier ici : creez un projet Supabase separe pour Ultimate Connect.', other;
  end if;
end $$;

-- ---------- codes d'inscription de l'entreprise (lisibles par le staff seulement) ----------
create table if not exists public.config (
  key   text primary key,
  value text not null
);

-- ---------- groupes de voyage : chaque groupe a ses propres vols ----------
-- Les heures sont des heures LOCALES (Alger au départ d'Alger, Istanbul au départ d'Istanbul), écrites « HH:MM ».
create table if not exists public.trip_groups (
  id            smallint primary key check (id between 1 and 9),
  name          text not null,
  airline       text not null default '',
  out_date      date not null,
  out_from      text not null default '',
  out_to        text not null default '',
  out_dep       text not null check (out_dep ~ '^\d{2}:\d{2}$'),
  out_arr       text not null check (out_arr ~ '^\d{2}:\d{2}$'),
  back_date     date not null,
  back_from     text not null default '',
  back_to       text not null default '',
  back_dep      text not null check (back_dep ~ '^\d{2}:\d{2}$'),
  back_arr      text not null check (back_arr ~ '^\d{2}:\d{2}$'),
  meet_time     text check (meet_time is null or meet_time ~ '^\d{2}:\d{2}$'),   -- rendez-vous à l'aéroport d'Alger
  meet_place    text not null default '',
  bag_hold_kg   smallint,                  -- poids de CHAQUE bagage en soute
  bag_hold_count smallint not null default 1 check (bag_hold_count between 1 and 9),   -- combien de bagages en soute (2 = « 23 kg x 2 »)
  bag_cabin_kg  smallint,
  hotel_arrival text check (hotel_arrival is null or hotel_arrival ~ '^\d{2}:\d{2}$'),  -- jeudi, environ
  checkout_by   text check (checkout_by is null or checkout_by ~ '^\d{2}:\d{2}$'),     -- null = le staff l'annoncera
  note          text not null default '',
  meet_place_ar text not null default '',   -- les mêmes deux textes en arabe, affichés quand l'appli est en arabe
  note_ar       text not null default ''
);
alter table public.trip_groups add column if not exists meet_place_ar text not null default '';
alter table public.trip_groups add column if not exists note_ar text not null default '';
alter table public.trip_groups add column if not exists bag_hold_count smallint not null default 1 check (bag_hold_count between 1 and 9);

-- ---------- profils (un par compte) ----------
create table if not exists public.profiles (
  uid                 uuid primary key references auth.users (id) on delete cascade,
  name                text not null check (char_length(name) between 1 and 80),
  phone               text not null default '',
  email               text not null default '',
  role                text not null default 'consultant' check (role in ('staff', 'consultant')),
  verified            boolean not null default false,
  location_sharing    boolean not null default false,
  location_lat        double precision,
  location_lng        double precision,
  location_updated_at timestamptz,
  last_active         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
-- Le groupe de voyage de la personne (ses vols). Le staff seul le change ; il vient de la liste des participants (roster).
alter table public.profiles add column if not exists group_id smallint references public.trip_groups (id) on update cascade on delete set null;

-- ---------- liste des participants, préparée à l'avance par le staff ----------
-- Chaque personne attendue a déjà « son compte » : nom + groupe. En s'inscrivant elle choisit son nom dans la liste :
-- son profil reprend ce nom et ce groupe, et il est validé tout de suite. Une ligne ne peut être prise qu'une fois.
create table if not exists public.roster (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null unique check (char_length(full_name) between 1 and 80),
  role        text not null default 'consultant' check (role in ('staff', 'consultant')),
  group_id    smallint references public.trip_groups (id) on update cascade on delete set null,
  profile_uid uuid unique references public.profiles (uid) on delete set null,   -- qui a pris ce nom (null = pas encore inscrit)
  created_at  timestamptz not null default now()
);

-- ---------- contenu du voyage ----------
create table if not exists public.trip (
  id         text primary key default 'current',
  name       text not null default '',
  start_date timestamptz not null,
  end_date   timestamptz not null
);

create table if not exists public.schedule (
  date       text primary key check (date ~ '^\d{4}-\d{2}-\d{2}$'),
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.places (
  id          text primary key default gen_random_uuid()::text,
  category    text not null check (category in ('emergency', 'group', 'recommended', 'restaurant', 'shopping', 'tool', 'info')),
  name        text not null,
  description text not null default '',
  address     text,
  phone       text,
  lat         double precision,
  lng         double precision
);

-- ---------- discussion de groupe ----------
create table if not exists public.chat_meta (
  id        text primary key,
  locked    boolean not null default false,
  locked_by uuid,
  locked_at timestamptz
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles (uid) on delete cascade,
  sender_name text not null,
  sender_role text not null,
  text        text not null check (char_length(text) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages (created_at desc);

-- ---------- messages privés staff <-> consultant ----------
create table if not exists public.dm_threads (
  id              text primary key,                       -- "<staffUid>_<consultantUid>"
  staff_id        uuid not null references public.profiles (uid) on delete cascade,
  staff_name      text not null,
  consultant_id   uuid not null references public.profiles (uid) on delete cascade,
  consultant_name text not null,
  last_message    text not null default '',
  last_message_at timestamptz not null default now(),
  last_sender_id  uuid
);
create index if not exists dm_threads_staff_idx on public.dm_threads (staff_id);
create index if not exists dm_threads_consultant_idx on public.dm_threads (consultant_id);

create table if not exists public.dm_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   text not null references public.dm_threads (id) on delete cascade,
  sender_id   uuid not null,
  sender_name text not null,
  sender_role text not null,
  text        text not null check (char_length(text) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists dm_messages_thread_idx on public.dm_messages (thread_id, created_at desc);

-- ---------- alertes ----------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (uid) on delete cascade,
  type         text not null check (type in ('reminder', 'chat', 'schedule', 'broadcast', 'verification', 'checkin')),
  text         text not null check (char_length(text) between 1 and 2000),
  read         boolean not null default false,
  broadcast_id uuid,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index if not exists notifications_broadcast_uidx on public.notifications (broadcast_id, user_id) where broadcast_id is not null;

create table if not exists public.broadcasts (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  audience   uuid[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ---------- appel (« tout le monde est là ? ») ----------
create table if not exists public.checkins (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  closed     boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.checkin_responses (
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  uid        uuid not null references public.profiles (uid) on delete cascade,
  name       text not null,
  at         timestamptz not null default now(),
  primary key (checkin_id, uid)
);

-- ---------- « J'ai besoin d'aide » ----------
create table if not exists public.help_requests (
  id          uuid primary key default gen_random_uuid(),
  uid         uuid not null references public.profiles (uid) on delete cascade,
  name        text not null,
  phone       text not null default '',
  lat         double precision,
  lng         double precision,
  message     text,
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_at  timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz
);
create index if not exists help_requests_status_idx on public.help_requests (status, created_at desc);

-- =====================================================================================
-- Fonctions utilitaires
-- =====================================================================================

-- « Membre » = compte connecté qui a un profil. Un compte sans profil ne peut rien lire.
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.profiles where uid = auth.uid());
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.profiles where uid = auth.uid() and role = 'staff');
$$;

create or replace function public.group_locked() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select locked from public.chat_meta where id = 'group'), false);
$$;

-- Renvoie 'staff', 'consultant' ou null selon le code saisi (sans différence de casse).
create or replace function public.check_invite_code(p_code text) returns text
language plpgsql stable security definer set search_path = public as $$
declare c text;
begin
  select value into c from public.config where key = 'staff_code';
  if c is not null and c <> '' and upper(btrim(coalesce(p_code, ''))) = upper(c) then return 'staff'; end if;
  select value into c from public.config where key = 'invite_code';
  if c is not null and c <> '' and upper(btrim(coalesce(p_code, ''))) = upper(c) then return 'consultant'; end if;
  return null;
end $$;

-- Date serveur imposée à la création (un client ne peut pas truquer l'ordre des messages).
create or replace function public.stamp_created_at() returns trigger
language plpgsql as $$
begin
  new.created_at := now();
  return new;
end $$;

-- =====================================================================================
-- Inscription : le code d'entreprise est vérifié DANS la base, puis le profil est créé
-- =====================================================================================

-- Les noms encore libres de la liste des participants, pour l'écran d'inscription. Il faut connaître le code d'invitation :
-- un code faux (ou aucun code) ne voit rien. Le code consultants ouvre les consultants, le code du staff ouvre le staff.
create or replace function public.roster_choices(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r text := public.check_invite_code(p_code);
begin
  if r is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.full_name, 'group', x.group_id) order by x.full_name)
    from public.roster x
    where x.profile_uid is null and x.role = r
  ), '[]'::jsonb);
end $$;

-- Avant la création du compte : le code est bon, et le nom choisi (s'il y en a un) existe, est libre et correspond au code.
create or replace function public.auth_user_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text; rid uuid;
begin
  r := public.check_invite_code(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));
  if r is null then
    raise exception 'invalid_invite_code';
  end if;
  if coalesce(new.raw_user_meta_data ->> 'roster_id', '') <> '' then
    begin
      rid := (new.raw_user_meta_data ->> 'roster_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'roster_unavailable';
    end;
    -- on verrouille la ligne : si deux personnes prennent le même nom en même temps, la seconde attend, puis est refusée
    perform 1 from public.roster where id = rid and role = r and profile_uid is null for update;
    if not found then
      raise exception 'roster_unavailable';
    end if;
  end if;
  return new;
end $$;

-- Après la création du compte : le profil. Avec un nom de la liste, il en reprend le nom et le groupe et il est validé d'office.
create or replace function public.auth_user_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text; ro public.roster%rowtype;
begin
  r := public.check_invite_code(coalesce(new.raw_user_meta_data ->> 'invite_code', ''));
  if coalesce(new.raw_user_meta_data ->> 'roster_id', '') <> '' then
    select * into ro from public.roster
    where id = (new.raw_user_meta_data ->> 'roster_id')::uuid and role = coalesce(r, 'consultant') and profile_uid is null
    for update;
    if not found then
      raise exception 'roster_unavailable';
    end if;
  end if;
  insert into public.profiles (uid, name, phone, email, role, verified, group_id)
  values (
    new.id,
    coalesce(ro.full_name, left(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), 80)),
    left(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 40),
    coalesce(new.email, ''),
    coalesce(r, 'consultant'),
    r = 'staff' or ro.id is not null,   -- l'équipe, et les personnes attendues (dans la liste), n'ont pas à être validées
    ro.group_id
  );
  if ro.id is not null then
    update public.roster set profile_uid = new.id where id = ro.id;
  end if;
  return new;
end $$;

drop trigger if exists uc_auth_user_check on auth.users;
create trigger uc_auth_user_check before insert on auth.users
  for each row execute function public.auth_user_check();

drop trigger if exists uc_auth_user_created on auth.users;
create trigger uc_auth_user_created after insert on auth.users
  for each row execute function public.auth_user_created();

-- =====================================================================================
-- Gardes : ce que chacun a le droit de modifier
-- =====================================================================================

-- Un consultant ne touche qu'à ses champs non privilégiés (jamais role / verified / group_id : son groupe, donc ses vols).
-- Le staff ne peut changer que « verified » et « group_id » chez les autres.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return new; end if;   -- tableau de bord Supabase / service role
  if new.uid <> old.uid or new.role <> old.role or new.email <> old.email or new.created_at <> old.created_at then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if new.uid = me then
    if (new.verified is distinct from old.verified or new.group_id is distinct from old.group_id) and not public.is_staff() then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  elsif public.is_staff() then
    if (new.name, new.phone, new.location_sharing, new.location_lat, new.location_lng, new.location_updated_at, new.last_active)
       is distinct from
       (old.name, old.phone, old.location_sharing, old.location_lat, old.location_lng, old.location_updated_at, old.last_active) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists uc_profiles_guard on public.profiles;
create trigger uc_profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Une alerte : seul le champ « read » peut changer.
create or replace function public.notifications_guard() returns trigger
language plpgsql as $$
begin
  if (new.id, new.user_id, new.type, new.text, new.broadcast_id, new.created_at)
     is distinct from (old.id, old.user_id, old.type, old.text, old.broadcast_id, old.created_at) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists uc_notifications_guard on public.notifications;
create trigger uc_notifications_guard before update on public.notifications
  for each row execute function public.notifications_guard();

drop trigger if exists uc_notifications_created on public.notifications;
create trigger uc_notifications_created before insert on public.notifications
  for each row execute function public.stamp_created_at();

-- Une demande d'aide : le staff ne change que le statut ; qui / quand est écrit par la base.
create or replace function public.help_requests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.id, new.uid, new.name, new.phone, new.lat, new.lng, new.message, new.created_at)
     is distinct from (old.id, old.uid, old.name, old.phone, old.lat, old.lng, old.message, old.created_at) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_by := auth.uid();
    new.resolved_at := now();
  end if;
  return new;
end $$;

drop trigger if exists uc_help_requests_guard on public.help_requests;
create trigger uc_help_requests_guard before update on public.help_requests
  for each row execute function public.help_requests_guard();

drop trigger if exists uc_help_requests_created on public.help_requests;
create trigger uc_help_requests_created before insert on public.help_requests
  for each row execute function public.stamp_created_at();

-- Message de groupe : l'expéditeur (id, nom, rôle) vient du profil, jamais du client.
create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where uid = auth.uid();
  if p.uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  new.sender_id := p.uid;
  new.sender_name := p.name;
  new.sender_role := p.role;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists uc_messages_before_insert on public.messages;
create trigger uc_messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

-- Réponse à l'appel : nom et heure viennent de la base.
create or replace function public.checkin_responses_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where uid = auth.uid();
  if p.uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  new.uid := p.uid;
  new.name := p.name;
  new.at := now();
  return new;
end $$;

drop trigger if exists uc_checkin_responses_write on public.checkin_responses;
create trigger uc_checkin_responses_write before insert or update on public.checkin_responses
  for each row execute function public.checkin_responses_before_write();

drop trigger if exists uc_broadcasts_created on public.broadcasts;
create trigger uc_broadcasts_created before insert on public.broadcasts
  for each row execute function public.stamp_created_at();

drop trigger if exists uc_checkins_created on public.checkins;
create trigger uc_checkins_created before insert on public.checkins
  for each row execute function public.stamp_created_at();

-- =====================================================================================
-- Message privé : une seule fonction crée la conversation si besoin (staff seulement),
-- enregistre le message et met à jour l'aperçu.
-- =====================================================================================
create or replace function public.send_direct_message(p_staff_id uuid, p_consultant_id uuid, p_text text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mine public.profiles;
  tid text := p_staff_id::text || '_' || p_consultant_id::text;
  preview text;
begin
  select * into mine from public.profiles where uid = me;
  if me is null or mine.uid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if me <> p_staff_id and me <> p_consultant_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_text is null or char_length(btrim(p_text)) = 0 or char_length(p_text) > 2000 then
    raise exception 'invalid_text' using errcode = '22023';
  end if;
  preview := case when char_length(p_text) > 120 then left(p_text, 117) || '…' else p_text end;

  if not exists (select 1 from public.dm_threads where id = tid) then
    -- Seul le staff peut ouvrir une conversation.
    if mine.role <> 'staff' or me <> p_staff_id then raise exception 'thread_not_found' using errcode = '42501'; end if;
    insert into public.dm_threads (id, staff_id, staff_name, consultant_id, consultant_name, last_message, last_message_at, last_sender_id)
    select tid, s.uid, s.name, c.uid, c.name, preview, now(), me
    from public.profiles s, public.profiles c
    where s.uid = p_staff_id and s.role = 'staff' and c.uid = p_consultant_id and c.role = 'consultant';
    if not found then raise exception 'invalid_participants' using errcode = '22023'; end if;
  else
    update public.dm_threads set last_message = preview, last_message_at = now(), last_sender_id = me where id = tid;
  end if;

  insert into public.dm_messages (thread_id, sender_id, sender_name, sender_role, text)
  values (tid, me, mine.name, mine.role, p_text);
end $$;

-- =====================================================================================
-- Sécurité ligne par ligne (RLS)
-- =====================================================================================
alter table public.config            enable row level security;
alter table public.profiles          enable row level security;
alter table public.trip              enable row level security;
alter table public.trip_groups       enable row level security;
alter table public.roster            enable row level security;
alter table public.schedule          enable row level security;
alter table public.places            enable row level security;
alter table public.chat_meta         enable row level security;
alter table public.messages          enable row level security;
alter table public.dm_threads        enable row level security;
alter table public.dm_messages       enable row level security;
alter table public.notifications     enable row level security;
alter table public.broadcasts        enable row level security;
alter table public.checkins          enable row level security;
alter table public.checkin_responses enable row level security;
alter table public.help_requests     enable row level security;

-- config : staff seulement
drop policy if exists config_staff on public.config;
create policy config_staff on public.config for all using (public.is_staff()) with check (public.is_staff());

-- profiles : le titulaire ou le staff lit ; pas de création directe (faite à l'inscription)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (uid = auth.uid() or public.is_staff());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (uid = auth.uid()) with check (uid = auth.uid());
drop policy if exists profiles_update_staff on public.profiles;
create policy profiles_update_staff on public.profiles for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists profiles_delete_staff on public.profiles;
create policy profiles_delete_staff on public.profiles for delete using (public.is_staff());

-- contenu du voyage : les membres lisent, le staff écrit
drop policy if exists trip_read on public.trip;
create policy trip_read on public.trip for select using (public.is_member());
drop policy if exists trip_write on public.trip;
create policy trip_write on public.trip for all using (public.is_staff()) with check (public.is_staff());

-- les vols de chaque groupe : tout membre les lit (le staff les écrit) ; la liste des participants : le staff seulement
drop policy if exists trip_groups_read on public.trip_groups;
create policy trip_groups_read on public.trip_groups for select using (public.is_member());
drop policy if exists trip_groups_write on public.trip_groups;
create policy trip_groups_write on public.trip_groups for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists roster_staff on public.roster;
create policy roster_staff on public.roster for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists schedule_read on public.schedule;
create policy schedule_read on public.schedule for select using (public.is_member());
drop policy if exists schedule_write on public.schedule;
create policy schedule_write on public.schedule for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists places_read on public.places;
create policy places_read on public.places for select using (public.is_member());
drop policy if exists places_write on public.places;
create policy places_write on public.places for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists chat_meta_read on public.chat_meta;
create policy chat_meta_read on public.chat_meta for select using (public.is_member());
drop policy if exists chat_meta_write on public.chat_meta;
create policy chat_meta_write on public.chat_meta for all using (public.is_staff()) with check (public.is_staff());

-- discussion de groupe
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select using (public.is_member());
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (public.is_member() and (public.is_staff() or not public.group_locked()));
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete using (public.is_staff());

-- messages privés : seuls les deux participants lisent ; l'écriture passe par send_direct_message()
drop policy if exists dm_threads_read on public.dm_threads;
create policy dm_threads_read on public.dm_threads for select
  using (public.is_member() and auth.uid() in (staff_id, consultant_id));
drop policy if exists dm_messages_read on public.dm_messages;
create policy dm_messages_read on public.dm_messages for select
  using (public.is_member() and exists (
    select 1 from public.dm_threads t where t.id = thread_id and auth.uid() in (t.staff_id, t.consultant_id)
  ));

-- alertes : le titulaire (ou le staff) lit ; le staff crée ; le titulaire marque comme lu
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check (public.is_staff() and read = false);
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete using (public.is_staff());

drop policy if exists broadcasts_staff on public.broadcasts;
create policy broadcasts_staff on public.broadcasts for all using (public.is_staff()) with check (public.is_staff());

-- appel
drop policy if exists checkins_read on public.checkins;
create policy checkins_read on public.checkins for select using (public.is_member());
drop policy if exists checkins_write on public.checkins;
create policy checkins_write on public.checkins for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists checkin_responses_read on public.checkin_responses;
create policy checkin_responses_read on public.checkin_responses for select using (public.is_staff() or uid = auth.uid());
drop policy if exists checkin_responses_insert on public.checkin_responses;
create policy checkin_responses_insert on public.checkin_responses for insert
  with check (public.is_member() and uid = auth.uid()
    and exists (select 1 from public.checkins c where c.id = checkin_id and c.closed = false));
drop policy if exists checkin_responses_update on public.checkin_responses;
create policy checkin_responses_update on public.checkin_responses for update
  using (uid = auth.uid())
  with check (uid = auth.uid() and exists (select 1 from public.checkins c where c.id = checkin_id and c.closed = false));
drop policy if exists checkin_responses_delete on public.checkin_responses;
create policy checkin_responses_delete on public.checkin_responses for delete using (public.is_staff());

-- demandes d'aide
drop policy if exists help_read on public.help_requests;
create policy help_read on public.help_requests for select using (public.is_staff() or uid = auth.uid());
drop policy if exists help_insert on public.help_requests;
create policy help_insert on public.help_requests for insert
  with check (public.is_member() and uid = auth.uid() and status = 'open');
drop policy if exists help_update on public.help_requests;
create policy help_update on public.help_requests for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists help_delete on public.help_requests;
create policy help_delete on public.help_requests for delete using (public.is_staff());

-- =====================================================================================
-- Droits d'accès de l'API
-- Indispensable sur un projet Supabase créé depuis le 30 mai 2026 : les nouvelles tables et fonctions
-- n'y sont plus ouvertes à l'API automatiquement (réglage « Automatically expose new tables »).
-- La sécurité ligne par ligne ci-dessus décide QUI voit QUELLES lignes ; ces droits ouvrent la porte.
-- Un visiteur non connecté (anon) n'a accès à aucune table : seulement à check_invite_code().
-- =====================================================================================
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on
  public.config, public.profiles, public.trip, public.trip_groups, public.roster, public.schedule, public.places,
  public.chat_meta, public.messages, public.dm_threads, public.dm_messages, public.notifications, public.broadcasts,
  public.checkins, public.checkin_responses, public.help_requests
  to authenticated, service_role;

-- les fonctions que les règles ci-dessus appellent : réservées aux personnes connectées
revoke execute on function public.is_member(), public.is_staff(), public.group_locked() from public, anon;
grant  execute on function public.is_member(), public.is_staff(), public.group_locked() to authenticated, service_role;

revoke execute on function public.send_direct_message(uuid, uuid, text) from public, anon;
grant  execute on function public.send_direct_message(uuid, uuid, text) to authenticated, service_role;
grant  execute on function public.check_invite_code(text) to anon, authenticated, service_role;
-- à l'inscription (pas encore connecté) : la liste des noms libres, seulement si le code d'invitation est bon
grant  execute on function public.roster_choices(text) to anon, authenticated, service_role;

-- =====================================================================================
-- Temps réel (nouveaux messages, alertes…) : on ajoute les tables à la publication Supabase
-- =====================================================================================
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['messages', 'dm_messages', 'dm_threads', 'notifications', 'broadcasts', 'profiles', 'schedule',
                             'trip', 'trip_groups', 'roster', 'places', 'chat_meta', 'checkins', 'checkin_responses',
                             'help_requests']
    loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';

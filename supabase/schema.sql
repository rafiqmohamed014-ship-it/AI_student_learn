-- =====================================================================
--  Kalvi AI — Supabase schema
--  Run this once in the Supabase SQL editor (Dashboard → SQL Editor).
--  It creates every table, enables row-level security, and adds the
--  policies that guarantee a student can only ever see their own rows.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------- profiles --
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text,
  full_name        text not null default '',
  avatar_url       text,
  education_level  text not null default '',
  course           text not null default '',
  learning_level   text not null default 'intermediate',
  study_goal       text not null default '',
  subjects         jsonb not null default '[]'::jsonb,
  preferences      jsonb not null default '{}'::jsonb,
  timezone         text not null default 'UTC',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------- subjects --
create table if not exists public.subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text not null default '',
  color       text not null default '#ff7a00',
  emoji       text not null default '📘',
  custom      boolean not null default true,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists subjects_user_idx on public.subjects(user_id);

-- -------------------------------------------------------------- lessons --
create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  subject_id  text not null,            -- built-in subject id, or a subjects.id uuid
  title       text not null,
  summary     text not null default '',
  content     text not null default '',
  minutes     integer not null default 15,
  difficulty  text not null default 'intermediate',
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists lessons_user_subject_idx on public.lessons(user_id, subject_id);

-- ------------------------------------------------------- lesson progress --
create table if not exists public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  lesson_id     text not null,
  subject_id    text,
  completed     boolean not null default false,
  minutes_spent integer not null default 0,
  last_opened   timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- ----------------------------------------------------------------- notes --
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject_id text,
  subject    text not null default '',
  title      text not null default 'Untitled note',
  content    text not null default '',
  tags       jsonb not null default '[]'::jsonb,
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_idx on public.notes(user_id, updated_at desc);

-- --------------------------------------------------------------- quizzes --
create table if not exists public.quizzes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject_id text,
  title      text not null default 'Quiz',
  questions  jsonb not null default '[]'::jsonb,
  source     text not null default 'practice',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quizzes_user_idx on public.quizzes(user_id, created_at desc);

-- ---------------------------------------------------------- quiz results --
create table if not exists public.quiz_results (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  quiz_id       uuid references public.quizzes(id) on delete set null,
  subject_id    text,
  title         text not null default 'Quiz',
  total         integer not null default 0,
  correct_count integer not null default 0,
  score_pct     numeric(5,2) not null default 0,
  duration_sec  integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists quiz_results_user_idx on public.quiz_results(user_id, created_at desc);

-- ----------------------------------------------------- assessment attempts --
-- One row per finished timed assessment. Unlike quiz_results these are only
-- ever READ through the leaderboard function below, which is why the table
-- itself stays owner-only.
create table if not exists public.assessment_attempts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  subject           text not null default '',
  subject_id        text,
  topic             text not null default 'General',
  difficulty        text not null default 'medium',
  title             text not null default 'Assessment',
  total             integer not null default 0,
  correct_count     integer not null default 0,
  percentage        numeric(5,2) not null default 0,
  duration_seconds  integer not null default 0,
  time_limit_seconds integer not null default 0,
  answers           jsonb not null default '[]'::jsonb,
  wrong_topics      jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists assessment_attempts_user_idx
  on public.assessment_attempts(user_id, created_at desc);
-- supports the "best attempt per student" scan done by the leaderboard
create index if not exists assessment_attempts_best_idx
  on public.assessment_attempts(subject_id, correct_count desc, duration_seconds asc);

-- ------------------------------------------------------------- leaderboard --
-- The one place the app reads another student's data.
--
-- SECURITY DEFINER is required: every table above has owner-only RLS, so a
-- plain SELECT could never see a rival's score. This function runs as the
-- table owner and deliberately returns ONLY aggregated/public fields -
-- display name, avatar, counts, duration. It never returns `answers`,
-- `wrong_topics`, `email`, or per-question detail.
--
-- Ranking: most correct answers first, then fastest. p_subject_id lets the
-- page show a per-subject board; pass NULL for the all-subject board.
create or replace function public.assessment_leaderboard(
  p_limit     integer default 25,
  p_subject_id text   default null
)
returns table (
  rank              bigint,
  user_id           uuid,
  full_name         text,
  avatar_url        text,
  subject           text,
  subject_id        text,
  topic             text,
  difficulty        text,
  total             integer,
  correct_count     integer,
  percentage        numeric,
  duration_seconds  integer,
  time_limit_seconds integer,
  created_at        timestamptz
)
language sql
security definer
set search_path = public
as $$
  with best as (
    select distinct on (a.user_id)
      a.user_id, a.subject, a.subject_id, a.topic, a.difficulty,
      a.total, a.correct_count, a.percentage, a.duration_seconds,
      a.time_limit_seconds, a.created_at
    from public.assessment_attempts a
    where (p_subject_id is null or a.subject_id = p_subject_id)
    order by a.user_id, a.correct_count desc, a.duration_seconds asc, a.created_at desc
  )
  select
    row_number() over (order by b.correct_count desc, b.duration_seconds asc, b.created_at asc) as rank,
    b.user_id,
    coalesce(nullif(p.full_name, ''), split_part(coalesce(p.email, ''), '@', 1), 'Student') as full_name,
    p.avatar_url,
    b.subject, b.subject_id, b.topic, b.difficulty,
    b.total, b.correct_count, b.percentage, b.duration_seconds, b.time_limit_seconds, b.created_at
  from best b
  left join public.profiles p on p.id = b.user_id
  order by rank
  limit greatest(coalesce(p_limit, 25), 1);
$$;

revoke all on function public.assessment_leaderboard(integer, text) from public;
grant execute on function public.assessment_leaderboard(integer, text) to authenticated;

-- --------------------------------------------------------- study sessions --
create table if not exists public.study_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject_id text,
  lesson_id  text,
  minutes    integer not null default 0,
  source     text not null default 'study',
  created_at timestamptz not null default now()
);
create index if not exists study_sessions_user_idx on public.study_sessions(user_id, created_at desc);

-- ------------------------------------------------------------ study tasks --
create table if not exists public.study_tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  subject_id text,
  subject    text not null default '',
  minutes    integer not null default 15,
  done       boolean not null default false,
  due_date   timestamptz,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists study_tasks_user_idx on public.study_tasks(user_id, due_date);

-- ------------------------------------------------------- ai conversations --
create table if not exists public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'New chat',
  mode       text not null default 'chat',
  lesson_id  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_user_idx on public.ai_conversations(user_id, updated_at desc);

-- ------------------------------------------------------------ ai messages --
create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null default '',
  mode            text not null default 'chat',
  created_at      timestamptz not null default now()
);
create index if not exists ai_messages_convo_idx on public.ai_messages(conversation_id, created_at);

-- ------------------------------------------------------------ flashcards --
create table if not exists public.flashcards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject_id text,
  deck       text not null default 'General',
  front      text not null,
  back       text not null default '',
  hint       text not null default '',
  rating      text not null default '' check (rating in ('', 'easy', 'hard')),
  review_count integer not null default 0,
  last_reviewed timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists flashcards_user_deck_idx on public.flashcards(user_id, deck);

-- --------------------------------------------------------- notifications --
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  icon       text not null default '🔔',
  title      text not null,
  body       text not null default '',
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- ----------------------------------------------------------- study plans --
create table if not exists public.study_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  goal          text not null default '',
  exam_date     date,
  hours_per_day numeric(4,1) not null default 2,
  subjects      jsonb not null default '[]'::jsonb,
  days          jsonb not null default '[]'::jsonb,
  notes         text not null default '',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists study_plans_user_idx on public.study_plans(user_id, created_at desc);

-- =====================================================================
--  Row level security: every table is private to its owner.
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.subjects         enable row level security;
alter table public.lessons          enable row level security;
alter table public.lesson_progress  enable row level security;
alter table public.notes            enable row level security;
alter table public.quizzes          enable row level security;
alter table public.quiz_results     enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.study_sessions   enable row level security;
alter table public.study_tasks      enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages      enable row level security;
alter table public.flashcards       enable row level security;
alter table public.notifications    enable row level security;
alter table public.study_plans      enable row level security;

-- profiles: keyed by auth user id
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'profiles_own_all') then
    create policy profiles_own_all on public.profiles
      for all using (auth.uid() = id) with check (auth.uid() = id);
  end if;
end $$;

-- every other table: keyed by a user_id column
do $$
declare
  t text;
begin
  foreach t in array array[
    'subjects','lessons','lesson_progress','notes','quizzes','quiz_results',
    'study_sessions','study_tasks','ai_conversations','ai_messages',
    'flashcards','notifications','study_plans'
  ] loop
    if not exists (select 1 from pg_policies where policyname = t || '_own_all') then
      execute format(
        'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        t || '_own_all', t
      );
    end if;
  end loop;
end $$;

-- ========================================================== profile trigger
-- Create a profile row as soon as a student signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','subjects','lessons','notes','quizzes','study_tasks','ai_conversations'
  ] loop
    if not exists (select 1 from pg_triggers where tgname = t || '_touch') then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
        t || '_touch', t
      );
    end if;
  end loop;
end $$;

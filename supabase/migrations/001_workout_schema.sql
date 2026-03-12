-- Workout PWA Schema
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- PROFILES (mirrors auth.users)
-- ─────────────────────────────────────────────
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  avatar_url    text,
  google_calendar_connected boolean default false,
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────
-- WORKOUT PROGRAMS  (imported templates)
-- ─────────────────────────────────────────────
create table workout_programs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references profiles(id) on delete cascade not null,
  title         text not null,
  description   text,
  source_url    text,                     -- muscleandstrength.com URL or null
  source_type   text default 'manual',   -- 'url' | 'pdf' | 'manual'
  duration_weeks int,
  days_per_week  int,
  level         text,                     -- beginner | intermediate | advanced
  goal          text,                     -- strength | hypertrophy | endurance | fat_loss
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────
-- WORKOUT DAYS  (e.g. "Day 1 – Chest & Triceps")
-- ─────────────────────────────────────────────
create table workout_days (
  id            uuid primary key default uuid_generate_v4(),
  program_id    uuid references workout_programs(id) on delete cascade not null,
  week_number   int not null default 1,
  day_number    int not null,
  label         text,                     -- "Chest & Triceps"
  notes         text
);

-- ─────────────────────────────────────────────
-- EXERCISES  (within a workout day)
-- ─────────────────────────────────────────────
create table exercises (
  id            uuid primary key default uuid_generate_v4(),
  day_id        uuid references workout_days(id) on delete cascade not null,
  sort_order    int default 0,
  name          text not null,
  sets          int,
  reps          text,                     -- "3x10" or "8-12" or "AMRAP"
  weight_note   text,                     -- "bodyweight" | "RPE 8" | "70% 1RM"
  rest_seconds  int,
  notes         text,
  youtube_url   text                      -- YouTube guide video link
);

-- ─────────────────────────────────────────────
-- WORKOUT PLANS  (user schedules a program)
-- ─────────────────────────────────────────────
create table workout_plans (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references profiles(id) on delete cascade not null,
  program_id    uuid references workout_programs(id) on delete cascade not null,
  start_date    date not null,
  end_date      date,
  calendar_synced boolean default false,
  active        boolean default true,
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────
-- WORKOUT SESSIONS  (a user's single workout day)
-- ─────────────────────────────────────────────
create table workout_sessions (
  id            uuid primary key default uuid_generate_v4(),
  plan_id       uuid references workout_plans(id) on delete cascade not null,
  day_id        uuid references workout_days(id) on delete set null,
  user_id       uuid references profiles(id) on delete cascade not null,
  scheduled_date date not null,
  completed     boolean default false,
  completed_at  timestamptz,
  duration_minutes int,
  notes         text,
  calendar_event_id text                 -- Google Calendar event ID
);

-- ─────────────────────────────────────────────
-- EXERCISE LOGS  (actual sets performed)
-- ─────────────────────────────────────────────
create table exercise_logs (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid references workout_sessions(id) on delete cascade not null,
  exercise_id   uuid references exercises(id) on delete cascade not null,
  set_number    int not null,
  reps_done     int,
  weight_kg     numeric(6,2),
  completed     boolean default false,
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
create index on workout_programs(user_id);
create index on workout_days(program_id);
create index on exercises(day_id);
create index on workout_plans(user_id);
create index on workout_sessions(user_id, scheduled_date);
create index on exercise_logs(session_id);

-- ─────────────────────────────────────────────
-- RLS (Row Level Security)
-- ─────────────────────────────────────────────
alter table profiles           enable row level security;
alter table workout_programs   enable row level security;
alter table workout_days       enable row level security;
alter table exercises          enable row level security;
alter table workout_plans      enable row level security;
alter table workout_sessions   enable row level security;
alter table exercise_logs      enable row level security;

-- Profiles: users own their row
create policy "profiles_self" on profiles for all using (auth.uid() = id);

-- Programs: users own theirs
create policy "programs_own" on workout_programs for all using (auth.uid() = user_id);

-- Days & exercises: via program ownership
create policy "days_own" on workout_days for all
  using (program_id in (select id from workout_programs where user_id = auth.uid()));

create policy "exercises_own" on exercises for all
  using (day_id in (
    select d.id from workout_days d
    join workout_programs p on p.id = d.program_id
    where p.user_id = auth.uid()
  ));

-- Plans, sessions, logs
create policy "plans_own" on workout_plans for all using (auth.uid() = user_id);
create policy "sessions_own" on workout_sessions for all using (auth.uid() = user_id);
create policy "logs_own" on exercise_logs for all
  using (session_id in (select id from workout_sessions where user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGNUP
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

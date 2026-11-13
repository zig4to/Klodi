-- Klodi: živa seja — en tek GitHub Actions ostane prižgan (dev strežnik + Cloudflare tunel
-- kot predogled), prompti gredo v isto sejo, commit/push ob koncu seje.

create table if not exists public.cloud_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repo_id uuid not null references public.cloud_repos(id) on delete cascade,
  thread_id uuid not null references public.cloud_threads(id) on delete cascade,
  status text not null default 'starting' check (status in ('starting', 'ready', 'ending', 'ended', 'error')),
  token_hash text not null,                   -- sha256 žetona seje (velja tudi za teke v seji)
  preview_url text,                           -- https://….trycloudflare.com
  preview_hot boolean not null default false, -- dev strežnik s hot reloadom (sicer statični: osveži po teku)
  gh_run_id bigint,
  gh_run_url text,
  commit_sha text,
  commit_url text,
  pr_url text,
  error text,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists cloud_sessions_repo on public.cloud_sessions (repo_id, created_at desc);
-- največ ena odprta seja na pogovor
create unique index if not exists cloud_sessions_open on public.cloud_sessions (thread_id)
  where status in ('starting', 'ready', 'ending');

-- prompti v živi seji: vrstica v cloud_runs brez lastnega workflow_dispatch
alter table public.cloud_runs add column if not exists session_id uuid references public.cloud_sessions(id) on delete set null;
create index if not exists cloud_runs_session on public.cloud_runs (session_id, created_at) where session_id is not null;

alter table public.cloud_sessions enable row level security;
create policy cloud_sessions_select on public.cloud_sessions for select to authenticated
  using (user_id = auth.uid() and public.has_app_access('klodi'));

revoke all on public.cloud_sessions from authenticated, anon;
grant select (id, user_id, repo_id, thread_id, status, preview_url, preview_hot, gh_run_id, gh_run_url, commit_sha, commit_url, pr_url, error, last_activity_at, created_at, ended_at)
  on public.cloud_sessions to authenticated;
grant select (session_id) on public.cloud_runs to authenticated;

alter publication supabase_realtime add table public.cloud_sessions;

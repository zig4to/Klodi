-- Claude Cloud: Claude Code v GitHub Actions nad repozitoriji uporabnika.
-- Vsak uporabnik vidi samo svoje vrstice (RLS) in mora imeti app_access 'claudecloud'.
-- Pisanje gre (razen nastavitev repozitorija) prek strežnika s service role.

-- namestitve GitHub App "Claude Cloud" (ena na GitHub račun/organizacijo)
create table if not exists public.cloud_installations (
  installation_id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_login text not null,
  created_at timestamptz not null default now()
);

-- repozitoriji, ki jih je uporabnik omogočil
create table if not exists public.cloud_repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id bigint not null references public.cloud_installations(installation_id) on delete cascade,
  full_name text not null,                    -- "owner/repo"
  default_branch text not null default 'main',
  mode text not null default 'main' check (mode in ('main', 'pr')),
  auto boolean not null default true,         -- stikalo Samodejno
  deploy_url text,                            -- predogled
  accent text,
  accent2 text,
  icon text,                                  -- SVG poti (viewBox 0 0 24 24)
  workflow_installed_at timestamptz,
  secret_name text,                           -- CLAUDE_CODE_OAUTH_TOKEN ali ANTHROPIC_API_KEY (samo ime, nikoli vrednost)
  created_at timestamptz not null default now(),
  unique (user_id, full_name)
);

-- pogovor = ena Claude seja (--resume), "Nov pogovor" zapre starega
create table if not exists public.cloud_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repo_id uuid not null references public.cloud_repos(id) on delete cascade,
  session_id text,
  allowed jsonb not null default '[]'::jsonb, -- ukazi, dovoljeni z gumbom Dovoli
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cloud_threads_repo on public.cloud_threads (repo_id, created_at desc);

-- en prompt = en tek workflowa
create table if not exists public.cloud_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.cloud_threads(id) on delete cascade,
  prompt text not null,
  plan boolean not null default false,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error', 'cancelled')),
  token_hash text not null,                   -- sha256 enkratnega žetona teka (runner -> /api/runner/events)
  gh_run_id bigint,
  gh_run_url text,
  commit_sha text,
  commit_url text,
  pr_url text,
  result jsonb,                               -- { cost, ms, error, turns }
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists cloud_runs_thread on public.cloud_runs (thread_id, created_at);

-- elementi pogovora v obliki iz zaganjalnik/claude.js: {k:'text'|'tool'|'plan'|'deny'|'err'|'git', ...}
create table if not exists public.cloud_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.cloud_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seq int not null,
  item jsonb not null,
  created_at timestamptz not null default now(),
  unique (run_id, seq)
);

alter table public.cloud_installations enable row level security;
alter table public.cloud_repos enable row level security;
alter table public.cloud_threads enable row level security;
alter table public.cloud_runs enable row level security;
alter table public.cloud_events enable row level security;

create policy cloud_installations_select on public.cloud_installations for select to authenticated
  using (user_id = auth.uid() and public.has_app_access('claudecloud'));
create policy cloud_repos_select on public.cloud_repos for select to authenticated
  using (user_id = auth.uid() and public.has_app_access('claudecloud'));
create policy cloud_threads_select on public.cloud_threads for select to authenticated
  using (user_id = auth.uid() and public.has_app_access('claudecloud'));
create policy cloud_runs_select on public.cloud_runs for select to authenticated
  using (user_id = auth.uid() and public.has_app_access('claudecloud'));
create policy cloud_events_select on public.cloud_events for select to authenticated
  using (user_id = auth.uid() and public.has_app_access('claudecloud'));

-- token_hash ne sme do brskalnika
revoke select (token_hash) on public.cloud_runs from authenticated, anon;

alter publication supabase_realtime add table public.cloud_events;
alter publication supabase_realtime add table public.cloud_runs;

-- (izvedeno kot ločena migracija cloud_runs_hide_token) stolpčni revoke ne velja, dokler je
-- dovoljen SELECT na celo tabelo: zato tabelo odvzamemo in dovolimo stolpce brez token_hash.
revoke all on public.cloud_runs from authenticated, anon;
grant select (id, user_id, thread_id, prompt, plan, status, gh_run_id, gh_run_url, commit_sha, commit_url, pr_url, result, error, created_at, finished_at)
  on public.cloud_runs to authenticated;
revoke insert, update, delete, truncate on public.cloud_installations, public.cloud_repos, public.cloud_threads, public.cloud_events from authenticated, anon;

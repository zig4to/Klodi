-- Klodi: migracije baze. Claude migracijo samo napiše (supabase/migrations/*.sql v patchu),
-- job „objavi“ jo javi, uporabnik jo izvede s klikom → job „migriraj“ (svež stroj, edini s
-- secretom SUPABASE_DB_URL). Claude ima kvečjemu SUPABASE_DB_URL_RO (vloga brez pravic).

-- imena Supabase secretov v repozitoriju (vrednosti GitHub nikoli ne vrne)
alter table public.cloud_repos add column if not exists db_secrets text[] not null default '{}';

create table if not exists public.cloud_migrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repo_id uuid not null references public.cloud_repos(id) on delete cascade,
  thread_id uuid not null references public.cloud_threads(id) on delete cascade,
  run_id uuid references public.cloud_runs(id) on delete set null, -- tek, pod katerim je kartica
  session_id uuid references public.cloud_sessions(id) on delete set null,
  files jsonb not null,                       -- [{ path, sql, changed }] v vrstnem redu izvedbe
  status text not null default 'pending' check (status in ('pending', 'queued', 'running', 'done', 'error', 'rejected')),
  commit_sha text,
  pr_url text,                                -- način PR: izvede se šele po združitvi
  token_hash text,                            -- sha256 enkratnega žetona joba „migriraj“
  gh_run_id bigint,
  gh_run_url text,
  output text,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists cloud_migrations_repo on public.cloud_migrations (repo_id, created_at desc);

alter table public.cloud_migrations enable row level security;
create policy cloud_migrations_select on public.cloud_migrations for select to authenticated
  using (user_id = auth.uid() and public.has_app_access('klodi'));

revoke all on public.cloud_migrations from authenticated, anon;
grant select (id, user_id, repo_id, thread_id, run_id, session_id, files, status, commit_sha, pr_url, gh_run_id, gh_run_url, output, error, created_at, finished_at)
  on public.cloud_migrations to authenticated;

alter publication supabase_realtime add table public.cloud_migrations;

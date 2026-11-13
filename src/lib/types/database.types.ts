// Ročno napisani tipi za tabele Klodi (predpona `cloud_`).
// Ustrezajo supabase/migrations/. Ob vsaki novi migraciji jih posodobi.

type Table<Row, Required extends keyof Row> = {
  Relationships: [];
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
};

/** Element pogovora — ista oblika kot v zaganjalnik/claude.js. */
export type ChatItem =
  | { k: "text"; text: string }
  | { k: "plan"; text: string }
  | { k: "tool"; id?: string; tool: string; desc?: string }
  | { k: "deny"; tool: string; command: string; desc?: string; never?: boolean }
  | { k: "err"; text: string }
  | { k: "git"; text: string; url?: string };

export type RunResult = { cost?: number; ms?: number; error?: boolean; turns?: number } | null;
export type RunStatus = "queued" | "running" | "done" | "error" | "cancelled";

export type CloudInstallation = {
  installation_id: number;
  user_id: string;
  account_login: string;
  created_at: string;
};

export type CloudRepo = {
  id: string;
  user_id: string;
  installation_id: number;
  full_name: string;
  default_branch: string;
  mode: "main" | "pr";
  auto: boolean;
  deploy_url: string | null;
  accent: string | null;
  accent2: string | null;
  icon: string | null;
  workflow_installed_at: string | null;
  secret_name: string | null;
  created_at: string;
};

export type CloudThread = {
  id: string;
  user_id: string;
  repo_id: string;
  session_id: string | null;
  allowed: string[];
  closed_at: string | null;
  created_at: string;
};

export type CloudRun = {
  id: string;
  user_id: string;
  thread_id: string;
  prompt: string;
  plan: boolean;
  status: RunStatus;
  token_hash: string;
  gh_run_id: number | null;
  gh_run_url: string | null;
  commit_sha: string | null;
  commit_url: string | null;
  pr_url: string | null;
  result: RunResult;
  error: string | null;
  session_id: string | null;
  created_at: string;
  finished_at: string | null;
};

export type SessionStatus = "starting" | "ready" | "ending" | "ended" | "error";

/** Živa seja: en tek GitHub Actions z dev strežnikom in tunelom, več promptov. */
export type CloudSession = {
  id: string;
  user_id: string;
  repo_id: string;
  thread_id: string;
  status: SessionStatus;
  token_hash: string;
  preview_url: string | null;
  preview_hot: boolean;
  gh_run_id: number | null;
  gh_run_url: string | null;
  commit_sha: string | null;
  commit_url: string | null;
  pr_url: string | null;
  error: string | null;
  last_activity_at: string;
  created_at: string;
  ended_at: string | null;
};

export type CloudEvent = {
  id: number;
  run_id: string;
  user_id: string;
  seq: number;
  item: ChatItem;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      cloud_installations: Table<CloudInstallation, "installation_id" | "user_id" | "account_login">;
      cloud_repos: Table<CloudRepo, "user_id" | "installation_id" | "full_name">;
      cloud_threads: Table<CloudThread, "user_id" | "repo_id">;
      cloud_runs: Table<CloudRun, "user_id" | "thread_id" | "prompt" | "token_hash">;
      cloud_events: Table<CloudEvent, "run_id" | "user_id" | "seq" | "item">;
      cloud_sessions: Table<CloudSession, "user_id" | "repo_id" | "thread_id" | "token_hash">;
    };
    Views: Record<string, never>;
    Functions: {
      has_app_access: { Args: { p_app: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

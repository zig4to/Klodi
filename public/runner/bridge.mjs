// Claude Cloud runner: teče v GitHub Actions v repozitoriju uporabnika.
//   node bridge.mjs claude   — vzame nalogo z API-ja, zažene `claude -p` (stream-json) in sproti
//                              pošilja elemente pogovora (ista oblika kot zaganjalnik/claude.js)
//   node bridge.mjs finish   — commit + push v main ali veja + PR, javi rezultat
// Brez odvisnosti. Okolje: CC_API, CC_RUN, CC_TOKEN (+ GH_TOKEN, GITHUB_REPOSITORY samo pri finish).
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const API = process.env.CC_API, RUN = process.env.CC_RUN, TOKEN = process.env.CC_TOKEN;
const STATE = join(process.env.RUNNER_TEMP || "/tmp", "claude-cloud.json");
if (!API || !RUN || !TOKEN) { console.error("Manjka CC_API/CC_RUN/CC_TOKEN"); process.exit(1); }

async function post(path, body) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(API + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + TOKEN },
        body: JSON.stringify({ run_id: RUN, ...body }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) return d;
      if (r.status < 500) { const err = new Error(d.error || "HTTP " + r.status); err.fatal = true; throw err; }
    } catch (e) {
      if (i === 3 || e.fatal) throw e;
    }
    await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
  }
}

const short = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
const cwd = process.cwd();
const rel = (p) => { if (!p) return ""; const r = relative(cwd, p); return (r && !r.startsWith("..") ? r : p).replace(/\\/g, "/"); };
function describe(input) {
  input = input || {};
  if (input.command) return short(input.command, 140);
  if (input.file_path) return rel(input.file_path);
  if (input.pattern) return short(input.pattern, 80) + (input.path ? " · " + rel(input.path) : "");
  if (input.description) return short(input.description, 100);
  if (input.todos) return input.todos.length + " nalog";
  return "";
}

async function runClaude() {
  const job = await post("/api/runner/start", {
    gh_run_id: process.env.GITHUB_RUN_ID,
    gh_run_url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  });
  writeFileSync(STATE, JSON.stringify({ job }));

  const args = [...job.args];
  if (job.resume) args.push("--resume", job.resume);
  const env = { ...process.env };
  for (const k of ["CC_TOKEN", "GH_TOKEN", "GITHUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"]) delete env[k];
  if (!env.CLAUDE_CODE_OAUTH_TOKEN) delete env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!env.ANTHROPIC_API_KEY) delete env.ANTHROPIC_API_KEY;

  let queue = [], seq = 0, session = null, sentSession = null, result = null, flushing = Promise.resolve();
  let child = null, cancelled = false;
  const tools = {};
  const push = (item) => queue.push({ seq: seq++, item });
  function flush() {
    if (!queue.length && session === sentSession) return flushing;
    const items = queue; queue = []; sentSession = session;
    flushing = flushing.then(() => post("/api/runner/events", { items, session_id: session })).catch((e) => {
      console.error("events:", e.message);
      // tek je bil ustavljen na strani (410): ustavi Clauda
      if (e.fatal && child) { cancelled = true; child.kill("SIGTERM"); }
    });
    return flushing;
  }
  const timer = setInterval(flush, 600);

  function onLine(line) {
    let m; try { m = JSON.parse(line); } catch { return; }
    if (m.session_id) session = m.session_id;
    if (m.type === "assistant" && m.message?.content) {
      for (const c of m.message.content) {
        if (c.type === "text" && c.text.trim()) push({ k: "text", text: c.text });
        if (c.type === "tool_use") {
          const inp = c.input || {};
          tools[c.id] = { name: c.name, input: inp };
          const planText = c.name === "ExitPlanMode" ? inp.plan
            : c.name === "Write" && /[\\/]\.claude[\\/]plans[\\/][^\\/]+\.md$/i.test(inp.file_path || "") ? inp.content : null;
          if (planText) push({ k: "plan", text: planText });
          else if (c.name !== "ExitPlanMode") push({ k: "tool", id: c.id, tool: c.name, desc: describe(inp) });
        }
      }
    } else if (m.type === "system" && m.subtype === "permission_denied") {
      const t = tools[m.tool_use_id] || { name: m.tool_name, input: {} };
      t.denied = true;
      if (t.name === "ExitPlanMode") return;
      push({ k: "deny", tool: t.name, command: t.input?.command || "", desc: describe(t.input) });
    } else if (m.type === "result") {
      result = { cost: m.total_cost_usd, ms: m.duration_ms, error: !!m.is_error, turns: m.num_turns };
      // starejše različice ne pošiljajo permission_denied sproti
      for (const d of m.permission_denials || []) {
        if (d.tool_name === "ExitPlanMode") continue;
        if (!tools[d.tool_use_id]?.denied) {
          const inp = d.tool_input || {};
          push({ k: "deny", tool: d.tool_name, command: inp.command || "", desc: describe(inp) });
        }
      }
    }
  }

  const code = await new Promise((resolve) => {
    child = spawn(process.env.CLAUDE_BIN || "claude", args, { env, stdio: ["pipe", "pipe", "pipe"] });
    let buf = "", errBuf = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (d) => {
      buf += d;
      const lines = buf.split(/\r?\n/); buf = lines.pop();
      for (const l of lines) if (l.trim()) onLine(l);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (d) => { errBuf = (errBuf + d).slice(-2000); process.stderr.write(d); });
    let done = false;
    child.on("error", (e) => { if (done) return; done = true; push({ k: "err", text: "Claude Code se ni zagnal: " + e.message }); resolve(1); });
    child.on("close", (c) => {
      if (done) return; done = true;
      if (buf.trim()) onLine(buf);
      if (c && !result) push({ k: "err", text: short(errBuf, 600) || "Izhod " + c });
      resolve(c || 0);
    });
    child.stdin.end(job.prompt);
  });

  clearInterval(timer);
  await flush();
  if (cancelled) { writeFileSync(STATE, JSON.stringify({ cancelled: true })); return; }
  writeFileSync(STATE, JSON.stringify({ job, result, code, session }));
  if (job.mode === "plan" || code) {
    await post("/api/runner/finish", { result, status: code ? "error" : "done", session_id: session });
  }
}

function git(...a) { return execFileSync("git", a, { encoding: "utf8" }).trim(); }

async function finish() {
  if (!existsSync(STATE)) return;
  const st = JSON.parse(readFileSync(STATE, "utf8"));
  const { job, result, code, session } = st;
  if (!job || job.mode === "plan" || code) return; // že javljeno
  const out = { result, status: "done", session_id: session };
  try {
    git("config", "user.name", "Claude Cloud");
    git("config", "user.email", "claude-cloud@users.noreply.github.com");
    git("add", "-A");
    const staged = git("diff", "--cached", "--name-only");
    if (staged) git("commit", "-m", "Claude Cloud: " + short(job.prompt, 60), "-m", job.prompt.slice(0, 2000));
    const base = job.branch;
    const ahead = Number(git("rev-list", "--count", `origin/${base}..HEAD`) || 0);
    if (ahead > 0) {
      const repo = process.env.GITHUB_REPOSITORY;
      const remote = `https://x-access-token:${process.env.GH_TOKEN}@github.com/${repo}.git`;
      const sha = git("rev-parse", "HEAD");
      if (job.mode === "pr") {
        const branch = "claude/" + RUN.slice(0, 8);
        git("push", remote, `HEAD:refs/heads/${branch}`);
        const r = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
          method: "POST",
          headers: { Authorization: "Bearer " + process.env.GH_TOKEN, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Claude Cloud: " + short(job.prompt, 60), head: branch, base, body: job.prompt.slice(0, 4000) }),
        });
        const pr = await r.json();
        out.pr_url = pr.html_url || null;
        out.commit_sha = sha;
      } else {
        git("push", remote, `HEAD:refs/heads/${base}`);
        out.commit_sha = sha;
        out.commit_url = `https://github.com/${repo}/commit/${sha}`;
      }
    }
  } catch (e) {
    out.status = "error";
    out.error = short(String(e.stderr || e.message).replace(/x-access-token:[^@]+@/g, ""), 600);
  }
  await post("/api/runner/finish", out);
}

const cmd = process.argv[2];
(cmd === "finish" ? finish() : runClaude()).catch(async (e) => {
  console.error(e);
  try { await post("/api/runner/finish", { status: "error", error: short(e.message, 600) }); } catch {}
  process.exit(1);
});

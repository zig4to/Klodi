// Klodi runner: teče v GitHub Actions v repozitoriju uporabnika.
//   node bridge.mjs claude   — vzame nalogo z API-ja, zažene `claude -p` (stream-json) in sproti
//                              pošilja elemente pogovora (ista oblika kot zaganjalnik/claude.js)
//                              CC_LIVE=1: živa seja — dev strežnik + Cloudflare tunel (predogled),
//                              prompti iz vrste drug za drugim, dokler uporabnik ne konča ali 20 min nič
//   node bridge.mjs finish   — commit + push v main ali veja + PR, javi rezultat
// Brez odvisnosti. Okolje: CC_API, CC_RUN, CC_TOKEN (+ GH_TOKEN, GITHUB_REPOSITORY samo pri finish).
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, createWriteStream, chmodSync, statSync, createReadStream } from "node:fs";
import { createServer } from "node:http";
import { join, relative, resolve, extname, sep } from "node:path";

const API = process.env.CC_API, RUN = process.env.CC_RUN, TOKEN = process.env.CC_TOKEN;
const LIVE = process.env.CC_LIVE === "1";
const TMP = process.env.RUNNER_TEMP || "/tmp";
const STATE = join(TMP, "klodi.json");
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
      if (r.status < 500) { const err = new Error(d.error || "HTTP " + r.status); err.fatal = true; err.status = r.status; throw err; }
    } catch (e) {
      if (i === 3 || e.fatal) throw e;
    }
    await sleep(1000 * (i + 1));
  }
}
const session = (op, body = {}) => post("/api/runner/session", { op, ...body });

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
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

/** Okolje brez žetonov Klodija/GitHuba (za Clauda); `noClaude` odstrani še Claude poverilnice (dev strežnik). */
function cleanEnv(noClaude = false) {
  const env = { ...process.env };
  for (const k of ["CC_TOKEN", "GH_TOKEN", "GITHUB_TOKEN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_RESULTS_URL", "ACTIONS_CACHE_URL"]) delete env[k];
  if (!env.CLAUDE_CODE_OAUTH_TOKEN || noClaude) delete env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!env.ANTHROPIC_API_KEY || noClaude) delete env.ANTHROPIC_API_KEY;
  if (noClaude) for (const k of ["CC_API", "CC_RUN", "CC_LIVE"]) delete env[k];
  return env;
}

/**
 * En prompt: `claude -p` s sprotnim pošiljanjem elementov na /api/runner/events.
 * Vrne { result, code, session, cancelled }. cancelled = tek je bil ustavljen na strani (410).
 */
async function runPrompt(runId, job, extraArgs = []) {
  const args = [...job.args, ...extraArgs];
  if (job.resume) args.push("--resume", job.resume);
  const env = cleanEnv();

  let queue = [], seq = 0, sess = null, sentSession = null, result = null, flushing = Promise.resolve();
  let child = null, cancelled = false, lastPost = 0;
  const tools = {};
  const push = (item) => queue.push({ seq: seq++, item });
  function flush(force = false) {
    // vsaj vsakih 5 s (tudi prazno), da runner hitro izve za Ustavi
    if (!force && !queue.length && sess === sentSession && Date.now() - lastPost < 5000) return flushing;
    const items = queue; queue = []; sentSession = sess; lastPost = Date.now();
    flushing = flushing.then(() => post("/api/runner/events", { run_id: runId, items, session_id: sess })).catch((e) => {
      console.error("events:", e.message);
      // tek je bil ustavljen na strani (410): ustavi Clauda
      if (e.fatal && child) { cancelled = true; child.kill("SIGTERM"); }
    });
    return flushing;
  }
  const timer = setInterval(flush, 600);

  function onLine(line) {
    let m; try { m = JSON.parse(line); } catch { return; }
    if (m.session_id) sess = m.session_id;
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

  const code = await new Promise((resolveCode) => {
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
    child.on("error", (e) => { if (done) return; done = true; push({ k: "err", text: "Claude Code se ni zagnal: " + e.message }); resolveCode(1); });
    child.on("close", (c) => {
      if (done) return; done = true;
      if (buf.trim()) onLine(buf);
      if (c && !result && !cancelled) push({ k: "err", text: short(errBuf, 600) || "Izhod " + c });
      resolveCode(c || 0);
    });
    child.stdin.end(job.prompt);
  });

  clearInterval(timer);
  if (!cancelled) await flush(true);
  return { result, code, session: sess, cancelled };
}

// ---------- en prompt = en tek ----------
async function runClaude() {
  const job = await post("/api/runner/start", {
    gh_run_id: process.env.GITHUB_RUN_ID,
    gh_run_url: ghRunUrl(),
  });
  writeFileSync(STATE, JSON.stringify({ job }));
  const { result, code, session: sess, cancelled } = await runPrompt(RUN, job);
  if (cancelled) { writeFileSync(STATE, JSON.stringify({ cancelled: true })); return; }
  writeFileSync(STATE, JSON.stringify({ job, result, code, session: sess }));
  if (job.mode === "plan" || code) {
    await post("/api/runner/finish", { result, status: code ? "error" : "done", session_id: sess });
  }
}

const ghRunUrl = () => `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;

// ---------- živa seja ----------
const procs = [];
const strip = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");

/** Zažene ukaz, izpis v dnevnik; razreši ob izhodu (napaka, če koda ni 0). */
function runTo(log, cmd, args, env) {
  return new Promise((res, rej) => {
    log.write(`\n$ ${cmd} ${args.join(" ")}\n`);
    const p = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    p.stdout.on("data", (d) => log.write(d));
    p.stderr.on("data", (d) => log.write(d));
    p.on("error", rej);
    p.on("close", (c) => (c ? rej(new Error(`${cmd} ${args.join(" ")}: izhod ${c}`)) : res()));
  });
}

/** Proces v ozadju; razreši, ko izpis ujame `re` (vrne zadetek), ali zavrne po `ms`. */
function background(log, cmd, args, env, re, ms) {
  return new Promise((res, rej) => {
    log.write(`\n$ ${cmd} ${args.join(" ")}\n`);
    const p = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    procs.push(p);
    let seen = "", done = false;
    const t = setTimeout(() => { if (!done) { done = true; rej(new Error(`${cmd}: ni odgovora v ${ms / 1000} s`)); } }, ms);
    const on = (d) => {
      log.write(d);
      if (done) return;
      seen = (seen + strip(String(d))).slice(-4000);
      const m = re.exec(seen);
      if (m) { done = true; clearTimeout(t); res(m); }
    };
    p.stdout.on("data", on);
    p.stderr.on("data", on);
    p.on("error", (e) => { if (!done) { done = true; clearTimeout(t); rej(e); } });
    p.on("close", (c) => { if (!done) { done = true; clearTimeout(t); rej(new Error(`${cmd} se je ustavil (izhod ${c}). Glej dnevnik.`)); } });
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2",
  ".woff": "font/woff", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".wasm": "application/wasm",
};

/** Statični strežnik za aplikacije brez `npm run dev` (GH Pages). Brez predpomnjenja, brez skritih datotek. */
function staticServer(port) {
  return new Promise((res) => {
    const root = resolve(cwd);
    const srv = createServer((req, rsp) => {
      let p = decodeURIComponent((req.url || "/").split("?")[0]);
      if (p.split("/").some((seg) => seg.startsWith("."))) { rsp.writeHead(404); return rsp.end("404"); }
      let f = resolve(root, "." + p);
      if (f !== root && !f.startsWith(root + sep)) { rsp.writeHead(403); return rsp.end(); }
      try { if (statSync(f).isDirectory()) f = join(f, "index.html"); } catch {}
      if (!existsSync(f)) { rsp.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return rsp.end("404 " + p); }
      rsp.writeHead(200, { "Content-Type": MIME[extname(f).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
      createReadStream(f).pipe(rsp);
    });
    srv.listen(port, "127.0.0.1", () => res(srv));
  });
}

/** Dev strežnik: `npm run dev` (port iz izpisa) ali statični strežnik. */
async function startDev(log, extraEnv) {
  const env = { ...cleanEnv(true), ...extraEnv, BROWSER: "none", PORT: "3000", CI: "", NEXT_TELEMETRY_DISABLED: "1" };
  let pkg = null;
  try { pkg = JSON.parse(readFileSync("package.json", "utf8")); } catch {}
  if (pkg?.scripts?.dev) {
    if (existsSync("package-lock.json")) await runTo(log, "npm", ["ci", "--no-audit", "--no-fund"], env);
    else await runTo(log, "npm", ["install", "--no-audit", "--no-fund", "--no-package-lock"], env);
    const m = await background(log, "npm", ["run", "dev"], env,
      /(https?):\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]|[\w.-]+):(\d{2,5})/, 240_000);
    return { port: Number(m[2]), https: m[1] === "https", hot: true };
  }
  await staticServer(8080);
  log.write("\nstatični strežnik: http://127.0.0.1:8080\n");
  return { port: 8080, https: false, hot: false };
}

// Predogled je iframe na tuji strani (Klodi): piškotki SameSite=Lax (privzeto
// v @supabase/ssr) se iz okvirja ne pošiljajo, zato bi middleware ob vsakem
// kliku izgubil prijavo. Proxy jih prepiše v `SameSite=None; Secure;
// Partitioned` (CHIPS — deluje tudi ob blokiranih piškotkih tretjih strani):
// Set-Cookie iz strežnika in document.cookie (skripta, vstavljena v HTML).
const COOKIE_ATTRS = "; SameSite=None; Secure; Partitioned";
const fixCookie = (c) => String(c).replace(/;\s*(samesite|secure|partitioned)(=[^;]*)?/gi, "") + COOKIE_ATTRS;
const COOKIE_JS = `<script>(function(){try{var d=Object.getOwnPropertyDescriptor(Document.prototype,"cookie");if(!d||!d.set)return;` +
  `Object.defineProperty(document,"cookie",{configurable:true,get:function(){return d.get.call(document)},` +
  `set:function(v){d.set.call(document,String(v).replace(/;\\s*(samesite|secure|partitioned)(=[^;]*)?/gi,"")+${JSON.stringify(COOKIE_ATTRS)})}})}catch(e){}})();</script>`;

/** Proxy pred dev strežnikom (port 8787): piškotki za iframe, Location brez localhost, WebSocket (HMR). */
async function startProxy(log, dev) {
  const { request: httpReq } = await import("node:http");
  const { request: httpsReq } = await import("node:https");
  const { connect: tlsConnect } = await import("node:tls");
  const { connect: netConnect } = await import("node:net");
  const request = dev.https ? httpsReq : httpReq;
  const host = `localhost:${dev.port}`;
  const localRe = new RegExp(`^https?://(?:localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0):${dev.port}(?=/|$)`, "i");
  const PORT = 8787;

  const srv = createServer((req, rsp) => {
    const headers = { ...req.headers, host };
    delete headers["accept-encoding"]; // HTML moramo brati (skripta)
    const up = request({ host: "127.0.0.1", port: dev.port, method: req.method, path: req.url, headers, rejectUnauthorized: false, servername: "localhost" }, (r) => {
      const h = { ...r.headers };
      if (h["set-cookie"]) h["set-cookie"] = [].concat(h["set-cookie"]).map(fixCookie);
      if (typeof h.location === "string") h.location = h.location.replace(localRe, "") || "/";
      const html = /^text\/html/i.test(String(h["content-type"] || "")) && !h["content-encoding"];
      if (!html) { rsp.writeHead(r.statusCode || 502, r.statusMessage, h); r.pipe(rsp); return; }
      delete h["content-length"];
      rsp.writeHead(r.statusCode || 502, r.statusMessage, h);
      // skripta takoj za <head> (pred skriptami aplikacije); HTML ostane pretočen
      let done = false, buf = "";
      r.setEncoding("utf8");
      r.on("data", (d) => {
        if (rsp.writableEnded) return;
        if (done) return rsp.write(d);
        buf += d;
        const m = /<head[^>]*>/i.exec(buf);
        if (m) { done = true; rsp.write(buf.slice(0, m.index + m[0].length) + COOKIE_JS + buf.slice(m.index + m[0].length)); buf = ""; }
        else if (buf.length > 64_000) { done = true; rsp.write(COOKIE_JS + buf); buf = ""; }
      });
      r.on("end", () => { if (rsp.writableEnded) return; if (buf) rsp.write(done ? buf : COOKIE_JS + buf); rsp.end(); });
      r.on("error", () => rsp.destroy());
    });
    up.on("error", (e) => { if (!rsp.headersSent) rsp.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" }); rsp.end("Dev strežnik ne odgovarja: " + e.message); });
    req.pipe(up);
  });

  // WebSocket (HMR): surovo prepletanje, glava z zamenjanim Host
  srv.on("upgrade", (req, sock, head) => {
    const s = dev.https ? tlsConnect({ host: "127.0.0.1", port: dev.port, rejectUnauthorized: false, servername: "localhost" }) : netConnect(dev.port, "127.0.0.1");
    s.on("error", () => sock.destroy());
    sock.on("error", () => s.destroy());
    s.once(dev.https ? "secureConnect" : "connect", () => {
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const k = req.rawHeaders[i];
        lines.push(`${k}: ${k.toLowerCase() === "host" ? host : req.rawHeaders[i + 1]}`);
      }
      s.write(lines.join("\r\n") + "\r\n\r\n");
      if (head?.length) s.write(head);
      s.pipe(sock);
      sock.pipe(s);
    });
  });

  await new Promise((res) => srv.listen(PORT, "127.0.0.1", res));
  log.write(`\nproxy za predogled: http://127.0.0.1:${PORT} → ${dev.https ? "https" : "http"}://${host}\n`);
  return PORT;
}

/** Cloudflare quick tunnel (brez računa): vrne https://….trycloudflare.com */
async function startTunnel(log, dev) {
  const bin = join(TMP, "cloudflared");
  if (!existsSync(bin)) {
    const r = await fetch("https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64");
    if (!r.ok) throw new Error("cloudflared: prenos ni uspel (" + r.status + ")");
    writeFileSync(bin, Buffer.from(await r.arrayBuffer()));
    chmodSync(bin, 0o755);
  }
  // tunel → proxy (piškotki za iframe) → dev strežnik; ob napaki proxyja neposredno
  let args;
  try {
    const port = await startProxy(log, dev);
    args = ["tunnel", "--no-autoupdate", "--url", `http://localhost:${port}`];
  } catch (e) {
    log.write(`\nproxy ni uspel (${e.message}), tunel neposredno na dev strežnik\n`);
    args = ["tunnel", "--no-autoupdate", "--url", `${dev.https ? "https" : "http"}://localhost:${dev.port}`, "--http-host-header", `localhost:${dev.port}`];
    if (dev.https) args.push("--no-tls-verify");
  }
  const m = await background(log, bin, args, cleanEnv(true), /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/, 90_000);
  return m[0];
}

async function live() {
  const MAX_MS = 340 * 60_000; // workflow timeout je 360 min: pusti čas za objavo
  const t0 = Date.now();
  const start = await session("start", { gh_run_id: process.env.GITHUB_RUN_ID, gh_run_url: ghRunUrl() });
  const state = { live: true, start, prompts: [] };
  const save = () => writeFileSync(STATE, JSON.stringify(state));
  save();

  // predogled: napaka ne ustavi seje (Claude dela naprej, le brez predogleda)
  const logPath = join(TMP, "dev.log");
  const log = createWriteStream(logPath, { flags: "a" });
  let dev = null;
  try {
    dev = await startDev(log, start.env || {});
    const url = await startTunnel(log, dev);
    // tunel potrebuje nekaj sekund, preden DNS deluje
    for (let i = 0; i < 15; i++) {
      try { const r = await fetch(url, { method: "HEAD" }); if (r.status < 530) break; } catch {}
      await sleep(2000);
    }
    await session("preview", { url, hot: dev.hot });
  } catch (e) {
    console.error("predogled:", e);
    await session("preview", { url: null, error: "Predogled se ni zagnal: " + short(e.message, 400) }).catch(() => {});
  }

  const sys = [
    "Teče živa seja Klodi: uporabnik vidi aplikacijo v živo v predogledu.",
    dev ? `Dev strežnik že teče na ${dev.https ? "https" : "http"}://localhost:${dev.port}${dev.hot ? " s hot reloadom" : " (statične datoteke, predogled se osveži po vsakem odgovoru)"}; dnevnik je v ${logPath}. Ne zaganjaj ga znova in ga ne ustavljaj.` : "",
    "Ne commitaj in ne pushaj: vse spremembe seje se objavijo ob koncu seje.",
  ].filter(Boolean).join(" ");

  while (Date.now() - t0 < MAX_MS) {
    let n;
    try { n = await session("next"); }
    catch (e) { if (e.fatal) break; await sleep(5000); continue; }
    if (n.end) break;
    if (!n.run) { await sleep(3000); continue; }
    state.prompts.push(n.run.prompt);
    save();
    const r = await runPrompt(n.run.id, n.run, ["--append-system-prompt", sys]);
    if (!r.cancelled) {
      await post("/api/runner/finish", { run_id: n.run.id, result: r.result, status: r.code ? "error" : "done", session_id: r.session })
        .catch((e) => console.error("finish:", e.message));
    }
  }
  for (const p of procs) { try { p.kill("SIGTERM"); } catch {} }
  log.end();
  save();
}

// ---------- objava ----------
function git(...a) { return execFileSync("git", a, { encoding: "utf8" }).trim(); }

/** Commit (če so spremembe) + push v base ali v vejo `branch` + PR. */
async function publish({ base, mode, branch, title, message }) {
  const out = {};
  git("config", "user.name", "Klodi");
  git("config", "user.email", "klodi@users.noreply.github.com");
  git("add", "-A");
  const staged = git("diff", "--cached", "--name-only");
  if (staged) git("commit", "-m", title, "-m", message);
  const ahead = Number(git("rev-list", "--count", `origin/${base}..HEAD`) || 0);
  if (ahead > 0) {
    const repo = process.env.GITHUB_REPOSITORY;
    const remote = `https://x-access-token:${process.env.GH_TOKEN}@github.com/${repo}.git`;
    const sha = git("rev-parse", "HEAD");
    if (mode === "pr") {
      git("push", remote, `HEAD:refs/heads/${branch}`);
      const r = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.GH_TOKEN, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({ title, head: branch, base, body: message.slice(0, 4000) }),
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
  return out;
}
const scrub = (e) => short(String(e.stderr || e.message).replace(/x-access-token:[^@]+@/g, ""), 600);

async function finish() {
  if (!existsSync(STATE)) return;
  const st = JSON.parse(readFileSync(STATE, "utf8"));

  if (st.live) {
    const { start, prompts } = st;
    let out = {};
    try {
      out = await publish({
        base: start.branch,
        mode: start.mode,
        branch: "klodi/" + RUN.slice(0, 8),
        title: "Klodi (živa seja): " + short(prompts[0] || "spremembe", 60),
        message: prompts.map((p, i) => `${i + 1}. ${short(p, 400)}`).join("\n").slice(0, 4000) || "Živa seja",
      });
    } catch (e) {
      out = { error: scrub(e) };
    }
    await session("finish", out);
    return;
  }

  const { job, result, code, session: sess } = st;
  if (!job || job.mode === "plan" || code) return; // že javljeno
  const out = { result, status: "done", session_id: sess };
  try {
    Object.assign(out, await publish({
      base: job.branch,
      mode: job.mode,
      branch: "klodi/" + RUN.slice(0, 8),
      title: "Klodi: " + short(job.prompt, 60),
      message: job.prompt.slice(0, 2000),
    }));
  } catch (e) {
    out.status = "error";
    out.error = scrub(e);
  }
  await post("/api/runner/finish", out);
}

const cmd = process.argv[2];
(cmd === "finish" ? finish() : LIVE ? live() : runClaude()).then(() => {
  if (LIVE && cmd !== "finish") process.exit(0); // otroški procesi (tunel) ne smejo držati koraka
}).catch(async (e) => {
  console.error(e);
  try {
    if (LIVE) await session("finish", { error: short(e.message, 600) });
    else await post("/api/runner/finish", { status: "error", error: short(e.message, 600) });
  } catch {}
  process.exit(1);
});

"use client";

import "./chat.css";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ChatItem, CloudEvent, CloudRepo, CloudRun, CloudSession, CloudThread, RunResult } from "@/lib/types/database.types";
import { esc, md } from "./md";
import { inSuite } from "@/lib/suite";

// Pogovor s Claudom za en repozitorij — isti videz in funkcije kot Live Claude
// (zaganjalnik/claude.html), le da Claude teče v GitHub Actions, dogodki pa
// pridejo prek Supabase Realtime.

const ICON: Record<string, string> = {
  send: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  Bash: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  Edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  Read: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  Grep: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  TodoWrite: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  branch: '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  plan: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  other: '<circle cx="12" cy="12" r="3"/>',
};
ICON.Write = ICON.Edit;
ICON.MultiEdit = ICON.Edit;
ICON.NotebookEdit = ICON.Edit;
ICON.Glob = ICON.Grep;

const ICO_UP = '<path d="m18 15-6-6-6 6"/>';
const ICO_DOWN = '<path d="m6 9 6 6 6-6"/>';
// Lucide radio — živa seja
const ICO_LIVE = '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>';
const SESSION_COLS = "id,user_id,repo_id,thread_id,status,preview_url,preview_hot,gh_run_id,gh_run_url,commit_sha,commit_url,pr_url,error,last_activity_at,created_at,ended_at";
const OPEN = (s?: CloudSession | null) => !!s && (s.status === "starting" || s.status === "ready" || s.status === "ending");

function Svg({ p, className = "i", id }: { p: string; className?: string; id?: string }) {
  return <svg className={className} id={id} viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: p }} />;
}

function store(k: string, v?: string): string | null {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {}
  return null;
}

async function api(path: string, body: unknown, method = "POST") {
  const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Napaka ${r.status}`);
  return d;
}

const ACTIVE = (r?: CloudRun) => !!r && (r.status === "queued" || r.status === "running");

type Props = { repo: CloudRepo; title: string; userId: string };
type Note = { after: string | null; text: string; err?: boolean };

export default function CloudChat({ repo: initialRepo, title, userId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [repo, setRepo] = useState(initialRepo);
  const [threads, setThreads] = useState<CloudThread[]>([]);
  const [runs, setRuns] = useState<CloudRun[]>([]);
  const [events, setEvents] = useState<Record<string, CloudEvent[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [denied, setDenied] = useState<Record<number, "allowed" | "rejected">>({});
  const [plan, setPlanState] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [live, setLive] = useState<CloudSession | null>(null);
  const [sso, setSso] = useState<{ key: number; hash: string } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLElement>(null);
  const pvRef = useRef<HTMLElement>(null);
  const gripRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const threadIds = useRef<Set<string>>(new Set());
  const runIds = useRef<Set<string>>(new Set());

  const accent = repo.accent || "#0ea5e9";
  const accent2 = repo.accent2 || "#6366f1";
  const K = "cc-" + repo.id;

  // ---------- podatki ----------
  const load = useCallback(async () => {
    const { data: th } = await supabase.from("cloud_threads").select("*").eq("repo_id", repo.id)
      .order("created_at", { ascending: false }).limit(10);
    const ts = (th || []).reverse();
    const ids = ts.map((t) => t.id);
    let rs: CloudRun[] = [];
    if (ids.length) {
      const { data } = await supabase.from("cloud_runs")
        .select("id,user_id,thread_id,prompt,plan,status,gh_run_id,gh_run_url,commit_sha,commit_url,pr_url,result,error,session_id,created_at,finished_at")
        .in("thread_id", ids).order("created_at", { ascending: false }).limit(25);
      rs = ((data || []) as CloudRun[]).reverse();
    }
    const { data: ss } = await supabase.from("cloud_sessions").select(SESSION_COLS).eq("repo_id", repo.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    setLive((ss as CloudSession | null) ?? null);
    const ev: Record<string, CloudEvent[]> = {};
    if (rs.length) {
      const { data } = await supabase.from("cloud_events").select("*").in("run_id", rs.map((r) => r.id))
        .order("seq").limit(5000);
      for (const e of (data || []) as CloudEvent[]) (ev[e.run_id] ||= []).push(e);
    }
    threadIds.current = new Set(ids);
    runIds.current = new Set(rs.map((r) => r.id));
    setThreads(ts);
    setRuns(rs);
    setEvents(ev);
    setLoaded(true);
  }, [supabase, repo.id]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    const channel = supabase
      .channel("cc-" + repo.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "cloud_runs", filter: `user_id=eq.${userId}` }, (p) => {
        const r = p.new as CloudRun;
        if (!r?.thread_id || !threadIds.current.has(r.thread_id) || !runIds.current.has(r.id)) {
          if (r?.thread_id) load(); // nov tek ali nov pogovor: preberi znova
          return;
        }
        setRuns((cur) => cur.map((x) => (x.id === r.id ? { ...x, ...r } : x)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cloud_events", filter: `user_id=eq.${userId}` }, (p) => {
        const e = p.new as CloudEvent;
        if (!runIds.current.has(e.run_id)) return;
        setEvents((cur) => {
          const list = cur[e.run_id] || [];
          if (list.some((x) => x.seq === e.seq)) return cur;
          return { ...cur, [e.run_id]: [...list, e].sort((a, b) => a.seq - b.seq) };
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cloud_sessions", filter: `user_id=eq.${userId}` }, (p) => {
        const s = p.new as CloudSession;
        if (s?.repo_id !== repo.id) return;
        setLive((cur) => (!cur || cur.id === s.id || Date.parse(s.created_at) >= Date.parse(cur.created_at) ? { ...cur, ...s } : cur));
      })
      .subscribe();
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(t);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [supabase, repo.id, userId, load]);

  const lastRun = runs[runs.length - 1];
  const openThread = threads.length && !threads[threads.length - 1].closed_at ? threads[threads.length - 1] : null;
  const running = ACTIVE(lastRun);
  const liveOpen = OPEN(live) && !!openThread && live!.thread_id === openThread.id;
  const liveStatus = liveOpen ? live!.status : null;

  // rezerva, če Realtime zamudi: med tekom (in med zagonom/koncem žive seje) preveri vsakih 8 s
  const polling = running || liveStatus === "starting" || liveStatus === "ending";
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [polling, load]);

  // živa seja brez hot reloada (statične datoteke): osveži predogled po vsakem odgovoru
  const liveCold = liveStatus === "ready" && !!live?.preview_url && !live.preview_hot;
  const lastLiveDone = lastRun?.session_id && !ACTIVE(lastRun) ? lastRun.id : null;
  useEffect(() => {
    if (!liveCold || !lastLiveDone) return;
    const t = setTimeout(() => setFrameKey((k) => k + 1), 500);
    return () => clearTimeout(t);
  }, [liveCold, lastLiveDone]);

  // Predogled je iframe na drugi strani (vercel.app/github.io): aplikaciji iz
  // zbirke (isti Supabase) podamo prijavo kot hub — #sb_at=…&sb_rt=… —, da se
  // v okvirju prijavi sama. Ob vsakem novem nalaganju okvirja (frameKey) sveža.
  const suiteApp = inSuite(repo.full_name);
  useEffect(() => {
    if (!suiteApp) return;
    let off = false;
    supabase.auth.getSession().then(({ data }) => {
      if (off) return;
      const s = data.session;
      setSso({
        key: frameKey,
        hash: s ? `#sb_at=${encodeURIComponent(s.access_token)}&sb_rt=${encodeURIComponent(s.refresh_token)}` : "",
      });
    });
    return () => {
      off = true;
    };
  }, [supabase, suiteApp, frameKey]);
  const ssoReady = !suiteApp || sso?.key === frameKey;

  // po objavi v main: predogled osveži, ko deploy verjetno konča
  const lastCommit = lastRun?.commit_sha;
  useEffect(() => {
    if (!lastCommit || !repo.deploy_url) return;
    const a = setTimeout(() => setFrameKey((k) => k + 1), 45_000);
    const b = setTimeout(() => setFrameKey((k) => k + 1), 120_000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [lastCommit, repo.deploy_url]);

  // ---------- drsenje ----------
  useEffect(() => {
    const chat = chatRef.current;
    if (!chat) return;
    if (nearBottom.current) chat.scrollTop = chat.scrollHeight;
  }, [runs, events, notes, loaded]);

  // ---------- nastavitve iz localStorage ----------
  useEffect(() => {
    const t = setTimeout(() => {
      setPlanState(store(K + "-plan") === "1");
      setPrompt(store(K + "-draft") || "");
      setNavHidden(store("cc-nav-hidden") === "1");
    }, 0);
    return () => clearTimeout(t);
  }, [K]);

  function setPlan(on: boolean) {
    setPlanState(on);
    store(K + "-plan", on ? "1" : "0");
  }

  // ---------- predogled: puščica skrije glavo (telefon in računalnik) ----------
  function toggleHide() {
    store("cc-nav-hidden", navHidden ? "0" : "1");
    setNavHidden(!navHidden);
  }

  // ---------- ročaj (iz claude.html) ----------
  useEffect(() => {
    const root = rootRef.current, pv = pvRef.current, grip = gripRef.current, chat = chatRef.current, form = formRef.current;
    if (!root || !pv || !grip || !chat || !form) return;
    const wide = window.matchMedia("(min-width: 900px)");
    const saved = store("cc-pv");
    if (saved === "min") root.classList.add("chat-min");
    else if (saved) root.style.setProperty("--pv", saved);
    const SNAP = 120;
    const applyWide = () => {
      const w = store("cc-pvw");
      root.style.gridTemplateColumns = wide.matches && w ? `minmax(0, ${w}fr) 16px minmax(340px, 1fr)` : "";
    };
    applyWide();
    wide.addEventListener("change", applyWide);
    const maxPv = (full?: boolean) => {
      const cs = getComputedStyle(chat);
      const pad = full ? 0 : parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      return innerHeight - pv.getBoundingClientRect().top - grip.offsetHeight - form.offsetHeight - pad;
    };
    let drag = false, pvH = 0;
    const frame = () => frameRef.current;
    const down = (e: PointerEvent) => {
      drag = true;
      grip.classList.add("drag");
      grip.setPointerCapture(e.pointerId);
      const f = frame();
      if (f) f.style.pointerEvents = "none";
      if (!wide.matches) {
        pv.classList.remove("snap");
        pvH = pv.getBoundingClientRect().height;
        if (root.classList.contains("chat-min")) {
          root.style.setProperty("--pv", pvH + "px");
          root.classList.remove("chat-min");
        }
      }
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      if (wide.matches) {
        const f = Math.min(4, Math.max(0.6, e.clientX / Math.max(1, innerWidth - e.clientX)));
        store("cc-pvw", f.toFixed(2));
        applyWide();
      } else {
        const top = pv.getBoundingClientRect().top;
        pvH = Math.min(maxPv(), Math.max(innerHeight * 0.15, e.clientY - top - grip.offsetHeight / 2));
        root.style.setProperty("--pv", pvH + "px");
      }
    };
    const end = () => {
      if (drag && !wide.matches) {
        const max = maxPv();
        pv.classList.add("snap");
        if (max - pvH < SNAP) {
          root.classList.add("chat-closing");
          root.style.setProperty("--pv", maxPv(true) + "px");
          setTimeout(() => {
            pv.classList.remove("snap");
            root.classList.remove("chat-closing");
            root.classList.add("chat-min");
          }, 330);
          store("cc-pv", "min");
        } else {
          const pct = ((pvH / root.clientHeight) * 100).toFixed(1) + "%";
          root.style.setProperty("--pv", pct);
          store("cc-pv", pct);
        }
      }
      drag = false;
      grip.classList.remove("drag");
      const f = frame();
      if (f) f.style.pointerEvents = "";
    };
    grip.addEventListener("pointerdown", down);
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
    return () => {
      wide.removeEventListener("change", applyWide);
      grip.removeEventListener("pointerdown", down);
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", end);
      grip.removeEventListener("pointercancel", end);
    };
  }, []);

  // ---------- dejanja ----------
  function note(text: string, err = false) {
    setNotes((n) => [...n, { after: lastRun?.id ?? null, text, err }]);
  }
  async function call(path: string, body: Record<string, unknown> = {}) {
    try {
      const d = await api(path, { repo_id: repo.id, ...body });
      await load();
      return d;
    } catch (e) {
      note((e as Error).message, true);
      throw e;
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (running) {
      call("/api/stop").catch(() => {});
      return;
    }
    const text = prompt.trim();
    if (!text || sending) return;
    setSending(true);
    nearBottom.current = true;
    try {
      await call("/api/run", { prompt: text, plan });
      setPrompt("");
      store(K + "-draft", "");
    } catch {
    } finally {
      setSending(false);
    }
  }

  async function toggleAuto() {
    const on = !repo.auto;
    try {
      await api("/api/repos", { repo_id: repo.id, auto: on }, "PATCH");
      setRepo({ ...repo, auto: on });
      note(on ? "Samodejno vklopljeno: Claude sme vse razen nevarnih ukazov." : "Samodejno izklopljeno: za ukaze bo vprašal.");
    } catch (e) {
      note((e as Error).message, true);
    }
  }

  async function toggleLive() {
    try {
      if (liveOpen) {
        await call("/api/live", { op: "end" });
        note(liveStatus === "starting" ? "Živa seja preklicana." : "Končujem živo sejo: spremembe gredo " + (repo.mode === "pr" ? "v pull request." : "v " + repo.default_branch + "."));
      } else {
        await call("/api/live", { op: "start" });
        note("Zaganjam živo sejo (1–2 min). Prompte lahko pišeš že zdaj; spremembe se objavijo, ko klikneš Končaj ali po 20 min brez dela.");
      }
    } catch {}
  }

  function grow() {
    const t = taRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(160, t.scrollHeight) + "px";
  }
  useEffect(grow, [prompt]);

  // ---------- izris ----------
  const ready = !!repo.workflow_installed_at && !!repo.secret_name;

  function renderItems(run: CloudRun, live: boolean) {
    const list = events[run.id] || [];
    const out: React.ReactNode[] = [];
    let tools: CloudEvent[] = [];
    const flushTools = (key: string) => {
      if (!tools.length) return;
      out.push(
        <div className="tools" key={"t" + key}>
          {tools.map((t) => {
            const it = t.item as Extract<ChatItem, { k: "tool" }>;
            return (
              <div className="tool" key={t.id}>
                <Svg p={ICON[it.tool] || ICON.other} />
                <b>{it.tool}</b>
                <span>{it.desc || ""}</span>
              </div>
            );
          })}
        </div>,
      );
      tools = [];
    };
    for (const e of list) {
      const it = e.item;
      if (it.k === "tool") {
        tools.push(e);
        continue;
      }
      flushTools(String(e.id));
      if (it.k === "plan") {
        out.push(
          <div className="plan" key={e.id}>
            <div className="plan-h"><Svg p={ICON.plan} />Načrt</div>
            <div dangerouslySetInnerHTML={{ __html: md(it.text) }} />
          </div>,
        );
      } else if (it.k === "text") {
        out.push(<div className="msg-text" key={e.id} dangerouslySetInnerHTML={{ __html: md(it.text) }} />);
      } else if (it.k === "err") {
        out.push(<div className="err" key={e.id}>{it.text}</div>);
      } else if (it.k === "git") {
        out.push(
          <div className="gitmsg" key={e.id}>
            {it.text}
            {it.url && (
              <>
                {" · "}
                <a href={it.url} target="_blank" rel="noopener">odpri na GitHubu</a>
              </>
            )}
          </div>,
        );
      } else if (it.k === "deny") {
        const state = denied[e.id];
        out.push(
          <div className="deny" key={e.id}>
            <b>Claude je želel zagnati ukaz, ki ni dovoljen:</b>
            <code>{it.command || `${it.tool} ${it.desc || ""}`}</code>
            {it.never ? (
              <span className="meta">{/git\s+push/i.test(it.command || "") ? "Push naredi workflow sam po koncu." : "Ta ukaz je vedno prepovedan."}</span>
            ) : state === "rejected" ? (
              <span className="meta">Zavrnjeno</span>
            ) : live && !state ? (
              <div className="row">
                <button
                  type="button"
                  className="go"
                  onClick={() => {
                    setDenied((d) => ({ ...d, [e.id]: "allowed" }));
                    call("/api/allow", { command: it.command, tool: it.tool }).catch(() => {});
                  }}
                >
                  Dovoli
                </button>
                <button type="button" onClick={() => setDenied((d) => ({ ...d, [e.id]: "rejected" }))}>Zavrni</button>
              </div>
            ) : null}
          </div>,
        );
      }
    }
    flushTools("end");
    return out;
  }

  function renderResult(r: RunResult) {
    if (!r) return null;
    const s: string[] = [];
    if (r.ms) s.push((r.ms / 1000).toFixed(r.ms < 10000 ? 1 : 0) + " s");
    if (r.turns) s.push(r.turns + " korakov");
    if (r.cost) s.push("$" + r.cost.toFixed(3));
    return s.length ? <div className="meta">{s.join(" · ")}</div> : null;
  }

  const notesAfter = (id: string | null) =>
    notes.filter((n) => n.after === id).map((n, i) => (
      <div key={"n" + id + i} className={n.err ? "err" : "meta"} dangerouslySetInnerHTML={{ __html: esc(n.text) }} />
    ));

  function renderChat() {
    if (!loaded) return null;
    const out: React.ReactNode[] = [];
    if (!runs.length) {
      out.push(
        <p className="hint" key="hint">
          {ready
            ? `Napiši, kaj naj Claude spremeni v ${title}. Claude dela v GitHub Actions, spremembe gredo ${repo.mode === "pr" ? "v pull request" : "direktno v " + repo.default_branch}.`
            : "Repozitorij še ni pripravljen: v Nastavitvah dodaj secret CLAUDE_CODE_OAUTH_TOKEN ali ANTHROPIC_API_KEY."}
        </p>,
      );
    }
    out.push(...notesAfter(null));
    let prevThread: string | null = null;
    runs.forEach((run) => {
      if (prevThread && prevThread !== run.thread_id) out.push(<div className="divider" key={"d" + run.id}>Nov pogovor</div>);
      prevThread = run.thread_id;
      const isLast = run === lastRun;
      const live = isLast && !!openThread && run.thread_id === openThread.id && !ACTIVE(run);
      out.push(
        <Fragment key={run.id}>
          <div className="msg-user">
            {run.plan && <span className="tag">Načrt</span>}
            {run.prompt}
          </div>
          {renderItems(run, live)}
          {run.status === "done" && renderResult(run.result)}
          {run.status === "error" && run.error && !(events[run.id] || []).some((e) => e.item.k === "err") && (
            <div className="err">{run.error}</div>
          )}
          {live && run.plan && run.status === "done" && (
            <div className="plan-go">
              <button type="button" className="go" onClick={() => { setPlan(false); call("/api/execute").catch(() => {}); }}>
                <Svg p={ICON.send} />Izvedi načrt
              </button>
              <span className="meta">ali napiši popravke in pošlji znova</span>
            </div>
          )}
          {notesAfter(run.id)}
        </Fragment>,
      );
    });
    if (lastRun && !openThread && !ACTIVE(lastRun)) out.push(<div className="divider" key="dnew">Nov pogovor</div>);
    if (liveOpen && live!.error) out.push(<div className="err" key="live-err">{live!.error}</div>);
    const waitText = running
      ? lastRun!.status === "queued"
        ? liveStatus === "starting" ? "Čakam, da se živa seja zažene …" : liveOpen ? "Claude dela …" : "Zaganjam runner …"
        : "Claude dela …"
      : liveStatus === "starting" ? "Zaganjam živo sejo …"
      : liveStatus === "ending" ? "Objavljam spremembe seje …"
      : null;
    const waitUrl = running ? lastRun!.gh_run_url : liveOpen ? live!.gh_run_url : null;
    if (waitText) {
      out.push(
        <div className="working" id="working" key="working">
          <i></i><i></i><i></i>
          <span>{waitText}</span>
          {waitUrl && (
            <span className="cc-status"> · <a href={waitUrl} target="_blank" rel="noopener">Actions</a></span>
          )}
        </div>,
      );
    }
    return out;
  }

  const liveUrl = liveStatus === "ready" || liveStatus === "ending" ? live!.preview_url || "" : "";
  const pvUrl = liveUrl || repo.deploy_url || "";

  return (
    <div
      ref={rootRef}
      className={`cc${navHidden ? " nav-hidden" : ""}`}
      style={{ ["--accent" as string]: accent, ["--accent2" as string]: accent2 }}
    >
      <header>
        <button type="button" className="ico" title="Nazaj" aria-label="Nazaj" onClick={() => router.push("/")}>
          <Svg p='<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>' />
        </button>
        <button type="button" className="app-icon" title="Osveži stran" aria-label="Osveži stran" onClick={() => location.reload()}>
          <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: repo.icon || "" }} />
        </button>
        <div className="title">
          <b>{title}</b>
          <span>
            <Svg p={ICON.branch} />
            {repo.full_name} · {repo.mode === "pr" ? "PR" : repo.default_branch}
          </span>
        </div>
        <button
          type="button"
          className="ico"
          id="auto"
          aria-pressed={repo.auto}
          aria-label="Samodejno"
          title={repo.auto ? "Samodejno: Claude sme vse razen nevarnih ukazov (klik: vprašaj za ukaze)" : "Vpraša za ukaze, ki niso na seznamu (klik: samodejno)"}
          onClick={toggleAuto}
        >
          <Svg p='<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>' />
        </button>
        <button
          type="button"
          className="ico"
          id="live"
          aria-pressed={liveOpen}
          aria-label="Živa seja"
          title={
            liveStatus === "starting" ? "Živa seja se zaganja (klik: prekliči)"
            : liveStatus === "ending" ? "Živa seja se zaključuje"
            : liveOpen ? "Živa seja: predogled v živo (klik: končaj in objavi)"
            : "Začni živo sejo: dev strežnik v Actions, predogled v živo, objava na koncu"
          }
          disabled={!ready || liveStatus === "ending" || (liveOpen && running && liveStatus !== "starting")}
          onClick={toggleLive}
        >
          <Svg p={ICO_LIVE} />
        </button>
        <button type="button" className="ico" title="Nov pogovor" aria-label="Nov pogovor" disabled={running || liveOpen} onClick={() => call("/api/new").catch(() => {})}>
          <Svg p='<path d="M5 12h14"/><path d="M12 5v14"/>' />
        </button>
        <a href={`https://github.com/${repo.full_name}${lastRun?.commit_url ? "/commits/" + repo.default_branch : ""}`} target="_blank" rel="noopener">
          <button type="button" className="ico" title="Odpri na GitHubu" aria-label="Odpri na GitHubu">
            <Svg p={ICON.github} />
          </button>
        </a>
      </header>

      <section id="pv" ref={pvRef} className={pvUrl ? "" : "off"}>
        <div className="pv-bar">
          <span className={`dot${pvUrl ? " on" : ""}${liveUrl ? " live" : ""}`}></span>
          <span className="pv-url">
            {liveUrl ? "živo · " : liveStatus === "starting" ? "zaganjam živo sejo · " : ""}
            {pvUrl.replace(/^https?:\/\//, "") || "brez predogleda"}
          </span>
          <button type="button" className="ico" title="Osveži" aria-label="Osveži" onClick={() => setFrameKey((k) => k + 1)}>
            <Svg p='<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>' />
          </button>
          {pvUrl && (
            <a href={pvUrl} target="_blank" rel="noopener">
              <button type="button" className="ico" title="Odpri v novem zavihku" aria-label="Odpri v novem zavihku">
                <Svg p='<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' />
              </button>
            </a>
          )}
          <button
            type="button"
            className="ico"
            title={navHidden ? "Pokaži glavo" : "Skrij glavo"}
            aria-label="Skrij"
            onClick={toggleHide}
          >
            <Svg p={navHidden ? ICO_DOWN : ICO_UP} />
          </button>
        </div>
        {pvUrl && ssoReady && (
          <iframe key={frameKey} ref={frameRef} title="Predogled" src={pvUrl + (suiteApp ? sso?.hash ?? "" : "")} allow="clipboard-write" />
        )}
        <div className="pv-empty pv-off">
          <span>
            {liveStatus === "starting"
              ? "Zaganjam dev strežnik in tunel …"
              : "Predogled ni nastavljen. V Nastavitvah vpiši objavljen naslov aplikacije ali začni živo sejo."}
          </span>
          <button type="button" onClick={() => router.push("/nastavitve#repozitoriji")}>Nastavitve</button>
        </div>
      </section>
      <div id="grip" ref={gripRef} aria-hidden="true"></div>

      <main
        id="chat"
        ref={chatRef}
        aria-live="polite"
        onScroll={(e) => {
          const c = e.currentTarget;
          nearBottom.current = c.scrollHeight - c.scrollTop - c.clientHeight < 80;
        }}
      >
        {renderChat()}
      </main>

      <form ref={formRef} className={plan ? "planning" : ""} onSubmit={submit}>
        <button
          type="button"
          id="plan"
          title="Načrt: Claude samo pripravi načrt, nič ne spremeni"
          aria-label="Načrt"
          aria-pressed={plan}
          onClick={() => { setPlan(!plan); taRef.current?.focus(); }}
        >
          <Svg p={ICON.plan} />
        </button>
        <textarea
          ref={taRef}
          rows={1}
          value={prompt}
          placeholder={plan ? "Kaj naj Claude načrtuje?" : "Kaj naj Claude naredi?"}
          enterKeyHint="send"
          onChange={(e) => { setPrompt(e.target.value); store(K + "-draft", e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey || (!e.shiftKey && window.matchMedia("(pointer: fine)").matches))) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="submit"
          id="send"
          className={running ? "stop" : ""}
          title={running ? "Ustavi" : "Pošlji"}
          aria-label={running ? "Ustavi" : "Pošlji"}
          disabled={!running && (!ready || sending || liveStatus === "ending")}
        >
          <Svg p={running ? ICON.stop : ICON.send} />
        </button>
      </form>
    </div>
  );
}

import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { verifyWebhook } from "@/lib/github";
import { addEvent } from "@/lib/cloud";

type Payload = {
  action?: string;
  installation?: { id: number };
  workflow_run?: { id: number; name: string; display_title?: string; conclusion: string | null; status: string; html_url: string };
};

// Webhook GitHub App: odstranjena namestitev, rezervni status teka (če runner ne javi konca).
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "podpis" }, { status: 401 });
  }
  const event = req.headers.get("x-github-event");
  const p = JSON.parse(raw) as Payload;
  const db = admin();

  if (event === "installation" && p.action === "deleted" && p.installation) {
    await db.from("cloud_installations").delete().eq("installation_id", p.installation.id);
  }

  if (event === "workflow_run" && p.action === "completed" && p.workflow_run?.name === "Klodi") {
    const wr = p.workflow_run;
    const m = /Klodi ([0-9a-f-]{36})/.exec(wr.display_title || "");
    if (m) {
      const { data: run } = await db.from("cloud_runs").select("id,status,user_id").eq("id", m[1]).maybeSingle();
      if (run && (run.status === "queued" || run.status === "running")) {
        const status = wr.conclusion === "success" ? "done" : wr.conclusion === "cancelled" ? "cancelled" : "error";
        if (status !== "done") {
          const { data: last } = await db.from("cloud_events").select("seq").eq("run_id", run.id)
            .order("seq", { ascending: false }).limit(1).maybeSingle();
          await db.from("cloud_events").insert({
            run_id: run.id, user_id: run.user_id, seq: (last?.seq ?? -1) + 1000,
            item: { k: "err", text: status === "cancelled" ? "Ustavljeno" : `Tek v GitHub Actions ni uspel (${wr.conclusion}). Preveri dnevnik.` },
          });
        }
        await db.from("cloud_runs").update({ status, gh_run_url: wr.html_url, finished_at: new Date().toISOString() }).eq("id", run.id);
      }
      // živa seja (run-name nosi id seje): runner ni javil konca
      const { data: s } = await db.from("cloud_sessions").select("id,status").eq("id", m[1]).maybeSingle();
      if (s && ["starting", "ready", "ending"].includes(s.status)) {
        const now = new Date().toISOString();
        const ok = wr.conclusion === "success" || wr.conclusion === "cancelled";
        const { data: open } = await db.from("cloud_runs").select("id,user_id").eq("session_id", s.id).in("status", ["queued", "running"]);
        for (const r of open || []) {
          await addEvent(r, { k: "err", text: ok ? "Ustavljeno" : `Živa seja v GitHub Actions ni uspela (${wr.conclusion}). Preveri dnevnik.` }, 1000);
        }
        await db.from("cloud_runs").update({ status: "cancelled", finished_at: now }).eq("session_id", s.id).in("status", ["queued", "running"]);
        await db.from("cloud_sessions").update({
          status: ok ? "ended" : "error",
          error: ok ? null : `Tek v GitHub Actions: ${wr.conclusion}`,
          gh_run_url: wr.html_url,
          ended_at: now,
        }).eq("id", s.id);
      }
    }
  }
  return NextResponse.json({ ok: true });
}

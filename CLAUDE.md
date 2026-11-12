# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Kaj je Klodi

**Klodi** = Claude Code v oblaku nad GitHub repozitoriji uporabnikov Bitneverse — deluje
brez prižganega računalnika. Videz in funkcije so iz **Live Claude**
(`zaganjalnik/claude.html` + `claude.js`): predogled + pogovor, ročaj,
Načrt / Izvedi načrt, Samodejno, Dovoli/Zavrni, Nov pogovor, Ustavi. Razlika:
Claude teče v **GitHub Actions v repozitoriju uporabnika** (njegove minute,
njegova naročnina ali API ključ), dogodki pridejo prek Supabase Realtime,
spremembe gredo po koncu teka direktno v privzeto vejo ali v PR (nastavitev
repozitorija). Gumba Push ni.

Ogrodje je kopija **Kviza** (prijava, SSO iz huba TomsStudios, tema, PWA).
Isti Supabase projekt **ProjektiBaze** (`abjnxhfxjolwwxlckkje`), tabele
`cloud_*`. Stack: Next.js 16 · React 19 · TypeScript · Tailwind v4 ·
`@supabase/ssr`. Barva `#0ea5e9` → `#6366f1`, znak: bel oblak (Lucide cloud,
polno) — `src/app/icon.svg`, `public/icon.svg`, `components/Logo.tsx`.
Jezik: slovenščina. Dev port **3010**.

## Ukazi

```bash
npm install
npm run dev      # http://localhost:3010
npm run lint
npm run build
```

Ni testov. Runner lokalno: lažen API + pravi Claude
(`CLAUDE_BIN=<pot do claude.exe> CC_API=… CC_RUN=… CC_TOKEN=… node public/runner/bridge.mjs claude`).

## Pogoji Anthropic (pomembno)

Aplikacija **nikoli ne sprejme, shrani ali posreduje** Claude tokenov
uporabnikov (code.claude.com/docs/en/legal-and-compliance: tretje aplikacije
ne smejo zbirati/posredovati Claude.ai poverilnic). Uporabnik sam doda secret
`CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`) ali `ANTHROPIC_API_KEY` v
svoj repozitorij; aplikacija prek GitHub App (Secrets: read) preveri le, da
**ime** secreta obstaja (`cloud_repos.secret_name`). Ne dodajaj polja za
vpis tokena.

## Tok

1. **Poveži GitHub** (`/api/github/install` → GitHub App namestitev, state v
   piškotku) → setup URL `/api/github/callback` z `installation_id` + `code`
   (App ima vklopljeno *Request user authorization during installation*):
   `userCanAccessInstallation` z uporabniškim OAuth žetonom preveri, da
   namestitev res pripada temu GitHub uporabniku → `cloud_installations`.
2. **Omogoči repo** (`POST /api/repos`): vrstica `cloud_repos` (barve/ikona iz
   `src/lib/suite-apps.json` = zaganjalnik/apps.json po GitHub imenu), App
   zapiše `.github/workflows/klodi.yml` (`src/lib/workflow.ts`) v
   privzeto vejo, preveri secret.
3. **Prompt** (`/api/run`, `/api/execute`, `/api/allow`): `startRun` naredi
   `cloud_runs` (enkraten žeton, v bazi samo sha256) in `workflow_dispatch`
   (vhodi samo `run_id`, `thread_id`, `token`, `api`).
4. **Runner** (`public/runner/bridge.mjs`, prenese ga workflow z `$api/runner/bridge.mjs`):
   `claude` korak → `/api/runner/start` (prompt, argumenti iz `src/lib/rules.ts`,
   `--resume` iz `cloud_threads.session_id`) → `claude -p stream-json` →
   elementi `{k:…}` (ista oblika kot `claude.js`) v paketih na
   `/api/runner/events`; `finish` korak → commit + push (main ali veja
   `claude/<run>` + PR) → `/api/runner/finish`.
5. Seja med teki: `actions/cache` za `~/.claude/projects`, ključ thread.
6. **Ustavi** (`/api/stop`): cancel teka na GitHubu + status `cancelled`;
   runner ob 410 ubije Clauda. Webhook `workflow_run` je rezerva za status.

## Varnost

- `checkout` s `persist-credentials: false` + `GH_TOKEN` samo v koraku
  „Objavi“: Claude med delom nima poverilnic za push. `git push` je v
  `DANGER` (rules.ts) in `NEVER`, gumb Dovoli ga ne more dovoliti.
- Bridge iz okolja Clauda odstrani `CC_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN`,
  `ACTIONS_*` žetone.
- Vse `/api/*` (razen runner/webhook) gredo skozi `requireUser()`:
  prijava + `has_app_access('klodi')` (admini huba vedno). Vsako
  dejanje preveri lastnika (`ownRepo`). Service role samo v `src/lib/supabase/admin.ts`.
- RLS: samo `select` lastnih vrstic + `has_app_access`; pisanje samo strežnik.
  `cloud_runs.token_hash` ni berljiv (stolpčni grant).
- `/api/*` in `/runner/*` sta v `middleware.ts` javna (route same vrnejo 401),
  SW jih ne predpomni. Vercel **Deployment Protection mora prepuščati**
  `/runner/bridge.mjs`, `/api/runner/*`, `/api/github/*` (najlažje: izklopi).

## Okolje, deploy

`.env.example`: Supabase (URL, anon, **service role**), `APP_URL`,
`GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`,
`GITHUB_APP_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_APP_PRIVATE_KEY`.

GitHub App „Klodi“ (račun zig4to, javna, da jo lahko namestijo drugi):
- Setup URL: `$APP_URL/api/github/callback`, ☑ *Request user authorization
  (OAuth) during installation*, ☑ *Redirect on update*.
- Webhook URL: `$APP_URL/api/github/webhook` + secret. Dogodki: *Workflow run*
  (installation dogodki pridejo sami).
- Dovoljenja repozitorija: Actions RW, Contents RW, Workflows RW, Secrets R,
  Pull requests RW, Metadata R.

**Pred `git push` vedno vprašaj Žigo.**

## Baza (Supabase)

| Migracija | Vsebina | Stanje |
|---|---|---|
| `0001_init` | `cloud_installations`, `cloud_repos`, `cloud_threads`, `cloud_runs`, `cloud_events`, RLS, Realtime | izvedena 2026-11-12 (`cloud_init` + `cloud_runs_hide_token` + `cloud_access_klodi`) |

`src/lib/types/database.types.ts` je ročno napisan — ob novi migraciji ga posodobi.

## Pasti

- `chat.css` je CSS iz `claude.html`, ugnezden pod `.cc` (CSS nesting);
  `@keyframes` mora biti zunaj gnezdenja. Tema prek `[data-theme="dark"] &`.
- Ne kliči `setState` v `useEffect` (lint) — prvo nalaganje je v `setTimeout(…, 0)`.
- `public/sw.js` je network-first; ob spremembi povečaj `VERZIJA`.
- Realtime za `cloud_runs` morda ne dostavi sprememb zaradi stolpčnega granta;
  zato `CloudChat` med tekom preveri stanje vsakih 8 s.
- Datoteke so CRLF na Windows; za popravke raje Edit kot sed z regexi.

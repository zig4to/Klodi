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
7. **Živa seja** (gumb Živo, `/api/live` op `start`/`end`, workflow v2 z vhodom
   `live`, timeout 360 min): `cloud_sessions` (žeton seje; teki v seji imajo
   isti `token_hash` + `cloud_runs.session_id`). Runner `CC_LIVE=1`: `npm ci` +
   `npm run dev` (port iz izpisa; brez skripte `dev` statični strežnik :8080) →
   proxy :8787 (piškotki → `SameSite=None; Secure; Partitioned` v Set-Cookie in prek vstavljene
   skripte za `document.cookie`, ker se Lax piškotki iz iframa ne pošiljajo → ob vsakem kliku
   bi bila spet prijava; Host `localhost:<port>`, Location brez localhost, WebSocket) →
   `cloudflared` quick tunnel →
   `/api/runner/session` op `preview` → zanka op `next` (vsake 3 s) → za vsak
   prompt nov `claude -p --resume` + `--append-system-prompt` o dev strežniku.
   Prompti v seji ne naredijo dispatcha (`startRun` jih samo postavi v vrsto).
   Konec: Končaj (status `ending`), 20 min brez dela ali 340 min → korak
   „Objavi“ commita vse naenkrat → op `finish`. Ustavi v seji ustavi le
   trenutni prompt. Aplikacijam iz zbirke `CloudChat` poda prijavo kot hub (`#sb_at=…&sb_rt=…` v src okvirja). Runner poda javna
   `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`. Next aplikacije rabijo
   `**.trycloudflare.com` v `allowedDevOrigins`, sicer HMR/JS ne deluje.

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

Produkcija: **https://klodi-ruby.vercel.app** (Vercel projekt `klodi`,
`APP_URL` brez `/` na koncu). Vseh 10 spremenljivk je v Vercelu (Production);
Sensitive so `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_APP_CLIENT_SECRET`,
`GITHUB_WEBHOOK_SECRET`, `GITHUB_APP_PRIVATE_KEY`. Vercel Authentication je
izklopljen. Nove spremenljivke veljajo šele po Redeploy.

GitHub App **„Klodi App“** (ime „Klodi“ je zasedeno), slug **`klodi-app`**,
App ID `5735688`, račun zig4to, *Any account*
(`github.com/settings/apps/klodi-app`):
- Callback (Redirect) URI: `$APP_URL/api/github/callback`, ☑ *Request user
  authorization (OAuth) during installation* (zato je Setup URL siv/prazen),
  ☑ *Redirect on update*.
- Webhook URL: `$APP_URL/api/github/webhook` + secret. Dogodki: *Workflow run*
  (installation dogodki pridejo sami).
- Dovoljenja repozitorija: Actions RW, Contents RW, Workflows RW, Secrets R,
  Pull requests RW, Metadata R.
- Client secret je na zavihku **Credentials** (ne General). Private key in
  client secret GitHub pokaže samo enkrat.

Secret `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`) mora biti v **vsakem**
repozitoriju posebej — osebni račun nima skupnih Actions secretov. Status v
Nastavitvah se osveži šele ob kliku **Preveri** (`checkSecret`). Uporabnik ga
doda sam (spletno ali `gh secret set … --body`), nikoli prek Klodija/pogovora.

`cloud_repos.deploy_url` (polje „Predogled“) kaže **objavljeno** aplikacijo:
sprememba je vidna šele po deployu (Vercel/Pages), ne v živo. Za zig4to
repozitorije je naslov iz `TomsStudios/apps-registry.js`.

Plošča Bitneverse (`TomsStudios/apps-registry.js`): kartica `id: "klodi"`,
vidna uporabnikom z `app_access` `klodi` (dodeli v `admin.html`).

Živa seja (tok 7) kaže dev strežnik prek tunela namesto `deploy_url`; stane
minute Actions (zasebni repo), zagon 1–2 min, max ~6 h.

**Pred `git push` vedno vprašaj Žigo.**

## Baza (Supabase)

| Migracija | Vsebina | Stanje |
|---|---|---|
| `0001_init` | `cloud_installations`, `cloud_repos`, `cloud_threads`, `cloud_runs`, `cloud_events`, RLS, Realtime | izvedena 2026-11-12 (`cloud_init` + `cloud_runs_hide_token` + `cloud_access_klodi`) |
| `0002_live` | `cloud_sessions` (živa seja), `cloud_runs.session_id`, RLS, stolpčni grant brez `token_hash`, Realtime | izvedena 2026-11-13 (`cloud_live_sessions`) |

`src/lib/types/database.types.ts` je ročno napisan — ob novi migraciji ga posodobi.

## Pasti

- `chat.css` je CSS iz `claude.html`, ugnezden pod `.cc` (CSS nesting);
  `@keyframes` mora biti zunaj gnezdenja. Tema prek `[data-theme="dark"] &`.
- Ne kliči `setState` v `useEffect` (lint) — prvo nalaganje je v `setTimeout(…, 0)`.
- `public/sw.js` je network-first; ob spremembi povečaj `VERZIJA`.
- Realtime za `cloud_runs` morda ne dostavi sprememb zaradi stolpčnega granta;
  zato `CloudChat` med tekom preveri stanje vsakih 8 s.
- Datoteke so CRLF na Windows; za popravke raje Edit kot sed z regexi.

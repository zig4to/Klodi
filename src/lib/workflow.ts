// Workflow, ki ga Klodi zapiše v repozitorij uporabnika (.github/workflows/klodi.yml).
// Vhodi so samo id teka, enkratni žeton in naslov API-ja; prompt in pravila runner vzame z API-ja,
// zato ne pristanejo v dnevniku Actions. Vrednosti gredo v skripte prek env (ne ${{ }} v run:).

// v2: vhod `live` — živa seja (dev strežnik + tunel, več promptov, do ~6 h)
// v3: objava v ločenem jobu na svežem stroju. Job `claude` ima samo branje; njegove
//     spremembe gredo naprej le kot patch (artifact). Claude tako ne more podtakniti
//     runnerja, git hookov/configa ali programov na PATH koraku z žetonom za push.
//     Job `objavi` runner prenese na novo, način in vejo vzame z API-ja.
// v4: vhod `migrate` — job `migriraj` (svež stroj, brez Clauda) izvede migracijo baze, ki jo je
//     uporabnik potrdil v Klodiju; edini dobi secret SUPABASE_DB_URL. Claude dobi kvečjemu
//     SUPABASE_DB_URL_RO (vloga brez pravic: samo shema).
export const WORKFLOW_VERSION = 4;

export function workflowYaml(apiBase: string): string {
  return `# Klodi v${WORKFLOW_VERSION} — ustvarila aplikacija Klodi (${apiBase}).
# Claude Code teče s tvojim secretom CLAUDE_CODE_OAUTH_TOKEN (claude setup-token) ali ANTHROPIC_API_KEY.
name: Klodi
run-name: Klodi \${{ inputs.run_id }}
on:
  workflow_dispatch:
    inputs:
      run_id: { description: "Klodi run", required: true }
      thread_id: { description: "Klodi pogovor", required: true }
      token: { description: "enkratni žeton", required: true }
      api: { description: "Klodi API", required: true, default: "${apiBase}" }
      live: { description: "živa seja (1)", required: false, default: "" }
      migrate: { description: "migracija baze (1)", required: false, default: "" }
concurrency:
  group: klodi-\${{ inputs.migrate == '1' && inputs.run_id || inputs.thread_id }}
  cancel-in-progress: false
permissions:
  contents: read
env:
  CC_API: \${{ inputs.api }}
  CC_RUN: \${{ inputs.run_id }}
  CC_TOKEN: \${{ inputs.token }}
  CC_LIVE: \${{ inputs.live }}
jobs:
  claude:
    if: \${{ inputs.migrate != '1' }}
    runs-on: ubuntu-latest
    timeout-minutes: \${{ inputs.live == '1' && 360 || 60 }}
    env:
      CC_BASE: \${{ github.sha }}
    steps:
      - name: Skrij žeton
        run: echo "::add-mask::$CC_TOKEN"
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Seja Claude (--resume)
        uses: actions/cache@v4
        with:
          path: ~/.claude/projects
          key: klodi-\${{ inputs.thread_id }}-\${{ inputs.run_id }}
          restore-keys: klodi-\${{ inputs.thread_id }}-
      - name: Namesti Claude Code
        run: npm install -g @anthropic-ai/claude-code
      - name: Prenesi runner
        run: curl -fsSL "$CC_API/runner/bridge.mjs" -o "$RUNNER_TEMP/bridge.mjs"
      - name: Claude
        env:
          CLAUDE_CODE_OAUTH_TOKEN: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_DB_URL_RO: \${{ secrets.SUPABASE_DB_URL_RO }}
        run: node "$RUNNER_TEMP/bridge.mjs" claude
      - name: Pripravi spremembe
        if: \${{ !cancelled() }}
        run: node "$RUNNER_TEMP/bridge.mjs" pack
      - uses: actions/upload-artifact@v4
        if: \${{ !cancelled() }}
        with:
          name: klodi-patch
          path: \${{ runner.temp }}/klodi-patch/
          retention-days: 1
          if-no-files-found: ignore
  objavi:
    needs: claude
    if: \${{ !cancelled() && inputs.migrate != '1' }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write
      pull-requests: write
    steps:
      - name: Skrij žeton
        run: echo "::add-mask::$CC_TOKEN"
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/download-artifact@v4
        continue-on-error: true
        with:
          name: klodi-patch
          path: \${{ runner.temp }}/klodi-patch
      - name: Prenesi runner
        run: curl -fsSL "$CC_API/runner/bridge.mjs" -o "$RUNNER_TEMP/bridge.mjs"
      - name: Objavi
        env:
          GH_TOKEN: \${{ github.token }}
        run: node "$RUNNER_TEMP/bridge.mjs" publish
  migriraj:
    if: \${{ inputs.migrate == '1' }}
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Skrij žeton
        run: echo "::add-mask::$CC_TOKEN"
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: psql
        run: command -v psql || (sudo apt-get update -qq && sudo apt-get install -y -qq postgresql-client)
      - name: Prenesi runner
        run: curl -fsSL "$CC_API/runner/bridge.mjs" -o "$RUNNER_TEMP/bridge.mjs"
      - name: Migriraj
        env:
          SUPABASE_DB_URL: \${{ secrets.SUPABASE_DB_URL }}
        run: node "$RUNNER_TEMP/bridge.mjs" migrate
`;
}

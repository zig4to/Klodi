// Workflow, ki ga Klodi zapiše v repozitorij uporabnika (.github/workflows/klodi.yml).
// Vhodi so samo id teka, enkratni žeton in naslov API-ja; prompt in pravila runner vzame z API-ja,
// zato ne pristanejo v dnevniku Actions. Vrednosti gredo v skripte prek env (ne ${{ }} v run:).

// v2: vhod `live` — živa seja (dev strežnik + tunel, več promptov, do ~6 h)
export const WORKFLOW_VERSION = 2;

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
concurrency:
  group: klodi-\${{ inputs.thread_id }}
  cancel-in-progress: false
permissions:
  contents: write
  pull-requests: write
jobs:
  claude:
    runs-on: ubuntu-latest
    timeout-minutes: \${{ inputs.live == '1' && 360 || 60 }}
    env:
      CC_API: \${{ inputs.api }}
      CC_RUN: \${{ inputs.run_id }}
      CC_TOKEN: \${{ inputs.token }}
      CC_LIVE: \${{ inputs.live }}
    steps:
      - name: Skrij žeton
        run: echo "::add-mask::$CC_TOKEN"
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          # Claude ne dobi poverilnic za push; push naredi samo korak "Objavi"
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
        run: node "$RUNNER_TEMP/bridge.mjs" claude
      - name: Objavi
        env:
          GH_TOKEN: \${{ github.token }}
        run: node "$RUNNER_TEMP/bridge.mjs" finish
`;
}

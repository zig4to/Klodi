// Workflow, ki ga Claude Cloud zapiše v repozitorij uporabnika (.github/workflows/claude-cloud.yml).
// Vhodi so samo id teka, enkratni žeton in naslov API-ja; prompt in pravila runner vzame z API-ja,
// zato ne pristanejo v dnevniku Actions. Vrednosti gredo v skripte prek env (ne ${{ }} v run:).

export const WORKFLOW_VERSION = 1;

export function workflowYaml(apiBase: string): string {
  return `# Claude Cloud v${WORKFLOW_VERSION} — ustvarila aplikacija Claude Cloud (${apiBase}).
# Claude Code teče s tvojim secretom CLAUDE_CODE_OAUTH_TOKEN (claude setup-token) ali ANTHROPIC_API_KEY.
name: Claude Cloud
run-name: Claude Cloud \${{ inputs.run_id }}
on:
  workflow_dispatch:
    inputs:
      run_id: { description: "Claude Cloud run", required: true }
      thread_id: { description: "Claude Cloud pogovor", required: true }
      token: { description: "enkratni žeton", required: true }
      api: { description: "Claude Cloud API", required: true, default: "${apiBase}" }
concurrency:
  group: claude-cloud-\${{ inputs.thread_id }}
  cancel-in-progress: false
permissions:
  contents: write
  pull-requests: write
jobs:
  claude:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    env:
      CC_API: \${{ inputs.api }}
      CC_RUN: \${{ inputs.run_id }}
      CC_TOKEN: \${{ inputs.token }}
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
          key: claude-cloud-\${{ inputs.thread_id }}-\${{ inputs.run_id }}
          restore-keys: claude-cloud-\${{ inputs.thread_id }}-
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

# DevSync VS Code Extension — Audit & Redesign Roadmap

Based on: `DevSync-00/devsyncs`, `extensions/vscode/` (v0.1.9), cross-referenced against
`package.json` contribution points and the current sidebar screenshot.

## 1. The core problem

The extension has **one registered view**: a single `TreeView` (`devsyncSidebar`) with a
static, hardcoded 6-section tree (Account, Project, Schema Workflow, Scan Results,
Migrations, Configuration) and **one toolbar button** (Refresh). That's the entirety of
the surface area a user sees.

But `src/` contains large, largely-finished modules that are **never surfaced** in that
tree:

| Module | Size | What it does | Exposed in UI? |
|---|---|---|---|
| `src/erd/` (+ `watcher.ts`) | 196K | Live ER diagram generation with a file-system watcher for auto-refresh | Only via Command Palette (`devsync.openERD`), opens as a detached editor-tab webview |
| `src/editor/schemaComparison.ts`, `diffView.ts`, `migrationPreview.ts` | part of 120K | Schema comparison, migration diff/preview, batch-apply | Command Palette only, no sidebar entry point |
| `src/chat/` | 44K | Full AI chat manager, code-block actions, error recovery | Only reachable via `devsync.chat.login`; no persistent chat view |
| `src/ai/` | 60K | "Advanced AI Manager" for suggestions/prompts | Not wired to any visible command in the tree at all |
| `src/collaboration/` | 36K | Team collaboration manager | Not wired to any visible command in the tree at all |
| `src/security/` (audit log, MFA, credential storage, masking) | 180K | Real security infrastructure | Invisible — user has no way to see audit trail, MFA status, or masking is active |
| `src/reporting/` | 32K | Reporting manager | No view |
| `src/plugins/` | 68K | Plugin registry/loader | No view |
| `src/onboarding/wizard.ts`, `quickStart.ts` | 60K | A full onboarding wizard + connection tester + schema detector | Command exists (`devsync.onboarding.start`) but nothing in the tree ever prompts a first-time user to run it |
| Platform commands: `devsync.platform.showPlan`, `showPolicies`, `promotions`, `monitorPromotion`, `approvePromotion`, `executePromotion`, `cancelPromotion` | — | This is the entire "multi-environment promotion" story from your marketing site (Dev → Staging → Prod approval gates) | **Zero** UI surface. Command Palette only. |
| `devsync.queue.pause` / `devsync.queue.resume`, `devsync.undoLast` | — | Task queue + undo | No visible queue state anywhere |

Net effect: **50 registered commands, 1 way to discover about 10 of them.** Everything
else requires a user to already know the exact Command Palette string — which nobody
will. This is almost certainly why the extension "feels" thin even though the codebase
isn't. This is priority #0: it's not a features gap, it's an **information architecture
gap**.

Also worth calling out directly: the repo's own `README.md` (written as a
session/validation log) admits the VS Code extension test suite is currently **blocked**
(`Code is currently being updated...` test-host failure) and that the `migrate` command
had to be retroactively wired into the CLI because the extension expected it and the CLI
didn't expose it. That's a sign the CLI and extension have been evolving out of sync —
worth a contract/interface test between them (see §5).

---

## 2. UI/UX Redesign Proposal

### 2.1 Replace the single flat tree with a proper multi-view Activity Bar container

Right now everything lives in one `viewsContainers.activitybar` entry with one
`views.devsync` array containing one tree. VS Code supports multiple views per
container — use that.

```
Activity Bar: Dev-Sync
├── 🏠 Home / Status         (WebviewView — replaces empty "Project: No project selected")
├── 🗺️  Schema Visualizer     (WebviewView — embeds live ERD, not a detached tab)
├── 🔍 Drift & Diff           (TreeView — current "Scan Results", but actionable inline)
├── 🚀 Migrations & Promotions (TreeView — merges "Migrations" + platform promotion commands)
├── 💬 AI Assistant           (WebviewView — the chat module, persistent not modal)
├── 👥 Team                   (TreeView — collaboration presence / audit log, collapsed by default)
└── ⚙️  Settings & Account     (TreeView — current Account + Configuration, kept lean)
```

Concretely in `package.json`:
- Add `"type": "webview"` entries under `views.devsync` for Home, Visualizer, and AI
  Assistant, each backed by a `WebviewViewProvider` (`vscode.window.registerWebviewViewProvider`)
  instead of spinning up detached `createWebviewPanel` tabs every time. This is the
  single highest-leverage change: it turns the ERD and chat from "things you have to
  remember exist" into "things that are just always there."
- Add real `view/title` navigation buttons per view (icons), not just one global Refresh:
  - Home: `Scan`, `Init Project`, `Open Settings`
  - Visualizer: `Refresh`, `Toggle Live Watch`, `Export SVG/PNG`
  - Drift & Diff: `Preview Fix`, `Apply All`, `Filter` (search icon already half-built in `searchFilter.ts` — just needs a toolbar entry point)
  - Migrations: `Generate Migration`, `View History`, `Request Promotion`

### 2.2 Fix the empty states — they're currently dead ends

"No project selected", "No scan results found", "No migrations found" are labels with no
action. Every empty state should be a single-click CTA:
- "No project selected" → clicking it should immediately run `devsync.selectProject` /
  `devsync.createProject` inline, or better, trigger `devsync.onboarding.start` (the
  wizard you already built but never surface).
- "No scan results found" → button to run `devsync scan` right there, with a progress
  spinner reusing the existing `OperationProgress` plumbing in
  `sidebar/enhancedProvider.ts` (which already supports progress — it's just underused).
- First-run detection: if `workspaceContains:**/.devsync/config.json` fails and there's
  no session, auto-suggest onboarding instead of showing six discouraging empty sections
  at once.

### 2.3 Status bar item

There's no `StatusBarItem` contribution anywhere in `package.json`. Add one showing
drift state at a glance (`✓ Synced` / `⚠ 3 mismatches` / `● Scanning...`) that's clickable
to jump straight to the Drift & Diff view. This is standard for "guard/linter"-style
extensions (ESLint, GitLens, etc. all do this) and it's the cheapest way to make the
extension feel "always on" rather than something you have to go dig for in the sidebar.

### 2.4 Inline decorations, not just a separate tree

You already have `src/diagnostics.ts` and `src/codeActions.ts`. Confirm these actually
push VS Code `Diagnostic`/`CodeAction` entries for drifted fields directly onto the
`schema.prisma` (or equivalent) file — squiggly underlines + lightbulb "Apply DevSync
fix" — rather than only reporting into the sidebar tree. If this already works, promote
it in onboarding since it's the single most convincing "wow" moment for a schema-drift
tool.

---

## 3. Missing / underexposed components to wire up (priority order)

### P0 — ship first, highest leverage
1. **Live schema visualizer as an embedded WebviewView**, not a Command-Palette-only
   detached panel. `src/erd/watcher.ts` already exists for auto-refresh on file save —
   just needs to drive a persistent view instead of a one-off panel instance.
2. **Schema comparison view surfaced in the sidebar.** `editor/schemaComparison.ts` and
   `editor/diffView.ts` exist; add a "Compare" button next to each scan result item
   (`view/item/context` currently has exactly one entry — `viewFix` — expand this).
3. **Onboarding wizard trigger on first activation.** You built `onboarding/wizard.ts`,
   `connectionTester.ts`, and `schemaDetector.ts` — none of them fire automatically. Hook
   `devsync.onboarding.start` to first-activation-with-no-config.
4. **Status bar drift indicator** (see 2.3).

### P1 — closes the marketing/product promise gap
5. **Promotion pipeline UI.** Your landing page's whole "DEV → STAGING → PRODUCTION,
   Approval Required, Audit Logged" story exists only as 7 disconnected commands
   (`devsync.platform.*`). Build a real "Migrations & Promotions" tree showing each
   environment as a node with its state (Auto-Applied / Rehearsed / Approval Required),
   matching the promo graphic on the site — right now the extension doesn't deliver on
   this at all, and it's the headline feature.
6. **Persistent AI Assistant view.** `src/chat/` is fully built (44K incl. error
   recovery) but only reachable via sign-in command with no chat surface once signed in.
7. **Audit/security surface.** You have `security/auditLog.ts`, `mfa.ts`,
   `credentialStorage.ts`, `dataMasking.ts` — none visible. Add a small "Security" panel
   showing: connection mode (read-only badge), credential masking status, last N audit
   entries. This directly mirrors the "migration_preflight.json" trust signals on your
   website — right now users have to take it on faith.

### P2 — polish
8. **Task queue visibility** for `devsync.queue.pause/resume` — a simple queue-state
   line item so users know something is running/paused instead of commands existing
   with no state feedback.
9. **Team/collaboration presence** from `src/collaboration/` — even a minimal "N
   teammates viewing this project" is enough to justify the module existing.
10. **Reporting module** (`src/reporting/`) — surface as exportable scan history (CSV/PDF)
    from the Drift & Diff view toolbar.

---

## 4. Backend / logic fixes

1. **CLI ↔ extension contract drift.** The repo's own README documents that `migrate`
   had to be retrofitted into the CLI because the extension called a command the CLI
   didn't expose, and that there was a "workspace-folder guard bug" causing false
   `CLI not found` errors. Add a small **contract test** (extension side) that runs
   `devsync --help` / `devsync <cmd> --help` against the installed CLI at extension
   activation (or in CI) and asserts every command the extension shells out to actually
   exists in that CLI version. This class of bug will keep recurring otherwise since the
   two packages version independently.
2. **VS Code extension test host is currently broken** (`Code is currently being
   updated...` per the README). This blocks `npm run test` for the extension package
   entirely, meaning **no extension-side automated tests are currently running in CI**.
   Fix or pin the test-host version before adding new UI surface, or you'll be adding
   features you can't regression-test.
3. **Centralize state.** `sidebarProvider.ts` currently wraps an
   `EnhancedSidebarProvider`, tracks its own `scanResults`/`migrationHistory`/`isScanning`
   state, *and* separately polls a dashboard API (`syncDashboardState`) with a manual
   `dashboardSync` counter to avoid race conditions. This is exactly the "fragmented
   state management" your own `IMPROVEMENTS.md` flags — worth resolving before adding
   3-4 more views that will each want a slice of the same state (scan results, auth
   session, active project). A single event-driven store (even a lightweight one) that
   all views subscribe to will remove a whole class of "sidebar shows stale data" bugs
   as the UI grows.
4. **Activation events are narrow.** Currently `onLanguage:prisma/typescript/javascript`
   + two `workspaceContains` globs. Given you support Drizzle, TypeORM, Kysely, Django
   ORM, and raw SQL per your docs, the activation events should include those file
   patterns too, or the extension simply won't activate in a Drizzle/TypeORM-only repo.
5. **Command discoverability audit.** Of 50 commands, only ~13 appear in any menu
   (`view/title` has 1, `view/item/context` has 1, the rest presumably sit in
   `editor/title` and `explorer/context` — worth auditing those two menus with the same
   rigor, since based on file size alone (`editor/` is 120K) there's likely a similar gap
   between what's built and what's clickable there too.

---

## 5. Suggested `package.json` contribution changes (concrete)

```jsonc
"views": {
  "devsync": [
    { "id": "devsyncHome", "name": "Home", "type": "webview", "when": "workspaceFolderCount > 0" },
    { "id": "devsyncVisualizer", "name": "Schema Visualizer", "type": "webview" },
    { "id": "devsyncDrift", "name": "Drift & Diff" },
    { "id": "devsyncMigrations", "name": "Migrations & Promotions" },
    { "id": "devsyncChat", "name": "AI Assistant", "type": "webview" },
    { "id": "devsyncTeam", "name": "Team", "when": "devsync.authenticated" },
    { "id": "devsyncSettings", "name": "Account & Settings" }
  ]
},
"statusBarItems": [
  { "id": "devsync.status", "alignment": "left", "priority": 100 }
]
```
(`statusBarItems` isn't a real contribution point — status bar items are created
programmatically via `vscode.window.createStatusBarItem` in `activate()` — noted here
just to flag it needs to happen in `extension.ts`, not the manifest.)

---

## 6. Suggested sequencing

1. **Week 1:** Status bar item + fix empty-state CTAs + wire onboarding wizard to
   first-run. Zero new architecture, immediate perceived-quality jump.
2. **Week 2-3:** Convert ERD panel to `WebviewViewProvider`, add Visualizer view.
   Convert chat similarly.
3. **Week 3-4:** Build the Promotions tree (this is your #1 marketing/product gap).
4. **Week 4-5:** Centralize state store; add CLI-contract test; fix test host.
5. **Ongoing:** Security/audit panel, reporting export, queue visibility, team presence.

---

*Compiled from a direct read of `extensions/vscode/package.json`, `src/sidebarProvider.ts`,
`src/sidebar/`, `src/erd/`, `src/chat/`, `src/collaboration/`, `src/security/`,
`src/onboarding/`, and the repo's top-level `README.md` validation notes.*

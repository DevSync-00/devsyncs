# DevSync VS Code Extension — Architecture & Implementation Plan
## "AI-assistant-grade UI, safety-tool-grade substance"

This plan turns the earlier audit into an actual build. It borrows the *interaction
patterns* that make AI coding assistants (Cursor, Copilot Chat, Continue, Cline) feel
polished and alive — a persistent panel, streaming state, inline diffs, contextual
actions — but the anchor of the UI is **not chat**. DevSync's product is schema safety;
chat/AI is one capability among several (visualizer, drift review, promotion pipeline,
security/audit). The design should read as "a safety cockpit that happens to have a
great assistant in it," not "a chatbot that happens to touch your database."

---

## 0. Design principles (the north star)

1. **Evidence over vibes.** Every AI suggestion, every fix, every "safe to apply" claim
   must show its receipts inline — SQL diff, lock estimate, rollback plan — the same way
   your marketing site's `migration_preflight.json` card does. This is your
   differentiator vs. generic AI copilots: they suggest, you *prove*.
2. **One home, not six.** Replace the current 6-section static tree with a single
   cohesive app shell (see diagram above) that has internal navigation — like how
   Cursor's sidebar or Cline's panel is one webview with tabs/views inside it, not six
   separate VS Code tree registrations competing for activity-bar space.
3. **Always-on ambient status, on-demand deep views.** A status bar item + inline
   editor diagnostics give the "is my schema safe right now" answer in zero clicks.
   The panel is where you go to act on it.
4. **Streaming and progressive disclosure everywhere**, not just in chat: scans should
   stream results as tables/columns are checked, migrations should stream reasoning +
   SQL, not blocking spinners with a single completion state.
5. **State is one source of truth**, shared by every view — currently
   `sidebarProvider.ts` privately tracks scan results/migration history while also
   separately polling a dashboard API with a manual counter. That pattern won't survive
   4-5 new views; fix it once, first (§3.2).

---

## 1. Information architecture

Single Activity Bar entry ("Dev-Sync"), backed by **one `WebviewViewProvider`**
rendering a React SPA with client-side routing. Internal nav rail (left edge of the
panel, icon-only, like Cursor/Continue):

| View | Replaces / builds on | Core loop |
|---|---|---|
| **Home** | "Account" + "Project" sections | Project switcher, connection status, "last scan" summary, quick actions |
| **Visualizer** | `devsync.openERD` (detached panel) | Live ERD, `erd/watcher.ts` drives auto-refresh, diff mode against last-known-good schema |
| **Drift & Fixes** | "Scan Results" | List of mismatches → click → inline SQL diff + lock estimate + "Preview" / "Apply" using `editor/fixPreview.ts`, `editor/diffView.ts` |
| **Migrations & Promotions** | "Migrations" + 7 orphaned `platform.*` commands | Pipeline stepper: Dev → Staging → Production, matching the site's promotion graphic exactly |
| **Assistant** | `src/chat/`, `src/ai/` | Persistent chat, but every answer that touches schema renders an evidence card, not just prose |
| **Security & Audit** | `src/security/` (invisible today) | Read-only badge, credential masking status, live audit log tail |
| **Settings** | "Configuration" | Config file, connection strings (masked), preferences |

Native VS Code integrations that stay outside the webview (cheap, high-leverage, and
this is what makes it feel like a real IDE tool and not just an embedded website):
- **Status bar item** (new) — `✓ Synced` / `⚠ 3 mismatches` / `● Scanning…`, click → opens Drift & Fixes.
- **Diagnostics + Code Actions** (`diagnostics.ts`, `codeActions.ts` — confirm these are wired to push squiggles on the actual schema file, not just internal state) — "Apply DevSync fix" lightbulb.
- **CodeLens** above drifted model definitions ("3 fields out of sync — Review") linking into the Assistant/Drift view with context pre-loaded.

---

## 2. Visual language

Borrow, don't clone:

- **Layout shell**: fixed-width nav rail (44px, icon buttons) + content pane, exactly
  like Cline/Continue's panel chrome. Use VS Code's own theme CSS variables
  (`--vscode-editor-background`, `--vscode-foreground`, etc.) — never hardcoded colors —
  so it inherits the user's theme automatically like every good extension does.
- **Message/timeline pattern for the Assistant**, but each DevSync-relevant AI turn can
  render a **typed card**, not just markdown: `DiffCard`, `LockEstimateCard`,
  `RollbackCard`, `PromotionGateCard`. This is the same idea as Cursor's inline diff
  blocks in chat, generalized to schema objects instead of code.
- **Diff blocks**: red/green line-level SQL diff component, reused identically in
  Drift & Fixes, the Assistant, and the Migrations pipeline preview — one component,
  three call sites.
- **Pipeline stepper** for promotions: horizontal stage chips (Dev/Staging/Prod) with
  state color + icon, expandable to show the preflight JSON, matching the "Every
  migration gets a preflight" section of the marketing site 1:1. This view is the most
  important one to get right — it's the one that visually proves the product's central
  safety claim.
- **Empty states are CTAs, not labels** — every empty state renders an actionable
  primary button, never bare text (see audit doc §2.2).
- **Motion**: subtle only — skeleton loaders while scanning, streaming text for AI
  responses, no gratuitous animation. This is a database safety tool; the UI shouldn't
  feel jumpy.

---

## 3. Frontend architecture (webview)

### 3.1 Stack
`react` + `react-dom` are already in `devDependencies` but unused (current webview is
hand-rolled HTML/CSS/JS in `webview/chat.*`). Adopt them for real:
- **Bundler**: add a second webpack config (`webpack.webview.config.js`, `target: 'web'`)
  alongside the existing `webpack.extension.config.js` (`target: 'node'`). Keep them
  separate — the extension host bundle must never pull in DOM-only code.
- **Routing**: no need for `react-router` — a simple `useState`-backed view switch is
  enough for 7 views (matches Cline/Continue's approach; avoids URL/hash complexity
  inside a webview).
- **State**: lightweight store (Zustand, ~1KB, or a hand-rolled `useReducer` + Context if
  you want zero new deps) mirroring the extension-host state store described in §3.2 —
  webview state should be a *cache* of host state, never the source of truth (host owns
  auth, scan results, config; webview owns view mode, selection, scroll position).
- **Components**: build `DiffCard`, `LockEstimateCard`, `RollbackCard`,
  `PromotionGateCard`, `EmptyState`, `StatusPill`, `PipelineStepper` as a small internal
  design-system module (`webview-ui/src/components/`) shared across all 7 views —
  this is what makes 7 views feel like one product instead of 7 mini-apps.

### 3.2 Typed message-passing contract (webview ↔ extension host)

Both sides currently talk through ad hoc `postMessage` calls in `chatPanelManager.ts`
and friends. Formalize this **before** adding more views, or the surface area of manual
message-shape bugs grows linearly with every new view:

```ts
// shared/protocol.ts — imported by BOTH webview-ui and extension src
type HostToWebview =
  | { type: 'scan.progress'; payload: { percent: number; table?: string } }
  | { type: 'scan.result'; payload: ScanReport }
  | { type: 'auth.session'; payload: Session }
  | { type: 'erd.update'; payload: SchemaGraph }
  | { type: 'promotion.state'; payload: PromotionPipelineState }
  | { type: 'chat.token'; payload: { messageId: string; delta: string } };

type WebviewToHost =
  | { type: 'scan.run'; payload: { schema: string; db?: string } }
  | { type: 'fix.preview'; payload: { mismatchId: string } }
  | { type: 'fix.apply'; payload: { mismatchId: string; confirm: true } }
  | { type: 'promotion.approve'; payload: { stage: 'staging' | 'production' } }
  | { type: 'chat.send'; payload: { text: string; contextRefs: string[] } };
```

Both packages already import `@types/vscode`/TS project references — put this file in
a `shared/` workspace package so extension and webview import the *same* types, and a
breaking message shape becomes a compile error, not a runtime one.

### 3.3 Recommended folder structure

```
extensions/vscode/
  webview-ui/                 # NEW — the React SPA
    src/
      views/                  # Home, Visualizer, DriftFixes, Migrations, Assistant, Security, Settings
      components/             # DiffCard, LockEstimateCard, PipelineStepper, etc.
      store/                  # webview-side cache store
      bridge.ts                # thin wrapper over acquireVsCodeApi() + typed postMessage
    index.tsx
  shared/
    protocol.ts               # HostToWebview / WebviewToHost types
  src/                        # existing extension host code — mostly unchanged
    webview/
      panelProvider.ts        # NEW — single WebviewViewProvider, replaces createWebviewPanel call sites in erd/panel.ts, editor/schemaComparison.ts, chat/*
  webpack.extension.config.js # existing, target: node
  webpack.webview.config.js   # NEW, target: web, entry: webview-ui/index.tsx
```

---

## 4. Extension host architecture

### 4.1 Single `WebviewViewProvider`, feature modules as services

Today `erd/panel.ts`, `editor/fixPreview.ts`, `editor/schemaComparison.ts`,
`help/panels.ts`, `onboarding/wizard.ts` each independently call
`vscode.window.createWebviewPanel(...)` — five separate detached-tab webviews with
their own HTML generation. Consolidate:

- One `WebviewViewProvider` (`webview/panelProvider.ts`) owns the single webview's
  lifecycle and message routing.
- Existing feature classes (`ErdPanel`, fix preview, schema comparison) become **pure
  services** — they keep their extraction/diffing/watching logic exactly as-is, but stop
  owning a webview themselves. Instead they emit typed data (`SchemaGraph`, `DiffResult`)
  that `panelProvider.ts` forwards to the webview per the protocol in §3.2. This is a
  refactor of *ownership*, not a rewrite of *logic* — `erd/watcher.ts`,
  `erd/schema/*`, `erd/diff/*` stay untouched.
- Keep 2-3 exceptions as detached panels where a full editor tab genuinely makes sense
  (e.g., a full-screen ERD "focus mode" launched from the Visualizer view via
  `devsync.openERD`) — but make it a deliberate escape hatch, not the default.

### 4.2 Central state store (host side)

Introduce a single `DevSyncStateStore` (event-emitter-based, no new dependency needed)
that owns: auth session, active project, latest scan report, migration history,
promotion pipeline state, ERD schema graph. `sidebarProvider.ts`'s current
responsibilities (private `scanResults`/`migrationHistory`/`dashboardSync` counter) move
here. Every service (`CliRunner`, `ApiClient`, `ErdPanel`, chat manager) writes to this
store; `panelProvider.ts` subscribes once and forwards diffs to the webview. This
directly resolves the "fragmented state management" issue your own `IMPROVEMENTS.md`
flags, and is a prerequisite for the Home view's "single source of truth" status
summary and for the status bar item to stay in sync with the panel without polling.

### 4.3 Existing DI/interfaces are the right foundation

`src/interfaces/index.ts` already defines `IApiClient`, `IAuthManager`, `ICliRunner` —
good, keep using constructor injection through this refactor. Add `IDevSyncStateStore`
alongside them so `panelProvider.ts`, the status bar controller, and diagnostics/code
actions all depend on the interface, not a concrete class — keeps them independently
testable (this was already flagged as a goal in `IMPROVEMENTS.md` §1.1; this plan is
where it actually gets used).

---

## 5. Feature-view specs

### Home
Project/connection status card (from `DevSyncStateStore`), last-scan summary with
delta since previous scan, primary CTA sized to state: "Run first scan" (no config) →
"Scan now" (configured, stale) → "View 3 issues" (drift found). Recent activity feed
(last 5 scans/migrations) reusing `reporting/reportingManager.ts`.

### Visualizer
Embeds `erd/panel.ts`'s output live via the protocol; toolbar: Refresh, Live-watch
toggle (drives `erd/watcher.ts`), Diff-against-last-scan overlay, Export.
Click a table node → jumps to Drift & Fixes filtered to that table.

### Drift & Fixes
List (virtualized if large) of mismatches from `ScanReport`; each row expands to
`DiffCard` (SQL) + `LockEstimateCard` + "Preview"/"Apply" buttons wired to
`devsync.previewFix` / `devsync.applyFix` / `devsync.batchApplyFixes`. Filter bar
reuses `sidebar/searchFilter.ts` (already built, just needs a real toolbar entry point
instead of a Command Palette action).

### Migrations & Promotions
`PipelineStepper` (Dev → Staging → Production) bound to `devsync.platform.*` commands
(`showPlan`, `showPolicies`, `promotions`, `monitorPromotion`, `approvePromotion`,
`executePromotion`, `cancelPromotion`). Each stage chip shows state + click-to-expand
preflight JSON (`RollbackCard`). Below the stepper: flat migration history list
(`editor/migrationHistory.ts`).

### Assistant
Standard streaming chat (`chat/enhancedManager.ts`, `chat/errorRecovery.ts` already
handle streaming + recovery) but any answer referencing a mismatch/migration renders
the shared `DiffCard`/`LockEstimateCard` components inline, with a "review in Drift &
Fixes" deep link rather than duplicating the data as plain text. Context chips at the
input (`@schema`, `@last-scan`, `@table:orders`) sourced from `DevSyncStateStore`.

### Security & Audit
Read-only-mode badge, encryption/masking status (`security/dataMasking.ts`,
`credentialStorage.ts`), scrollable recent audit entries (`security/auditLog.ts`),
MFA status if applicable. This view's entire job is building the trust your landing
page already claims — right now nothing shows it inside the product itself.

### Settings
Config file editor shortcut, connection management (masked), theme/telemetry
preferences — the leanest view, mostly unchanged from current "Configuration" section.

---

## 6. Phased implementation plan

**Phase 0 — Foundation (no visible UI change yet)**
- Fix the broken VS Code extension test host (blocks all future regression testing — do this first, not last).
- Add the CLI-contract test (extension activation asserts installed CLI exposes every command it shells out to).
- Introduce `shared/protocol.ts` and `DevSyncStateStore`; migrate `sidebarProvider.ts`'s state into it without changing the visible tree yet.
- *Acceptance:* existing tree UI works identically, backed by the new store; extension tests run again.

**Phase 1 — Shell**
- Stand up `webpack.webview.config.js` + `webview-ui/` skeleton (React, nav rail, 7 empty views).
- Register single `WebviewViewProvider`, retire old TreeView registration.
- Wire Home view to `DevSyncStateStore` for real project/connection status.
- Add status bar item.
- *Acceptance:* users see the new shell with working navigation and a live Home view; old detached panels still work as fallback.

**Phase 2 — Core safety loop**
- Drift & Fixes view with `DiffCard`/`LockEstimateCard`, wired to existing fix/preview/apply commands.
- Visualizer view embedding live ERD via the message protocol (retire detached ERD panel as default entry point).
- *Acceptance:* full scan → review → apply loop works entirely inside the panel, no Command Palette required.

**Phase 3 — The differentiator**
- Migrations & Promotions `PipelineStepper`, wiring all 7 currently-orphaned `platform.*` commands.
- Security & Audit view.
- *Acceptance:* the product visually delivers on every claim on the marketing site (preflight, approval gates, audit trail).

**Phase 4 — Assistant integration**
- Persistent Assistant view, streaming, typed evidence cards, context chips.
- Cross-links from Assistant → Drift & Fixes / Visualizer and back.
- *Acceptance:* AI answers about schema issues are never plain prose when structured data (a diff, a lock estimate) is available.

**Phase 5 — Polish & convergence**
- CodeLens + inline diagnostics parity check (confirm squiggles fire correctly against real drift).
- Remove now-redundant detached-panel code paths in `erd/panel.ts`, `editor/fixPreview.ts`, etc. once services are fully consumed by the new provider.
- Design-system pass: consistent spacing/typography tokens across all 7 views, dark/light theme QA.

---

## 7. Testing & quality gates

- Unblock and re-enable the VS Code extension test suite (Phase 0 — currently broken per the repo's own README).
- Contract tests for `shared/protocol.ts` message shapes (compile-time via shared types + a runtime schema check with `zod`, already a dependency).
- Snapshot/interaction tests for shared components (`DiffCard`, `PipelineStepper`) independent of VS Code, runnable in plain Jest/Vitest since they're pure React.
- CLI-extension contract test from the earlier audit (Phase 0).
- Manual theme QA checklist (light, dark, high-contrast) before each phase ships.

## 8. Rollout strategy

- Feature-flag the new webview shell behind a setting (`devsync.experimentalPanel`) during Phases 1-2 so the existing tree stays the default until Drift & Fixes reaches parity.
- Flip the default in Phase 3 once Migrations & Promotions ships — that's the point the new UI functionally exceeds the old one, not just looks nicer.
- Keep the old `TreeDataProvider` code for one release cycle behind the flag as a rollback path, then delete it.

---

*This plan assumes the existing backend modules (`erd/`, `security/`, `chat/`, `editor/`,
`platform.*` commands) are functionally sound and mainly need an ownership refactor +
UI surface, not a rewrite. If any of them turn out to be incomplete under the hood once
you're inside them, treat that as a scope note for the relevant phase rather than a
blocker for the whole plan.*

# CLI Authentication & Test Guide

This document explains how we validate the new device-login flow across the CLI and dashboard, and how to run the automated regression suite that now guards it.

---

## ✅ What’s Covered

- `login` device authorization (start, poll, token refresh)
- Auth-config persistence (`~/.config/devsync/config.json`)
- `scan` command authentication gate (including non-interactive runs)
- API client retry/timeout helpers
- Project helper utilities (`normalizeSchemaType`, config scaffolding)

---

## 🚀 Automated Test Suite

### Requirements

- Node.js ≥ 20 (current dev env runs Node 25)
- `npm install` already executed at repo root (brings in CLI deps)

### Run all CLI tests

```bash
cd packages/cli
npm run test
```

What happens:
- Runs every file in `packages/cli/tests`
- Mocks the analyzer API/D device endpoints (no external services required)
- Creates an isolated temp auth config (via `DEVSYNC_CONFIG_PATH`)
- Leverages `DEVSYNC_TEST_MODE=auth-only` so `scan` exits after auth checks

Key environment knobs (set automatically by the integration test):

| Variable | Purpose |
|----------|---------|
| `DEVSYNC_CONFIG_PATH` | Where the CLI stores login tokens. Tests redirect this to a temp file. |
| `DEVSYNC_SILENT` | Suppresses spinner/log noise for stable snapshots. |
| `DEVSYNC_TEST_MODE` | When `auth-only`, `scan` stops after verifying tokens. |

---

## 🧪 Manual Auth Verification

When you want to confirm against a live analyzer + Supabase project:

1. **Run analyzer service** (`apps/analyzer`) with your Supabase creds + Redis.
2. **Start dashboard** (`apps/dashboard`) so the `/device` approval UI is available.
3. **Launch CLI login**:
   ```bash
   cd packages/cli
   node dist/index.js login
   ```
4. Open the dashboard’s `/device` page (or the verification URL shown in the terminal) and approve the device code.
5. Run `node dist/index.js scan --json --no-sync` to ensure the CLI reuses the stored auth tokens.

Tips:

- Set `NEXT_PUBLIC_ANALYZER_URL` in `apps/dashboard/.env.local` so the `/device` UI points at your analyzer instance.
- Delete `~/.config/devsync/config.json` (or set `DEVSYNC_CONFIG_PATH`) to force a fresh device flow.

---

## 📎 Troubleshooting

| Symptom | Resolution |
|---------|------------|
| `fetch failed` during tests | Ensure Node has network access disabled? (expected, tests mock fetch). If a real analyzer is running on the same port, make sure nothing else binds to it. |
| Login test hangs | The integration test relies on mocked responses. If you changed `packages/cli/tests/login-scan.integration.test.js`, confirm `globalThis.fetch` is mocked before `loginCommand` runs. |
| Real CLI says “DevSync CLI is not logged in” | Remove the temp config or rerun `devsync login`. |

---

Need more coverage? Extend `packages/cli/tests` with additional `.test.js` files and import them from `tests/all.test.js`. The mocks provided in the current suite can be reused to simulate analyzer failures, refresh loops, or config edge cases. 


# DevSync

DevSync provides:
- a CLI in `packages/cli`
- a VS Code extension in `extensions/vscode`
- a dashboard/service surface under `apps/`

This README is the current end-to-end validation and production-readiness audit baseline.

## Session Change Summary

Changes completed during this session:
- Added CLI `login` command wiring in `packages/cli/src/index.ts`.
- Added CLI `migrate` command wiring in `packages/cli/src/index.ts` to restore extension compatibility.
- Extended `scan` to include detailed project + database inventory:
  - inferred project databases (for example Supabase migrations without live URL)
  - connection masking and provider detection
  - per-database reachability/detail reporting
  - project summary block
- Fixed summary mismatch so `Databases detected` reflects actual detected databases.
- Fixed CLI test syntax error in `packages/cli/tests/retry-timeout.test.js`.
- Added missing shared helper module for tests: `packages/cli/src/commands/projects/shared.ts`.
- Fixed VS Code extension `pretest` script separator in `extensions/vscode/package.json`.
- Fixed extension enhanced runner CLI path guard bug in `extensions/vscode/src/cli/enhancedRunner.ts`.
- Added VS Code test-host cache cleanup in `extensions/vscode/src/test/runTest.ts` to reduce stale host failures.
- Added `formatLastScan()` export in `packages/cli/src/commands/scan.ts` for test compatibility.

## Validation Results

### CLI execution

Executed successfully in local/dev environment:
- `devsync --version`
- `devsync help`
- `devsync init --path <project>`
- `devsync scan --path <project>`
- `devsync status --path <project>`
- `devsync fix --path <project>` (expected safe-block without DB URL)
- `devsync apply` (expected safe-block)
- `devsync login --help`
- `devsync migrate --help` (after command registration + reinstall)

Observed expected behavior:
- scan is read-only by default
- apply is blocked by default
- fix requires DB context for full operation
- project database inference works even without live DB URL

### CLI automated tests

Status: **failing (pre-existing/legacy suite drift), partially improved**
- Initial failures fixed:
  - JS/TS syntax mismatch in tests
  - missing shared helper module
  - missing `formatLastScan` export
- Remaining failures are mainly expectation drift between tests and current auth/network messaging/behavior.

### VS Code extension validation

Completed:
- `npm run compile` passes
- `npm run compile-tests` passes

Blocked:
- `npm run test` still fails due VS Code test host startup message:
  - `Code is currently being updated. Please wait for the update to complete before launching.`
- Added mitigation (cache cleanup + retry scaffolding), but environment still reproduces this host-level issue.

### CLI ↔ extension integration

Integration issues found and fixed:
- Extension expected CLI `migrate`; CLI did not expose it. Fixed by wiring `migrate` command in CLI entrypoint.
- Enhanced extension runner had a workspace-folder guard bug that could incorrectly return `CLI not found`. Fixed.

## Security and Dependency Audit

### Dependency health

Audit commands run:
- `packages/cli`: `npm audit --omit=dev` -> **0 vulnerabilities**
- `extensions/vscode`: `npm audit --omit=dev` -> **11 vulnerabilities** (transitive, includes high severity)

Primary actionable risk in extension dependencies:
- `dompurify` advisory chain (moderate)
- transitive `sqlite3`/`node-gyp`/`tar` and minimatch advisory chain (includes high severity)

Recommended action:
- Run targeted updates in `extensions/vscode` and re-test:
  - start with `npm audit fix`
  - evaluate breaking upgrade path for `sqlite3` carefully before `npm audit fix --force`

### Environment variable and secret handling

Current posture:
- CLI stores auth config under user config path (`~/.config/devsync/config.json`), with best-effort restrictive permissions on non-Windows.
- Extension auth tokens are stored via VS Code secrets storage.
- Scan output masks credentials when printing connection strings.

Gaps to close:
- Add a secret-scanning step in CI.
- Standardize env var names and docs across CLI/extension/dashboard.
- Add stricter validation for required env vars at startup across packages.

## Install, Run, and Test

### Prerequisites

- Node.js 20+ recommended
- npm 10+

### CLI

```bash
cd packages/cli
npm install
npm run build
npm install -g .
```

Run:

```bash
devsync help
devsync scan --path /path/to/project
devsync status --path /path/to/project
devsync fix --path /path/to/project --db postgresql://...
devsync migrate --path /path/to/project --db postgresql://...
```

Test:

```bash
cd packages/cli
npm test
```

### VS Code extension

```bash
cd extensions/vscode
npm install
npm run compile
```

Run locally:
- Open `extensions/vscode` in VS Code
- Press `F5` to launch Extension Development Host

Test:

```bash
cd extensions/vscode
npm run compile-tests
npm run test
```

## Production Readiness Roadmap

Remaining work to reach production-grade confidence:

1. **Stabilize test suites**
- Align legacy CLI tests with current auth/network messages and lifecycle behavior.
- Add deterministic integration tests for scan/login with mocked services.
- Fix VS Code test-host update lock issue in CI/local runners (pin stable test host strategy).

2. **CI/CD hardening**
- Add required pipelines for:
  - CLI build + tests + audit
  - extension build + tests + audit
  - dashboard build + tests
- Enforce branch protection with required checks.

3. **Security hardening**
- Resolve extension dependency vulnerabilities.
- Add SAST + dependency scanning + secret scanning in CI.
- Add release-time SBOM generation.

4. **Release engineering**
- Introduce semantic versioning + changelog automation.
- Add reproducible release flow for CLI (`npm publish`) and extension packaging (`vsce package/publish`).

5. **Observability and operations**
- Structured logging conventions across CLI/extension/dashboard.
- Error reporting and telemetry policy with explicit user opt-in.
- Health checks and service diagnostics for auth/device-flow endpoints.

6. **Documentation completeness**
- Add architecture diagram for CLI-extension-dashboard handshake.
- Add troubleshooting for auth/device-flow and DB connectivity edge cases.
- Add contributor test matrix (Windows/macOS/Linux).

# DevSync Changes After the Atlas and Bytebase Discussion

**Prepared:** July 2026  
**Scope:** Work completed after the product discussion about Atlas- and Bytebase-style database change management capabilities.

## Purpose

The Atlas and Bytebase discussion shifted DevSync from being primarily a schema-drift scanner into a broader database change-control platform.

The work described here does not attempt to clone either product. Instead, it applies the most relevant product ideas to DevSync:

- application-aware schema change planning;
- reviewable and immutable migration artifacts;
- migration rehearsal against disposable or managed environments;
- policy-based approvals and production protection;
- controlled promotion between environments;
- durable execution and audit evidence;
- developer access through CLI, VS Code, CI, and the dashboard;
- team, integration, billing, and enterprise controls.

## Executive Summary

The implementation added:

1. A structured change-intelligence model connecting code evidence, schema drift, migrations, policies, rehearsals, and promotions.
2. Environment topology and promotion workflows for development, preview, staging, and production.
3. Evidence-backed change plans with version history and immutable patch bundles.
4. Policy-as-code enforcement and risk-derived approval requirements.
5. Migration rehearsal with local PostgreSQL transactions, Neon branches, and managed preview-provider lifecycle support.
6. Durable background jobs for long-running promotion and integration work.
7. GitHub pull-request review support and team delivery integrations.
8. Enterprise foundations for entitlements, usage, billing, SSO, SCIM, audit export, and retention.
9. New CLI and VS Code platform commands.
10. A complete developer-tool redesign of the dashboard, landing page, and settings control plane.
11. CI, security, hydration, and Server Component reliability fixes.

---

## 1. Application-Aware Change Intelligence

DevSync now models a database change as more than a raw SQL file.

### Added capabilities

- Structured change plans derived from scan reports and detected mismatches.
- Code evidence and dependency analysis for affected schema objects.
- Risk scoring and release-readiness evaluation.
- Migration impact metadata such as affected objects, destructive operations, lock risk, rollback coverage, and supporting evidence.
- Plan enrichment through AI-assisted structured analysis.
- Versioned plans so an approval always refers to a specific revision.
- Patch bundles containing reviewable migration and rollback artifacts.

### Core implementation

- `lib/change-intelligence.ts`
- `lib/change-plan-engine.ts`
- `lib/ast-dependency-analyzer.ts`
- `lib/plan-enrichment.ts`
- `lib/patch-generator.ts`
- `lib/structured-model.ts`
- `components/plans/`
- Change-plan and patch API routes under `app/api/change-plans/`, `app/api/change-plan-versions/`, and `app/api/scan-reports/`

### Database foundation

Migration `011_change_intelligence_platform.sql` introduced the central records used to connect:

- project environments;
- code evidence;
- change plans;
- policies and evaluations;
- migration rehearsals;
- release-readiness evidence.

Migration `016_change_plan_versions.sql` added immutable plan revisions.

Migration `017_patch_bundles.sql` added immutable patch artifacts and database-level mutation protection.

---

## 2. Environment Topology

Projects can now represent more than a single database connection.

### Added capabilities

- Development, preview, staging, and production environment tiers.
- Environment health and schema-fingerprint tracking.
- Protected production targets.
- Approval requirements per environment.
- Provider configuration for disposable rehearsal environments.
- Adjacent-environment schema comparison and promotion planning.
- Encrypted environment-secret storage.

### Core implementation

- `components/environments/EnvironmentPipeline.tsx`
- `components/environments/EnvironmentProviderSettings.tsx`
- Environment APIs under `app/api/projects/[id]/environments/` and `app/api/environments/`
- `lib/secret-vault.ts`
- Preview-provider implementations under `lib/preview-providers/`

### Database foundation

- `013_environment_secrets.sql`
- `020_managed_preview_providers.sql`

Environment credentials are scoped to their project or environment instead of being exposed as general account settings.

---

## 3. Migration Rehearsal

Migrations can now be exercised before production execution.

### Rehearsal strategies

- PostgreSQL transaction-based rehearsal.
- Neon branch-based rehearsal.
- Production-shaped managed preview environments.
- Static fallback when a real provider is unavailable.

### Evidence captured

- execution result;
- duration;
- errors and warnings;
- schema state before and after;
- rollback availability;
- provider and environment metadata;
- whether the rehearsal was real or simulated.

### Core implementation

- `lib/rehearsal-engine.ts`
- `lib/preview-providers/postgres-transaction.ts`
- `lib/preview-providers/neon-branch.ts`
- `components/rehearsals/MigrationRehearsal.tsx`
- `app/api/migrations/[id]/rehearsals/`

This supports Bytebase-style pre-production validation while keeping DevSync's existing read-only-first safety model.

---

## 4. Policy-as-Code and Release Readiness

Change approval is now based on explicit policy and evidence rather than a single generic confirmation.

### Built-in policy concepts

- block breaking changes;
- require owners;
- require tests;
- require a real rehearsal;
- require rollback coverage;
- enforce maximum risk score;
- require approvals for protected environments.

### Enforcement modes

- advisory;
- warning;
- blocking.

### Core implementation

- `lib/policy-engine.ts`
- `lib/release-readiness.ts`
- `components/policies/PolicyCenter.tsx`
- Project policy API under `app/api/projects/[id]/policies/`
- Change-plan approval API under `app/api/change-plans/[id]/approve/`

### Database foundation

- `014_policies_github_audit.sql`

Policy evaluation records provide an audit trail explaining why a change was allowed or blocked.

---

## 5. Environment Promotion and Approval Control

DevSync now separates planning, approval, execution, and cancellation.

### Promotion lifecycle

1. Create a promotion plan.
2. Evaluate risk and policy.
3. Attach rehearsal and rollback evidence.
4. Calculate the required approval quorum.
5. Record append-only approval votes.
6. Execute through a durable background job.
7. Stream or poll execution state.
8. Complete, fail, or cancel with recorded telemetry.

### Added protections

- one active promotion per migration and target;
- immutable approval votes;
- risk-derived approval quorum;
- protected-target enforcement;
- cancellation state;
- execution idempotency;
- deployment telemetry and failure evidence.

### Core implementation

- `lib/promotion-control.ts`
- `lib/promotion-executor.ts`
- Promotion APIs under `app/api/projects/[id]/promotions/` and `app/api/promotions/`
- CLI platform commands for planning, approval, execution, monitoring, and cancellation
- VS Code commands for the same platform workflow

### Database foundation

- `012_release_promotions.sql`
- `018_promotion_controls.sql`
- `019_promotion_execution_jobs.sql`

---

## 6. Durable Jobs and Worker Infrastructure

Long-running work no longer needs to complete within the initiating request.

### Added job types

- GitHub pull-request review;
- promotion execution;
- integration delivery;
- preview cleanup.

### Added behavior

- queued, running, completed, failed, and cancelled states;
- idempotency keys;
- attempt tracking;
- execution metadata;
- cleanup worker support;
- durable status polling.

### Core implementation

- `lib/job-queue.ts`
- `app/api/workers/jobs/`
- `app/api/workers/preview-cleanup/`
- `015_background_jobs.sql`
- extensions to job constraints in later migrations

---

## 7. GitHub and Team Integrations

### GitHub

- GitHub App installation management.
- Repository selection when creating projects.
- Pull-request review records.
- Change-plan and policy evidence attached to review workflows.
- GitHub webhook handling.

### Team delivery integrations

- Slack.
- Microsoft Teams.
- Generic webhooks.
- Event selection.
- Delivery through durable jobs.
- Integration removal and delivery-history support.

### Core implementation

- `lib/github-app.ts`
- `components/github/GitHubConnectionsManager.tsx`
- `components/github/PullRequestReviews.tsx`
- GitHub APIs under `app/api/github/`
- `lib/team-integrations.ts`
- `components/teams/TeamIntegrations.tsx`
- `app/api/teams/[id]/integrations/`
- `021_team_integrations.sql`

---

## 8. Enterprise, Entitlements, and Billing Foundation

The platform now has a base for commercial team and enterprise operation.

### Entitlements

- Free, Team, and Enterprise plans.
- Project, member, scan, and managed-preview limits.
- Feature gates for SSO, SCIM, audit export, managed previews, and custom retention.
- Usage-event recording.

### Enterprise security

- team security settings;
- SSO configuration endpoint;
- SCIM token and identity foundation;
- audit export;
- retention controls;
- owner-only management policies.

### Billing

- Stripe Checkout session creation.
- Stripe billing-portal sessions.
- Webhook handling.
- Team entitlement synchronization.

### Core implementation

- `lib/entitlements.ts`
- `lib/enterprise-security.ts`
- `lib/scim.ts`
- `lib/audit.ts`
- `lib/stripe-billing.ts`
- `components/teams/EnterpriseControlCenter.tsx`
- Billing, SSO, SCIM, and audit APIs
- `022_enterprise_foundation.sql`

---

## 9. CLI and VS Code Platform Workflows

The platform controls are available outside the dashboard.

### CLI

Added platform commands for:

- viewing evidence-backed change plans;
- viewing and modifying safety policy;
- planning environment promotions;
- monitoring promotion execution;
- approving promotions;
- executing approved promotions;
- cancelling promotions.

Relevant implementation:

- `packages/cli/src/commands/platform.ts`
- CLI API-client and command registration changes

### VS Code

Added commands for:

- showing plans and policies;
- planning promotions;
- monitoring promotions;
- approving, executing, and cancelling promotions;
- controlling the durable task queue.

The extension continues to support schema scans, diagnostics, migration previews, history, ERD, and secure device authentication.

---

## 10. Dashboard Redesign

The dashboard was changed from a generic SaaS-card layout into an engineering control plane.

### Application shell

- Persistent left sidebar.
- Workspace, branch, and environment context.
- Compact top toolbar.
- Command palette.
- Dark mode by default.
- Dense, flat surfaces with semantic status color.

### Operational overview

- Workspace health.
- In-sync, drift, and failed-scan metrics.
- Compiler-style issue queue.
- Terminal-style activity stream.
- CLI and CI quick actions.

### Project management

- Dense project table replacing cards.
- Stack, environment, branch, scan state, drift, and last-scan columns.
- Project actions moved into an overflow menu.
- Existing pagination, search, realtime refresh, and typed deletion confirmation retained.

### Main implementation

- `components/dashboard/DashboardShell.tsx`
- `components/dashboard/MissionControl.tsx`
- `components/ProjectsList.tsx`
- dashboard layout and page updates

---

## 11. Landing Page Redesign

The public site now demonstrates the product through believable engineering artifacts.

### Changes

- Product-workspace hero instead of a generic marketing hero.
- Copyable CLI commands.
- Branch, environment, schema-diff, SQL, risk, and rollback metadata.
- ORM/database/workflow compatibility matrix.
- Detect → Review → Ship workflow.
- Migration review and preflight examples.
- CLI, VS Code, CI, and pull-request surfaces.
- Install-first CTA instead of email capture.
- Compact technical footer.
- Removal of redundant persona and feature-card sections from the rendered page.

### Main implementation

- `components/landing/Hero.tsx`
- `components/landing/LandingNav.tsx`
- `components/landing/TrustStrip.tsx`
- `components/landing/HowItWorks.tsx`
- `components/landing/Features.tsx`
- `components/landing/DeveloperExperience.tsx`
- `components/landing/Safety.tsx`
- `components/landing/CallToAction.tsx`
- `components/landing/Footer.tsx`

---

## 12. Settings Control Plane

Settings was expanded from only Profile and GitHub into a full developer-platform control plane.

### Sections added

- General account settings.
- Appearance and interface density.
- Developer access, CLI, tokens, and VS Code configuration.
- GitHub and team integrations.
- Notification channels.
- Migration defaults.
- Project environments.
- AI and analysis preferences.
- Security and session information.
- Billing and usage.
- Danger-zone routing.

### Persistence model

- Profile and notification preferences persist through Supabase.
- GitHub installations use the GitHub App APIs.
- Project policies and environments remain project-scoped.
- Billing, webhooks, and enterprise controls remain team-scoped.
- Appearance and workflow defaults persist in browser storage and are explicitly identified as browser defaults.

### Main implementation

- `components/settings/SettingsControlPlane.tsx`
- `app/dashboard/settings/page.tsx`

---

## 13. Reliability Fixes

### Hydration

Fixed production hydration failures caused by:

- theme class changes before hydration;
- locale-dependent timestamps;
- `Date.now()`-based server rendering;
- locale-specific project scan times.

The intentional theme bootstrap now uses `suppressHydrationWarning`, and rendered timestamps are deterministic.

### Team Server Component

Fixed `/dashboard/teams/[id]` returning HTTP 500 because a Server Component passed a browser callback into `MemberActions`.

Refresh behavior now lives inside the client component through `router.refresh()`.

A route-local team error boundary was also added.

### Migration execution validation

Fixed migration execution safety analysis running before:

- already-applied validation;
- database-connection validation;
- SQL-content validation.

The endpoint now returns controlled `400` responses instead of throwing on undefined SQL.

---

## 14. CI and Security Work

### Dashboard CI

- Migration execution tests repaired.
- All dashboard tests pass: **19 suites, 98 tests**.
- Production Next.js build passes.
- Non-breaking dependency updates removed `tar` and `ws` advisories.
- The audit continues to report the current Next.js high-severity advisory set.
- CI blocks critical vulnerabilities until the required Next.js/React major migration is performed.

### VS Code CI

- Extension TypeScript and webpack compilation pass.
- Test compilation passes.
- Added a focused blocking CI ESLint profile.
- Fixed a real unreachable-code finding.
- Extension production dependency audit reports zero vulnerabilities.

### Secret scanning

- Removed a tracked `apps/dashboard/.env` containing credential-shaped values.
- Added repository-wide environment-file ignore rules.
- Kept safe example environment files trackable.

**Required operational action:** rotate the Supabase and OpenAI credentials that were previously committed. Removing the file does not remove the values from Git history.

---

## 15. Database Migration Order

Apply the post-change-intelligence migrations in numeric order:

1. `011_change_intelligence_platform.sql`
2. `012_release_promotions.sql`
3. `013_environment_secrets.sql`
4. `014_policies_github_audit.sql`
5. `015_background_jobs.sql`
6. `016_change_plan_versions.sql`
7. `017_patch_bundles.sql`
8. `018_promotion_controls.sql`
9. `019_promotion_execution_jobs.sql`
10. `020_managed_preview_providers.sql`
11. `021_team_integrations.sql`
12. `022_enterprise_foundation.sql`

Before applying these, ensure the core and RLS migrations through `010` are already present.

Do not reorder these migrations. Later migrations extend constraints and tables introduced by earlier ones.

---

## 16. Deployment Configuration

The expanded platform may require configuration for:

- Supabase URL and anonymous key;
- Supabase service-role key for trusted server operations;
- environment-secret encryption key;
- GitHub App ID, private key, client ID, client secret, and webhook secret;
- preview-provider credentials, such as Neon;
- Stripe secret, webhook secret, and price IDs;
- worker authorization or scheduling;
- AI provider configuration;
- application base URL and callback URLs.

Secrets must be supplied through the deployment platform and must not be committed to the repository.

---

## 17. Current Limitations and Follow-Up Work

### Required

- Rotate credentials previously stored in the tracked dashboard `.env`.
- Apply migrations `011` through `022` to the production Supabase project.
- Configure worker scheduling for durable jobs and preview cleanup.
- Verify GitHub, Stripe, webhook, and preview-provider secrets in production.
- Plan and test the Next.js/React major upgrade required to clear the remaining framework advisories.

### Recommended

- Add end-to-end tests for authenticated team, policy, rehearsal, and promotion flows.
- Add provider-backed integration tests for Neon previews.
- Add webhook-delivery retry and dead-letter observability.
- Add a dedicated account-deletion/export API if self-service account deletion is required.
- Replace browser-scoped migration defaults with persisted account or workspace preferences if cross-device consistency becomes necessary.
- Continue reducing the VS Code extension's legacy lint backlog beyond the focused CI blocking profile.

---

## 18. Resulting Product Position

DevSync now covers a wider database-delivery lifecycle:

```text
Code and ORM schema
        ↓
Drift detection
        ↓
Evidence-backed change plan
        ↓
Policy evaluation
        ↓
Migration and rollback patch
        ↓
Disposable-environment rehearsal
        ↓
Approval quorum
        ↓
Environment promotion
        ↓
Durable execution and audit evidence
```

The result is a platform that combines DevSync's original schema-awareness and developer tooling with controlled database delivery concepts discussed in the Atlas and Bytebase comparison.

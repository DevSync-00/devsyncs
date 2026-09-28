# Golden-path end-to-end test

This suite runs against the real authentication, GitHub App, PostgreSQL, scan,
plan, and approval stack. It intentionally does not mock network responses.

Required environment variables:

- `E2E_USER_EMAIL` and `E2E_USER_PASSWORD`: a confirmed test account
- `E2E_GITHUB_REPOSITORY`: an HTTPS repository URL authorized for that account
- `E2E_READONLY_DATABASE_URL`: a PostgreSQL database with deliberate drift from
  the fixture repository, using a role limited to CONNECT, USAGE, and SELECT
- `E2E_BASE_URL`: optional deployed URL; otherwise Playwright starts the app

Run `npm run test:e2e`. The fixture must produce at least one mismatch whose
plan is below the two-person high-risk approval threshold.

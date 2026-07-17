# Dev-Sync.dev Dashboard

Next.js dashboard for Dev-Sync.dev - Phase 2 implementation.

## Setup

### 1. Install Dependencies

```bash
cd apps/dashboard
npm install
```

### 2. Set Up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Settings > API
3. Create `.env.local`:

```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
```

For email verification, verify `bitlabsbuild.com` in Resend and create a Resend
API key. In Supabase, enable **Authentication > Providers > Email > Confirm
email**, then configure custom SMTP under **Authentication > Email > SMTP
Settings**:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: your Resend API key
- Sender name: `DevSync`
- Sender email: `devsync@bitlabsbuild.com`

Disable **click tracking** and **open tracking** for the sending domain in
Resend. Authentication links must not be rewritten through a tracking domain.

For Google authentication, create a Web OAuth client in Google Cloud, add the
Supabase callback URL shown on its Google provider page as an authorized
redirect URI, and add the client ID and secret under **Authentication >
Providers > Google**. Add local and production `/auth/callback` URLs to
Supabase's redirect allow list. Provider secrets must not be committed here.

Under **Supabase Authentication > URL Configuration**, set:

- Site URL: `https://www.dev-sync.dev`
- Redirect URL: `https://www.dev-sync.dev/auth/callback`

The application also defaults auth callbacks to this production URL so a
missing deployment environment variable cannot generate localhost links.

### 3. Run Database Migrations

See `supabase/migrations/` for database schema.

### GitHub App

Create a GitHub App named DevSync with:

- Homepage URL: `https://www.dev-sync.dev`
- Setup URL: `https://www.dev-sync.dev/api/github/callback`
- Redirect on update: enabled
- Repository permission: **Contents — Read-only**
- Webhooks: disabled (not required for repository scans)
- Installation target: Any account

Generate a private key and configure `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, and
`GITHUB_APP_PRIVATE_KEY` in the deployment environment. Apply migration
`007_github_app_installations.sql` before enabling the connection button.
DevSync persists installation IDs only and creates repository-scoped,
short-lived installation tokens for scans.

Configure the GitHub App callback URL as
`https://www.dev-sync.dev/api/github/callback`, then add
`GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` to the deployment.
User authorization lets multiple DevSync accounts securely connect the same
existing GitHub App installation.

For Vercel, `GITHUB_APP_PRIVATE_KEY_BASE64` is the most reliable option. Set it
to the base64 encoding of the complete `.pem` file downloaded from GitHub; it
takes precedence over `GITHUB_APP_PRIVATE_KEY`.

The Setup URL is required: GitHub sends the `installation_id` and DevSync
state to that route after installation. Without it, installation succeeds on
GitHub but the installation is never connected to the signed-in DevSync user.

Run migrations using Supabase CLI or via Supabase Dashboard:

```bash
# If you have Supabase CLI
supabase db push

# Or use Supabase Dashboard SQL Editor
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features

- ✅ Authentication (Supabase Auth)
- ✅ Project Management
- ✅ Scan Report Viewing
- ✅ Schema Diff Visualization
- ✅ Team Sharing (basic)

## Project Structure

```
apps/dashboard/
├── app/              # Next.js App Router pages
├── components/       # React components
├── lib/              # Utilities and Supabase client
├── supabase/         # Database migrations
└── public/           # Static assets
```

## Documentation

- 📖 [User Guide](./docs/USER_GUIDE.md) - Complete user guide
- 📖 [Migration Execution Guide](./docs/MIGRATION_EXECUTION_GUIDE.md) - How to apply migrations
- 📖 [Migration History Guide](./docs/MIGRATION_HISTORY_GUIDE.md) - Track execution history
- 📖 [API Reference](./docs/API_REFERENCE.md) - Complete API documentation
- 📖 [Testing Setup](./TESTING_SETUP.md) - Testing infrastructure guide
- 📖 [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
- 📖 [CLI Integration](./CLI_INTEGRATION_SUMMARY.md) - Connect CLI to dashboard

## Features

### ✅ Core Features
- Authentication (Supabase Auth)
- Project Management
- Scan Report Viewing
- Schema Diff Visualization

### ✅ Migration Management
- Migration Generation
- Migration Execution (with dry-run validation)
- Migration History Tracking
- Migration Preview & Download

### ✅ AI Features
- AI-powered Migration Explanations
- Risk Assessment
- Natural Language Queries
- Template Fallback

### ✅ Quality & Testing
- Comprehensive Test Coverage
- Unit Tests (Components)
- Integration Tests (API Routes)
- Error Handling & Logging

## Next Steps

- [ ] Add migration rollback functionality
- [ ] Add batch migration operations
- [ ] Add export/import features
- [ ] Add team collaboration features
- [ ] Add notification system


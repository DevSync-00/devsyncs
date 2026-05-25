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

### 3. Run Database Migrations

See `supabase/migrations/` for database schema.

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


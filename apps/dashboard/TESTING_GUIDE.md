# Testing CLI → Dashboard Integration

## Prerequisites

1. ✅ Dashboard dependencies installed (`npm install`)
2. ✅ CLI built (`cd packages/cli && npm run build`)
3. ⚠️ Supabase project created (optional for basic testing)

## Quick Test (Without Supabase)

If Supabase isn't set up yet, we can test the CLI locally and verify the dashboard UI works.

### Step 1: Start Dashboard Server

```bash
cd apps/dashboard
npm run dev
```

Dashboard should be running at `http://localhost:3000`

### Step 2: Test Landing Page

Visit `http://localhost:3000` - you should see the landing page.

### Step 3: Test CLI Locally (No Cloud Sync)

```bash
# From project root
cd test-prisma-project
devsync scan
```

Should show:
- ✅ Code schema extracted
- ✅ Models listed
- ✅ No database connection warning

### Step 4: Test CLI with Database (Optional)

If you have a PostgreSQL database:
```bash
devsync scan \
  --path ./test-prisma-project \
  --db postgresql://user:pass@localhost:5432/db
```

---

## Full Integration Test (With Supabase)

### Step 1: Set Up Supabase

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Get project URL and anon key from Settings > API
4. Create `.env.local` in `apps/dashboard/`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Step 2: Run Database Migrations

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run in SQL Editor

### Step 3: Start Dashboard

```bash
cd apps/dashboard
npm run dev
```

### Step 4: Create Project in Dashboard

1. Visit `http://localhost:3000`
2. Click "Get Early Access" → Sign up
3. After signup, you'll be redirected to dashboard
4. Click "New Project"
5. Create a project (e.g., "Test Project")
6. **Copy the project ID from the URL**: `/dashboard/projects/[PROJECT_ID]`

### Step 5: Get API Token (JWT)

**Method 1: Browser Cookie**
1. In dashboard, open DevTools (F12)
2. Application tab → Cookies
3. Find cookie: `sb-<project-id>-auth-token`
4. Copy the token value

**Method 2: Supabase Dashboard**
1. Go to Supabase Dashboard → Authentication → Users
2. Generate API key or access token

### Step 6: Configure CLI

```bash
# In test-prisma-project or your project
devsync init

# Edit .devsync/config.json:
{
  "version": "1.0",
  "project": {
    "name": "Test Project",
    "schemaType": "prisma",
    "id": "<PROJECT_ID_FROM_STEP_4>"
  },
  "database": {
    "provider": "postgresql"
  },
  "api": {
    "url": "http://localhost:3000",
    "key": "<JWT_TOKEN_FROM_STEP_5>"
  }
}
```

### Step 7: Run Scan with Cloud Sync

```bash
# Test with database (if available)
devsync scan \
  --path ./test-prisma-project \
  --db postgresql://user:pass@localhost:5432/db

# Or test without database (code-only)
devsync scan --path ./test-prisma-project
```

**Expected Output**:
```
🔍 Scanning codebase and database...

📁 Scanning codebase...
✅ Code schema extracted (3 models)

⚠️  No database connection provided
💡 Tip: Use --db flag or set in .devsync/config.json

📋 Models found in codebase:
  • User
  • Post
  • Category

☁️  Syncing results to dashboard...
✅ Scan report synced to dashboard!
   Scan ID: abc123...
   View in dashboard: http://localhost:3000/dashboard/projects/...
```

### Step 8: View in Dashboard

1. Visit `http://localhost:3000/dashboard`
2. Click on your project
3. You should see the scan report in the list!
4. Click on the scan report to view details

---

## Troubleshooting

### Error: "Unauthorized"
- **Cause**: Invalid or expired JWT token
- **Fix**: Get a fresh token from browser cookies or Supabase

### Error: "Project not found"
- **Cause**: Wrong project ID
- **Fix**: Double-check project ID from dashboard URL

### Error: "Failed to sync to cloud"
- **Cause**: Dashboard server not running or API URL wrong
- **Fix**: 
  - Make sure `npm run dev` is running in `apps/dashboard`
  - Check API URL is `http://localhost:3000` (not `https://`)

### Dashboard shows no reports
- **Cause**: Project ID mismatch or RLS blocking
- **Fix**:
  - Verify project ID in config matches dashboard
  - Check Supabase RLS policies are correct

---

## Test Scenarios

### Scenario 1: Code-Only Scan (No Database)
✅ Should work - scans code, sends to dashboard

### Scenario 2: Full Scan with Database
✅ Should work - scans code + DB, compares, sends to dashboard

### Scenario 3: Scan with Mismatches
1. Add a field to Prisma schema (don't migrate)
2. Run scan → Should detect mismatch
3. Check dashboard → Should show mismatch in report

### Scenario 4: Multiple Scans
1. Run scan multiple times
2. Dashboard should show multiple reports
3. Reports should be in chronological order

---

## Success Criteria

✅ Dashboard server runs without errors
✅ Landing page displays correctly
✅ Can sign up / log in
✅ Can create project
✅ CLI scan works locally
✅ CLI scan syncs to dashboard (if configured)
✅ Dashboard shows scan report
✅ Can view scan report details
✅ Mismatches display correctly

---

## Next Steps After Testing

- [ ] Add real-time updates (Supabase Realtime)
- [ ] Add scan history visualization
- [ ] Add migration generation UI
- [ ] Add "Run Scan" button in dashboard


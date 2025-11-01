# Quick Integration Test ✅

## What We Tested

### ✅ CLI Local Scan (Working!)

```bash
devsync scan --path test-prisma-project
```

**Results**:
- ✅ Code schema extracted (3 models: User, Post, Category)
- ✅ All fields detected correctly
- ✅ Works without database connection

**Output**:
```
🔍 Scanning codebase and database...
📁 Scanning codebase...
✅ Code schema extracted (3 models)

⚠️  No database connection provided
💡 Tip: Use --db flag or set in .devsync/config.json

📋 Models found in codebase:
  • User (7 fields)
  • Post (9 fields)
  • Category (4 fields)
```

---

## Next Steps for Full Integration Test

### 1. Start Dashboard Server

```bash
cd apps/dashboard
npm run dev
```

Visit: `http://localhost:3000`

### 2. Set Up Supabase (If Not Done)

1. Create `.env.local` in `apps/dashboard/`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

2. Run migrations in Supabase SQL Editor:
   - Copy `supabase/migrations/001_initial_schema.sql`
   - Run in Supabase Dashboard → SQL Editor

### 3. Create Project in Dashboard

1. Visit `http://localhost:3000`
2. Sign up / Log in
3. Create a new project
4. Copy the project ID from the URL: `/dashboard/projects/[PROJECT_ID]`

### 4. Get API Token

**Method 1: Browser Cookie (Easiest)**
1. In dashboard, open DevTools (F12)
2. Application tab → Cookies
3. Find cookie: `sb-<project-id>-auth-token`
4. Copy the token value

**Method 2: Supabase Dashboard**
1. Go to Supabase Dashboard → Authentication → Users
2. Generate API key or access token

### 5. Update CLI Config

Edit `test-prisma-project/.devsync/config.json`:

```json
{
  "version": "1.0",
  "project": {
    "name": "Test Project",
    "schemaType": "prisma",
    "id": "<PROJECT_ID_FROM_STEP_3>"
  },
  "database": {
    "connectionString": "",
    "provider": "postgresql"
  },
  "api": {
    "url": "http://localhost:3000",
    "key": "<JWT_TOKEN_FROM_STEP_4>"
  },
  "scan": {
    "watch": false,
    "autoFix": false
  }
}
```

### 6. Test Cloud Sync

```bash
cd test-prisma-project
devsync scan
```

**Expected Output**:
```
🔍 Scanning codebase and database...
📁 Scanning codebase...
✅ Code schema extracted (3 models)

⚠️  No database connection provided
[... results ...]

☁️  Syncing results to dashboard...
✅ Scan report synced to dashboard!
   Scan ID: abc123...
   View in dashboard: http://localhost:3000/dashboard/projects/...
```

### 7. View in Dashboard

1. Visit `http://localhost:3000/dashboard`
2. Click on your project
3. You should see the scan report in the list!
4. Click to view details

---

## Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| CLI Local Scan | ✅ Working | Scans Prisma schema correctly |
| CLI Database Scan | ⏳ Pending | Needs DB connection |
| CLI Cloud Sync | ⏳ Pending | Needs config setup |
| Dashboard Server | ⏳ Starting | Run `npm run dev` |
| Dashboard Auth | ⏳ Pending | Needs Supabase setup |
| Dashboard UI | ⏳ Pending | Needs server running |
| API Integration | ⏳ Pending | Needs project + token |

---

## Current Status

✅ **CLI is working!**
- Scans Prisma schemas
- Extracts models and fields
- Displays results locally

⏳ **Dashboard Setup Needed:**
- Start dashboard server
- Set up Supabase (optional for basic testing)
- Create project and get API token
- Test cloud sync

---

## Quick Commands

```bash
# Test CLI locally (no config needed)
devsync scan --path test-prisma-project

# Start dashboard
cd apps/dashboard && npm run dev

# Test with config
cd test-prisma-project && devsync scan
```

---

## Troubleshooting

### Dashboard not starting?
- Check: `npm install` in `apps/dashboard`
- Check: Node.js version (needs v18+)
- Check: Port 3000 is available

### CLI not found?
- Build CLI: `cd packages/cli && npm run build`
- Or use: `npx tsx packages/cli/src/index.ts scan`

### API errors?
- Check dashboard is running on `http://localhost:3000`
- Check API URL in config matches
- Check JWT token is valid (not expired)

---

**Status: CLI Working, Dashboard Setup Needed** ✅


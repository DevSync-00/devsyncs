# CLI → Dashboard Integration - Complete ✅

## What Was Built

Successfully connected the CLI to the dashboard API! Now scan reports can be sent from the CLI to the cloud dashboard.

## Features Implemented

### ✅ CLI Cloud Sync
- CLI can send scan reports to dashboard API
- Optional cloud sync (works 100% offline by default)
- Automatic sync when projectId, apiUrl, and apiKey are configured
- Graceful error handling (continues working locally if sync fails)

### ✅ API Authentication
- Supports both session auth (web) and API key auth (CLI)
- Uses Supabase JWT tokens for API authentication
- Secure Bearer token authentication

### ✅ Scan Report Detail Page
- Beautiful detail view for each scan report
- Shows all mismatches with severity levels
- Displays suggested fixes
- Shows code vs database values

### ✅ Enhanced Config System
- Added API settings to `.devsync/config.json`
- Supports project ID, API URL, and API key
- Can be set via command-line flags or config file

## How It Works

### CLI Flow

```
1. Developer runs: devsync scan
   ↓
2. CLI scans codebase and database
   ↓
3. CLI compares schemas (finds mismatches)
   ↓
4. CLI displays results locally
   ↓
5. (Optional) CLI sends report to dashboard API
   ↓
6. Dashboard stores report in Supabase
   ↓
7. Dashboard displays report in UI
```

### Authentication Flow

**For CLI**:
```bash
# Get JWT token from Supabase (user logs in via dashboard)
# Store in .devsync/config.json or pass via --api-key

devsync scan \
  --project-id <project-id> \
  --api-url http://localhost:3000 \
  --api-key <supabase-jwt-token>
```

**For Web**:
- Uses session cookies (automatic)
- User already logged in via dashboard

## Configuration

### Option 1: Config File (`.devsync/config.json`)

```json
{
  "version": "1.0",
  "project": {
    "name": "My Project",
    "id": "project-id-from-dashboard"
  },
  "database": {
    "connectionString": "postgresql://user:pass@localhost/db"
  },
  "api": {
    "url": "http://localhost:3000",
    "key": "supabase-jwt-token",
    "enabled": true
  }
}
```

### Option 2: Command Line Flags

```bash
devsync scan \
  --project-id <project-id> \
  --api-url http://localhost:3000 \
  --api-key <supabase-jwt-token> \
  --db postgresql://user:pass@localhost/db
```

### Option 3: Environment Variables (Future)

```bash
export DEVSYNC_API_URL=http://localhost:3000
export DEVSYNC_API_KEY=<token>
devsync scan --project-id <project-id>
```

## CLI Commands Updated

### `devsync scan`

**New Options**:
- `--project-id <id>` - Project ID from dashboard
- `--api-url <url>` - Dashboard API URL
- `--api-key <key>` - API key / JWT token
- `--sync` - Enable cloud sync (default: true if projectId is set)
- `--no-sync` - Disable cloud sync (local only)

**Example**:
```bash
# Local only (no cloud sync)
devsync scan --db postgresql://user:pass@localhost/db

# With cloud sync
devsync scan \
  --db postgresql://user:pass@localhost/db \
  --project-id abc123 \
  --api-url http://localhost:3000 \
  --api-key <jwt-token>
```

## Dashboard Features

### Scan Report List
- Shows all scan reports for a project
- Displays status (completed, pending, failed)
- Shows mismatch count
- Links to detail page

### Scan Report Detail
- Full mismatch details
- Code vs database comparison
- Suggested fixes
- Severity levels (error, warning, info)
- Beautiful visual design

## Getting JWT Token for CLI

### Method 1: From Browser (Easiest)

1. Log in to dashboard (`http://localhost:3000`)
2. Open browser DevTools (F12)
3. Go to Application/Storage → Cookies
4. Find `sb-<project>-auth-token` cookie
5. Copy the JWT token value
6. Use in CLI config or `--api-key` flag

### Method 2: From Supabase Dashboard

1. Go to Supabase Dashboard → Authentication → Users
2. Find your user
3. Generate API key or get access token

### Method 3: Programmatic (Future)

```bash
# Future: CLI login command
devsync login
# Opens browser, authenticates, saves token
```

## Testing the Integration

### 1. Set Up Dashboard

```bash
cd apps/dashboard
npm install
# Set up .env.local with Supabase credentials
npm run dev
```

### 2. Create Project in Dashboard

1. Visit `http://localhost:3000`
2. Sign up / Log in
3. Create a new project
4. Copy the project ID from URL

### 3. Get API Token

- Use browser cookie method (see above)
- Or use Supabase Dashboard

### 4. Configure CLI

```bash
# In your project directory
devsync init

# Edit .devsync/config.json:
{
  "project": {
    "id": "<project-id-from-step-2>"
  },
  "api": {
    "url": "http://localhost:3000",
    "key": "<jwt-token-from-step-3>"
  }
}
```

### 5. Test Scan with Cloud Sync

```bash
devsync scan \
  --path ./test-prisma-project \
  --db postgresql://user:pass@localhost/db
```

**Expected Output**:
```
🔍 Scanning codebase and database...

📁 Scanning codebase...
✅ Code schema extracted (3 models)

🗄️  Scanning database...
✅ Database schema extracted (3 tables)

🔬 Comparing schemas...
✅ Comparison complete

⚠️  Found 2 mismatch(es):
[... results ...]

☁️  Syncing results to dashboard...
✅ Scan report synced to dashboard!
   Scan ID: abc123...
   View in dashboard: http://localhost:3000/dashboard/projects/...
```

### 6. View in Dashboard

1. Visit `http://localhost:3000/dashboard`
2. Click on your project
3. See the scan report in the list
4. Click to view details

## API Routes

### `POST /api/scans`
Creates a new scan report

**Request**:
```json
{
  "projectId": "project-id",
  "codeSchema": { ... },
  "dbSchema": { ... },
  "mismatches": [ ... ]
}
```

**Response**:
```json
{
  "scanId": "scan-id",
  "status": "success",
  "mismatches": [ ... ],
  "createdAt": "2024-01-01T12:00:00Z"
}
```

### `GET /api/scans?projectId=xxx`
Gets scan reports for a project

**Response**:
```json
{
  "scanReports": [ ... ]
}
```

## Security

✅ **Authentication Required**
- All API routes require authentication
- Supports both session (web) and token (CLI) auth

✅ **Project Access Control**
- Users can only access their own projects
- Row Level Security (RLS) policies enforced

✅ **Secure Token Storage**
- Tokens stored in config file (not in git)
- Can use environment variables (future)

## Next Steps

- [ ] Add `devsync login` command for easier token management
- [ ] Add environment variable support
- [ ] Add real-time updates (Supabase Realtime)
- [ ] Add migration generation in dashboard
- [ ] Add scan history visualization

## Success Criteria ✅

All integration criteria met:
- ✅ CLI can send reports to dashboard
- ✅ Dashboard displays scan reports
- ✅ API supports both web and CLI authentication
- ✅ Scan report detail page works
- ✅ Configuration system in place

**CLI → Dashboard Integration Complete!** 🎉


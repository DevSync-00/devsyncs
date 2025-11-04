# 🔗 Supabase Connection String Guide

## Current Issue

```
❌ Error: Failed to scan database: getaddrinfo ENOTFOUND db.lzvaidnvedhzpaczpxlk.supabase.co
```

**Problem:** The hostname cannot be resolved (DNS lookup failed).

**Your connection string:**
```
postgresql://postgres:Habermian%40321@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres
```

---

## ✅ Solution: Get Correct Connection String

### Step 1: Go to Supabase Dashboard

1. Navigate to https://supabase.com/dashboard
2. Sign in to your account
3. Select your project

### Step 2: Get Connection String

1. Click **Settings** (gear icon in left sidebar)
2. Click **Database**
3. Scroll down to **Connection string** section
4. Click **URI** tab (not Session mode or Transaction mode)
5. **Copy the connection string**

### Step 3: Format

The connection string might look like:

**Option 1: Direct Connection**
```
postgresql://postgres.xxxxx:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

**Option 2: Connection Pooler**
```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Note:** Supabase usually provides connection strings with:
- Pooler hostname (`aws-0-us-east-1.pooler.supabase.com`)
- Different port (6543 for pooler, 5432 for direct)
- Project reference in username (`postgres.xxxxx`)

---

## 🔍 Verify Connection String

### Check 1: Hostname Resolution

**Git Bash / Linux / Mac:**
```bash
ping db.lzvaidnvedhzpaczpxlk.supabase.co
# or
nslookup db.lzvaidnvedhzpaczpxlk.supabase.co
```

**Windows PowerShell:**
```powershell
Test-Connection db.lzvaidnvedhzpaczpxlk.supabase.co
# or
Resolve-DnsName db.lzvaidnvedhzpaczpxlk.supabase.co
```

If these fail → hostname is wrong!

### Check 2: Test Connection

**Using psql (if installed):**
```bash
psql "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
```

**Using Node.js:**
```javascript
const pg = require('pg');
const client = new pg.Client('your-connection-string');
client.connect()
  .then(() => console.log('✅ Connected!'))
  .catch(e => console.error('❌', e.message));
```

---

## Common Supabase Connection String Formats

### Format 1: Direct Connection
```
postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```
- Port: `5432`
- Host: `db.xxxxx.supabase.co`

### Format 2: Connection Pooler
```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```
- Port: `6543`
- Host: `aws-0-us-east-1.pooler.supabase.com` (or similar region-based)
- Username: `postgres.xxxxx` (includes project reference)

### Format 3: Session Mode Pooler
```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true
```
- Port: `5432` with `pgbouncer=true` parameter

---

## URL Encoding Special Characters

If your password contains special characters, URL-encode them:

| Character | Encoded |
|-----------|---------|
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `%` | `%25` |
| `&` | `%26` |
| `+` | `%2B` |
| `=` | `%3D` |
| `/` | `%2F` |
| `?` | `%3F` |
| `:` | `%3A` |

**Example:**
- Password: `Habermian@321`
- Encoded: `Habermian%40321`

---

## Quick Fix Steps

1. **Go to Supabase Dashboard**
   - https://supabase.com/dashboard
   - Settings → Database

2. **Copy Connection String**
   - Click "URI" tab
   - Copy the full connection string

3. **Replace in Command**
   ```bash
   node packages/cli/dist/index.js scan \
     --path . \
     --ai-analysis \
     --openai-api-key "your-key" \
     --db "PASTE_CORRECT_CONNECTION_STRING_HERE" \
     --output .devsync/scan-results.json
   ```

---

## Troubleshooting

### Issue: "getaddrinfo ENOTFOUND"

**Cause:** Hostname cannot be resolved

**Solutions:**
1. ✅ Get correct connection string from Supabase Dashboard
2. ✅ Verify hostname format (might need pooler URL)
3. ✅ Check if project is active in Supabase

### Issue: "Connection refused"

**Cause:** Wrong port or hostname

**Solutions:**
1. ✅ Check if using pooler (port 6543) vs direct (port 5432)
2. ✅ Verify hostname is correct
3. ✅ Check firewall/network settings

### Issue: "Authentication failed"

**Cause:** Wrong password or username

**Solutions:**
1. ✅ Verify password in Supabase Dashboard
2. ✅ Check if password needs URL encoding
3. ✅ Ensure username format is correct (`postgres` or `postgres.xxxxx`)

---

## Example: Correct Command

```bash
# Get connection string from Supabase Dashboard first!
# Then use it:

node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --openai-api-key "your-key" \
  --db "postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  --output .devsync/scan-results.json
```

---

## Next Steps

1. ✅ Get correct connection string from Supabase Dashboard
2. ✅ Test it (using psql or ping)
3. ✅ Use it in the scan command
4. ✅ Scan should work!

---

**Remember:** Always get the connection string directly from Supabase Dashboard - it's the most reliable source!


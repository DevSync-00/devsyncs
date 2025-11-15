# 🔧 Connection Troubleshooting

## Current Issue

```
❌ Error: Failed to scan database: getaddrinfo ENOTFOUND db.lzvaidnvedhzpaczpxlk.supabase.co
```

**Problem:** The hostname `db.lzvaidnvedhzpaczpxlk.supabase.co` cannot be resolved by DNS.

---

## ✅ Solutions

### Solution 1: Verify Connection String in Supabase Dashboard

1. **Go to Supabase Dashboard**
   - https://supabase.com/dashboard
   - Sign in

2. **Select Your Project**
   - Make sure your project is **active** (not paused)
   - Check if project reference matches: `lzvaidnvedhzpaczpxlk`

3. **Get Connection String**
   - Click **Settings** → **Database**
   - Find **Connection string** section
   - Try **both tabs**:
     - **"URI"** tab (Direct connection)
     - **"Connection pooling"** tab (Session mode)

4. **Copy Connection String**
   - Make sure it's the full string starting with `postgresql://`
   - Verify the hostname is different from what you have

---

### Solution 2: Use Connection Pooler

Supabase often uses a **pooler** hostname instead of direct connection:

**Direct Connection (might not work):**
```
postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

**Connection Pooler (usually works):**
```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Get pooler connection string:**
- Supabase Dashboard → Settings → Database
- Click **"Connection pooling"** tab
- Click **"Session mode"**
- Copy the connection string

---

### Solution 3: Verify Project Status

**Check if project is active:**
1. Go to Supabase Dashboard
2. Check if project shows "Active" status
3. If paused, resume the project

**Check project reference:**
1. Settings → General
2. Verify **Reference ID** matches: `lzvaidnvedhzpaczpxlk`
3. If different, use the correct reference

---

## 🔍 Test Connection String

### Test 1: DNS Resolution

**Git Bash / Linux / Mac:**
```bash
nslookup db.lzvaidnvedhzpaczpxlk.supabase.co
# or
ping db.lzvaidnvedhzpaczpxlk.supabase.co
```

**Windows PowerShell:**
```powershell
Resolve-DnsName db.lzvaidnvedhzpaczpxlk.supabase.co
# or
Test-Connection db.lzvaidnvedhzpaczpxlk.supabase.co
```

**Expected:**
- ✅ Should resolve to an IP address
- ❌ If fails → hostname is wrong or project doesn't exist

### Test 2: Connection Test

**Using psql (if installed):**
```bash
psql "postgresql://postgres:HanibalMejbiri@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres"
```

**Using Node.js:**
```javascript
const pg = require('pg');
const client = new pg.Client('postgresql://postgres:HanibalMejbiri@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres');
client.connect()
  .then(() => console.log('✅ Connected!'))
  .catch(e => console.error('❌', e.message));
```

---

## 🎯 Common Connection String Formats

### Format 1: Direct Connection
```
postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```
- Port: `5432`
- Host: `db.xxxxx.supabase.co`

### Format 2: Connection Pooler (Session Mode)
```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```
- Port: `6543` (or `5432` with `?pgbouncer=true`)
- Host: `aws-0-us-east-1.pooler.supabase.com` (region-based)
- Username: `postgres.xxxxx` (includes project reference)

### Format 3: Transaction Mode Pooler
```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

---

## ✅ Quick Fix Checklist

- [ ] Go to Supabase Dashboard
- [ ] Verify project is active (not paused)
- [ ] Check project reference matches: `lzvaidnvedhzpaczpxlk`
- [ ] Get connection string from Settings → Database
- [ ] Try **Connection pooling** tab (Session mode)
- [ ] Copy the full connection string
- [ ] Test DNS resolution (nslookup/ping)
- [ ] Use the connection string in scan command

---

## 🚀 Once You Have Correct Connection String

```bash
node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --openai-api-key "your-key" \
  --db "CORRECT_CONNECTION_STRING_FROM_SUPABASE" \
  --output .devsync/scan-results.json
```

---

## 📊 Current Status

✅ **Code scanning:** Working (6 models found)  
❌ **Database connection:** Hostname not resolving  

**Next step:** Get correct connection string from Supabase Dashboard, especially try the **Connection pooling** tab!

---

## ⚠️ Important Notes

1. **Connection pooler is usually more reliable** than direct connection
2. **Project might need to be active** (not paused)
3. **Hostname format might be different** from what you expect
4. **Always copy from Supabase Dashboard** - don't construct manually

---

**The key:** Always get the connection string directly from Supabase Dashboard → Settings → Database → Connection string!


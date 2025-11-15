# ⚡ Quick Fix: Database Connection

## Good News!

✅ **DNS resolves!** - Hostname exists  
✅ **Code scanning works!** - Found 6 models  
❌ **Connection fails** - But we can fix it!

---

## ✅ Quick Fix: Use Connection Pooler

The direct connection might not work, but the **connection pooler** usually does!

### Step 1: Get Pooler Connection String

1. **Go to Supabase Dashboard**
   - https://supabase.com/dashboard
   - Select your project

2. **Get Connection String**
   - Settings → **Database**
   - Find **Connection string** section
   - Click **"Connection pooling"** tab
   - Click **"Session mode"**
   - **Copy** the connection string

### Step 2: Pooler Connection String Format

It will look like:
```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Differences from direct:**
- Hostname: `aws-0-us-east-1.pooler.supabase.com` (not `db.xxxxx.supabase.co`)
- Port: `6543` (not `5432`)
- Username: `postgres.xxxxx` (includes project reference)

### Step 3: Use in Command

```bash
node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --openai-api-key "your-key" \
  --db "PASTE_POOLER_CONNECTION_STRING_HERE" \
  --output .devsync/scan-results.json
```

---

## Why Connection Pooler?

**Benefits:**
- ✅ More reliable connections
- ✅ Better performance
- ✅ Usually works when direct connection doesn't
- ✅ Recommended by Supabase for applications

**When to use:**
- ✅ **Always** for applications (like DevSync)
- ✅ When direct connection fails
- ✅ For better connection management

---

## Alternative: Test Direct Connection

If you want to test the direct connection first:

### Test 1: Using psql

```bash
psql "postgresql://postgres:HanibalMejbiri@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres"
```

### Test 2: Check Project Status

1. Go to Supabase Dashboard
2. Check if project shows **"Active"** status
3. If paused, **resume** it
4. Then try connection again

---

## Summary

**Current Status:**
- ✅ DNS resolves (hostname exists)
- ✅ Code scanning works
- ❌ Connection fails (might be IPv6/network issue)

**Solution:**
- ✅ **Use connection pooler** (recommended)
- ✅ Get connection string from Supabase Dashboard
- ✅ Try "Connection pooling" tab → "Session mode"

---

## Quick Command (Once You Have Pooler String)

```bash
node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --openai-api-key "your-key" \
  --db "postgresql://postgres.xxxxx:HanibalMejbiri@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  --output .devsync/scan-results.json
```

---

**Next Step:** Get the **connection pooler** string from Supabase Dashboard and use that! 🚀


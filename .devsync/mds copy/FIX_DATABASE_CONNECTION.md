# 🔧 Fix Database Connection Issue

## The Problem

```
❌ Error: Failed to scan database: getaddrinfo ENOTFOUND db.lzvaidnvedhzpaczpxlk.supabase.co
```

**Cause:** The connection string format is incorrect. The password contains `@` symbol which breaks URL parsing.

Your connection string:
```
postgresql://postgres:Habermian@321@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres
                                                  ↑
                                    This @ breaks the URL parsing!
```

---

## ✅ Solutions

### Option 1: Get Correct Connection String from Supabase (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Get Connection String**
   - Go to **Settings** → **Database**
   - Find **Connection string** section
   - Click **URI** tab
   - Copy the connection string (it will have URL-encoded password)

3. **Use it in command:**
   ```bash
   node packages/cli/dist/index.js scan \
     --path . \
     --ai-analysis \
     --openai-api-key "your-key" \
     --db "postgresql://postgres:[ENCODED_PASSWORD]@db.xxxxx.supabase.co:5432/postgres" \
     --output .devsync/scan-results.json
   ```

### Option 2: URL-Encode the Password

If your password is `Habermian@321`, you need to encode the `@` as `%40`:

**Before:**
```
postgresql://postgres:Habermian@321@db.xxxxx.supabase.co:5432/postgres
                        ^^^^^^^^^^^^^ Password with @
```

**After:**
```
postgresql://postgres:Habermian%40321@db.xxxxx.supabase.co:5432/postgres
                        ^^^^^^^^^^^^^^^ URL-encoded password
```

**Full command:**
```bash
node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --openai-api-key "your-key" \
  --db "postgresql://postgres:Habermian%40321@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres" \
  --output .devsync/scan-results.json
```

### Option 3: Use Connection Pooling (Alternative)

Supabase also provides a pooling connection string:

```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

Check your Supabase Dashboard → Settings → Database → **Connection pooling** tab.

---

## URL Encoding Reference

| Character | Encoded |
|-----------|---------|
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `%` | `%25` |
| `&` | `%26` |
| `+` | `%2B` |
| `=` | `%3D` |

---

## Test Connection

You can test if the connection string works:

```bash
# Using psql (if installed)
psql "postgresql://postgres:Habermian%40321@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres"

# Or test with node
node -e "const pg = require('pg'); const client = new pg.Client('postgresql://postgres:Habermian%40321@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres'); client.connect().then(() => console.log('✅ Connected!')).catch(e => console.error('❌', e.message));"
```

---

## Current Status

✅ **Code scanning worked!** - Pattern matching extracted 6 models
❌ **Database connection failed** - Need to fix connection string

Once you fix the connection string, the scan will compare:
- ✅ Code schema (6 models found)
- ✅ Database schema (once connection works)

---

## Quick Fix Command

```bash
# URL-encode the password (@ becomes %40)
node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --openai-api-key "your-key" \
  --db "postgresql://postgres:Habermian%40321@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres" \
  --output .devsync/scan-results.json
```

---

## About AI Analysis Fallback

The message "⚠️ AI analysis failed, using pattern matching fallback" means:
- ✅ AI API call failed (might be rate limit, network issue, or API error)
- ✅ Pattern matching fallback worked and extracted 6 models
- ✅ Code scanning is successful!

This is actually working - the fallback detected tables from your code patterns (like `.from('projects')`, `.from('scan_reports')`, etc.).

To fix AI analysis, check:
- OpenAI API key is valid
- You have API credits
- Internet connection is working

But **pattern matching is working fine** as a fallback!


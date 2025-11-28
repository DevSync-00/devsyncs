# 🔧 Environment Variables Setup

## Quick Setup

1. **Copy the example file:**
   ```bash
   cd apps/dashboard
   cp .env.local.example .env.local
   ```

2. **Fill in your Supabase credentials:**
   - Get them from [Supabase Dashboard](https://supabase.com/dashboard)
   - Go to **Settings** → **API**
   - Copy **Project URL** and **anon public** key

3. **Optional: Add OpenAI API key** (if using AI features)

---

## Required Variables

### `NEXT_PUBLIC_SUPABASE_URL`

**What it is:**
- Your Supabase project URL

**Where to find it:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy **Project URL**

**Format:**
```
https://xxxxx.supabase.co
```

**Example:**
```
NEXT_PUBLIC_SUPABASE_URL=https://lzvaidnvedhzpaczpxlk.supabase.co
```

---

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**What it is:**
- Your Supabase anon (public) key
- Safe to expose in client-side code
- Used for authentication and database queries

**Where to find it:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy **anon public** key

**Format:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dmFpZG52ZWRoenBhY3pweGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4NzY1MjAsImV4cCI6MjAyNTQ1MjUyMH0...
```

**Example:**
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### `NEXT_PUBLIC_ANALYZER_URL`

**What it is:**
- The base URL of the DevSync analyzer service
- Used for CLI device authorization and VS Code extension logins

**Where to find it:**
1. If running locally, this is typically `http://localhost:4000`
2. In production, use the public URL where `apps/analyzer` is deployed

**Format:**
```
http://localhost:4000
```

**Example:**
```
NEXT_PUBLIC_ANALYZER_URL=http://localhost:4000
```

---

## Optional Variables

### `OPENAI_API_KEY`

**What it is:**
- OpenAI API key for AI features
- Only needed if you want to use AI explanations, risk assessments, etc.

**Where to find it:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create account
3. Create new API key

**Format:**
```
sk-...
```

**Example:**
```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**What it enables:**
- ✅ AI-powered migration explanations
- ✅ Risk assessments
- ✅ Natural language queries about migrations
- ⚠️ Without it, AI features won't work (but rest of app works fine)

---

### `DEEPSEEK_API_KEY`

**What it is:**
- DeepSeek API key for AI features
- Alternative to OpenAI for AI-powered features
- Often more cost-effective than OpenAI

**Where to find it:**
1. Go to [DeepSeek Platform](https://platform.deepseek.com)
2. Sign in or create account
3. Navigate to API Keys section
4. Create new API key

**Format:**
```
sk-...
```

**Example:**
```
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**What it enables:**
- ✅ AI-powered migration explanations
- ✅ Risk assessments
- ✅ Natural language queries about migrations
- ✅ Same features as OpenAI, often at lower cost
- ⚠️ Without it (and OpenAI), AI features won't work

---

### `DEEPSEEK_API_URL`

**What it is:**
- DeepSeek API base URL
- Optional - defaults to official DeepSeek API endpoint

**Format:**
```
https://api.deepseek.com/v1
```

**Example:**
```
DEEPSEEK_API_URL=https://api.deepseek.com/v1
```

**Default:**
If not set, defaults to `https://api.deepseek.com/v1`

---

### `AI_PROVIDER`

**What it is:**
- Global AI provider preference
- Determines which AI provider to use when both are configured

**Options:**
- `openai` - Use OpenAI (default)
- `deepseek` - Use DeepSeek

**Example:**
```
AI_PROVIDER=deepseek
```

**Note:**
- Individual API routes can override this via request body
- If only one provider is configured, that provider will be used regardless of this setting

---

## Complete Example

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://lzvaidnvedhzpaczpxlk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dmFpZG52ZWRoenBhY3pweGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4NzY1MjAsImV4cCI6MjAyNTQ1MjUyMH0.xxxxx
NEXT_PUBLIC_ANALYZER_URL=http://localhost:4000

# Optional (for AI features)
# Use either OpenAI or DeepSeek (or both)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AI_PROVIDER=deepseek  # Optional: prefer DeepSeek when both are configured
```

---

## Important Notes

### ⚠️ Security

1. **Never commit `.env.local`** to version control
   - It's already in `.gitignore`
   - Contains sensitive credentials

2. **`NEXT_PUBLIC_*` variables are exposed to browser**
   - These are safe for client-side code
   - Used in React components

3. **Server-side only variables** (without `NEXT_PUBLIC_`)
   - `OPENAI_API_KEY` is server-side only (safe)
   - Never expose sensitive keys in client

### 📝 File Location

- **File**: `apps/dashboard/.env.local`
- **Example**: `apps/dashboard/.env.local.example`
- **Git**: `.env.local` is ignored (should NOT be committed)

---

## Verification

### Check if variables are loaded:

1. **Start dev server:**
   ```bash
   cd apps/dashboard
   npm run dev
   ```

2. **Check console:**
   - No errors = variables loaded correctly
   - If you see "Missing Supabase credentials" = check `.env.local`

3. **Test authentication:**
   - Go to http://localhost:3000
   - Try signing up/logging in
   - If it works = Supabase credentials are correct

---

## Troubleshooting

### Issue: "Missing Supabase credentials"

**Problem:** Variables not loaded

**Solutions:**
1. Check file is named exactly `.env.local` (not `.env` or `.env.example`)
2. Check file is in `apps/dashboard/` directory
3. Restart dev server after creating/editing `.env.local`
4. Check for typos in variable names

### Issue: "Invalid Supabase URL"

**Problem:** Wrong Supabase URL format

**Solutions:**
1. Ensure URL starts with `https://`
2. Ensure URL ends with `.supabase.co`
3. Check for extra spaces or quotes

### Issue: "Authentication failed"

**Problem:** Wrong anon key

**Solutions:**
1. Verify you copied the **anon public** key (not service_role key)
2. Check for extra spaces or quotes
3. Ensure key is complete (they're very long)

---

## Production Deployment

For production, set environment variables in your hosting platform:

### Vercel
- Go to **Project Settings** → **Environment Variables**
- Add each variable

### Other Platforms
- Set environment variables in your platform's settings
- Never commit `.env.local` to production

---

## Quick Reference

| Variable | Required | Purpose | Where to Get |
|----------|----------|---------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Supabase anon key | Supabase Dashboard → Settings → API |
| `OPENAI_API_KEY` | ❌ Optional | AI features | OpenAI Platform → API Keys |

---

**Need help?** Check:
- [Dashboard README](../README.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)


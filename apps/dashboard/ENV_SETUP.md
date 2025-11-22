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

## Complete Example

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://lzvaidnvedhzpaczpxlk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dmFpZG52ZWRoenBhY3pweGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4NzY1MjAsImV4cCI6MjAyNTQ1MjUyMH0.xxxxx

# Optional (for AI features)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
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


# 🔐 Complete Environment Variables Reference

This document lists **all** environment variables needed for DevSync.AI deployment.

---

## 📋 Quick Summary

| Variable | Required | Type | Where Used |
|----------|----------|------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ **YES** | Public | Client & Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ **YES** | Public | Client & Server |
| `NEXT_PUBLIC_ANALYZER_URL` | ✅ **YES** | Public | Client |
| `OPENAI_API_KEY` | ❌ Optional | Secret | Server (AI features) |
| `OPENAI_API_URL` | ❌ Optional | Secret | Server (AI features) |
| `DEEPSEEK_API_KEY` | ❌ Optional | Secret | Server (AI features) |
| `DEEPSEEK_API_URL` | ❌ Optional | Secret | Server (AI features) |
| `AI_PROVIDER` | ❌ Optional | Public | Server (AI features) |
| `NODE_ENV` | ❌ Optional | Public | Server (auto-set by Vercel) |
| `NEXT_PUBLIC_SENTRY_DSN` | ❌ Optional | Public | Client & Server (Error tracking) |
| `SENTRY_DSN` | ❌ Optional | Secret | Server (Error tracking) |
| `PROJECTS_CLONE_DIR` | ❌ Optional | Secret | Server (Project cloning) |

---

## ✅ Required Environment Variables

### 1. `NEXT_PUBLIC_SUPABASE_URL`

**Required**: ✅ **YES**  
**Type**: Public (exposed to browser)  
**Purpose**: Supabase project URL for database and authentication

**Where to get it:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy **Project URL**

**Format:**
```
https://xxxxx.supabase.co
```

**Example:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://lzvaidnvedhzpaczpxlk.supabase.co
```

**Used in:**
- `apps/dashboard/lib/supabase/client.ts`
- `apps/dashboard/lib/supabase/server.ts`

---

### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Required**: ✅ **YES**  
**Type**: Public (exposed to browser)  
**Purpose**: Supabase anonymous/public key for authentication and database queries

**Where to get it:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy **anon public** key (NOT the service_role key)

**Format:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dmFpZG52ZWRoenBhY3pweGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4NzY1MjAsImV4cCI6MjAyNTQ1MjUyMH0...
```

**Example:**
```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dmFpZG52ZWRoenBhY3pweGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4NzY1MjAsImV4cCI6MjAyNTQ1MjUyMH0.xxxxx
```

**Used in:**
- `apps/dashboard/lib/supabase/client.ts`
- `apps/dashboard/lib/supabase/server.ts`

---

### 3. `NEXT_PUBLIC_ANALYZER_URL`

**Required**: ✅ **YES**  
**Type**: Public (exposed to browser)  
**Purpose**: Base URL of the DevSync analyzer service (for CLI device authorization and VS Code extension)

**Where to get it:**
- **Local development**: `http://localhost:4000`
- **Production**: URL where `apps/analyzer` is deployed
  - If deployed separately: `https://your-analyzer.vercel.app`
  - If using same domain: `https://api.yourdomain.com`

**Format:**
```
http://localhost:4000  (local)
https://your-analyzer-url.com  (production)
```

**Example:**
```env
# Local development
NEXT_PUBLIC_ANALYZER_URL=http://localhost:4000

# Production
NEXT_PUBLIC_ANALYZER_URL=https://analyzer.devsync.ai
```

**Used in:**
- `apps/dashboard/components/device/DeviceAuthCard.tsx`

**Note**: If not set, the app will use a default fallback URL.

---

## 🔮 Optional: AI Features

These variables are only needed if you want to use AI-powered features (migration explanations, risk assessments, etc.).

### 4. `OPENAI_API_KEY`

**Required**: ❌ Optional  
**Type**: Secret (server-side only)  
**Purpose**: OpenAI API key for AI features

**Where to get it:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create account
3. Create new API key

**Format:**
```
sk-proj-...
```

**Example:**
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Used in:**
- `apps/dashboard/app/api/ai/explain/route.ts`
- `apps/dashboard/app/api/ai/query/route.ts`

**What it enables:**
- ✅ AI-powered migration explanations
- ✅ Risk assessments
- ✅ Natural language queries about migrations

**Note**: Without this (and without `DEEPSEEK_API_KEY`), AI features won't work, but the rest of the app works fine.

---

### 5. `OPENAI_API_URL`

**Required**: ❌ Optional  
**Type**: Secret (server-side only)  
**Purpose**: Custom OpenAI API endpoint URL

**Default**: `https://api.openai.com/v1` (if not set)

**Format:**
```
https://api.openai.com/v1
```

**Example:**
```env
OPENAI_API_URL=https://api.openai.com/v1
```

**Used in:**
- `apps/dashboard/app/api/ai/explain/route.ts`
- `apps/dashboard/app/api/ai/query/route.ts`

**Note**: Usually not needed unless using a custom OpenAI-compatible endpoint.

---

### 6. `DEEPSEEK_API_KEY`

**Required**: ❌ Optional  
**Type**: Secret (server-side only)  
**Purpose**: DeepSeek API key (alternative to OpenAI, often more cost-effective)

**Where to get it:**
1. Go to [DeepSeek Platform](https://platform.deepseek.com)
2. Sign in or create account
3. Navigate to API Keys section
4. Create new API key

**Format:**
```
sk-...
```

**Example:**
```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Used in:**
- `apps/dashboard/app/api/ai/explain/route.ts`
- `apps/dashboard/app/api/ai/query/route.ts`

**What it enables:**
- ✅ Same AI features as OpenAI
- ✅ Often more cost-effective than OpenAI

**Note**: You can use either OpenAI or DeepSeek (or both). If both are configured, use `AI_PROVIDER` to choose.

---

### 7. `DEEPSEEK_API_URL`

**Required**: ❌ Optional  
**Type**: Secret (server-side only)  
**Purpose**: Custom DeepSeek API endpoint URL

**Default**: `https://api.deepseek.com/v1` (if not set)

**Format:**
```
https://api.deepseek.com/v1
```

**Example:**
```env
DEEPSEEK_API_URL=https://api.deepseek.com/v1
```

**Used in:**
- `apps/dashboard/app/api/ai/explain/route.ts`
- `apps/dashboard/app/api/ai/query/route.ts`

**Note**: Usually not needed unless using a custom DeepSeek-compatible endpoint.

---

### 8. `AI_PROVIDER`

**Required**: ❌ Optional  
**Type**: Public (server-side)  
**Purpose**: Global AI provider preference (when both OpenAI and DeepSeek are configured)

**Default**: `openai` (if not set)

**Options:**
- `openai` - Use OpenAI (default)
- `deepseek` - Use DeepSeek

**Example:**
```env
AI_PROVIDER=deepseek
```

**Used in:**
- `apps/dashboard/app/api/ai/explain/route.ts`
- `apps/dashboard/app/api/ai/query/route.ts`

**Note**: 
- Individual API routes can override this via request body
- If only one provider is configured, that provider will be used regardless of this setting

---

## 🔧 Optional: Other Variables

### 9. `NODE_ENV`

**Required**: ❌ Optional  
**Type**: Public  
**Purpose**: Node.js environment (development, production, etc.)

**Default**: Automatically set by Vercel to `production` in production builds

**Options:**
- `development` - Development mode
- `production` - Production mode
- `test` - Test mode

**Example:**
```env
NODE_ENV=production
```

**Used in:**
- `apps/dashboard/lib/logger.ts` (sets log level)
- `apps/dashboard/app/api/migrations/[id]/execute/route.ts` (error details)
- `apps/dashboard/lib/api-validation.ts` (error details)
- `apps/dashboard/components/ErrorBoundary.tsx` (error stack)

**Note**: Vercel automatically sets this, so you usually don't need to set it manually.

---

### 10. `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`

**Required**: ❌ Optional  
**Type**: Public (`NEXT_PUBLIC_SENTRY_DSN`) or Secret (`SENTRY_DSN`)  
**Purpose**: Sentry DSN for error tracking and monitoring

**Where to get it:**
1. Go to [Sentry](https://sentry.io)
2. Create a project
3. Get the DSN from project settings

**Format:**
```
https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

**Example:**
```env
NEXT_PUBLIC_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/123456
# OR
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/123456
```

**Used in:**
- `apps/dashboard/instrumentation.ts`

**Note**: Only needed if you want error tracking. The app works fine without it.

---

### 11. `PROJECTS_CLONE_DIR`

**Required**: ❌ Optional  
**Type**: Secret (server-side only)  
**Purpose**: Directory path for cloning projects during scanning

**Default**: `/tmp/devsync-projects/${projectId}` (if not set)

**Format:**
```
/tmp/devsync-projects
```

**Example:**
```env
PROJECTS_CLONE_DIR=/tmp/devsync-projects
```

**Used in:**
- `apps/dashboard/app/api/projects/route.ts`

**Note**: Usually not needed unless you want to customize the clone directory. Vercel provides `/tmp` directory automatically.

---

## 📝 Complete Example `.env.local` File

Create this file at `apps/dashboard/.env.local`:

```env
# ============================================
# REQUIRED VARIABLES
# ============================================

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://lzvaidnvedhzpaczpxlk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dmFpZG52ZWRoenBhY3pweGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4NzY1MjAsImV4cCI6MjAyNTQ1MjUyMH0.xxxxx

# Analyzer Service URL
NEXT_PUBLIC_ANALYZER_URL=https://analyzer.devsync.ai

# ============================================
# OPTIONAL: AI FEATURES
# ============================================

# OpenAI (choose one or both)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_URL=https://api.openai.com/v1

# DeepSeek (alternative to OpenAI, often cheaper)
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_API_URL=https://api.deepseek.com/v1

# AI Provider Preference (when both are configured)
AI_PROVIDER=deepseek  # Options: 'openai' or 'deepseek'

# ============================================
# OPTIONAL: OTHER
# ============================================

# Node Environment (usually auto-set by Vercel)
NODE_ENV=production

# Sentry Error Tracking (optional)
NEXT_PUBLIC_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/123456

# Project Clone Directory (optional, has default)
PROJECTS_CLONE_DIR=/tmp/devsync-projects
```

---

## 🚀 For Vercel Deployment

When deploying to Vercel, add these environment variables in:

**Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

### Minimum Required (3 variables):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_ANALYZER_URL
```

### Recommended (with AI features):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_ANALYZER_URL
OPENAI_API_KEY (or DEEPSEEK_API_KEY)
AI_PROVIDER (if using both)
```

### Full Setup (all features):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_ANALYZER_URL
OPENAI_API_KEY
DEEPSEEK_API_KEY
AI_PROVIDER
NEXT_PUBLIC_SENTRY_DSN
```

---

## ⚠️ Important Notes

### Security

1. **Never commit `.env.local`** to Git
   - It's already in `.gitignore`
   - Contains sensitive credentials

2. **`NEXT_PUBLIC_*` variables are exposed to browser**
   - These are safe for client-side code
   - Used in React components
   - Don't put secrets here!

3. **Server-side only variables** (without `NEXT_PUBLIC_`)
   - `OPENAI_API_KEY`, `DEEPSEEK_API_KEY` are server-side only (safe)
   - Never expose sensitive keys in client

### Variable Naming

- **`NEXT_PUBLIC_*`**: Exposed to browser (client-side accessible)
- **No prefix**: Server-side only (not exposed to browser)

### Environment-Specific Values

In Vercel, you can set different values for:
- **Production**: Live production environment
- **Preview**: Preview deployments (pull requests, branches)
- **Development**: Local development (usually not used)

**Recommendation**: Set all required variables for all three environments.

---

## ✅ Verification Checklist

After setting up environment variables:

- [ ] All required variables are set
- [ ] Variable names are correct (case-sensitive!)
- [ ] No extra spaces or quotes in values
- [ ] Supabase URL starts with `https://`
- [ ] Supabase URL ends with `.supabase.co`
- [ ] API keys are complete (they're very long)
- [ ] Tested locally with `npm run dev`
- [ ] Added to Vercel for all environments (Production, Preview, Development)

---

## 🆘 Troubleshooting

### "Missing Supabase credentials"
- Check variable names: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Verify variables are in correct environment (Production/Preview/Development)
- Check for typos (case-sensitive!)

### "Invalid Supabase URL"
- Ensure URL starts with `https://`
- Ensure URL ends with `.supabase.co`
- Check for extra spaces or quotes

### "Authentication failed"
- Verify you copied the **anon public** key (not service_role key)
- Check for extra spaces or quotes
- Ensure key is complete (they're very long)

### AI features not working
- Check `OPENAI_API_KEY` or `DEEPSEEK_API_KEY` is set
- Verify API key is valid and has credits
- Check `AI_PROVIDER` if both are configured

---

## 📚 Related Documentation

- **Deployment Guide**: [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)
- **Environment Setup**: [apps/dashboard/ENV_SETUP.md](./apps/dashboard/ENV_SETUP.md)
- **Quick Start**: [VERCEL_QUICK_START.md](./VERCEL_QUICK_START.md)

---

**Last Updated**: 2024  
**Project**: DevSync.AI


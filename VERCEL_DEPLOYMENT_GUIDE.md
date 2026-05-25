# 🚀 Complete Vercel Deployment Guide for Dev-Sync.dev

This guide provides detailed step-by-step instructions for deploying your Dev-Sync.dev project to Vercel.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Step 1: Prepare Your Repository](#step-1-prepare-your-repository)
4. [Step 2: Set Up Supabase](#step-2-set-up-supabase)
5. [Step 3: Create Vercel Account & Project](#step-3-create-vercel-account--project)
6. [Step 4: Configure Build Settings](#step-4-configure-build-settings)
7. [Step 5: Set Environment Variables](#step-5-set-environment-variables)
8. [Step 6: Deploy](#step-6-deploy)
9. [Step 7: Post-Deployment Verification](#step-7-post-deployment-verification)
10. [Step 8: Configure Custom Domain (Optional)](#step-8-configure-custom-domain-optional)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- ✅ **GitHub Account** - Your code must be in a GitHub repository
- ✅ **Vercel Account** - Sign up at [vercel.com](https://vercel.com) (free tier is sufficient)
- ✅ **Supabase Account** - Sign up at [supabase.com](https://supabase.com) (free tier is sufficient)
- ✅ **Node.js 18+** installed locally (for testing builds)
- ✅ **Git** installed and configured

---

## Pre-Deployment Checklist

### ✅ Code Preparation

- [ ] All code is committed and pushed to GitHub
- [ ] No sensitive data in code (API keys, passwords, etc.)
- [ ] `.env.local` is in `.gitignore` (should already be there)
- [ ] Project builds successfully locally
- [ ] All tests pass (if you have tests)

### ✅ Database Setup

- [ ] Supabase project created
- [ ] Database migrations applied (if any)
- [ ] Supabase API keys ready

### ✅ Environment Variables

- [ ] List of all required environment variables prepared
- [ ] Supabase credentials ready
- [ ] OpenAI/DeepSeek API keys ready (if using AI features)

---

## Step 1: Prepare Your Repository

### 1.1 Verify Your Project Structure

Your project should have this structure:
```
devsyncs/
├── apps/
│   └── dashboard/          # ← This is what we'll deploy
│       ├── app/
│       ├── components/
│       ├── lib/
│       ├── package.json
│       ├── next.config.js
│       └── ...
├── packages/
└── ...
```

### 1.2 Test Local Build

Before deploying, test that your project builds successfully:

```bash
# Navigate to dashboard directory
cd apps/dashboard

# Install dependencies (if not already done)
npm install

# Test production build
npm run build

# If build succeeds, you're ready to deploy!
```

**Expected output:**
- ✅ Build completes without errors
- ✅ `.next` directory is created
- ✅ No TypeScript errors
- ✅ No missing dependencies

### 1.3 Push to GitHub

Ensure all your code is committed and pushed:

```bash
# From project root
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

---

## Step 2: Set Up Supabase

### 2.1 Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Project Name**: `devsync` (or your preferred name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine for MVP

4. Click **"Create new project"**
5. Wait 2-3 minutes for project to be created

### 2.2 Get Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. You'll need these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (keep this secret!)

3. **Copy these values** - you'll need them in Step 5

### 2.3 Set Up Database Schema (if needed)

If you have database migrations or schema files:

1. Go to **SQL Editor** in Supabase dashboard
2. Run your migration scripts
3. Or use Supabase CLI:
   ```bash
   supabase db push
   ```

### 2.4 Configure Authentication

1. Go to **Authentication** → **Providers** in Supabase
2. Enable **Email** provider (default, usually enabled)
3. Configure any other providers you need (Google, GitHub, etc.)

---

## Step 3: Create Vercel Account & Project

### 3.1 Sign Up for Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (recommended - easier integration)
4. Authorize Vercel to access your GitHub account

### 3.2 Import Your Repository

1. After signing in, you'll see the Vercel dashboard
2. Click **"Add New..."** → **"Project"**
3. You'll see a list of your GitHub repositories
4. **Find and click on your `devsyncs` repository**
5. Click **"Import"**

---

## Step 4: Configure Build Settings

### 4.1 Configure Project Settings

After importing, you'll see the **"Configure Project"** screen:

#### **Framework Preset**
- Select: **"Next.js"** (should auto-detect)

#### **Root Directory**
- ⚠️ **IMPORTANT**: Click **"Edit"** next to Root Directory
- Change from `/` to: **`apps/dashboard`**
- This tells Vercel where your Next.js app is located

#### **Build Command**
- Should auto-detect: `npm run build`
- If not, enter: `npm run build`

#### **Output Directory**
- Should auto-detect: `.next`
- If not, enter: `.next`

#### **Install Command**
- Should auto-detect: `npm install`
- If not, enter: `npm install`

#### **Node.js Version**
- Select: **18.x** or **20.x** (recommended)

### 4.2 Advanced Settings (Optional)

Click **"Show Advanced Options"** if you need:

- **Environment Variables**: We'll add these in the next step
- **Build and Development Settings**: Usually fine as default
- **Ignore Build Step**: Leave empty (unless you have a specific reason)

---

## Step 5: Set Environment Variables

### 5.1 Add Environment Variables in Vercel

**Before clicking "Deploy"**, add your environment variables:

1. In the **"Environment Variables"** section, click **"Add"**
2. Add each variable one by one:

#### **Required Variables:**

**1. `NEXT_PUBLIC_SUPABASE_URL`**
- **Value**: Your Supabase project URL (from Step 2.2)
- **Example**: `https://lzvaidnvedhzpaczpxlk.supabase.co`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

**2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`**
- **Value**: Your Supabase anon public key (from Step 2.2)
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

**3. `NEXT_PUBLIC_ANALYZER_URL`** (if using analyzer service)
- **Value**: URL where your analyzer service is deployed
- **Example**: `https://your-analyzer.vercel.app` or `https://analyzer.yourdomain.com`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development
- **Note**: If analyzer is not deployed yet, use a placeholder and update later

#### **Optional Variables (for AI features):**

**4. `OPENAI_API_KEY`** (optional)
- **Value**: Your OpenAI API key
- **Format**: `sk-proj-...`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development
- **Note**: Only needed if using OpenAI for AI features

**5. `DEEPSEEK_API_KEY`** (optional)
- **Value**: Your DeepSeek API key
- **Format**: `sk-...`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development
- **Note**: Alternative to OpenAI, often more cost-effective

**6. `AI_PROVIDER`** (optional)
- **Value**: `openai` or `deepseek`
- **Default**: `openai`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

**7. `NODE_ENV`** (optional)
- **Value**: `production`
- **Environments**: ✅ Production only
- **Note**: Vercel usually sets this automatically, but you can set it explicitly

### 5.2 Environment Variable Tips

- ✅ **Add to all environments** (Production, Preview, Development) unless specified
- ✅ **Double-check for typos** - one wrong character breaks everything
- ✅ **No quotes needed** - Vercel handles values as-is
- ✅ **Keep secrets secret** - never commit these to Git

### 5.3 Verify Variables

After adding all variables, you should see:
```
Environment Variables (7)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_ANALYZER_URL
OPENAI_API_KEY (optional)
DEEPSEEK_API_KEY (optional)
AI_PROVIDER (optional)
NODE_ENV (optional)
```

---

## Step 6: Deploy

### 6.1 Start Deployment

1. **Review all settings** one more time:
   - ✅ Root Directory: `apps/dashboard`
   - ✅ Framework: Next.js
   - ✅ Build Command: `npm run build`
   - ✅ All environment variables added

2. Click **"Deploy"** button

### 6.2 Monitor Build Process

You'll see the build log in real-time:

1. **Installing dependencies** - `npm install`
2. **Building** - `npm run build`
3. **Deploying** - Uploading to Vercel Edge Network

**Expected build time**: 2-5 minutes

### 6.3 Build Success Indicators

✅ **Success looks like:**
```
✓ Build completed
✓ Deployed to production
✓ Ready in 2m 34s
```

✅ **You'll get a deployment URL:**
- Example: `https://devsyncs-abc123.vercel.app`

### 6.4 If Build Fails

See [Troubleshooting](#troubleshooting) section below.

---

## Step 7: Post-Deployment Verification

### 7.1 Basic Checks

1. **Visit your deployment URL**
   - Should load without errors
   - No blank page
   - No console errors (check browser DevTools)

2. **Test Authentication**
   - Try signing up with a new account
   - Try logging in
   - Should redirect properly

3. **Test Core Features**
   - [ ] Create a project
   - [ ] Run a scan
   - [ ] View scan results
   - [ ] Generate migration
   - [ ] View migration history

### 7.2 Security Checks

1. **Check HTTPS**
   - URL should start with `https://`
   - Browser should show lock icon

2. **Check Security Headers**
   - Open browser DevTools → Network tab
   - Reload page
   - Check response headers for:
     - `X-Frame-Options`
     - `X-Content-Type-Options`
     - `Strict-Transport-Security`

### 7.3 Performance Checks

1. **Page Load Time**
   - Should be < 3 seconds
   - Check in browser DevTools → Network tab

2. **API Response Times**
   - Should be < 500ms
   - Check in browser DevTools → Network tab

### 7.4 Database Connection

1. **Verify Supabase Connection**
   - Try creating a project in the dashboard
   - Should save to database
   - Check Supabase dashboard → Table Editor to verify data

---

## Step 8: Configure Custom Domain (Optional)

### 8.1 Add Custom Domain

1. In Vercel dashboard, go to your project
2. Click **"Settings"** → **"Domains"**
3. Enter your domain: `Dev-Sync.dev` (or your domain)
4. Click **"Add"**

### 8.2 Configure DNS

Vercel will show you DNS records to add:

1. **A Record** or **CNAME Record**
   - Copy the value Vercel provides
   - Add it to your domain's DNS settings
   - Wait for DNS propagation (5 minutes to 48 hours)

2. **Verify Domain**
   - Vercel will automatically verify when DNS propagates
   - You'll get an email when it's ready

### 8.3 SSL Certificate

- ✅ **Automatic** - Vercel provides free SSL certificates
- ✅ **Auto-renewal** - Certificates renew automatically
- ✅ **No configuration needed**

---

## Troubleshooting

### ❌ Build Fails: "Cannot find module"

**Problem**: Missing dependencies

**Solution**:
1. Check `package.json` has all dependencies
2. Ensure `node_modules` is not in `.gitignore` incorrectly
3. Try adding missing packages:
   ```bash
   cd apps/dashboard
   npm install <missing-package>
   git add package.json package-lock.json
   git commit -m "Add missing dependency"
   git push
   ```

### ❌ Build Fails: "TypeScript errors"

**Problem**: TypeScript compilation errors

**Solution**:
1. Fix TypeScript errors locally first:
   ```bash
   cd apps/dashboard
   npm run build
   ```
2. Fix all errors shown
3. Commit and push fixes

### ❌ Build Fails: "Environment variable not found"

**Problem**: Missing environment variables

**Solution**:
1. Go to Vercel dashboard → Project → Settings → Environment Variables
2. Verify all required variables are added
3. Check variable names match exactly (case-sensitive)
4. Re-deploy after adding variables

### ❌ App loads but shows "Missing Supabase credentials"

**Problem**: Environment variables not loaded

**Solution**:
1. Check environment variables in Vercel dashboard
2. Verify variable names:
   - `NEXT_PUBLIC_SUPABASE_URL` (not `SUPABASE_URL`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not `SUPABASE_ANON_KEY`)
3. Ensure variables are added to **Production** environment
4. Redeploy after fixing

### ❌ Authentication doesn't work

**Problem**: Supabase configuration issue

**Solution**:
1. Verify Supabase URL and keys are correct
2. Check Supabase dashboard → Authentication → Settings
3. Ensure email provider is enabled
4. Check Supabase project is active (not paused)

### ❌ Database connection fails

**Problem**: Database not accessible or RLS issues

**Solution**:
1. Check Supabase project is active
2. Verify database migrations are applied
3. Check Row Level Security (RLS) policies in Supabase
4. Test connection in Supabase dashboard → SQL Editor

### ❌ Slow page loads

**Problem**: Performance issues

**Solution**:
1. Check Vercel Analytics (if enabled)
2. Optimize images and assets
3. Check database query performance
4. Enable Vercel Edge Caching

### ❌ Preview deployments fail

**Problem**: Preview environment issues

**Solution**:
1. Ensure environment variables are added to **Preview** environment
2. Check branch name doesn't have special characters
3. Verify build settings work for all branches

---

## Additional Configuration

### Enable Vercel Analytics

1. Go to Vercel dashboard → Project → Analytics
2. Click **"Enable Analytics"**
3. Free tier includes basic analytics

### Set Up Preview Deployments

Preview deployments are **automatically enabled** for:
- Pull requests
- All branches (if configured)

To configure:
1. Go to Settings → Git
2. Configure which branches trigger deployments

### Configure Build Caching

Vercel automatically caches:
- `node_modules`
- `.next` build output

No additional configuration needed!

---

## Quick Reference: Environment Variables Checklist

Copy this checklist when setting up:

```
Required:
[ ] NEXT_PUBLIC_SUPABASE_URL
[ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
[ ] NEXT_PUBLIC_ANALYZER_URL (if using analyzer)

Optional (AI features):
[ ] OPENAI_API_KEY
[ ] DEEPSEEK_API_KEY
[ ] AI_PROVIDER
[ ] NODE_ENV
```

---

## Next Steps After Deployment

1. **Monitor Performance**
   - Set up Vercel Analytics
   - Monitor error rates
   - Track page load times

2. **Set Up Monitoring**
   - Consider Sentry for error tracking
   - Set up uptime monitoring
   - Configure alerts

3. **Optimize**
   - Enable Vercel Edge Caching
   - Optimize images
   - Review bundle size

4. **Scale**
   - Monitor usage
   - Upgrade Vercel plan if needed
   - Scale Supabase if needed

---

## Support & Resources

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Project Issues**: Check your GitHub repository issues

---

## 🎉 Success!

If you've completed all steps and your app is live, congratulations! 🚀

Your Dev-Sync.dev dashboard should now be accessible at:
- **Production URL**: `https://your-project.vercel.app`
- **Custom Domain**: `https://yourdomain.com` (if configured)

---

**Last Updated**: 2024
**Project**: Dev-Sync.dev
**Framework**: Next.js 14
**Hosting**: Vercel


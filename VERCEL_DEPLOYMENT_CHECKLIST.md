# ✅ Vercel Deployment Quick Checklist

Use this checklist to ensure you don't miss any steps when deploying to Vercel.

---

## 📋 Pre-Deployment

### Code Preparation
- [ ] All code committed and pushed to GitHub
- [ ] Local build test passes: `cd apps/dashboard && npm run build`
- [ ] No TypeScript errors
- [ ] No console errors in development
- [ ] `.env.local` is in `.gitignore` (not committed)

### Supabase Setup
- [ ] Supabase project created
- [ ] Database migrations applied (if any)
- [ ] Supabase URL copied: `https://xxxxx.supabase.co`
- [ ] Supabase anon key copied
- [ ] Authentication provider enabled (Email)
- [ ] Database tables verified

### Environment Variables Prepared
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Ready
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Ready
- [ ] `NEXT_PUBLIC_ANALYZER_URL` - Ready (or placeholder)
- [ ] `OPENAI_API_KEY` - Ready (optional)
- [ ] `DEEPSEEK_API_KEY` - Ready (optional)
- [ ] `AI_PROVIDER` - Ready (optional)

---

## 🚀 Deployment Steps

### Vercel Setup
- [ ] Vercel account created
- [ ] GitHub account connected to Vercel
- [ ] Repository imported to Vercel

### Project Configuration
- [ ] Framework preset: **Next.js** ✅
- [ ] Root Directory: **`apps/dashboard`** ⚠️ (IMPORTANT!)
- [ ] Build Command: `npm run build` ✅
- [ ] Output Directory: `.next` ✅
- [ ] Install Command: `npm install` ✅
- [ ] Node.js Version: 18.x or 20.x ✅

### Environment Variables Added
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Added to Production, Preview, Development
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Added to Production, Preview, Development
- [ ] `NEXT_PUBLIC_ANALYZER_URL` - Added to Production, Preview, Development
- [ ] `OPENAI_API_KEY` - Added (if using)
- [ ] `DEEPSEEK_API_KEY` - Added (if using)
- [ ] `AI_PROVIDER` - Added (if using)

### Deployment
- [ ] Clicked "Deploy" button
- [ ] Build completed successfully ✅
- [ ] Deployment URL received
- [ ] No build errors in logs

---

## ✅ Post-Deployment Verification

### Basic Functionality
- [ ] Homepage loads correctly
- [ ] No blank page
- [ ] No console errors (check DevTools)
- [ ] HTTPS enabled (lock icon in browser)

### Authentication
- [ ] Sign up works
- [ ] Login works
- [ ] Logout works
- [ ] Session persists

### Core Features
- [ ] Create project works
- [ ] Projects list loads
- [ ] Run scan works
- [ ] View scan results
- [ ] Generate migration works
- [ ] View migration history
- [ ] Execute migration works (if applicable)
- [ ] Rollback migration works (if applicable)

### Team Features (if applicable)
- [ ] Create team works
- [ ] Add team member works
- [ ] Team permissions work

### Security
- [ ] Security headers present (check Network tab)
- [ ] No sensitive data in error messages
- [ ] Authentication required for protected routes

### Performance
- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms
- [ ] No excessive network requests

### Database
- [ ] Data saves to Supabase
- [ ] Data retrieves from Supabase
- [ ] Database connection stable

---

## 🔧 Optional Configuration

### Custom Domain
- [ ] Domain added in Vercel
- [ ] DNS records configured
- [ ] Domain verified
- [ ] SSL certificate active

### Analytics
- [ ] Vercel Analytics enabled (optional)
- [ ] Error tracking set up (optional)

### Monitoring
- [ ] Uptime monitoring configured (optional)
- [ ] Error alerts set up (optional)

---

## 📝 Notes

**Deployment URL**: `https://________________.vercel.app`

**Custom Domain**: `https://________________`

**Supabase Project**: `https://________________.supabase.co`

**Issues Encountered**: 
- 

**Solutions Applied**: 
- 

---

## 🎉 Success Criteria

- [x] All core features working
- [x] No critical errors
- [x] Performance acceptable
- [x] Security verified
- [x] Ready for users!

---

**Date Deployed**: _______________

**Deployed By**: _______________

**Version**: _______________


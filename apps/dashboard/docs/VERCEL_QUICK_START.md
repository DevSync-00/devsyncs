# ⚡ Vercel Deployment Quick Start

**5-Minute Quick Reference** - For detailed instructions, see [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)

---

## 🚀 Quick Steps

### 1. Prepare (2 minutes)
```bash
cd apps/dashboard
npm install
npm run build  # Test build locally
```

### 2. Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push
```

### 3. Deploy on Vercel (3 minutes)

1. **Go to [vercel.com](https://vercel.com)** → Sign up/Login
2. **Import Repository** → Select your GitHub repo
3. **Configure Project**:
   - Root Directory: **`apps/dashboard`** ⚠️ (IMPORTANT!)
   - Framework: Next.js (auto-detected)
   - Build Command: `npm run build` (auto-detected)
4. **Add Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   NEXT_PUBLIC_ANALYZER_URL=https://your-analyzer-url.com
   ```
5. **Click "Deploy"** → Wait 2-5 minutes
6. **Done!** 🎉 Your app is live at `https://your-project.vercel.app`

---

## ⚠️ Critical Settings

| Setting | Value |
|---------|-------|
| **Root Directory** | `apps/dashboard` |
| **Framework** | Next.js |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` |

---

## 📝 Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_ANALYZER_URL=your-analyzer-url
```

**Optional (AI features):**
```env
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
AI_PROVIDER=openai
```

---

## ✅ Verify Deployment

1. Visit your deployment URL
2. Test sign up / login
3. Create a project
4. Run a scan

---

## 🆘 Common Issues

**Build fails?**
- Check Root Directory is `apps/dashboard`
- Verify all dependencies in `package.json`
- Check build logs for errors

**App shows "Missing Supabase credentials"?**
- Verify environment variable names (must start with `NEXT_PUBLIC_`)
- Check variables are added to Production environment
- Redeploy after adding variables

**Authentication doesn't work?**
- Verify Supabase URL and keys are correct
- Check Supabase project is active
- Ensure email provider is enabled in Supabase

---

## 📚 Full Documentation

- **Detailed Guide**: [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)
- **Checklist**: [VERCEL_DEPLOYMENT_CHECKLIST.md](./VERCEL_DEPLOYMENT_CHECKLIST.md)
- **Environment Setup**: [apps/dashboard/ENV_SETUP.md](./apps/dashboard/ENV_SETUP.md)

---

**Need help?** Check the troubleshooting section in the full guide!


# Debug Project Creation 500 Error

## Quick Diagnostic Steps

### 1. Run Diagnostic Script

In Supabase SQL Editor, run `DIAGNOSE_PROJECT_CREATION.sql` to identify the issue.

### 2. Check Browser Console

Open browser DevTools (F12) → Console tab → Look for detailed error message

### 3. Check Network Tab

Open DevTools → Network tab → Find the failing POST request → Click it → Check:
- **Request payload** - What data is being sent?
- **Response** - What error message is returned?
- **Status code** - Is it 500 or something else?

### 4. Check Supabase Logs

1. Go to Supabase Dashboard
2. Navigate to **Logs** → **API Logs**
3. Find the error when creating project
4. Look for the actual error message

## Common Issues & Solutions

### Issue 1: Constraint Violation

**Error**: `new row violates check constraint "projects_schema_type_check"`

**Solution**: Run `COMPLETE_FIX_PROJECT_CREATION.sql` - Step 2

### Issue 2: RLS Policy Blocking

**Error**: `new row violates row-level security policy`

**Solution**: Run `COMPLETE_FIX_PROJECT_CREATION.sql` - Step 4

### Issue 3: Missing Column

**Error**: `column "slug" does not exist` or similar

**Solution**: Run `COMPLETE_FIX_PROJECT_CREATION.sql` - Step 1

### Issue 4: Slug Already Exists

**Error**: `duplicate key value violates unique constraint "projects_slug_key"`

**Solution**: The project name you're using has already been created. Try a different name.

### Issue 5: User ID Issue

**Error**: `null value in column "user_id" violates not-null constraint`

**Solution**: Make sure you're logged in. Check authentication.

## Testing After Fix

1. **Clear browser cache/cookies** (optional but recommended)
2. **Log out and log back in** to refresh auth token
3. **Try creating project again**

## Still Not Working?

1. **Check the exact error message** from:
   - Browser console
   - Network tab response
   - Supabase API logs

2. **Verify you're authenticated**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT id, email FROM auth.users LIMIT 5;
   ```

3. **Check your user ID** matches what's being sent:
   - Open browser DevTools → Application → Cookies
   - Look for Supabase auth token
   - Or check Supabase Dashboard → Authentication → Users

4. **Try creating project with SQL directly**:
   ```sql
   -- Replace 'your-user-id' with your actual user ID
   INSERT INTO projects (name, slug, user_id, schema_type)
   VALUES ('Manual Test', 'manual-test', 'your-user-id'::uuid, 'prisma')
   RETURNING *;
   ```

If this works, the issue is with the frontend/API. If it doesn't, it's a database permissions/constraints issue.


# Setup Guide - Screener

> [!WARNING]
> **Current Version Status**: Application has critical RLS issues that prevent normal operation.  
> This guide will help you run it locally for development/debugging purposes.

## Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Supabase Account**: Free tier sufficient
- **Git**: For version control

## Installation Steps

### 1. Clone Repository

```bash
git clone <repository-url>
cd screener-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Public anon key | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Service role key (dev only) | Supabase Dashboard → Settings → API → service_role |

> [!CAUTION]
> **Never commit `.env` to version control!** The service role key has admin access.

### 4. Set Up Supabase Database

#### Option A: Via Supabase Dashboard (Recommended)

1. Go to Supabase Dashboard → SQL Editor
2. Run scripts in order:
   ```
   supabase/schema.sql
   supabase/04_create_test_users.sql
   supabase/05_rls_policies.sql
   supabase/06_seed_test_evaluations.sql
   supabase/10_teams_evolution.sql
   supabase/12_bulk_user_helpers.sql
   supabase/13_users_soft_delete.sql
   ```

3. **Skip scripts 14-22** (these are debugging attempts, not needed for fresh install)

#### Option B: Via Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref <your-project-ref>

# Run migrations
supabase db push
```

### 5. Create Test Users

Execute in Supabase SQL Editor:

```sql
-- Reset passwords for test users
-- (from supabase/16_reset_test_passwords.sql)
UPDATE auth.users
SET encrypted_password = crypt('Screener2026', gen_salt('bf'))
WHERE email IN (
  'ana.silva@teste.com',
  'bruno.costa@teste.com',
  'carla.mendes@teste.com'
);
```

### 6. Deploy Edge Functions (Optional)

```bash
# Deploy manage-users function
supabase functions deploy manage-users
```

Or deploy via Supabase Dashboard → Edge Functions.

### 7. Run Development Server

```bash
npm run dev
```

Application will be available at: **http://localhost:5174**

## Test Credentials

| Email | Password | Role |
|-------|----------|------|
| `ana.silva@teste.com` | `Screener2026` | Analyst |
| `bruno.costa@teste.com` | `Screener2026` | Analyst |
| `carla.mendes@teste.com` | `Screener2026` | Evaluator |
| Your admin email | Your password | Admin |

## Common Issues & Solutions

### Issue: "Invalid login credentials"

**Cause**: Test user passwords not set correctly

**Solution**:
```sql
-- Run password reset script again
UPDATE auth.users
SET encrypted_password = crypt('Screener2026', gen_salt('bf'))
WHERE email LIKE '%@teste.com';
```

### Issue: Application hangs on "Loading..."

**Cause**: RLS recursion deadlock (known issue)

**Solution**:
1. Open browser DevTools (F12) → Console
2. Run: `sessionStorage.clear(); location.reload()`
3. If still hangs, temporarily disable RLS:
   ```sql
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   ```

### Issue: "User update succeeded" but database unchanged

**Cause**: RLS policy blocking UPDATE silently

**Solution**: See [Lessons Learned](./06_LESSONS_LEARNED.md) for proper RLS design

### Issue: Edge Function returns 401

**Cause**: JWT validation issues

**Solution**: Use Supabase Dashboard to create users instead of UI

## Development Workflow

### Using Dev Mode Toggle

1. Click bug icon (top-left) to open Dev Mode
2. Select a test user profile
3. Application switches to that role instantly
4. No need to logout/login

> [!TIP]
> Dev Mode uses **real authentication** (not mock), so Edge Functions will work correctly.

### Clearing Session Data

If you encounter auth issues:

```javascript
// Run in browser console
sessionStorage.clear()
location.reload()
```

## Building for Production

> [!CAUTION]
> **DO NOT deploy current version to production!**  
> See [Lessons Learned](./06_LESSONS_LEARNED.md) for required fixes first.

When ready:

```bash
npm run build
npm run preview  # Test production build locally
```

Deploy `dist/` folder to Vercel, Netlify, or your hosting provider.

## Next Steps

1. Read [Architecture](./01_ARCHITECTURE.md) to understand the system
2. Review [Key Components](./04_KEY_COMPONENTS.md) for code structure
3. **MUST READ**: [Lessons Learned](./06_LESSONS_LEARNED.md) before making changes

---

*For troubleshooting RLS issues, see [Lessons Learned](./06_LESSONS_LEARNED.md)*

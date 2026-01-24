# Screener 2.0

Sistema de avaliação de analistas de suporte.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run development server
npm run dev
```

## 📋 Setup Checklist

### 1. Supabase Setup

1. Create a new Supabase project
2. Run SQL scripts in order:
   - `supabase/01_schema.sql`
   - `supabase/02_rls_policies.sql`
   - `supabase/03_seed_data.sql`
3. Create test users in Supabase Auth Dashboard
4. Deploy Edge Functions:
   ```bash
   supabase functions deploy manage-users
   supabase functions deploy send-notification
   ```

### 2. Environment Variables

Update `.env` with:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3. Test Users

Create these users in Supabase Auth (password: `Test123!`):
- `admin@screener.test` (admin)
- `avaliador@screener.test` (evaluator)
- `analista@screener.test` (analyst)

## 🧪 Testing

```bash
# Run RLS tests
psql -h db.your-project.supabase.co -U postgres -f supabase/04_rls_tests.sql

# Run unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e
```

## 📦 Build

```bash
npm run build
npm run preview
```

## 🔑 Key Features

- ✅ Correct RLS policies (no recursion)
- ✅ Native JWT validation in Edge Functions
- ✅ Write verification (no silent failures)
- ✅ Dev Mode for quick role switching
- ✅ React Hook Form + Zod validation
- ✅ SendGrid email integration

## 📚 Documentation

See `/docs` folder for complete documentation.

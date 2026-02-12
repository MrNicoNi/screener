# Dependencies - Screener

## Production Dependencies

| Package | Version | Purpose | Why Chosen | Alternatives Considered |
|---------|---------|---------|------------|------------------------|
| **react** | 19.2.0 | UI framework | Industry standard, large ecosystem, concurrent features | Vue 3 (less ecosystem), Svelte (smaller community) |
| **react-dom** | 19.2.0 | React renderer | Required for React web apps | N/A |
| **react-router-dom** | 7.11.0 | Client-side routing | Best React router, type-safe | TanStack Router (newer, less mature) |
| **@supabase/supabase-js** | 2.89.0 | Backend SDK | All-in-one: Auth + DB + Storage | Firebase (vendor lock-in), custom backend (more work) |
| **lucide-react** | 0.562.0 | Icon library | Modern, tree-shakeable, consistent | Heroicons (smaller set), FontAwesome (heavier) |
| **recharts** | 3.6.0 | Charts/graphs | React-native, composable, good docs | Chart.js (not React-native), D3 (too complex) |
| **xlsx** | 0.18.5 | Excel import/export | Bulk user upload feature | PapaParse (CSV only), custom parser (more work) |

## Development Dependencies

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| **vite** | 7.2.4 | Build tool | Fast HMR, modern, ESM-first |
| **@vitejs/plugin-react** | 5.1.1 | React support for Vite | Enables JSX, Fast Refresh |
| **tailwindcss** | 4.1.18 | CSS framework | Utility-first, fast development |
| **@tailwindcss/vite** | 4.1.18 | Tailwind Vite plugin | Native Vite integration |
| **eslint** | 9.39.1 | Code linting | Catch errors early |
| **eslint-plugin-react-hooks** | 7.0.1 | React hooks linting | Enforce hooks rules |

## External Services

### Supabase (Primary Backend)

**What it provides**:
- PostgreSQL database (managed)
- Authentication (JWT-based)
- Row Level Security (RLS)
- Edge Functions (Deno runtime)
- Real-time subscriptions (not used yet)
- Storage (not used yet)

**Pricing**: Free tier sufficient for MVP (up to 500MB database, 50,000 monthly active users)

**Alternatives Considered**:
- **Firebase**: ❌ NoSQL (need relational), vendor lock-in
- **AWS Amplify**: ❌ Complex setup, steeper learning curve
- **Custom Node.js backend**: ❌ More development time, need to manage auth

**Critical Issues** (see [Lessons Learned](./06_LESSONS_LEARNED.md)):
- RLS recursion deadlocks
- Edge Function JWT validation fragile
- Silent update failures

---

## Dependency Analysis

### Security Audit

```bash
npm audit
```

**Current Status**: No critical vulnerabilities (as of 2026-01-16)

**Update Policy**:
- **Major versions**: Review changelog, test thoroughly
- **Minor versions**: Update monthly
- **Patch versions**: Update weekly (security fixes)

### Bundle Size

```bash
npm run build
```

**Current Production Bundle**:
- **Total**: ~450 KB (gzipped)
- **Largest**: `react-dom` (~130 KB), `recharts` (~80 KB), `@supabase/supabase-js` (~60 KB)

**Optimization Opportunities**:
1. Code-split routes (reduce initial load)
2. Lazy-load Recharts (only on Dashboard)
3. Tree-shake unused Lucide icons

---

## Version Compatibility Matrix

| Dependency | Minimum Node | Minimum npm | Notes |
|------------|--------------|-------------|-------|
| Vite 7.x | 18.0.0 | 9.0.0 | Uses native ESM |
| React 19.x | 18.0.0 | 9.0.0 | Requires modern bundler |
| Supabase JS 2.x | 16.0.0 | 8.0.0 | Works with older Node |

**Recommended Environment**:
- Node.js: **20.x LTS** (current LTS)
- npm: **10.x** (bundled with Node 20)

---

## Supabase Configuration

### Environment Variables

```bash
# .env file
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # DEV ONLY
```

> [!CAUTION]
> **Never commit service role key to git!** It has admin access to your database.

### Client Configuration

**File**: [`src/lib/supabase.js`](file:///d:/AntiGravity/Projetos/Screener/screener-app/src/lib/supabase.js)

```javascript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: window.sessionStorage,  // ← Changed from localStorage
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
)
```

**Why sessionStorage?**
- ✅ Auto-clears on browser close (no stale data)
- ✅ Prevents RLS cache issues during development
- ❌ Users must re-login after closing browser

**For Production**: Consider hybrid approach or version-based cache invalidation

---

## Breaking Changes History

### React 18 → 19

**Impact**: Minimal (backwards compatible)

**Changes Required**: None (automatic batching already used)

### Supabase JS 1.x → 2.x

**Impact**: Major (API changes)

**Migration Done**: Yes (project started on 2.x)

**Key Differences**:
- `supabase.auth.user()` → `supabase.auth.getUser()`
- `supabase.auth.session()` → `supabase.auth.getSession()`

---

## Dependency Update Checklist

Before updating any dependency:

- [ ] Check changelog for breaking changes
- [ ] Update in `package.json`
- [ ] Run `npm install`
- [ ] Run `npm run lint` (check for new lint errors)
- [ ] Run `npm run build` (verify build succeeds)
- [ ] Test critical paths:
  - [ ] Login/logout
  - [ ] Create evaluation
  - [ ] User management
  - [ ] Dashboard charts
- [ ] Check bundle size (`npm run build`)
- [ ] Commit with message: `chore: update [package] to [version]`

---

## Recommended Additional Dependencies for 2.0

| Package | Purpose | Why Add |
|---------|---------|---------|
| **vitest** | Unit testing | Test RLS policies, hooks, utilities |
| **@testing-library/react** | Component testing | Test UI components |
| **msw** | API mocking | Mock Supabase in tests |
| **zod** | Schema validation | Validate forms, API responses |
| **react-hook-form** | Form management | Better form UX, validation |
| **date-fns** | Date utilities | Format dates, calculate trends |

---

## Known Issues & Workarounds

### Issue: Supabase JS 2.89.0 - Silent RLS Failures

**Symptom**: `.update()` returns success even when RLS blocks write

**Workaround**: Always verify writes with separate SELECT

```javascript
// After update
const { data: verified } = await supabase
  .from('users')
  .select('name')
  .eq('id', userId)
  .single()

if (verified.name !== expectedName) {
  throw new Error('Update failed - RLS blocked it')
}
```

**Tracking**: [Supabase GitHub Issue #12345](https://github.com/supabase/supabase/issues/12345) (example)

---

*For setup instructions, see [Setup Guide](./02_SETUP.md)*  
*For deployment, see [Deployment Guide](./07_DEPLOYMENT.md)*

# Lessons Learned - Screener 1.0 Post-Mortem

> [!CAUTION]
> **MUST READ before starting Screener 2.0**  
> This document contains critical lessons from 15+ hours of debugging RLS policies, Edge Functions, and authentication issues. These mistakes cost significant development time and blocked production deployment.

---

## 🔥 Critical Failures & Root Causes

### 1. RLS Recursion Deadlock ❌ **BLOCKER**

**What Happened:**
- Application hangs indefinitely on `fetchUserProfile()` during auth initialization
- Users stuck on "Loading..." screen forever
- No error messages, just silent failure 

**Root Cause:**
```sql
-- ❌ WRONG: This creates infinite recursion
CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    --      ^^^^^ Querying the SAME table that has this policy!
  );
```

**Why It Fails:**
1. User tries to query `users` table
2. RLS policy activates
3. Policy queries `users` table to check if user is admin
4. This triggers the same RLS policy again
5. Infinite loop → Application hangs

**Time Lost:** ~4 hours across multiple sessions

**The Fix for 2.0:**
```sql
-- ✅ CORRECT: Use a database function that bypasses RLS
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Then use the function in policies
CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (auth.is_admin());
```

**Key Principle:** 
> **Never query the same table inside its own RLS policy**. Always use `SECURITY DEFINER` functions that bypass RLS.

---

### 2. User Update "Succeeds" But Doesn't Persist ❌ **BLOCKER**

**What Happened:**
- Frontend shows "✅ User updated successfully"
- Database query returns updated data
- But Supabase database **doesn't actually update**
- Silent failure, no errors

**Root Cause:**
RLS policy blocks the UPDATE but Supabase client returns "success" anyway because the query itself is valid.

```javascript
// Frontend sees this:
const { data, error } = await supabase
  .from('users')
  .update({ name: 'New Name' })
  .eq('id', userId)
  .select()
  .single()

// data = { id: '...', name: 'New Name' } ✅
// error = null ✅
// BUT DATABASE STILL HAS OLD NAME! ❌
```

**Why It Fails:**
- Supabase returns the data you *tried* to write, not what's actually in the DB
- RLS silently blocks the write
- No error is thrown

**Time Lost:** ~2 hours debugging, checking logs, verifying queries

**The Fix for 2.0:**
1. **Always verify writes with a separate SELECT:**
   ```javascript
   // Write
   await supabase.from('users').update({ name }).eq('id', id)
   
   // Verify (separate query)
   const { data: verified } = await supabase
     .from('users')
     .select('name')
     .eq('id', id)
     .single()
   
   if (verified.name !== name) {
     throw new Error('Update failed - RLS policy blocked it')
   }
   ```

2. **Use proper RLS policies with `WITH CHECK` clause:**
   ```sql
   CREATE POLICY "Admins can update users" ON users
     FOR UPDATE 
     USING (auth.is_admin())      -- Can SELECT the row
     WITH CHECK (auth.is_admin()); -- Can UPDATE the row
   ```

---

### 3. Edge Function "Invalid JWT" 401 Errors ❌ **BLOCKER**

**What Happened:**
- Edge Function returns 401 "Invalid JWT" or "Unauthorized"
- Same code worked in previous sessions
- No clear error messages in logs

**Root Cause (Multiple Issues):**
1. **Manual JWT extraction is fragile:**
   ```typescript
   // ❌ WRONG: Manual token extraction
   const token = req.headers.get('authorization')?.replace('Bearer ', '')
   const { data: { user } } = await supabase.auth.getUser(token)
   ```

2. **Using wrong Supabase client:**
   - Admin client for JWT validation → Fails
   - User client without proper auth → Fails

3. **RLS policies blocking Edge Function queries**

**Time Lost:** ~3 hours across 2 sessions, 4 different attempted fixes

**The Fix for 2.0:**
```typescript
// ✅ CORRECT: Let Supabase handle JWT automatically
import { createClient } from '@supabase/supabase-js'

export default async (req: Request) => {
  // Create client with Authorization header from request
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! }
      }
    }
  )

  // Supabase validates JWT automatically
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Now you have authenticated user
  // ...
}
```

**Key Principle:**
> **Never manually extract or validate JWTs**. Let Supabase SDK handle it by passing the Authorization header.

---

### 4. localStorage Cache Hell 🔥

**What Happened:**
- Old session data persists across code changes
- RLS policy changes don't take effect
- Need to manually clear localStorage constantly
- Wastes 5-10 minutes every session

**Root Cause:**
Supabase uses `localStorage` by default, which persists forever until manually cleared.

**Time Lost:** ~30 minutes cumulative across all sessions

**The Fix for 2.0:**
```javascript
// ✅ Use sessionStorage instead
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: window.sessionStorage,  // ← Auto-clears on browser close
      autoRefreshToken: true,
      persistSession: true
    }
  }
)
```

**Trade-off:**
- ✅ No more stale data issues
- ✅ Auto-clears on browser close
- ❌ Users need to login again after closing browser

**For Production:** Consider hybrid approach:
- Development: `sessionStorage`
- Production: `localStorage` with version-based cache invalidation

---

## 🎯 Architectural Anti-Patterns to Avoid

### Anti-Pattern #1: Complex RLS Policies

**❌ Don't:**
```sql
-- Too complex, hard to debug, prone to recursion
CREATE POLICY "complex_policy" ON table_name
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM other_table o
      JOIN another_table a ON o.id = a.other_id
      WHERE a.user_id = auth.uid()
      AND o.status = 'active'
      AND (
        SELECT role FROM users WHERE id = auth.uid()
      ) IN ('admin', 'manager')
    )
  );
```

**✅ Do:**
```sql
-- Simple, uses helper functions
CREATE POLICY "simple_policy" ON table_name
  FOR SELECT USING (
    auth.user_has_access(id)  -- Function encapsulates complexity
  );
```

### Anti-Pattern #2: Mixing Auth Strategies

**❌ Don't:**
- RLS for some tables
- Edge Functions for others
- Frontend checks for UI
- No clear source of truth

**✅ Do:**
- **RLS for ALL data access** (database-level security)
- **Edge Functions for business logic** (not auth)
- **Frontend for UX only** (never trust it)

### Anti-Pattern #3: No Automated Testing for RLS

**❌ Don't:**
- Manually test RLS policies
- Hope they work in production
- Debug in production

**✅ Do:**
```sql
-- Create test suite for RLS policies
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims TO '{"sub": "user-id", "role": "analyst"}';
  
  -- Test: Analyst can only see own evaluations
  SELECT COUNT(*) = 1 FROM evaluations WHERE analyst_id = 'user-id';
  
  -- Test: Analyst cannot see others' evaluations
  SELECT COUNT(*) = 0 FROM evaluations WHERE analyst_id != 'user-id';
ROLLBACK;
```

---

## 📋 Screener 2.0 Checklist

Before writing a single line of code for 2.0, ensure:

### Architecture
- [ ] RLS policies designed with `SECURITY DEFINER` functions
- [ ] No recursive queries in RLS policies
- [ ] All policies have both `USING` and `WITH CHECK` clauses
- [ ] Edge Functions use native Supabase JWT validation
- [ ] Clear separation: RLS = security, Edge Functions = business logic

### Development Experience
- [ ] Use `sessionStorage` for development
- [ ] Automated RLS policy tests
- [ ] Comprehensive logging (but remove before production)
- [ ] Dev Mode Toggle for quick role switching

### Testing
- [ ] RLS policy test suite (SQL)
- [ ] Edge Function integration tests
- [ ] Manual permission testing checklist
- [ ] Load testing with realistic data

### Documentation
- [ ] RLS policy documentation (what each does)
- [ ] Edge Function API documentation
- [ ] Database schema with relationships
- [ ] Deployment runbook

---

## 💡 What Worked Well

### ✅ Successes to Replicate in 2.0

1. **Dev Mode Toggle**
   - Instant role switching without logout
   - Saved hours of manual testing
   - Keep this pattern!

2. **Soft Delete**
   - Preserved historical data
   - Allowed data recovery
   - Better than hard delete

3. **Flight Logs**
   - Enabled quick context recovery
   - Documented decisions
   - Prevented repeating mistakes

4. **Systematic Debugging**
   - Logs at every layer
   - Revealed silent failures
   - Made debugging 10x faster

---

## 📊 Time Investment Analysis

| Activity | Time Spent | Could Have Been | Savings |
|----------|------------|-----------------|---------|
| RLS Recursion Debugging | 4h | 30min with proper design | 3.5h |
| Edge Function JWT Issues | 3h | 15min with native validation | 2.75h |
| localStorage Cache Issues | 30min | 0min with sessionStorage | 30min |
| User Update Persistence | 2h | 30min with verification | 1.5h |
| **TOTAL** | **9.5h** | **1.25h** | **8.25h** |

**ROI of Reading This Document:** 8+ hours saved on Screener 2.0

---

## 🚀 Recommended Tech Stack for 2.0

Based on lessons learned:

| Component | Recommendation | Why |
|-----------|----------------|-----|
| **Database** | PostgreSQL (Supabase) | ✅ Works well, just need better RLS design |
| **Auth** | Supabase Auth | ✅ Native JWT validation is solid |
| **Backend** | Supabase Edge Functions | ✅ Good, but use native auth only |
| **Frontend** | React 19 + Vite | ✅ Fast, modern, works well |
| **State** | React Context | ✅ Simple, sufficient for this app |
| **Storage** | sessionStorage (dev) + localStorage (prod) | ✅ Best of both worlds |
| **Testing** | Vitest + Supabase pg_tap | 🆕 Add automated RLS tests |

---

## 📚 Required Reading Before 2.0

1. [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
2. [PostgreSQL SECURITY DEFINER Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
3. [Supabase Edge Functions Auth](https://supabase.com/docs/guides/functions/auth)

---

*"Those who cannot remember the past are condemned to repeat it." - George Santayana*

**Last Updated:** 2026-01-16  
**Status:** Production-ready for Screener 2.0 planning

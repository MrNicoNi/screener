# Directory Structure - Screener

## Project Overview

```
screener-app/
├── src/                    # Frontend source code
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions and configs
│   ├── pages/              # Route components
│   ├── App.jsx             # Main app component with routing
│   ├── main.jsx            # React entry point
│   └── index.css           # Global styles
├── supabase/               # Backend configuration
│   ├── functions/          # Edge Functions (Deno)
│   ├── *.sql               # Database migrations
│   └── schema.sql          # Base database schema
├── public/                 # Static assets
├── docs/                   # Documentation (you are here)
├── .env                    # Environment variables (not in git)
├── .env.example            # Environment template
├── package.json            # Dependencies and scripts
└── vite.config.js          # Vite configuration
```

## Detailed Breakdown

### `/src` - Frontend Application

```
src/
├── components/
│   ├── DevModeToggle.jsx       # Dev tool for role switching
│   └── Layout.jsx              # App shell with navigation
│
├── hooks/
│   ├── useAuth.jsx             # Authentication state & logic
│   ├── useEvaluations.jsx      # Evaluation CRUD operations
│   ├── useTeams.jsx            # Team management
│   └── useUsers.jsx            # User management
│
├── lib/
│   ├── supabase.js             # Supabase client config
│   └── utils.js                # Helper functions
│
├── pages/
│   ├── Login.jsx               # Login page
│   ├── Dashboard.jsx           # Main dashboard (Admin/Evaluator)
│   ├── NewAudit.jsx            # Create new evaluation
│   ├── Team.jsx                # Team overview
│   ├── AnalystDetail.jsx       # Analyst profile & evaluations
│   ├── EvaluationDetail.jsx    # Single evaluation view
│   ├── ManageTeams.jsx         # Team management (Admin)
│   └── ManageUsers.jsx         # User management (Admin)
│
├── App.jsx                     # Router + protected routes
├── main.jsx                    # React DOM render
└── index.css                   # TailwindCSS + global styles
```

### `/supabase` - Backend & Database

```
supabase/
├── functions/
│   └── manage-users/
│       └── index.ts            # User CRUD Edge Function
│
├── schema.sql                  # Base schema (tables, indexes, RLS)
├── 04_create_test_users.sql    # Test data
├── 05_rls_policies.sql         # Row Level Security policies
├── 06_seed_test_evaluations.sql # Sample evaluations
├── 10_teams_evolution.sql      # Team hierarchy
├── 12_bulk_user_helpers.sql    # Database functions
├── 13_users_soft_delete.sql    # Soft delete support
│
└── 14-22_*.sql                 # ⚠️ Debugging attempts (skip these)
```

> [!WARNING]
> Scripts 14-22 are debugging attempts for RLS issues. **Do not run these on fresh install.**

## File Naming Conventions

| Pattern | Meaning | Example |
|---------|---------|---------|
| `use*.jsx` | Custom React hook | `useAuth.jsx` |
| `*.jsx` | React component | `Dashboard.jsx` |
| `*.sql` | Database migration | `05_rls_policies.sql` |
| `NN_*.sql` | Numbered migration | `10_teams_evolution.sql` |

## Where to Find Things

| Need to... | Look in... |
|------------|------------|
| **Add a new page** | `src/pages/` + update `App.jsx` routes |
| **Modify authentication** | `src/hooks/useAuth.jsx` + `src/lib/supabase.js` |
| **Change database schema** | Create new `supabase/NN_*.sql` migration |
| **Add RLS policy** | `supabase/05_rls_policies.sql` (or new migration) |
| **Create Edge Function** | `supabase/functions/<name>/index.ts` |
| **Update styles** | `src/index.css` (TailwindCSS) |
| **Manage dependencies** | `package.json` |
| **Configure build** | `vite.config.js` |

## Critical Files (Must Understand)

### 1. `src/hooks/useAuth.jsx`
- Manages authentication state
- Handles login/logout
- Fetches user profile
- **⚠️ Contains RLS recursion bug** (see [Lessons Learned](./06_LESSONS_LEARNED.md))

### 2. `src/lib/supabase.js`
- Supabase client configuration
- **Uses sessionStorage** (not localStorage)
- Session cleanup utilities

### 3. `supabase/schema.sql`
- Base database schema
- Table definitions
- RLS policies (initial version)

### 4. `supabase/functions/manage-users/index.ts`
- User creation Edge Function
- **⚠️ Has JWT validation issues** (see [Lessons Learned](./06_LESSONS_LEARNED.md))

### 5. `src/components/DevModeToggle.jsx`
- Development tool for role switching
- **Essential for testing permissions**

## Code Organization Principles

1. **Hooks for data logic**: All API calls in custom hooks (`useAuth`, `useUsers`, etc.)
2. **Pages for routes**: Each route = one page component
3. **Components for reusability**: Shared UI in `/components`
4. **SQL migrations are immutable**: Never edit old migrations, create new ones

## Dependencies Map

```mermaid
graph TD
    Pages --> Hooks
    Pages --> Components
    Hooks --> Supabase[lib/supabase.js]
    Components --> Hooks
    Supabase --> SupabaseSDK[@supabase/supabase-js]
    
    EdgeFunctions[Edge Functions] --> PostgreSQL
    Hooks --> EdgeFunctions
    Hooks --> PostgreSQL
    
    style Hooks fill:#9f9,stroke:#333
    style Supabase fill:#f99,stroke:#333
    style EdgeFunctions fill:#ff9,stroke:#333
```

---

*For component details, see [Key Components](./04_KEY_COMPONENTS.md)*

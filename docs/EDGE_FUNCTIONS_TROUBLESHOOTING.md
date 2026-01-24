# Edge Functions - Troubleshooting Guide

## Problema: CORS Preflight Falha com HTTP 500

**Data da resolução:** 2026-01-24

### Sintoma

Ao tentar criar usuários via Edge Function, o navegador exibe:

```
Access to fetch at 'https://...supabase.co/functions/v1/manage-users' 
has been blocked by CORS policy: Response to preflight request doesn't 
pass access control check: It does not have HTTP ok status.
```

### Causa Raiz

O problema tinha **duas causas**:

1. **Import ESM.sh instável**: O import `https://esm.sh/@supabase/supabase-js@2` causava falhas de cold start
2. **Verificação JWT no Gateway**: O Supabase verificava JWT antes da função rodar, bloqueando requisições OPTIONS

### Solução Aplicada

#### 1. Trocar para JSR Registry

```typescript
// ❌ ANTES (instável)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ✅ DEPOIS (estável)
import { createClient } from 'jsr:@supabase/supabase-js@2'
```

#### 2. Deploy com --no-verify-jwt

```bash
npx supabase functions deploy manage-users --project-ref PROJECT_REF --no-verify-jwt
```

#### 3. Configuração Persistente (config.toml)

```toml
# supabase/config.toml
[functions.manage-users]
verify_jwt = false
```

### Segurança

O bypass do JWT no gateway **NÃO** compromete a segurança porque:

1. A função valida o JWT manualmente via `supabase.auth.getUser()`
2. Verifica se o usuário tem role `admin` antes de executar ações
3. Apenas requisições OPTIONS (preflight) passam sem validação

### Código Padrão para Edge Functions com CORS

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight FIRST
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Validar autenticação manualmente
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Sua lógica aqui...
        
        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: String(error) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
```

### Referências

- [Supabase CORS Docs](https://supabase.com/docs/guides/functions/cors)
- [JSR Registry](https://jsr.io/@supabase/supabase-js)

# Screener 2.0 - Deployment Guide

## 🚀 Deploy para Vercel (Produção)

### Pré-requisitos
- ✅ Projeto funcionando localmente
- ✅ Conta no GitHub
- ✅ Conta no Vercel (gratuita)
- ✅ Supabase configurado

---

## 📋 Passo a Passo

### 1. Preparar Repositório GitHub

```bash
# Inicializar Git (se ainda não foi feito)
cd d:\AntiGravity\Projetos\Screener2.0\screener-2.0
git init

# Adicionar todos os arquivos
git add .

# Commit inicial
git commit -m "Initial commit - Screener 2.0"

# Criar repositório no GitHub (via interface web)
# Depois conectar:
git remote add origin https://github.com/seu-usuario/screener-2.0.git
git branch -M main
git push -u origin main
```

### 2. Deploy no Vercel

#### Via Dashboard (Recomendado)

1. Acesse [vercel.com](https://vercel.com)
2. Clique em **"Add New Project"**
3. Selecione **"Import Git Repository"**
4. Escolha o repositório `screener-2.0`
5. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

#### Variáveis de Ambiente

Adicione no Vercel (Settings → Environment Variables):

```
VITE_SUPABASE_URL=https://gyktdmahkifnsrbaxodl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **IMPORTANTE**: Use as mesmas credenciais do `.env` local

6. Clique em **"Deploy"**

---

## 🔧 Configurar Edge Functions (Supabase)

As Edge Functions já estão criadas localmente. Para deploy:

```bash
# Instalar Supabase CLI (se ainda não instalou)
npm install -g supabase

# Login
supabase login

# Link ao projeto
supabase link --project-ref gyktdmahkifnsrbaxodl

# Deploy Edge Functions
supabase functions deploy manage-users
supabase functions deploy send-notification

# Configurar secrets (SendGrid)
supabase secrets set SENDGRID_API_KEY=SG.seu-api-key-aqui
```

---

## ✅ Verificação Pós-Deploy

### 1. Testar URL de Produção

Após deploy, Vercel fornecerá uma URL como:
```
https://screener-2-0.vercel.app
```

### 2. Smoke Test

- [ ] Acessar URL de produção
- [ ] Login com `admin@screener.test`
- [ ] Navegar para Dashboard
- [ ] Criar nova avaliação
- [ ] Verificar que salvou no Supabase
- [ ] Logout

### 3. Verificar Logs

- **Vercel**: Dashboard → Deployments → Logs
- **Supabase**: Dashboard → Edge Functions → Logs

---

## 🌐 Domínio Customizado (Opcional)

### Adicionar Domínio Próprio

1. No Vercel: **Settings → Domains**
2. Adicionar: `screener.suaempresa.com`
3. Configurar DNS:
   ```
   Type: CNAME
   Name: screener
   Value: cname.vercel-dns.com
   ```

---

## 🔒 Segurança em Produção

### Checklist de Segurança

- [x] `.env` no `.gitignore` (não commitado)
- [x] RLS habilitado em todas as tabelas
- [x] JWT validation nos Edge Functions
- [x] HTTPS automático (Vercel)
- [ ] Rate limiting (Supabase - configurar se necessário)
- [ ] CORS configurado nos Edge Functions

---

## 📊 Monitoramento

### Vercel Analytics (Opcional)

```bash
npm install @vercel/analytics
```

Adicionar em `src/main.jsx`:
```javascript
import { inject } from '@vercel/analytics'
inject()
```

### Supabase Monitoring

- **Dashboard → Database → Performance**
- **Dashboard → API → Logs**
- **Dashboard → Auth → Users**

---

## 🔄 Atualizações Futuras

### Workflow de Deploy

```bash
# 1. Fazer alterações localmente
# 2. Testar localmente
npm run dev

# 3. Commit e push
git add .
git commit -m "feat: nova funcionalidade"
git push

# 4. Vercel faz deploy automático!
```

---

## 🆘 Troubleshooting

### Build Falha no Vercel

**Erro**: `Module not found`
- **Solução**: Verificar `package.json` e rodar `npm install` localmente

**Erro**: `Environment variable not found`
- **Solução**: Adicionar variáveis em Vercel → Settings → Environment Variables

### 401 Unauthorized em Produção

- **Solução**: Verificar `VITE_SUPABASE_ANON_KEY` no Vercel
- **Solução**: Verificar RLS policies no Supabase

### Edge Functions não funcionam

- **Solução**: Rodar `supabase functions deploy` novamente
- **Solução**: Verificar secrets: `supabase secrets list`

---

## 📞 Suporte

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Vite Docs**: https://vitejs.dev

---

**Status**: ✅ Pronto para deploy
**Tempo estimado**: 15-20 minutos
**Custo**: $0/mês (free tiers)

# ScreenerQA

**Sistema de Avaliação de Qualidade para Equipes de Suporte**

ScreenerQA é uma plataforma web moderna para gestão de qualidade de atendimento, permitindo avaliações estruturadas, dashboards em tempo real e feedback automatizado para analistas de suporte.

---

## 🎯 Visão Geral

O ScreenerQA digitaliza o processo de avaliação de qualidade, substituindo planilhas manuais por um sistema centralizado com:

- **Avaliações Estruturadas**: Framework FY26 com 3 pilares (Comunicação 35%, Eficiência 30%, Processos 35%)
- **Critical Pass**: Falhas em itens críticos reprovam automaticamente a auditoria
- **Dashboards em Tempo Real**: Métricas, tendências, radar de qualidade e rankings
- **Notificações Automáticas**: Emails via SendGrid para analistas e gestores
- **RBAC**: Controle de acesso baseado em funções (Admin, Avaliador, Analista)

---

## 🚀 Stack Tecnológica

- **Frontend**: React 19 + Vite + TailwindCSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Autenticação**: Supabase Auth (JWT)
- **Hospedagem**: Vercel
- **Email**: SendGrid
- **Validação**: Zod + React Hook Form

---

## 📦 Instalação

### Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta Supabase (gratuita)
- Conta Vercel (opcional, para deploy)

### Setup Local

```bash
# Clone o repositório
git clone https://github.com/MrNicoNi/screener-2.0.git
cd screener-2.0

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais Supabase

# Execute o servidor de desenvolvimento
npm run dev
```

Acesse: `http://localhost:5173`

---

## 🗄️ Configuração do Banco de Dados

### 1. Criar Projeto Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Copie a URL e Anon Key para o `.env`

### 2. Executar Scripts SQL

No Supabase SQL Editor, execute na ordem:

```sql
-- 1. Schema (tabelas e triggers)
-- Copie e execute: supabase/01_schema.sql

-- 2. RLS Policies (segurança)
-- Copie e execute: supabase/02_rls_policies.sql

-- 3. Seed Data (dados iniciais)
-- Copie e execute: supabase/03_seed_data.sql
```

### 3. Deploy Edge Functions

```bash
# Instale Supabase CLI
npm install -g supabase

# Login
supabase login

# Link ao projeto
supabase link --project-ref SEU_PROJECT_REF

# Deploy funções
supabase functions deploy manage-users
supabase functions deploy send-notification
supabase functions deploy send-welcome-email
supabase functions deploy reset-password

# Configure secrets (SendGrid)
supabase secrets set SENDGRID_API_KEY=SG.sua-api-key
```

---

## 👥 Usuários de Teste

Crie estes usuários no Supabase Auth Dashboard:

| Email | Senha | Role | Descrição |
|-------|-------|------|-----------|
| `admin@screener.test` | `Test123!` | admin | Acesso total ao sistema |
| `avaliador@screener.test` | `Test123!` | evaluator | Criar avaliações |
| `analista@screener.test` | `Test123!` | analyst | Visualizar próprias avaliações |

---

## 🧪 Testes

```bash
# Testes unitários
npm run test:unit

# Testes E2E (Playwright)
npm run test:e2e

# Testes RLS (Supabase)
psql -h db.SEU_PROJECT.supabase.co -U postgres -f supabase/04_rls_tests.sql
```

---

## 🚢 Deploy

### Vercel (Recomendado)

1. Conecte seu repositório GitHub ao Vercel
2. Configure variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy automático a cada push na `main`

**URL de Produção**: [screenerqa.vercel.app](https://screenerqa.vercel.app)

---

## 📚 Documentação

- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Guia completo de deploy
- **[docs/](./docs/)**: Documentação técnica detalhada
- **[Materiais de Apoio/](./Materiais%20de%20Apoio/)**: Flightlogs e recursos

---

## 🔒 Segurança

- ✅ Row Level Security (RLS) em todas as tabelas
- ✅ Autenticação JWT via Supabase
- ✅ HTTPS enforced (Vercel)
- ✅ Validação de entrada (Zod)
- ✅ Sem secrets hardcoded
- ⚠️ Veja [Security_Assessment_Report.md](./Materiais%20de%20Apoio/Security_Assessment_Report.md) para detalhes

---

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📄 Licença

Projeto interno - Navita/Enghouse Systems

---

## 📞 Suporte

Para dúvidas ou problemas:
- Abra uma issue no GitHub
- Contate o time de desenvolvimento

---

**Desenvolvido com ❤️ pela equipe Navita**

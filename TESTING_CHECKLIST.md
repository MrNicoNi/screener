# Screener 2.0 - Manual Testing Checklist

## ✅ Completed Tests

### Authentication
- [x] Login com admin@screener.test
- [x] Login com avaliador@screener.test
- [x] Login com analista@screener.test
- [x] Logout funciona corretamente
- [x] Redirecionamento após login

### Dashboard
- [x] KPIs exibem dados corretos
- [x] Tabela de avaliações recentes carrega
- [x] Links para detalhes funcionam
- [x] Botão "Nova Auditoria" navega corretamente

### Nova Auditoria
- [x] Formulário carrega analistas
- [x] Cálculo de score em tempo real
- [x] Toggle crítico (auto-fail) funciona
- [x] Salvamento completo (evaluation + items)
- [x] Redirecionamento após salvar

---

## 🔄 Testes Pendentes

### ManageUsers (Admin)
- [x] Listar todos os usuários
- [x] Criar novo usuário via modal ✅ (Edge Function CORS corrigido 2026-01-24)
- [x] Validação de formulário (React Hook Form + Zod)
- [ ] Desativar usuário (soft delete)
- [x] Verificar que apenas admins acessam

### ManageTeams (Admin)
- [x] Listar todos os times
- [x] Criar novo time
- [x] Verificar que apenas admins acessam
- [x] Ver membros do time
- [x] Adicionar membros ao time
- [x] Remover membros do time
- [x] Contador de membros por time

### EvaluationDetail
- [x] Visualizar detalhes da avaliação ✅ (2026-01-24)
- [x] Exibir critérios avaliados
- [x] Botão "Reconhecer" para analistas
- [x] Atualização de status após reconhecimento

### DevMode Toggle
- [x] Trocar entre perfis (admin/evaluator/analyst) ✅ (2026-01-24)
- [x] Recarregar página após troca
- [x] Visível apenas em desenvolvimento

### RLS Policies & Route Protection
- [x] Admin vê todos os usuários
- [x] Analista vê apenas próprio perfil
- [x] Avaliador pode criar avaliações
- [x] Analista NÃO pode criar avaliações (bloqueado por EvaluatorRoute)
- [x] Analista NÃO acessa rotas /admin/* (bloqueado por AdminRoute)
- [x] Avaliador NÃO acessa rotas /admin/* (bloqueado por AdminRoute)
- [x] Botão "Nova Auditoria" oculto para analistas
- [x] Analista pode reconhecer próprias avaliações ✅ (2026-01-24)

---

## 🚀 Deployment Checklist

### Pré-Deploy
- [ ] Rodar testes RLS no Supabase
- [x] Verificar todas as variáveis de ambiente
- [x] Testar Edge Functions localmente
- [x] Build local sem erros (`npm run dev`)

### Deploy Vercel
- [ ] Criar repositório GitHub
- [ ] Push código para GitHub
- [ ] Conectar Vercel ao repositório
- [ ] Configurar variáveis de ambiente no Vercel
- [ ] Deploy inicial

### Pós-Deploy
- [ ] Testar login em produção
- [ ] Criar avaliação em produção
- [ ] Verificar que dados salvam corretamente
- [ ] Testar em mobile
- [ ] Smoke test completo

---

## 📋 Próximos Passos

1. ✅ ~~Testar páginas restantes~~ **CONCLUÍDO** (ManageTeams com gestão de membros)
2. ✅ ~~Implementar proteção de rotas~~ **CONCLUÍDO** (AdminRoute, EvaluatorRoute)
3. ✅ ~~Testar ManageUsers~~ **CONCLUÍDO** (Edge Function CORS corrigido 2026-01-24)
4. **Testar EvaluationDetail** (próximo)
5. **Rodar testes RLS** no Supabase
6. **Build local** para verificar erros
7. **Deploy para Vercel**
8. **Teste em produção**

---

**Status Atual**: ✅ Core funcional + Proteção de Rotas + Gestão de Times + Gestão de Usuários
**Próximo**: Testar EvaluationDetail e funcionalidade de "Reconhecer"


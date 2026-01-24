# Screener 2.0 - Email Templates Backlog

## 📧 Objetivo

Criar uma biblioteca de templates de email profissionais para diferentes cenários do sistema Screener.

---

## 🔄 Status: BACKLOG (Para Futuro)

---

## 📋 Templates Planejados

### 1. Notificação de Nova Avaliação (Atual)
- **Trigger:** Avaliador completa uma avaliação
- **Destinatário:** Analista avaliado
- **Status:** ✅ Implementado (básico)
- **Melhorias futuras:**
  - [ ] Adicionar logo Navita/Enghouse
  - [ ] Personalizar cores por status (excellent/approved/failed)
  - [ ] Adicionar gráfico visual do score
  - [ ] Incluir comparação com média do time

### 2. Lembrete de Ciência Pendente
- **Trigger:** X dias sem o analista confirmar ciência
- **Destinatário:** Analista
- **Status:** ❌ Não implementado
- **Conteúdo:**
  - Lembrete amigável
  - Link direto para a avaliação
  - Prazo para confirmar

### 3. Resumo Semanal para Gestores
- **Trigger:** Toda segunda-feira (automático)
- **Destinatário:** Admins/Gestores
- **Status:** ❌ Não implementado
- **Conteúdo:**
  - Total de avaliações da semana
  - Média de score por time
  - Top performers
  - Analistas com baixo desempenho

### 4. Boas-Vindas para Novos Usuários
- **Trigger:** Admin cria novo usuário
- **Destinatário:** Novo usuário
- **Status:** ❌ Não implementado
- **Conteúdo:**
  - Credenciais de acesso
  - Link para o sistema
  - Instruções iniciais

### 5. Alerta de Performance Baixa
- **Trigger:** Analista com score < 60% em 3+ avaliações seguidas
- **Destinatário:** Gestor do time + Analista
- **Status:** ❌ Não implementado
- **Conteúdo:**
  - Histórico recente
  - Áreas de melhoria identificadas
  - Sugestão de ação

---

## 🎨 Design Guidelines

### Cores da Marca
- **Navita Blue:** #0066FF
- **Navita Green:** #00D4AA
- **Approved:** #3B82F6
- **Failed:** #EF4444
- **Background:** #F5F7FA

### Estrutura Padrão
1. Header com gradiente azul/verde
2. Saudação personalizada
3. Conteúdo principal
4. CTA button (botão de ação)
5. Footer com copyright

### Responsividade
- Largura máxima: 600px
- Fonte segura: Arial, Segoe UI
- Botões: mínimo 44px de altura (mobile-friendly)

---

## 🔧 Implementação Técnica

### Arquivos Relacionados
- `supabase/functions/send-notification/index.ts` - Edge Function atual
- (Futuro) `src/lib/email-templates.js` - Biblioteca de templates

### Dependências
- SendGrid API (já configurado)
- Supabase Edge Functions

---

## 📝 Notas

- Prioridade: Baixa (funcionalidade core já implementada)
- Considerar: Usar ferramenta como MJML para templates responsivos
- Considerar: Permitir admin customizar templates via interface

---

*Criado em: 2026-01-24*
*Última atualização: 2026-01-24*

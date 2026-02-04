# 📧 Guia de Validação de Email - SendGrid

## 🎯 Objetivo

Este guia explica como validar se o sistema de envio de emails via SendGrid está funcionando corretamente no Screener 2.0.

## 📋 Pré-requisitos

### 1. Configuração do SendGrid no Supabase

A API Key do SendGrid deve estar configurada como secret no Supabase:

```bash
supabase secrets set SENDGRID_API_KEY=SG.sua-chave-aqui
```

### 2. Email Remetente Verificado

O email `navita.automation@enghouse.com` deve estar verificado no SendGrid.

### 3. Edge Functions Deployadas

As seguintes Edge Functions devem estar deployadas:
- `send-welcome-email` - Envia email de boas-vindas
- `send-notification` - Envia notificação de avaliação

## 🚀 Como Usar o Script de Teste

### Passo 1: Instalar Dependências

```bash
npm install dotenv
```

### Passo 2: Executar o Script

```bash
node test-email-sendgrid.js
```

### Passo 3: Fornecer Email de Teste

O script solicitará um email de teste. Use um email que você tenha acesso para verificar o recebimento.

```
Digite o email de teste: seu.email@exemplo.com
```

## 📊 O Que o Script Testa

### ✅ Teste 1: Configuração do SendGrid
- Verifica se a API Key está configurada
- Confirma que as Edge Functions estão respondendo

### ✅ Teste 2: Email de Boas-Vindas
- Envia um email de boas-vindas de teste
- Valida formatação HTML
- Confirma entrega

### ✅ Teste 3: Email de Notificação
- Envia um email de notificação de avaliação
- Testa todos os campos dinâmicos
- Confirma entrega

## 📈 Interpretando os Resultados

### ✅ Sucesso Total
```
Status Geral: ✅ TODOS OS TESTES PASSARAM

Configuração:
  SendGrid API Key: Configurada ✅
  Edge Functions: Respondendo ✅

Testes de Email:
  Welcome Email: Enviado ✅
  Notification Email: Enviado ✅
```

**Próximos passos:**
1. Verifique sua caixa de entrada
2. Confirme que os emails não foram para spam
3. Valide a formatação visual dos emails

### ❌ Falhas Comuns

#### API Key Não Configurada
```
❌ SendGrid API Key NÃO está configurada no Supabase!
```

**Solução:**
```bash
supabase secrets set SENDGRID_API_KEY=sua-chave
```

#### Edge Functions Não Respondendo
```
❌ Edge Function não está respondendo
```

**Solução:**
```bash
supabase functions deploy send-welcome-email
supabase functions deploy send-notification
```

#### Email Não Enviado (Status 400/500)
```
❌ Falha ao enviar email (Status: 400)
```

**Possíveis causas:**
1. Email remetente não verificado no SendGrid
2. API Key inválida ou expirada
3. Limite de envio atingido no SendGrid

## 🧪 Teste Manual via Interface

Além do script automatizado, você pode testar manualmente:

### 1. Teste de Email de Boas-Vindas

1. Acesse a página "Gerenciar Usuários"
2. Clique em "Novo Analista"
3. Preencha os dados com um email de teste
4. Clique em "Criar Usuário"
5. Verifique se o email chegou

### 2. Teste de Email de Notificação

1. Acesse "Nova Avaliação"
2. Crie uma avaliação para um analista
3. Submeta a avaliação
4. O analista deve receber um email de notificação

## 🔍 Verificando Logs no Supabase

Para diagnóstico avançado:

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Vá em **Edge Functions** > **Logs**
3. Filtre por `send-welcome-email` ou `send-notification`
4. Verifique erros e mensagens de debug

## 📧 Estrutura dos Emails

### Email de Boas-Vindas
- **Assunto:** 🎉 Bem-vindo ao Screener - Suas Credenciais de Acesso
- **Remetente:** Screener - Qualidade Navita (navita.automation@enghouse.com)
- **Conteúdo:**
  - Saudação personalizada
  - Badge de role (Admin/Avaliador/Analista)
  - Credenciais de acesso (email + senha temporária)
  - Instruções de primeiro acesso
  - Botão CTA para login

### Email de Notificação
- **Assunto:** 📊 Nova Avaliação Disponível - Ticket [ID]
- **Remetente:** Screener - Qualidade Navita (navita.automation@enghouse.com)
- **Conteúdo:**
  - Informações do ticket
  - Score final
  - Feedback do avaliador
  - Botão CTA para visualizar avaliação

## 🛠️ Troubleshooting

### Emails indo para Spam

**Soluções:**
1. Verifique SPF/DKIM no SendGrid
2. Adicione `navita.automation@enghouse.com` aos contatos
3. Marque como "Não é spam" no primeiro email

### Emails não chegando

**Checklist:**
1. ✅ API Key configurada no Supabase?
2. ✅ Email remetente verificado no SendGrid?
3. ✅ Edge Functions deployadas?
4. ✅ Logs do Supabase mostram sucesso?
5. ✅ Verificou a pasta de spam?

### Formatação HTML quebrada

**Possíveis causas:**
1. Cliente de email não suporta CSS inline
2. Imagens bloqueadas
3. Dark mode do cliente de email

**Teste em múltiplos clientes:**
- Gmail (web)
- Outlook (web)
- Apple Mail
- Gmail (mobile)

## 📞 Suporte

Se os problemas persistirem:

1. Verifique os logs detalhados no Supabase
2. Teste diretamente na API do SendGrid
3. Verifique o status do SendGrid: https://status.sendgrid.com/
4. Revise as quotas da sua conta SendGrid

## 🔐 Segurança

**IMPORTANTE:**
- Nunca commite a API Key do SendGrid no Git
- Mantenha as credenciais apenas no Supabase Secrets
- Rotacione a API Key periodicamente
- Use emails de teste para validação, não emails de clientes reais

---

**Última atualização:** 30/01/2026
**Versão:** 1.0

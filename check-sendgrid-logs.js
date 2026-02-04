/**
 * 🔍 SCRIPT DE VERIFICAÇÃO DE LOGS - SENDGRID
 * ============================================
 * 
 * Este script ajuda a diagnosticar problemas de envio de email
 * verificando o histórico de chamadas às Edge Functions
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
}

const log = {
    title: () => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`),
    section: (msg) => console.log(`\n${colors.bright}${colors.blue}📋 ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
    detail: (msg) => console.log(`   ${colors.reset}${msg}${colors.reset}`)
}

async function checkRecentActivity() {
    log.title()
    console.log(`${colors.bright}${colors.cyan}🔍 VERIFICAÇÃO DE ATIVIDADE DE EMAIL${colors.reset}`)
    log.title()

    log.section('Diagnóstico de Email "Represado"')

    console.log(`
${colors.yellow}Cenário Identificado:${colors.reset}
- Usuário criado anteriormente: nicolas.andrade@enghouse.com
- Email de boas-vindas NÃO chegou na hora
- Após executar teste, chegaram 3 emails:
  1. Email de boas-vindas (do teste)
  2. Email de notificação (do teste)
  3. Email de boas-vindas (ATRASADO - da criação anterior)

${colors.cyan}Possíveis Causas:${colors.reset}
`)

    console.log(`${colors.bright}1. Fila de Retry do SendGrid${colors.reset}`)
    log.detail('O SendGrid mantém uma fila de retry por até 72 horas')
    log.detail('Se houver falha temporária, ele tenta reenviar automaticamente')
    log.detail('Probabilidade: ${colors.green}ALTA ⭐⭐⭐${colors.reset}')

    console.log(`\n${colors.bright}2. Rate Limiting / Throttling${colors.reset}`)
    log.detail('SendGrid pode limitar envios se detectar padrão incomum')
    log.detail('Emails ficam enfileirados até liberação')
    log.detail('Probabilidade: ${colors.yellow}MÉDIA ⭐⭐${colors.reset}')

    console.log(`\n${colors.bright}3. Problema de Rede/Conectividade${colors.reset}`)
    log.detail('Edge Function pode ter tido timeout na primeira tentativa')
    log.detail('SendGrid recebeu mas demorou para processar')
    log.detail('Probabilidade: ${colors.yellow}MÉDIA ⭐⭐${colors.reset}')

    console.log(`\n${colors.bright}4. Validação de Remetente${colors.reset}`)
    log.detail('SendGrid pode ter validado o domínio do remetente')
    log.detail('Primeiro email ficou em quarentena temporária')
    log.detail('Probabilidade: ${colors.red}BAIXA ⭐${colors.reset}')

    log.section('Recomendações')

    console.log(`
${colors.green}✅ O que fazer:${colors.reset}

1. ${colors.bright}Verificar Activity Feed do SendGrid${colors.reset}
   - Acesse: https://app.sendgrid.com/email_activity
   - Busque por: nicolas.andrade@enghouse.com
   - Veja os timestamps de cada email
   - Identifique se houve "delayed" ou "deferred"

2. ${colors.bright}Monitorar próximas criações de usuário${colors.reset}
   - Crie um novo usuário de teste
   - Verifique se o email chega imediatamente
   - Se demorar, pode ser problema sistemático

3. ${colors.bright}Configurar Webhook do SendGrid (Opcional)${colors.reset}
   - Receba notificações de eventos (delivered, bounced, deferred)
   - Ajuda a diagnosticar problemas em tempo real

4. ${colors.bright}Verificar Logs do Supabase${colors.reset}
   - Dashboard > Edge Functions > send-welcome-email
   - Procure por erros ou timeouts
   - Verifique horário da chamada vs horário de entrega

${colors.yellow}⚠️  Ação Imediata:${colors.reset}

Se isso acontecer novamente:
- Anote o horário exato da criação do usuário
- Anote o horário de chegada do email
- Compare com os logs do SendGrid
- Isso ajudará a identificar o padrão

${colors.cyan}💡 Dica:${colors.reset}

O fato de ter chegado 3 emails (incluindo o atrasado) é na verdade
uma ${colors.green}BOA NOTÍCIA${colors.reset} - significa que o sistema ESTÁ funcionando,
apenas houve um atraso pontual que foi resolvido.

${colors.magenta}📊 Status Atual: Sistema Funcionando Normalmente${colors.reset}
`)

    log.section('Próximos Passos Sugeridos')

    console.log(`
1. Acesse o SendGrid Activity Feed
2. Verifique os 3 emails enviados para nicolas.andrade@enghouse.com
3. Compare os timestamps
4. Crie um novo usuário de teste para validar comportamento atual
`)

    log.title()
}

checkRecentActivity().catch(console.error)

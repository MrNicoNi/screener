/**
 * 📧 SCRIPT DE VALIDAÇÃO DE EMAIL - SENDGRID
 * ==========================================
 * 
 * Este script testa as Edge Functions de envio de email do Screener 2.0
 * 
 * FUNÇÕES TESTADAS:
 * 1. send-welcome-email - Email de boas-vindas para novos usuários
 * 2. send-notification - Notificação de novas avaliações
 * 
 * REQUISITOS:
 * - Supabase URL e ANON_KEY configurados no .env
 * - SendGrid API Key configurada no Supabase (secrets)
 * - Edge Functions deployadas no Supabase
 * 
 * USO:
 * node test-email-sendgrid.js
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Carregar variáveis de ambiente
dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

// Cores para output no console
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

// Funções auxiliares
const log = {
    title: (msg) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`),
    section: (msg) => console.log(`\n${colors.bright}${colors.blue}📋 ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
    detail: (msg) => console.log(`   ${colors.reset}${msg}${colors.reset}`)
}

// Validar configuração
function validateConfig() {
    log.section('Validando Configuração')

    if (!SUPABASE_URL) {
        log.error('VITE_SUPABASE_URL não encontrada no .env')
        return false
    }
    log.success(`Supabase URL: ${SUPABASE_URL}`)

    if (!SUPABASE_ANON_KEY) {
        log.error('VITE_SUPABASE_ANON_KEY não encontrada no .env')
        return false
    }
    log.success('Supabase ANON_KEY configurada')

    return true
}

// Teste 1: Email de Boas-Vindas
async function testWelcomeEmail(testEmail) {
    log.section('TESTE 1: Email de Boas-Vindas (send-welcome-email)')

    try {
        const payload = {
            userEmail: testEmail,
            userName: 'Teste Automático',
            userPassword: 'Temp@123',
            userRole: 'analyst'
        }

        log.info('Enviando requisição para Edge Function...')
        log.detail(`Destinatário: ${testEmail}`)
        log.detail(`Nome: ${payload.userName}`)
        log.detail(`Role: ${payload.userRole}`)

        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-welcome-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(payload)
        })

        const responseText = await response.text()
        let responseData

        try {
            responseData = JSON.parse(responseText)
        } catch (e) {
            responseData = { raw: responseText }
        }

        log.detail(`Status HTTP: ${response.status}`)

        if (response.ok) {
            log.success('Email de boas-vindas enviado com sucesso!')
            log.detail(`Resposta: ${JSON.stringify(responseData, null, 2)}`)
            return {
                success: true,
                status: response.status,
                data: responseData
            }
        } else {
            log.error(`Falha ao enviar email (Status: ${response.status})`)
            log.detail(`Erro: ${JSON.stringify(responseData, null, 2)}`)
            return {
                success: false,
                status: response.status,
                error: responseData
            }
        }

    } catch (error) {
        log.error(`Erro na requisição: ${error.message}`)
        log.detail(`Stack: ${error.stack}`)
        return {
            success: false,
            error: error.message
        }
    }
}

// Teste 2: Email de Notificação
async function testNotificationEmail(testEmail) {
    log.section('TESTE 2: Email de Notificação (send-notification)')

    try {
        const payload = {
            evaluationId: 'test-eval-001',
            analystEmail: testEmail,
            analystName: 'Teste Automático',
            ticketId: 'TICKET-12345',
            finalScore: 85,
            feedback: 'Este é um teste automático do sistema de notificações.'
        }

        log.info('Enviando requisição para Edge Function...')
        log.detail(`Destinatário: ${testEmail}`)
        log.detail(`Ticket: ${payload.ticketId}`)
        log.detail(`Score: ${payload.finalScore}`)

        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(payload)
        })

        const responseText = await response.text()
        let responseData

        try {
            responseData = JSON.parse(responseText)
        } catch (e) {
            responseData = { raw: responseText }
        }

        log.detail(`Status HTTP: ${response.status}`)

        if (response.ok) {
            log.success('Email de notificação enviado com sucesso!')
            log.detail(`Resposta: ${JSON.stringify(responseData, null, 2)}`)
            return {
                success: true,
                status: response.status,
                data: responseData
            }
        } else {
            log.error(`Falha ao enviar email (Status: ${response.status})`)
            log.detail(`Erro: ${JSON.stringify(responseData, null, 2)}`)
            return {
                success: false,
                status: response.status,
                error: responseData
            }
        }

    } catch (error) {
        log.error(`Erro na requisição: ${error.message}`)
        log.detail(`Stack: ${error.stack}`)
        return {
            success: false,
            error: error.message
        }
    }
}

// Teste 3: Verificar configuração do SendGrid no Supabase
async function checkSendGridConfig() {
    log.section('TESTE 3: Verificação de Configuração SendGrid')

    log.info('Tentando enviar email com dados inválidos para testar configuração...')

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-welcome-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                userEmail: '',
                userName: '',
                userPassword: ''
            })
        })

        const responseText = await response.text()
        let responseData

        try {
            responseData = JSON.parse(responseText)
        } catch (e) {
            responseData = { raw: responseText }
        }

        // Se receber erro de campos obrigatórios, significa que a função está rodando
        if (responseData.error && responseData.error.includes('Missing required fields')) {
            log.success('Edge Function está respondendo corretamente')
            return { configured: true, responding: true }
        }

        // Se receber erro de API Key, significa que não está configurada
        if (responseData.error && responseData.error.includes('SendGrid API key not configured')) {
            log.error('SendGrid API Key NÃO está configurada no Supabase!')
            log.warning('Configure com: supabase secrets set SENDGRID_API_KEY=sua-chave')
            return { configured: false, responding: true }
        }

        log.info('Resposta inesperada, mas função está respondendo')
        log.detail(`Resposta: ${JSON.stringify(responseData, null, 2)}`)
        return { configured: 'unknown', responding: true }

    } catch (error) {
        log.error(`Edge Function não está respondendo: ${error.message}`)
        log.warning('Verifique se as Edge Functions estão deployadas')
        return { configured: 'unknown', responding: false }
    }
}

// Relatório Final
function generateReport(results) {
    log.title()
    console.log(`${colors.bright}${colors.magenta}📊 RELATÓRIO DE VALIDAÇÃO DE EMAIL${colors.reset}`)
    log.title()

    const { config, welcomeEmail, notificationEmail } = results

    // Status geral
    const allPassed = config.configured &&
        config.responding &&
        welcomeEmail.success &&
        notificationEmail.success

    console.log(`\n${colors.bright}Status Geral: ${allPassed ? colors.green + '✅ TODOS OS TESTES PASSARAM' : colors.red + '❌ ALGUNS TESTES FALHARAM'}${colors.reset}\n`)

    // Detalhes
    console.log(`${colors.bright}Configuração:${colors.reset}`)
    console.log(`  SendGrid API Key: ${config.configured ? colors.green + 'Configurada ✅' : colors.red + 'Não Configurada ❌'}${colors.reset}`)
    console.log(`  Edge Functions: ${config.responding ? colors.green + 'Respondendo ✅' : colors.red + 'Não Respondendo ❌'}${colors.reset}`)

    console.log(`\n${colors.bright}Testes de Email:${colors.reset}`)
    console.log(`  Welcome Email: ${welcomeEmail.success ? colors.green + 'Enviado ✅' : colors.red + 'Falhou ❌'}${colors.reset}`)
    if (welcomeEmail.status) console.log(`    Status: ${welcomeEmail.status}`)

    console.log(`  Notification Email: ${notificationEmail.success ? colors.green + 'Enviado ✅' : colors.red + 'Falhou ❌'}${colors.reset}`)
    if (notificationEmail.status) console.log(`    Status: ${notificationEmail.status}`)

    // Próximos passos
    if (!allPassed) {
        console.log(`\n${colors.bright}${colors.yellow}📝 Próximos Passos:${colors.reset}`)

        if (!config.configured) {
            console.log(`  1. Configure a SendGrid API Key no Supabase:`)
            console.log(`     ${colors.cyan}supabase secrets set SENDGRID_API_KEY=sua-chave${colors.reset}`)
        }

        if (!config.responding) {
            console.log(`  2. Faça deploy das Edge Functions:`)
            console.log(`     ${colors.cyan}supabase functions deploy send-welcome-email${colors.reset}`)
            console.log(`     ${colors.cyan}supabase functions deploy send-notification${colors.reset}`)
        }

        if (!welcomeEmail.success || !notificationEmail.success) {
            console.log(`  3. Verifique os logs no Supabase Dashboard`)
            console.log(`  4. Confirme que o email remetente está verificado no SendGrid`)
            console.log(`     Remetente: navita.automation@enghouse.com`)
        }
    } else {
        console.log(`\n${colors.bright}${colors.green}🎉 Sistema de Email Totalmente Funcional!${colors.reset}`)
        console.log(`\n${colors.cyan}Próximos passos recomendados:${colors.reset}`)
        console.log(`  1. Verifique a caixa de entrada do email de teste`)
        console.log(`  2. Confirme que os emails não foram para spam`)
        console.log(`  3. Valide a formatação HTML dos emails`)
        console.log(`  4. Teste criar um usuário real pela interface`)
    }

    log.title()
}

// Função principal
async function main() {
    console.clear()
    log.title()
    console.log(`${colors.bright}${colors.cyan}📧 VALIDAÇÃO DE EMAIL - SENDGRID${colors.reset}`)
    console.log(`${colors.cyan}Screener 2.0 - Sistema de Qualidade Navita${colors.reset}`)
    log.title()

    // Validar configuração
    if (!validateConfig()) {
        log.error('Configuração inválida. Abortando testes.')
        process.exit(1)
    }

    // Solicitar email de teste
    console.log(`\n${colors.bright}${colors.yellow}⚠️  ATENÇÃO:${colors.reset}`)
    console.log(`Este script enviará emails reais para o endereço fornecido.`)
    console.log(`Use um email de teste que você tenha acesso.\n`)

    const readline = await import('readline')
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    const testEmail = await new Promise((resolve) => {
        rl.question(`${colors.cyan}Digite o email de teste: ${colors.reset}`, (answer) => {
            rl.close()
            resolve(answer.trim())
        })
    })

    if (!testEmail || !testEmail.includes('@')) {
        log.error('Email inválido. Abortando.')
        process.exit(1)
    }

    log.info(`Email de teste: ${testEmail}`)

    // Executar testes
    const results = {
        config: await checkSendGridConfig(),
        welcomeEmail: await testWelcomeEmail(testEmail),
        notificationEmail: await testNotificationEmail(testEmail)
    }

    // Gerar relatório
    generateReport(results)

    console.log(`\n${colors.cyan}Teste concluído em: ${new Date().toLocaleString('pt-BR')}${colors.reset}\n`)
}

// Executar
main().catch(error => {
    log.error(`Erro fatal: ${error.message}`)
    console.error(error)
    process.exit(1)
})

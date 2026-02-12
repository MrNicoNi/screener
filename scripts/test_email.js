import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
const envPath = path.resolve(__dirname, '../.env')
const envContent = fs.readFileSync(envPath, 'utf8')

const getEnvParam = (name) => {
    const match = envContent.match(new RegExp(`^#?\\s*${name}=(.*)$`, 'm'))
    return match ? match[1].trim() : null
}

const SUPABASE_URL = getEnvParam('VITE_SUPABASE_URL')
const ANON_KEY = getEnvParam('VITE_SUPABASE_ANON_KEY')

if (!SUPABASE_URL || !ANON_KEY) {
    console.error('Error: Could not find Supabase credentials in .env')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, ANON_KEY)

async function testEmail() {
    console.log('📧 Testing SendGrid Email Delivery...\n')

    // Test data
    const testData = {
        evaluationId: 'test-' + Date.now(),
        analystEmail: 'nicolalelilolu@gmail.com',
        analystName: 'Nicolas (Teste)',
        ticketId: 'TEST-' + Math.floor(Math.random() * 10000),
        finalScore: 85.5,
        feedback: 'Este é um email de teste do sistema ScreenerQA. Se você recebeu este email, significa que a integração com SendGrid está funcionando corretamente! 🎉'
    }

    console.log('📋 Test Data:')
    console.log(`   Email: ${testData.analystEmail}`)
    console.log(`   Ticket: ${testData.ticketId}`)
    console.log(`   Score: ${testData.finalScore}%\n`)

    try {
        // Call Edge Function
        const { data, error } = await supabase.functions.invoke('send-notification', {
            body: testData
        })

        if (error) {
            console.error('❌ Error calling Edge Function:', error)
            process.exit(1)
        }

        console.log('✅ Edge Function Response:', data)
        console.log('\n📬 Email sent successfully!')
        console.log(`   Check inbox: ${testData.analystEmail}`)
        console.log('   Subject: 📋 Nova Avaliação - Ticket #' + testData.ticketId)
        console.log('\n⚠️  If you don\'t receive the email:')
        console.log('   1. Check spam folder')
        console.log('   2. Verify SendGrid API key in Supabase secrets')
        console.log('   3. Check Supabase Edge Function logs')

    } catch (err) {
        console.error('❌ Unexpected error:', err)
        process.exit(1)
    }

    process.exit(0)
}

testEmail()

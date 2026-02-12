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

async function testWelcomeEmail() {
    console.log('🎉 Testing Welcome Email (New User)...\n')

    // Test data
    const testData = {
        userEmail: 'nicolalelilolu@gmail.com',
        userName: 'Nicolas Oliveira',
        userPassword: 'Enghouse@2025',
        userRole: 'analyst' // Options: admin, evaluator, analyst
    }

    console.log('📋 Test Data:')
    console.log(`   Email: ${testData.userEmail}`)
    console.log(`   Name: ${testData.userName}`)
    console.log(`   Role: ${testData.userRole}`)
    console.log(`   Temporary Password: ${testData.userPassword}\n`)

    try {
        // Call Edge Function
        const { data, error } = await supabase.functions.invoke('send-welcome-email', {
            body: testData
        })

        if (error) {
            console.error('❌ Error calling Edge Function:', error)
            process.exit(1)
        }

        console.log('✅ Edge Function Response:', data)
        console.log('\n📬 Welcome email sent successfully!')
        console.log(`   Check inbox: ${testData.userEmail}`)
        console.log('   Subject: 🎉 Bem-vindo ao Screener - Suas Credenciais de Acesso')
        console.log('\n📧 Email should contain:')
        console.log('   ✓ Logo Enghouse')
        console.log('   ✓ Welcome message')
        console.log('   ✓ User credentials (email + password)')
        console.log('   ✓ Role badge (Analista)')
        console.log('   ✓ First access instructions')
        console.log('   ✓ "Acessar o Sistema" button')

    } catch (err) {
        console.error('❌ Unexpected error:', err)
        process.exit(1)
    }

    process.exit(0)
}

testWelcomeEmail()

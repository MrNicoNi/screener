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

async function testPasswordReset() {
    console.log('🔑 Testing Password Reset Email...\n')

    const testEmail = 'nicolalelilolu@gmail.com'

    console.log('📋 Test Data:')
    console.log(`   Email: ${testEmail}`)
    console.log(`   Flow: "Esqueci minha senha" (Forgot Password)\n`)

    try {
        // Trigger password reset email (Supabase native)
        const { error } = await supabase.auth.resetPasswordForEmail(testEmail, {
            redirectTo: 'https://screenerqa.vercel.app/reset-password'
        })

        if (error) {
            console.error('❌ Error triggering password reset:', error)
            process.exit(1)
        }

        console.log('✅ Password reset email triggered successfully!')
        console.log(`\n📬 Email sent to: ${testEmail}`)
        console.log('   Subject: Reset Your Password (Supabase default)')
        console.log('\n📧 Email should contain:')
        console.log('   ✓ Password reset link')
        console.log('   ✓ Link expires in 1 hour')
        console.log('   ✓ Redirects to: https://screenerqa.vercel.app/reset-password')
        console.log('\n⚠️  Note:')
        console.log('   - This uses Supabase\'s native email template')
        console.log('   - To customize, configure in Supabase Dashboard → Authentication → Email Templates')
        console.log('   - Check spam folder if not received')

    } catch (err) {
        console.error('❌ Unexpected error:', err)
        process.exit(1)
    }

    process.exit(0)
}

testPasswordReset()

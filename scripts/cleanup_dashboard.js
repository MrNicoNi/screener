
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables manually
const envPath = path.resolve(__dirname, '../.env')
const envContent = fs.readFileSync(envPath, 'utf8')

const getEnvParam = (name) => {
    const match = envContent.match(new RegExp(`^#?\\s*${name}=(.*)$`, 'm'))
    return match ? match[1].trim() : null
}

const SUPABASE_URL = getEnvParam('VITE_SUPABASE_URL')
const SERVICE_ROLE_KEY = getEnvParam('VITE_SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Error: Could not find VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const PROTECTED_EMAILS = [
    'admin@screener.test',
    'avaliador@screener.test',
    'analista@screener.test'
]

async function cleanup() {
    console.log('🧹 Starting cleanup process...')

    // 1. Find all users with @screener.test domain
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
        console.error('Error listing users:', listError)
        process.exit(1)
    }

    const usersToDelete = users.filter(u =>
        u.email.endsWith('@screener.test') &&
        !PROTECTED_EMAILS.includes(u.email)
    )

    if (usersToDelete.length === 0) {
        console.log('No seed users found to delete.')
        process.exit(0)
    }

    console.log(`Found ${usersToDelete.length} users to delete:`)
    usersToDelete.forEach(u => console.log(` - ${u.email}`))

    // 2. Delete all evaluations for these users (both as analyst and evaluator)
    console.log('\nDeleting evaluations...')
    const userIds = usersToDelete.map(u => u.id)

    const { error: evalAnalystError } = await supabase
        .from('evaluations')
        .delete()
        .in('analyst_id', userIds)

    if (evalAnalystError) {
        console.error('Error deleting evaluations (analyst):', evalAnalystError)
    } else {
        console.log('✅ Deleted evaluations where users were analysts')
    }

    const { error: evalEvaluatorError } = await supabase
        .from('evaluations')
        .delete()
        .in('evaluator_id', userIds)

    if (evalEvaluatorError) {
        console.error('Error deleting evaluations (evaluator):', evalEvaluatorError)
    } else {
        console.log('✅ Deleted evaluations where users were evaluators')
    }

    // 3. Delete users from public.users and auth.users
    console.log('\nDeleting users...')
    for (const user of usersToDelete) {
        console.log(`Processing ${user.email}...`)

        // Delete from public.users
        const { error: publicError } = await supabase.from('users').delete().eq('id', user.id)
        if (publicError) {
            console.error(`  ❌ Error deleting public profile:`, publicError.message)
        } else {
            console.log(`  ✅ Deleted from public.users`)
        }

        // Delete from auth.users
        const { error: authError } = await supabase.auth.admin.deleteUser(user.id)
        if (authError) {
            console.error(`  ❌ Error deleting auth user:`, authError.message)
        } else {
            console.log(`  ✅ Deleted from auth.users`)
        }
    }

    console.log('\n🧹 Cleanup completed!')
    process.exit(0)
}

cleanup().catch(err => {
    console.error('Unexpected error:', err)
    process.exit(1)
})

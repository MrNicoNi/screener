
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables manually to get the commented out Service Role Key
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

const TEAMS = {
    'Suporte Nível 1': ['analista.n1.demo1@screener.test', 'analista.n1.demo2@screener.test'],
    'Suporte Nível 2': ['analista.n2.demo1@screener.test', 'analista.n2.demo2@screener.test']
}

const ANALYSTS_CONFIG = [
    { email: 'analista.n1.demo1@screener.test', name: 'Ana Nível 1', team: 'Suporte Nível 1' },
    { email: 'analista.n1.demo2@screener.test', name: 'Bruno Nível 1', team: 'Suporte Nível 1' },
    { email: 'analista.n2.demo1@screener.test', name: 'Carla Nível 2', team: 'Suporte Nível 2' },
    { email: 'analista.n2.demo2@screener.test', name: 'Daniel Nível 2', team: 'Suporte Nível 2' }
]

async function seed() {
    console.log('🌱 Starting seed process...')

    // 1. Get Admin User (as Evaluator)
    const { data: { users: admins } } = await supabase.auth.admin.listUsers()
    const adminUser = admins.find(u => u.email === 'admin@screener.test')
    
    if (!adminUser) {
        console.error('Error: admin@screener.test not found. Please run the initial setup first.')
        process.exit(1)
    }
    console.log('✅ Evaluator found:', adminUser.email)

    // 2. Get Teams
    const { data: teamsData } = await supabase.from('teams').select('id, name')
    const teamMap = {}
    teamsData.forEach(t => teamMap[t.name] = t.id)

    // 3. Create or Update Analysts
    const createdAnalysts = []

    for (const config of ANALYSTS_CONFIG) {
        const teamId = teamMap[config.team]
        if (!teamId) {
            console.warn(`⚠️ Team ${config.team} not found, skipping ${config.email}`)
            continue
        }

        // Create Auth User
        console.log(`Creating user ${config.email}...`)
        const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
            email: config.email,
            password: 'Test123!',
            email_confirm: true
        }).catch(() => ({ data: { user: null } })) // Ignore if exists

        let userId = user?.id

        if (createError && createError.message.includes('already been registered')) {
             // Fetch existing if create failed
             const { data: { users } } = await supabase.auth.admin.listUsers()
             const existing = users.find(u => u.email === config.email)
             userId = existing.id
             console.log(`User ${config.email} already exists.`)
        } else if (createError) {
             console.error(`Error creating auth user ${config.email}:`, createError)
             continue
        }

        // Create Public Profile
        const { error: profileError } = await supabase.from('users').upsert({
            id: userId,
            email: config.email,
            name: config.name,
            role: 'analyst',
            team_id: teamId,
            is_active: true
        })

        if (profileError) {
            console.error(`Error creating profile for ${config.email}:`, profileError)
        } else {
            createdAnalysts.push(userId)
            console.log(`✅ User ${config.email} ready.`)
        }
    }

    // 4. Generate Evaluations
    console.log('Generating evaluations...')
    const EVALUATIONS_COUNT = 60
    const evaluations = []

    for (let i = 0; i < EVALUATIONS_COUNT; i++) {
        const analystId = createdAnalysts[Math.floor(Math.random() * createdAnalysts.length)]
        const daysAgo = Math.floor(Math.random() * 30)
        const date = new Date()
        date.setDate(date.getDate() - daysAgo)

        // Random Score Logic
        const rand = Math.random()
        let score, status, criticalPass = true
        
        if (rand > 0.8) { // 20% Excellent
            score = 90 + Math.random() * 10
            status = 'excellent'
        } else if (rand > 0.3) { // 50% Approved
            score = 75 + Math.random() * 14
            status = 'approved'
        } else { // 30% Failed
            score = 50 + Math.random() * 24
            status = 'failed'
            if (Math.random() > 0.5) criticalPass = false // Half of failures are critical
        }

        if (!criticalPass) {
             score = 0
             status = 'failed'
        }

        evaluations.push({
            analyst_id: analystId,
            evaluator_id: adminUser.id,
            ticket_id: `TKT-${Math.floor(1000 + Math.random() * 9000)}-${i}`,
            final_score: score.toFixed(2),
            status: status,
            analyst_acknowledged: Math.random() > 0.5,
            feedback: 'Generated by Seed Script',
            created_at: date.toISOString(),
            updated_at: date.toISOString()
        })
    }

    const { error: evalError } = await supabase.from('evaluations').insert(evaluations)
    if (evalError) {
         console.error('Error inserting evaluations:', evalError)
    } else {
         console.log(`✅ Successfully created ${EVALUATIONS_COUNT} evaluations.`)
    }

    console.log('🌱 Seed process completed!')
    process.exit(0)
}

seed().catch(err => {
    console.error('Unexpected error:', err)
    process.exit(1)
})

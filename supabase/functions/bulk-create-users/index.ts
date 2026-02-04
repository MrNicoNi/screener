
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight FIRST
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing Authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        console.log('🔍 [BULK] Auth header received:', authHeader?.substring(0, 20) + '...')

        // Create Supabase client with user's auth token
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        console.log('🔍 [BULK] Validating JWT...')

        // Validate user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        console.log('🔍 [BULK] Auth result:', {
            hasUser: !!user,
            userEmail: user?.email,
            error: authError?.message
        })

        if (authError || !user) {
            console.error('❌ [BULK] Auth failed:', authError)
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('✅ [BULK] User authenticated:', user.email)

        // Check if user is admin
        const { data: userProfile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        console.log('🔍 [BULK] User role:', userProfile?.role)

        if (userProfile?.role !== 'admin') {
            console.error('❌ [BULK] User is not admin')
            return new Response(
                JSON.stringify({ error: 'Only administrators can manage users' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Parse request body
        const { users } = await req.json()

        if (!users || !Array.isArray(users)) {
            return new Response(
                JSON.stringify({ error: 'Invalid input: users must be an array' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
        const results = []

        for (const userData of users) {
            try {
                // simple validation
                if (!userData.email || !userData.password || !userData.role || !userData.name) {
                    results.push({ email: userData.email, success: false, error: 'Missing required fields' })
                    continue
                }

                if (!['admin', 'evaluator', 'analyst'].includes(userData.role)) {
                    results.push({ email: userData.email, success: false, error: 'Invalid role' })
                    continue
                }

                // Create user in auth.users
                const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email: userData.email,
                    password: userData.password,
                    email_confirm: true,
                    user_metadata: { name: userData.name }
                })

                if (createError) {
                    results.push({ email: userData.email, success: false, error: createError.message })
                    continue
                }

                // Create user profile
                const { error: profileError } = await supabaseAdmin
                    .from('users')
                    .insert({
                        id: newUser.user.id,
                        email: userData.email,
                        name: userData.name,
                        role: userData.role,
                        team_id: userData.teamId || null,
                        must_change_password: true  // Force password change on first login
                    })

                if (profileError) {
                    // Rollback: delete auth user
                    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
                    results.push({ email: userData.email, success: false, error: `Profile error: ${profileError.message}` })
                    continue
                }

                results.push({ email: userData.email, success: true, userId: newUser.user.id })

            } catch (err) {
                results.push({ email: userData.email, success: false, error: String(err) })
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                results: results
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: String(error) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

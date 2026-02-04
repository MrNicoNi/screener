// Use JSR registry instead of ESM.sh
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

        // Create Supabase client with user's auth token
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        // Validate user is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Check if user is admin
        const { data: userProfile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (userProfile?.role !== 'admin') {
            return new Response(
                JSON.stringify({ error: 'Only administrators can manage users' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Parse request body
        const { name, email, password, role, teamId } = await req.json()

        // Validate input
        if (!name || !email || !password || !role) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: name, email, password, role' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!['admin', 'evaluator', 'analyst'].includes(role)) {
            return new Response(
                JSON.stringify({ error: 'Invalid role. Must be: admin, evaluator, or analyst' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create user in auth.users using admin client
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        })

        if (createError) {
            return new Response(
                JSON.stringify({ error: createError.message }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create user profile
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert({
                id: newUser.user.id,
                email,
                name,
                role,
                team_id: teamId || null,
                must_change_password: true  // Force password change on first login
            })

        if (profileError) {
            // Rollback: delete auth user
            await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
            return new Response(
                JSON.stringify({ error: `Profile creation failed: ${profileError.message}` }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Send welcome email (non-blocking - don't fail user creation if email fails)
        try {
            const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
            await fetch(`${SUPABASE_URL}/functions/v1/send-welcome-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader
                },
                body: JSON.stringify({
                    userEmail: email,
                    userName: name,
                    userPassword: password,
                    userRole: role
                })
            })
            console.log('[manage-users] Welcome email sent to:', email)
        } catch (emailError) {
            // Log but don't fail user creation
            console.error('[manage-users] Welcome email failed:', emailError)
        }

        return new Response(
            JSON.stringify({
                success: true,
                userId: newUser.user.id,
                message: 'User created successfully'
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

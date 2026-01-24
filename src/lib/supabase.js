import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: window.sessionStorage,  // ✅ No stale data issues
        autoRefreshToken: true,
        persistSession: true
    }
})

/**
 * Helper function to verify that a write operation actually succeeded
 * Prevents silent RLS failures where Supabase returns "success" but DB unchanged
 */
export async function verifyWrite(table, id, field, expectedValue) {
    const { data, error } = await supabase
        .from(table)
        .select(field)
        .eq('id', id)
        .single()

    if (error) {
        throw new Error(`Verification query failed: ${error.message}`)
    }

    if (data[field] !== expectedValue) {
        throw new Error(`Write verification failed: ${field} = "${data[field]}" but expected "${expectedValue}"`)
    }

    return true
}

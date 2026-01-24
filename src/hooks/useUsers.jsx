import { useState, useEffect } from 'react'
import { supabase, verifyWrite } from '../lib/supabase'

export function useUsers() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchUsers()
    }, [])

    async function fetchUsers() {
        try {
            setLoading(true)
            setError(null)

            const { data, error: fetchError } = await supabase
                .from('users')
                .select('*, team:teams(id, name)')
                .order('name')

            if (fetchError) throw fetchError
            setUsers(data || [])
        } catch (err) {
            console.error('[useUsers] Fetch failed:', err.message)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function createUser(userData) {
        try {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                throw new Error('Not authenticated')
            }

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(userData)
                }
            )

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create user')
            }

            await fetchUsers()
            return result
        } catch (err) {
            console.error('[useUsers] Create failed:', err.message)
            throw err
        }
    }

    async function updateUser(id, updates) {
        try {
            // 1. Attempt update
            const { error: updateError } = await supabase
                .from('users')
                .update(updates)
                .eq('id', id)

            if (updateError) throw updateError

            // 2. ✅ VERIFY write succeeded (prevents silent RLS failures)
            if (updates.name) {
                await verifyWrite('users', id, 'name', updates.name)
            }

            // 3. Refresh list
            await fetchUsers()
        } catch (err) {
            console.error('[useUsers] Update failed:', err.message)
            throw err
        }
    }

    async function deleteUser(id) {
        try {
            // Soft delete
            await updateUser(id, { is_active: false })
        } catch (err) {
            console.error('[useUsers] Delete failed:', err.message)
            throw err
        }
    }

    async function assignUserToTeam(userId, teamId) {
        try {
            await updateUser(userId, { team_id: teamId })
        } catch (err) {
            console.error('[useUsers] Assign to team failed:', err.message)
            throw err
        }
    }

    async function removeUserFromTeam(userId) {
        try {
            await updateUser(userId, { team_id: null })
        } catch (err) {
            console.error('[useUsers] Remove from team failed:', err.message)
            throw err
        }
    }

    async function createUsersBulk(usersArray) {
        setLoading(true)
        setError(null)
        try {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                throw new Error('Not authenticated')
            }

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-create-users`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ users: usersArray })
                }
            )

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || `HTTP Error ${response.status}`)
            }

            await fetchUsers()
            return result.results || []
        } catch (err) {
            console.error('[useUsers] Bulk create failed:', err.message)
            setError(err.message)
            throw err
        } finally {
            setLoading(false)
        }
    }

    return {
        users,
        loading,
        error,
        createUser,
        updateUser,
        deleteUser,
        assignUserToTeam,
        removeUserFromTeam,
        createUsersBulk,
        refresh: fetchUsers
    }
}

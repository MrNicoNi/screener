import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useTeams() {
    const [teams, setTeams] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchTeams()
    }, [])

    async function fetchTeams() {
        try {
            setLoading(true)
            setError(null)

            const { data, error: fetchError } = await supabase
                .from('teams')
                .select('*')
                .order('name')

            if (fetchError) throw fetchError
            setTeams(data || [])
        } catch (err) {
            console.error('[useTeams] Fetch failed:', err.message)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function createTeam(teamData) {
        try {
            const { data, error: createError } = await supabase
                .from('teams')
                .insert(teamData)
                .select()
                .single()

            if (createError) throw createError

            await fetchTeams()
            return data
        } catch (err) {
            console.error('[useTeams] Create failed:', err.message)
            throw err
        }
    }

    async function updateTeam(id, updates) {
        try {
            const { error: updateError } = await supabase
                .from('teams')
                .update(updates)
                .eq('id', id)

            if (updateError) throw updateError

            await fetchTeams()
        } catch (err) {
            console.error('[useTeams] Update failed:', err.message)
            throw err
        }
    }

    async function getTeamWithMembers(teamId) {
        try {
            // Get team details
            const { data: team, error: teamError } = await supabase
                .from('teams')
                .select('*')
                .eq('id', teamId)
                .single()

            if (teamError) throw teamError

            // Get team members
            const { data: members, error: membersError } = await supabase
                .from('users')
                .select('id, name, email, role, is_active')
                .eq('team_id', teamId)
                .order('name')

            if (membersError) throw membersError

            return {
                ...team,
                members: members || []
            }
        } catch (err) {
            console.error('[useTeams] Get team with members failed:', err.message)
            throw err
        }
    }

    async function deleteTeam(teamId) {
        try {
            // First, check if team has members
            const { data: members, error: membersError } = await supabase
                .from('users')
                .select('id')
                .eq('team_id', teamId)

            if (membersError) throw membersError

            if (members && members.length > 0) {
                throw new Error('Não é possível excluir um time com membros. Remova todos os membros primeiro.')
            }

            // Delete the team
            const { error: deleteError } = await supabase
                .from('teams')
                .delete()
                .eq('id', teamId)

            if (deleteError) throw deleteError

            await fetchTeams()
        } catch (err) {
            console.error('[useTeams] Delete failed:', err.message)
            throw err
        }
    }

    return {
        teams,
        loading,
        error,
        createTeam,
        updateTeam,
        deleteTeam,
        getTeamWithMembers,
        refresh: fetchTeams
    }
}

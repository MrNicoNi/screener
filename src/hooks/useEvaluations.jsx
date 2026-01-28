import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useEvaluations() {
    const [evaluations, setEvaluations] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchEvaluations()
    }, [])

    async function fetchEvaluations() {
        try {
            setLoading(true)
            setError(null)

            const { data, error: fetchError } = await supabase
                .from('evaluations')
                .select(`
          *,
          analyst:users!analyst_id(id, name, email),
          evaluator:users!evaluator_id(id, name, email)
        `)
                .order('created_at', { ascending: false })
                .limit(100)

            if (fetchError) throw fetchError
            setEvaluations(data || [])
        } catch (err) {
            console.error('[useEvaluations] Fetch failed:', err.message)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function createEvaluation(evaluationData) {
        try {
            // Check if Dev Mode is active
            const isDevMode = localStorage.getItem('devMode') === 'true'

            if (isDevMode) {
                // Dev Mode: Save to localStorage
                const mockDB = JSON.parse(localStorage.getItem('mockDB') || '{"evaluations":[],"evaluation_items":[]}')

                // Create evaluation with ID
                const newEval = {
                    ...evaluationData,
                    id: crypto.randomUUID(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }

                mockDB.evaluations.push(newEval)
                localStorage.setItem('mockDB', JSON.stringify(mockDB))

                console.log('[useEvaluations] Dev Mode: Evaluation created in mockDB', newEval.id)

                await fetchEvaluations()
                return newEval
            } else {
                // Production Mode: Save to Supabase
                const { data, error: createError } = await supabase
                    .from('evaluations')
                    .insert(evaluationData)
                    .select()
                    .single()

                if (createError) throw createError

                await fetchEvaluations()
                return data
            }
        } catch (err) {
            console.error('[useEvaluations] Create failed:', err.message)
            throw err
        }
    }

    async function acknowledgeEvaluation(id) {
        try {
            const { error: updateError } = await supabase
                .from('evaluations')
                .update({
                    analyst_acknowledged: true,
                    acknowledged_at: new Date().toISOString(),
                    status: 'acknowledged'
                })
                .eq('id', id)

            if (updateError) throw updateError

            await fetchEvaluations()
        } catch (err) {
            console.error('[useEvaluations] Acknowledge failed:', err.message)
            throw err
        }
    }

    async function deleteEvaluation(id) {
        try {
            // Check if Dev Mode is active
            const isDevMode = localStorage.getItem('devMode') === 'true'

            if (isDevMode) {
                // Dev Mode: Delete from localStorage
                const mockDB = JSON.parse(localStorage.getItem('mockDB') || '{"evaluations":[],"evaluation_items":[]}')

                // Remove evaluation
                mockDB.evaluations = mockDB.evaluations.filter(e => e.id !== id)

                // Remove associated evaluation items
                mockDB.evaluation_items = mockDB.evaluation_items.filter(item => item.evaluation_id !== id)

                localStorage.setItem('mockDB', JSON.stringify(mockDB))
                console.log('[useEvaluations] Dev Mode: Evaluation deleted from mockDB', id)
            } else {
                // Production Mode: Delete from Supabase
                // Note: evaluation_items should cascade delete if FK is set with ON DELETE CASCADE
                const { error: deleteError } = await supabase
                    .from('evaluations')
                    .delete()
                    .eq('id', id)

                if (deleteError) throw deleteError
                console.log('[useEvaluations] Evaluation deleted from Supabase', id)
            }

            await fetchEvaluations()
        } catch (err) {
            console.error('[useEvaluations] Delete failed:', err.message)
            throw err
        }
    }

    async function bulkDeleteEvaluations(ids) {
        try {
            if (!ids || ids.length === 0) {
                throw new Error('No evaluation IDs provided')
            }

            const isDevMode = localStorage.getItem('devMode') === 'true'

            if (isDevMode) {
                // Dev Mode: Delete from localStorage
                const mockDB = JSON.parse(localStorage.getItem('mockDB') || '{"evaluations":[],"evaluation_items":[]}')

                // Remove evaluations
                mockDB.evaluations = mockDB.evaluations.filter(e => !ids.includes(e.id))

                // Remove associated evaluation items
                mockDB.evaluation_items = mockDB.evaluation_items.filter(item => !ids.includes(item.evaluation_id))

                localStorage.setItem('mockDB', JSON.stringify(mockDB))
                console.log('[useEvaluations] Dev Mode: Bulk deleted', ids.length, 'evaluations')
            } else {
                // Production Mode: Delete from Supabase
                const { error: deleteError } = await supabase
                    .from('evaluations')
                    .delete()
                    .in('id', ids)

                if (deleteError) throw deleteError
                console.log('[useEvaluations] Bulk deleted', ids.length, 'evaluations from Supabase')
            }

            await fetchEvaluations()
        } catch (err) {
            console.error('[useEvaluations] Bulk delete failed:', err.message)
            throw err
        }
    }

    async function bulkAcknowledgeEvaluations(ids) {
        try {
            if (!ids || ids.length === 0) {
                throw new Error('No evaluation IDs provided')
            }

            const isDevMode = localStorage.getItem('devMode') === 'true'

            if (isDevMode) {
                // Dev Mode: Update localStorage
                const mockDB = JSON.parse(localStorage.getItem('mockDB') || '{"evaluations":[],"evaluation_items":[]}')

                mockDB.evaluations = mockDB.evaluations.map(e => {
                    if (ids.includes(e.id)) {
                        return {
                            ...e,
                            analyst_acknowledged: true,
                            acknowledged_at: new Date().toISOString(),
                            status: 'acknowledged'
                        }
                    }
                    return e
                })

                localStorage.setItem('mockDB', JSON.stringify(mockDB))
                console.log('[useEvaluations] Dev Mode: Bulk acknowledged', ids.length, 'evaluations')
            } else {
                // Production Mode: Update Supabase
                const { error: updateError } = await supabase
                    .from('evaluations')
                    .update({
                        analyst_acknowledged: true,
                        acknowledged_at: new Date().toISOString(),
                        status: 'acknowledged'
                    })
                    .in('id', ids)

                if (updateError) throw updateError
                console.log('[useEvaluations] Bulk acknowledged', ids.length, 'evaluations in Supabase')
            }

            await fetchEvaluations()
        } catch (err) {
            console.error('[useEvaluations] Bulk acknowledge failed:', err.message)
            throw err
        }
    }

    async function getDashboardStats(options = {}) {
        try {
            let query = supabase
                .from('evaluations')
                .select('final_score, status, created_at, analyst:users!analyst_id(email, team_id)')
                .order('created_at', { ascending: false })

            // Filter by analyst email if provided
            if (options.analystEmail) {
                // We need to filter after fetching since we're joining
                const { data: allEvals, error: fetchError } = await query
                if (fetchError) throw fetchError

                const evals = allEvals.filter(e => e.analyst?.email === options.analystEmail)
                return calculateStats(evals)
            }

            // Filter by team ID if provided
            if (options.teamId) {
                const { data: allEvals, error: fetchError } = await query
                if (fetchError) throw fetchError

                const evals = allEvals.filter(e => e.analyst?.team_id === options.teamId)
                return calculateStats(evals)
            }

            const { data: evals, error: fetchError } = await query
            if (fetchError) throw fetchError

            return calculateStats(evals)
        } catch (err) {
            console.error('[useEvaluations] getDashboardStats failed:', err.message)
            return {
                avgScore: 0,
                totalAudits: 0,
                alerts: 0,
                trend: 0,
                radarData: [
                    { subject: 'Comunicação', score: 0, fullMark: 100 },
                    { subject: 'Eficiência', score: 0, fullMark: 100 },
                    { subject: 'Processos', score: 0, fullMark: 100 },
                ]
            }
        }
    }

    function calculateStats(evals) {
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear

        // Filter current month
        const currentMonthEvals = evals.filter(e => {
            const date = new Date(e.created_at)
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear
        })

        // Filter last month
        const lastMonthEvals = evals.filter(e => {
            const date = new Date(e.created_at)
            return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear
        })

        // Calculate stats
        const avgScore = currentMonthEvals.length > 0
            ? Math.round(currentMonthEvals.reduce((sum, e) => sum + (e.final_score || 0), 0) / currentMonthEvals.length)
            : 0

        const lastMonthAvg = lastMonthEvals.length > 0
            ? Math.round(lastMonthEvals.reduce((sum, e) => sum + (e.final_score || 0), 0) / lastMonthEvals.length)
            : 0

        const trend = lastMonthAvg > 0 ? Math.round(((avgScore - lastMonthAvg) / lastMonthAvg) * 100) : 0
        const alerts = currentMonthEvals.filter(e => (e.final_score || 0) < 75).length

        // Calculate radar data (simplified - you can enhance this based on evaluation_items)
        const radarData = [
            { subject: 'Comunicação', score: avgScore > 0 ? avgScore - 5 : 0, fullMark: 100 },
            { subject: 'Eficiência', score: avgScore, fullMark: 100 },
            { subject: 'Processos', score: avgScore > 0 ? avgScore + 3 : 0, fullMark: 100 },
        ]

        return {
            avgScore,
            totalAudits: currentMonthEvals.length,
            alerts,
            trend,
            radarData
        }
    }

    async function getAnalystRanking(limit = 10, teamId = null) {
        try {
            const { data: evals, error: fetchError } = await supabase
                .from('evaluations')
                .select(`
                    final_score,
                    analyst:users!analyst_id(id, name, team_id)
                `)
                .not('analyst_id', 'is', null)

            if (fetchError) throw fetchError

            // Filter by team if teamId is provided
            const filteredEvals = teamId
                ? evals.filter(e => e.analyst?.team_id === teamId)
                : evals

            // Group by analyst
            const analystScores = {}
            filteredEvals.forEach(e => {
                if (e.analyst) {
                    const id = e.analyst.id
                    if (!analystScores[id]) {
                        analystScores[id] = {
                            id,
                            name: e.analyst.name,
                            scores: [],
                            audits: 0
                        }
                    }
                    analystScores[id].scores.push(e.final_score || 0)
                    analystScores[id].audits++
                }
            })

            // Calculate averages and sort
            const ranking = Object.values(analystScores)
                .map(analyst => ({
                    id: analyst.id,
                    name: analyst.name,
                    score: Math.round(analyst.scores.reduce((sum, s) => sum + s, 0) / analyst.scores.length),
                    audits: analyst.audits,
                    trend: 0 // Placeholder - can be enhanced
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)

            return ranking
        } catch (err) {
            console.error('[useEvaluations] getAnalystRanking failed:', err.message)
            return []
        }
    }

    async function getAnalystsWithStats() {
        try {
            // Get all analysts
            const { data: analysts, error: analystsError } = await supabase
                .from('users')
                .select('id, name, email')
                .eq('role', 'analyst')

            if (analystsError) throw analystsError

            // Get evaluations for all analysts
            const { data: evals, error: evalsError } = await supabase
                .from('evaluations')
                .select('analyst_id, final_score')
                .not('analyst_id', 'is', null)

            if (evalsError) throw evalsError

            // Calculate stats for each analyst
            const analystsWithStats = analysts.map(analyst => {
                const analystEvals = evals.filter(e => e.analyst_id === analyst.id)
                const avgScore = analystEvals.length > 0
                    ? Math.round(analystEvals.reduce((sum, e) => sum + (e.final_score || 0), 0) / analystEvals.length)
                    : 0

                return {
                    id: analyst.id,
                    name: analyst.name,
                    email: analyst.email,
                    avgScore,
                    audits: analystEvals.length,
                    trend: 0 // Placeholder - can be enhanced with month-over-month comparison
                }
            })

            return analystsWithStats.sort((a, b) => b.avgScore - a.avgScore)
        } catch (err) {
            console.error('[useEvaluations] getAnalystsWithStats failed:', err.message)
            return []
        }
    }

    async function getEvaluations(options = {}) {
        try {
            let query = supabase
                .from('evaluations')
                .select(`
                    *,
                    analyst:users!analyst_id(id, name, email),
                    evaluator:users!evaluator_id(id, name, email)
                `)
                .order('created_at', { ascending: false })

            // Apply filters
            if (options.analystId) {
                query = query.eq('analyst_id', options.analystId)
            }

            if (options.limit) {
                query = query.limit(options.limit)
            }

            const { data, error: fetchError } = await query

            if (fetchError) throw fetchError

            // Filter by analyst email if provided (post-query filter since it's a joined field)
            let filteredData = data || []
            if (options.analystEmail) {
                filteredData = filteredData.filter(e => e.analyst?.email === options.analystEmail)
            }

            return filteredData
        } catch (err) {
            console.error('[useEvaluations] getEvaluations failed:', err.message)
            return []
        }
    }

    async function getTeamsWithStats() {
        try {
            // Get all teams
            const { data: teams, error: teamsError } = await supabase
                .from('teams')
                .select('id, name, created_at')
                .order('name')

            if (teamsError) throw teamsError

            // Get all users to count members
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('id, team_id')
                .eq('role', 'analyst')

            if (usersError) throw usersError

            // Get all evaluations with analyst info
            const { data: evals, error: evalsError } = await supabase
                .from('evaluations')
                .select('final_score, created_at, analyst:users!analyst_id(team_id)')
                .not('analyst_id', 'is', null)

            if (evalsError) throw evalsError

            // Calculate stats for each team
            const teamsWithStats = await Promise.all(teams.map(async (team) => {
                // Count members
                const memberCount = users.filter(u => u.team_id === team.id).length

                // Filter evaluations for this team
                const teamEvals = evals.filter(e => e.analyst?.team_id === team.id)

                // Calculate stats using same logic as getDashboardStats
                const stats = calculateStats(teamEvals)

                // Get principal offender
                const principalOffender = await getPrincipalOffenderByTeam(team.id)

                return {
                    id: team.id,
                    name: team.name,
                    memberCount,
                    avgScore: stats.avgScore,
                    trend: stats.trend,
                    totalAudits: stats.totalAudits,
                    alerts: stats.alerts,
                    principalOffender
                }
            }))

            return teamsWithStats
        } catch (err) {
            console.error('[useEvaluations] getTeamsWithStats failed:', err.message)
            return []
        }
    }

    async function getPrincipalOffenderByTeam(teamId) {
        try {
            // Get current month date range
            const now = new Date()
            const currentMonth = now.getMonth()
            const currentYear = now.getFullYear()
            const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString()
            const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString()

            // Get evaluations for this team in current month
            const { data: teamEvals, error: evalsError } = await supabase
                .from('evaluations')
                .select(`
                    id,
                    analyst:users!analyst_id(team_id)
                `)
                .gte('created_at', startOfMonth)
                .lte('created_at', endOfMonth)
                .not('analyst_id', 'is', null)

            if (evalsError) throw evalsError

            // Filter for this team
            const filteredEvals = teamEvals.filter(e => e.analyst?.team_id === teamId)

            if (filteredEvals.length === 0) {
                return { name: '—', score: 0 }
            }

            // Get evaluation items for these evaluations
            const evalIds = filteredEvals.map(e => e.id)
            const { data: items, error: itemsError } = await supabase
                .from('evaluation_items')
                .select('pillar_name, value')
                .in('evaluation_id', evalIds)

            if (itemsError) throw itemsError

            if (!items || items.length === 0) {
                return { name: '—', score: 0 }
            }

            // Group by pillar and calculate averages
            const pillarScores = {}
            items.forEach(item => {
                const pillar = item.pillar_name || 'Outros'
                if (!pillarScores[pillar]) {
                    pillarScores[pillar] = { sum: 0, count: 0 }
                }
                // Convert value (1-5) to percentage (20-100)
                const scorePercent = item.value * 20
                pillarScores[pillar].sum += scorePercent
                pillarScores[pillar].count++
            })

            // Calculate averages and find lowest
            let lowestPillar = null
            let lowestScore = 100

            Object.entries(pillarScores).forEach(([pillar, data]) => {
                const avg = Math.round(data.sum / data.count)
                if (avg < lowestScore) {
                    lowestScore = avg
                    lowestPillar = pillar
                }
            })

            return {
                name: lowestPillar || '—',
                score: lowestScore
            }
        } catch (err) {
            console.error('[useEvaluations] getPrincipalOffenderByTeam failed:', err.message)
            return { name: '—', score: 0 }
        }
    }

    return {
        evaluations,
        loading,
        error,
        createEvaluation,
        acknowledgeEvaluation,
        deleteEvaluation,
        bulkDeleteEvaluations,
        bulkAcknowledgeEvaluations,
        getDashboardStats,
        getAnalystRanking,
        getAnalystsWithStats,
        getEvaluations,
        getTeamsWithStats,
        getPrincipalOffenderByTeam,
        refresh: fetchEvaluations
    }
}

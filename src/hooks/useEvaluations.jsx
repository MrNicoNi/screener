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

    async function getDashboardStats() {
        try {
            const { data: evals, error: fetchError } = await supabase
                .from('evaluations')
                .select('final_score, status, created_at')
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError

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

    async function getAnalystRanking(limit = 10) {
        try {
            const { data: evals, error: fetchError } = await supabase
                .from('evaluations')
                .select(`
                    final_score,
                    analyst:users!analyst_id(id, name)
                `)
                .not('analyst_id', 'is', null)

            if (fetchError) throw fetchError

            // Group by analyst
            const analystScores = {}
            evals.forEach(e => {
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
            return data || []
        } catch (err) {
            console.error('[useEvaluations] getEvaluations failed:', err.message)
            return []
        }
    }

    return {
        evaluations,
        loading,
        error,
        createEvaluation,
        acknowledgeEvaluation,
        getDashboardStats,
        getAnalystRanking,
        getAnalystsWithStats,
        getEvaluations,
        refresh: fetchEvaluations
    }
}

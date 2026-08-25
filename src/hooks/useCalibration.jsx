import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// Shared select shape so the session's template fetch matches NewAudit's
// TEMPLATE_SELECT + normalizeCriteria approach.
const TEMPLATE_SELECT = `
    id,
    code,
    name,
    version,
    template_criteria (
        criterion_key,
        block,
        block_label,
        block_weight,
        statement,
        weight,
        allows_na,
        is_auto_fail,
        sort_order
    )
`

function normalizeCriteria(rows = []) {
    return rows.map((c) => ({
        criterion_key: c.criterion_key,
        block: c.block,
        block_label: c.block_label,
        block_weight: c.block_weight === null ? null : Number(c.block_weight),
        statement: c.statement,
        weight: Number(c.weight),
        allows_na: c.allows_na,
        is_auto_fail: c.is_auto_fail,
        sort_order: c.sort_order,
    }))
}

/**
 * Hook for calibration sessions (blind multi-evaluator scoring of the same
 * ticket). RLS enforces the "blind" rule: while a session is open an evaluator
 * only sees their own participant row + items; once closed, all members see
 * everything; admins see all.
 *
 * @returns {{
 *   sessions: Array,
 *   loading: boolean,
 *   error: string|null,
 *   listSessions: () => Promise<Array>,
 *   getSession: (id: string) => Promise<{ session, participants, template }>,
 *   createSession: (payload) => Promise<string>,
 *   submitParticipation: (payload) => Promise<void>,
 *   refresh: () => Promise<Array>,
 * }}
 */
export function useCalibration() {
    const { userProfile } = useAuth()
    const [sessions, setSessions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        listSessions()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userProfile?.id])

    // ── List sessions the current user can see (RLS filters) ──────────────────
    async function listSessions() {
        try {
            setLoading(true)
            setError(null)

            const { data, error: fetchError } = await supabase
                .from('calibration_sessions')
                .select(`
                    id,
                    ticket_id,
                    ticket_subject,
                    status,
                    created_at,
                    closed_at,
                    participants:calibration_participants (
                        id,
                        evaluator_id,
                        submitted
                    )
                `)
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError

            const myId = userProfile?.id

            const summarized = (data || []).map((s) => {
                const participants = s.participants || []
                const participantCount = participants.length
                const submittedCount = participants.filter((p) => p.submitted).length
                const mine = myId ? participants.find((p) => p.evaluator_id === myId) : null

                return {
                    id: s.id,
                    ticket_id: s.ticket_id,
                    ticket_subject: s.ticket_subject,
                    status: s.status,
                    created_at: s.created_at,
                    closed_at: s.closed_at,
                    participantCount,
                    submittedCount,
                    iAmParticipant: Boolean(mine),
                    iSubmitted: Boolean(mine?.submitted),
                }
            })

            setSessions(summarized)
            return summarized
        } catch (err) {
            console.error('[useCalibration] listSessions failed:', err.message)
            setError(err.message)
            setSessions([])
            return []
        } finally {
            setLoading(false)
        }
    }

    // ── Load one session + participants (with items when visible) + template ──
    async function getSession(id) {
        try {
            const { data: session, error: sessionError } = await supabase
                .from('calibration_sessions')
                .select('*')
                .eq('id', id)
                .single()

            if (sessionError) throw sessionError
            if (!session) throw new Error('Sessão de calibração não encontrada')

            // Participants with evaluator identity + (RLS-permitting) their items.
            const { data: participants, error: participantsError } = await supabase
                .from('calibration_participants')
                .select(`
                    id,
                    session_id,
                    evaluator_id,
                    submitted,
                    submitted_at,
                    final_score,
                    block_scores,
                    has_critical_flag,
                    evaluator:users!evaluator_id(id, name, email),
                    items:calibration_items (
                        id,
                        criterion_key,
                        value,
                        is_na
                    )
                `)
                .eq('session_id', id)

            if (participantsError) throw participantsError

            // Load the session's template (same shape as NewAudit).
            const { data: tpl, error: tplError } = await supabase
                .from('evaluation_templates')
                .select(TEMPLATE_SELECT)
                .eq('id', session.template_id)
                .order('sort_order', { referencedTable: 'template_criteria', ascending: true })
                .maybeSingle()

            if (tplError) throw tplError
            if (!tpl) throw new Error('Template da sessão não encontrado')

            const template = {
                id: tpl.id,
                code: tpl.code,
                name: tpl.name,
                version: tpl.version,
                criteria: normalizeCriteria(tpl.template_criteria),
            }

            return { session, participants: participants || [], template }
        } catch (err) {
            console.error('[useCalibration] getSession failed:', err.message)
            throw err
        }
    }

    // ── Create a session + one participant row per evaluator ──────────────────
    async function createSession({ ticket_id, ticket_subject, analyst_id, template_id, evaluatorIds }) {
        try {
            const { data: session, error: sessionError } = await supabase
                .from('calibration_sessions')
                .insert({
                    ticket_id,
                    ticket_subject: ticket_subject || null,
                    analyst_id: analyst_id || null,
                    template_id,
                    created_by: userProfile.id,
                    // status defaults to 'open' in the DB
                })
                .select('id')
                .single()

            if (sessionError) throw sessionError

            const rows = (evaluatorIds || []).map((evaluatorId) => ({
                session_id: session.id,
                evaluator_id: evaluatorId,
            }))

            const { error: participantsError } = await supabase
                .from('calibration_participants')
                .insert(rows)

            if (participantsError) throw participantsError

            await listSessions()
            return session.id
        } catch (err) {
            console.error('[useCalibration] createSession failed:', err.message)
            throw err
        }
    }

    // ── Submit MY participation (items + summary). Trigger auto-closes session ─
    async function submitParticipation({ sessionId, answers, result }) {
        try {
            // Find MY participant row for this session.
            const { data: participant, error: participantError } = await supabase
                .from('calibration_participants')
                .select('id')
                .eq('session_id', sessionId)
                .eq('evaluator_id', userProfile.id)
                .single()

            if (participantError) throw participantError
            if (!participant) throw new Error('Você não é participante desta sessão')

            // Insert one item per answered criterion (incl. auto-fails).
            const items = (answers || []).map((a) => ({
                participant_id: participant.id,
                criterion_key: a.criterion_key,
                value: a.value,
                is_na: a.is_na,
            }))

            if (items.length > 0) {
                const { error: itemsError } = await supabase
                    .from('calibration_items')
                    .insert(items)

                if (itemsError) throw itemsError
            }

            // Mark my participation submitted. The DB trigger auto-closes the
            // session (status='closed' + closed_at) when the last one submits.
            const { error: updateError } = await supabase
                .from('calibration_participants')
                .update({
                    submitted: true,
                    submitted_at: new Date().toISOString(),
                    final_score: result.final,
                    block_scores: result.blocks,
                    has_critical_flag: result.has_critical_flag,
                })
                .eq('id', participant.id)

            if (updateError) throw updateError

            await listSessions()
        } catch (err) {
            console.error('[useCalibration] submitParticipation failed:', err.message)
            throw err
        }
    }

    return {
        sessions,
        loading,
        error,
        listSessions,
        getSession,
        createSession,
        submitParticipation,
        refresh: listSessions,
    }
}

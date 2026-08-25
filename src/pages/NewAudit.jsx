import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUsers } from '../hooks/useUsers'
import { useEvaluations } from '../hooks/useEvaluations'
import { useTemplates } from '../hooks/useTemplates'
import { supabase } from '../lib/supabase'
import { calculateScore } from '../lib/scoring'
import { useToast } from '../components/Toast'

const AREA_OPTIONS = ['MDM', 'TEM']

// Shared select shape so the edit-mode by-id fetch matches useActiveTemplate.
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

// A criterion is "answered" when Yes(5), No(1) or (allowed) N/A was picked.
function isAnswered(answer) {
    if (!answer) return false
    if (answer.is_na === true) return true
    return answer.value === 5 || answer.value === 1
}

export function NewAudit() {
    const navigate = useNavigate()
    const { id: editId } = useParams() // present when editing
    const isEditMode = Boolean(editId)

    const { userProfile } = useAuth()
    const { users: allUsers } = useUsers()
    const toast = useToast()
    const { createEvaluation } = useEvaluations()

    // Create mode: the evaluator picks WHICH template a new evaluation uses.
    // The list (active/newest first) drives the selector; the selected
    // template's full criteria are fetched by id below.
    const {
        templates,
        loading: templatesLoading,
        error: templatesError,
    } = useTemplates()

    const [selectedTemplateId, setSelectedTemplateId] = useState('')
    const [createTemplate, setCreateTemplate] = useState(null)
    const [loadingCreate, setLoadingCreate] = useState(!isEditMode)
    const [createError, setCreateError] = useState(null)

    const [analystId, setAnalystId] = useState('')
    const [ticketId, setTicketId] = useState('')
    const [ticketSubject, setTicketSubject] = useState('')
    const [feedback, setFeedback] = useState('')
    const [area, setArea] = useState('')
    const [answers, setAnswers] = useState({}) // { [criterion_key]: { value: 5|1|null, is_na: bool } }
    const [result, setResult] = useState({ final: 0, blocks: {}, has_critical_flag: false })
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Edit mode carries the evaluation's OWN template (may be v1), fetched by id.
    const [editTemplate, setEditTemplate] = useState(null)
    const [loadingEdit, setLoadingEdit] = useState(isEditMode)
    const [editError, setEditError] = useState(null)

    const analysts = allUsers.filter((u) => u.role === 'analyst' && u.is_active)

    // The template actually driving the form: edit-mode uses the row's own
    // template, create-mode uses the evaluator's selected template.
    const template = isEditMode ? editTemplate : createTemplate
    const loading = isEditMode ? loadingEdit : (templatesLoading || loadingCreate)
    const error = isEditMode ? editError : (templatesError || createError)

    // ── Load existing evaluation + its template in edit mode ────────────────
    useEffect(() => {
        if (!isEditMode) return
        let cancelled = false

        async function loadEvaluation() {
            try {
                setLoadingEdit(true)
                setEditError(null)

                const { data, error: fetchError } = await supabase
                    .from('evaluations')
                    .select(`*, items:evaluation_items(*)`)
                    .eq('id', editId)
                    .single()

                if (fetchError) throw fetchError
                if (!data) throw new Error('Avaliação não encontrada')

                // v1 rows that predate the template backfill have no template_id
                // and cannot be reconstructed reliably → block edit with a clear msg.
                if (!data.template_id) {
                    if (!cancelled) {
                        setEditError(
                            'Esta avaliação (v1) não está vinculada a um template e não pode ser editada neste formulário.'
                        )
                    }
                    return
                }

                // Fetch the evaluation's OWN template (v1 or v2) by id.
                const { data: tpl, error: tplError } = await supabase
                    .from('evaluation_templates')
                    .select(TEMPLATE_SELECT)
                    .eq('id', data.template_id)
                    .order('sort_order', { referencedTable: 'template_criteria', ascending: true })
                    .maybeSingle()

                if (tplError) throw tplError
                if (!tpl) throw new Error('Template da avaliação não encontrado')

                if (cancelled) return

                setEditTemplate({
                    id: tpl.id,
                    code: tpl.code,
                    name: tpl.name,
                    version: tpl.version,
                    criteria: normalizeCriteria(tpl.template_criteria),
                })

                // Pre-populate form fields
                setAnalystId(data.analyst_id || '')
                setTicketId(data.ticket_id || '')
                setTicketSubject(data.ticket_subject || '')
                setFeedback(data.feedback || '')
                setArea(data.area || '')

                // Reconstruct answers from evaluation_items.
                // is_na → N/A; else value carries 5 (Yes) or 1 (No).
                const reconstructed = {}
                ;(data.items || []).forEach((item) => {
                    if (item.is_na) {
                        reconstructed[item.criterion_key] = { value: null, is_na: true }
                    } else {
                        reconstructed[item.criterion_key] = { value: item.value, is_na: false }
                    }
                })
                setAnswers(reconstructed)
            } catch (err) {
                console.error('[NewAudit] Error loading evaluation for edit:', err)
                if (!cancelled) setEditError(err.message || 'Erro ao carregar avaliação para edição')
            } finally {
                if (!cancelled) setLoadingEdit(false)
            }
        }

        loadEvaluation()
        return () => {
            cancelled = true
        }
    }, [editId, isEditMode])

    // ── Create mode: default the selection to the first (active/newest) template ─
    useEffect(() => {
        if (isEditMode) return
        if (!selectedTemplateId && templates.length > 0) {
            setSelectedTemplateId(templates[0].id)
        }
    }, [isEditMode, templates, selectedTemplateId])

    // ── Create mode: load the SELECTED template's full criteria by id ──────────
    // When the selection changes we reset answers to {} (criteria differ between
    // templates; stale answers must not carry over). Score recomputes off the
    // reset answers via the live-score effect.
    useEffect(() => {
        if (isEditMode) return
        if (!selectedTemplateId) return
        let cancelled = false

        async function loadSelectedTemplate() {
            try {
                setLoadingCreate(true)
                setCreateError(null)

                const { data: tpl, error: tplError } = await supabase
                    .from('evaluation_templates')
                    .select(TEMPLATE_SELECT)
                    .eq('id', selectedTemplateId)
                    .order('sort_order', { referencedTable: 'template_criteria', ascending: true })
                    .maybeSingle()

                if (tplError) throw tplError
                if (!tpl) throw new Error('Template selecionado não encontrado')

                if (cancelled) return

                setCreateTemplate({
                    id: tpl.id,
                    code: tpl.code,
                    name: tpl.name,
                    version: tpl.version,
                    criteria: normalizeCriteria(tpl.template_criteria),
                })
                // Different template → wipe any answers from the previous one.
                setAnswers({})
            } catch (err) {
                if (cancelled) return
                console.error('[NewAudit] Error loading selected template:', err)
                setCreateTemplate(null)
                setCreateError(err.message || 'Erro ao carregar template selecionado')
            } finally {
                if (!cancelled) setLoadingCreate(false)
            }
        }

        loadSelectedTemplate()
        return () => {
            cancelled = true
        }
    }, [isEditMode, selectedTemplateId])

    // ── Live score ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!template) return
        setResult(calculateScore(template, answers))
    }, [answers, template])

    // ── Derived grouping (blocks in sort_order order + auto-fail list) ───────
    const { blocks, autoFails } = useMemo(() => {
        if (!template) return { blocks: [], autoFails: [] }
        const blockOrder = []
        const byBlock = {}
        for (const c of template.criteria) {
            if (c.is_auto_fail) continue
            if (!byBlock[c.block]) {
                byBlock[c.block] = {
                    block: c.block,
                    label: c.block_label,
                    weight: c.block_weight,
                    items: [],
                }
                blockOrder.push(byBlock[c.block])
            }
            byBlock[c.block].items.push(c)
        }
        return {
            blocks: blockOrder,
            autoFails: template.criteria.filter((c) => c.is_auto_fail),
        }
    }, [template])

    function setAnswer(key, next) {
        setAnswers((prev) => ({ ...prev, [key]: next }))
    }

    function toggleAutoFail(key, checked) {
        // 5 = violation present, 1 = no violation (kept in answers so it is
        // persisted as an evaluation_item row).
        setAnswer(key, { value: checked ? 5 : 1, is_na: false })
    }

    function getScoreColor(final) {
        if (final >= 90) return 'text-navita-green'
        if (final >= 75) return 'text-navita-blue'
        return 'text-red-500'
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!template) return

        if (!analystId || !ticketId) {
            toast.error('Analista e Ticket são obrigatórios')
            return
        }
        if (!area) {
            toast.error('Selecione a Área (MDM ou TEM)')
            return
        }

        // Completeness: every non-auto-fail criterion must be answered.
        const missing = template.criteria.filter(
            (c) => !c.is_auto_fail && !isAnswered(answers[c.criterion_key])
        )
        if (missing.length > 0) {
            toast.error(
                `Preencha todos os critérios: faltam ${missing.length} sem resposta (Sim / Não / N/A).`
            )
            return
        }

        setIsSubmitting(true)
        try {
            const score = calculateScore(template, answers)

            // One row per criterion (including auto-fails).
            const items = template.criteria.map((c) => {
                const a = answers[c.criterion_key]
                if (c.is_auto_fail) {
                    return {
                        criterion_key: c.criterion_key,
                        value: a?.value === 5 ? 5 : 1,
                        is_na: false,
                        notes: null,
                    }
                }
                if (a?.is_na) {
                    return { criterion_key: c.criterion_key, value: null, is_na: true, notes: null }
                }
                return {
                    criterion_key: c.criterion_key,
                    value: a?.value ?? 1,
                    is_na: false,
                    notes: null,
                }
            })

            if (isEditMode) {
                // ── EDIT MODE ─────────────────────────────────────────────
                const { error: updateError } = await supabase
                    .from('evaluations')
                    .update({
                        analyst_id: analystId,
                        ticket_id: ticketId,
                        ticket_subject: ticketSubject || null,
                        feedback,
                        template_id: template.id,
                        area,
                        final_score: score.final,
                        block_scores: score.blocks,
                        has_critical_flag: score.has_critical_flag,
                        status: 'pending',
                        // Reset analyst acknowledgment so they must review again
                        analyst_acknowledged: false,
                        acknowledged_at: null,
                        analyst_comment: null,
                        dispute_reason: null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editId)

                if (updateError) throw updateError

                const { error: deleteError } = await supabase
                    .from('evaluation_items')
                    .delete()
                    .eq('evaluation_id', editId)

                if (deleteError) throw deleteError

                const { error: insertError } = await supabase
                    .from('evaluation_items')
                    .insert(items.map((item) => ({ ...item, evaluation_id: editId })))

                if (insertError) throw insertError

                toast.success('Avaliação atualizada com sucesso! O analista precisará dar nova ciência.')
                setTimeout(() => navigate(`/avaliacao/${editId}`), 1500)
            } else {
                // ── CREATE MODE ───────────────────────────────────────────
                const evaluation = await createEvaluation({
                    analyst_id: analystId,
                    evaluator_id: userProfile.id,
                    ticket_id: ticketId,
                    ticket_subject: ticketSubject || null,
                    feedback,
                    template_id: template.id,
                    area,
                    final_score: score.final,
                    block_scores: score.blocks,
                    has_critical_flag: score.has_critical_flag,
                    status: 'pending',
                })

                const isDevMode = localStorage.getItem('devMode') === 'true'

                if (isDevMode) {
                    const mockDB = JSON.parse(
                        localStorage.getItem('mockDB') || '{"evaluations":[],"evaluation_items":[]}'
                    )
                    const itemsWithIds = items.map((item) => ({
                        ...item,
                        evaluation_id: evaluation.id,
                        id: crypto.randomUUID(),
                        created_at: new Date().toISOString(),
                    }))
                    mockDB.evaluation_items.push(...itemsWithIds)
                    localStorage.setItem('mockDB', JSON.stringify(mockDB))
                    console.log('[NewAudit] Dev Mode: Saved', itemsWithIds.length, 'items to mockDB')
                } else {
                    await supabase
                        .from('evaluation_items')
                        .insert(items.map((item) => ({ ...item, evaluation_id: evaluation.id })))
                    console.log('[NewAudit] Evaluation items saved, email sent by useEvaluations')
                }

                toast.success('Avaliação criada com sucesso!')
                setTimeout(() => navigate('/dashboard'), 1500)
            }
        } catch (err) {
            console.error('[NewAudit] Error:', err)
            toast.error(err.message || `Erro ao ${isEditMode ? 'salvar' : 'criar'} avaliação`)
        } finally {
            setIsSubmitting(false)
        }
    }

    // ── Loading skeleton ─────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="animate-pulse space-y-6 max-w-4xl mx-auto">
                <div className="h-16 bg-slate-200 rounded-2xl" />
                <div className="h-32 bg-slate-200 rounded-2xl" />
                <div className="h-64 bg-slate-200 rounded-2xl" />
            </div>
        )
    }

    // ── Error / no-template state ─────────────────────────────────────────────
    if (error || !template) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="clean-card rounded-2xl p-8 text-center">
                    <div className="flex justify-center mb-4">
                        <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-display font-bold text-slate-900 mb-2">
                        Não foi possível carregar o formulário
                    </h2>
                    <p className="text-slate-500 mb-6">
                        {error || 'Nenhum template de avaliação ativo foi encontrado.'}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-3 bg-navita-blue text-white rounded-xl hover:bg-navita-dark-blue font-medium transition"
                    >
                        Voltar ao Dashboard
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen pb-20">
            {/* Sticky Header */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 -mt-8 mb-8">
                <div className="max-w-4xl mx-auto py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-display font-bold text-slate-900">
                            {isEditMode ? (
                                <>Editar Avaliação <span className="text-amber-500">#{ticketId || '...'}</span></>
                            ) : (
                                <>Quality Framework <span className="text-navita-green">v{template.version}</span></>
                            )}
                        </h1>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                            {isEditMode ? 'O analista precisará dar nova ciência após salvar' : template.name}
                        </p>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6">
                        {result.has_critical_flag && (
                            <div className="px-3 py-2 rounded-lg text-sm font-bold uppercase tracking-wide border bg-red-50 text-red-600 border-red-200 flex items-center gap-1.5">
                                <span aria-hidden="true">⚠</span> Flag Crítica
                            </div>
                        )}
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Final Score</p>
                            <div className="flex items-baseline justify-end gap-1">
                                <span className={`text-3xl font-display font-black ${getScoreColor(result.final)}`}>
                                    {Number(result.final).toFixed(1)}
                                </span>
                                <span className="text-sm font-bold text-slate-300">%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto space-y-12">
                {/* Edit mode warning banner */}
                {isEditMode && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <p className="font-semibold text-amber-800">Modo de Edição</p>
                            <p className="text-sm text-amber-700">Ao salvar, o status retornará para <strong>Pendente</strong> e o analista precisará dar nova ciência (ou contestar).</p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Form Header */}
                    <div className="clean-card rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Informações da Auditoria</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Analista</label>
                                <select
                                    value={analystId}
                                    onChange={(e) => setAnalystId(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                                    required
                                >
                                    <option value="">Selecione um analista</option>
                                    {analysts.map((analyst) => (
                                        <option key={analyst.id} value={analyst.id}>{analyst.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Área</label>
                                <select
                                    value={area}
                                    onChange={(e) => setArea(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                                    required
                                >
                                    <option value="">Selecione a área</option>
                                    {AREA_OPTIONS.map((a) => (
                                        <option key={a} value={a}>{a}</option>
                                    ))}
                                </select>
                            </div>
                            {!isEditMode && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Template</label>
                                    <select
                                        value={selectedTemplateId}
                                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                                        required
                                    >
                                        {templates.length === 0 && (
                                            <option value="">Carregando templates...</option>
                                        )}
                                        {templates.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name} (v{t.version}){!t.is_active ? ' — aposentado' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Ticket ID</label>
                                <input
                                    type="text"
                                    value={ticketId}
                                    onChange={(e) => setTicketId(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                                    placeholder="Ex: TICKET-12345"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Assunto do Ticket <span className="text-slate-400">(opcional)</span></label>
                                <input
                                    type="text"
                                    value={ticketSubject}
                                    onChange={(e) => setTicketSubject(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                                    placeholder="Ex: Problema com acesso ao sistema"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Intro */}
                    <div className="text-center max-w-2xl mx-auto">
                        <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-900 mb-4">Quality Checklist</h2>
                        <p className="text-lg text-slate-500 leading-relaxed">
                            Avalie cada critério com <strong>Sim</strong>, <strong>Não</strong> ou <strong>N/A</strong> (quando permitido).
                            A nota é calculada automaticamente e renormalizada por bloco.
                        </p>
                    </div>

                    {/* Blocks driven by the template */}
                    {blocks.map((block, index) => (
                        <BlockSection
                            key={block.block}
                            index={index}
                            block={block}
                            answers={answers}
                            onAnswer={setAnswer}
                        />
                    ))}

                    {/* Critical flags (auto-fail criteria) */}
                    {autoFails.length > 0 && (
                        <section className="clean-card rounded-2xl overflow-hidden">
                            <div className="bg-white border-b border-slate-100 p-6 flex justify-between items-center relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>
                                <div>
                                    <h3 className="text-xl font-display font-bold text-slate-800 flex items-center gap-2">
                                        <span aria-hidden="true">⚠</span> Flags Críticas
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        Marque uma violação apenas se ela ocorreu. Não afeta a nota, mas levanta a flag crítica.
                                    </p>
                                </div>
                            </div>
                            <div className="p-6 space-y-2">
                                {autoFails.map((c) => (
                                    <AutoFailRow
                                        key={c.criterion_key}
                                        criterion={c}
                                        checked={answers[c.criterion_key]?.value === 5}
                                        onToggle={(checked) => toggleAutoFail(c.criterion_key, checked)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Feedback */}
                    <div className="clean-card rounded-2xl p-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Feedback (Opcional)</label>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                            rows="4"
                            placeholder="Comentários adicionais sobre a avaliação..."
                        />
                    </div>

                    {/* Submit */}
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => navigate(isEditMode ? `/avaliacao/${editId}` : '/dashboard')}
                            className="flex-1 px-6 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 font-medium transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`flex-1 text-white px-6 py-3 rounded-xl disabled:opacity-50 font-medium transition shadow-lg ${
                                isEditMode
                                    ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/20'
                                    : 'bg-navita-blue hover:bg-navita-dark-blue shadow-blue-900/20'
                            }`}
                        >
                            {isSubmitting
                                ? (isEditMode ? 'Salvando...' : 'Criando...')
                                : (isEditMode ? 'Salvar Alterações' : 'Criar Avaliação')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

const BLOCK_ACCENTS = ['bg-navita-blue', 'bg-navita-green', 'bg-slate-800', 'bg-navita-purple', 'bg-amber-500']
const BLOCK_BADGES = [
    'bg-blue-50 text-navita-blue border-blue-100',
    'bg-green-50 text-navita-green border-green-100',
    'bg-slate-100 text-slate-600 border-slate-200',
    'bg-purple-50 text-navita-purple border-purple-100',
    'bg-amber-50 text-amber-600 border-amber-100',
]

function BlockSection({ index, block, answers, onAnswer }) {
    const accent = BLOCK_ACCENTS[index % BLOCK_ACCENTS.length]
    const badge = BLOCK_BADGES[index % BLOCK_BADGES.length]

    return (
        <section className="clean-card rounded-2xl overflow-hidden">
            <div className="bg-white border-b border-slate-100 p-6 flex justify-between items-center relative">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accent}`}></div>
                <div>
                    <h3 className="text-xl font-display font-bold text-slate-800">
                        {index + 1}. {block.label || block.block}
                    </h3>
                </div>
                {block.weight != null && (
                    <div className={`px-3 py-1 rounded-full text-xs font-bold border ${badge}`}>
                        Peso: {Number(block.weight)}%
                    </div>
                )}
            </div>
            <div className="p-6 space-y-2">
                {block.items.map((c) => (
                    <CriterionRow
                        key={c.criterion_key}
                        criterion={c}
                        answer={answers[c.criterion_key]}
                        onChange={(next) => onAnswer(c.criterion_key, next)}
                    />
                ))}
            </div>
        </section>
    )
}

function CriterionRow({ criterion, answer, onChange }) {
    const isYes = answer && !answer.is_na && answer.value === 5
    const isNo = answer && !answer.is_na && answer.value === 1
    const isNa = answer?.is_na === true

    const options = [
        { key: 'yes', label: 'Sim', active: isYes, next: { value: 5, is_na: false }, activeCls: 'bg-navita-green text-white border-navita-green' },
        { key: 'no', label: 'Não', active: isNo, next: { value: 1, is_na: false }, activeCls: 'bg-red-500 text-white border-red-500' },
    ]
    if (criterion.allows_na) {
        options.push({ key: 'na', label: 'N/A', active: isNa, next: { value: null, is_na: true }, activeCls: 'bg-slate-600 text-white border-slate-600' })
    }

    return (
        <div className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-slate-50 transition group">
            <div className="flex-1 pr-2">
                <p className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition">
                    {criterion.statement}
                </p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
                <span className="text-xs font-mono text-slate-300 font-bold hidden sm:inline">
                    {Number(criterion.weight)}%
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                    {options.map((opt, i) => (
                        <button
                            key={opt.key}
                            type="button"
                            onClick={() => onChange(opt.next)}
                            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                                i > 0 ? 'border-l border-slate-200' : ''
                            } ${opt.active ? opt.activeCls : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

function AutoFailRow({ criterion, checked, onToggle }) {
    return (
        <div
            onClick={() => onToggle(!checked)}
            className={`flex items-center justify-between gap-4 p-3 rounded-lg border transition cursor-pointer ${
                checked ? 'bg-red-50 border-red-200' : 'border-transparent hover:bg-slate-50'
            }`}
        >
            <div className="flex-1 pr-2">
                <p className={`text-sm font-medium transition ${checked ? 'text-red-700' : 'text-slate-600'}`}>
                    {criterion.statement}
                </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onToggle(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
        </div>
    )
}

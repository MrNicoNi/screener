import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, User, Calendar, CheckCircle2, AlertCircle, AlertTriangle, Trash2, Edit3, MessageSquare, XCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useEvaluations } from '../hooks/useEvaluations'
import { supabase } from '../lib/supabase'
import { getAcknowledgmentDisplay } from '../lib/scoring'
import { useToast } from '../components/Toast'
import { ConfirmModal } from '../components/Modal'
import { SlaSidePanel } from '../components/SlaSidePanel'

// Shared select shape (mirrors NewAudit's by-id template fetch).
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

export function EvaluationDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { userProfile, isAnalyst, isAdmin, isEvaluator } = useAuth()
    const { deleteEvaluation } = useEvaluations()
    const { showToast } = useToast()
    const [evaluation, setEvaluation] = useState(null)
    const [template, setTemplate] = useState(null) // evaluation's OWN template (null for un-backfilled v1)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [disputeMode, setDisputeMode] = useState(false) // true = contestar, false = confirmar
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        loadEvaluation()
    }, [id])

    const loadEvaluation = async () => {
        try {
            setLoading(true)
            setError(null)

            const { data, error: fetchError } = await supabase
                .from('evaluations')
                .select(`
                    *,
                    analyst:users!analyst_id(id, name, email),
                    evaluator:users!evaluator_id(id, name, email),
                    items:evaluation_items(*)
                `)
                .eq('id', id)
                .single()

            if (fetchError) throw fetchError

            if (!data) {
                setError('Avaliação não encontrada')
                return
            }

            // Access control: Analysts can only view their own evaluations
            if (isAnalyst && data.analyst?.email !== userProfile?.email) {
                setError('Você não tem permissão para visualizar esta avaliação')
                return
            }

            // Transform data for the UI
            const transformedEval = {
                id: data.id,
                ticketId: `#${data.ticket_id}`,
                ticketSubject: data.ticket_subject || 'Avaliação de atendimento',
                date: new Date(data.created_at).toLocaleDateString('pt-BR'),
                evaluator: data.evaluator?.name || 'Avaliador',
                analyst: data.analyst?.name || 'Analista',
                analystEmail: data.analyst?.email,
                area: data.area || null,
                templateId: data.template_id || null,
                hasCriticalFlag: data.has_critical_flag || false,
                blockScores: data.block_scores || null,
                scores: {
                    communication: data.score_communication || 0,
                    efficiency: data.score_efficiency || 0,
                    process: data.score_process || 0,
                    final: data.final_score || 0,
                    status: data.status || 'pending'
                },
                // Full answer per criterion so N/A (is_na) is distinguishable from No.
                itemsByKey: data.items?.reduce((acc, item) => {
                    acc[item.criterion_key] = { value: item.value, is_na: item.is_na === true }
                    return acc
                }, {}) || {},
                // Raw items preserved for the v1-fallback (no template) path.
                rawItems: data.items || [],
                feedback: data.feedback || 'Sem feedback.',
                acknowledged: data.analyst_acknowledged || false,
                analystComment: data.analyst_comment,
                disputeReason: data.dispute_reason,
                // Manual Sim/Não operational indicators (outside the QA score).
                slaMetrics: data.sla_metrics || null,
            }

            setEvaluation(transformedEval)

            // Fetch the evaluation's OWN template (by template_id) so we render
            // v1 rows with v1 statements and v2 rows with v2 statements. Legacy
            // v1 rows never backfilled (template_id null) fall back gracefully.
            if (data.template_id) {
                const { data: tpl, error: tplError } = await supabase
                    .from('evaluation_templates')
                    .select(TEMPLATE_SELECT)
                    .eq('id', data.template_id)
                    .order('sort_order', { referencedTable: 'template_criteria', ascending: true })
                    .maybeSingle()

                if (tplError) {
                    console.error('Error loading template:', tplError)
                    setTemplate(null)
                } else if (tpl) {
                    setTemplate({
                        id: tpl.id,
                        code: tpl.code,
                        name: tpl.name,
                        version: tpl.version,
                        criteria: normalizeCriteria(tpl.template_criteria),
                    })
                } else {
                    setTemplate(null)
                }
            } else {
                setTemplate(null)
            }
        } catch (err) {
            console.error('Error loading evaluation:', err)
            setError('Erro ao carregar avaliação')
        } finally {
            setLoading(false)
        }
    }

    const handleAcknowledge = async () => {
        if (!comment.trim()) return

        // Access control: Only allow acknowledgment if analyst email matches
        if (isAnalyst && evaluation?.analystEmail !== userProfile?.email) {
            showToast('Você não tem permissão para dar aceite nesta avaliação', 'error')
            return
        }

        setSubmitting(true)
        try {
            const { error: updateError } = await supabase
                .from('evaluations')
                .update({
                    analyst_acknowledged: true,
                    acknowledged_at: new Date().toISOString(),
                    analyst_comment: comment,
                    dispute_reason: null,
                    status: 'acknowledged'
                })
                .eq('id', id)

            if (updateError) throw updateError

            setEvaluation(prev => ({
                ...prev,
                acknowledged: true,
                analystComment: comment,
                disputeReason: null,
                scores: { ...prev.scores, status: 'acknowledged' }
            }))
            showToast('Ciência confirmada com sucesso!', 'success')
            setComment('')
        } catch (err) {
            console.error('Error acknowledging:', err)
            showToast(err.message || 'Erro ao confirmar ciência', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDispute = async () => {
        if (!comment.trim()) return

        if (isAnalyst && evaluation?.analystEmail !== userProfile?.email) {
            showToast('Você não tem permissão para contestar esta avaliação', 'error')
            return
        }

        setSubmitting(true)
        try {
            const { error: updateError } = await supabase
                .from('evaluations')
                .update({
                    analyst_acknowledged: false,
                    analyst_comment: null,
                    dispute_reason: comment,
                    status: 'disputed'
                })
                .eq('id', id)

            if (updateError) throw updateError

            setEvaluation(prev => ({
                ...prev,
                acknowledged: false,
                analystComment: null,
                disputeReason: comment,
                scores: { ...prev.scores, status: 'disputed' }
            }))
            showToast('Contestação registrada com sucesso!', 'success')
            setComment('')
            setDisputeMode(false)
        } catch (err) {
            console.error('Error disputing:', err)
            showToast(err.message || 'Erro ao registrar contestação', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async () => {
        // Access control: Only admins and evaluators can delete
        if (!isAdmin && !isEvaluator) {
            showToast('Você não tem permissão para excluir avaliações', 'error')
            setShowDeleteModal(false)
            return
        }

        setIsDeleting(true)
        try {
            await deleteEvaluation(id)
            showToast('Avaliação excluída com sucesso!', 'success')
            // Redirect to dashboard after successful deletion
            setTimeout(() => {
                navigate('/dashboard')
            }, 1000)
        } catch (err) {
            console.error('Error deleting evaluation:', err)
            showToast(err.message || 'Erro ao excluir avaliação', 'error')
            setIsDeleting(false)
            setShowDeleteModal(false)
        }
    }

    // Group the evaluation's template into scored blocks (sort_order) + auto-fail list.
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

    if (loading) {
        return (
            <div className="animate-pulse space-y-6">
                <div className="h-32 bg-slate-200 rounded-2xl"></div>
                <div className="h-64 bg-slate-200 rounded-2xl"></div>
            </div>
        )
    }

    if (error || !evaluation) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto">
                <Link
                    to={isAnalyst ? '/' : '/dashboard'}
                    className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                </Link>
                <div className="clean-card rounded-2xl p-8 text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">Avaliação não encontrada</h2>
                    <p className="text-slate-600">{error || 'Não foi possível carregar esta avaliação.'}</p>
                </div>
            </div>
        )
    }

    const statusDisplay = getAcknowledgmentDisplay(evaluation?.acknowledged, evaluation?.scores?.status)

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Back Button and Delete Button */}
            <div className="flex justify-between items-center">
                <Link
                    to={isAnalyst ? '/' : '/dashboard'}
                    className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                </Link>

                {/* Edit & Delete Buttons - Only visible to Admins and Evaluators */}
                {(isAdmin || isEvaluator) && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate(`/editar-avaliacao/${id}`)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-amber-600 hover:text-white hover:bg-amber-500 border border-amber-400 rounded-xl transition font-medium"
                        >
                            <Edit3 className="w-4 h-4" />
                            Editar
                        </button>
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-red-600 hover:text-white hover:bg-red-600 border border-red-600 rounded-xl transition font-medium"
                        >
                            <Trash2 className="w-4 h-4" />
                            Excluir
                        </button>
                    </div>
                )}
            </div>

            {/* Header Card */}
            <div className="clean-card rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center flex-wrap gap-3">
                            <FileText className="w-5 h-5 text-navita-blue" />
                            <span className="text-lg font-mono font-bold text-slate-900">{evaluation?.ticketId}</span>
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border ${statusDisplay.bgClass}`}>
                                {statusDisplay.text}
                            </span>
                            {evaluation?.area && (
                                <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase border bg-slate-100 text-slate-600 border-slate-200">
                                    {evaluation.area}
                                </span>
                            )}
                            {evaluation?.hasCriticalFlag && (
                                <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase border bg-red-50 text-red-600 border-red-200 inline-flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Flag Crítica
                                </span>
                            )}
                        </div>
                        <p className="text-slate-600">{evaluation?.ticketSubject}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Score Final</p>
                        <p className={`text-4xl font-display font-bold ${evaluation?.scores?.final >= 90 ? 'text-navita-green' :
                            evaluation?.scores?.final >= 75 ? 'text-navita-blue' :
                                'text-red-500'
                            }`}>
                            {evaluation?.scores?.final}%
                        </p>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{evaluation?.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{evaluation?.analyst}</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                        <span className="text-xs text-slate-500">Avaliador:</span>
                        <span className="text-sm font-medium text-slate-700">{evaluation?.evaluator}</span>
                    </div>
                </div>
            </div>

            {/* Detailed Checklist - driven by the evaluation's OWN template */}
            {template ? (
                <>
                    <div className="clean-card rounded-2xl p-6">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
                            <h3 className="text-lg font-semibold text-slate-900">Critérios Avaliados</h3>
                            <span className="text-xs font-mono text-slate-400">{template.name} · v{template.version}</span>
                        </div>

                        {blocks.map((block, index) => {
                            const rawScore = evaluation?.blockScores?.[block.block]
                            const blockScore = rawScore == null ? null : Number(rawScore)
                            const accents = [
                                { border: 'border-l-navita-blue', bg: 'bg-blue-50/50' },
                                { border: 'border-l-navita-green', bg: 'bg-green-50/50' },
                                { border: 'border-l-slate-700', bg: 'bg-slate-50' },
                                { border: 'border-l-navita-purple', bg: 'bg-purple-50/50' },
                                { border: 'border-l-amber-500', bg: 'bg-amber-50/50' },
                            ]
                            const colors = accents[index % accents.length]

                            return (
                                <div key={block.block} className={`mb-6 last:mb-0 border-l-4 ${colors.border} ${colors.bg} rounded-r-xl p-4`}>
                                    <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                                        <div className="flex items-baseline gap-2 flex-wrap">
                                            <h4 className="font-semibold text-slate-800">{block.label || block.block}</h4>
                                            {block.weight != null && (
                                                <span className="text-xs font-mono text-slate-400">Peso {Number(block.weight)}%</span>
                                            )}
                                        </div>
                                        {blockScore != null && (
                                            <span className={`text-2xl font-bold ${scoreColorClass(blockScore)}`}>
                                                {blockScore}%
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {block.items.map((c) => (
                                            <CriterionDisplayRow
                                                key={c.criterion_key}
                                                statement={c.statement}
                                                weight={Number(c.weight)}
                                                answer={evaluation?.itemsByKey?.[c.criterion_key]}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Flags Críticas — auto-fail criteria, outside the block math */}
                    {autoFails.length > 0 && (
                        <div className={`clean-card rounded-2xl p-6 border-l-4 ${evaluation?.hasCriticalFlag ? 'border-red-500' : 'border-slate-200'}`}>
                            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    <AlertTriangle className={`w-5 h-5 ${evaluation?.hasCriticalFlag ? 'text-red-500' : 'text-slate-400'}`} />
                                    Flags Críticas
                                </h3>
                                {evaluation?.hasCriticalFlag ? (
                                    <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase border bg-red-50 text-red-600 border-red-200">
                                        Flag ativa
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase border bg-green-50 text-green-600 border-green-200">
                                        Nenhuma violação
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 mb-4">
                                Violações não entram no cálculo da nota, mas levantam a flag crítica.
                            </p>
                            <div className="space-y-2">
                                {autoFails.map((c) => {
                                    const flagged = evaluation?.itemsByKey?.[c.criterion_key]?.value === 5
                                    return (
                                        <div
                                            key={c.criterion_key}
                                            className={`flex items-center justify-between gap-4 py-2 px-3 rounded-lg border ${flagged ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}
                                        >
                                            <span className={`text-sm ${flagged ? 'text-red-700 font-medium' : 'text-slate-600'}`}>
                                                {c.statement}
                                            </span>
                                            {flagged ? (
                                                <span className="text-xs font-bold uppercase text-red-600 flex items-center gap-1 flex-shrink-0">
                                                    <AlertTriangle className="w-4 h-4" /> Violação
                                                </span>
                                            ) : (
                                                <span className="text-xs font-medium uppercase text-slate-400 flex-shrink-0">OK</span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Painel lateral de SLAs — manual, fora do score (spec §3.1) */}
                    <SlaSidePanel values={evaluation?.slaMetrics || {}} />
                </>
            ) : (
                /* Fallback for legacy v1 rows never backfilled (template_id null):
                   show raw criterion_key + value without statements. */
                <div className="clean-card rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Critérios Avaliados</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        Esta avaliação não está vinculada a um template; exibindo os itens registrados.
                    </p>
                    <div className="space-y-2">
                        {(evaluation?.rawItems || []).length === 0 && (
                            <p className="text-sm text-slate-500">Nenhum item registrado.</p>
                        )}
                        {(evaluation?.rawItems || []).map((item) => (
                            <CriterionDisplayRow
                                key={item.criterion_key}
                                statement={item.criterion_key}
                                mono
                                answer={{ value: item.value, is_na: item.is_na === true }}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Feedback */}
            <div className="clean-card rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Feedback do Avaliador</h3>
                <p className="text-slate-700 bg-slate-50 p-4 rounded-xl whitespace-pre-wrap">{evaluation?.feedback}</p>
            </div>

            {/* Analyst Acknowledgment / Dispute Section */}
            {isAnalyst && (
                <div className="clean-card rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-navita-green" />
                        Confirmação de Ciência
                    </h3>

                    {/* Already acknowledged */}
                    {evaluation?.scores?.status === 'acknowledged' && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <p className="text-green-700 font-semibold mb-1 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> Avaliação confirmada
                            </p>
                            {evaluation?.analystComment && (
                                <p className="text-sm text-green-700 mt-1">{evaluation.analystComment}</p>
                            )}
                        </div>
                    )}

                    {/* Already disputed */}
                    {evaluation?.scores?.status === 'disputed' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <p className="text-amber-700 font-semibold mb-1 flex items-center gap-2">
                                <XCircle className="w-4 h-4" /> Avaliação contestada
                            </p>
                            {evaluation?.disputeReason && (
                                <p className="text-sm text-amber-700 mt-1">{evaluation.disputeReason}</p>
                            )}
                        </div>
                    )}

                    {/* Pending — show confirm + dispute buttons */}
                    {evaluation?.scores?.status !== 'acknowledged' && evaluation?.scores?.status !== 'disputed' && (
                        <>
                            <p className="text-slate-600 mb-4">
                                Leia o feedback e confirme sua ciência, ou registre uma contestação se discordar.
                            </p>

                            {/* Toggle buttons for mode */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    type="button"
                                    onClick={() => setDisputeMode(false)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm transition ${
                                        !disputeMode
                                            ? 'bg-navita-green text-white border-navita-green shadow-lg shadow-green-900/20'
                                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Confirmar Ciência
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDisputeMode(true)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm transition ${
                                        disputeMode
                                            ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-900/20'
                                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    Contestar
                                </button>
                            </div>

                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={disputeMode
                                    ? 'Descreva o motivo da contestação...'
                                    : 'Escreva seu comentário (opcional, mas recomendado)...'}
                                rows={3}
                                className={`w-full border rounded-xl px-4 py-3 text-sm outline-none resize-none mb-4 transition ${
                                    disputeMode
                                        ? 'border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                                        : 'border-slate-200 focus:border-navita-blue focus:ring-2 focus:ring-navita-blue/20'
                                }`}
                            />

                            {disputeMode ? (
                                <button
                                    onClick={handleDispute}
                                    disabled={!comment.trim() || submitting}
                                    className="w-full sm:w-auto px-6 py-2.5 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Registrando...' : 'Registrar Contestação'}
                                </button>
                            ) : (
                                <button
                                    onClick={handleAcknowledge}
                                    disabled={submitting}
                                    className="w-full sm:w-auto px-6 py-2.5 bg-navita-green text-white font-medium rounded-xl hover:bg-green-600 transition shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? 'Confirmando...' : 'Confirmar Ciência'}
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Dispute reason visible to evaluators/admins too */}
            {(isAdmin || isEvaluator) && evaluation?.scores?.status === 'disputed' && (
                <div className="clean-card rounded-2xl p-6 border-l-4 border-amber-400">
                    <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-amber-500" />
                        Motivo da Contestação
                    </h3>
                    <p className="text-slate-700 bg-amber-50 p-4 rounded-xl whitespace-pre-wrap">
                        {evaluation?.disputeReason || '—'}
                    </p>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                title="Excluir Avaliação"
                message={`Tem certeza que deseja excluir a avaliação ${evaluation?.ticketId}? Esta ação não pode ser desfeita e todos os dados relacionados serão permanentemente removidos.`}
                confirmText="Excluir"
                cancelText="Cancelar"
                isDestructive={true}
                isLoading={isDeleting}
            />
        </div>
    )
}

function scoreColorClass(score) {
    if (score >= 90) return 'text-navita-green'
    if (score >= 75) return 'text-navita-blue'
    return 'text-red-500'
}

/**
 * One criterion row in the read-only detail view. Renders three states:
 *  - is_na === true   → neutral "N/A" chip (never a 0/No)
 *  - value === 5      → Sim / pass (green check)
 *  - value === 1      → Não / fail (red x)
 *  - anything else    → "—" (unanswered / unknown)
 */
function CriterionDisplayRow({ statement, weight, answer, mono = false }) {
    const isNa = answer?.is_na === true
    const isYes = !isNa && answer?.value === 5
    const isNo = !isNa && answer?.value === 1

    let icon
    let label
    if (isNa) {
        icon = (
            <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 12H6" />
            </svg>
        )
        label = <span className="text-xs font-bold uppercase text-slate-500 flex-shrink-0">N/A</span>
    } else if (isYes) {
        icon = (
            <svg className="w-5 h-5 text-navita-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
        )
        label = <span className="text-xs font-bold uppercase text-navita-green flex-shrink-0">Sim</span>
    } else if (isNo) {
        icon = (
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
        )
        label = <span className="text-xs font-bold uppercase text-red-500 flex-shrink-0">Não</span>
    } else {
        icon = <span className="w-5 h-5 flex-shrink-0 text-center text-slate-300 font-bold">—</span>
        label = <span className="text-xs font-bold uppercase text-slate-300 flex-shrink-0">—</span>
    }

    return (
        <div className="flex items-center justify-between gap-3 py-2 px-3 bg-white rounded-lg">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                {icon}
                <span className={`text-sm text-slate-700 ${mono ? 'font-mono' : ''}`}>{statement}</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
                {typeof weight === 'number' && !Number.isNaN(weight) && (
                    <span className="text-xs font-mono text-slate-400">{weight}%</span>
                )}
                {label}
            </div>
        </div>
    )
}

import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, User, Calendar, CheckCircle2, AlertCircle, Trash2, Edit3, MessageSquare, XCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useEvaluations } from '../hooks/useEvaluations'
import { supabase } from '../lib/supabase'
import { FRAMEWORK, getStatusDisplay, getAcknowledgmentDisplay } from '../lib/scoring'
import { useToast } from '../components/Toast'
import { ConfirmModal } from '../components/Modal'

export function EvaluationDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { userProfile, isAnalyst, isAdmin, isEvaluator } = useAuth()
    const { deleteEvaluation } = useEvaluations()
    const { showToast } = useToast()
    const [evaluation, setEvaluation] = useState(null)
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
                scores: {
                    communication: data.score_communication || 0,
                    efficiency: data.score_efficiency || 0,
                    process: data.score_process || 0,
                    final: data.final_score || 0,
                    status: data.status || 'pending'
                },
                values: data.items?.reduce((acc, item) => {
                    acc[item.criterion_key] = item.value
                    return acc
                }, {}) || {},
                feedback: data.feedback || 'Sem feedback.',
                acknowledged: data.analyst_acknowledged || false,
                analystComment: data.analyst_comment,
                disputeReason: data.dispute_reason
            }

            setEvaluation(transformedEval)
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
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-navita-blue" />
                            <span className="text-lg font-mono font-bold text-slate-900">{evaluation?.ticketId}</span>
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border ${statusDisplay.bgClass}`}>
                                {statusDisplay.text}
                            </span>
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

            {/* Detailed Checklist - All Criteria Visible */}
            <div className="clean-card rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">Critérios Avaliados</h3>

                {Object.entries(FRAMEWORK).map(([pillarKey, pillar]) => {
                    const pillarScore = evaluation?.scores?.[pillarKey] || 0
                    const colorClasses = {
                        blue: { border: 'border-l-navita-blue', bg: 'bg-blue-50/50' },
                        green: { border: 'border-l-navita-green', bg: 'bg-green-50/50' },
                        slate: { border: 'border-l-slate-700', bg: 'bg-slate-50' }
                    }
                    const colors = colorClasses[pillar.color] || colorClasses.slate

                    return (
                        <div key={pillarKey} className={`mb-6 last:mb-0 border-l-4 ${colors.border} ${colors.bg} rounded-r-xl p-4`}>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-slate-800">{pillar.name}</h4>
                                <span className={`text-2xl font-bold ${pillarScore >= 90 ? 'text-navita-green' : pillarScore >= 75 ? 'text-navita-blue' : 'text-red-500'}`}>
                                    {pillarScore}%
                                </span>
                            </div>

                            <div className="space-y-2">
                                {pillar.items.map(item => {
                                    const value = evaluation?.values?.[item.id] || 1
                                    const isChecked = value >= 3 // 3-5 = Yes, 1-2 = No

                                    return (
                                        <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                                            <div className="flex items-center gap-3 flex-1">
                                                {isChecked ? (
                                                    <svg className="w-5 h-5 text-navita-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                )}
                                                <span className="text-sm text-slate-700">{item.text}</span>
                                            </div>
                                            <span className="text-xs font-mono text-slate-400 ml-4">
                                                {(item.weight * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

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

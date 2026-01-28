import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, User, Calendar, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { FRAMEWORK, getStatusDisplay } from '../lib/scoring'
import { useToast } from '../components/Toast'

export function EvaluationDetail() {
    const { id } = useParams()
    const { userProfile, isAnalyst } = useAuth()
    const { showToast } = useToast()
    const [evaluation, setEvaluation] = useState(null)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

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
                analystComment: data.analyst_comment
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
                    status: 'acknowledged'
                })
                .eq('id', id)

            if (updateError) throw updateError

            setEvaluation(prev => ({
                ...prev,
                acknowledged: true,
                analystComment: comment
            }))
            showToast('Ciência confirmada com sucesso!', 'success')
            setComment('') // Clear comment after success
        } catch (err) {
            console.error('Error acknowledging:', err)
            showToast(err.message || 'Erro ao confirmar ciência', 'error')
        } finally {
            setSubmitting(false)
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

    const statusDisplay = getStatusDisplay(evaluation?.scores?.status)

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Back Button */}
            <Link
                to={isAnalyst ? '/' : '/dashboard'}
                className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
            >
                <ArrowLeft className="w-4 h-4" />
                Voltar
            </Link>

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

            {/* Analyst Acknowledgment (only for analysts viewing their own evaluations) */}
            {isAnalyst && (
                <div className="clean-card rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-navita-green" />
                        Confirmação de Ciência
                    </h3>

                    {evaluation?.acknowledged ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <p className="text-green-700 font-medium mb-2">✓ Avaliação confirmada</p>
                            <p className="text-sm text-green-600">{evaluation?.analystComment || comment}</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-slate-600 mb-4">
                                Adicione um comentário para confirmar que você leu e entendeu o feedback.
                            </p>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Escreva seu comentário..."
                                rows={3}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-navita-blue focus:ring-2 focus:ring-navita-blue/20 outline-none resize-none mb-4"
                            />
                            <button
                                onClick={handleAcknowledge}
                                disabled={!comment.trim() || submitting}
                                className="w-full sm:w-auto px-6 py-2.5 bg-navita-green text-white font-medium rounded-xl hover:bg-green-600 transition shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Confirmando...' : 'Confirmar Ciência'}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUsers } from '../hooks/useUsers'
import { useEvaluations } from '../hooks/useEvaluations'
import { supabase } from '../lib/supabase'
import { FRAMEWORK } from '../lib/scoring'
import { useToast } from '../components/Toast'

export function NewAudit() {
    const navigate = useNavigate()
    const { id: editId } = useParams() // present when editing
    const isEditMode = Boolean(editId)

    const { userProfile } = useAuth()
    const { users: allUsers } = useUsers()
    const toast = useToast()
    const { createEvaluation } = useEvaluations()

    const [analystId, setAnalystId] = useState('')
    const [ticketId, setTicketId] = useState('')
    const [ticketSubject, setTicketSubject] = useState('')
    const [feedback, setFeedback] = useState('')
    const [criticalPass, setCriticalPass] = useState(true)
    const [checkedItems, setCheckedItems] = useState({})
    const [finalScore, setFinalScore] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(isEditMode)

    const analysts = allUsers.filter(u => u.role === 'analyst' && u.is_active)

    // Load existing evaluation data in edit mode
    useEffect(() => {
        if (!isEditMode) return

        async function loadEvaluation() {
            try {
                setLoadingEdit(true)
                const { data, error } = await supabase
                    .from('evaluations')
                    .select(`*, items:evaluation_items(*)`)
                    .eq('id', editId)
                    .single()

                if (error) throw error
                if (!data) throw new Error('Avaliação não encontrada')

                // Pre-populate form fields
                setAnalystId(data.analyst_id || '')
                setTicketId(data.ticket_id || '')
                setTicketSubject(data.ticket_subject || '')
                setFeedback(data.feedback || '')

                // Reconstruct checkedItems from evaluation_items
                // value >= 3 means checked (value=5 = yes, value=1 = no)
                const items = {}
                ;(data.items || []).forEach(item => {
                    items[item.criterion_key] = item.value >= 3
                })
                setCheckedItems(items)

                // Detect critical pass from final_score
                // If score was 0 and there are items checked, it was a critical fail
                setCriticalPass(data.final_score > 0 || Object.values(items).every(v => !v))
            } catch (err) {
                console.error('[NewAudit] Error loading evaluation for edit:', err)
                toast.error('Erro ao carregar avaliação para edição')
                navigate('/dashboard')
            } finally {
                setLoadingEdit(false)
            }
        }

        loadEvaluation()
    }, [editId, isEditMode])

    useEffect(() => {
        calculateScore()
    }, [checkedItems, criticalPass])

    function calculateScore() {
        if (!criticalPass) {
            setFinalScore(0)
            return
        }

        let score = 0
        Object.keys(FRAMEWORK).forEach(section => {
            const sectionScore = FRAMEWORK[section].items.reduce((sum, item) => {
                return sum + (checkedItems[item.id] ? item.weight * 100 : 0)
            }, 0)
            score += sectionScore * FRAMEWORK[section].weight
        })

        setFinalScore(score)
    }

    function toggleItem(itemId) {
        setCheckedItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }))
    }

    function getStatusBadge() {
        if (!criticalPass) {
            return { text: 'Failed (Critical)', className: 'bg-red-100 text-red-600 border-red-200' }
        }
        if (finalScore >= 90) {
            return { text: 'Excellent', className: 'bg-green-50 text-navita-green border-green-200' }
        }
        if (finalScore >= 75) {
            return { text: 'Approved', className: 'bg-blue-50 text-navita-blue border-blue-200' }
        }
        return { text: 'Failed', className: 'bg-red-50 text-red-500 border-red-200' }
    }

    function getScoreColor() {
        if (!criticalPass) return 'text-red-500'
        if (finalScore >= 90) return 'text-navita-green'
        if (finalScore >= 75) return 'text-navita-blue'
        return 'text-red-500'
    }

    async function handleSubmit(e) {
        e.preventDefault()

        if (!analystId || !ticketId) {
            toast.error('Analista e Ticket são obrigatórios')
            return
        }

        setIsSubmitting(true)
        try {
            // Calculate pillar scores
            const calculatePillarScore = (sectionKey) => {
                const section = FRAMEWORK[sectionKey]
                let totalWeight = 0
                let achievedWeight = 0

                section.items.forEach(item => {
                    totalWeight += item.weight
                    if (checkedItems[item.id]) {
                        achievedWeight += item.weight
                    }
                })

                return totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 0
            }

            const communicationScore = calculatePillarScore('communication')
            const efficiencyScore = calculatePillarScore('efficiency')
            const processScore = calculatePillarScore('process')

            // Determine status based on score and critical pass
            let evaluationStatus = 'failed'
            if (criticalPass) {
                if (finalScore >= 90) evaluationStatus = 'excellent'
                else if (finalScore >= 75) evaluationStatus = 'approved'
                else evaluationStatus = 'failed'
            }

            // Build evaluation items list
            const items = []
            Object.keys(FRAMEWORK).forEach(section => {
                FRAMEWORK[section].items.forEach(item => {
                    items.push({
                        criterion_key: item.id,
                        value: checkedItems[item.id] ? 5 : 1,
                        notes: `Weight: ${(item.weight * 100).toFixed(0)}%`
                    })
                })
            })

            if (isEditMode) {
                // ── EDIT MODE ─────────────────────────────────────────────
                // 1. Update the evaluation, resetting acknowledgment state
                const { error: updateError } = await supabase
                    .from('evaluations')
                    .update({
                        analyst_id: analystId,
                        ticket_id: ticketId,
                        ticket_subject: ticketSubject || null,
                        score_communication: communicationScore,
                        score_efficiency: efficiencyScore,
                        score_process: processScore,
                        final_score: Math.round(finalScore * 100) / 100,
                        feedback,
                        status: evaluationStatus,
                        // Reset analyst acknowledgment so they must review again
                        analyst_acknowledged: false,
                        acknowledged_at: null,
                        analyst_comment: null,
                        dispute_reason: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editId)

                if (updateError) throw updateError

                // 2. Delete old items and re-insert updated ones
                const { error: deleteError } = await supabase
                    .from('evaluation_items')
                    .delete()
                    .eq('evaluation_id', editId)

                if (deleteError) throw deleteError

                const { error: insertError } = await supabase
                    .from('evaluation_items')
                    .insert(items.map(item => ({ ...item, evaluation_id: editId })))

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
                    score_communication: communicationScore,
                    score_efficiency: efficiencyScore,
                    score_process: processScore,
                    final_score: finalScore,
                    feedback,
                    status: evaluationStatus
                })

                const isDevMode = localStorage.getItem('devMode') === 'true'

                if (isDevMode) {
                    const mockDB = JSON.parse(localStorage.getItem('mockDB') || '{"evaluations":[],"evaluation_items":[]}')
                    const itemsWithIds = items.map(item => ({
                        ...item,
                        evaluation_id: evaluation.id,
                        id: crypto.randomUUID(),
                        created_at: new Date().toISOString()
                    }))
                    mockDB.evaluation_items.push(...itemsWithIds)
                    localStorage.setItem('mockDB', JSON.stringify(mockDB))
                    console.log('[NewAudit] Dev Mode: Saved', itemsWithIds.length, 'items to mockDB')
                } else {
                    await supabase
                        .from('evaluation_items')
                        .insert(items.map(item => ({ ...item, evaluation_id: evaluation.id })))
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

    const status = getStatusBadge()

    if (loadingEdit) {
        return (
            <div className="animate-pulse space-y-6 max-w-4xl mx-auto">
                <div className="h-16 bg-slate-200 rounded-2xl" />
                <div className="h-32 bg-slate-200 rounded-2xl" />
                <div className="h-64 bg-slate-200 rounded-2xl" />
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
                                <>Quality Framework <span className="text-navita-green">FY26</span></>
                            )}
                        </h1>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                            {isEditMode ? 'O analista precisará dar nova ciência após salvar' : 'Operations & Support Audit'}
                        </p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Final Score</p>
                            <div className="flex items-baseline justify-end gap-1">
                                <span className={`text-3xl font-display font-black ${getScoreColor()}`}>
                                    {finalScore.toFixed(1)}
                                </span>
                                <span className="text-sm font-bold text-slate-300">%</span>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wide border transition-colors ${status.className}`}>
                            {status.text}
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
                                    {analysts.map(analyst => (
                                        <option key={analyst.id} value={analyst.id}>{analyst.name}</option>
                                    ))}
                                </select>
                            </div>
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
                            <div className="md:col-span-2">
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
                            Evaluate each interaction based on the 3 pillars of excellence. The score is calculated automatically.
                        </p>
                    </div>

                    {/* Section 1: Communication */}
                    <QualitySection
                        title="1. Communication & Attitude"
                        subtitle="Soft skills and information clarity"
                        weight="35%"
                        color="blue"
                        items={FRAMEWORK.communication.items}
                        checkedItems={checkedItems}
                        onToggle={toggleItem}
                        disabled={!criticalPass}
                    />

                    {/* Section 2: Efficiency */}
                    <QualitySection
                        title="2. Efficiency & Effectiveness"
                        subtitle="Resolution and response time"
                        weight="30%"
                        color="green"
                        items={FRAMEWORK.efficiency.items}
                        checkedItems={checkedItems}
                        onToggle={toggleItem}
                        disabled={!criticalPass}
                    />

                    {/* Section 3: Process */}
                    <section className="clean-card rounded-2xl overflow-hidden">
                        <div className="bg-white border-b border-slate-100 p-6 flex justify-between items-center relative">
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-800"></div>
                            <div>
                                <h3 className="text-xl font-display font-bold text-slate-800">3. Processes & Tools</h3>
                                <p className="text-sm text-slate-500">Adherence to mandatory flows</p>
                            </div>
                            <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold border border-slate-200">
                                Weight: 35%
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="space-y-2 mb-8" style={{ opacity: criticalPass ? 1 : 0.5, pointerEvents: criticalPass ? 'auto' : 'none' }}>
                                {FRAMEWORK.process.items.map(item => (
                                    <ChecklistItem
                                        key={item.id}
                                        item={item}
                                        checked={checkedItems[item.id]}
                                        onToggle={() => toggleItem(item.id)}
                                    />
                                ))}
                            </div>

                            {/* Critical Fail */}
                            <div className="bg-red-50 rounded-xl p-6 border border-red-100 flex items-center justify-between gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <h4 className="font-bold text-red-700">Critical Item: Auto-Fail</h4>
                                    </div>
                                    <p className="text-sm text-red-600/80">
                                        Did the analyst confirm the solution and offer additional help? (Mandatory)
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-red-100 shadow-sm">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Approved?</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={criticalPass}
                                            onChange={(e) => setCriticalPass(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>

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

function QualitySection({ title, subtitle, weight, color, items, checkedItems, onToggle, disabled }) {
    const colorClasses = {
        blue: { border: 'bg-navita-blue', badge: 'bg-blue-50 text-navita-blue border-blue-100' },
        green: { border: 'bg-navita-green', badge: 'bg-green-50 text-navita-green border-green-100' },
        slate: { border: 'bg-slate-800', badge: 'bg-slate-100 text-slate-600 border-slate-200' }
    }

    return (
        <section className="clean-card rounded-2xl overflow-hidden">
            <div className="bg-white border-b border-slate-100 p-6 flex justify-between items-center relative">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${colorClasses[color].border}`}></div>
                <div>
                    <h3 className="text-xl font-display font-bold text-slate-800">{title}</h3>
                    <p className="text-sm text-slate-500">{subtitle}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${colorClasses[color].badge}`}>
                    Weight: {weight}
                </div>
            </div>
            <div className="p-6 space-y-2" style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
                {items.map(item => (
                    <ChecklistItem
                        key={item.id}
                        item={item}
                        checked={checkedItems[item.id]}
                        onToggle={() => onToggle(item.id)}
                    />
                ))}
            </div>
        </section>
    )
}

function ChecklistItem({ item, checked, onToggle }) {
    return (
        <div
            onClick={onToggle}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition group cursor-pointer"
        >
            <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition">
                    {item.text}
                </p>
            </div>
            <div className="flex items-center gap-6">
                <span className="text-xs font-mono text-slate-300 font-bold">{(item.weight * 100).toFixed(0)}%</span>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={checked || false}
                        onChange={onToggle}
                        onClick={(e) => e.stopPropagation()}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navita-green"></div>
                </label>
            </div>
        </div>
    )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUsers } from '../hooks/useUsers'
import { useEvaluations } from '../hooks/useEvaluations'
import { supabase } from '../lib/supabase'
import { FRAMEWORK } from '../lib/scoring'
import { useToast } from '../components/Toast'

export function NewAudit() {
    const navigate = useNavigate()
    const { userProfile } = useAuth()
    const { users: allUsers } = useUsers() // Renamed to avoid conflict with filtered 'analysts'
    const toast = useToast()
    const { createEvaluation } = useEvaluations()

    const [analystId, setAnalystId] = useState('')
    const [ticketId, setTicketId] = useState('')
    const [feedback, setFeedback] = useState('')
    const [criticalPass, setCriticalPass] = useState(true)
    const [checkedItems, setCheckedItems] = useState({})
    const [finalScore, setFinalScore] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const analysts = allUsers.filter(u => u.role === 'analyst' && u.is_active)

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
                // Each item contributes its weight (0-1) to the section score
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

            // Create evaluation with evaluator_id and pillar scores
            const evaluation = await createEvaluation({
                analyst_id: analystId,
                evaluator_id: userProfile.id,
                ticket_id: ticketId,
                score_communication: communicationScore,
                score_efficiency: efficiencyScore,
                score_process: processScore,
                final_score: finalScore,
                feedback,
                status: criticalPass ? (finalScore >= 90 ? 'excellent' : finalScore >= 75 ? 'approved' : 'failed') : 'failed'
            })

            // Create evaluation items - save ALL items (checked and unchecked)
            const items = []
            Object.keys(FRAMEWORK).forEach(section => {
                FRAMEWORK[section].items.forEach(item => {
                    items.push({
                        evaluation_id: evaluation.id,
                        criterion_key: item.id,
                        value: checkedItems[item.id] ? 5 : 1, // 5 = Yes (checked), 1 = No (unchecked) - matches DB constraint
                        notes: `Weight: ${(item.weight * 100).toFixed(0)}%` // Store percentage in notes
                    })
                })
            })

            // Insert all evaluation items
            const isDevMode = localStorage.getItem('devMode') === 'true'

            if (isDevMode) {
                // Dev Mode: Save to localStorage
                const mockDB = JSON.parse(localStorage.getItem('mockDB') || '{"evaluations":[],"evaluation_items":[]}')

                // Add IDs and timestamps to items
                const itemsWithIds = items.map(item => ({
                    ...item,
                    id: crypto.randomUUID(),
                    created_at: new Date().toISOString()
                }))

                mockDB.evaluation_items.push(...itemsWithIds)
                localStorage.setItem('mockDB', JSON.stringify(mockDB))

                console.log('[NewAudit] Dev Mode: Saved', itemsWithIds.length, 'items to mockDB')
            } else {
                // Production Mode: Save to Supabase
                await supabase.from('evaluation_items').insert(items)

                // Send email notification to analyst
                try {
                    const analyst = analysts.find(a => a.id === analystId)
                    if (analyst?.email) {
                        const { data: { session } } = await supabase.auth.getSession()

                        await fetch(
                            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification`,
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${session?.access_token}`,
                                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    evaluationId: evaluation.id,
                                    analystEmail: analyst.email,
                                    analystName: analyst.name,
                                    ticketId,
                                    finalScore: Math.round(finalScore),
                                    feedback: feedback || 'Sem feedback adicional.'
                                })
                            }
                        )
                        console.log('[NewAudit] Email notification sent to:', analyst.email)
                    }
                } catch (emailError) {
                    // Don't block evaluation creation if email fails
                    console.error('[NewAudit] Email notification failed:', emailError)
                }
            }

            // Show success toast and navigate after a brief delay
            toast.success('Avaliação criada com sucesso!')
            setTimeout(() => {
                navigate('/dashboard')
            }, 1500) // 1.5s delay to show toast
        } catch (err) {
            console.error('[NewAudit] Error:', err)
            toast.error(err.message || 'Erro ao criar avaliação')
        } finally {
            setIsSubmitting(false)
        }
    }

    const status = getStatusBadge()

    return (
        <div className="min-h-screen pb-20">
            {/* Sticky Header */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 -mt-8 mb-8">
                <div className="max-w-4xl mx-auto py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-display font-bold text-slate-900">
                            Quality Framework <span className="text-navita-green">FY26</span>
                        </h1>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                            Operations & Support Audit
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
                {/* Form Header */}
                <form onSubmit={handleSubmit} className="space-y-8">
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
                            onClick={() => navigate('/dashboard')}
                            className="flex-1 px-6 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 font-medium transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-navita-blue text-white px-6 py-3 rounded-xl hover:bg-navita-dark-blue disabled:opacity-50 font-medium transition shadow-lg shadow-blue-900/20"
                        >
                            {isSubmitting ? 'Salvando...' : 'Criar Avaliação'}
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

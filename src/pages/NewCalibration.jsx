import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUsers } from '../hooks/useUsers'
import { useTemplates } from '../hooks/useTemplates'
import { useCalibration } from '../hooks/useCalibration'
import { useToast } from '../components/Toast'
import { Scale, Users } from 'lucide-react'

export function NewCalibration() {
    const navigate = useNavigate()
    const toast = useToast()
    const { userProfile, isAdmin, isEvaluator } = useAuth()
    const { users: allUsers } = useUsers()
    const { templates, loading: templatesLoading } = useTemplates()
    const { createSession } = useCalibration()

    const [ticketId, setTicketId] = useState('')
    const [ticketSubject, setTicketSubject] = useState('')
    const [analystId, setAnalystId] = useState('')
    const [selectedTemplateId, setSelectedTemplateId] = useState('')
    const [evaluatorIds, setEvaluatorIds] = useState([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Analysts (for context only) and eligible participants (evaluators/admins).
    const analysts = useMemo(
        () => allUsers.filter((u) => u.role === 'analyst' && u.is_active),
        [allUsers]
    )
    const eligibleEvaluators = useMemo(
        () =>
            allUsers.filter(
                (u) => (u.role === 'evaluator' || u.role === 'admin') && u.is_active
            ),
        [allUsers]
    )

    // Default template selection to the first (active/newest) one.
    useEffect(() => {
        if (!selectedTemplateId && templates.length > 0) {
            setSelectedTemplateId(templates[0].id)
        }
    }, [templates, selectedTemplateId])

    // Guard: only admin or evaluator may create sessions.
    if (userProfile && !(isAdmin || isEvaluator)) {
        return <Navigate to="/calibracao" replace />
    }

    function toggleEvaluator(id) {
        setEvaluatorIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        )
    }

    async function handleSubmit(e) {
        e.preventDefault()

        if (!ticketId.trim()) {
            toast.error('Ticket ID é obrigatório')
            return
        }
        if (!selectedTemplateId) {
            toast.error('Selecione um template')
            return
        }
        if (evaluatorIds.length < 2) {
            toast.error('Selecione ao menos 2 avaliadores participantes')
            return
        }

        setIsSubmitting(true)
        try {
            const sessionId = await createSession({
                ticket_id: ticketId.trim(),
                ticket_subject: ticketSubject.trim() || null,
                analyst_id: analystId || null,
                template_id: selectedTemplateId,
                evaluatorIds,
            })

            toast.success('Sessão de calibração criada com sucesso!')
            navigate(`/calibracao/${sessionId}`)
        } catch (err) {
            console.error('[NewCalibration] Error:', err)
            toast.error(err.message || 'Erro ao criar sessão de calibração')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
                    <Scale className="w-6 h-6 text-navita-blue" />
                    Nova sessão de calibração
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Os avaliadores selecionados pontuarão o mesmo ticket de forma cega. Os
                    resultados ficam visíveis a todos quando o último enviar.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Session info card — mirrors NewAudit's "Informações da Auditoria" */}
                <div className="clean-card rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">
                        Informações da Sessão
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Ticket ID
                            </label>
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
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Assunto do Ticket{' '}
                                <span className="text-slate-400">(opcional)</span>
                            </label>
                            <input
                                type="text"
                                value={ticketSubject}
                                onChange={(e) => setTicketSubject(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                                placeholder="Ex: Problema com acesso ao sistema"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Analista <span className="text-slate-400">(opcional)</span>
                            </label>
                            <select
                                value={analystId}
                                onChange={(e) => setAnalystId(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                            >
                                <option value="">Selecione um analista</option>
                                {analysts.map((analyst) => (
                                    <option key={analyst.id} value={analyst.id}>
                                        {analyst.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Template
                            </label>
                            <select
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                                required
                            >
                                {templatesLoading && (
                                    <option value="">Carregando templates...</option>
                                )}
                                {!templatesLoading && templates.length === 0 && (
                                    <option value="">Nenhum template disponível</option>
                                )}
                                {templates.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} (v{t.version})
                                        {!t.is_active ? ' — aposentado' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Participants card */}
                <div className="clean-card rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                            <Users className="w-5 h-5 text-navita-blue" />
                            Avaliadores participantes
                        </h3>
                        <span
                            className={`text-xs font-bold px-3 py-1 rounded-full border ${
                                evaluatorIds.length >= 2
                                    ? 'bg-green-50 text-navita-green border-green-100'
                                    : 'bg-amber-50 text-amber-600 border-amber-100'
                            }`}
                        >
                            {evaluatorIds.length} selecionado
                            {evaluatorIds.length === 1 ? '' : 's'}
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">
                        Selecione ao menos 2. Você pode se incluir.
                    </p>

                    {eligibleEvaluators.length === 0 ? (
                        <p className="text-sm text-slate-400">
                            Nenhum avaliador disponível.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {eligibleEvaluators.map((u) => {
                                const checked = evaluatorIds.includes(u.id)
                                const isMe = u.id === userProfile?.id
                                return (
                                    <label
                                        key={u.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                            checked
                                                ? 'bg-blue-50 border-navita-blue'
                                                : 'border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleEvaluator(u.id)}
                                            className="w-4 h-4 rounded border-slate-300 text-navita-blue focus:ring-navita-blue"
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-800 truncate">
                                                {u.name}
                                                {isMe && (
                                                    <span className="text-navita-blue font-normal">
                                                        {' '}
                                                        (você)
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate">
                                                {u.email}
                                            </p>
                                        </div>
                                    </label>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Submit */}
                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/calibracao')}
                        className="flex-1 px-6 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 font-medium transition"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 text-white px-6 py-3 rounded-xl disabled:opacity-50 font-medium transition shadow-lg bg-navita-blue hover:bg-navita-dark-blue shadow-blue-900/20"
                    >
                        {isSubmitting ? 'Criando...' : 'Criar sessão'}
                    </button>
                </div>
            </form>
        </div>
    )
}

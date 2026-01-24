import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, TrendingUp, TrendingDown, Download } from 'lucide-react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts'
import { useAuth } from '../hooks/useAuth'
import { useEvaluations } from '../hooks/useEvaluations'

export function AnalystDetail() {
    const { id } = useParams()
    const { userProfile } = useAuth()
    const { getEvaluations } = useEvaluations()
    const [analyst, setAnalyst] = useState(null)
    const [evaluations, setEvaluations] = useState([])
    const [evolutionData, setEvolutionData] = useState([])
    const [loading, setLoading] = useState(true)

    const isAnalyst = userProfile?.role === 'analyst'
    // If analyst viewing their own profile
    const targetId = isAnalyst ? userProfile?.id : id

    useEffect(() => {
        if (targetId) {
            loadAnalystData()
        }
    }, [targetId])

    const loadAnalystData = async () => {
        try {
            // Fetch evaluations for this analyst
            const evals = await getEvaluations({ analystId: targetId })

            // Process evaluations for display
            const processedEvals = evals.map(e => ({
                id: e.id,
                ticketId: `#${e.ticket_id}`,
                date: new Date(e.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                score: e.final_score || 0,
                status: e.status || 'pending',
                evaluator: e.evaluator?.name || 'Avaliador',
                acknowledged: e.analyst_acknowledged || false
            }))

            setEvaluations(processedEvals)

            // Calculate stats
            const avgScore = evals.length > 0
                ? evals.reduce((sum, e) => sum + (e.final_score || 0), 0) / evals.length
                : 0

            setAnalyst({
                id: targetId,
                name: isAnalyst ? userProfile?.name : (evals[0]?.analyst?.name || 'Analista'),
                avgScore: Math.round(avgScore * 10) / 10,
                audits: evals.length,
                strengths: ['Conhecimento Técnico', 'Tempo de Resposta'],
                weaknesses: ['Empatia na comunicação', 'Documentação'],
            })

            // Build evolution data (last 4 months)
            const monthlyScores = {}
            evals.forEach(e => {
                const monthKey = new Date(e.created_at).toLocaleDateString('pt-BR', { month: 'short' })
                if (!monthlyScores[monthKey]) {
                    monthlyScores[monthKey] = { total: 0, count: 0 }
                }
                monthlyScores[monthKey].total += e.final_score || 0
                monthlyScores[monthKey].count++
            })

            const evolution = Object.entries(monthlyScores).map(([month, data]) => ({
                month: month.charAt(0).toUpperCase() + month.slice(1),
                score: Math.round(data.total / data.count)
            })).slice(-4)

            setEvolutionData(evolution.length > 0 ? evolution : [{ month: 'Atual', score: 0 }])

        } catch (error) {
            console.error('Error loading analyst data:', error)
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'excellent': return 'bg-green-50 text-green-600 border-green-200'
            case 'approved': return 'bg-blue-50 text-blue-600 border-blue-200'
            case 'failed': return 'bg-red-50 text-red-600 border-red-200'
            default: return 'bg-slate-50 text-slate-600 border-slate-200'
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

    return (
        <div className="space-y-6">
            {/* Back Button (only for non-analysts) */}
            {!isAnalyst && (
                <Link
                    to="/equipe"
                    className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para Equipe
                </Link>
            )}

            {/* Header Card */}
            <div className="clean-card rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-navita-blue flex items-center justify-center text-white font-bold text-3xl">
                        {analyst?.name?.charAt(0)}
                    </div>
                    <div className="flex-1">
                        <h1 className="text-2xl font-display font-bold text-slate-900">
                            {isAnalyst ? 'Meu Painel' : analyst?.name}
                        </h1>
                        <p className="text-slate-500">{analyst?.audits} auditorias este mês</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Média Geral</p>
                        <p className={`text-4xl font-display font-bold ${analyst?.avgScore >= 90 ? 'text-navita-green' :
                            analyst?.avgScore >= 75 ? 'text-navita-blue' :
                                'text-red-500'
                            }`}>
                            {analyst?.avgScore}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Evolution Chart */}
                <div className="clean-card rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Evolução</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={evolutionData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 12 }} />
                                <YAxis domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 12 }} />
                                <Tooltip />
                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="#0047AB"
                                    strokeWidth={3}
                                    dot={{ fill: '#0047AB', strokeWidth: 2, r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="clean-card rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Análise de Performance</h3>

                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="w-5 h-5 text-green-500" />
                                <h4 className="font-medium text-slate-700">Pontos Fortes</h4>
                            </div>
                            <ul className="space-y-2">
                                {analyst?.strengths?.map((item, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                                        <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingDown className="w-5 h-5 text-amber-500" />
                                <h4 className="font-medium text-slate-700">Pontos a Desenvolver</h4>
                            </div>
                            <ul className="space-y-2">
                                {analyst?.weaknesses?.map((item, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Evaluations Table */}
            <div className="clean-card rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Histórico de Avaliações</h3>
                    <button className="flex items-center gap-2 text-sm text-navita-blue hover:underline">
                        <Download className="w-4 h-4" />
                        Exportar
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ticket</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Avaliador</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {evaluations.map(evaluation => (
                                <tr key={evaluation.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${!evaluation.acknowledged && isAnalyst ? 'bg-amber-50/30' : ''}`}>
                                    <td className="py-3 px-4 text-sm text-slate-600">{evaluation.date}</td>
                                    <td className="py-3 px-4 text-sm font-mono text-slate-900">
                                        {evaluation.ticketId}
                                        {!evaluation.acknowledged && isAnalyst && (
                                            <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                                                Pendente
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-slate-600">{evaluation.evaluator}</td>
                                    <td className="py-3 px-4 text-sm font-bold text-slate-900">{evaluation.score}%</td>
                                    <td className="py-3 px-4">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-lg border ${getStatusColor(evaluation.status)}`}>
                                            {evaluation.status === 'excellent' ? 'Excelente' :
                                                evaluation.status === 'approved' ? 'Aprovado' : 'Reprovado'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <Link
                                            to={`/avaliacao/${evaluation.id}`}
                                            className={`text-sm hover:underline ${!evaluation.acknowledged && isAnalyst ? 'text-amber-600 font-medium' : 'text-navita-blue'}`}
                                        >
                                            {!evaluation.acknowledged && isAnalyst ? 'Dar Ciência' : 'Ver Detalhes'}
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

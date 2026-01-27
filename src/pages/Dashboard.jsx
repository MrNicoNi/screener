import { useState, useEffect } from 'react'
import { useEvaluations } from '../hooks/useEvaluations'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, ClipboardCheck, AlertTriangle, Plus, ArrowRight } from 'lucide-react'
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ResponsiveContainer
} from 'recharts'

export function Dashboard() {
    const { getDashboardStats, getAnalystRanking, getEvaluations } = useEvaluations()
    const { userProfile, isAnalyst } = useAuth()
    const [stats, setStats] = useState({
        avgScore: 0,
        totalAudits: 0,
        alerts: 0,
        trend: 0
    })
    const [radarData, setRadarData] = useState([
        { subject: 'Comunicação', score: 0, fullMark: 100 },
        { subject: 'Eficiência', score: 0, fullMark: 100 },
        { subject: 'Processos', score: 0, fullMark: 100 },
    ])
    const [recentEvaluations, setRecentEvaluations] = useState([])
    const [topAnalysts, setTopAnalysts] = useState([])
    const [personalScores, setPersonalScores] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (userProfile?.email) {
            loadDashboardData()
        }
    }, [userProfile?.email, userProfile?.role])

    const loadDashboardData = async () => {
        try {
            // For analysts, filter by their email; for others, show all data
            const filterOptions = isAnalyst ? { analystEmail: userProfile?.email } : {}

            // Load dashboard stats from Supabase
            const dashboardStats = await getDashboardStats(filterOptions)

            if (dashboardStats) {
                setStats({
                    avgScore: dashboardStats.avgScore,
                    totalAudits: dashboardStats.totalAudits,
                    alerts: dashboardStats.alerts,
                    trend: dashboardStats.trend
                })
                setRadarData(dashboardStats.radarData)
            }

            // Load analyst ranking or personal scores
            if (isAnalyst) {
                // For analysts, load their recent evaluations with scores
                const personalEvals = await getEvaluations({ analystEmail: userProfile?.email, limit: 5 })
                setPersonalScores(personalEvals.map(e => ({
                    id: e.id,
                    ticketId: `#${e.ticket_id}`,
                    score: Math.round(e.final_score || 0),
                    date: new Date(e.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                })))
            } else {
                // For admins/evaluators, load analyst ranking
                const ranking = await getAnalystRanking(3)
                setTopAnalysts(ranking)
            }

            // Load recent evaluations
            const recent = await getEvaluations({ ...filterOptions, limit: 5 })
            setRecentEvaluations(recent.map(e => ({
                id: e.id,
                ticketId: `#${e.ticket_id}`,
                analyst: e.analyst?.name || 'N/A',
                score: Math.round(e.final_score || 0),
                status: e.status || 'pending',
                date: new Date(e.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            })))

        } catch (error) {
            console.error('Error loading dashboard:', error)
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 bg-slate-200 rounded-2xl"></div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900">
                        Dashboard
                    </h1>
                    <p className="text-slate-500">
                        Visão geral da qualidade do time
                    </p>
                </div>
                {(userProfile?.role === 'admin' || userProfile?.role === 'evaluator') && (
                    <Link
                        to="/nova-auditoria"
                        className="flex items-center gap-2 px-4 py-2.5 bg-navita-blue text-white font-medium rounded-xl hover:bg-navita-dark-blue transition shadow-lg shadow-blue-900/20"
                    >
                        <Plus className="w-5 h-5" />
                        Nova Auditoria
                    </Link>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Média Geral */}
                <div className="clean-card rounded-2xl p-6">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-sm font-medium text-slate-500">Média Geral</p>
                        <div className={`flex items-center gap-1 text-sm font-medium ${stats.trend >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {stats.trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {Math.abs(stats.trend)}%
                        </div>
                    </div>
                    <p className="text-4xl font-display font-bold text-slate-900">
                        {stats.avgScore}%
                    </p>
                    <p className="text-xs text-slate-400 mt-1">vs mês anterior</p>
                </div>

                {/* Total Auditorias */}
                <div className="clean-card rounded-2xl p-6">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-sm font-medium text-slate-500">Auditorias</p>
                        <ClipboardCheck className="w-5 h-5 text-navita-blue" />
                    </div>
                    <p className="text-4xl font-display font-bold text-slate-900">
                        {stats.totalAudits}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">este mês</p>
                </div>

                {/* Alertas */}
                <div className="clean-card rounded-2xl p-6">
                    <div className="flex justify-between items-start mb-4">
                        <p className="text-sm font-medium text-slate-500">Alertas</p>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                    </div>
                    <p className="text-4xl font-display font-bold text-slate-900">
                        {stats.alerts}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">reprovações</p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radar Chart */}
                <div className="clean-card rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">
                        Radar de Qualidade
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="#E2E8F0" />
                                <PolarAngleAxis
                                    dataKey="subject"
                                    tick={{ fill: '#64748B', fontSize: 12 }}
                                />
                                <PolarRadiusAxis
                                    angle={30}
                                    domain={[0, 100]}
                                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                                />
                                <Radar
                                    name="Score"
                                    dataKey="score"
                                    stroke="#0047AB"
                                    fill="#0047AB"
                                    fillOpacity={0.3}
                                    strokeWidth={2}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Analysts or Personal Scores */}
                <div className="clean-card rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-slate-900">
                            {isAnalyst ? 'Minhas Últimas Avaliações' : 'Ranking do Mês'}
                        </h3>
                        {!isAnalyst && (
                            <Link
                                to="/equipe"
                                className="text-sm text-navita-blue hover:underline flex items-center gap-1"
                            >
                                Ver todos <ArrowRight className="w-4 h-4" />
                            </Link>
                        )}
                    </div>
                    <div className="space-y-3">
                        {isAnalyst ? (
                            // Personal scores for analysts
                            personalScores.length > 0 ? (
                                personalScores.map((evaluation) => (
                                    <Link
                                        key={evaluation.id}
                                        to={`/avaliacao/${evaluation.id}`}
                                        className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition"
                                    >
                                        <div className="flex-1">
                                            <p className="font-medium text-slate-900">{evaluation.ticketId}</p>
                                            <p className="text-xs text-slate-500">{evaluation.date}</p>
                                        </div>
                                        <p className={`text-lg font-bold ${evaluation.score >= 90 ? 'text-navita-green' :
                                            evaluation.score >= 75 ? 'text-navita-blue' :
                                                'text-red-500'
                                            }`}>{evaluation.score}%</p>
                                    </Link>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 text-center py-4">Nenhuma avaliação ainda</p>
                            )
                        ) : (
                            // Team ranking for admins/evaluators
                            topAnalysts.map((analyst, index) => (
                                <div
                                    key={analyst.id}
                                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition"
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-amber-100 text-amber-600' :
                                        index === 1 ? 'bg-slate-200 text-slate-600' :
                                            'bg-orange-100 text-orange-600'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-900">{analyst.name}</p>
                                        <p className="text-xs text-slate-500">{analyst.audits} auditorias</p>
                                    </div>
                                    <p className="text-lg font-bold text-navita-green">{analyst.score}%</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Evaluations */}
            <div className="clean-card rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                        Avaliações Recentes
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ticket</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Analista</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentEvaluations.map((evaluation) => (
                                <tr key={evaluation.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="py-3 px-4 text-sm text-slate-600">{evaluation.date}</td>
                                    <td className="py-3 px-4 text-sm font-mono text-slate-900">{evaluation.ticketId}</td>
                                    <td className="py-3 px-4 text-sm text-slate-900">{evaluation.analyst}</td>
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
                                            className="text-sm text-navita-blue hover:underline"
                                        >
                                            Ver
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

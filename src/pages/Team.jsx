import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, ChevronRight, AlertTriangle } from 'lucide-react'
import { useEvaluations } from '../hooks/useEvaluations'
import { useAuth } from '../hooks/useAuth'

export function Team() {
    const { getAnalystsWithStats, getCoverageAlerts } = useEvaluations()
    const { userProfile } = useAuth()
    const [analysts, setAnalysts] = useState([])
    const [coverageMap, setCoverageMap] = useState({})
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadAnalysts()
    }, [])

    const loadAnalysts = async () => {
        try {
            const [data, alerts] = await Promise.all([
                getAnalystsWithStats(),
                getCoverageAlerts()
            ])
            setAnalysts(data)
            // Index uncovered analysts by id for quick lookup
            const map = {}
            alerts.forEach(a => { map[a.id] = a })
            setCoverageMap(map)
        } catch (error) {
            console.error('Error loading analysts:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredAnalysts = analysts.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase())
    )

    const getScoreColor = (score) => {
        if (score >= 90) return 'text-navita-green'
        if (score >= 75) return 'text-navita-blue'
        return 'text-red-500'
    }

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-20 bg-slate-200 rounded-xl"></div>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900">Equipe</h1>
                    <p className="text-slate-500">Gerenciar analistas e ver performance</p>
                </div>
                {(userProfile?.role === 'admin' || userProfile?.role === 'evaluator') && (
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-navita-blue text-white font-medium rounded-xl hover:bg-navita-dark-blue transition shadow-lg shadow-blue-900/20">
                        <Plus className="w-5 h-5" />
                        Novo Analista
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar analista..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:border-navita-blue focus:ring-2 focus:ring-navita-blue/20 outline-none transition"
                />
            </div>

            {/* Analysts List */}
            <div className="clean-card rounded-2xl divide-y divide-slate-100">
                {filteredAnalysts.map(analyst => {
                    const coverage = coverageMap[analyst.id]
                    return (
                    <Link
                        key={analyst.id}
                        to={`/analista/${analyst.id}`}
                        className="flex items-center gap-4 p-4 hover:bg-slate-50/50 transition"
                    >
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-lg flex-shrink-0">
                            {analyst.name.charAt(0)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-slate-900 truncate">{analyst.name}</p>
                                {coverage && (
                                    <span
                                        title={coverage.reasons.join(' • ')}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-lg border bg-amber-50 border-amber-200 text-amber-700"
                                    >
                                        <AlertTriangle className="w-3 h-3" />
                                        Descoberto
                                    </span>
                                )}
                            </div>
                            {coverage ? (
                                <p className="text-xs text-amber-700 truncate">{coverage.reasons.join(' • ')}</p>
                            ) : (
                                <p className="text-sm text-slate-500">{analyst.audits} auditorias este mês</p>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="text-right flex-shrink-0">
                            <p className={`text-xl font-bold ${getScoreColor(analyst.avgScore)}`}>
                                {analyst.avgScore}%
                            </p>
                            <p className={`text-xs ${analyst.trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {analyst.trend >= 0 ? '+' : ''}{analyst.trend}%
                            </p>
                        </div>

                        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    </Link>
                    )
                })}

                {filteredAnalysts.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        Nenhum analista encontrado
                    </div>
                )}
            </div>
        </div>
    )
}

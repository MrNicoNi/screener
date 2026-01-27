import { TrendingUp, TrendingDown, Users, ClipboardCheck, AlertTriangle, ArrowRight } from 'lucide-react'

export function TeamPerformanceCard({ team, onClick }) {
    const getScoreColor = (score) => {
        if (score >= 90) return 'text-navita-green'
        if (score >= 75) return 'text-navita-blue'
        return 'text-red-500'
    }

    const getOffenderColor = (score) => {
        if (score >= 75) return 'text-amber-600'
        return 'text-red-600'
    }

    const hasData = team.totalAudits > 0

    return (
        <div className="clean-card rounded-2xl p-6 hover:shadow-lg transition-shadow">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">{team.name}</h3>
                <div className="flex items-center gap-1 text-sm text-slate-500">
                    <Users className="w-4 h-4" />
                    <span>{team.memberCount} {team.memberCount === 1 ? 'analista' : 'analistas'}</span>
                </div>
            </div>

            {hasData ? (
                <>
                    {/* Main Score */}
                    <div className="text-center mb-4">
                        <p className={`text-5xl font-display font-bold ${getScoreColor(team.avgScore)}`}>
                            {team.avgScore}%
                        </p>
                        <p className="text-sm text-slate-500 mt-1">Média Geral</p>

                        {/* Trend */}
                        <div className={`flex items-center justify-center gap-1 mt-2 text-sm font-medium ${team.trend >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {team.trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {team.trend >= 0 ? '+' : ''}{team.trend}% vs mês anterior
                        </div>
                    </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                            <ClipboardCheck className="w-4 h-4 text-navita-blue" />
                            <span className="text-slate-600">{team.totalAudits} auditorias</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span className="text-slate-600">{team.alerts} {team.alerts === 1 ? 'alerta' : 'alertas'}</span>
                        </div>
                    </div>

                    {/* Principal Offender */}
                    {team.principalOffender && team.principalOffender.name !== '—' && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">Ofensor Principal</p>
                            <p className={`text-sm font-semibold ${getOffenderColor(team.principalOffender.score)}`}>
                                🔴 {team.principalOffender.name} ({team.principalOffender.score}%)
                            </p>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-8">
                    <p className="text-slate-400 text-sm">Sem dados</p>
                    <p className="text-slate-400 text-xs mt-1">Nenhuma avaliação este mês</p>
                </div>
            )}

            {/* Footer Button */}
            <button
                onClick={() => onClick(team.id)}
                disabled={!hasData}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition ${hasData
                    ? 'bg-navita-blue text-white hover:bg-navita-dark-blue'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
            >
                Ver Dashboard do Time
                <ArrowRight className="w-4 h-4" />
            </button>
        </div>
    )
}

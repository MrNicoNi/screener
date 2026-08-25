import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCalibration } from '../hooks/useCalibration'
import { Scale, Plus, Users, CheckCircle2, Clock } from 'lucide-react'

function formatDate(value) {
    if (!value) return '—'
    try {
        return new Date(value).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        })
    } catch {
        return '—'
    }
}

function StatusBadge({ status }) {
    const closed = status === 'closed'
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                closed
                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                    : 'bg-green-50 text-navita-green border-green-100'
            }`}
        >
            {closed ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {closed ? 'Fechada' : 'Aberta'}
        </span>
    )
}

export function Calibrations() {
    const { isAdmin, isEvaluator } = useAuth()
    const { sessions, loading, error } = useCalibration()

    const canCreate = isAdmin || isEvaluator

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
                        <Scale className="w-6 h-6 text-navita-blue" />
                        Calibração
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Sessões de avaliação cega do mesmo ticket por múltiplos avaliadores.
                    </p>
                </div>
                {canCreate && (
                    <Link
                        to="/calibracao/nova"
                        className="inline-flex items-center gap-2 px-5 py-3 bg-navita-blue text-white rounded-xl hover:bg-navita-dark-blue font-medium transition shadow-lg shadow-blue-900/20"
                    >
                        <Plus className="w-4 h-4" />
                        Nova sessão
                    </Link>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div className="animate-pulse space-y-4">
                    <div className="h-24 bg-slate-200 rounded-2xl" />
                    <div className="h-24 bg-slate-200 rounded-2xl" />
                    <div className="h-24 bg-slate-200 rounded-2xl" />
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="clean-card rounded-2xl p-6 border border-red-100 bg-red-50/50">
                    <p className="text-sm text-red-600 font-medium">
                        Erro ao carregar sessões de calibração: {error}
                    </p>
                </div>
            )}

            {/* Empty state */}
            {!loading && !error && sessions.length === 0 && (
                <div className="clean-card rounded-2xl p-12 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <Scale className="w-7 h-7 text-slate-400" />
                        </div>
                    </div>
                    <h2 className="text-lg font-display font-bold text-slate-900 mb-2">
                        Nenhuma sessão de calibração
                    </h2>
                    <p className="text-slate-500 mb-6 max-w-md mx-auto">
                        Crie uma sessão para que vários avaliadores pontuem o mesmo ticket de forma
                        cega e comparem os resultados ao final.
                    </p>
                    {canCreate && (
                        <Link
                            to="/calibracao/nova"
                            className="inline-flex items-center gap-2 px-5 py-3 bg-navita-blue text-white rounded-xl hover:bg-navita-dark-blue font-medium transition"
                        >
                            <Plus className="w-4 h-4" />
                            Nova sessão
                        </Link>
                    )}
                </div>
            )}

            {/* Sessions list */}
            {!loading && !error && sessions.length > 0 && (
                <div className="space-y-3">
                    {sessions.map((s) => {
                        const pending = s.iAmParticipant && !s.iSubmitted && s.status === 'open'
                        return (
                            <Link
                                key={s.id}
                                to={`/calibracao/${s.id}`}
                                className="block clean-card rounded-2xl p-5 hover:shadow-md transition group"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <h3 className="text-base font-semibold text-slate-900 group-hover:text-navita-blue transition">
                                                {s.ticket_id}
                                            </h3>
                                            <StatusBadge status={s.status} />
                                            {pending && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-amber-50 text-amber-600 border-amber-100">
                                                    <Clock className="w-3 h-3" />
                                                    Sua avaliação pendente
                                                </span>
                                            )}
                                        </div>
                                        {s.ticket_subject && (
                                            <p className="text-sm text-slate-500 mt-1 truncate">
                                                {s.ticket_subject}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-6 flex-shrink-0">
                                        <div className="text-right">
                                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 justify-end">
                                                <Users className="w-4 h-4 text-slate-400" />
                                                {s.submittedCount}/{s.participantCount} enviaram
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                Criada em {formatDate(s.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

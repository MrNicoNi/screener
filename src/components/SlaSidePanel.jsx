import { Clock, Timer, RotateCcw, ArrowUpRight, Info } from 'lucide-react'

/**
 * Painel lateral de indicadores operacionais (spec §3.1 / §4).
 *
 * SLA de 1º contato e de solução, taxa de reabertura em 15 dias e taxa de
 * escalonamento são KPIs operacionais IMPORTADOS (Tiflux) e **não ponderados**
 * no score de QA — ficam ao lado como contexto, nunca dentro do cálculo.
 *
 * Wave 30d (mês 1): preenchido manualmente / placeholder. A importação
 * automática do Tiflux é backlog #5 (Wave 60d), quando estes campos passam a
 * ser alimentados por dados reais em vez dos "—".
 *
 * @param {{ metrics?: { firstResponseSla?: string, resolutionSla?: string, reopenRate15d?: string, escalationRate?: string } }} props
 */
export function SlaSidePanel({ metrics = {} }) {
    const rows = [
        { key: 'firstResponseSla', label: 'SLA 1º contato', icon: Clock, value: metrics.firstResponseSla },
        { key: 'resolutionSla', label: 'SLA de solução', icon: Timer, value: metrics.resolutionSla },
        { key: 'reopenRate15d', label: 'Reabertura (15 dias)', icon: RotateCcw, value: metrics.reopenRate15d },
        { key: 'escalationRate', label: 'Escalonamento', icon: ArrowUpRight, value: metrics.escalationRate },
    ]

    return (
        <div className="clean-card rounded-2xl p-6 border-l-4 border-slate-200">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <h3 className="text-lg font-semibold text-slate-900">Indicadores Operacionais</h3>
                <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase border bg-slate-50 text-slate-500 border-slate-200">
                    Não ponderado
                </span>
            </div>
            <p className="text-sm text-slate-500 mb-4 flex items-start gap-1.5">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
                Preenchimento manual, consultando o Tiflux (exportar a base é vedado por LGPD). Fora do score de QA.
            </p>
            <div className="grid grid-cols-2 gap-3">
                {rows.map(({ key, label, icon: Icon, value }) => (
                    <div key={key} className="rounded-xl border border-slate-100 bg-white p-3">
                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                            <Icon className="w-4 h-4" />
                            <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
                        </div>
                        <p className="text-xl font-display font-bold text-slate-700">
                            {value ?? '—'}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}

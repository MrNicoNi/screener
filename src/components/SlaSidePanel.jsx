import { Clock, Timer, RotateCcw, ArrowUpRight, Info } from 'lucide-react'

/**
 * Painel lateral de indicadores operacionais (spec §3.1 / §4).
 *
 * SLA de 1º contato e de solução, reabertura em 15 dias e escalonamento são
 * indicadores operacionais Sim/Não preenchidos MANUALMENTE e **não ponderados**
 * no score de QA — ficam ao lado como contexto, nunca dentro do cálculo. São
 * persistidos em `evaluations.sla_metrics` (JSONB).
 *
 * Dois modos:
 *  - Leitura (default): cada linha mostra um selo Sim (verde) / Não (vermelho)
 *    / — (neutro, quando null/ausente).
 *  - Edição (`editable`): cada linha mostra um controle segmentado Sim / Não,
 *    espelhando o estilo do CriterionRow em NewAudit. Clicar chama
 *    `onChange(key, true|false)`.
 *
 * Preenchimento manual consultando o Tiflux (exportar a base é vedado por LGPD).
 *
 * @param {{
 *   values?: { first_contact?: boolean|null, resolution?: boolean|null, reopen_15d?: boolean|null, escalation?: boolean|null },
 *   editable?: boolean,
 *   onChange?: (key: string, value: boolean) => void,
 * }} props
 */
export function SlaSidePanel({ values = {}, editable = false, onChange }) {
    const rows = [
        { key: 'first_contact', label: 'SLA 1º contato', icon: Clock },
        { key: 'resolution', label: 'SLA de solução', icon: Timer },
        { key: 'reopen_15d', label: 'Reabertura (15 dias)', icon: RotateCcw },
        { key: 'escalation', label: 'Escalonamento', icon: ArrowUpRight },
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
                {rows.map(({ key, label, icon: Icon }) => {
                    const value = values?.[key] ?? null
                    return (
                        <div key={key} className="rounded-xl border border-slate-100 bg-white p-3">
                            <div className="flex items-center gap-2 text-slate-400 mb-2">
                                <Icon className="w-4 h-4" />
                                <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
                            </div>
                            {editable ? (
                                <SlaToggle
                                    value={value}
                                    onYes={() => onChange?.(key, true)}
                                    onNo={() => onChange?.(key, false)}
                                />
                            ) : (
                                <SlaBadge value={value} />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// Editable Sim / Não segmented control — mirrors CriterionRow's style
// (green when Sim, red when Não).
function SlaToggle({ value, onYes, onNo }) {
    const isYes = value === true
    const isNo = value === false
    return (
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            <button
                type="button"
                onClick={onYes}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                    isYes ? 'bg-navita-green text-white border-navita-green' : 'bg-white text-slate-500 hover:bg-slate-100'
                }`}
            >
                Sim
            </button>
            <button
                type="button"
                onClick={onNo}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition border-l border-slate-200 ${
                    isNo ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-500 hover:bg-slate-100'
                }`}
            >
                Não
            </button>
        </div>
    )
}

// Read-only badge: Sim (green) / Não (red) / — (neutral, when null).
function SlaBadge({ value }) {
    if (value === true) {
        return (
            <span className="inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase border bg-green-50 text-navita-green border-green-200">
                Sim
            </span>
        )
    }
    if (value === false) {
        return (
            <span className="inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase border bg-red-50 text-red-500 border-red-200">
                Não
            </span>
        )
    }
    return (
        <span className="inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase border bg-slate-50 text-slate-400 border-slate-200">
            —
        </span>
    )
}

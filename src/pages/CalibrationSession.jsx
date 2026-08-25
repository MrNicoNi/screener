import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCalibration } from '../hooks/useCalibration'
import { useToast } from '../components/Toast'
import { calculateScore } from '../lib/scoring'
import {
    Scale,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Users,
    ShieldAlert,
} from 'lucide-react'

// A criterion is "answered" when Yes(5), No(1) or (allowed) N/A was picked.
// Mirrors NewAudit's completeness rule.
function isAnswered(answer) {
    if (!answer) return false
    if (answer.is_na === true) return true
    return answer.value === 5 || answer.value === 1
}

// Normalize an item/answer into a comparable token for divergence detection.
// null → not answered (should not happen for non-auto-fail once submitted).
function tokenOf(item) {
    if (!item) return null
    if (item.is_na) return 'na'
    if (item.value === 5) return 'yes'
    if (item.value === 1) return 'no'
    return null
}

function ChipFor({ token }) {
    const map = {
        yes: { label: 'Sim', cls: 'bg-green-50 text-navita-green border-green-200' },
        no: { label: 'Não', cls: 'bg-red-50 text-red-600 border-red-200' },
        na: { label: 'N/A', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    }
    const c = map[token] || {
        label: '—',
        cls: 'bg-white text-slate-300 border-slate-200',
    }
    return (
        <span
            className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${c.cls}`}
        >
            {c.label}
        </span>
    )
}

function displayName(participant) {
    return participant?.evaluator?.name || participant?.evaluator?.email || 'Avaliador'
}

function getScoreColor(final) {
    if (final >= 90) return 'text-navita-green'
    if (final >= 75) return 'text-navita-blue'
    return 'text-red-500'
}

export function CalibrationSession() {
    const { id } = useParams()
    const { userProfile } = useAuth()
    const { getSession, submitParticipation } = useCalibration()
    const toast = useToast()

    const [data, setData] = useState(null) // { session, participants, template }
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(null)

    const [answers, setAnswers] = useState({}) // { [criterion_key]: { value, is_na } }
    const [result, setResult] = useState({ final: 0, blocks: {}, has_critical_flag: false })
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function load() {
        try {
            setLoading(true)
            setLoadError(null)
            const res = await getSession(id)
            setData(res)
        } catch (err) {
            console.error('[CalibrationSession] load failed:', err)
            setLoadError(err.message || 'Erro ao carregar a sessão de calibração')
            setData(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    const session = data?.session
    const participants = data?.participants || []
    const template = data?.template

    // ── Mode derivation ───────────────────────────────────────────────────────
    // me: the participant row whose evaluator_id is the current user.
    const me = useMemo(
        () => participants.find((p) => p.evaluator_id === userProfile?.id) || null,
        [participants, userProfile?.id]
    )
    const isOpen = session?.status === 'open'
    const isClosed = session?.status === 'closed'
    // Fill mode: session open AND I'm a not-yet-submitted participant.
    const isMyTurn = Boolean(isOpen && me && !me.submitted)

    // ── Derived grouping (blocks in sort_order + auto-fail list) ──────────────
    const { blocks, autoFails } = useMemo(() => {
        if (!template) return { blocks: [], autoFails: [] }
        const blockOrder = []
        const byBlock = {}
        for (const c of template.criteria) {
            if (c.is_auto_fail) continue
            if (!byBlock[c.block]) {
                byBlock[c.block] = {
                    block: c.block,
                    label: c.block_label,
                    weight: c.block_weight,
                    items: [],
                }
                blockOrder.push(byBlock[c.block])
            }
            byBlock[c.block].items.push(c)
        }
        return {
            blocks: blockOrder,
            autoFails: template.criteria.filter((c) => c.is_auto_fail),
        }
    }, [template])

    // ── Live score (fill mode only) ───────────────────────────────────────────
    useEffect(() => {
        if (!template) return
        setResult(calculateScore(template, answers))
    }, [answers, template])

    function setAnswer(key, next) {
        setAnswers((prev) => ({ ...prev, [key]: next }))
    }

    function toggleAutoFail(key, checked) {
        setAnswer(key, { value: checked ? 5 : 1, is_na: false })
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!template) return

        // Completeness: every non-auto-fail criterion must be answered.
        const missing = template.criteria.filter(
            (c) => !c.is_auto_fail && !isAnswered(answers[c.criterion_key])
        )
        if (missing.length > 0) {
            toast.error(
                `Preencha todos os critérios: faltam ${missing.length} sem resposta (Sim / Não / N/A).`
            )
            return
        }

        setIsSubmitting(true)
        try {
            // One shaped item per criterion (incl. auto-fails), as the
            // submitParticipation contract expects.
            const itemsArray = template.criteria.map((c) => {
                const a = answers[c.criterion_key]
                if (c.is_auto_fail) {
                    return {
                        criterion_key: c.criterion_key,
                        value: a?.value === 5 ? 5 : 1,
                        is_na: false,
                    }
                }
                if (a?.is_na) {
                    return { criterion_key: c.criterion_key, value: null, is_na: true }
                }
                return {
                    criterion_key: c.criterion_key,
                    value: a?.value === 5 ? 5 : 1,
                    is_na: false,
                }
            })

            const score = calculateScore(template, answers)

            await submitParticipation({
                sessionId: id,
                answers: itemsArray,
                result: score,
            })

            toast.success('Avaliação enviada! Aguardando os demais avaliadores.')
            await load()
        } catch (err) {
            console.error('[CalibrationSession] submit failed:', err)
            toast.error(err.message || 'Erro ao enviar avaliação')
        } finally {
            setIsSubmitting(false)
        }
    }

    const backLink = (
        <Link
            to="/calibracao"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition"
        >
            <ArrowLeft className="w-4 h-4" />
            Voltar para calibração
        </Link>
    )

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                {backLink}
                <div className="animate-pulse space-y-4">
                    <div className="h-16 bg-slate-200 rounded-2xl" />
                    <div className="h-40 bg-slate-200 rounded-2xl" />
                    <div className="h-64 bg-slate-200 rounded-2xl" />
                </div>
            </div>
        )
    }

    // ── No access / error (RLS returns nothing → getSession throws) ───────────
    if (loadError || !session || !template) {
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                {backLink}
                <div className="clean-card rounded-2xl p-12 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <ShieldAlert className="w-7 h-7 text-slate-400" />
                        </div>
                    </div>
                    <h1 className="text-lg font-display font-bold text-slate-900 mb-2">
                        Sem acesso a esta sessão
                    </h1>
                    <p className="text-slate-500 max-w-md mx-auto">
                        Você não participa desta sessão de calibração ou ela não está
                        disponível. Apenas os avaliadores participantes (e administradores)
                        podem visualizá-la.
                    </p>
                </div>
            </div>
        )
    }

    // ── 1) FILL MODE ──────────────────────────────────────────────────────────
    if (isMyTurn) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                {backLink}

                {/* Header */}
                <div className="clean-card rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-display font-bold text-slate-900">
                                {session.ticket_id}
                            </h1>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-blue-50 text-navita-blue border-blue-100">
                                <Scale className="w-3 h-3" />
                                modo calibração
                            </span>
                        </div>
                        {session.ticket_subject && (
                            <p className="text-sm text-slate-500 mt-1">{session.ticket_subject}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-medium">
                            {template.name} · v{template.version} · avaliação cega
                        </p>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                        {result.has_critical_flag && (
                            <div className="px-3 py-2 rounded-lg text-sm font-bold uppercase tracking-wide border bg-red-50 text-red-600 border-red-200 flex items-center gap-1.5">
                                <span aria-hidden="true">⚠</span> Flag Crítica
                            </div>
                        )}
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                                Sua nota
                            </p>
                            <div className="flex items-baseline justify-end gap-1">
                                <span
                                    className={`text-3xl font-display font-black ${getScoreColor(result.final)}`}
                                >
                                    {Number(result.final).toFixed(1)}
                                </span>
                                <span className="text-sm font-bold text-slate-300">%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 text-sm text-slate-600">
                    Pontue cada critério de forma independente. Você não vê as respostas dos
                    demais até que todos enviem — então a sessão fecha e o relatório de
                    divergências fica disponível.
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {blocks.map((block, index) => (
                        <BlockSection
                            key={block.block}
                            index={index}
                            block={block}
                            answers={answers}
                            onAnswer={setAnswer}
                        />
                    ))}

                    {/* Critical flags */}
                    {autoFails.length > 0 && (
                        <section className="clean-card rounded-2xl overflow-hidden">
                            <div className="bg-white border-b border-slate-100 p-6 flex justify-between items-center relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>
                                <div>
                                    <h3 className="text-xl font-display font-bold text-slate-800 flex items-center gap-2">
                                        <span aria-hidden="true">⚠</span> Flags Críticas
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        Marque uma violação apenas se ela ocorreu. Não afeta a nota,
                                        mas levanta a flag crítica.
                                    </p>
                                </div>
                            </div>
                            <div className="p-6 space-y-2">
                                {autoFails.map((c) => (
                                    <AutoFailRow
                                        key={c.criterion_key}
                                        criterion={c}
                                        checked={answers[c.criterion_key]?.value === 5}
                                        onToggle={(checked) => toggleAutoFail(c.criterion_key, checked)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    <div className="flex gap-4">
                        <Link
                            to="/calibracao"
                            className="flex-1 px-6 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 font-medium transition text-center"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 text-white px-6 py-3 rounded-xl disabled:opacity-50 font-medium transition shadow-lg bg-navita-blue hover:bg-navita-dark-blue shadow-blue-900/20"
                        >
                            {isSubmitting ? 'Enviando...' : 'Enviar avaliação'}
                        </button>
                    </div>
                </form>
            </div>
        )
    }

    // ── 2) WAITING MODE (session open, but not my turn) ───────────────────────
    if (isOpen) {
        const submittedCount = participants.filter((p) => p.submitted).length
        return (
            <div className="max-w-3xl mx-auto space-y-6">
                {backLink}

                <div className="clean-card rounded-2xl p-8">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                            <Clock className="w-7 h-7 text-amber-500" />
                        </div>
                        <h1 className="text-xl font-display font-bold text-slate-900">
                            Aguardando os demais avaliadores
                        </h1>
                        <p className="text-slate-500 mt-2 max-w-md">
                            {session.ticket_id}
                            {session.ticket_subject ? ` · ${session.ticket_subject}` : ''}. As
                            respostas ficam ocultas até que todos enviem — então o relatório de
                            divergências é liberado.
                        </p>
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-sm font-bold">
                            <Users className="w-4 h-4 text-slate-400" />
                            {submittedCount}/{participants.length} enviaram
                        </div>
                    </div>

                    <ul className="space-y-2">
                        {participants.map((p) => (
                            <li
                                key={p.id}
                                className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-100"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-sm font-medium text-slate-800 truncate">
                                        {displayName(p)}
                                        {p.evaluator_id === userProfile?.id && (
                                            <span className="text-navita-blue font-normal"> (você)</span>
                                        )}
                                    </span>
                                </div>
                                {p.submitted ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-navita-green">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Enviado
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                        <Clock className="w-4 h-4" />
                                        Pendente
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        )
    }

    // ── 3) REPORT MODE (session closed) — divergence report ───────────────────
    return (
        <ReportView
            session={session}
            participants={participants}
            template={template}
            blocks={blocks}
            autoFails={autoFails}
            meId={userProfile?.id}
        />
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Report view
// ─────────────────────────────────────────────────────────────────────────────
function ReportView({ session, participants, template, blocks, autoFails, meId }) {
    const backLink = (
        <Link
            to="/calibracao"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition"
        >
            <ArrowLeft className="w-4 h-4" />
            Voltar para calibração
        </Link>
    )

    // Quick lookup: participant.id → { criterion_key → item }
    const itemsByParticipant = useMemo(() => {
        const map = {}
        for (const p of participants) {
            const byKey = {}
            for (const it of p.items || []) byKey[it.criterion_key] = it
            map[p.id] = byKey
        }
        return map
    }, [participants])

    // Score gap (max − min) across submitted participants.
    const scores = participants
        .map((p) => (typeof p.final_score === 'number' ? p.final_score : null))
        .filter((s) => s !== null)
    const gap =
        scores.length >= 2 ? Math.round((Math.max(...scores) - Math.min(...scores)) * 100) / 100 : 0

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {backLink}

            {/* Header */}
            <div className="clean-card rounded-2xl p-6">
                <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-display font-bold text-slate-900">
                        {session.ticket_id}
                    </h1>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-600 border-slate-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Fechada · relatório de divergências
                    </span>
                </div>
                {session.ticket_subject && (
                    <p className="text-sm text-slate-500 mt-1">{session.ticket_subject}</p>
                )}
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-medium">
                    {template.name} · v{template.version}
                </p>
            </div>

            {/* Summary: each participant's final score + gap */}
            <div className="clean-card rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-navita-blue" />
                    Notas finais
                </h3>
                <div className="flex flex-wrap items-stretch gap-4">
                    {participants.map((p) => (
                        <div
                            key={p.id}
                            className="flex-1 min-w-[140px] rounded-xl border border-slate-200 p-4 text-center"
                        >
                            <p className="text-sm font-medium text-slate-600 truncate">
                                {displayName(p)}
                                {p.evaluator_id === meId && (
                                    <span className="text-navita-blue font-normal"> (você)</span>
                                )}
                            </p>
                            <div className="flex items-baseline justify-center gap-1 mt-2">
                                <span
                                    className={`text-3xl font-display font-black ${getScoreColor(
                                        Number(p.final_score) || 0
                                    )}`}
                                >
                                    {typeof p.final_score === 'number'
                                        ? Number(p.final_score).toFixed(1)
                                        : '—'}
                                </span>
                                <span className="text-sm font-bold text-slate-300">%</span>
                            </div>
                            {p.has_critical_flag && (
                                <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold uppercase tracking-wide text-red-600">
                                    <span aria-hidden="true">⚠</span> Flag crítica
                                </span>
                            )}
                        </div>
                    ))}

                    {/* Gap highlight */}
                    <div
                        className={`flex-1 min-w-[140px] rounded-xl border p-4 text-center ${
                            gap > 0
                                ? 'bg-amber-50 border-amber-200'
                                : 'bg-green-50 border-green-200'
                        }`}
                    >
                        <p className="text-sm font-medium text-slate-600">Gap (máx − mín)</p>
                        <div className="flex items-baseline justify-center gap-1 mt-2">
                            <span
                                className={`text-3xl font-display font-black ${
                                    gap > 0 ? 'text-amber-600' : 'text-navita-green'
                                }`}
                            >
                                {gap.toFixed(1)}
                            </span>
                            <span className="text-sm font-bold text-slate-300">pts</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                            {gap > 0 ? 'Divergência de notas' : 'Consenso'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Per-criterion comparison grouped by block */}
            {blocks.map((block, index) => (
                <section key={block.block} className="clean-card rounded-2xl overflow-hidden">
                    <div className="bg-white border-b border-slate-100 p-6 relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-navita-blue"></div>
                        <h3 className="text-xl font-display font-bold text-slate-800">
                            {index + 1}. {block.label || block.block}
                        </h3>
                    </div>
                    <div className="p-4 sm:p-6 overflow-x-auto">
                        <table className="w-full border-collapse min-w-[520px]">
                            <thead>
                                <tr className="text-left">
                                    <th className="pb-3 pr-4 text-xs font-bold uppercase tracking-wider text-slate-400 w-1/2">
                                        Critério
                                    </th>
                                    {participants.map((p) => (
                                        <th
                                            key={p.id}
                                            className="pb-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-400 text-center"
                                        >
                                            {displayName(p)}
                                            {p.evaluator_id === meId ? ' (você)' : ''}
                                        </th>
                                    ))}
                                    <th className="pb-3 pl-2 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {block.items.map((c) => {
                                    const tokens = participants.map((p) =>
                                        tokenOf(itemsByParticipant[p.id]?.[c.criterion_key])
                                    )
                                    const distinct = new Set(tokens.filter(Boolean))
                                    const divergent = distinct.size > 1
                                    return (
                                        <tr
                                            key={c.criterion_key}
                                            className={`border-t border-slate-100 ${
                                                divergent ? 'bg-amber-50/60' : ''
                                            }`}
                                        >
                                            <td className="py-3 pr-4 align-top">
                                                <div className="flex items-start gap-2">
                                                    {divergent && (
                                                        <span
                                                            className="mt-0.5 w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                    <p className="text-sm font-medium text-slate-700">
                                                        {c.statement}
                                                    </p>
                                                </div>
                                            </td>
                                            {participants.map((p, i) => (
                                                <td key={p.id} className="py-3 px-2 text-center align-top">
                                                    <ChipFor token={tokens[i]} />
                                                </td>
                                            ))}
                                            <td className="py-3 pl-2 text-center align-top">
                                                {divergent ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200">
                                                        Divergência
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-green-50 text-navita-green border border-green-200">
                                                        Unânime
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            ))}

            {/* Auto-fail section: which participant raised which critical flag */}
            {autoFails.length > 0 && (
                <section className="clean-card rounded-2xl overflow-hidden">
                    <div className="bg-white border-b border-slate-100 p-6 relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>
                        <h3 className="text-xl font-display font-bold text-slate-800 flex items-center gap-2">
                            <span aria-hidden="true">⚠</span> Flags Críticas
                        </h3>
                        <p className="text-sm text-slate-500">
                            Quais avaliadores levantaram cada violação.
                        </p>
                    </div>
                    <div className="p-6 space-y-3">
                        {autoFails.map((c) => {
                            const raisedBy = participants.filter(
                                (p) => (itemsByParticipant[p.id]?.[c.criterion_key]?.value ?? 0) >= 3
                            )
                            return (
                                <div
                                    key={c.criterion_key}
                                    className={`flex items-start justify-between gap-4 p-3 rounded-lg border ${
                                        raisedBy.length > 0
                                            ? 'bg-red-50 border-red-200'
                                            : 'border-slate-100'
                                    }`}
                                >
                                    <p
                                        className={`text-sm font-medium ${
                                            raisedBy.length > 0 ? 'text-red-700' : 'text-slate-600'
                                        }`}
                                    >
                                        {c.statement}
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 justify-end flex-shrink-0">
                                        {raisedBy.length === 0 ? (
                                            <span className="text-xs font-medium text-slate-400">
                                                Ninguém
                                            </span>
                                        ) : (
                                            raisedBy.map((p) => (
                                                <span
                                                    key={p.id}
                                                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-white text-red-600 border border-red-200"
                                                >
                                                    {displayName(p)}
                                                    {p.evaluator_id === meId ? ' (você)' : ''}
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </section>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Fill-mode subcomponents (mirror NewAudit's controls)
// ─────────────────────────────────────────────────────────────────────────────
const BLOCK_ACCENTS = ['bg-navita-blue', 'bg-navita-green', 'bg-slate-800', 'bg-navita-purple', 'bg-amber-500']
const BLOCK_BADGES = [
    'bg-blue-50 text-navita-blue border-blue-100',
    'bg-green-50 text-navita-green border-green-100',
    'bg-slate-100 text-slate-600 border-slate-200',
    'bg-purple-50 text-navita-purple border-purple-100',
    'bg-amber-50 text-amber-600 border-amber-100',
]

function BlockSection({ index, block, answers, onAnswer }) {
    const accent = BLOCK_ACCENTS[index % BLOCK_ACCENTS.length]
    const badge = BLOCK_BADGES[index % BLOCK_BADGES.length]

    return (
        <section className="clean-card rounded-2xl overflow-hidden">
            <div className="bg-white border-b border-slate-100 p-6 flex justify-between items-center relative">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accent}`}></div>
                <div>
                    <h3 className="text-xl font-display font-bold text-slate-800">
                        {index + 1}. {block.label || block.block}
                    </h3>
                </div>
                {block.weight != null && (
                    <div className={`px-3 py-1 rounded-full text-xs font-bold border ${badge}`}>
                        Peso: {Number(block.weight)}%
                    </div>
                )}
            </div>
            <div className="p-6 space-y-2">
                {block.items.map((c) => (
                    <CriterionRow
                        key={c.criterion_key}
                        criterion={c}
                        answer={answers[c.criterion_key]}
                        onChange={(next) => onAnswer(c.criterion_key, next)}
                    />
                ))}
            </div>
        </section>
    )
}

function CriterionRow({ criterion, answer, onChange }) {
    const isYes = answer && !answer.is_na && answer.value === 5
    const isNo = answer && !answer.is_na && answer.value === 1
    const isNa = answer?.is_na === true

    const options = [
        { key: 'yes', label: 'Sim', active: isYes, next: { value: 5, is_na: false }, activeCls: 'bg-navita-green text-white border-navita-green' },
        { key: 'no', label: 'Não', active: isNo, next: { value: 1, is_na: false }, activeCls: 'bg-red-500 text-white border-red-500' },
    ]
    if (criterion.allows_na) {
        options.push({ key: 'na', label: 'N/A', active: isNa, next: { value: null, is_na: true }, activeCls: 'bg-slate-600 text-white border-slate-600' })
    }

    return (
        <div className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-slate-50 transition group">
            <div className="flex-1 pr-2">
                <p className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition">
                    {criterion.statement}
                </p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
                <span className="text-xs font-mono text-slate-300 font-bold hidden sm:inline">
                    {Number(criterion.weight)}%
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                    {options.map((opt, i) => (
                        <button
                            key={opt.key}
                            type="button"
                            onClick={() => onChange(opt.next)}
                            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                                i > 0 ? 'border-l border-slate-200' : ''
                            } ${opt.active ? opt.activeCls : 'bg-white text-slate-500 hover:bg-slate-100'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

function AutoFailRow({ criterion, checked, onToggle }) {
    return (
        <div
            onClick={() => onToggle(!checked)}
            className={`flex items-center justify-between gap-4 p-3 rounded-lg border transition cursor-pointer ${
                checked ? 'bg-red-50 border-red-200' : 'border-transparent hover:bg-slate-50'
            }`}
        >
            <div className="flex-1 pr-2">
                <p className={`text-sm font-medium transition ${checked ? 'text-red-700' : 'text-slate-600'}`}>
                    {criterion.statement}
                </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onToggle(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
        </div>
    )
}

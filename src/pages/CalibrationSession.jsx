import { useParams, Link } from 'react-router-dom'
import { Scale, ArrowLeft } from 'lucide-react'

// NOTE: Placeholder stub — Part B (Wave #7) replaces this with the full
// blind-scoring / comparison view. Keep the route working in the meantime.
export function CalibrationSession() {
    const { id } = useParams()

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <Link
                to="/calibracao"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition"
            >
                <ArrowLeft className="w-4 h-4" />
                Voltar para calibração
            </Link>

            <div className="clean-card rounded-2xl p-12 text-center">
                <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <Scale className="w-7 h-7 text-slate-400" />
                    </div>
                </div>
                <h1 className="text-lg font-display font-bold text-slate-900 mb-2">
                    Em construção
                </h1>
                <p className="text-slate-500">
                    A tela da sessão de calibração está em construção.
                </p>
                <p className="text-xs text-slate-400 mt-4 font-mono">Sessão: {id}</p>
            </div>
        </div>
    )
}

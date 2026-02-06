import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'

export function ForgotPasswordModal({ isOpen, onClose }) {
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            })

            if (resetError) throw resetError

            setSuccess(true)
        } catch (err) {
            setError(err.message || 'Erro ao enviar email de recuperação')
        } finally {
            setIsLoading(false)
        }
    }

    function handleClose() {
        setEmail('')
        setError('')
        setSuccess(false)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
                >
                    <X className="w-5 h-5" />
                </button>

                {!success ? (
                    <>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">
                            Esqueceu sua senha?
                        </h2>
                        <p className="text-sm text-slate-600 mb-6">
                            Digite seu email e enviaremos um link para redefinir sua senha.
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                                    placeholder="seu.email@example.com"
                                    required
                                    disabled={isLoading}
                                />
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex-1 px-4 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 font-medium transition"
                                    disabled={isLoading}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-navita-blue text-white px-4 py-3 rounded-xl hover:bg-navita-dark-blue disabled:opacity-50 font-medium transition"
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Enviando...' : 'Enviar Link'}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                            Email Enviado!
                        </h3>
                        <p className="text-sm text-slate-600 mb-6">
                            Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                        </p>
                        <button
                            onClick={handleClose}
                            className="w-full bg-navita-blue text-white px-4 py-3 rounded-xl hover:bg-navita-dark-blue font-medium transition"
                        >
                            Fechar
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

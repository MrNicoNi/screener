import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'

export function ResetPassword() {
    const navigate = useNavigate()
    const { showToast } = useToast()

    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    // 'checking' → verifying recovery session | 'ready' → show form | 'invalid' → bad/expired link
    const [status, setStatus] = useState('checking')

    // Establish the recovery session coming from the email link.
    // With detectSessionInUrl enabled, supabase-js parses the token in the URL
    // and fires a PASSWORD_RECOVERY event. We also check for an existing session
    // in case that happened before this component mounted.
    useEffect(() => {
        let resolved = false

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
                resolved = true
                setStatus('ready')
            }
        })

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                resolved = true
                setStatus('ready')
            }
        })

        // If no recovery session shows up shortly, the link is invalid or expired.
        const timeout = setTimeout(() => {
            if (!resolved) setStatus('invalid')
        }, 4000)

        return () => {
            subscription.unsubscribe()
            clearTimeout(timeout)
        }
    }, [])

    const validatePassword = () => {
        if (newPassword.length < 8) {
            showToast('A senha deve ter pelo menos 8 caracteres', 'error')
            return false
        }
        if (!/[A-Z]/.test(newPassword)) {
            showToast('A senha deve conter pelo menos uma letra maiúscula', 'error')
            return false
        }
        if (!/[0-9]/.test(newPassword)) {
            showToast('A senha deve conter pelo menos um número', 'error')
            return false
        }
        if (newPassword !== confirmPassword) {
            showToast('As senhas não coincidem', 'error')
            return false
        }
        return true
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!validatePassword()) return

        setLoading(true)
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            })
            if (updateError) throw updateError

            // Clear any forced-change flag for this user (best-effort).
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await supabase
                    .from('users')
                    .update({ must_change_password: false })
                    .eq('id', user.id)
            }

            // Sign out the recovery session so the user logs in fresh.
            await supabase.auth.signOut()

            showToast('Senha redefinida com sucesso! Faça login com a nova senha.', 'success')
            navigate('/login', { replace: true })
        } catch (err) {
            console.error('[ResetPassword] Error:', err)
            showToast(err.message || 'Erro ao redefinir senha', 'error')
        } finally {
            setLoading(false)
        }
    }

    const requirement = (ok, label) => (
        <li className="flex items-center gap-2">
            <span className={ok ? 'text-green-600' : 'text-slate-400'}>{ok ? '✓' : '○'}</span>
            {label}
        </li>
    )

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navita-light via-blue-50 to-navita-light p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-navita-blue rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4 shadow-lg shadow-blue-900/20">
                        S
                    </div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">
                        Screener <span className="text-navita-green">QA</span>
                    </h1>
                    <p className="text-slate-600 mt-2">Redefinição de senha</p>
                </div>

                {status === 'checking' && (
                    <div className="text-center py-8 text-slate-500">
                        Validando o link de recuperação...
                    </div>
                )}

                {status === 'invalid' && (
                    <div className="text-center py-4">
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
                            Link inválido ou expirado. Solicite um novo link de recuperação na tela de login.
                        </div>
                        <button
                            onClick={() => navigate('/login', { replace: true })}
                            className="w-full bg-navita-blue text-white py-3 rounded-xl hover:bg-navita-dark-blue font-medium transition-all shadow-lg shadow-blue-900/20"
                        >
                            Voltar ao Login
                        </button>
                    </div>
                )}

                {status === 'ready' && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Nova Senha
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent transition"
                                placeholder="Digite sua nova senha"
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Confirmar Senha
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent transition"
                                placeholder="Confirme sua nova senha"
                                required
                            />
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-xs font-semibold text-blue-900 mb-2">Requisitos da senha:</p>
                            <ul className="text-xs text-blue-700 space-y-1">
                                {requirement(newPassword.length >= 8, 'Mínimo de 8 caracteres')}
                                {requirement(/[A-Z]/.test(newPassword), 'Pelo menos uma letra maiúscula')}
                                {requirement(/[0-9]/.test(newPassword), 'Pelo menos um número')}
                                {requirement(newPassword.length > 0 && newPassword === confirmPassword, 'Senhas coincidem')}
                            </ul>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-navita-blue text-white py-3 rounded-xl hover:bg-navita-dark-blue disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-lg shadow-blue-900/20"
                        >
                            {loading ? 'Redefinindo...' : 'Redefinir Senha'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}

import { X } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from './Toast'

export function ChangePasswordModal({ isOpen, onClose, userEmail }) {
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const { showToast } = useToast()

    const validatePassword = () => {
        if (newPassword.length < 8) {
            showToast('A senha deve ter pelo menos 8 caracteres', 'error')
            return false
        }
        if (newPassword !== confirmPassword) {
            showToast('As senhas não coincidem', 'error')
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
        return true
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!validatePassword()) return

        setLoading(true)
        try {
            // Update password
            const { error: passwordError } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (passwordError) throw passwordError

            // Update must_change_password flag
            const { error: updateError } = await supabase
                .from('users')
                .update({ must_change_password: false })
                .eq('email', userEmail)

            if (updateError) throw updateError

            showToast('Senha alterada com sucesso!', 'success')
            setNewPassword('')
            setConfirmPassword('')
            onClose()
        } catch (err) {
            console.error('Error changing password:', err)
            showToast(err.message || 'Erro ao alterar senha', 'error')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="clean-card rounded-2xl max-w-md w-full p-6 relative">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                        Alterar Senha
                    </h2>
                    <p className="text-slate-600 text-sm">
                        Por segurança, você precisa alterar sua senha temporária antes de continuar.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Nova Senha
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-navita-blue focus:ring-2 focus:ring-navita-blue/20 outline-none transition"
                            placeholder="Digite sua nova senha"
                            required
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Confirmar Senha
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-navita-blue focus:ring-2 focus:ring-navita-blue/20 outline-none transition"
                            placeholder="Confirme sua nova senha"
                            required
                        />
                    </div>

                    {/* Password Requirements */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-blue-900 mb-2">
                            Requisitos da senha:
                        </p>
                        <ul className="text-xs text-blue-700 space-y-1">
                            <li className="flex items-center gap-2">
                                <span className={newPassword.length >= 8 ? 'text-green-600' : 'text-slate-400'}>
                                    {newPassword.length >= 8 ? '✓' : '○'}
                                </span>
                                Mínimo de 8 caracteres
                            </li>
                            <li className="flex items-center gap-2">
                                <span className={/[A-Z]/.test(newPassword) ? 'text-green-600' : 'text-slate-400'}>
                                    {/[A-Z]/.test(newPassword) ? '✓' : '○'}
                                </span>
                                Pelo menos uma letra maiúscula
                            </li>
                            <li className="flex items-center gap-2">
                                <span className={/[0-9]/.test(newPassword) ? 'text-green-600' : 'text-slate-400'}>
                                    {/[0-9]/.test(newPassword) ? '✓' : '○'}
                                </span>
                                Pelo menos um número
                            </li>
                            <li className="flex items-center gap-2">
                                <span className={newPassword === confirmPassword && newPassword.length > 0 ? 'text-green-600' : 'text-slate-400'}>
                                    {newPassword === confirmPassword && newPassword.length > 0 ? '✓' : '○'}
                                </span>
                                Senhas coincidem
                            </li>
                        </ul>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-6 py-3 bg-navita-blue text-white font-semibold rounded-xl hover:bg-blue-600 transition shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Alterando...' : 'Alterar Senha'}
                    </button>
                </form>

                {/* Info */}
                <p className="mt-4 text-xs text-center text-slate-500">
                    Esta ação é obrigatória e não pode ser cancelada.
                </p>
            </div>
        </div>
    )
}

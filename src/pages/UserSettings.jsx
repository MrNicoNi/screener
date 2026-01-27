import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, User, Mail, Shield } from 'lucide-react'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'

const passwordSchema = z.object({
    currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
    newPassword: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória')
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword']
})

export function UserSettings() {
    const { userProfile } = useAuth()
    const toast = useToast()
    const [isChangingPassword, setIsChangingPassword] = useState(false)

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(passwordSchema)
    })

    async function onSubmitPassword(data) {
        setIsChangingPassword(true)
        try {
            // Update password - Supabase will validate the current session
            const { error: updateError } = await supabase.auth.updateUser({
                password: data.newPassword
            })

            if (updateError) {
                // Common errors: weak password, same as current, etc.
                throw new Error(updateError.message)
            }

            toast.success('Senha alterada com sucesso!')
            reset()
        } catch (err) {
            toast.error(err.message || 'Erro ao alterar senha')
        } finally {
            setIsChangingPassword(false)
        }
    }

    const roleTranslations = {
        'admin': 'Administrador',
        'evaluator': 'Avaliador',
        'analyst': 'Analista'
    }

    const roleBadgeColors = {
        'admin': 'bg-purple-100 text-purple-700 border-purple-200',
        'evaluator': 'bg-blue-100 text-blue-700 border-blue-200',
        'analyst': 'bg-green-100 text-green-700 border-green-200'
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900">Configurações</h1>
                <p className="text-slate-500 mt-1">Gerencie suas informações e preferências</p>
            </div>

            {/* Profile Information Card */}
            <div className="clean-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-navita-blue flex items-center justify-center text-white font-bold text-lg">
                        {userProfile?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <h2 className="text-xl font-display font-bold text-slate-900">Informações do Perfil</h2>
                        <p className="text-sm text-slate-500">Seus dados cadastrados no sistema</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-navita-blue flex-shrink-0">
                            <User size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Nome</p>
                            <p className="text-base font-medium text-slate-900 mt-1">{userProfile?.name || 'Não informado'}</p>
                        </div>
                    </div>

                    {/* Email */}
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-navita-green flex-shrink-0">
                            <Mail size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Email</p>
                            <p className="text-base font-medium text-slate-900 mt-1">{userProfile?.email || 'Não informado'}</p>
                        </div>
                    </div>

                    {/* Role */}
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
                            <Shield size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Função</p>
                            <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium border ${roleBadgeColors[userProfile?.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {roleTranslations[userProfile?.role] || userProfile?.role}
                            </span>
                        </div>
                    </div>

                    {/* Team */}
                    {userProfile?.team && (
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 flex-shrink-0">
                                <User size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Time</p>
                                <p className="text-base font-medium text-slate-900 mt-1">{userProfile.team.name}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Change Password Card */}
            <div className="clean-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                        <Lock size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-display font-bold text-slate-900">Alterar Senha</h2>
                        <p className="text-sm text-slate-500">Atualize sua senha de acesso</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmitPassword)} className="space-y-4 max-w-md">
                    {/* Current Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Senha Atual
                        </label>
                        <input
                            type="password"
                            {...register('currentPassword')}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-navita-blue focus:border-navita-blue"
                            placeholder="Digite sua senha atual"
                        />
                        {errors.currentPassword && (
                            <p className="text-red-600 text-sm mt-1">{errors.currentPassword.message}</p>
                        )}
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Nova Senha
                        </label>
                        <input
                            type="password"
                            {...register('newPassword')}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-navita-blue focus:border-navita-blue"
                            placeholder="Digite sua nova senha (mínimo 6 caracteres)"
                        />
                        {errors.newPassword && (
                            <p className="text-red-600 text-sm mt-1">{errors.newPassword.message}</p>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Confirmar Nova Senha
                        </label>
                        <input
                            type="password"
                            {...register('confirmPassword')}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-navita-blue focus:border-navita-blue"
                            placeholder="Confirme sua nova senha"
                        />
                        {errors.confirmPassword && (
                            <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting || isChangingPassword}
                        className="w-full bg-navita-blue text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isChangingPassword ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Alterando senha...
                            </>
                        ) : (
                            <>
                                <Lock size={18} />
                                Alterar Senha
                            </>
                        )}
                    </button>
                </form>

                {/* Security Note */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <strong>💡 Dica de segurança:</strong> Use uma senha forte com pelo menos 6 caracteres, combinando letras, números e símbolos.
                    </p>
                </div>
            </div>
        </div>
    )
}

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ForgotPasswordModal } from '../components/ForgotPasswordModal'

const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
})

export function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [error, setError] = useState('')
    const [showForgotPassword, setShowForgotPassword] = useState(false)

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(loginSchema)
    })

    async function onSubmit(data) {
        setError('')
        const { error: loginError } = await login(data.email, data.password)

        if (loginError) {
            setError(loginError.message)
        } else {
            navigate('/dashboard')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navita-light via-blue-50 to-navita-light">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-navita-blue rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4 shadow-lg shadow-blue-900/20">
                        S
                    </div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">
                        Screener <span className="text-navita-green">QA</span>
                    </h1>
                    <p className="text-slate-600 mt-2">Sistema de Avaliação de Analistas</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Email
                        </label>
                        <input
                            {...register('email')}
                            type="email"
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent transition"
                            placeholder="seu@email.com"
                        />
                        {errors.email && (
                            <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Senha
                        </label>
                        <input
                            {...register('password')}
                            type="password"
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent transition"
                            placeholder="••••••••"
                        />
                        {errors.password && (
                            <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-navita-blue text-white py-3 rounded-xl hover:bg-navita-dark-blue disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-lg shadow-blue-900/20"
                    >
                        {isSubmitting ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>

                <div className="mt-4 text-center">
                    <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-navita-blue hover:text-navita-dark-blue font-medium transition"
                    >
                        Esqueci minha senha
                    </button>
                </div>
            </div>

            <ForgotPasswordModal
                isOpen={showForgotPassword}
                onClose={() => setShowForgotPassword(false)}
            />
        </div>
    )
}

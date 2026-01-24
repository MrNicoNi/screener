import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function EvaluatorRoute({ children }) {
    const { userProfile, loading } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">Carregando...</div>
            </div>
        )
    }

    // Allow admin and evaluator
    if (!userProfile || !['admin', 'evaluator'].includes(userProfile.role)) {
        console.warn('[EvaluatorRoute] Access denied - user role:', userProfile?.role)
        return <Navigate to="/dashboard" replace />
    }

    return children
}

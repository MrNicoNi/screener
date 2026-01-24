import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function AdminRoute({ children }) {
    const { userProfile, loading } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">Carregando...</div>
            </div>
        )
    }

    if (!userProfile || userProfile.role !== 'admin') {
        console.warn('[AdminRoute] Access denied - user role:', userProfile?.role)
        return <Navigate to="/dashboard" replace />
    }

    return children
}

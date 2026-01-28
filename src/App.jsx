import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { ManageUsers } from './pages/ManageUsers'
import { ManageTeams } from './pages/ManageTeams'
import { NewAudit } from './pages/NewAudit'
import { EvaluationDetail } from './pages/EvaluationDetail'
import { Team } from './pages/Team'
import { AnalystDetail } from './pages/AnalystDetail'
import { UserSettings } from './pages/UserSettings'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { EvaluatorRoute } from './components/EvaluatorRoute'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'

function App() {
    return (
        <ToastProvider>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/configuracoes" element={<UserSettings />} />
                            <Route path="/nova-auditoria" element={<EvaluatorRoute><NewAudit /></EvaluatorRoute>} />
                            <Route path="/equipe" element={<EvaluatorRoute><Team /></EvaluatorRoute>} />
                            <Route path="/analista/:id" element={<AnalystDetail />} />
                            <Route path="/avaliacao/:id" element={<EvaluationDetail />} />
                            <Route path="/admin/usuarios" element={<AdminRoute><ManageUsers /></AdminRoute>} />
                            <Route path="/admin/times" element={<AdminRoute><ManageTeams /></AdminRoute>} />
                        </Route>

                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </ToastProvider>
    )
}

export default App

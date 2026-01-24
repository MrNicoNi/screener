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
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { EvaluatorRoute } from './components/EvaluatorRoute'
import { Layout } from './components/Layout'

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />

                    <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/nova-auditoria" element={<EvaluatorRoute><NewAudit /></EvaluatorRoute>} />
                        <Route path="/equipe" element={<Team />} />
                        <Route path="/analista/:id" element={<AnalystDetail />} />
                        <Route path="/avaliacao/:id" element={<EvaluationDetail />} />
                        <Route path="/admin/usuarios" element={<AdminRoute><ManageUsers /></AdminRoute>} />
                        <Route path="/admin/times" element={<AdminRoute><ManageTeams /></AdminRoute>} />
                    </Route>

                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}

export default App

import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LayoutDashboard, ClipboardCheck, Users, LogOut, Settings, UserCog } from 'lucide-react'
import { DevModeToggle } from './DevModeToggle'

export function Layout() {
    const { userProfile, logout } = useAuth()
    const navigate = useNavigate()

    async function handleLogout() {
        await logout()
        navigate('/login')
    }

    const isAdmin = userProfile?.role === 'admin'
    const isAnalyst = userProfile?.role === 'analyst'

    const navItems = isAnalyst
        ? [
            { to: '/dashboard', icon: LayoutDashboard, label: 'Meu Painel' },
        ]
        : [
            { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { to: '/nova-auditoria', icon: ClipboardCheck, label: 'Nova Auditoria' },
            { to: '/equipe', icon: Users, label: 'Equipe' },
            ...(isAdmin ? [
                { to: '/admin/times', icon: Settings, label: 'Times' },
                { to: '/admin/usuarios', icon: UserCog, label: 'Usuários' },
            ] : [])
        ]

    return (
        <div className="min-h-screen bg-navita-light">
            {/* Dev Mode Toggle */}
            {import.meta.env.DEV && <DevModeToggle />}

            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-navita-blue rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-900/10">
                            S
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-lg font-display font-bold text-slate-900">
                                Screener <span className="text-navita-green">QA</span>
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Quality Audit Cockpit
                            </p>
                        </div>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                        ? 'bg-navita-blue text-white shadow-md'
                                        : 'text-slate-600 hover:bg-slate-100'
                                    }`
                                }
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    {/* User Menu */}
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-sm font-medium text-slate-900">
                                    {userProfile?.name || 'Usuário'}
                                </p>
                                <p className="text-xs text-slate-500 capitalize">
                                    {userProfile?.role || 'Carregando...'}
                                </p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-sm">
                                {userProfile?.name?.charAt(0) || 'U'}
                            </div>
                        </div>

                        <NavLink
                            to="/configuracoes"
                            className={({ isActive }) =>
                                `p-2 rounded-lg transition ${isActive
                                    ? 'bg-slate-200 text-slate-700'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`
                            }
                            title="Configurações"
                        >
                            <Settings className="w-5 h-5" />
                        </NavLink>

                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                            title="Sair"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <Outlet />
            </main>
        </div>
    )
}

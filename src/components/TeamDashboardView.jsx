import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEvaluations } from '../hooks/useEvaluations'
import { useAuth } from '../hooks/useAuth'
import { TeamPerformanceCard } from './TeamPerformanceCard'

export function TeamDashboardView() {
    const navigate = useNavigate()
    const { getTeamsWithStats } = useEvaluations()
    const { userProfile } = useAuth()
    const [teams, setTeams] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadTeams()
    }, [])

    const loadTeams = async () => {
        try {
            setLoading(true)
            const allTeams = await getTeamsWithStats()

            // Filter teams based on user role
            if (userProfile?.role === 'analyst' && userProfile?.team_id) {
                // Analysts only see their own team
                const userTeam = allTeams.filter(t => t.id === userProfile.team_id)
                setTeams(userTeam)
            } else {
                // Admins and Evaluators see all teams
                setTeams(allTeams)
            }
        } catch (error) {
            console.error('Error loading teams:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleTeamClick = (teamId) => {
        navigate(`/dashboard?teamId=${teamId}`)
    }

    if (loading) {
        return (
            <div className="animate-pulse space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-80 bg-slate-200 rounded-2xl"></div>
                    ))}
                </div>
            </div>
        )
    }

    if (teams.length === 0) {
        return (
            <div className="clean-card rounded-2xl p-12 text-center">
                <p className="text-slate-500 text-lg">
                    {userProfile?.role === 'analyst'
                        ? 'Você não está atribuído a um time'
                        : 'Nenhum time cadastrado'}
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-semibold text-slate-900">
                    {userProfile?.role === 'analyst' ? 'Meu Time' : 'Performance por Times'}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                    {userProfile?.role === 'analyst'
                        ? 'Veja como seu time está performando'
                        : 'Visão geral da performance de cada equipe'}
                </p>
            </div>

            {/* Teams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map(team => (
                    <TeamPerformanceCard
                        key={team.id}
                        team={team}
                        onClick={handleTeamClick}
                    />
                ))}
            </div>
        </div>
    )
}

import { useTeams } from '../hooks/useTeams'
import { useUsers } from '../hooks/useUsers'
import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { TeamCard } from '../components/TeamCard'
import { ManageTeamMembers } from '../components/ManageTeamMembers'

export function ManageTeams() {
    const { teams, loading, createTeam, getTeamWithMembers, refresh: refreshTeams } = useTeams()
    const { users, assignUserToTeam, removeUserFromTeam } = useUsers()
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showMembersModal, setShowMembersModal] = useState(false)
    const [selectedTeam, setSelectedTeam] = useState(null)
    const [teamMembers, setTeamMembers] = useState([])
    const [name, setName] = useState('')
    const [error, setError] = useState('')
    const [loadingMembers, setLoadingMembers] = useState(false)

    // Calculate member counts for each team
    const teamMemberCounts = teams.reduce((acc, team) => {
        acc[team.id] = users.filter(user => user.team_id === team.id).length
        return acc
    }, {})

    async function handleCreate() {
        if (!name.trim()) {
            setError('Nome é obrigatório')
            return
        }

        try {
            await createTeam({ name })
            setName('')
            setShowCreateModal(false)
            setError('')
        } catch (err) {
            setError(err.message)
        }
    }

    async function handleViewMembers(team) {
        try {
            setLoadingMembers(true)
            setSelectedTeam(team)
            setShowMembersModal(true)

            const teamWithMembers = await getTeamWithMembers(team.id)
            setTeamMembers(teamWithMembers.members)
        } catch (err) {
            console.error('Failed to load team members:', err)
            setError('Falha ao carregar membros do time')
        } finally {
            setLoadingMembers(false)
        }
    }

    async function handleAddMember(userId, teamId) {
        await assignUserToTeam(userId, teamId)
        // Refresh members
        const teamWithMembers = await getTeamWithMembers(teamId)
        setTeamMembers(teamWithMembers.members)
        await refreshTeams()
    }

    async function handleRemoveMember(userId) {
        await removeUserFromTeam(userId)
        // Refresh members
        const teamWithMembers = await getTeamWithMembers(selectedTeam.id)
        setTeamMembers(teamWithMembers.members)
        await refreshTeams()
    }

    function handleCloseMembersModal() {
        setShowMembersModal(false)
        setSelectedTeam(null)
        setTeamMembers([])
    }

    // Get users without a team (available to add)
    const availableUsers = users.filter(user =>
        user.is_active && !user.team_id
    )

    if (loading) return <div className="text-center py-12">Carregando...</div>

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Gerenciar Times</h1>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                    <Plus size={20} />
                    Novo Time
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {teams.map(team => (
                    <TeamCard
                        key={team.id}
                        team={team}
                        memberCount={teamMemberCounts[team.id] || 0}
                        onViewMembers={handleViewMembers}
                    />
                ))}
            </div>

            {/* Create Team Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 max-w-md w-full">
                        <h2 className="text-2xl font-bold mb-4">Novo Time</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nome do Time</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    placeholder="Ex: Suporte Nível 1"
                                />
                                {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreate}
                                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                                >
                                    Criar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Manage Members Modal */}
            {showMembersModal && selectedTeam && (
                <ManageTeamMembers
                    team={selectedTeam}
                    members={teamMembers}
                    availableUsers={availableUsers}
                    onAddMember={handleAddMember}
                    onRemoveMember={handleRemoveMember}
                    onClose={handleCloseMembersModal}
                />
            )}
        </div>
    )
}

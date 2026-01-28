import { useState } from 'react'
import { X, UserPlus, Trash2 } from 'lucide-react'

export function ManageTeamMembers({ team, members, availableUsers, onAddMember, onRemoveMember, onClose }) {
    const [selectedUserId, setSelectedUserId] = useState('')
    const [isAdding, setIsAdding] = useState(false)

    async function handleAddMember() {
        if (!selectedUserId) return

        try {
            setIsAdding(true)
            await onAddMember(selectedUserId, team.id)
            setSelectedUserId('')
        } catch (err) {
            console.error('Failed to add member:', err)
        } finally {
            setIsAdding(false)
        }
    }

    async function handleRemoveMember(userId) {
        try {
            await onRemoveMember(userId)
        } catch (err) {
            console.error('Failed to remove member:', err)
        }
    }

    const getRoleBadgeClass = (role) => {
        switch (role) {
            case 'admin':
                return 'bg-purple-100 text-purple-800'
            case 'evaluator':
                return 'bg-blue-100 text-blue-800'
            case 'analyst':
                return 'bg-gray-100 text-gray-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const getRoleLabel = (role) => {
        switch (role) {
            case 'admin':
                return 'Admin'
            case 'evaluator':
                return 'Avaliador'
            case 'analyst':
                return 'Analista'
            default:
                return role
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{team.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {members.length} {members.length === 1 ? 'membro' : 'membros'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Add Member Section */}
                <div className="bg-blue-50 p-4 rounded-lg mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adicionar Membro
                    </label>
                    <div className="flex gap-2">
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="flex-1 px-3 py-2 border rounded-lg bg-white"
                            disabled={isAdding}
                        >
                            <option value="">Selecione um usuário...</option>
                            {availableUsers.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.name} ({user.email}) - {getRoleLabel(user.role)}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={handleAddMember}
                            disabled={!selectedUserId || isAdding}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <UserPlus size={18} />
                            {isAdding ? 'Adicionando...' : 'Adicionar'}
                        </button>
                    </div>
                </div>

                {/* Members List */}
                <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900 mb-3">Membros do Time</h3>
                    {members.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                            Nenhum membro neste time ainda.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {members.map(member => (
                                <div
                                    key={member.id}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <p className="font-medium text-gray-900">{member.name}</p>
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeClass(member.role)}`}>
                                                {getRoleLabel(member.role)}
                                            </span>
                                            {!member.is_active && (
                                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                                    Inativo
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">{member.email}</p>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveMember(member.id)}
                                        className="text-red-600 hover:text-red-800 p-2"
                                        title="Remover do time"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    )
}

import { Users, ChevronRight, Trash2 } from 'lucide-react'

export function TeamCard({ team, memberCount, onViewMembers, onDelete }) {
    return (
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="font-bold text-lg text-gray-900">{team.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Criado em {new Date(team.created_at).toLocaleDateString('pt-BR')}
                    </p>
                </div>
                {/* Delete Button */}
                <button
                    onClick={() => onDelete(team)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir time"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            <div className="flex items-center gap-2 text-gray-600 mb-4">
                <Users size={18} />
                <span className="text-sm font-medium">
                    {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
                </span>
            </div>

            <button
                onClick={() => onViewMembers(team)}
                className="w-full flex items-center justify-between px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
                <span className="font-medium">Ver Membros</span>
                <ChevronRight size={18} />
            </button>
        </div>
    )
}

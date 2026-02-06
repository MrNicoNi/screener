import { useState, useRef } from 'react'
import { useUsers } from '../hooks/useUsers'
import { useTeams } from '../hooks/useTeams'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, Upload, Download, Loader2, Check, X, AlertCircle, KeyRound } from 'lucide-react'
import * as XLSX from 'xlsx'
import { ConfirmModal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'

const userSchema = z.object({
    name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    role: z.enum(['admin', 'evaluator', 'analyst']),
    teamId: z.string().optional()
})

export function ManageUsers() {
    const { users, loading, createUser, createUsersBulk, updateUser, deleteUser } = useUsers()
    const { teams, createTeam } = useTeams()
    const toast = useToast()

    // Single User State
    const [showModal, setShowModal] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Bulk User State
    const [showBulkModal, setShowBulkModal] = useState(false)
    const [bulkUsers, setBulkUsers] = useState([])
    const [newTeamsToCreate, setNewTeamsToCreate] = useState([])
    const [bulkResults, setBulkResults] = useState(null)
    const [bulkLoading, setBulkLoading] = useState(false)
    const fileInputRef = useRef(null)

    // Delete Confirmation Modal
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, userId: null, userName: '' })

    // Reset Password Modal
    const [resetPasswordConfirm, setResetPasswordConfirm] = useState({ isOpen: false, userId: null, userName: '' })
    const [isResettingPassword, setIsResettingPassword] = useState(false)

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(userSchema)
    })

    async function onSubmit(data) {
        setError('')
        setSuccess('')

        try {
            await createUser(data)
            toast.success('Usuário criado com sucesso!')
            reset()
            setShowModal(false)
        } catch (err) {
            toast.error(err.message)
            setError(err.message)
        }
    }

    function confirmDelete(userId, userName) {
        setDeleteConfirm({ isOpen: true, userId, userName })
    }

    async function handleDelete() {
        try {
            await deleteUser(deleteConfirm.userId)
            toast.success('Usuário desativado com sucesso!')
            setDeleteConfirm({ isOpen: false, userId: null, userName: '' })
        } catch (err) {
            toast.error(err.message)
            setDeleteConfirm({ isOpen: false, userId: null, userName: '' })
        }
    }

    function confirmResetPassword(userId, userName) {
        setResetPasswordConfirm({ isOpen: true, userId, userName })
    }

    async function handleResetPassword() {
        setIsResettingPassword(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: resetPasswordConfirm.userId
                    })
                }
            )

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Erro ao resetar senha')
            }

            const result = await response.json()
            toast.success(`Senha resetada para: ${result.defaultPassword}`)
            setResetPasswordConfirm({ isOpen: false, userId: null, userName: '' })
        } catch (err) {
            toast.error(err.message)
            setResetPasswordConfirm({ isOpen: false, userId: null, userName: '' })
        } finally {
            setIsResettingPassword(false)
        }
    }

    // --- BULK FUNCTIONS ---

    const downloadTemplate = () => {
        const link = document.createElement('a')
        link.href = '/modelo_usuarios.xlsx'
        link.download = 'modelo_usuarios.xlsx'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleFileUpload = (e) => {
        const file = e.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const workbook = XLSX.read(event.target.result, { type: 'binary' })
                const sheetName = workbook.SheetNames[0]
                const sheet = workbook.Sheets[sheetName]
                const data = XLSX.utils.sheet_to_json(sheet)

                processExcelData(data)
            } catch (err) {
                console.error('Error parsing Excel:', err)
                toast.error('Erro ao ler arquivo. Verifique o formato.')
            }
        }
        reader.readAsBinaryString(file)
        e.target.value = '' // Reset input
    }

    const processExcelData = (data) => {
        const getColumn = (row, ...keys) => {
            for (const key of Object.keys(row)) {
                const normalizedKey = key.trim().toLowerCase()
                for (const searchKey of keys) {
                    if (normalizedKey === searchKey.toLowerCase() || normalizedKey.includes(searchKey.toLowerCase())) {
                        return String(row[key] || '').trim()
                    }
                }
            }
            return ''
        }

        const newTeamsSet = new Set()
        const mappedUsers = data.map((row, index) => {
            const teamName = getColumn(row, 'Time', 'team', 'time')
            const teamResult = findTeamId(teamName)

            if (teamResult.isNew && teamName) {
                newTeamsSet.add(teamName)
            }

            const user = {
                tempId: Math.random().toString(36).substr(2, 9), // UI id for removal
                name: getColumn(row, 'Nome', 'name', 'nome'),
                email: getColumn(row, 'Email', 'email', 'e-mail'),
                role: mapRole(getColumn(row, 'Perfil', 'role', 'perfil') || 'analyst'),
                teamName: teamName,
                teamId: teamResult.id || '',
                isNewTeam: teamResult.isNew,
                password: 'Screener2026',
                valid: true,
                error: null
            }

            // Validation
            if (!user.name) {
                user.valid = false
                user.error = 'Nome obrigatório'
            } else if (!user.email || !user.email.includes('@')) {
                user.valid = false
                user.error = 'Email inválido'
            } else if (users.some(u => u.email === user.email)) {
                user.valid = false
                user.error = 'Email já cadastrado'
            }

            return user
        })

        setNewTeamsToCreate([...newTeamsSet])
        setBulkUsers(mappedUsers)
        setShowBulkModal(true)
        setBulkResults(null)
    }

    const mapRole = (input) => {
        const lower = input.toLowerCase()
        if (lower.includes('admin')) return 'admin'
        if (lower.includes('avaliador') || lower.includes('evaluator')) return 'evaluator'
        return 'analyst'
    }

    const findTeamId = (teamName) => {
        if (!teamName) return { id: '', isNew: false }
        const team = teams.find(t => t.name.toLowerCase() === teamName.toLowerCase())
        if (team) return { id: team.id, isNew: false }
        return { id: null, isNew: true }
    }

    const handleBulkCreate = async () => {
        const validUsers = bulkUsers.filter(u => u.valid)
        if (validUsers.length === 0) return

        setBulkLoading(true)
        try {
            // 1. Create new teams
            const createdTeamsMap = {}
            for (const teamName of newTeamsToCreate) {
                try {
                    const newTeam = await createTeam({ name: teamName })
                    if (newTeam) {
                        createdTeamsMap[teamName.toLowerCase()] = newTeam.id
                    }
                } catch (e) {
                    console.error(`Failed to create team ${teamName}`, e)
                }
            }

            // 2. Prepare users with team IDs
            const usersWithTeamIds = validUsers.map(u => ({
                name: u.name,
                email: u.email,
                role: u.role,
                password: u.password,
                teamId: u.teamId || createdTeamsMap[u.teamName?.toLowerCase()] || null
            }))

            // 3. Create users
            const results = await createUsersBulk(usersWithTeamIds)
            setBulkResults(results)
            setBulkUsers([]) // Clear preview
            setShowBulkModal(false) // Close preview modal

            // Refresh main success message if all good
            if (results.every(r => r.success)) {
                toast.success(`${results.length} usuários criados com sucesso!`)
            }
        } catch (err) {
            toast.error('Erro na criação em massa: ' + err.message)
            setError('Erro na criação em massa: ' + err.message)
        } finally {
            setBulkLoading(false)
        }
    }

    const removeUserFromPreview = (tempId) => {
        const updatedUsers = bulkUsers.filter(u => u.tempId !== tempId)
        setBulkUsers(updatedUsers)

        // Update new teams list based on remaining users
        const remainingNewTeams = new Set()
        updatedUsers.forEach(u => {
            if (u.isNewTeam && u.teamName) {
                remainingNewTeams.add(u.teamName)
            }
        })
        setNewTeamsToCreate([...remainingNewTeams])
    }

    if (loading) {
        return <div className="text-center py-12">Carregando...</div>
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Gerenciar Usuários</h1>
                    <p className="text-gray-500 mt-1">Gerencie acessos e permissões do sistema</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={downloadTemplate}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                    >
                        <Download size={18} />
                        Modelo Excel
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                        <Upload size={18} />
                        Importar Excel
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                        <Plus size={20} />
                        Novo Usuário
                    </button>
                </div>
            </div>

            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                    <Check size={20} />
                    {success}
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Função</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                        user.role === 'evaluator' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">{user.team?.name || '-'}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {user.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => confirmResetPassword(user.id, user.name)}
                                            className="text-blue-600 hover:text-blue-800"
                                            title="Resetar senha"
                                        >
                                            <KeyRound size={18} />
                                        </button>
                                        <button
                                            onClick={() => confirmDelete(user.id, user.name)}
                                            className="text-red-600 hover:text-red-800"
                                            title="Desativar usuário"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create User Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 max-w-md w-full">
                        <h2 className="text-2xl font-bold mb-4">Novo Usuário</h2>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nome</label>
                                <input
                                    {...register('name')}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    {...register('email')}
                                    type="email"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Senha</label>
                                <input
                                    {...register('password')}
                                    type="password"
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Função</label>
                                <select {...register('role')} className="w-full px-3 py-2 border rounded-lg">
                                    <option value="analyst">Analista</option>
                                    <option value="evaluator">Avaliador</option>
                                    <option value="admin">Admin</option>
                                </select>
                                {errors.role && <p className="text-red-500 text-sm mt-1">{errors.role.message}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Time (opcional)</label>
                                <select {...register('teamId')} className="w-full px-3 py-2 border rounded-lg">
                                    <option value="">Sem time</option>
                                    {teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Criando...' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Preview Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Importar Usuários</h2>
                            <button onClick={() => setShowBulkModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>

                        {newTeamsToCreate.length > 0 && (
                            <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-lg flex items-start gap-2 text-sm">
                                <AlertCircle size={16} className="mt-0.5" />
                                <div>
                                    <span className="font-semibold">Novos times serão criados:</span>{' '}
                                    {newTeamsToCreate.join(', ')}
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-auto border rounded-lg mb-4">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="p-3 font-medium">Status</th>
                                        <th className="p-3 font-medium">Nome</th>
                                        <th className="p-3 font-medium">Email</th>
                                        <th className="p-3 font-medium">Perfil</th>
                                        <th className="p-3 font-medium">Time</th>
                                        <th className="p-3 font-medium">Senha</th>
                                        <th className="p-3 font-medium text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {bulkUsers.map((u) => (
                                        <tr key={u.tempId} className={u.valid ? '' : 'bg-red-50'}>
                                            <td className="p-3">
                                                {u.valid ? <Check size={16} className="text-green-500" /> : <span className="text-red-500 font-bold">!</span>}
                                            </td>
                                            <td className="p-3">
                                                {u.name}
                                                {!u.valid && u.error === 'Nome obrigatório' && <div className="text-xs text-red-500">{u.error}</div>}
                                            </td>
                                            <td className="p-3">
                                                {u.email}
                                                {!u.valid && (u.error === 'Email inválido' || u.error === 'Email já cadastrado') && <div className="text-xs text-red-500">{u.error}</div>}
                                            </td>
                                            <td className="p-3 capitalize">{u.role}</td>
                                            <td className="p-3">
                                                {u.teamName || '-'}
                                                {u.isNewTeam && <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded ml-1">Novo</span>}
                                            </td>
                                            <td className="p-3 font-mono text-xs">{u.password}</td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => removeUserFromPreview(u.tempId)}
                                                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                                    title="Remover linha"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {bulkUsers.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="p-4 text-center text-gray-500">Nenhum usuário para importar</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-sm">
                                {bulkUsers.filter(u => u.valid).length} usuários válidos de {bulkUsers.length}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowBulkModal(false)}
                                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleBulkCreate}
                                    disabled={bulkLoading || bulkUsers.filter(u => u.valid).length === 0}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {bulkLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                    Confirmar Importação
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Modal */}
            {bulkResults && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Resultado da Importação</h2>
                            <button onClick={() => setBulkResults(null)} className="text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto border rounded-lg mb-4">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="p-3">Email</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Detalhes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {bulkResults.map((res, i) => (
                                        <tr key={i} className={res.success ? 'bg-green-50' : 'bg-red-50'}>
                                            <td className="p-3 font-medium">{res.email}</td>
                                            <td className="p-3">
                                                {res.success ? <span className="text-green-600 font-bold">Sucesso</span> : <span className="text-red-600 font-bold">Erro</span>}
                                            </td>
                                            <td className="p-3 text-sm">
                                                {res.success ? 'Usuário criado' : res.error}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="text-right">
                            <button
                                onClick={() => setBulkResults(null)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, userId: null, userName: '' })}
                onConfirm={handleDelete}
                title="Desativar Usuário"
                message={`Tem certeza que deseja desativar o usuário "${deleteConfirm.userName}"? Esta ação pode ser revertida posteriormente.`}
                confirmText="Desativar"
                cancelText="Cancelar"
                isDestructive={true}
            />

            {/* Reset Password Confirmation Modal */}
            <ConfirmModal
                isOpen={resetPasswordConfirm.isOpen}
                onClose={() => setResetPasswordConfirm({ isOpen: false, userId: null, userName: '' })}
                onConfirm={handleResetPassword}
                title="Resetar Senha"
                message={`Tem certeza que deseja resetar a senha de "${resetPasswordConfirm.userName}"? A nova senha será: Enghouse@2025 e o usuário será forçado a alterá-la no próximo login.`}
                confirmText={isResettingPassword ? "Resetando..." : "Resetar Senha"}
                cancelText="Cancelar"
                isDestructive={false}
            />
        </div>
    )
}

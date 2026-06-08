import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Filter, Eye, Trash2, X, Calendar, TrendingUp, Award, AlertCircle, CheckSquare, Square } from 'lucide-react'
import { useEvaluations } from '../hooks/useEvaluations'
import { useUsers } from '../hooks/useUsers'
import { useToast } from '../components/Toast'
import { ConfirmModal } from '../components/Modal'
import { getStatusDisplay } from '../lib/scoring'

export function ManageEvaluations() {
    const navigate = useNavigate()
    const { evaluations, loading, deleteEvaluation, bulkDeleteEvaluations, bulkAcknowledgeEvaluations, refresh } = useEvaluations()
    const { users } = useUsers()
    const { showToast } = useToast()

    // State
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [analystFilter, setAnalystFilter] = useState('all')
    const [evaluatorFilter, setEvaluatorFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState('all') // all, today, week, month
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(25)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [evaluationToDelete, setEvaluationToDelete] = useState(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Bulk actions state
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
    const [bulkAcknowledgeModalOpen, setBulkAcknowledgeModalOpen] = useState(false)
    const [isBulkProcessing, setIsBulkProcessing] = useState(false)

    // Get analysts and evaluators for filters
    const analysts = users.filter(u => u.role === 'analyst')
    const evaluators = users.filter(u => u.role === 'evaluator' || u.role === 'admin')

    // Filter and search logic
    const filteredEvaluations = useMemo(() => {
        let filtered = [...evaluations]

        // Search by ticket ID or analyst name
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            filtered = filtered.filter(e =>
                e.ticket_id?.toLowerCase().includes(term) ||
                e.analyst?.name?.toLowerCase().includes(term)
            )
        }

        // Filter by status
        if (statusFilter !== 'all') {
            filtered = filtered.filter(e => e.status === statusFilter)
        }

        // Filter by analyst
        if (analystFilter !== 'all') {
            filtered = filtered.filter(e => e.analyst_id === analystFilter)
        }

        // Filter by evaluator
        if (evaluatorFilter !== 'all') {
            filtered = filtered.filter(e => e.evaluator_id === evaluatorFilter)
        }

        // Filter by date
        if (dateFilter !== 'all') {
            const now = new Date()
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

            filtered = filtered.filter(e => {
                const evalDate = new Date(e.created_at)
                const evalDay = new Date(evalDate.getFullYear(), evalDate.getMonth(), evalDate.getDate())

                switch (dateFilter) {
                    case 'today':
                        return evalDay.getTime() === today.getTime()
                    case 'week':
                        const weekAgo = new Date(today)
                        weekAgo.setDate(weekAgo.getDate() - 7)
                        return evalDay >= weekAgo
                    case 'month':
                        const monthAgo = new Date(today)
                        monthAgo.setMonth(monthAgo.getMonth() - 1)
                        return evalDay >= monthAgo
                    default:
                        return true
                }
            })
        }

        return filtered
    }, [evaluations, searchTerm, statusFilter, analystFilter, evaluatorFilter, dateFilter])

    // Calculate statistics
    const stats = useMemo(() => {
        const total = filteredEvaluations.length
        const avgScore = total > 0
            ? Math.round(filteredEvaluations.reduce((sum, e) => sum + (e.final_score || 0), 0) / total)
            : 0
        const approvalRate = total > 0
            ? Math.round((filteredEvaluations.filter(e => e.final_score >= 75).length / total) * 100)
            : 0
        const pending = filteredEvaluations.filter(e => !e.analyst_acknowledged).length

        return { total, avgScore, approvalRate, pending }
    }, [filteredEvaluations])

    // Pagination
    const totalPages = Math.ceil(filteredEvaluations.length / itemsPerPage)
    const paginatedEvaluations = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage
        return filteredEvaluations.slice(startIndex, startIndex + itemsPerPage)
    }, [filteredEvaluations, currentPage, itemsPerPage])

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1)
        setSelectedIds(new Set()) // Clear selection when filters change
    }, [searchTerm, statusFilter, analystFilter, evaluatorFilter, dateFilter])

    // Selection handlers
    const toggleSelection = (id) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev)
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
            return newSet
        })
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedEvaluations.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(paginatedEvaluations.map(e => e.id)))
        }
    }

    const isAllSelected = paginatedEvaluations.length > 0 && selectedIds.size === paginatedEvaluations.length

    // Handlers
    const handleDelete = async () => {
        if (!evaluationToDelete) return

        setIsDeleting(true)
        try {
            await deleteEvaluation(evaluationToDelete.id)
            showToast('Avaliação excluída com sucesso!', 'success')
            setDeleteModalOpen(false)
            setEvaluationToDelete(null)
            refresh()
        } catch (err) {
            console.error('Error deleting evaluation:', err)
            showToast(err.message || 'Erro ao excluir avaliação', 'error')
        } finally {
            setIsDeleting(false)
        }
    }

    const openDeleteModal = (evaluation) => {
        setEvaluationToDelete(evaluation)
        setDeleteModalOpen(true)
    }

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return

        setIsBulkProcessing(true)
        try {
            await bulkDeleteEvaluations(Array.from(selectedIds))
            showToast(`${selectedIds.size} avaliação(ões) excluída(s) com sucesso!`, 'success')
            setBulkDeleteModalOpen(false)
            setSelectedIds(new Set())
            refresh()
        } catch (err) {
            console.error('Error bulk deleting:', err)
            showToast(err.message || 'Erro ao excluir avaliações', 'error')
        } finally {
            setIsBulkProcessing(false)
        }
    }

    const handleBulkAcknowledge = async () => {
        if (selectedIds.size === 0) return

        setIsBulkProcessing(true)
        try {
            await bulkAcknowledgeEvaluations(Array.from(selectedIds))
            showToast(`${selectedIds.size} avaliação(ões) marcada(s) como lida(s)!`, 'success')
            setBulkAcknowledgeModalOpen(false)
            setSelectedIds(new Set())
            refresh()
        } catch (err) {
            console.error('Error bulk acknowledging:', err)
            showToast(err.message || 'Erro ao marcar avaliações', 'error')
        } finally {
            setIsBulkProcessing(false)
        }
    }

    const clearFilters = () => {
        setSearchTerm('')
        setStatusFilter('all')
        setAnalystFilter('all')
        setEvaluatorFilter('all')
        setDateFilter('all')
    }

    const hasActiveFilters = searchTerm || statusFilter !== 'all' || analystFilter !== 'all' ||
        evaluatorFilter !== 'all' || dateFilter !== 'all'

    if (loading) {
        return (
            <div className="animate-pulse space-y-6">
                <div className="h-32 bg-slate-200 rounded-2xl"></div>
                <div className="h-96 bg-slate-200 rounded-2xl"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">Gerenciar Avaliações</h1>
                    <p className="text-slate-500 mt-1">Visualize e gerencie todas as avaliações do sistema</p>
                </div>
                <Link
                    to="/nova-auditoria"
                    className="px-4 py-2 bg-navita-blue text-white rounded-xl hover:bg-navita-dark-blue transition font-medium shadow-lg shadow-blue-900/20"
                >
                    + Nova Auditoria
                </Link>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    icon={<Award className="w-5 h-5" />}
                    label="Total de Avaliações"
                    value={stats.total}
                    color="blue"
                />
                <StatCard
                    icon={<TrendingUp className="w-5 h-5" />}
                    label="Score Médio"
                    value={`${stats.avgScore}%`}
                    color="green"
                />
                <StatCard
                    icon={<Award className="w-5 h-5" />}
                    label="Taxa de Aprovação"
                    value={`${stats.approvalRate}%`}
                    color="purple"
                />
                <StatCard
                    icon={<AlertCircle className="w-5 h-5" />}
                    label="Pendentes"
                    value={stats.pending}
                    color="amber"
                />
            </div>

            {/* Search and Filters */}
            <div className="clean-card rounded-2xl p-6 space-y-4">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por ticket ou analista..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                    />
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                    >
                        <option value="all">Todos os Status</option>
                        <option value="excellent">Excelente</option>
                        <option value="approved">Aprovado</option>
                        <option value="failed">Reprovado</option>
                        <option value="pending">Pendente</option>
                        <option value="acknowledged">Confirmado</option>
                        <option value="disputed">Contestado</option>
                    </select>

                    <select
                        value={analystFilter}
                        onChange={(e) => setAnalystFilter(e.target.value)}
                        className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                    >
                        <option value="all">Todos os Analistas</option>
                        {analysts.map(analyst => (
                            <option key={analyst.id} value={analyst.id}>{analyst.name}</option>
                        ))}
                    </select>

                    <select
                        value={evaluatorFilter}
                        onChange={(e) => setEvaluatorFilter(e.target.value)}
                        className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                    >
                        <option value="all">Todos os Avaliadores</option>
                        {evaluators.map(evaluator => (
                            <option key={evaluator.id} value={evaluator.id}>{evaluator.name}</option>
                        ))}
                    </select>

                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navita-blue focus:border-transparent"
                    >
                        <option value="all">Todos os Períodos</option>
                        <option value="today">Hoje</option>
                        <option value="week">Últimos 7 dias</option>
                        <option value="month">Último mês</option>
                    </select>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition"
                    >
                        <X className="w-4 h-4" />
                        Limpar Filtros
                    </button>
                )}
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="clean-card rounded-2xl p-4 bg-blue-50 border-2 border-navita-blue">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CheckSquare className="w-5 h-5 text-navita-blue" />
                            <span className="font-medium text-slate-900">
                                {selectedIds.size} avaliação(ões) selecionada(s)
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setBulkAcknowledgeModalOpen(true)}
                                className="px-4 py-2 bg-navita-green text-white rounded-xl hover:bg-green-600 transition font-medium shadow-lg shadow-green-900/20"
                            >
                                Marcar como Lidas
                            </button>
                            <button
                                onClick={() => setBulkDeleteModalOpen(true)}
                                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-medium shadow-lg shadow-red-900/20"
                            >
                                Excluir Selecionadas
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition font-medium"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="clean-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left">
                                    <button
                                        onClick={toggleSelectAll}
                                        className="p-1 hover:bg-slate-200 rounded transition"
                                        title={isAllSelected ? "Desselecionar todos" : "Selecionar todos"}
                                    >
                                        {isAllSelected ? (
                                            <CheckSquare className="w-5 h-5 text-navita-blue" />
                                        ) : (
                                            <Square className="w-5 h-5 text-slate-400" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    Ticket
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    Analista
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    Avaliador
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    Score
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    Data
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedEvaluations.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                                        {hasActiveFilters
                                            ? 'Nenhuma avaliação encontrada com os filtros aplicados.'
                                            : 'Nenhuma avaliação cadastrada ainda.'}
                                    </td>
                                </tr>
                            ) : (
                                paginatedEvaluations.map(evaluation => {
                                    const statusDisplay = getStatusDisplay(evaluation.status)
                                    const isSelected = selectedIds.has(evaluation.id)
                                    return (
                                        <tr key={evaluation.id} className={`hover:bg-slate-50 transition ${isSelected ? 'bg-blue-50' : ''}`}>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => toggleSelection(evaluation.id)}
                                                    className="p-1 hover:bg-slate-200 rounded transition"
                                                >
                                                    {isSelected ? (
                                                        <CheckSquare className="w-5 h-5 text-navita-blue" />
                                                    ) : (
                                                        <Square className="w-5 h-5 text-slate-400" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-mono text-sm font-medium text-slate-900">
                                                    #{evaluation.ticket_id}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-slate-700">
                                                    {evaluation.analyst?.name || '—'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-slate-700">
                                                    {evaluation.evaluator?.name || '—'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-lg font-bold ${evaluation.final_score >= 90 ? 'text-navita-green' :
                                                    evaluation.final_score >= 75 ? 'text-navita-blue' :
                                                        'text-red-500'
                                                    }`}>
                                                    {evaluation.final_score}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border ${statusDisplay.bgClass}`}>
                                                    {statusDisplay.text}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-slate-600">
                                                    {new Date(evaluation.created_at).toLocaleDateString('pt-BR')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => navigate(`/avaliacao/${evaluation.id}`)}
                                                        className="p-2 text-navita-blue hover:bg-blue-50 rounded-lg transition"
                                                        title="Ver detalhes"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteModal(evaluation)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredEvaluations.length > 0 && (
                    <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-600">
                                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredEvaluations.length)} de {filteredEvaluations.length} resultados
                            </span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value))
                                    setCurrentPage(1)
                                }}
                                className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
                            >
                                <option value={10}>10 por página</option>
                                <option value={25}>25 por página</option>
                                <option value={50}>50 por página</option>
                                <option value={100}>100 por página</option>
                            </select>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    Anterior
                                </button>

                                {/* Page numbers */}
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum
                                    if (totalPages <= 5) {
                                        pageNum = i + 1
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i
                                    } else {
                                        pageNum = currentPage - 2 + i
                                    }

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`px-3 py-1 rounded-lg transition ${currentPage === pageNum
                                                ? 'bg-navita-blue text-white'
                                                : 'border border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    )
                                })}

                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    Próxima
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false)
                    setEvaluationToDelete(null)
                }}
                onConfirm={handleDelete}
                title="Excluir Avaliação"
                message={`Tem certeza que deseja excluir a avaliação #${evaluationToDelete?.ticket_id}? Esta ação não pode ser desfeita e todos os dados relacionados serão permanentemente removidos.`}
                confirmText="Excluir"
                cancelText="Cancelar"
                isDestructive={true}
                isLoading={isDeleting}
            />

            {/* Bulk Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={bulkDeleteModalOpen}
                onClose={() => setBulkDeleteModalOpen(false)}
                onConfirm={handleBulkDelete}
                title="Excluir Múltiplas Avaliações"
                message={`Tem certeza que deseja excluir ${selectedIds.size} avaliação(ões)? Esta ação não pode ser desfeita e todos os dados relacionados serão permanentemente removidos.`}
                confirmText={`Excluir ${selectedIds.size} Avaliação(ões)`}
                cancelText="Cancelar"
                isDestructive={true}
                isLoading={isBulkProcessing}
            />

            {/* Bulk Acknowledge Confirmation Modal */}
            <ConfirmModal
                isOpen={bulkAcknowledgeModalOpen}
                onClose={() => setBulkAcknowledgeModalOpen(false)}
                onConfirm={handleBulkAcknowledge}
                title="Marcar como Lidas"
                message={`Tem certeza que deseja marcar ${selectedIds.size} avaliação(ões) como lida(s)? Isso atualizará o status para "Acknowledged".`}
                confirmText={`Marcar ${selectedIds.size} como Lida(s)`}
                cancelText="Cancelar"
                isDestructive={false}
                isLoading={isBulkProcessing}
            />
        </div>
    )
}

// Stat Card Component
function StatCard({ icon, label, value, color }) {
    const colorClasses = {
        blue: 'bg-blue-50 text-navita-blue border-blue-100',
        green: 'bg-green-50 text-navita-green border-green-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100'
    }

    return (
        <div className="clean-card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg border ${colorClasses[color]}`}>
                    {icon}
                </div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">{label}</p>
            </div>
            <p className="text-3xl font-display font-bold text-slate-900">{value}</p>
        </div>
    )
}

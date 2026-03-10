/**
 * Screener - Quality Scoring Engine
 * Implements the 3-pillar evaluation framework with weighted scoring
 */

// Framework structure with weights
export const FRAMEWORK = {
    communication: {
        name: 'Comunicação & Atitude',
        weight: 0.35,
        color: 'blue',
        items: [
            { id: 'C1', text: 'Utilizou linguagem clara, objetiva e profissional?', weight: 0.20 },
            { id: 'C2', text: 'Demonstrou empatia e cordialidade (Bom dia/Boa tarde)?', weight: 0.15 },
            { id: 'C3', text: 'Evitou gírias e informalidade excessiva?', weight: 0.15 },
            { id: 'C4', text: 'Instruções foram fáceis de entender (passo a passo)?', weight: 0.10 },
            { id: 'C5', text: 'Manteve comunicação fluida (sem longas pausas)?', weight: 0.20 },
            { id: 'C6', text: 'Adaptou a linguagem ao nível do cliente?', weight: 0.10 },
            { id: 'C7', text: 'Confirmou entendimento antes de prosseguir?', weight: 0.10 },
        ]
    },
    efficiency: {
        name: 'Eficiência & Eficácia',
        weight: 0.30,
        color: 'green',
        items: [
            { id: 'E1', text: 'First Contact Resolution (FCR)?', weight: 0.25 },
            { id: 'E2A', text: 'SLA de Atendimento (tempo até primeiro contato)', weight: 0.10 },  // 40% of 0.25
            { id: 'E2B', text: 'SLA de Solução (tempo até resolução completa)', weight: 0.15 },  // 60% of 0.25
            { id: 'E3', text: 'A solução apresentada foi efetiva e definitiva?', weight: 0.25 },
            { id: 'E4', text: 'Demonstrou domínio técnico da ferramenta?', weight: 0.15 },
            { id: 'E5', text: 'Evitou transferências desnecessárias?', weight: 0.10 },
        ]
    },
    process: {
        name: 'Processos & Ferramentas',
        weight: 0.35,
        color: 'slate',
        items: [
            { id: 'P1', text: 'Seguiu o fluxo correto de troubleshooting?', weight: 0.20 },
            { id: 'P2', text: 'Registrou todas as informações no ticket?', weight: 0.15 },
            { id: 'P3', text: 'Coletou evidências necessárias (Logs/Screenshots)?', weight: 0.15 },
            { id: 'P4', text: 'Categorizou o incidente corretamente?', weight: 0.15 },
            { id: 'P5', text: 'Consultou a Knowledge Base se necessário?', weight: 0.15 },
            { id: 'P6', text: 'Segurança: Validou identidade do solicitante?', weight: 0.10 },
            { id: 'P7', text: 'Fechou conforme padrão (Tabulação)?', weight: 0.10 },
        ]
    }
}

// Auto-fail conditions
export const AUTO_FAIL_CONDITIONS = [
    { id: 'AF1', text: 'Não ofereceu solução ao cliente' },
    { id: 'AF2', text: 'Fechou o chamado sem resolver' },
]

/**
 * Calculate pillar score from item values
 * @param {Object} values - Object with item IDs as keys and scores (1-5) as values
 * @param {string} pillarKey - Key of the pillar (communication, efficiency, process)
 * @returns {number} - Pillar score (0-100)
 */
export const calculatePillarScore = (values, pillarKey) => {
    const pillar = FRAMEWORK[pillarKey]
    if (!pillar) return 0

    let totalScore = 0

    pillar.items.forEach(item => {
        const value = values[item.id] || 0
        // Convert 1-5 scale to percentage (1=0%, 3=50%, 5=100%)
        const normalizedValue = ((value - 1) / 4) * 100
        totalScore += normalizedValue * item.weight
    })

    return Math.round(totalScore * 10) / 10
}

/**
 * Calculate final weighted score
 * @param {Object} values - All item values
 * @param {boolean} hasAutoFail - Whether any auto-fail condition is triggered
 * @returns {Object} - Scores breakdown
 */
export const calculateFinalScore = (values, hasAutoFail = false) => {
    if (hasAutoFail) {
        return {
            communication: 0,
            efficiency: 0,
            process: 0,
            final: 0,
            status: 'failed'
        }
    }

    const communication = calculatePillarScore(values, 'communication')
    const efficiency = calculatePillarScore(values, 'efficiency')
    const process = calculatePillarScore(values, 'process')

    const final =
        (communication * FRAMEWORK.communication.weight) +
        (efficiency * FRAMEWORK.efficiency.weight) +
        (process * FRAMEWORK.process.weight)

    const roundedFinal = Math.round(final * 10) / 10

    let status = 'failed'
    if (roundedFinal >= 90) status = 'excellent'
    else if (roundedFinal >= 75) status = 'approved'

    return {
        communication,
        efficiency,
        process,
        final: roundedFinal,
        status
    }
}

/**
 * Get status display properties
 * @param {string} status - Status key
 * @returns {Object} - Display properties
 */
export const getStatusDisplay = (status) => {
    const displays = {
        excellent: { text: 'Excelente', color: 'green', bgClass: 'bg-green-50 text-green-600 border-green-200' },
        approved: { text: 'Aprovado', color: 'blue', bgClass: 'bg-blue-50 text-blue-600 border-blue-200' },
        failed: { text: 'Reprovado', color: 'red', bgClass: 'bg-red-50 text-red-600 border-red-200' },
        acknowledged: { text: 'Confirmado', color: 'green', bgClass: 'bg-green-50 text-green-600 border-green-200' },
        disputed: { text: 'Contestado', color: 'amber', bgClass: 'bg-amber-50 text-amber-600 border-amber-200' },
        pending: { text: 'Pendente', color: 'slate', bgClass: 'bg-slate-100 text-slate-400 border-slate-200' }
    }
    return displays[status] || displays.pending
}

/**
 * Get acknowledgment status display properties
 * @param {boolean} acknowledged - Whether evaluation was acknowledged
 * @param {string} status - Database status (pending/acknowledged/disputed)
 * @returns {Object} - Display properties
 */
export const getAcknowledgmentDisplay = (acknowledged, status) => {
    if (acknowledged || status === 'acknowledged') {
        return { text: 'Confirmado', color: 'green', bgClass: 'bg-green-50 text-green-600 border-green-200' }
    }
    if (status === 'disputed') {
        return { text: 'Contestado', color: 'orange', bgClass: 'bg-orange-50 text-orange-600 border-orange-200' }
    }
    return { text: 'Pendente', color: 'slate', bgClass: 'bg-slate-100 text-slate-600 border-slate-200' }
}

/**
 * Generate feedback text based on evaluation
 * @param {Object} values - Item values
 * @param {Object} scores - Calculated scores
 * @returns {string} - Generated feedback
 */
export const generateFeedback = (values, scores) => {
    const feedback = []

    // Identify weak areas (items scored 1 or 2)
    const weakItems = []
    Object.entries(FRAMEWORK).forEach(([pillarKey, pillar]) => {
        pillar.items.forEach(item => {
            if (values[item.id] && values[item.id] <= 2) {
                weakItems.push({ pillar: pillar.name, item: item.text })
            }
        })
    })

    if (scores.status === 'excellent') {
        feedback.push('Excelente atendimento! Continue mantendo esse padrão de qualidade.')
    } else if (scores.status === 'approved') {
        feedback.push('Bom atendimento com oportunidades de melhoria.')
    } else {
        feedback.push('Atendimento abaixo do esperado. Atenção aos pontos indicados.')
    }

    if (weakItems.length > 0) {
        feedback.push('\n\n**Pontos de atenção:**')
        weakItems.forEach(weak => {
            feedback.push(`- ${weak.item}`)
        })
    }

    return feedback.join('\n')
}

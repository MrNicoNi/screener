/**
 * import_evaluations.js
 * ─────────────────────────────────────────────────────────
 * Lê scripts/evaluations_to_import.json (preenchido pelo agente)
 * e insere as avaliações no Supabase com datas retroativas.
 *
 * Uso:
 *   node scripts/import_evaluations.js --dry-run   (simula, não toca no banco)
 *   node scripts/import_evaluations.js              (importa de verdade)
 * ─────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── Config ─────────────────────────────────────────────

const IS_DRY_RUN = process.argv.includes('--dry-run')
const INPUT_JSON = path.resolve(__dirname, 'evaluations_to_import.json')

// Lê .env manualmente (igual ao seed_dashboard.js)
const envPath = path.resolve(__dirname, '../.env')
const envContent = fs.readFileSync(envPath, 'utf8')
const getEnvParam = (name) => {
    const match = envContent.match(new RegExp(`^#?\\s*${name}=(.*)$`, 'm'))
    return match ? match[1].trim() : null
}

const SUPABASE_URL = getEnvParam('VITE_SUPABASE_URL')
const SERVICE_ROLE_KEY = getEnvParam('VITE_SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE_KEY não encontrados no .env')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ─── FRAMEWORK (espelho de src/lib/scoring.js) ──────────

const FRAMEWORK = {
    communication: {
        weight: 0.35,
        items: [
            { id: 'C1', weight: 0.20 },
            { id: 'C2', weight: 0.15 },
            { id: 'C3', weight: 0.15 },
            { id: 'C4', weight: 0.10 },
            { id: 'C5', weight: 0.20 },
            { id: 'C6', weight: 0.10 },
            { id: 'C7', weight: 0.10 },
        ]
    },
    efficiency: {
        weight: 0.30,
        items: [
            { id: 'E1', weight: 0.25 },
            { id: 'E2A', weight: 0.10 },
            { id: 'E2B', weight: 0.15 },
            { id: 'E3', weight: 0.25 },
            { id: 'E4', weight: 0.15 },
            { id: 'E5', weight: 0.10 },
        ]
    },
    process: {
        weight: 0.35,
        items: [
            { id: 'P1', weight: 0.20 },
            { id: 'P2', weight: 0.15 },
            { id: 'P3', weight: 0.15 },
            { id: 'P4', weight: 0.15 },
            { id: 'P5', weight: 0.15 },
            { id: 'P6', weight: 0.10 },
            { id: 'P7', weight: 0.10 },
        ]
    }
}

// ─── Score Calculator ────────────────────────────────────

function calculateScores(scores, criticalPass) {
    if (!criticalPass) {
        return {
            score_communication: 0,
            score_efficiency: 0,
            score_process: 0,
            final_score: 0,
            status: 'failed'
        }
    }

    const calcPillar = (pillarKey) => {
        const pillar = FRAMEWORK[pillarKey]
        let total = 0
        pillar.items.forEach(item => {
            const val = scores[item.id]
            if (val === null || val === undefined) {
                throw new Error(`Critério '${item.id}' não preenchido (null). Preencha com 0 ou 1.`)
            }
            // val: 1 = passou, 0 = não passou
            total += val * item.weight
        })
        // Normalizar para 0–100
        const maxPossible = pillar.items.reduce((sum, i) => sum + i.weight, 0)
        return Math.round((total / maxPossible) * 100 * 10) / 10
    }

    const score_communication = calcPillar('communication')
    const score_efficiency = calcPillar('efficiency')
    const score_process = calcPillar('process')

    const final_score = Math.round((
        score_communication * FRAMEWORK.communication.weight +
        score_efficiency * FRAMEWORK.efficiency.weight +
        score_process * FRAMEWORK.process.weight
    ) * 10) / 10

    let status = 'failed'
    if (final_score >= 90) status = 'excellent'
    else if (final_score >= 75) status = 'approved'

    return { score_communication, score_efficiency, score_process, final_score, status }
}

// ─── Main ────────────────────────────────────────────────

async function run() {
    console.log('\n📥 Import Retroativo de Avaliações — ScreenerQA')
    if (IS_DRY_RUN) console.log('🔍 MODO DRY-RUN: nada será gravado no banco\n')
    else console.log('🚀 MODO REAL: importando para o Supabase em produção\n')

    // 1. Ler JSON de input
    if (!fs.existsSync(INPUT_JSON)) {
        console.error(`❌ Arquivo não encontrado: ${INPUT_JSON}`)
        console.log('   → Rode primeiro: node scripts/extract_pdf_text.js')
        process.exit(1)
    }

    const entries = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf8'))

    // 2. Buscar todos os usuários do banco (analysts + evaluator)
    const { data: dbUsers, error: usersError } = await supabase
        .from('users')
        .select('id, email, name, role')

    if (usersError) {
        console.error('❌ Erro ao buscar usuários:', usersError.message)
        process.exit(1)
    }

    const userByEmail = {}
    dbUsers.forEach(u => { userByEmail[u.email.toLowerCase()] = u })

    console.log(`👥 ${dbUsers.length} usuários carregados do banco\n`)
    console.log('─────────────────────────────────────────────\n')

    // 3. Processar cada entrada
    const results = { ok: [], skipped: [], errors: [] }

    for (const entry of entries) {
        const { _source_file, date, ticket_id, analyst_email, feedback, critical_pass, scores } = entry

        process.stdout.write(`📄 [${ticket_id}] ${_source_file} → `)

        // Validações
        if (!analyst_email || analyst_email.includes('⚠️')) {
            console.log('⏭️  PULADO (analyst_email não preenchido)')
            results.skipped.push({ file: _source_file, reason: 'analyst_email não preenchido' })
            continue
        }
        if (!date || date === 'YYYY-MM-DD') {
            console.log('⏭️  PULADO (date não preenchida)')
            results.skipped.push({ file: _source_file, reason: 'date não preenchida' })
            continue
        }

        const analyst = userByEmail[analyst_email.toLowerCase()]
        if (!analyst) {
            console.log(`❌ Analista não encontrado no banco: ${analyst_email}`)
            results.errors.push({ file: _source_file, reason: `Analista '${analyst_email}' não existe no banco` })
            continue
        }

        // Evaluator fixo
        const evaluator = userByEmail['nicolas.andrade@enghouse.com']
        if (!evaluator) {
            console.error('❌ nicolas.andrade@enghouse.com não encontrado no banco. Encerrando.')
            process.exit(1)
        }

        // Calcular scores
        let computed
        try {
            computed = calculateScores(scores, critical_pass)
        } catch (err) {
            console.log(`❌ Erro no cálculo: ${err.message}`)
            results.errors.push({ file: _source_file, reason: err.message })
            continue
        }

        // Timestamp retroativo (final do dia indicado, às 18h)
        const evalDate = new Date(`${date}T18:00:00-03:00`)

        const evalRecord = {
            analyst_id: analyst.id,
            evaluator_id: evaluator.id,
            ticket_id,
            ticket_subject: entry.ticket_subject || null,
            final_score: computed.final_score,
            score_communication: computed.score_communication,
            score_efficiency: computed.score_efficiency,
            score_process: computed.score_process,
            status: computed.status,
            feedback: feedback || '',
            analyst_acknowledged: true,          // Retroativo = já "ciência"
            acknowledged_at: evalDate.toISOString(),
            created_at: evalDate.toISOString(),
            updated_at: evalDate.toISOString(),
        }

        // Preview
        console.log(`✅ ${analyst.name} | ${computed.final_score.toFixed(1)}% (${computed.status}) | ${date}`)

        if (!IS_DRY_RUN) {
            // Inserir avaliação
            const { data: inserted, error: evalError } = await supabase
                .from('evaluations')
                .insert(evalRecord)
                .select()
                .single()

            if (evalError) {
                console.error(`   ❌ Erro ao inserir avaliação: ${evalError.message}`)
                results.errors.push({ file: _source_file, reason: evalError.message })
                continue
            }

            // Inserir evaluation_items
            const items = []
            Object.entries(FRAMEWORK).forEach(([, pillar]) => {
                pillar.items.forEach(item => {
                    items.push({
                        evaluation_id: inserted.id,
                        criterion_key: item.id,
                        value: scores[item.id] === 1 ? 5 : 1, // 5=Yes, 1=No (constraint do DB)
                        notes: `Importado retroativamente de ${_source_file}`,
                    })
                })
            })

            const { error: itemsError } = await supabase
                .from('evaluation_items')
                .insert(items)

            if (itemsError) {
                console.error(`   ⚠️  Avaliação criada mas items falharam: ${itemsError.message}`)
            }
        }

        results.ok.push({ file: _source_file, ticket_id, analyst: analyst.name, score: computed.final_score, status: computed.status, date })
    }

    // ─── Relatório Final ───────────────────────────────────

    console.log('\n═══════════════════════════════════════════════')
    console.log('📊 RELATÓRIO FINAL')
    console.log('═══════════════════════════════════════════════')
    console.log(`✅ Importadas com sucesso: ${results.ok.length}`)
    console.log(`⏭️  Puladas (incompletas):  ${results.skipped.length}`)
    console.log(`❌ Erros:                  ${results.errors.length}`)

    if (results.ok.length > 0) {
        const avgScore = results.ok.reduce((s, r) => s + r.score, 0) / results.ok.length
        console.log(`\n📈 Nota média das importadas: ${avgScore.toFixed(1)}%`)
    }

    if (results.skipped.length > 0) {
        console.log('\n⏭️  Puladas:')
        results.skipped.forEach(s => console.log(`   • ${s.file}: ${s.reason}`))
    }

    if (results.errors.length > 0) {
        console.log('\n❌ Erros:')
        results.errors.forEach(e => console.log(`   • ${e.file}: ${e.reason}`))
    }

    if (IS_DRY_RUN) {
        console.log('\n🔍 DRY-RUN concluído. Para importar de verdade:')
        console.log('   node scripts/import_evaluations.js\n')
    } else {
        console.log(`\n🎉 Importação concluída! Acesse https://screenerqa.vercel.app para verificar.\n`)
    }
}

run().catch(err => {
    console.error('\n💥 Erro inesperado:', err.message)
    process.exit(1)
})

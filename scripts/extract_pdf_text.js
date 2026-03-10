/**
 * extract_pdf_text.js
 * ─────────────────────────────────────────────────────────
 * Lê todos os PDFs da pasta scripts/pdfs/ e extrai seu conteúdo
 * de texto para arquivos .txt em scripts/extracted/.
 *
 * Também gera um arquivo JSON de template (evaluations_to_import.json)
 * pronto para ser preenchido com as avaliações.
 *
 * Uso:
 *   node scripts/extract_pdf_text.js
 * ─────────────────────────────────────────────────────────
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PDFS_DIR = path.resolve(__dirname, 'pdfs')
const EXTRACTED_DIR = path.resolve(__dirname, 'extracted')
const OUTPUT_JSON = path.resolve(__dirname, 'evaluations_to_import.json')
const EVALUATOR_EMAIL = 'nicolas.andrade@enghouse.com'

// ─── Helpers ────────────────────────────────────────────

/**
 * Tenta extrair a data de fechamento/último atendimento do texto do PDF.
 * Retorna ISO string (YYYY-MM-DD) ou null se não encontrado.
 */
function extractDate(text) {
    // Padrões comuns em sistemas de tickets (em português e inglês)
    const patterns = [
        // "Fechado em: 14/02/2026" ou "Data de fechamento: 14/02/2026"
        /(?:fechad[oa] em|data de fechamento|resolved|closed|encerrad[oa] em)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
        // "Último atendimento: 14/02/2026"
        /(?:último atendimento|last updated|data do chamado)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
        // Data isolada no formato DD/MM/YYYY
        /(\d{2}\/\d{2}\/\d{4})/,
        // Data no formato YYYY-MM-DD
        /(\d{4}-\d{2}-\d{2})/,
    ]

    for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) {
            const raw = match[1]
            // Normalizar para ISO
            if (raw.includes('/')) {
                const parts = raw.split('/')
                if (parts[0].length === 4) {
                    // YYYY/MM/DD
                    return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`
                } else {
                    // DD/MM/YYYY
                    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
                }
            }
            return raw
        }
    }
    return null
}

/**
 * Tenta extrair o número do ticket do texto ou nome do arquivo.
 */
function extractTicketId(text, filename) {
    // Padrões comuns
    const patterns = [
        /(?:ticket|chamado|caso|case|incidente|incident|INC|TKT|REQ)[:\s#-]*([A-Z0-9\-]+)/i,
        /(?:nº|n°|número|number)[:\s]*([A-Z0-9\-]+)/i,
    ]

    for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) return match[1].trim()
    }

    // Fallback: usar nome do arquivo sem extensão
    return path.basename(filename, '.pdf').replace(/[^A-Z0-9\-_]/gi, '-')
}

/**
 * Tenta extrair o nome/email do analista do texto.
 */
function extractAnalyst(text) {
    const patterns = [
        /(?:analista|atendente|agente|analyst|agent|atendido por)[:\s]+([A-ZÀ-Ú][a-zà-ú]+ [A-ZÀ-Ú][a-zà-ú]+)/i,
        /(?:responsável|assignee)[:\s]+([A-ZÀ-Ú][a-zà-ú]+ [A-ZÀ-Ú][a-zà-ú]+)/i,
    ]

    for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) return match[1].trim()
    }
    return null
}

// ─── FRAMEWORK (espelho de src/lib/scoring.js) ──────────

const CRITERIA_KEYS = [
    'C1','C2','C3','C4','C5','C6','C7',
    'E1','E2A','E2B','E3','E4','E5',
    'P1','P2','P3','P4','P5','P6','P7',
]

const CRITERIA_DESCRIPTIONS = {
    C1: 'Utilizou linguagem clara, objetiva e profissional?',
    C2: 'Demonstrou empatia e cordialidade (Bom dia/Boa tarde)?',
    C3: 'Evitou gírias e informalidade excessiva?',
    C4: 'Instruções foram fáceis de entender (passo a passo)?',
    C5: 'Manteve comunicação fluida (sem longas pausas)?',
    C6: 'Adaptou a linguagem ao nível do cliente?',
    C7: 'Confirmou entendimento antes de prosseguir?',
    E1: 'First Contact Resolution (FCR)?',
    E2A: 'SLA de Atendimento (tempo até primeiro contato)',
    E2B: 'SLA de Solução (tempo até resolução completa)',
    E3: 'A solução apresentada foi efetiva e definitiva?',
    E4: 'Demonstrou domínio técnico da ferramenta?',
    E5: 'Evitou transferências desnecessárias?',
    P1: 'Seguiu o fluxo correto de troubleshooting?',
    P2: 'Registrou todas as informações no ticket?',
    P3: 'Coletou evidências necessárias (Logs/Screenshots)?',
    P4: 'Categorizou o incidente corretamente?',
    P5: 'Consultou a Knowledge Base se necessário?',
    P6: 'Segurança: Validou identidade do solicitante?',
    P7: 'Fechou conforme padrão (Tabulação)?',
}

// ─── Main ────────────────────────────────────────────────

async function run() {
    console.log('\n📂 Iniciando extração de PDFs...\n')

    // Garantir diretório de output
    if (!fs.existsSync(EXTRACTED_DIR)) {
        fs.mkdirSync(EXTRACTED_DIR, { recursive: true })
    }

    // Listar PDFs
    const files = fs.readdirSync(PDFS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'))

    if (files.length === 0) {
        console.error('❌ Nenhum PDF encontrado em scripts/pdfs/')
        console.log('   → Coloque os arquivos PDF dos atendimentos nessa pasta e rode novamente.\n')
        process.exit(1)
    }

    console.log(`📄 ${files.length} PDF(s) encontrado(s):\n`)

    const template = []
    const errors = []

    for (const file of files) {
        const pdfPath = path.join(PDFS_DIR, file)
        process.stdout.write(`   Processando: ${file} ... `)

        try {
            const buffer = fs.readFileSync(pdfPath)
            const data = await pdfParse(buffer)
            const text = data.text

            // Salvar texto extraído
            const txtFile = path.join(EXTRACTED_DIR, file.replace('.pdf', '.txt'))
            fs.writeFileSync(txtFile, text, 'utf8')

            // Tentar extrair metadados
            const ticketId = extractTicketId(text, file)
            const date = extractDate(text)
            const analystHint = extractAnalyst(text)

            console.log('✅')
            if (!date) console.log(`      ⚠️  Data não encontrada automaticamente — preencha o campo 'date' manualmente`)
            if (!analystHint) console.log(`      ⚠️  Analista não identificado — preencha 'analyst_email' manualmente`)

            // Montar entrada do template
            const entry = {
                _source_file: file,
                _extracted_text_file: `scripts/extracted/${file.replace('.pdf', '.txt')}`,
                _analyst_hint: analystHint || '⚠️ PREENCHER',
                // ── CAMPOS QUE O AGENTE VAI PREENCHER ──
                date: date || 'YYYY-MM-DD',
                ticket_id: ticketId,
                analyst_email: '⚠️ PREENCHER com email do analista',
                feedback: '',
                critical_pass: true,
                // Critérios: 1 = Sim (atendeu), 0 = Não (não atendeu)
                // O agente deve preencher com base no texto extraído
                scores: Object.fromEntries(CRITERIA_KEYS.map(k => [k, null])),
                _criteria_descriptions: CRITERIA_DESCRIPTIONS,
            }

            template.push(entry)
        } catch (err) {
            console.log('❌ ERRO')
            console.error(`      Detalhe: ${err.message}`)
            errors.push({ file, error: err.message })
        }
    }

    // Gravar JSON de template
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(template, null, 2), 'utf8')

    console.log('\n─────────────────────────────────────────────')
    console.log(`✅ Extração concluída!`)
    console.log(`   • ${template.length} PDF(s) extraídos com sucesso`)
    if (errors.length > 0) console.log(`   • ${errors.length} erro(s) — verifique acima`)
    console.log(`\n📝 Próximo passo:`)
    console.log(`   O agente vai ler os textos em scripts/extracted/ e preencher`)
    console.log(`   as avaliações em: scripts/evaluations_to_import.json`)
    console.log(`\n   Depois rode:`)
    console.log(`   node scripts/import_evaluations.js --dry-run`)
    console.log(`   node scripts/import_evaluations.js\n`)
}

run().catch(err => {
    console.error('\n💥 Erro inesperado:', err.message)
    process.exit(1)
})

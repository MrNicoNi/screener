/**
 * Deleta e re-insere a avaliação do ticket #96717 com os scores corretos.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8')
const getEnv = (n) => env.match(new RegExp(`^#?\\s*${n}=(.*)$`, 'm'))?.[1]?.trim()
const sb = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY'))

// ── Busca IDs ──────────────────────────────────────────
const { data: users } = await sb.from('users').select('id,email,name')
const byEmail = {}
users.forEach(u => byEmail[u.email.toLowerCase()] = u)

const analyst  = byEmail['leticia.guimaraes@enghouse.com']
const evaluator = byEmail['nicolas.andrade@enghouse.com']

if (!analyst || !evaluator) {
  console.error('Usuário não encontrado:', { analyst: !!analyst, evaluator: !!evaluator })
  process.exit(1)
}

// ── Deleta avaliação antiga do ticket 96717 ────────────
const { error: delErr } = await sb
  .from('evaluations')
  .delete()
  .eq('ticket_id', '96717')
  .eq('analyst_id', analyst.id)

if (delErr) { console.error('Erro ao deletar:', delErr.message); process.exit(1) }
console.log('✅ Avaliação antiga deletada')

// ── FRAMEWORK weights ──────────────────────────────────
const FRAMEWORK = {
  communication: {
    weight: 0.35,
    items: [
      { id: 'C1', weight: 0.20 }, { id: 'C2', weight: 0.15 }, { id: 'C3', weight: 0.15 },
      { id: 'C4', weight: 0.10 }, { id: 'C5', weight: 0.20 }, { id: 'C6', weight: 0.10 },
      { id: 'C7', weight: 0.10 },
    ]
  },
  efficiency: {
    weight: 0.30,
    items: [
      { id: 'E1', weight: 0.25 }, { id: 'E2A', weight: 0.10 }, { id: 'E2B', weight: 0.15 },
      { id: 'E3', weight: 0.25 }, { id: 'E4', weight: 0.15 }, { id: 'E5', weight: 0.10 },
    ]
  },
  process: {
    weight: 0.35,
    items: [
      { id: 'P1', weight: 0.20 }, { id: 'P2', weight: 0.15 }, { id: 'P3', weight: 0.15 },
      { id: 'P4', weight: 0.15 }, { id: 'P5', weight: 0.15 }, { id: 'P6', weight: 0.10 },
      { id: 'P7', weight: 0.10 },
    ]
  }
}

// ── Scores revisados (ticket 96717 - PDF completo) ─────
const scores = {
  C1: 1,  // Linguagem clara e profissional ✅
  C2: 1,  // Bom dia/Boa tarde em todas as mensagens ✅
  C3: 1,  // Sem gírias ✅
  C4: 1,  // Passo a passo detalhado com 2 opções de solução ✅
  C5: 1,  // Comunicação fluida, retornos ágeis ✅
  C6: 1,  // Adaptou linguagem ao analista de TI ✅
  C7: 1,  // Confirmou entendimento e solicitou validação ✅
  E1: 1,  // FCR: cliente confirmou "está certinho, muito obrigado" ✅
  E2A: 1, // SLA dentro do prazo (atendeu em 28/01, aberto em 28/01) ✅
  E2B: 1, // Fechado em 03/02 conforme SLA padrão ✅
  E3: 1,  // Solução efetiva e definitiva confirmada pelo cliente ✅
  E4: 1,  // Domínio técnico: identificou PWA vs Browser, escalou N2 corretamente ✅
  E5: 1,  // Escalou para N2 (correto - não foi transferência desnecessária) ✅
  P1: 1,  // Seguiu fluxo: análise → N2 → alternativa → validação ✅
  P2: 1,  // Registrou todas as etapas e mudanças no ticket ✅
  P3: 1,  // Cliente enviou evidências (prints) e foram tratadas ✅
  P4: 1,  // Categoria correta: Dúvidas Aplicativos ✅
  P5: 1,  // Consultou documentação IBM / conhecimento do produto ✅
  P6: 0,  // Validação de identidade do solicitante não evidenciada
  P7: 1,  // Fechamento padrão com confirmação do cliente ✅
}

// ── Calcula scores ─────────────────────────────────────
const calcPillar = (key) => {
  const p = FRAMEWORK[key]
  let total = 0
  p.items.forEach(i => { total += scores[i.id] * i.weight })
  return Math.round((total / p.items.reduce((s, i) => s + i.weight, 0)) * 100 * 10) / 10
}

const sc = calcPillar('communication')
const se = calcPillar('efficiency')
const sp = calcPillar('process')
const final = Math.round((sc * 0.35 + se * 0.30 + sp * 0.35) * 10) / 10
const status = final >= 90 ? 'excellent' : final >= 75 ? 'approved' : 'failed'

console.log(`📊 Scores recalculados:`)
console.log(`   Comunicação: ${sc}% | Eficiência: ${se}% | Processos: ${sp}%`)
console.log(`   Nota final: ${final}% → ${status}`)

// ── Data retroativa: 03/02/2026 ─────────────────────────
const evalDate = new Date('2026-02-03T18:00:00-03:00')

const evalRecord = {
  analyst_id: analyst.id,
  evaluator_id: evaluator.id,
  ticket_id: '96717',
  ticket_subject: 'App para Android via Chrome - MDM Quiosque G.PANIZ',
  final_score: final,
  score_communication: sc,
  score_efficiency: se,
  score_process: sp,
  status,
  feedback: 'Excelente atendimento técnico. Leticia identificou o problema (PWA vs MaaS360 Secure Browser), apresentou 2 opções de solução detalhadas com passo a passo, escalou corretamente para N2 ao encontrar limitação técnica (browser pago), propôs alternativa gratuita via Chrome, distribuiu o webapp e obteve confirmação de sucesso do cliente. FCR atingido com excelência.',
  analyst_acknowledged: true,
  acknowledged_at: evalDate.toISOString(),
  created_at: evalDate.toISOString(),
  updated_at: evalDate.toISOString(),
}

const { data: inserted, error: insErr } = await sb
  .from('evaluations')
  .insert(evalRecord)
  .select()
  .single()

if (insErr) { console.error('Erro ao inserir:', insErr.message); process.exit(1) }
console.log(`✅ Nova avaliação inserida (ID: ${inserted.id})`)

// ── Insere evaluation_items ─────────────────────────────
const items = []
Object.entries(FRAMEWORK).forEach(([, pillar]) => {
  pillar.items.forEach(item => {
    items.push({
      evaluation_id: inserted.id,
      criterion_key: item.id,
      value: scores[item.id] === 1 ? 5 : 1,
      notes: 'Reavaliado com PDF completo (16 páginas)',
    })
  })
})

const { error: itemsErr } = await sb.from('evaluation_items').insert(items)
if (itemsErr) console.warn('⚠️  Items:', itemsErr.message)
else console.log(`✅ ${items.length} evaluation_items inseridos`)

console.log(`\n🎉 Ticket #96717 atualizado: ${final}% (${status})`)
console.log(`   Leticia De Almeida Lima Guimaraes | 03/02/2026`)

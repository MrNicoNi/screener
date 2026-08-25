# Evaluation Form v2 (Support) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir o formulário de QA "carimbador" (binário 0/100) por um instrumento graduado, versionado e dirigido por dados — sem apagar o v1, preservando as 166 avaliações históricas.

**Architecture:** O formulário deixa de ser código e vira dado: três objetos de schema (`evaluation_templates`, `template_criteria`, `evaluations.template_id`) descrevem qualquer versão de formulário. O motor de score (`src/lib/scoring.js`) passa a ler o template ativo do banco em vez do objeto `FRAMEWORK` hard-coded, ganhando três capacidades novas: opção **N/A** com renormalização de bloco, **auto-fail como flag** (booleano fora do cálculo, não mais nota zero) e **coexistência** v1/v2 via campo `area`. O v1 é persistido como template inativo.

**Tech Stack:** React 19 + Vite, Supabase (Postgres 17 + RLS via funções `SECURITY DEFINER`), Vitest (funções puras), migrations SQL numeradas em `supabase/NN_*.sql` aplicadas via Supabase MCP (`apply_migration`, projeto `Screener2.0` / `gyktdmahkifnsrbaxodl`).

---

## Contexto: a realidade atual do banco (fonte da verdade)

Confirmado no schema **vivo** (não no `01_schema.sql`, que já está defasado):

- **`evaluations`** (dataset base: 166 avaliações): `analyst_id`, `evaluator_id`, `ticket_id`, `ticket_subject`, `final_score numeric(5,2)`, `score_communication/efficiency/process numeric`, `status text` **sobrecarregado** (`pending|acknowledged|disputed|excellent|approved|failed`), `analyst_acknowledged bool`, `acknowledged_at` (efetivamente sem uso), `analyst_comment`, `dispute_reason`, `feedback`.
- **`evaluation_items`** (3.319 linhas): `evaluation_id`, `criterion_key text`, `value integer CHECK 1..5` (na prática só {1,5}), `notes`. **Já chaveia por `criterion_key` — não precisa mudar estruturalmente.**
- Sem `template_id`, sem `area`, sem suporte a N/A, sem tabela de template. Todo o `FRAMEWORK` (21 critérios, 35/30/35) vive hard-coded em `src/lib/scoring.js:7`.
- Consomem `FRAMEWORK`/`criterion_key`: `src/lib/scoring.js`, `src/pages/NewAudit.jsx`, `src/pages/EvaluationDetail.jsx`, `src/hooks/useEvaluations.jsx` (este último usa `evaluation_items.pillar_name` em `getPrincipalOffenderByTeam` — atenção, coluna legada).
- **Teste:** `vitest` configurado em `vite.config.js` apontando para `./src/test/setup.js`, **que não existe** → `npm test` quebra hoje. Zero testes no repo.

---

## Decisões de engenharia (minhas — para você revisar)

Estas foram resolvidas para o plano andar. Se discordar de alguma, é aqui que mudamos antes de codar.

| # | Decisão | Motivo | Alternativa descartada |
|---|---|---|---|
| D1 | **N/A** = `evaluation_items.is_na boolean` + `value` nullable. Regra: `(is_na AND value IS NULL) OR (NOT is_na AND value BETWEEN 1 AND 5)` | Explícito e consultável; preserva a semântica 1/5 das respostas reais e dos 3.319 itens antigos | `value=0` sentinela — colide com o CHECK e polui analytics |
| D2 | **Score continua sendo calculado no front**, mas lendo o template do banco (não `FRAMEWORK`). `final_score` e scores de bloco seguem gravados como snapshot | O problema do spec é "pesos hard-coded", não "score em JS". Mover p/ edge function é lift maior e YAGNI p/ o launch | Reescrever o cálculo como RPC/trigger no Postgres agora |
| D3 | **Auto-fail = critério do template** com `is_auto_fail=true`. É respondido em `evaluation_items` como qualquer outro, mas o motor o **ignora na matemática** e liga `evaluations.has_critical_flag` se algum estiver marcado | Reaproveita o pipe existente de itens; mantém tudo dirigido por template; versionável | Tabela `evaluation_flags` separada — mais superfície p/ a mesma garantia |
| D4 | **Scores de bloco em `evaluations.block_scores jsonb`** (chaveado por bloco), preservando as 3 colunas `score_*` legadas só p/ linhas v1 | Blocos agora são definidos pelo template e variáveis (v2 tem A/B/C; onboarding terá outros). Colunas nomeadas não expressam blocos arbitrários | Remapear v2 nas colunas v1 (lossy/confuso) ou migrar colunas (churn) |
| D5 | **`area`** = `evaluations.area text CHECK ('MDM','TEM','Onboarding')`, nullable. Template ganha `code` (`support-v1`, `support-v2`) + `version` + `is_active`. Um template Support v2 atende MDM e TEM; `area` diferencia por avaliação | É o campo que habilita coexistência (backlog #4). Histórico fica `area = NULL` (desconhecido) | `scope` só no template — não permitiria MDM+TEM no mesmo formulário |
| D6 | Blocos armazenados **denormalizados** em `template_criteria` (`block`, `block_label`, `block_weight`) | Mantém o desenho de duas tabelas do spec; validação garante consistência de soma | Tabela `template_blocks` — terceira tabela não pedida pelo spec |

## Decisões pendentes (suas — de produto, NÃO bloqueiam a fundação)

Registradas aqui; o schema e o launch andam sem elas.

1. ~~**Regra das 36h (C8):** horas comerciais vs. corridas?~~ **RESOLVIDO (2026-08-25 por Nicolas): horas corridas, exceto fins de semana.** Falta ainda definir o comportamento do relógio enquanto aguarda cliente e o que conta como "update". É lógica da query do C8 (Wave 60d, manual no mês 1) — não trava o schema nem o formulário.
2. **TEM/Connect:** template próprio ou Support v2 + `area`? — afeta só o seed.
3. **Ciência obrigatória (backlog #6):** escalar após 5 dias úteis — Wave 60d.

---

## Phase 0 — Ferramental de teste (destrava `npm test`)

### Task 0: Criar o setup file do Vitest

**Files:**
- Create: `src/test/setup.js`

**Step 1: Criar o arquivo de setup**

```js
import '@testing-library/jest-dom'
```

**Step 2: Verificar que o Vitest sobe**

Run: `npm run test:unit`
Expected: roda sem erro de "setup file not found"; "No test files found" é aceitável neste ponto.

**Step 3: Commit**

```bash
git add src/test/setup.js vite.config.js
git commit -m "test: add vitest setup file so the runner boots"
```

---

## Phase 1 — Fundação + Launch (Wave 30 dias, backlog #1–#4)

> Aplicar migrations via Supabase MCP `apply_migration` (projeto `gyktdmahkifnsrbaxodl`) **e** salvar o SQL idêntico em `supabase/NN_*.sql` para versionar. Verificação = `execute_sql` com asserção.

### Task 1: Migration 14 — tabelas de template versionado

**Files:**
- Create: `supabase/14_evaluation_templates.sql`

**Step 1: SQL da migration**

```sql
-- 14_evaluation_templates.sql — formulário como dado (backlog #1)
CREATE TABLE IF NOT EXISTS evaluation_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,            -- ex: 'support-v1', 'support-v2'
  name       TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  is_active  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_criteria (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES evaluation_templates(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,                -- ex: 'E1', 'P2', 'AF_IDENTITY'
  block         TEXT,                         -- 'A'|'B'|'C' (null p/ auto-fail)
  block_label   TEXT,                         -- 'Effectiveness' etc.
  block_weight  NUMERIC(5,2),                 -- peso do bloco no score final (%)
  statement     TEXT NOT NULL,
  weight        NUMERIC(5,2) NOT NULL DEFAULT 0,  -- peso dentro do bloco (%)
  allows_na     BOOLEAN NOT NULL DEFAULT FALSE,
  is_auto_fail  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (template_id, criterion_key)
);

CREATE INDEX IF NOT EXISTS idx_template_criteria_template ON template_criteria(template_id);

-- só um template ativo por família (code sem sufixo de versão)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_template
  ON evaluation_templates ((split_part(code, '-v', 1)))
  WHERE is_active;

ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES evaluation_templates(id);
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS area TEXT
  CHECK (area IN ('MDM','TEM','Onboarding'));
CREATE INDEX IF NOT EXISTS idx_evaluations_template ON evaluations(template_id);
```

**Step 2: Aplicar + verificar**

`apply_migration(name: "evaluation_templates", query: <acima>)`, depois:
Run (`execute_sql`): `SELECT to_regclass('public.evaluation_templates'), to_regclass('public.template_criteria');`
Expected: ambos não-nulos. E `SELECT column_name FROM information_schema.columns WHERE table_name='evaluations' AND column_name IN ('template_id','area');` → 2 linhas.

**Step 3: Commit** `git add supabase/14_evaluation_templates.sql && git commit -m "feat(db): versioned evaluation templates + area on evaluations"`

---

### Task 2: Migration 15 — N/A nos itens + flags no evaluations (D1, D3, D4)

**Files:**
- Create: `supabase/15_na_and_flags.sql`

**Step 1: SQL**

```sql
-- 15_na_and_flags.sql — N/A + auto-fail flag + block_scores
ALTER TABLE evaluation_items ADD COLUMN IF NOT EXISTS is_na BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE evaluation_items ALTER COLUMN value DROP NOT NULL;
ALTER TABLE evaluation_items DROP CONSTRAINT IF EXISTS evaluation_items_value_check;
ALTER TABLE evaluation_items ADD CONSTRAINT evaluation_items_value_check
  CHECK ((is_na AND value IS NULL) OR (NOT is_na AND value BETWEEN 1 AND 5));

ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS has_critical_flag BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS block_scores JSONB;
```

**Step 2: Aplicar + verificar** — inserir uma linha de teste com `is_na=true, value=NULL` numa avaliação descartável e confirmar que passa, e que `is_na=false, value=NULL` é rejeitado. (Rodar num `SELECT` com `pg_input_is_valid` ou num bloco `DO` que faz rollback.)
Expected: CHECK aceita o primeiro caso e recusa o segundo.

**Step 3: Commit** `git commit -m "feat(db): N/A support on items, critical flag + block_scores on evaluations"`

---

### Task 3: Migration 16 — RLS das tabelas de template

**Files:**
- Create: `supabase/16_template_rls.sql`

**Step 1: SQL** (segue o padrão de `is_admin()` `SECURITY DEFINER` já usado no projeto)

```sql
-- 16_template_rls.sql — templates são dado de referência: todos leem, só admin escreve
ALTER TABLE evaluation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_criteria    ENABLE ROW LEVEL SECURITY;

CREATE POLICY tmpl_select_all ON evaluation_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tmpl_admin_write ON evaluation_templates
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY tcrit_select_all ON template_criteria
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tcrit_admin_write ON template_criteria
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
```

**Step 2: Verificar** `SELECT relrowsecurity FROM pg_class WHERE relname IN ('evaluation_templates','template_criteria');` → ambos `t`. Confirmar que `is_admin()` existe: `SELECT proname FROM pg_proc WHERE proname='is_admin';`

**Step 3: Commit** `git commit -m "feat(db): RLS for template tables (read-all, admin-write)"`

---

### Task 4: Migration 17 — seed v1 (inativo) + Support v2 (ativo) + backfill

**Files:**
- Create: `supabase/17_seed_templates.sql`

**Step 1: SQL — template v1 (histórico, inativo)** — chaves e pesos de `src/lib/scoring.js`

```sql
-- 17_seed_templates.sql
-- ── v1: preserva as 166 avaliações interpretáveis (spec §7) ──
WITH t AS (
  INSERT INTO evaluation_templates (code, name, version, is_active)
  VALUES ('support-v1', 'Support QA (v1 — retired)', 1, FALSE)
  RETURNING id
)
INSERT INTO template_criteria (template_id, criterion_key, block, block_label, block_weight, statement, weight, allows_na, is_auto_fail, sort_order)
SELECT t.id, c.* FROM t, (VALUES
  -- Comunicação (35%)
  ('C1','COM','Comunicação & Atitude',35,'Utilizou linguagem clara, objetiva e profissional?',20,false,false,1),
  ('C2','COM','Comunicação & Atitude',35,'Demonstrou empatia e cordialidade?',15,false,false,2),
  ('C3','COM','Comunicação & Atitude',35,'Evitou gírias e informalidade excessiva?',15,false,false,3),
  ('C4','COM','Comunicação & Atitude',35,'Instruções fáceis de entender (passo a passo)?',10,false,false,4),
  ('C5','COM','Comunicação & Atitude',35,'Manteve comunicação fluida (sem longas pausas)?',20,false,false,5),
  ('C6','COM','Comunicação & Atitude',35,'Adaptou a linguagem ao nível do cliente?',10,false,false,6),
  ('C7','COM','Comunicação & Atitude',35,'Confirmou entendimento antes de prosseguir?',10,false,false,7),
  -- Eficiência (30%)
  ('E1','EFI','Eficiência & Eficácia',30,'First Contact Resolution (FCR)?',25,false,false,8),
  ('E2A','EFI','Eficiência & Eficácia',30,'SLA de Atendimento (1º contato)',10,false,false,9),
  ('E2B','EFI','Eficiência & Eficácia',30,'SLA de Solução',15,false,false,10),
  ('E3','EFI','Eficiência & Eficácia',30,'A solução foi efetiva e definitiva?',25,false,false,11),
  ('E4','EFI','Eficiência & Eficácia',30,'Demonstrou domínio técnico da ferramenta?',15,false,false,12),
  ('E5','EFI','Eficiência & Eficácia',30,'Evitou transferências desnecessárias?',10,false,false,13),
  -- Processos (35%)
  ('P1','PRO','Processos & Ferramentas',35,'Seguiu o fluxo correto de troubleshooting?',20,false,false,14),
  ('P2','PRO','Processos & Ferramentas',35,'Registrou todas as informações no ticket?',15,false,false,15),
  ('P3','PRO','Processos & Ferramentas',35,'Coletou evidências (logs/screenshots)?',15,false,false,16),
  ('P4','PRO','Processos & Ferramentas',35,'Categorizou o incidente corretamente?',15,false,false,17),
  ('P5','PRO','Processos & Ferramentas',35,'Consultou a Knowledge Base se necessário?',15,false,false,18),
  ('P6','PRO','Processos & Ferramentas',35,'Segurança: validou identidade do solicitante?',10,false,false,19),
  ('P7','PRO','Processos & Ferramentas',35,'Fechou conforme padrão (tabulação)?',10,false,false,20)
) AS c(criterion_key, block, block_label, block_weight, statement, weight, allows_na, is_auto_fail, sort_order);
```

**Step 2: SQL — template Support v2 (ativo)** — do spec §4 (14 critérios + 4 auto-fails)

```sql
-- ── Support v2 (ativo) ──
WITH t AS (
  INSERT INTO evaluation_templates (code, name, version, is_active)
  VALUES ('support-v2', 'Support QA v2', 2, TRUE)
  RETURNING id
)
INSERT INTO template_criteria (template_id, criterion_key, block, block_label, block_weight, statement, weight, allows_na, is_auto_fail, sort_order)
SELECT t.id, c.* FROM t, (VALUES
  -- Block A — Effectiveness · 45%
  ('E1','A','Effectiveness',45,'Resolvido no primeiro contato, sem transferência e sem segunda coleta de dados?',25,false,false,1),
  ('E3','A','Effectiveness',45,'A solução tratou a causa raiz, sem reabertura do mesmo assunto em 15 dias?',30,true,false,2),
  ('E6','A','Effectiveness',45,'Logs, prints ou evidências foram coletados ANTES de propor a solução?',20,false,false,3),
  ('E4','A','Effectiveness',45,'O caso foi resolvido sem consultar terceiros num tópico coberto por documentação?',15,false,false,4),
  ('E7','A','Effectiveness',45,'Onde houve escalonamento, justificativa e contexto foram registrados?',10,true,false,5),
  -- Block B — Communication · 30%
  ('C8','B','Communication',30,'Nenhum intervalo acima de 36h sem update com o ticket em progresso? (calculado)',30,true,false,6),
  ('C1','B','Communication',30,'Resposta estruturada: problema, ação, próximo passo e responsável explícitos?',25,false,false,7),
  ('C9','B','Communication',30,'Prazo comunicado e, se ia estourar, renegociado antes do vencimento?',25,false,false,8),
  ('C6','B','Communication',30,'Terminologia técnica traduzida ao nível do interlocutor, sem jargão não explicado?',10,false,false,9),
  ('C2','B','Communication',30,'Abertura e fechamento cordiais, incluindo confirmação da resolução?',10,false,false,10),
  -- Block C — Process · 25%
  ('P2','C','Process',25,'Registro completo: sintoma, causa raiz, solução e ambiente no ticket?',35,false,false,11),
  ('P1','C','Process',25,'Seguiu o fluxo de troubleshooting do driver correspondente?',25,false,false,12),
  ('P4','C','Process',25,'Categorizado e tabulado de modo que o ticket seja recuperável por busca?',20,false,false,13),
  ('P5','C','Process',25,'KB usada e, onde não havia artigo, a lacuna foi sinalizada?',20,false,false,14),
  -- Auto-fail — flag, fora do score (block NULL, weight 0)
  ('AF_IDENTITY',NULL,NULL,NULL,'Identidade do solicitante não validada',0,false,true,15),
  ('AF_MISINFO',NULL,NULL,NULL,'Informação factualmente incorreta entregue ao cliente',0,false,true,16),
  ('AF_DEADLINE',NULL,NULL,NULL,'Prazo prometido descumprido sem aviso prévio',0,false,true,17),
  ('AF_DATA_EXPOSURE',NULL,NULL,NULL,'Dado do cliente exposto indevidamente a terceiro',0,false,true,18)
) AS c(criterion_key, block, block_label, block_weight, statement, weight, allows_na, is_auto_fail, sort_order);
```

**Step 3: SQL — backfill histórico**

```sql
-- todas as avaliações existentes pertencem ao v1
UPDATE evaluations
SET template_id = (SELECT id FROM evaluation_templates WHERE code = 'support-v1')
WHERE template_id IS NULL;
```

**Step 4: Verificar**
- `SELECT code, is_active, (SELECT count(*) FROM template_criteria tc WHERE tc.template_id=et.id) n FROM evaluation_templates et;` → `support-v1` (20, inactive), `support-v2` (18, active).
- Somas v2: `SELECT block, sum(weight) FROM template_criteria WHERE template_id=(SELECT id FROM evaluation_templates WHERE code='support-v2') AND NOT is_auto_fail GROUP BY block;` → A=100, B=100, C=100.
- `SELECT count(*) FROM evaluations WHERE template_id IS NULL;` → 0.

**Step 5: Commit** `git commit -m "feat(db): seed v1 (retired) + Support v2 (active) templates; backfill history"`

---

### Task 5: Refatorar `src/lib/scoring.js` para ler template (TDD real)

Este é o coração. Funções puras → primeiro caso de TDD de verdade no repo.

**Files:**
- Test: `src/lib/scoring.test.js` (novo)
- Modify: `src/lib/scoring.js`

**Comportamento alvo:**
- `calculateScore(template, answers)` onde `answers[key] = { value: 1|5|null, is_na: bool }`.
- Resposta Yes(5)→100, No(1)→0.
- **N/A renormaliza o bloco:** peso do critério N/A é redistribuído proporcionalmente aos demais do bloco. Se todo o bloco é N/A, o bloco sai e seu peso é redistribuído entre os blocos restantes.
- Critérios `is_auto_fail` **não entram** na matemática; se algum estiver marcado (value≥3), retorna `has_critical_flag=true`. A flag **não zera** o score (spec §3.3).
- Retorna `{ final, blocks: {A: n, B: n, C: n}, has_critical_flag }`.

**Step 1: Escrever os testes que falham** (exemplos — cobrir todos)

```js
import { describe, it, expect } from 'vitest'
import { calculateScore } from './scoring'

const v2 = {
  criteria: [
    { criterion_key:'E1', block:'A', block_weight:45, weight:25, allows_na:false, is_auto_fail:false },
    { criterion_key:'E3', block:'A', block_weight:45, weight:30, allows_na:true,  is_auto_fail:false },
    { criterion_key:'E6', block:'A', block_weight:45, weight:20, allows_na:false, is_auto_fail:false },
    { criterion_key:'E4', block:'A', block_weight:45, weight:15, allows_na:false, is_auto_fail:false },
    { criterion_key:'E7', block:'A', block_weight:45, weight:10, allows_na:true,  is_auto_fail:false },
    { criterion_key:'C8', block:'B', block_weight:30, weight:30, allows_na:true,  is_auto_fail:false },
    { criterion_key:'C1', block:'B', block_weight:30, weight:25, allows_na:false, is_auto_fail:false },
    { criterion_key:'C9', block:'B', block_weight:30, weight:25, allows_na:false, is_auto_fail:false },
    { criterion_key:'C6', block:'B', block_weight:30, weight:10, allows_na:false, is_auto_fail:false },
    { criterion_key:'C2', block:'B', block_weight:30, weight:10, allows_na:false, is_auto_fail:false },
    { criterion_key:'P2', block:'C', block_weight:25, weight:35, allows_na:false, is_auto_fail:false },
    { criterion_key:'P1', block:'C', block_weight:25, weight:25, allows_na:false, is_auto_fail:false },
    { criterion_key:'P4', block:'C', block_weight:25, weight:20, allows_na:false, is_auto_fail:false },
    { criterion_key:'P5', block:'C', block_weight:25, weight:20, allows_na:false, is_auto_fail:false },
    { criterion_key:'AF_IDENTITY', block:null, weight:0, allows_na:false, is_auto_fail:true },
  ],
}
const yes = k => ({ [k]: { value:5, is_na:false } })
const allYes = Object.assign({}, ...v2.criteria.filter(c=>!c.is_auto_fail).map(c=>yes(c.criterion_key)))

describe('calculateScore', () => {
  it('all Yes → 100, no flag', () => {
    const r = calculateScore(v2, allYes)
    expect(r.final).toBe(100)
    expect(r.has_critical_flag).toBe(false)
  })

  it('auto-fail marcado NÃO zera o score, só levanta a flag', () => {
    const r = calculateScore(v2, { ...allYes, AF_IDENTITY: { value:5, is_na:false } })
    expect(r.final).toBe(100)          // spec §3.3: flag ≠ zero
    expect(r.has_critical_flag).toBe(true)
  })

  it('um No em P2 (35% do bloco C, C vale 25%) → final 91.25', () => {
    const r = calculateScore(v2, { ...allYes, P2: { value:1, is_na:false } })
    // Bloco C: 100 - 35 = 65. Final: 45*1 + 30*1 + 25*0.65 = 91.25
    expect(r.final).toBeCloseTo(91.25, 2)
  })

  it('N/A em E7 renormaliza o bloco A (E7 sai, pesos sobem)', () => {
    const answers = { ...allYes, E7: { value:null, is_na:true } }
    const r = calculateScore(v2, answers)
    expect(r.final).toBe(100) // todos Yes menos o N/A → bloco A ainda 100
    // com um No em E1 e E7 N/A, E1 pesa 25/90 do bloco A:
    const r2 = calculateScore(v2, { ...answers, E1: { value:1, is_na:false } })
    expect(r2.blocks.A).toBeCloseTo(100 * (1 - 25/90), 2)
  })
})
```

**Step 2:** `npm run test:unit -- scoring` → FAIL (`calculateScore is not a function`).

**Step 3: Implementar** — adicionar ao `scoring.js` (manter `FRAMEWORK`/`getStatusDisplay` por ora; marcar `FRAMEWORK` como `@deprecated`):

```js
export function calculateScore(template, answers) {
  const scored = template.criteria.filter(c => !c.is_auto_fail)
  const blocks = {}
  for (const c of scored) {
    (blocks[c.block] ??= { weight: Number(c.block_weight), items: [] }).items.push(c)
  }
  const blockScores = {}
  const activeBlockWeights = {}
  for (const [key, b] of Object.entries(blocks)) {
    const answered = b.items.filter(c => !(answers[c.criterion_key]?.is_na))
    const wsum = answered.reduce((s, c) => s + Number(c.weight), 0)
    if (wsum === 0) continue // bloco inteiro N/A → sai
    const score = answered.reduce((s, c) => {
      const v = answers[c.criterion_key]?.value
      const pct = v === 5 ? 100 : 0
      return s + pct * (Number(c.weight) / wsum)
    }, 0)
    blockScores[key] = Math.round(score * 100) / 100
    activeBlockWeights[key] = b.weight
  }
  const totalBW = Object.values(activeBlockWeights).reduce((s, w) => s + w, 0)
  const final = Object.entries(blockScores).reduce(
    (s, [k, v]) => s + v * (activeBlockWeights[k] / totalBW), 0)
  const has_critical_flag = template.criteria.some(
    c => c.is_auto_fail && (answers[c.criterion_key]?.value ?? 0) >= 3)
  return { final: Math.round(final * 100) / 100, blocks: blockScores, has_critical_flag }
}
```

**Step 4:** `npm run test:unit -- scoring` → PASS (todos).

**Step 5: Commit** `git commit -m "feat(scoring): template-driven score with N/A renormalization + auto-fail as flag"`

---

### Task 6: Hook `useActiveTemplate`

**Files:**
- Create: `src/hooks/useActiveTemplate.jsx`

Carrega o template ativo (por `area`/`code`) + `template_criteria` ordenados por `sort_order`. Retorna `{ template, loading, error }` no formato que `calculateScore` espera. Assinatura: `useActiveTemplate({ code = 'support-v2' })`. Query: `evaluation_templates` (is_active) join `template_criteria`.

**Verificação:** teste de render simples (Testing Library) mockando `supabase` — ou smoke manual. Commit.

---

### Task 7: Refatorar `src/pages/NewAudit.jsx` — form dirigido por template

**Files:**
- Modify: `src/pages/NewAudit.jsx`

**Mudanças:**
1. Trocar `import { FRAMEWORK }` por `useActiveTemplate`; renderizar blocos/critérios do template (não mais 3 seções fixas).
2. `ChecklistItem` vira **três estados**: Yes / No / N/A — o N/A só aparece quando `criterion.allows_na`.
3. Seção "Auto-Fail" deixa de ser um toggle único: renderizar os `is_auto_fail` como lista de checkboxes de **violação** (marcar = flag). Não zera mais o score na UI; mostra badge "⚠ Flag crítica" separado da nota.
4. `calculateScore(template, answers)` no `useEffect` (substitui `calculateScore()` local que lê `FRAMEWORK`).
5. No submit: gravar `template_id`, `area` (novo `<select>` MDM/TEM), `block_scores` (jsonb do resultado), `has_critical_flag`; itens com `{criterion_key, value, is_na}`.
6. **Não** derivar `status` de qualidade aqui (respeitar o smell já registrado: `status` é workflow; a qualidade sai de `final_score`). Ver [[status-column-overloaded]].

**Verificação:** `npm run build` sem erro + smoke manual (criar avaliação v2 com um N/A e uma flag; conferir `block_scores` e `has_critical_flag` no banco). Commit.

---

### Task 8: `src/pages/EvaluationDetail.jsx` — leitura pelo template

**Files:**
- Modify: `src/pages/EvaluationDetail.jsx`

Buscar os enunciados/pesos via `template_id` da avaliação (não `FRAMEWORK`), para que avaliações v1 mostrem os rótulos v1 e v2 os v2. Exibir N/A e as flags críticas. `npm run build` + smoke em uma avaliação v1 antiga e uma v2 nova. Commit.

---

### Task 9: Painel lateral de SLAs (stub, mês 1 manual)

**Files:**
- Modify: `src/pages/EvaluationDetail.jsx` (ou componente novo `src/components/SlaSidePanel.jsx`)

Painel **não ponderado** (spec §3.1/§4): SLA 1º contato, SLA solução, taxa de reabertura 15d, taxa de escalonamento. Mês 1: campos manuais/placeholder; a importação Tiflux é Wave 60d (Task da Phase 2). Commit.

---

## Phase 2 — Waves 60/90 dias (esboço, NÃO codar no launch)

Escopo definido, código deliberadamente adiado (YAGNI; várias regras de produto ainda abertas):

- **Ciência obrigatória + escalonamento (backlog #6):** usar `acknowledged_at`/`analyst_acknowledged` já existentes; job/edge function que sinaliza avaliação sem ciência após 5 dias úteis. Meta: taxa de ciência > 80%.
- **Import Tiflux (backlog #5):** SLAs + maior intervalo entre interações por thread → alimenta C8 e o painel lateral. **Depende da definição da regra das 36h** (pendência #1).
- **Modo calibração (backlog #7):** mesma thread atribuída cega a 2+ avaliadores; relatório de divergência por critério. Requer nullable/duplicação controlada em `evaluations` ou tabela `calibration_sessions`.
- **Alerta de cobertura (backlog #8):** analista sem avaliação em 30 dias entra em fila pendente.
- **Template Onboarding (90d):** novo `evaluation_templates` sob a mesma estrutura — prova de que a fundação versionada funciona.

---

## Comunicação (não-código, mas trava de rollout — spec §9)

A média **vai cair** (de ~90 para 75–82; "100 perfeitos" de 54% → ~15%). A frase *"isto é o instrumento começando a funcionar, não a equipe piorando"* precisa estar no **relatório de agosto**, antes do número aparecer no de setembro. Registrar isso como item de checklist do launch (responsável: Nicolas).

---

## Estratégia de verificação (adaptada a esta stack)

- **DB:** cada migration é seguida de um `execute_sql` de asserção (contagens, somas de peso, CHECK). Nada de "aplicou e seguiu".
- **Score:** `scoring.test.js` (Vitest) cobre all-Yes, No único, N/A com renormalização, bloco inteiro N/A e auto-fail-não-zera.
- **UI:** `npm run build` verde + smoke manual por caminho (criar v2, ver v1 antigo, ver v2 novo).
- **Regressão histórica:** conferir que uma avaliação v1 antiga continua exibindo a mesma `final_score` gravada (não recalculamos histórico).

## Rollback

Migrations 14–17 são aditivas (novas tabelas/colunas nullable + seed). Rollback = `DROP TABLE template_criteria, evaluation_templates CASCADE;` + `ALTER TABLE evaluations DROP COLUMN template_id, area, has_critical_flag, block_scores;` + `ALTER TABLE evaluation_items DROP COLUMN is_na;` (e restaurar o CHECK `value BETWEEN 1 AND 5 NOT NULL`). Nenhum dado histórico é destruído.

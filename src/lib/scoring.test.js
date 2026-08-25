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

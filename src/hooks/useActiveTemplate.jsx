import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Loads the active evaluation template (and its criteria) from Supabase and
 * returns it in the exact shape `calculateScore(template, answers)` expects
 * (see `src/lib/scoring.js`).
 *
 * @param {{ code?: string }} [options]
 * @param {string} [options.code='support-v2'] - template family/code to load
 * @returns {{
 *   template: null | {
 *     id: string,
 *     code: string,
 *     name: string,
 *     version: number,
 *     criteria: Array<{
 *       criterion_key: string,
 *       block: string|null,
 *       block_label: string|null,
 *       block_weight: number,
 *       statement: string,
 *       weight: number,
 *       allows_na: boolean,
 *       is_auto_fail: boolean,
 *       sort_order: number
 *     }>
 *   },
 *   loading: boolean,
 *   error: string|null
 * }}
 */
export function useActiveTemplate({ code = 'support-v2' } = {}) {
    const [template, setTemplate] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false

        async function fetchTemplate() {
            try {
                setLoading(true)
                setError(null)

                // Single nested select: pull the active template of this family
                // together with its criteria, ordered by sort_order ascending.
                const { data, error: fetchError } = await supabase
                    .from('evaluation_templates')
                    .select(`
                        id,
                        code,
                        name,
                        version,
                        template_criteria (
                            criterion_key,
                            block,
                            block_label,
                            block_weight,
                            statement,
                            weight,
                            allows_na,
                            is_auto_fail,
                            sort_order
                        )
                    `)
                    .eq('is_active', true)
                    .eq('code', code)
                    .order('sort_order', { referencedTable: 'template_criteria', ascending: true })
                    .maybeSingle()

                if (fetchError) throw fetchError

                if (cancelled) return

                if (!data) {
                    setTemplate(null)
                    setError(`No active evaluation template found for code "${code}".`)
                    return
                }

                const criteria = (data.template_criteria || []).map((c) => ({
                    criterion_key: c.criterion_key,
                    block: c.block,
                    block_label: c.block_label,
                    block_weight: c.block_weight === null ? null : Number(c.block_weight),
                    statement: c.statement,
                    weight: Number(c.weight),
                    allows_na: c.allows_na,
                    is_auto_fail: c.is_auto_fail,
                    sort_order: c.sort_order,
                }))

                setTemplate({
                    id: data.id,
                    code: data.code,
                    name: data.name,
                    version: data.version,
                    criteria,
                })
            } catch (err) {
                if (cancelled) return
                console.error('[useActiveTemplate] Fetch failed:', err.message)
                setTemplate(null)
                setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchTemplate()

        return () => {
            cancelled = true
        }
    }, [code])

    return { template, loading, error }
}

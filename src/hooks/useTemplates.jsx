import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Loads the list of evaluation templates (metadata only, no criteria) from
 * Supabase, ordered active/newest first (is_active DESC, then version DESC).
 *
 * Used by the "new evaluation" form to let the evaluator choose which template
 * a new evaluation uses. The full criteria of the selected template are fetched
 * separately by id (see NewAudit's TEMPLATE_SELECT + normalizeCriteria).
 *
 * @returns {{
 *   templates: Array<{
 *     id: string,
 *     code: string,
 *     name: string,
 *     version: number,
 *     is_active: boolean
 *   }>,
 *   loading: boolean,
 *   error: string|null
 * }}
 */
export function useTemplates() {
    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false

        async function fetchTemplates() {
            try {
                setLoading(true)
                setError(null)

                const { data, error: fetchError } = await supabase
                    .from('evaluation_templates')
                    .select('id, code, name, version, is_active')
                    .order('is_active', { ascending: false })
                    .order('version', { ascending: false })

                if (fetchError) throw fetchError

                if (cancelled) return

                setTemplates(
                    (data || []).map((t) => ({
                        id: t.id,
                        code: t.code,
                        name: t.name,
                        version: t.version,
                        is_active: t.is_active,
                    }))
                )
            } catch (err) {
                if (cancelled) return
                console.error('[useTemplates] Fetch failed:', err.message)
                setTemplates([])
                setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchTemplates()

        return () => {
            cancelled = true
        }
    }, [])

    return { templates, loading, error }
}

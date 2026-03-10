import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8')
const getEnv = (n) => env.match(new RegExp(`^#?\\s*${n}=(.*)$`, 'm'))?.[1]?.trim()

const sb = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY'))

// Busca as avaliações inseridas hoje, com join no nome do analista
const { data, error } = await sb
  .from('evaluations')
  .select('ticket_id, final_score, status, created_at, analyst:analyst_id(name), score_communication, score_efficiency, score_process')
  .order('created_at', { ascending: false })
  .limit(15)

if (error) { console.error(error); process.exit(1) }

console.log(`\n✅ ${data.length} avaliações encontradas no banco:\n`)
console.log('Ticket    | Analista                        | Score  | Status    | Data')
console.log(''.padEnd(90, '-'))
data.forEach(e => {
  const ticket = `#${e.ticket_id}`.padEnd(10)
  const name = (e.analyst?.name || 'N/A').substring(0, 30).padEnd(32)
  const score = `${e.final_score?.toFixed(1)}%`.padEnd(8)
  const status = (e.status || '').padEnd(10)
  const date = e.created_at?.substring(0, 10)
  console.log(`${ticket}| ${name}| ${score}| ${status}| ${date}`)
})

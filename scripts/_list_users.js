import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8')
const getEnv = (n) => env.match(new RegExp(`^#?\\s*${n}=(.*)$`, 'm'))?.[1]?.trim()

const sb = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY'))
const { data, error } = await sb.from('users').select('id,email,name,role').order('role')
if (error) { console.error(error); process.exit(1) }
console.log(JSON.stringify(data, null, 2))

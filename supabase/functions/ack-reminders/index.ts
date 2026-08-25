// ack-reminders — Wave #6: cobra ciência das avaliações pendentes.
//
// Regra (definida por Nicolas):
//  - Só avaliações criadas a partir de 2026-09-01 (created_at).
//  - Dispara quando passam >= 5 dias ÚTEIS (exclui fds) desde a data da avaliação
//    e ela segue sem ciência (analyst_acknowledged = false, status = 'pending').
//  - Depois, repete a cada >= 2 dias úteis sem resposta (controle: last_ack_reminder_at).
//  - E-mail para: analista (reenvio) + avaliador + nicolas.andrade@enghouse.com.
//  - Só cobra, não bloqueia.
//
// Invocada diariamente por pg_cron (via pg_net). Idempotente dentro da janela de 2
// dias úteis: reinvocar no mesmo dia não reenvia.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const START_DATE = '2026-09-01'            // só avaliações de setembro em diante
const FIRST_REMINDER_BUSINESS_DAYS = 5     // 1º lembrete após 5 dias úteis
const REPEAT_BUSINESS_DAYS = 2             // depois, a cada 2 dias úteis
const ESCALATION_EMAIL = 'nicolas.andrade@enghouse.com'
const FROM_EMAIL = 'navita.automation@enghouse.com'

// Conta dias úteis (seg–sex) em (start, end], comparando por data UTC.
function businessDaysBetween(start: Date, end: Date): number {
  const a = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  const b = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  let count = 0
  const cur = new Date(a)
  while (cur < b) {
    cur.setUTCDate(cur.getUTCDate() + 1)
    const dow = cur.getUTCDay() // 0=dom, 6=sáb
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

async function sendReminder(apiKey: string, frontendUrl: string, ev: any): Promise<boolean> {
  const recipients = Array.from(new Set([
    ev.analyst?.email,
    ev.evaluator?.email,
    ESCALATION_EMAIL,
  ].filter(Boolean)))

  const link = `${frontendUrl}/avaliacao/${ev.id}`
  const createdBr = new Date(ev.created_at).toLocaleDateString('pt-BR')
  const html = `
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f5f7fa;margin:0;padding:24px;color:#1e293b">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#0066FF,#00D4AA);padding:28px 32px">
      <h1 style="color:#fff;margin:0;font-size:22px">Avaliação aguardando ciência</h1>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:16px;margin:0 0 16px">Olá, <strong>${ev.analyst?.name || 'Analista'}</strong>.</p>
      <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 20px">
        A avaliação do ticket <strong>#${ev.ticket_id}</strong>, de <strong>${createdBr}</strong>,
        ainda está <strong>sem ciência</strong>. Por favor, acesse para revisar e confirmar (ou contestar).
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:linear-gradient(135deg,#0066FF,#0052CC);color:#fff;padding:14px 34px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">Dar ciência agora →</a>
      </div>
      <p style="font-size:13px;color:#94a3b8;margin:20px 0 0">Este é um lembrete automático do Screener. O avaliador e a coordenação estão em cópia.</p>
    </div>
  </div>
</body></html>`

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: recipients.map((email) => ({ email })) }],
      from: { email: FROM_EMAIL, name: 'Screener - Qualidade Navita' },
      subject: `⏰ Ciência pendente - Ticket #${ev.ticket_id}`,
      content: [{ type: 'text/html', value: html }],
    }),
  })
  if (!res.ok) {
    console.error('[ack-reminders] SendGrid error:', await res.text())
    return false
  }
  return true
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok')

  try {
    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')
    const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://screener-2-0.vercel.app'
    if (!SENDGRID_API_KEY) {
      return new Response(JSON.stringify({ error: 'SendGrid API key not configured' }), { status: 500 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: pend, error } = await supabase
      .from('evaluations')
      .select(`id, ticket_id, created_at, last_ack_reminder_at,
               analyst:users!analyst_id(name, email),
               evaluator:users!evaluator_id(name, email)`)
      .eq('analyst_acknowledged', false)
      .eq('status', 'pending')
      .gte('created_at', START_DATE)

    if (error) throw error

    const now = new Date()
    let reminded = 0
    const errors: string[] = []

    for (const ev of pend ?? []) {
      const sinceCreated = businessDaysBetween(new Date(ev.created_at), now)
      if (sinceCreated < FIRST_REMINDER_BUSINESS_DAYS) continue

      if (ev.last_ack_reminder_at) {
        const sinceLast = businessDaysBetween(new Date(ev.last_ack_reminder_at), now)
        if (sinceLast < REPEAT_BUSINESS_DAYS) continue
      }

      const ok = await sendReminder(SENDGRID_API_KEY, FRONTEND_URL, ev)
      if (ok) {
        const { error: upErr } = await supabase
          .from('evaluations')
          .update({ last_ack_reminder_at: now.toISOString() })
          .eq('id', ev.id)
        if (upErr) errors.push(`${ev.id}: ${upErr.message}`)
        else reminded++
      } else {
        errors.push(`${ev.id}: sendgrid failed`)
      }
    }

    return new Response(
      JSON.stringify({ checked: pend?.length ?? 0, reminded, errors }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[ack-reminders] Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

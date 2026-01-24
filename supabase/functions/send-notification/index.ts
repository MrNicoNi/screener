import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { evaluationId, analystEmail, analystName, ticketId, finalScore, feedback } = await req.json()
        const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')

        if (!SENDGRID_API_KEY) {
            console.error('[send-notification] SendGrid API key not configured')
            return new Response(
                JSON.stringify({ error: 'SendGrid API key not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!analystEmail) {
            return new Response(
                JSON.stringify({ error: 'Analyst email is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Build email HTML
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0066FF, #00D4AA); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .score-box { text-align: center; padding: 20px; background: #f8fafc; border-radius: 8px; margin: 20px 0; }
        .score { font-size: 48px; font-weight: bold; color: ${finalScore >= 90 ? '#00D4AA' : finalScore >= 75 ? '#0066FF' : '#EF4444'}; }
        .ticket { background: #e0f2fe; padding: 10px 15px; border-radius: 6px; display: inline-block; font-weight: bold; color: #0066FF; }
        .feedback { background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #0066FF; margin: 20px 0; }
        .cta { text-align: center; margin: 30px 0; }
        .button { background: #0066FF; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Nova Avaliação de Qualidade</h1>
        </div>
        <div class="content">
            <p>Olá, <strong>${analystName || 'Analista'}</strong>!</p>
            <p>Uma nova avaliação foi realizada para o seu atendimento:</p>
            
            <p><span class="ticket">#${ticketId || 'N/A'}</span></p>
            
            <div class="score-box">
                <p style="margin: 0 0 10px 0; color: #64748b;">Score Final</p>
                <div class="score">${finalScore || 0}%</div>
            </div>
            
            ${feedback ? `
            <div class="feedback">
                <strong>Feedback do Avaliador:</strong>
                <p style="margin: 10px 0 0 0;">${feedback}</p>
            </div>
            ` : ''}
            
            <div class="cta">
                <a href="${Deno.env.get('FRONTEND_URL') || 'https://screener.vercel.app'}/avaliacao/${evaluationId}" class="button">
                    Ver Avaliação Completa
                </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">
                Por favor, acesse o sistema para visualizar os detalhes da avaliação e confirmar ciência.
            </p>
        </div>
        <div class="footer">
            <p>Este é um email automático do sistema Screener.</p>
            <p>© ${new Date().getFullYear()} Navita - Enghouse Systems</p>
        </div>
    </div>
</body>
</html>
        `

        // Send email via SendGrid API
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SENDGRID_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: analystEmail }] }],
                from: {
                    email: 'navita.automation@enghouse.com',
                    name: 'Screener - Qualidade Navita'
                },
                subject: `📋 Nova Avaliação - Ticket #${ticketId || 'N/A'} - Score: ${finalScore}%`,
                content: [{ type: 'text/html', value: emailHtml }]
            })
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('[send-notification] SendGrid error:', error)
            return new Response(
                JSON.stringify({ error: `SendGrid error: ${error}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('[send-notification] Email sent to:', analystEmail)

        return new Response(
            JSON.stringify({ success: true, message: 'Email sent successfully' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[send-notification] Error:', error)
        return new Response(
            JSON.stringify({ error: String(error) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

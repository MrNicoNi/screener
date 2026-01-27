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
        const { userEmail, userName, userPassword, userRole } = await req.json()
        const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')
        const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://screener.vercel.app'

        if (!SENDGRID_API_KEY) {
            console.error('[send-welcome-email] SendGrid API key not configured')
            return new Response(
                JSON.stringify({ error: 'SendGrid API key not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!userEmail || !userName || !userPassword) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: userEmail, userName, userPassword' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Translate role to Portuguese
        const roleTranslations = {
            'admin': 'Administrador',
            'evaluator': 'Avaliador',
            'analyst': 'Analista'
        }
        const roleDisplay = roleTranslations[userRole] || userRole

        // Build email HTML
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0066FF, #00D4AA); padding: 40px 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; }
        .content { padding: 40px 30px; }
        .welcome-box { background: #f8fafc; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #0066FF; }
        .credentials { background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 25px 0; }
        .credentials h3 { margin: 0 0 15px 0; color: #0066FF; font-size: 16px; }
        .credential-item { margin: 12px 0; }
        .credential-label { font-weight: bold; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
        .credential-value { font-size: 16px; color: #0f172a; font-family: 'Courier New', monospace; background: white; padding: 8px 12px; border-radius: 4px; margin-top: 4px; display: inline-block; }
        .role-badge { display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: bold; margin-top: 10px; }
        .role-admin { background: #ddd6fe; color: #7c3aed; }
        .role-evaluator { background: #dbeafe; color: #2563eb; }
        .role-analyst { background: #d1fae5; color: #059669; }
        .cta { text-align: center; margin: 30px 0; }
        .button { background: #0066FF; color: white; padding: 14px 35px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px; }
        .instructions { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b; }
        .instructions h3 { margin: 0 0 12px 0; color: #92400e; font-size: 16px; }
        .instructions ol { margin: 10px 0; padding-left: 20px; color: #78350f; }
        .instructions li { margin: 8px 0; }
        .footer { text-align: center; padding: 25px; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }
        .footer a { color: #0066FF; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Bem-vindo ao Screener!</h1>
            <p>Sistema de Avaliação de Qualidade - Navita</p>
        </div>
        <div class="content">
            <div class="welcome-box">
                <p style="margin: 0; font-size: 16px; color: #475569;">
                    Olá, <strong>${userName}</strong>!
                </p>
                <p style="margin: 15px 0 0 0; color: #64748b; line-height: 1.6;">
                    Sua conta foi criada com sucesso no sistema Screener. Você foi cadastrado como:
                </p>
                <span class="role-badge role-${userRole}">${roleDisplay}</span>
            </div>

            <div class="credentials">
                <h3>🔐 Suas Credenciais de Acesso</h3>
                <div class="credential-item">
                    <div class="credential-label">Email</div>
                    <div class="credential-value">${userEmail}</div>
                </div>
                <div class="credential-item">
                    <div class="credential-label">Senha Temporária</div>
                    <div class="credential-value">${userPassword}</div>
                </div>
            </div>

            <div class="instructions">
                <h3>⚠️ Importante - Primeiro Acesso</h3>
                <ol>
                    <li>Acesse o sistema usando o botão abaixo</li>
                    <li>Faça login com as credenciais fornecidas</li>
                    <li><strong>Altere sua senha</strong> no primeiro acesso (em breve)</li>
                    <li>Guarde este email em local seguro</li>
                </ol>
            </div>

            <div class="cta">
                <a href="${FRONTEND_URL}/login" class="button">
                    Acessar o Sistema
                </a>
            </div>

            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                Se você tiver qualquer dúvida ou problema para acessar, entre em contato com o administrador do sistema.
            </p>
        </div>
        <div class="footer">
            <p>Este é um email automático do sistema Screener.</p>
            <p>© ${new Date().getFullYear()} Navita - Enghouse Systems</p>
            <p style="margin-top: 15px;">
                <a href="${FRONTEND_URL}">screener.vercel.app</a>
            </p>
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
                personalizations: [{ to: [{ email: userEmail }] }],
                from: {
                    email: 'navita.automation@enghouse.com',
                    name: 'Screener - Qualidade Navita'
                },
                subject: `🎉 Bem-vindo ao Screener - Suas Credenciais de Acesso`,
                content: [{ type: 'text/html', value: emailHtml }]
            })
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('[send-welcome-email] SendGrid error:', error)
            return new Response(
                JSON.stringify({ error: `SendGrid error: ${error}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('[send-welcome-email] Welcome email sent to:', userEmail)

        return new Response(
            JSON.stringify({ success: true, message: 'Welcome email sent successfully' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[send-welcome-email] Error:', error)
        return new Response(
            JSON.stringify({ error: String(error) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

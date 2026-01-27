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
        const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://screener-2-0.vercel.app'

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

        // Build email HTML with improved design
        const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Bem-vindo ao Screener</title>
    <!--[if mso]>
    <style type="text/css">
        body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
    </style>
    <![endif]-->
    <style>
        /* Reset */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        
        /* Base Styles */
        body { 
            margin: 0; 
            padding: 0; 
            width: 100% !important; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f7fa;
            color: #1e293b;
        }
        
        /* Container */
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff;
        }
        
        /* Header */
        .header { 
            background: linear-gradient(135deg, #0066FF 0%, #00D4AA 100%);
            padding: 48px 32px;
            text-align: center;
        }
        .header h1 { 
            color: #ffffff; 
            margin: 0 0 8px 0; 
            font-size: 32px; 
            font-weight: 700;
            line-height: 1.2;
        }
        .header p { 
            color: rgba(255,255,255,0.95); 
            margin: 0; 
            font-size: 16px;
            font-weight: 400;
        }
        
        /* Content */
        .content { 
            padding: 40px 32px;
        }
        
        /* Welcome Box */
        .welcome-box { 
            background: linear-gradient(to right, #f8fafc, #f1f5f9);
            padding: 28px; 
            border-radius: 12px; 
            margin: 0 0 32px 0;
            border-left: 4px solid #0066FF;
        }
        .welcome-box p { 
            margin: 0 0 12px 0; 
            font-size: 17px; 
            color: #334155;
            line-height: 1.6;
        }
        .welcome-box p:last-child { margin-bottom: 0; }
        
        /* Role Badge */
        .role-badge { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 8px; 
            font-size: 14px; 
            font-weight: 600;
            margin-top: 12px;
            letter-spacing: 0.3px;
        }
        .role-admin { background: #ede9fe; color: #7c3aed; }
        .role-evaluator { background: #dbeafe; color: #2563eb; }
        .role-analyst { background: #d1fae5; color: #059669; }
        
        /* Credentials Box */
        .credentials { 
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            padding: 28px; 
            border-radius: 12px; 
            margin: 0 0 32px 0;
            border: 2px solid #bfdbfe;
        }
        .credentials h3 { 
            margin: 0 0 20px 0; 
            color: #1e40af; 
            font-size: 18px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .credential-item { 
            margin: 0 0 16px 0;
        }
        .credential-item:last-child { margin-bottom: 0; }
        .credential-label { 
            font-weight: 600; 
            color: #475569; 
            font-size: 12px; 
            text-transform: uppercase; 
            letter-spacing: 0.8px;
            margin-bottom: 6px;
        }
        .credential-value { 
            font-size: 18px; 
            color: #0f172a; 
            font-family: 'Courier New', Consolas, monospace;
            background: #ffffff; 
            padding: 12px 16px; 
            border-radius: 8px;
            display: block;
            border: 1px solid #cbd5e1;
            font-weight: 600;
            word-break: break-all;
        }
        
        /* Instructions Box */
        .instructions { 
            background: linear-gradient(to right, #fffbeb, #fef3c7);
            padding: 24px; 
            border-radius: 12px; 
            margin: 0 0 32px 0;
            border-left: 4px solid #f59e0b;
        }
        .instructions h3 { 
            margin: 0 0 16px 0; 
            color: #92400e; 
            font-size: 16px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .instructions ol { 
            margin: 0; 
            padding-left: 20px; 
            color: #78350f;
        }
        .instructions li { 
            margin: 10px 0;
            line-height: 1.6;
        }
        .instructions strong { color: #92400e; }
        
        /* CTA Button */
        .cta { 
            text-align: center; 
            margin: 36px 0;
        }
        .button { 
            background: linear-gradient(135deg, #0066FF 0%, #0052CC 100%);
            color: #ffffff; 
            padding: 16px 40px; 
            border-radius: 10px; 
            text-decoration: none; 
            font-weight: 700;
            display: inline-block; 
            font-size: 16px;
            box-shadow: 0 4px 12px rgba(0, 102, 255, 0.3);
            transition: all 0.3s ease;
        }
        .button:hover { 
            background: linear-gradient(135deg, #0052CC 0%, #0066FF 100%);
            box-shadow: 0 6px 16px rgba(0, 102, 255, 0.4);
        }
        
        /* Help Text */
        .help-text { 
            color: #64748b; 
            font-size: 15px; 
            line-height: 1.7;
            margin: 24px 0 0 0;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
        }
        
        /* Footer */
        .footer { 
            text-align: center; 
            padding: 32px 24px;
            color: #94a3b8; 
            font-size: 13px;
            border-top: 1px solid #e2e8f0;
            background: #f8fafc;
        }
        .footer p { margin: 8px 0; }
        .footer a { 
            color: #0066FF; 
            text-decoration: none;
            font-weight: 600;
        }
        .footer a:hover { text-decoration: underline; }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
            .header { padding: 36px 24px !important; }
            .header h1 { font-size: 26px !important; }
            .content { padding: 32px 24px !important; }
            .welcome-box, .credentials, .instructions { padding: 20px !important; }
            .button { padding: 14px 32px !important; font-size: 15px !important; }
            .credential-value { font-size: 16px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 20px 0; background: #f5f7fa;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
            <td align="center">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width: 600px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                    
                    <!-- Header -->
                    <tr>
                        <td class="header" style="background: linear-gradient(135deg, #0066FF 0%, #00D4AA 100%); padding: 48px 32px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 32px; font-weight: 700;">🎉 Bem-vindo ao Screener!</h1>
                            <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 16px;">Sistema de Avaliação de Qualidade - Navita</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td class="content" style="padding: 40px 32px;">
                            
                            <!-- Welcome Box -->
                            <div class="welcome-box">
                                <p style="margin: 0 0 12px 0; font-size: 17px;">
                                    Olá, <strong>${userName}</strong>! 👋
                                </p>
                                <p style="margin: 0 0 12px 0; color: #64748b;">
                                    Sua conta foi criada com sucesso no sistema Screener. Você foi cadastrado como:
                                </p>
                                <span class="role-badge role-${userRole}">${roleDisplay}</span>
                            </div>
                            
                            <!-- Credentials -->
                            <div class="credentials">
                                <h3><span>🔐</span> Suas Credenciais de Acesso</h3>
                                <div class="credential-item">
                                    <div class="credential-label">Email</div>
                                    <div class="credential-value">${userEmail}</div>
                                </div>
                                <div class="credential-item">
                                    <div class="credential-label">Senha Temporária</div>
                                    <div class="credential-value">${userPassword}</div>
                                </div>
                            </div>
                            
                            <!-- Instructions -->
                            <div class="instructions">
                                <h3><span>⚠️</span> Importante - Primeiro Acesso</h3>
                                <ol>
                                    <li>Acesse o sistema usando o botão abaixo</li>
                                    <li>Faça login com as credenciais fornecidas</li>
                                    <li><strong>Altere sua senha</strong> imediatamente após o primeiro acesso</li>
                                    <li>Guarde este email em local seguro</li>
                                </ol>
                            </div>
                            
                            <!-- CTA -->
                            <div class="cta">
                                <a href="${FRONTEND_URL}/login" class="button" style="background: linear-gradient(135deg, #0066FF 0%, #0052CC 100%); color: #ffffff; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; display: inline-block;">
                                    Acessar o Sistema →
                                </a>
                            </div>
                            
                            <!-- Help Text -->
                            <div class="help-text">
                                <strong>Precisa de ajuda?</strong><br>
                                Se você tiver qualquer dúvida ou problema para acessar, entre em contato com o administrador do sistema.
                            </div>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td class="footer" style="text-align: center; padding: 32px 24px; background: #f8fafc;">
                            <p style="margin: 8px 0;">Este é um email automático do sistema Screener.</p>
                            <p style="margin: 8px 0;">© ${new Date().getFullYear()} Navita - Enghouse Systems</p>
                            <p style="margin: 16px 0 0 0;">
                                <a href="${FRONTEND_URL}" style="color: #0066FF; text-decoration: none; font-weight: 600;">screener.vercel.app</a>
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
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

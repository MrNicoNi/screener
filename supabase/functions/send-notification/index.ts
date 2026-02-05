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
        console.log('[send-notification] Request received')

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

        // Build email HTML with improved design
        const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Nova Avaliação de Qualidade</title>
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
            padding: 40px 32px;
            text-align: center;
        }
        .header h1 { 
            color: #ffffff; 
            margin: 0; 
            font-size: 28px; 
            font-weight: 700;
            line-height: 1.3;
        }
        
        /* Content */
        .content { 
            padding: 40px 32px;
        }
        
        /* Greeting */
        .greeting { 
            font-size: 17px; 
            color: #334155;
            margin: 0 0 24px 0;
            line-height: 1.6;
        }
        
        /* Ticket Badge */
        .ticket-badge { 
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
            padding: 12px 20px; 
            border-radius: 10px; 
            display: inline-block; 
            font-weight: 700;
            color: #1e40af;
            font-size: 16px;
            margin: 0 0 28px 0;
            border: 2px solid #93c5fd;
        }
        
        /* Score Box */
        .score-box { 
            text-align: center; 
            padding: 32px 24px; 
            background: linear-gradient(to bottom, #f8fafc, #f1f5f9);
            border-radius: 16px; 
            margin: 0 0 28px 0;
            border: 2px solid #e2e8f0;
        }
        .score-label { 
            margin: 0 0 12px 0; 
            color: #64748b;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .score { 
            font-size: 64px; 
            font-weight: 800;
            margin: 0;
            line-height: 1;
            background: linear-gradient(135deg, ${finalScore >= 90 ? '#10b981, #059669' : finalScore >= 75 ? '#0066FF, #0052CC' : '#ef4444, #dc2626'});
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .score-text { 
            color: ${finalScore >= 90 ? '#059669' : finalScore >= 75 ? '#0066FF' : '#dc2626'};
            font-size: 64px;
            font-weight: 800;
            margin: 0;
        }
        .score-status {
            margin: 12px 0 0 0;
            font-size: 15px;
            font-weight: 600;
            color: ${finalScore >= 90 ? '#059669' : finalScore >= 75 ? '#0066FF' : '#dc2626'};
        }
        
        /* Feedback Box */
        .feedback-box { 
            background: linear-gradient(to right, #fffbeb, #fef3c7);
            padding: 24px; 
            border-radius: 12px; 
            border-left: 4px solid #f59e0b;
            margin: 0 0 32px 0;
        }
        .feedback-box h3 { 
            margin: 0 0 12px 0; 
            color: #92400e;
            font-size: 16px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .feedback-box p { 
            margin: 0;
            color: #78350f;
            line-height: 1.7;
            font-size: 15px;
        }
        
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
        }
        .button:hover { 
            background: linear-gradient(135deg, #0052CC 0%, #0066FF 100%);
            box-shadow: 0 6px 16px rgba(0, 102, 255, 0.4);
        }
        
        /* Info Box */
        .info-box { 
            color: #64748b; 
            font-size: 15px;
            line-height: 1.7;
            margin: 24px 0 0 0;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
            border-left: 3px solid #cbd5e1;
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
            .header { padding: 32px 24px !important; }
            .header h1 { font-size: 24px !important; }
            .content { padding: 32px 24px !important; }
            .score { font-size: 52px !important; }
            .score-text { font-size: 52px !important; }
            .button { padding: 14px 32px !important; font-size: 15px !important; }
            .feedback-box, .info-box { padding: 16px !important; }
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
                        <td class="header" style="background: linear-gradient(135deg, #0066FF 0%, #00D4AA 100%); padding: 40px 32px; text-align: center;">
                            <img src="${Deno.env.get('FRONTEND_URL') || 'https://screener-2-0.vercel.app'}/logo-enghouse.jpg" alt="Enghouse" style="max-width: 160px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto; border-radius: 12px;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Nova Avaliação de Qualidade</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td class="content" style="padding: 40px 32px;">
                            
                            <!-- Greeting -->
                            <p class="greeting">
                                Olá, <strong>${analystName || 'Analista'}</strong>!
                            </p>
                            <p class="greeting" style="margin-top: 0;">
                                Uma nova avaliação foi realizada para o seu atendimento:
                            </p>
                            
                            <!-- Ticket Badge -->
                            <div style="margin-bottom: 28px;">
                                <span class="ticket-badge">#${ticketId || 'N/A'}</span>
                            </div>
                            
                            <!-- Score Box -->
                            <div class="score-box">
                                <p class="score-label">Score Final</p>
                                <div class="score-text">${finalScore || 0}%</div>
                                <p class="score-status">
                                    ${finalScore >= 90 ? 'Excelente' : finalScore >= 75 ? 'Aprovado' : 'Atenção Necessária'}
                                </p>
                            </div>
                            
                            ${feedback ? `
                            <!-- Feedback -->
                            <div class="feedback-box">
                                <h3>Feedback do Avaliador</h3>
                                <p>${feedback}</p>
                            </div>
                            ` : ''}
                            
                            <!-- CTA -->
                            <div class="cta">
                                <a href="${Deno.env.get('FRONTEND_URL') || 'https://screener-2-0.vercel.app'}/avaliacao/${evaluationId}" class="button" style="background: linear-gradient(135deg, #0066FF 0%, #0052CC 100%); color: #ffffff; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; display: inline-block;">
                                    Ver Avaliação Completa →
                                </a>
                            </div>
                            
                            <!-- Info Box -->
                            <div class="info-box">
                                <strong>Próximos Passos:</strong><br>
                                Acesse o sistema para visualizar os detalhes completos da avaliação e confirmar ciência.
                            </div>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td class="footer" style="text-align: center; padding: 32px 24px; background: #f8fafc;">
                            <p style="margin: 8px 0;">Este é um email automático do sistema Screener.</p>
                            <p style="margin: 8px 0;">© ${new Date().getFullYear()} Navita - Enghouse Systems</p>
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

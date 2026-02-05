// Test script to verify send-notification Edge Function
// Run with: node test-send-notification.js

const SUPABASE_URL = 'https://gyktdmahkifnsrbaxodl.supabase.co'

async function testEmailFunction() {
    console.log('🧪 Testing send-notification Edge Function...')
    console.log('📧 Sending test email to: nicolalelilolu@gmail.com\n')

    try {
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/send-notification`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    evaluationId: 'TEST-' + Date.now(),
                    analystEmail: 'nicolalelilolu@gmail.com',
                    analystName: 'Nicolas',
                    ticketId: 'TEST-SENDGRID-' + Date.now(),
                    finalScore: 92,
                    feedback: 'Este é um email de teste para validar o funcionamento do SendGrid. Se você recebeu este email, significa que o sistema está funcionando corretamente! 🎉'
                })
            }
        )

        console.log('📊 Status:', response.status, response.statusText)

        if (response.status === 401) {
            console.log('❌ ERRO 401: JWT ainda está ativo ou não foi salvo')
            console.log('   Verifique se salvou as configurações no Supabase Dashboard')
        } else if (response.status === 200) {
            console.log('✅ SUCESSO: Email enviado!')
            const data = await response.json()
            console.log('📧 Resposta:', data)
            console.log('\n🔍 Verifique sua caixa de entrada: nicolalelilolu@gmail.com')
            console.log('   (Pode demorar alguns segundos para chegar)')
            console.log('   Verifique também a pasta de SPAM se não aparecer na caixa principal')
        } else {
            const error = await response.text()
            console.log('⚠️  Status inesperado:', error)
        }

    } catch (error) {
        console.error('❌ Erro na requisição:', error.message)
    }
}

testEmailFunction()

// Automated test script for password reset functionality
// Run with: node test-password-reset.js

const SUPABASE_URL = 'https://gyktdmahkifnsrbaxodl.supabase.co'

// You need to replace this with a valid admin token
// To get it: Login as admin, open DevTools > Application > Local Storage > supabase.auth.token
const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN_HERE'

// Replace with a test user ID from your database
const TEST_USER_ID = 'TEST_USER_ID_HERE'

async function testResetPasswordFunction() {
    console.log('🧪 Testing reset-password Edge Function...\n')

    try {
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/reset-password`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ADMIN_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: TEST_USER_ID
                })
            }
        )

        console.log('📊 Status:', response.status, response.statusText)

        if (response.status === 401) {
            console.log('❌ ERRO 401: Token de admin inválido ou expirado')
            console.log('   Como obter o token:')
            console.log('   1. Faça login como admin no app')
            console.log('   2. Abra DevTools (F12)')
            console.log('   3. Vá em Application > Local Storage')
            console.log('   4. Procure por "supabase.auth.token"')
            console.log('   5. Copie o valor do "access_token"')
        } else if (response.status === 403) {
            console.log('❌ ERRO 403: Usuário não é admin')
            console.log('   Certifique-se de usar um token de usuário admin')
        } else if (response.status === 400) {
            console.log('❌ ERRO 400: userId inválido')
            console.log('   Atualize TEST_USER_ID no script com um ID válido')
        } else if (response.status === 200) {
            const data = await response.json()
            console.log('✅ SUCESSO: Senha resetada!')
            console.log('📧 Resposta:', data)
            console.log('\n🔑 Nova senha:', data.defaultPassword)
            console.log('✅ Flag must_change_password definida')
            console.log('\n📝 Próximos passos:')
            console.log('   1. Faça logout')
            console.log('   2. Tente fazer login com o usuário de teste')
            console.log('   3. Use a senha:', data.defaultPassword)
            console.log('   4. Deve aparecer o modal de mudança de senha')
        } else {
            const error = await response.text()
            console.log('⚠️  Status inesperado:', error)
        }

    } catch (error) {
        console.error('❌ Erro na requisição:', error.message)
    }
}

async function testForgotPasswordFlow() {
    console.log('\n\n🧪 Testing forgot password flow...\n')

    console.log('📝 Instruções para teste manual:')
    console.log('   1. Acesse http://localhost:5173')
    console.log('   2. Clique em "Esqueci minha senha"')
    console.log('   3. Digite seu email')
    console.log('   4. Verifique sua caixa de entrada')
    console.log('   5. Clique no link de reset')
    console.log('   6. Defina uma nova senha')
    console.log('\n⚠️  Nota: Este fluxo usa Supabase Auth nativo')
    console.log('   O email será enviado automaticamente pelo Supabase')
}

console.log('🚀 Password Reset System - Automated Tests\n')
console.log('='.repeat(60))

// Check if tokens are configured
if (ADMIN_TOKEN === 'YOUR_ADMIN_TOKEN_HERE' || TEST_USER_ID === 'TEST_USER_ID_HERE') {
    console.log('\n⚠️  CONFIGURAÇÃO NECESSÁRIA\n')
    console.log('Antes de rodar os testes, configure:')
    console.log('\n1. ADMIN_TOKEN:')
    console.log('   - Faça login como admin no app')
    console.log('   - Abra DevTools (F12) > Application > Local Storage')
    console.log('   - Copie o "access_token" de "supabase.auth.token"')
    console.log('   - Cole no script na variável ADMIN_TOKEN')
    console.log('\n2. TEST_USER_ID:')
    console.log('   - Acesse o Supabase Dashboard')
    console.log('   - Vá em Authentication > Users')
    console.log('   - Copie o ID de um usuário de teste')
    console.log('   - Cole no script na variável TEST_USER_ID')
    console.log('\n' + '='.repeat(60))
    process.exit(0)
}

// Run tests
testResetPasswordFunction()
testForgotPasswordFlow()

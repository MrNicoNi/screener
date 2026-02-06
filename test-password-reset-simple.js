// Simple interactive test for password reset
// Run with: node test-password-reset-simple.js

import readline from 'readline'

const SUPABASE_URL = 'https://gyktdmahkifnsrbaxodl.supabase.co'

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

function question(query) {
    return new Promise(resolve => rl.question(query, resolve))
}

async function main() {
    console.log('🧪 Teste Simplificado - Reset de Senha\n')
    console.log('='.repeat(60))

    console.log('\n📝 Instruções para obter o token de admin:')
    console.log('1. Faça login como admin no app (http://localhost:5173)')
    console.log('2. Abra DevTools (F12)')
    console.log('3. Vá em Application > Local Storage')
    console.log('4. Procure por "sb-gyktdmahkifnsrbaxodl-auth-token"')
    console.log('5. Copie o valor do "access_token"\n')

    const token = await question('Cole o token de admin aqui: ')

    if (!token || token.trim().length < 20) {
        console.log('\n❌ Token inválido. Execute novamente.')
        rl.close()
        return
    }

    console.log('\n📝 Agora precisamos de um ID de usuário para testar.')
    console.log('Vá em Supabase Dashboard > Authentication > Users')
    console.log('Copie o ID de um usuário de teste\n')

    const userId = await question('Cole o ID do usuário: ')

    if (!userId || userId.trim().length < 20) {
        console.log('\n❌ ID inválido. Execute novamente.')
        rl.close()
        return
    }

    console.log('\n🚀 Testando reset de senha...\n')

    try {
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/reset-password`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token.trim()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId.trim()
                })
            }
        )

        console.log('📊 Status:', response.status, response.statusText, '\n')

        if (response.status === 200) {
            const data = await response.json()
            console.log('✅ SUCESSO! Senha resetada!\n')
            console.log('🔑 Nova senha:', data.defaultPassword)
            console.log('✅ Flag must_change_password definida\n')
            console.log('📝 Próximos passos:')
            console.log('1. Faça logout do app')
            console.log('2. Faça login com o usuário de teste')
            console.log(`3. Use a senha: ${data.defaultPassword}`)
            console.log('4. Deve aparecer o modal de mudança de senha\n')
        } else {
            const error = await response.json()
            console.log('❌ ERRO:', error.error || 'Erro desconhecido')

            if (response.status === 401) {
                console.log('\n💡 Dica: Token expirado. Faça login novamente e pegue um novo token.')
            } else if (response.status === 403) {
                console.log('\n💡 Dica: Usuário não é admin. Use um token de admin.')
            }
        }

    } catch (error) {
        console.log('❌ Erro na requisição:', error.message)
    }

    rl.close()
}

main()

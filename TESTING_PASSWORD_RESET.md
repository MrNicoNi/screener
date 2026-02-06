# 🧪 Guia de Testes - Sistema de Reset de Senha

## ✅ Funcionalidades Implementadas

1. **Auto-Reset** - Usuário esqueceu senha (via email)
2. **Admin Reset** - Admin reseta para senha padrão

---

## 🔧 Teste 1: Esqueci Minha Senha (Auto-Reset)

### Passos:

1. Acesse http://localhost:5173
2. Clique em **"Esqueci minha senha"**
3. Digite: `nicolalelilolu@gmail.com`
4. Clique em **"Enviar Link"**
5. ✅ Deve aparecer mensagem de sucesso
6. Verifique seu email (pode ir para SPAM)
7. Clique no link recebido
8. Defina uma nova senha
9. Faça login com a nova senha

### Resultado Esperado:
- ✅ Modal abre corretamente
- ✅ Email é enviado
- ✅ Link funciona
- ✅ Nova senha funciona

---

## 🔧 Teste 2: Admin Reset de Senha

### Preparação:

Primeiro, pegue o token de admin:

1. Faça login como admin no app
2. Abra DevTools (F12)
3. Vá em **Application** > **Local Storage**
4. Procure por `sb-gyktdmahkifnsrbaxodl-auth-token`
5. Copie o valor do `access_token`

### Teste Automatizado:

Execute no terminal:

```bash
node test-password-reset-simple.js
```

Quando pedir, cole o token de admin.

### Teste Manual:

1. Faça login como admin
2. Vá em **Gerenciar Usuários**
3. Encontre um usuário de teste
4. Clique no ícone 🔑 (chave azul)
5. Confirme o reset
6. ✅ Deve aparecer: **"Senha resetada para: Enghouse@2025"**
7. Faça logout
8. Faça login com o usuário de teste
9. Use a senha: `Enghouse@2025`
10. ✅ Deve aparecer o modal forçando mudança de senha

### Resultado Esperado:
- ✅ Botão 🔑 aparece ao lado de cada usuário
- ✅ Modal de confirmação aparece
- ✅ Toast de sucesso mostra a senha
- ✅ Login com senha padrão funciona
- ✅ Modal de mudança de senha aparece

---

## 🐛 Troubleshooting

### Email não chega:
- Verifique SPAM
- Aguarde até 5 minutos
- Verifique configurações do Supabase (Email Templates)

### Erro 401 no admin reset:
- Token expirado - faça login novamente
- Usuário não é admin - verifique role no banco

### Modal de mudança de senha não aparece:
- Verifique se `must_change_password` está `true` no banco
- Limpe cache do navegador
- Faça logout completo e login novamente

---

## ✅ Checklist Final

- [ ] Forgot password envia email
- [ ] Link de reset funciona
- [ ] Admin consegue resetar senha
- [ ] Toast mostra senha padrão
- [ ] Login com senha padrão funciona
- [ ] Modal de mudança de senha aparece
- [ ] Mudança de senha funciona
- [ ] Flag `must_change_password` é removida após mudança

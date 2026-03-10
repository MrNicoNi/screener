# 📂 Pasta de PDFs para Importação Retroativa

Coloque aqui os PDFs dos atendimentos que deseja importar para o ScreenerQA.

## Regras

- Aceita arquivos `.pdf` diretamente nesta pasta
- Não é necessário renomear os arquivos — o `ticket_id` será extraído do conteúdo ou do nome do arquivo
- Cada PDF = um atendimento = uma avaliação
- As datas serão extraídas do conteúdo (campo "Data de Fechamento" ou equivalente)

## Como usar

```bash
# 1. Coloque os PDFs aqui

# 2. Extraia o texto e gere o arquivo de avaliação
cd d:\AntiGravity\Projetos\Screener2.0\screener-2.0
node scripts/extract_pdf_text.js

# 3. Aguarde o agente revisar e preencher as avaliações em scripts/evaluations_to_import.json

# 4. Confira o que será importado (sem tocar no banco)
node scripts/import_evaluations.js --dry-run

# 5. Execute a importação real
node scripts/import_evaluations.js
```

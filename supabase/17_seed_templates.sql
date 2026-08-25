-- 17_seed_templates.sql
-- ── v1: preserva as 166 avaliações interpretáveis (spec §7) ──
WITH t AS (
  INSERT INTO evaluation_templates (code, name, version, is_active)
  VALUES ('support-v1', 'Support QA (v1 — retired)', 1, FALSE)
  RETURNING id
)
INSERT INTO template_criteria (template_id, criterion_key, block, block_label, block_weight, statement, weight, allows_na, is_auto_fail, sort_order)
SELECT t.id, c.* FROM t, (VALUES
  ('C1','COM','Comunicação & Atitude',35,'Utilizou linguagem clara, objetiva e profissional?',20,false,false,1),
  ('C2','COM','Comunicação & Atitude',35,'Demonstrou empatia e cordialidade?',15,false,false,2),
  ('C3','COM','Comunicação & Atitude',35,'Evitou gírias e informalidade excessiva?',15,false,false,3),
  ('C4','COM','Comunicação & Atitude',35,'Instruções fáceis de entender (passo a passo)?',10,false,false,4),
  ('C5','COM','Comunicação & Atitude',35,'Manteve comunicação fluida (sem longas pausas)?',20,false,false,5),
  ('C6','COM','Comunicação & Atitude',35,'Adaptou a linguagem ao nível do cliente?',10,false,false,6),
  ('C7','COM','Comunicação & Atitude',35,'Confirmou entendimento antes de prosseguir?',10,false,false,7),
  ('E1','EFI','Eficiência & Eficácia',30,'First Contact Resolution (FCR)?',25,false,false,8),
  ('E2A','EFI','Eficiência & Eficácia',30,'SLA de Atendimento (1º contato)',10,false,false,9),
  ('E2B','EFI','Eficiência & Eficácia',30,'SLA de Solução',15,false,false,10),
  ('E3','EFI','Eficiência & Eficácia',30,'A solução foi efetiva e definitiva?',25,false,false,11),
  ('E4','EFI','Eficiência & Eficácia',30,'Demonstrou domínio técnico da ferramenta?',15,false,false,12),
  ('E5','EFI','Eficiência & Eficácia',30,'Evitou transferências desnecessárias?',10,false,false,13),
  ('P1','PRO','Processos & Ferramentas',35,'Seguiu o fluxo correto de troubleshooting?',20,false,false,14),
  ('P2','PRO','Processos & Ferramentas',35,'Registrou todas as informações no ticket?',15,false,false,15),
  ('P3','PRO','Processos & Ferramentas',35,'Coletou evidências (logs/screenshots)?',15,false,false,16),
  ('P4','PRO','Processos & Ferramentas',35,'Categorizou o incidente corretamente?',15,false,false,17),
  ('P5','PRO','Processos & Ferramentas',35,'Consultou a Knowledge Base se necessário?',15,false,false,18),
  ('P6','PRO','Processos & Ferramentas',35,'Segurança: validou identidade do solicitante?',10,false,false,19),
  ('P7','PRO','Processos & Ferramentas',35,'Fechou conforme padrão (tabulação)?',10,false,false,20)
) AS c(criterion_key, block, block_label, block_weight, statement, weight, allows_na, is_auto_fail, sort_order);

-- ── Support v2 (ativo) — spec §4 ──
WITH t AS (
  INSERT INTO evaluation_templates (code, name, version, is_active)
  VALUES ('support-v2', 'Support QA v2', 2, TRUE)
  RETURNING id
)
INSERT INTO template_criteria (template_id, criterion_key, block, block_label, block_weight, statement, weight, allows_na, is_auto_fail, sort_order)
SELECT t.id, c.* FROM t, (VALUES
  -- Block A — Effectiveness · 45%
  ('E1','A','Effectiveness',45,'Resolvido em até 24h corridas, sem transferência e sem segunda coleta de dados?',25,false,false,1),
  ('E3','A','Effectiveness',45,'A solução tratou a causa raiz, sem reabertura do mesmo assunto em 15 dias?',30,true,false,2),
  ('E6','A','Effectiveness',45,'Logs, prints ou evidências foram coletados ANTES de propor a solução?',20,false,false,3),
  ('E4','A','Effectiveness',45,'O caso foi resolvido sem consultar terceiros num tópico coberto por documentação?',15,false,false,4),
  ('E7','A','Effectiveness',45,'Onde houve escalonamento, justificativa e contexto foram registrados?',10,true,false,5),
  -- Block B — Communication · 30%
  ('C8','B','Communication',30,'Nenhum intervalo acima de 36h sem update com o ticket em progresso? (calculado)',30,true,false,6),
  ('C1','B','Communication',30,'Resposta estruturada: problema, ação, próximo passo e responsável explícitos?',25,false,false,7),
  ('C9','B','Communication',30,'Prazo comunicado e, se ia estourar, renegociado antes do vencimento?',25,false,false,8),
  ('C6','B','Communication',30,'Terminologia técnica traduzida ao nível do interlocutor, sem jargão não explicado?',10,false,false,9),
  ('C2','B','Communication',30,'Abertura e fechamento cordiais, incluindo confirmação da resolução?',10,false,false,10),
  -- Block C — Process · 25%
  ('P2','C','Process',25,'Registro completo: sintoma, causa raiz, solução e ambiente no ticket?',35,false,false,11),
  ('P1','C','Process',25,'Seguiu o fluxo de troubleshooting do driver correspondente?',25,false,false,12),
  ('P4','C','Process',25,'Categorizado e tabulado de modo que o ticket seja recuperável por busca?',20,false,false,13),
  ('P5','C','Process',25,'KB usada e, onde não havia artigo, a lacuna foi sinalizada?',20,false,false,14),
  -- Auto-fail — flag, fora do score (block NULL, weight 0)
  ('AF_IDENTITY',NULL,NULL,NULL,'Identidade do solicitante não validada',0,false,true,15),
  ('AF_MISINFO',NULL,NULL,NULL,'Informação factualmente incorreta entregue ao cliente',0,false,true,16),
  ('AF_DEADLINE',NULL,NULL,NULL,'Prazo prometido descumprido sem aviso prévio',0,false,true,17),
  ('AF_DATA_EXPOSURE',NULL,NULL,NULL,'Dado do cliente exposto indevidamente a terceiro',0,false,true,18)
) AS c(criterion_key, block, block_label, block_weight, statement, weight, allows_na, is_auto_fail, sort_order);

-- ── backfill histórico: todas as avaliações existentes são v1 ──
UPDATE evaluations
SET template_id = (SELECT id FROM evaluation_templates WHERE code = 'support-v1')
WHERE template_id IS NULL;

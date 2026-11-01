# Cadastro, notificações e simplificação dos livros — 31/10/2026

## Entrega
- Login explica RG sem pontuação/zeros à esquerda e senha inicial RG.
- Novos usuários sem senha explícita recebem hash do próprio RG e first_login=true.
- Primeiro acesso, ou cadastro legado sem e-mail, exige RG, e-mail, senha atual e nova senha pessoal. O servidor bloqueia leitura e escrita dos livros até concluir.
- Recuperação por RG + e-mail cadastrado, mensagem genérica, limite de três solicitações/hora por RG. Token aleatório de 256 bits, somente hash no banco, validade 30 minutos, uso único, vinculado à senha/e-mail atuais. Troca revoga sessões.
- Não altera perfis nem cria usuários via cadastro público.
- Confirmações Sim/Não em botões com aria-pressed; respostas críticas continuam sem padrão (OBM, Quesito).
- Listas pesquisáveis usam militares cadastrados identificados na escala do dia; inclusão manual preserva RG e posto/nome no conteúdo versionado. Dados manuais não dão autorização para assinar.
- Oficial: seleção auxilia relato de alterações; texto livre continua disponível.
- Supervisor/Adjunto: atrasos/faltas e permutas sem registros não bloqueiam. Manual na distribuição de postos permite posterior remanejamento. Expediente continua livre.
- SISGEO: importação sobre estatísticas já preenchidas pede confirmação; fontes e versões preservam rastreabilidade. Falha não converte estatísticas em zero.

## Obrigatoriedades e padrões
| Livro | Ajuste |
|---|---|
| Oficial | Observações/alterações vazias representam Sem alterações na exportação textual; mantém data, Oficial, horários e estatísticas confirmadas/manual. |
| Supervisor | Não exige marcar Não houve em listas vazias; não exige texto de alterações de refeições ou observações; refeições iniciam em 0; observações em Sem alterações. Horário da refeição somente se quantidade >0. |
| Adjunto | Não exige marcar Não houve em listas vazias/expediente; notas de arranchamento e observações opcionais; cinco refeições em 0; óbitos em 0 revisável. OBM sem resposta padrão, Não exige explicação. |
| Náutica | Mantém materiais em 0, estoque existente, horímetros recuperados; listas sem movimentos opcionais. Quesito passa a exigir escolha explícita quando há ocorrência. |
| SSMT | Mantém quatro seções, hodômetro/condição recuperados e guarnições opcionais; não cria abastecimentos nem obrigação de vincular assinatura à guarnição. |

Meteorologia, condições operacionais, identificação/autoria e revisão final não foram transformadas em declarações automáticas. Principal assina antes das conferências; chefe e Oficial continuam independentes entre si em Náutica/SSMT.

## E-mail e agendamento
- Integração Resend REST, chave de idempotência por RG/livro/serviço, registro privado livros.mail_log.
- Supervisor: cron 0 21 * * * UTC = 18h Brasília.
- Outros: cron 0 9 * * * UTC = 06h Brasília, serviço da data anterior.
- Endpoint /api/reminders protegido por CRON_SECRET; nenhuma sessão de usuário necessária.
- Cada execução consulta escala atualizada e substituições em assignment_events. Permutas textuais não alteram responsabilidade: usar Solucionar responsabilidade.
- Náutica: posto/graduação e, no empate, RG crescente entre operadores escalados. Enc. motoristas: função explícita da escala, depois índices usados pelo módulo SSMT (encarregado/SOS acumulado).
- Sem responsável identificado ou e-mail: registra pendência, não inventa destinatário.
- Duas tentativas imediatas com a mesma chave; próximas execuções também revisitam pendências de até 23h com nova consulta à escala.
- Lease no banco evita concorrência. Após 23h de tentativa incerta, bloquear reenvio automático e conferir no provedor para não duplicar fora da janela de idempotência.
- accepted significa que o provedor aceitou a mensagem; não significa entrega na caixa postal. Sem webhook de entrega/bounce nesta versão.
- Precisão de horário depende do plano de cron da Vercel; no Hobby pode ocorrer em qualquer minuto da hora. Não há promessa de entrega no minuto exato.

## Configuração
No projeto Vercel livros-servico-2gmar, ambiente Production:
- APP_ORIGIN=https://livros-servico-2gmar.vercel.app — configurado.
- CRON_SECRET — segredo aleatório configurado, somente servidor.
- RESEND_API_KEY — pendente, configurar como Secret diretamente na Vercel.
- MAIL_FROM — pendente, endereço de domínio verificado na Resend, por exemplo Livros 2º GMAR <livros@SEU-DOMINIO>.
Não colocar chaves no chat, no GitHub ou em variáveis NEXT_PUBLIC_.
Depois de configurar remetente e chave, publicar novamente e fazer um envio controlado. Verificar logs na aba administrativa Notificações por e-mail e entrega na caixa do destinatário.
Enquanto faltar configuração, recuperação informa indisponibilidade e lembretes registram pendência. Envios reais não foram validados; testes usam provedor simulado.

## Banco e arquivos
Migração 20261031180758_account_mail_notifications.sql: colunas email/profile_completed_at em livros.users, tabelas privadas password_resets e mail_log com RLS e sem acesso anon/authenticated. Nenhuma alteração na SAD/public. PDFs continuam somente sob demanda.

Arquivos novos principais:
app/account-server.ts, app/account-panel.tsx, app/mail-service.ts, app/notifications.ts, app/api/reminders/route.ts, app/form-controls.tsx, app/manual-personnel.ts.
Alterados: API service, página principal, painéis dos cinco livros, modelos/PDF de Supervisor/Adjunto, book-model, globals.css, vercel.json.
Testes: integration.mjs, draft-cases.mjs, account-notifications.mjs, form-audit.mjs.

## Alternativa Gmail (01/11/2026)
Sem registro de domínio: MAIL_PROVIDER=gmail e GMAIL_USER=livros2gmar@gmail.com.
Cadastrar GMAIL_APP_PASSWORD como Secret, apenas em Production, na Vercel e republicar.
Usar senha de app da conta Google com verificação em duas etapas, nunca a senha normal.
Não enviar a senha em chat, não versionar nem colocar prefixo NEXT_PUBLIC_.
Resend é opcional e não é usado como fallback do Gmail.
SMTP TLS/465; credenciais e mensagens não são registradas em logs técnicos.
A tela administrativa distingue credenciais cadastradas de entrega comprovada.
Sem idempotência do provedor, uma tentativa de lembrete incerta não é repetida automaticamente,
inclusive após interrupção do servidor. Conferir a conta remetente e o histórico administrativo.
Não há promessa de entrega na caixa principal: limites e filtros do Gmail se aplicam.
Validar recuperação com um cadastro controlado e recebimento real após configurar a senha.

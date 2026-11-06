# Situação para continuidade

Atualizado em 30/10/2026.

## Fonte oficial
- Repositório: https://github.com/loureirocbmerj17-collab/livros-servico-2gmar
- Site: https://livros-servico-2gmar.vercel.app
- Revisão de aplicação publicada nesta entrega: 3b1ef8d2142b3c9b1471c6aaf484cd633445b8d7.
- Deployment confirmado READY: dpl_9eBzEUdortCsREFqrWupyerRdtsQ.
- Antes de trabalhar, consulte a main e a publicação atuais; estas referências são o registro desta entrega, não garantia de que ainda sejam as mais recentes.

## Arquivos recuperados e enviados
O repositório inclui a aplicação completa, tests/integration.mjs, tests/nautica-cases.mjs, tests/ssmt-cases.mjs, tests/draft-cases.mjs, scripts/migrate.mjs e supabase/ com os esquemas e migrações.

## PDFs sob demanda — concluído
- Salvar, assinar e conferir guardam dados e assinaturas, sem gerar PDFs.
- Downloads diários, mensais e históricos geram o documento em memória, com autenticação e resposta sem cache.
- A transmissão é feita em partes para comportar volumes maiores.
- Migração supabase/migrations/20261030172746_pdf_on_demand.sql aplicada em produção como pdf_on_demand.
- As seis colunas legadas pdf permanecem vazias, protegidas por CHECK(pdf=''). Não remover essa proteção nem voltar a gravar PDFs.
- A migração comparou todos os demais campos antes/depois e preservou os registros e assinaturas.
- Cinco PDFs legados foram removidos via Storage API. Verificação final: zero objetos no bucket livros-pdf e zero bytes PDF nas seis tabelas.
- Histórico mantém o conteúdo de cada revisão; o layout do PDF usa o gerador atual.
- Não fazer rollback para versões que dependam de PDFs armazenados.

## Melhorias de preenchimento — concluídas
- Rascunho local automático por RG, tipo de livro, data e versão; recuperação explícita, validade de sete dias, sem senha nem desenho de assinatura.
- Salvar rascunho continua necessário para registrar no servidor.
- Lista de pendências antes da assinatura.
- Aviso para hodômetro/horímetro abaixo da leitura anterior; correções legítimas continuam permitidas.
- Botões dos cinco livros agrupados acima da condição operacional; SSMT com quatro seções.

## Validação realizada
- Testes isolados dos três livros ativos: Oficial de Dia, Náutica e SSMT.
- Testes de assinatura, conferência, permissões, histórico, PDF e migração.
- Testes dos componentes de proteção do rascunho, isolamento por RG/versão e avisos.
- Compilação aprovada.
- Downloads reais de Oficial de Dia e Náutica (diário, histórico e mensal) verificados antes e depois da limpeza: HTTP 200, application/pdf, sem redirecionamento para Storage.
- Compilado sintético de 31 dias testado isoladamente: 125 páginas, aproximadamente 7,7 MB.
- Nenhum livro fictício criado na produção.
- Na entrega de 30/10, Supervisor e Adjunto ainda aguardavam implementação; veja atualização abaixo.


## Livro do Supervisor — 31/10/2026
- Implementado em branch chatgpt/supervisor-book a partir da main 36eee0f. PR do Claude #2 permanece separado; não foi integrado nesta entrega.
- Nove seções seguem as fotos: meteorologia, ativação, alimentação, estatísticas, atrasos, faltas, apoio, postos/remanejamentos, observações. Assinatura do Supervisor e visto do Oficial de Dia; sem etapa de chefe ou Major.
- Migração 20261031011506_supervisor_book.sql aplicada como supervisor_book. Cria somente tabelas/funções privadas livros.supervisor_*, RLS, histórico imutável e sincronização com service_attestations. Herda CHECK(pdf='') das tabelas-base já migradas. Nenhuma mudança no schema public.
- Importação lê Supervisor, Oficial de Dia e tabela POSTO/MILITAR/MILITAR dos Docs/PDFs; procura tabela nas páginas adicionais; mantém seleção da escala mais recente. Validado com escala real de 01/10: 29 GVs, sem sobreavisos ou licenças.
- Distribuição inicial e movimentações ficam separadas: origem, destino, RG, eventual RG da permuta, horário, motivo. Total de GVs é preenchido por botão, sujeito à conferência.
- NOAA GFS e NOAA GFSWave 0.25 via APIs Open-Meteo fornecem temperatura ambiente, vento e ondas às 09h/15h em America/Sao_Paulo para Barra da Tijuca. Não há integração direta com SurfGuru. Corrente e temperatura da água permanecem manuais; não confundir direção de onda com corrente.
- Botões de confirmação/correção da previsão, Não houve, tentativas de SISGEO (2GMAR), preenchimento manual, substituição justificada, recuperação de rascunho, resumo WhatsApp, PDFs diário/histórico/mensal sob demanda.
- Testes isolados de banco/API cobrem papéis, assinatura, histórico, movimentação, conferência, dependência e PDFs. Testes de UI cobrem nove seções, Não houve e abertura em leitura até Retificar livro. Testes existentes e build aprovados. PDF de quatro páginas conferido visualmente. Nenhum livro fictício em produção.
- Adjunto continua pendente de implementação. Não remover essa dependência da conferência do Oficial de Dia sem instrução do usuário.


## Livro do Adjunto — 31/10/2026
- Implementado a partir da main de946fa, separado do PR #2 do Claude. Mesmo fluxo de assinatura do Supervisor: autor escalado como Adjunto, substituição justificada, visto do Oficial de Dia e bloqueio. Atualiza a dependência adjunto no livro principal.
- Escala reconhece ADJUNTO AO OF. DE DIA separadamente sem aumentar o vetor crew; validado com PDF real de 01/10 (RG 13113), distinto do Supervisor (20714). Campos não reconhecidos ficam manuais.
- Expediente: campos livres Militar e Seção, botão para acrescentar militares. Arranchamento único de cinco refeições para todo o efetivo, incluindo expediente e praia. Horário opcional e observações por refeição.
- Situação da OBM Sim/Não com justificativa nos itens Não; meteorologia com confirmação/correção; ativação; SISGEO para prevenções/socorros; óbitos manuais; atrasos, faltas, permutas e observações.
- Formulário e ciclo de assinatura compartilham o componente SupervisorPanel com kind=adjunto, mas modelos, API, tabelas, atestações, PDF, recuperação local e exportação mensal são separados por tipo.
- Migração 20261031091146_adjunto_book.sql aplicada como adjunto_book: schema privado livros, RLS, histórico imutável, CHECK(pdf='') herdado e service_attestations. Schema public preservado.
- Testes dos cinco livros e testes de UI aprovados; build aprovado. PDF sintético de quatro páginas revisado visualmente. Nenhum livro fictício em produção.
- Todos os quatro livros secundários agora possuem implementação. Conferência do Major continua exigindo as quatro atestações do Oficial do mesmo dia.


## Conferências independentes — 31/10/2026
- Náutica e SSMT: chefe e Oficial de Dia podem conferir em qualquer ordem após a assinatura do autor. A primeira conferência trava a edição do conteúdo; somente a outra assinatura pode ser acrescentada.
- Situação permanece Assinado com uma conferência e passa a Conferido com ambas. A assinatura existente é preservada, inclusive na ordem Oficial -> Chefe. Não há migração nem alteração de registros existentes.
- A dependência para conferência do Major exige as duas conferências em Náutica/SSMT, além do RG correto do Oficial. Supervisor e Adjunto continuam com o visto do Oficial.
- Testes tests/independent-reviews.mjs cobrem as duas ordens nos dois livros, preservação de dados/assinaturas, duplicidade, versões concorrentes, bloqueio e dependências.

## Fila Conferência SUBCMT — 31/10/2026
- Aba exclusiva do perfil reviewer, com filtro mensal e listas Prontos para conferir, Com pendências e Já conferidos. Ordem cronológica para revisão.
- Leitura dos PDFs gerados sob demanda, fixados na versão da fila, incluindo os quatro livros secundários da mesma data. Nenhum PDF armazenado.
- Conferir e abrir próximo exige senha individual; Pular por enquanto apenas avança localmente. Reutiliza a operação review com validações de perfil, autoria, versão e quatro dependências no servidor.
- Náutica/SSMT continuam com assinaturas independentes de chefe e Oficial. Subcomandante confere somente Oficial de Dia; não pode conferir o próprio livro.
- Sem migração. Testes isolados de API e componente cobrem grupos, acesso, duplicidade, senha individual, próximo/pular e versão do documento.

- Atualização: administrador também acessa Conferência SUBCMT para consulta; apenas reviewer pode confirmar a conferência, com bloqueio na interface e no servidor.

## Cadastro, e-mails e formulários — 31/10/2026
- Branch chatgpt/access-notifications-forms a partir de e9933db. PR do Claude preservado.
- Migração account_mail_notifications aplicada: e-mail/perfil em livros.users, password_resets e mail_log privados com RLS. Sem alterar public/SAD.
- Cadastro obrigatório para primeiro acesso ou ausência de e-mail; recuperação por token com validade 30min, uso único, hash e revogação de sessões.
- Botões Sim/Não, militares da escala com preenchimento manual preservado, opcionais sem movimento e padrões documentados em docs/access-notifications-forms.md.
- Resend implementado/testado com simulação. RESEND_API_KEY e MAIL_FROM ainda precisam ser configurados pelo proprietário de um domínio verificado. Não declarar envio real funcionando.
- APP_ORIGIN e CRON_SECRET configurados na Vercel; crons 09h/21h UTC. Histórico/pendências na administração.
- Sem PDF armazenado e sem livro de teste em produção.

## Gmail sem domínio próprio — 01/11/2026
- MAIL_PROVIDER=gmail seleciona SMTP Gmail via TLS/465; GMAIL_USER e GMAIL_APP_PASSWORD ficam exclusivamente no servidor. Remetente solicitado: livros2gmar@gmail.com. Resend continua disponível por configuração explícita; sem fallback automático.
- Ao contrário do Resend, SMTP não oferece chave idempotente. Lembretes são reservados atomicamente como uncertain antes do envio, sem reenvio automático após tentativa ambígua ou interrupção. Aceitação confirmada muda para accepted. Histórico administrativo registra pendências; recuperação continua com link único/30min, solicitável novamente dentro do limite existente.
- Testes usam transporte simulado, inclusive concorrência e falha após reserva. Nenhum e-mail real enviado. Falta o proprietário cadastrar GMAIL_APP_PASSWORD como Secret na Vercel Production e fazer nova publicação antes de validar entrega real.
- Sem migração, sem alterações em livros operacionais ou permissões.

## Frota SISGEO — 04/11/2026
- POST Manager/GetConsultaViatura confirmado HTTP 200 JSON sem cookie/autenticação. Consulta por unidadelotacao=2GMAR com unidadecarga vazio e filtro local exato; carga administrativa não define a lotação.
- Náutica: AMA/BIR/RTE/AQ/AQS; SSMT: AR/ASE/V1/V4/VL. Situação 1/0 traduz condição OP/INOP; indisponibilidade operacional por falta de RH não equivale a defeito. Odometro aceita vírgula decimal, sem inferir casas ausentes. Conferente/guarnição externos nunca viram condutor.
- ConferenciaViatura retorna código numérico sem data documentada. NÃO inferir conferência do dia: null na interface/PDF até declaração manual. Necessário endpoint adicional com data/hora para automatizar este ponto.
- Sincronização ao abrir serviço atual ou reabrir rascunho próprio, mais botão Atualizar do SISGEO. Janela 08–08 America/Sao_Paulo; fora dela não aplica o retrato atual a dias passados. Livros assinados/conferidos não são atualizados.
- Registro de origem em initial_data.sisgeo das tabelas existentes; sem migração e sem alteração de public/SAD. Prefixo normalizado preserva IDs de cadastros manuais equivalentes e passa a gerir esses itens pelo SISGEO. Ausência desativa somente importados; manuais exclusivos permanecem. Itens inativos continuam no catálogo/histórico. Falha, resposta inválida/duplicada/vazia preservam cadastros.
- Snapshots por livro contêm origem/data da consulta, condição/leitura e conferência em branco; PDFs sob demanda. Testes sintéticos de parser, sincronização transacional, janela, duplicidade, manuais, saída de lotação, falha e preservação de livros. Nenhum livro fictício em produção.

## Checklist SISGEO — 04/11/2026
- Automatizada a conferência na SSMT e Náutica via POST anônimo Manager/GetViaturaConferenciaViatura com viatura normalizada e data civil `yyyy-mm-dd 00:00:00`. HTTP 200 JSON confirmado sem cookie/login; consulta da AR558 em 04/11 retornou checklist salvo às 09:50:43.
- Somente itens salvos com Id/IdItem, Viatura correspondente, Conferencia reconhecida e DataCadastro válida comprovam registro. Templates sem preenchimento também retornam lista/odômetro e NÃO comprovam conferência. Valor Conferencia=0 é válido; não converter esse código em falso.
- DataCadastro brasileira interpretada em UTC-03, restrita à janela [08h,08h seguinte), até a hora da consulta. De madrugada consulta os dois dias civis. Confirmação vira Sim; ausência/erro permanece null, com motivo e data/hora de origem visíveis. Não inferir Não automaticamente. A condição OP/INOP continua vindo da frota, independentemente do resultado de cada item do checklist.
- Quatro consultas simultâneas, prazo global de 15s para checklists, limite de 5s por consulta. Falha parcial conserva a importação de condição/leitura e sinaliza checklist indisponível para nova tentativa. GetViaturaOdometroAtual é fallback quando a listagem não trouxer leitura; leitura antiga do checklist nunca substitui a atual.
- Conferente não é importado nem atribuído como condutor. Cadastros manuais, bloqueios, livros históricos e assinaturas preservados. Sem migração; apenas metadados nos JSON já existentes. PDFs seguem sob demanda.
- pnpm test e pnpm build aprovados. Testes sintéticos cobrem template vazio, conferência válida, viatura errada, data inválida/futura, limites 08–08, consulta de dois dias, leitura atual versus checklist antigo, falha/timeout parcial, concorrência limitada e persistência/merge do indicador. Nenhum livro fictício em produção.

## Condutores da SSMT — 04/11/2026
- Campo Condutor / RG continua opcional, agora restrito aos militares cadastrados identificados na escala do serviço (colunas de serviço e postos de praia, sem sobreaviso). Ordenação por posto/graduação, seguida pelo menor RG entre iguais; não há data de promoção no cadastro.
- Composição é carregada para livros novos, ao reabrir rascunho próprio, atualizar/reimportar e retificar. Preenchimento manual usa a composição justificada já registrada. Snapshot servicePersonnel é renovado no servidor ao salvar; sem migração.
- Condutores previamente gravados continuam visíveis nos livros existentes, sem serem oferecidos para novas escolhas quando fora da escala. Campo vazio continua permitido e não altera as regras de assinatura.
- Testes de filtragem, militares múltiplos por linha, exclusão de sobreaviso, posto/RG, composição manual, API e testes existentes aprovados; build aprovado.

## Escala sem RG e estatísticas diretas — 05/11/2026
- Investigação da escala real de 05/11: chefe de operações e chefe ASE aparecem apenas com posto/nome, sem RG. O parser descartava essas células. Agora importa o nome reconhecido; RG só é acrescentado com correspondência única e exata de nome/posto no cadastro ativo. Ausência/ambiguidade gera aviso e mantém a exigência de RG correto para assinatura. Não confundir nomes semelhantes nem utilizar sobreaviso.
- Cadastro ativo não contém CAP MARCELO FERREIRA; nome passa a ser importado, mas falta RG/cadastro para vínculo de assinatura. CAP PRISCILA BITTENCOURT foi reconhecida pelo cadastro na validação da escala. Nenhum usuário foi criado/alterado nesta entrega.
- Contextos de todos os livros, validação de assinatura, busca de escala e notificações usam a resolução pelo cadastro. Nenhuma notificação real foi enviada durante os testes.
- Oficial de Dia aplica estatísticas diretamente após consulta (inclusive ao abrir livro novo). Botão único Importar estatísticas do SISGEO, sem prévia de confirmação nem diálogo de substituição. Falha preserva campos e libera mensagem manual; resposta parcial mantém valores das unidades sem lançamento. Supervisor/Adjunto também importam pelo botão sem confirmação intermediária. Bloqueios de livros assinados/conferidos continuam válidos.
- pnpm test e pnpm build aprovados; PDF sintético cobre nome sem RG, resolução única, sobreaviso excluído e ambiguidades; teste de interface verifica importação em um clique mesmo com valor prévio. Escala real de 05/11 retestada. Sem migração e sem livros fictícios em produção.


## Captura compartilhada da escala — 05/11/2026
- Alteração baseada na main f31b86f, preservando o PR #18 do Claude e os fluxos de assinatura de rascunhos.
- Parser conserva texto da coluna de serviço mesmo sem RG, posto reconhecido ou correspondência no cadastro; mantém separado o texto original e eventual vínculo único de identidade. Sobreaviso continua excluído.
- Os cinco livros exibem a captura por função/posto e guardam o snapshot nos dados do livro; livros assinados/conferidos não buscam uma escala nova automaticamente. Postos de praia também conservam texto sem RG.
- Ausência de RG não apaga o nome. Seleção de usuários e autorização de assinatura continuam exigindo identificação segura ou substituição justificada existente; nenhuma conta ou RG é inventado.
- Testes de parser PDF com e sem RG/posto/cadastro, UI de snapshot, suíte dos cinco livros e build. Sem migração, PDFs persistidos ou registros fictícios na produção.


## Navegação responsiva — 06/11/2026
- Cabeçalho móvel fixo durante rolagem, com Início e Menu. Menu expansível com ícones e nomes de todos os destinos permitidos, sem comprimir os botões numa linha. Brasão/nome da unidade e breadcrumb voltam à página inicial.
- Troca de livros preserva o aviso de alterações não salvas; cancelar mantém o livro e o menu. Destinos filtrados por perfil e validados novamente na função de navegação. Permissões do servidor e assinaturas inalteradas.
- Base main 658a71a preservada. Testes dos quatro perfis, troca de livros, links Início/brasão, cancelamento/confirmação e suíte existente; build aprovado. Não há migração.
- Validação visual automatizada em navegador local indisponível: download do Chromium retornou arquivo inválido. Testes de interação React executados normalmente.

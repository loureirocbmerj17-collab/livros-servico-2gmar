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

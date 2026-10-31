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
- Supervisor e Adjunto ainda aguardam implementação.

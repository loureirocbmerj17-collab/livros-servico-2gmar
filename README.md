# Livros de Serviço — 2º GMAR

Aplicação independente do ChatGPT: Next.js na Vercel, PostgreSQL e arquivos privados no Supabase. Login próprio por RG/senha. Não utiliza API de IA.

## Recursos

- Livro do Oficial de Dia, consulta por data e acervo.
- Importação da escala pública no Drive, incluindo motorista ASE e motorista AR/SOS; médico = chefe da guarnição ASE. Importação editável e preenchimento manual em caso de falha.
- Estatísticas do SisGeO e importação da mensagem de encerramento, com revisão antes de aplicar.
- Livro salvo abre somente para leitura. Autor pode usar **Retificar livro** até conferência.
- Assinatura desenhada e confirmação por senha; PDF com timão e identidade visual.
- Perfil `reviewer` confere livro assinado de outro autor, com senha. Conferência bloqueia alterações também no banco.
- Histórico de versões, PDFs originais de cada versão e registro de ações administrativas.
- PDF mensal com capa, índice, dias ausentes e últimas versões em ordem cronológica; rascunhos/pendências identificados.

## Publicação

1. Use Node 22 ou 24 e pnpm 11.25.0. Execute `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`.
2. No Supabase, aplique `supabase/schema.sql` uma única vez em banco novo e depois `supabase/storage.sql`. O esquema `livros` é privado, separado da SAD. **Na conta 2º GMAR ONLINE estes scripts já foram aplicados em 25/10/2026. Não execute novamente.**
3. Configure as variáveis abaixo diretamente na Vercel, ambiente Production. Não cole segredos em chat nem os coloque no GitHub:
   - `DATABASE_URL` (ou `POSTGRES_URL` da integração): URI do Transaction Pooler fornecida no botão Connect do Supabase; senha com caracteres especiais codificada na URI.
   - `DATABASE_CA_CERT`: certificado raiz do banco, se necessário para verificação TLS; não desabilite a verificação de certificados.
   - `SUPABASE_URL`: URL do projeto.
   - `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SECRET_KEY` da integração): chave secreta de serviço, usada somente no servidor para arquivos privados.
   - `SUPABASE_PDF_BUCKET`: `livros-pdf`.
   - `SETUP_TOKEN`: código aleatório com pelo menos 32 caracteres, somente para primeiro administrador. Remova após a configuração inicial, ou omita se usuários antigos forem migrados.
4. Importe este diretório como raiz de um repositório privado GitHub na Vercel. Framework Next.js, comando `pnpm build`.
5. Verifique login/assinatura/conferência/download com contas de teste antes do uso oficial. Quando o sistema estiver validado, libere o endereço de produção da proteção de login Vercel: a autenticação de RG/senha permanecerá obrigatória no aplicativo.

O bucket deve permanecer privado. Downloads são autorizados após login por links de 120 segundos. Os PDFs diários originais permanecem também no banco para preservar todas as versões. O volume mensal é montado a partir desses arquivos; não recalcula dados assinados. A confirmação por senha é uma atestação interna com SHA-256, não certificado ICP-Brasil.

## Estado em 26/10/2026

- Integração Supabase instalada e variáveis de produção sincronizadas.
- Certificado raiz oficial configurado em DATABASE_CA_CERT, mantendo verificação TLS.
- Produção READY: https://livros-servico-2gmar.vercel.app (deployment dpl_Gy7MVP2sh8Ej3EJBqaa8dyjw68qj).
- GET /api/service?op=me validado: HTTP 200, setup=false.
- Único usuário original transferido mantendo RG, nome, perfil e hash/salt de senha.
- Acervo original (livro e revisões) ainda NÃO migrado. Original intacto. Não iniciar acervo paralelo antes da migração.
- Proteção adicional Vercel SSO removida com autorização explícita. Login RG/senha obrigatório; APIs de livros e PDFs retornam 401 sem sessão.
- Testes locais PostgreSQL/PGlite aprovados; login e armazenamento reais ainda precisam de teste autenticado.
- GitHub ainda não recebeu este código.

## Migração dos dados existentes

Migrar usuários (mantendo hashes/salts), livros, revisões, configurações e auditoria em uma transação. Não migrar sessões: usuários entram novamente. Compare contagens, hashes de dados/PDF e última versão por data antes de apontar o endereço oficial. Não gere novamente PDFs históricos nem altere os JSONs assinados.

## Testes

`pnpm test` usa PostgreSQL local em memória (PGlite), sem credenciais reais. Cobre código inicial, login, permissões, assinatura desenhada, retificação, revisão, bloqueio de edição/exclusão no banco, histórico imutável, PDF mensal, downloads e revisão de livros legados com 12 campos sem alterar assinatura. A função de upload é simulada no teste local; o armazenamento exige verificação real após configurar a hospedagem.

Os campos de motoristas foram também conferidos contra a escala real de 23/10/2026; os documentos pessoais da escala não fazem parte deste pacote.

## Ajustes de preenchimento — 26/10/2026

- Apoio operacional inicia com Não e quantidades zero, editáveis.
- BRO físico/Forms removidos da interface, importação da mensagem, validação de assinatura e novos PDFs. Campos legados permanecem compatíveis; PDFs históricos não são alterados.
- Mensagem padrão liberada após falha ou retorno incompleto do SisGeO.
- Seletor de tipo no PDF mensal; somente Oficial de Dia disponível, demais módulos sinalizados em breve. API rejeita tipos ainda não implementados.

## Cadastro DGP e regras por serviço — 26/10/2026

- Migração adicional `supabase/access-rules.sql` aplicada em produção. Em instalações novas, executar após schema.sql; não reaplicar na conta atual.
- DGP: 270 militares (250 praças, 18 oficiais não majores e 2 majores). Cadastros usam RG sem zeros à esquerda e nome de guerra. Novos usuários recebem hash PBKDF2 da senha inicial RG e convite para alteração. Contas existentes preservam senha; administrador preserva perfil.
- Praças têm tela própria e acesso negado no servidor ao livro do Oficial, acervo, históricos, estatísticas e exportação de PDFs.
- Assinatura do Oficial: RG do usuário deve coincidir com o RG do responsável no livro e na escala consultada pelo servidor. Falha ou divergência exige registro independente de substituição, confirmado por senha e justificativa. Eventos são imutáveis e entram no PDF e histórico.
- Conferência do major bloqueada enquanto Supervisor, Adjunto, Náutica ou SSMT não tiverem assinatura e visto do Oficial de Dia. A tabela privada service_attestations está preparada para receber os registros dos futuros módulos. Não há entrada manual que simule esses vistos.
- Modelos dos outros livros ainda pendentes de envio. Portanto ainda não há fluxo de elaboração/assinatura secundária desses quatro livros. Política de responsabilidade preparada em service-policy.ts: Supervisor = supervisor do dia; Adjunto = adjunto explicitamente identificado na escala (sem reutilizar o supervisor; bloqueado até haver identificação própria); Náutica = guarnição AMA; SSMT = motorista ASE ou AR/SOS. Validar campos completos da escala ao implementar os modelos.
- Acervo antigo continua no protótipo, ainda não migrado. Cadastro de usuários foi migrado.

## Náutica

Módulo disponível para militares autenticados. O cadastro DGP preserva `rank` separado de `name` e exibe ambos. Operadores de 24h são extraídos da coluna de serviço da escala, incluindo pares separados por `/`; RGs repetidos são removidos. A confecção/assinatura exige compatibilidade de RG ou substituição justificada e confirmada por senha, registrada em `assignment_events`.

O fluxo é rascunho → assinatura do operador → visto manuscrito e por senha do Oficial de Dia → bloqueio. Não há visto do Adjunto. Retificações antes do visto preservam versões e invalidam a assinatura anterior. O trigger atualiza `service_attestations` na mesma transação, alimentando a pendência do livro do Oficial de Dia. Praças não acessam o livro do Oficial nem a exportação mensal.

Aplicar `supabase/nautica.sql` após `access-rules.sql`. As tabelas ficam no schema privado `livros`, com RLS e sem concessões públicas. Os prefixos do modelo são cadastrados inicialmente sem leituras ou condições ilustrativas. A administração pode cadastrar/editar/inativar equipamentos. O próximo serviço recupera inventário, saldo físico e alterações pendentes do último livro assinado anterior; exige revisão antes da assinatura. Compras são deduplicadas por dia/id e derivadas transacionalmente de cada livro, com acumulado mensal até a data do serviço; correções exigem retificar o livro de origem ainda não conferido. PDFs guardam o retrato daquele momento, inclusive o acumulado, e não são reescritos retroativamente.

Verificação: `pnpm test` cobre ambos os módulos em PostgreSQL/PGlite, permissões, autoria, escala, substituição, versões, bloqueio, compras, continuidade e PDF mensal; `pnpm build` verifica a aplicação. Os fixtures de teste não são enviados para produção.

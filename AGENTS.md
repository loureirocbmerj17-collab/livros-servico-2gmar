# Trabalho compartilhado — ChatGPT e Claude

O GitHub é a fonte oficial deste projeto. Leia também HANDOFF.md antes de alterar o sistema.

## Evitar sobrescritas
1. Antes de começar, atualize a visão de origin/main e examine commits e pull requests recentes. Não use ZIPs antigos nem arquivos da Vercel como fonte principal.
2. Trabalhe em uma branch própria criada da main atual: chatgpt/<tarefa> ou claude/<tarefa>. Não reutilize a branch de outro assistente.
3. Faça mudanças pequenas e delimitadas. Preserve alterações de terceiros; não substitua arquivos inteiros por cópias antigas.
4. Antes de integrar, atualize a branch com a main mais recente, resolva conflitos preservando os dois trabalhos e execute os testes relevantes. Nunca use force push na main.
5. Integre por pull request. Ao usar APIs, informe o SHA esperado para rejeitar atualizações concorrentes. Se ele mudar, leia as novas alterações antes de tentar novamente.
6. Publique somente uma revisão já integrada e testada da main. Confira a revisão publicada antes e depois; não publique uma revisão anterior à que já está em produção.
7. Descreva no PR o comportamento alterado, validação e migrações. Registre a situação final em HANDOFF.md quando houver mudança de infraestrutura.
8. Se os trabalhos alterarem o mesmo fluxo ou o banco, coordene a ordem de integração antes de publicar. Estas instruções são um fluxo de trabalho, não uma trava técnica do GitHub.

## Verificação
- Instalação: pnpm install --frozen-lockfile
- Testes: pnpm test
- Compilação: pnpm build
- Inclua testes e scripts no repositório, mesmo quando não forem enviados no pacote de implantação.

## Dados e regras que devem ser preservados
- Banco dos livros: schema privado livros. Não alterar o schema public da SAD.
- Nunca versionar senhas, tokens, sessões, arquivos .env reais ou dados operacionais de produção.
- PDFs são gerados somente ao baixar: diário, histórico e mensal. Não armazenar PDFs no banco nem no Storage.
- Preservar dados originais, assinaturas, autoria, versões e bloqueios após conferência.
- Não executar scripts/migrate.mjs no banco existente: ele inicializa um banco vazio. Em produção, aplicar somente migrações novas, após conferir o histórico.
- Alterações de banco exigem migração versionada; nunca reaplicar uma migração já executada.
- Não criar livros fictícios no banco de produção para testes.

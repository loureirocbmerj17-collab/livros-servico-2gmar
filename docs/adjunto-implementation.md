# Livro do Adjunto — modelo recebido em 31/10/2026

Estado: implementação concluída; testes de API, banco e formulário aprovados. Publicação pela main após integração.

## Seções da fotografia
1. Ala de serviço: Oficial chefe de operações, Oficial RAS 2º GMAR, Adjunto ao Oficial de Dia, COMAT, Comunicante, Permanências, Moto Aquática, Oficial Médico, Técnico de Enfermagem, Encarregado de motorista/ASE, Motorista socorro, Aprovisionador e Supervisores dos setores 1, 2 e 3.
2. Situação da OBM na assunção: viaturas abastecidas e limpas; faxina realizada; caixa d’água cheia; apenas carros autorizados no estacionamento; claviculário completo. Respostas Sim/Não sem presumir conferência; observação por item, exigir esclarecimento em Não.
3. Condições meteorológicas: manhã/tarde; altura de ondas, direção da corrente, direção do vento, temperatura ambiente e da água. Reutilizar previsão do Supervisor com fonte/data, sem inferir corrente a partir de ondas; permitir correção manual.
4. Ativação da praia: total e parcial de GVs, importação conferível da escala.
5. Atrasos às formaturas: nome, RG, apresentação e motivo; botão Não houve.
6. Faltas: nome e RG; botão Não houve. A foto repete o número 9; corrigir numeração na apresentação, preservando conteúdo.
7. Arranchamento: café da manhã, almoço, lanche da tarde, jantar e ceia; quantidade e observações. Botões sem alterações e não houve fornecimento.
8. Controle dos militares do expediente: campos livres Militar e Seção, lado a lado; botão Adicionar militar do expediente hoje; opção Não houve expediente.
9. Alimentação unificada com arranchamento: café, almoço, lanche, jantar e ceia para todo o efetivo, incluindo expediente e praia; quantidade total, horário opcional e observações. Não há segundo formulário de alimentação.
10. Estatísticas do 2º GMAR: prevenções, socorros e óbitos. SISGEO somente quando campo identificado explicitamente; nunca usar outros eventos como óbitos. Fallback manual.
11. Permutas: saída, entrada, função/posto afetado, horário e justificativa; selecionar militares por RG. Preservar escala importada e efetivo após alteração separadamente.
12. Observações/alterações: texto livre, botão Não houve outras alterações.

## Regras herdadas
- Reconhecer ADJUNTO AO OF. DE DIA como função própria da escala; não confundir com Supervisor de Praia.
- Importar somente militares de serviço, nunca sobreaviso; preservar parser dos outros livros. Escala mais recente por data, Docs ou PDF; erro libera manual com justificativa.
- Assinatura manuscrita e senha; RG do usuário deve ser o Adjunto da escala ou substituição justificada registrada. Oficial de Dia do mesmo serviço dá visto e bloqueia edição. Major confere somente o livro do Oficial de Dia.
- Abrir livros existentes em leitura; botão Retificar livro para o autor antes do visto, invalidando assinatura anterior e preservando histórico.
- Disponível a praças individualmente, compilado mensal apenas para oficiais. Atualizar service_attestations como adjunto.
- PDFs diários, históricos e mensais somente sob demanda; nenhum armazenamento PDF. Timão, identidade visual e assinaturas no PDF.
- Rascunho recuperável, pendências antes da assinatura, resumo copiável para WhatsApp.
- Não copiar relatos, nomes manuscritos, números ou marcações das fotos como valores padrão.

## Validação necessária
Importação sem sobreaviso, permuta com RGs diferentes, impedimento de assinatura por usuário incompatível, substituição justificada, visto só do Oficial do dia, concorrência de versões, bloqueio pós-visto, permissões de exportação, PDFs e regressão dos quatro livros existentes.

# Órbita — preparação em Física

Estudo para o exame unificado de física e para a seleção do Doutorado.

Espaço pessoal em português brasileiro para a preparação de Matheus para o EUF e para os cenários de ingresso no doutorado da UFC em 2027.2 e 2028.1.

## Executar

Sirva a pasta `dist/` com qualquer servidor HTTP estático. Não abra `index.html` diretamente pelo protocolo file, pois o app carrega os dados iniciais com fetch.

Não há dependências nem etapa de build.

```bash
python -m http.server 8080 --directory dist
```

Abra http://localhost:8080. Testes: `node --test tests/model.test.mjs`.

## Recursos

- Trilhas por assunto, checklists editáveis e atividades associadas a materiais.
- Trilha integrada **Elétrica e Mecânica Analítica**, com fundamentos, conversão de energia, modelagem e controle de sistemas eletromecânicos.
- Roteiros originais de 25 e 51 semanas, preservados como referência.
- 60 materiais iniciais do acervo, listas com gabarito, simulados e videoaulas, mais 5 referências abertas da trilha eletromecânica.
- Registro de horas, acertos, erros e notas; gráficos calculados de registros reais.
- Comparação dos cenários, carga e datas editáveis, planejamento adaptativo.
- Calendário com distinção entre metas e prazos confirmados.
- Backup JSON com validação e prévia antes da substituição.

## Guia rápido

1. **Começar quando você decidir:** na **Visão geral**, clique em **Quero começar**, defina a data-base e confirme. O plano permanece em stand-by até essa ativação; nenhuma atividade é concluída automaticamente.
2. **Registrar uma sessão real:** use **Registrar estudo**, informe data, assunto, tempo estudado, questões tentadas e corretas, e clique em **Salvar registro**. Para estudo teórico, deixe as questões em zero. Em simulados com vários assuntos, crie um registro por assunto e divida o tempo total entre eles. Confira os resultados em **Desempenho**.
3. **Acompanhar as entregas:** em **Trilha de estudos**, marque o checklist quando concluir a atividade. Marcar ou desmarcar uma tarefa altera sua conclusão, mas **não registra horas**. Use **Nova atividade** para acrescentar uma entrega, estimar sua duração e associar um material.
4. **Ampliar o acervo:** em **Biblioteca → Adicionar material**, escolha tipo e assunto, informe o link do material e, quando houver, o **Link do gabarito (opcional)**. Registre capítulos e páginas nas observações. Listas e simulados também aparecem em **Exercícios e simulados**.
5. **Reajustar o caminho:** abra **Comparar cenários** para avaliar 2027.2 e 2028.1. Em **Ajustes e backup**, altere datas, carga semanal e metas; finalize em **Salvar e reajustar plano**. O **Plano ajustável** redistribui atividades pendentes e considera os resultados registrados. Em **Seleções e prazos**, mantenha a distinção entre estimativas e datas oficiais.
6. **Levar o progresso com você:** em **Ajustes e backup**, use **Exportar backup** no navegador de origem. No outro dispositivo, navegador ou endereço do site, use **Importar backup**, revise a prévia e confirme. A importação substitui os dados daquele navegador; exporte-os primeiro se precisar preservá-los. Isso também vale para migrar da versão anterior hospedada no ChatGPT para o GitHub Pages.

## Persistência

O armazenamento é local ao navegador, sob a chave `orbita-fisica-v1`. Não há conta de aplicativo, banco remoto, sincronização entre dispositivos ou integração contínua com o Google Drive. Exporte backups regularmente. A mudança de endereço de hospedagem exige exportar e importar o backup. O seed não é alterado pelas sessões locais.

Alterações feitas na interface — materiais, checklists, sessões, notas e configurações — são salvas apenas nesse navegador. Elas não criam commits nem alteram os arquivos do GitHub. Publicar uma nova versão do código também não sincroniza os registros entre dispositivos.

## Elétrica e Mecânica Analítica

Abra **Elétrica e Mecânica** no menu, a aba de mesmo nome em **Trilha de estudos**, ou [acesse a trilha diretamente](https://fobos123deimos.github.io/orbita-fisica/#eletromecanica).

O percurso reúne 7 blocos: base matemática e circuitos; mecânica analítica e eletromagnetismo; energia e conversão eletromecânica; modelos acoplados; estados, estabilidade e controle; Hamilton e passividade; acionamentos e modelos para pesquisa. Os 6 projetos conectam RLC e massa–mola, motor CC, solenoide, pêndulo acionado, limites do acionamento e controle por energia.

São 12 atividades novas e 9 atividades existentes reaproveitadas. O cenário 2027.2 inclui 8 das novas atividades (29 horas de primeira passagem); 2028.1 acrescenta 4 atividades de aprofundamento (21 horas adicionais). As atividades compartilhadas mantêm os mesmos checklists na trilha geral, no plano e no percurso integrado. Os 7 livros físicos associados continuam sendo os mesmos registros da biblioteca. A trilha é complementar à preparação e não define requisitos dos editais.

A atualização usa `applyContentPack` para acrescentar atividades e referências aos dados já salvos, sem substituir progresso, sessões, notas, configurações ou materiais personalizados. A marca `contentPacks` torna a aplicação idempotente: conteúdos editados são preservados e itens excluídos depois da atualização não reaparecem ao recarregar. A mesma atualização é aplicada à prévia de backups antigos antes da confirmação de importação. O estado de stand-by e as datas escolhidas são preservados.

## Fontes e interpretação

Dados iniciais importados em 18/11/2026 da planilha de estudos, mantida sem alterações. Livros adicionais confirmados nas conversas de 17/11/2026. Datas 2027/2028 são estimativas quando assim indicadas; confirme editais. EUF e doutorado UFC são frentes distintas. Provas do mestrado são material complementar, não prova de doutorado. Os materiais autorais estão identificados.

Horas-base de tarefas cobrem uma primeira passagem de competências; metas de 400/612 h incluem aprofundamento, exercícios e revisões. O usuário pode adicionar atividades para detalhar toda a carga. Não são computadas horas ao marcar checklists; use Registrar estudo.

## GitHub Pages

O código está no repositório público `fobos123deimos/orbita-fisica`.

Site publicado: [Abrir Órbita](https://fobos123deimos.github.io/orbita-fisica/).

Novos pushes para `main` publicam automaticamente quando alteram arquivos em `dist/**`, `tests/**` ou `.github/workflows/pages.yml`. O fluxo executa os testes (`node --test tests/model.test.mjs`) antes de publicar e só continua se a verificação passar. O conteúdo publicado é somente a pasta `dist/`.

A publicação manual continua disponível em **Actions → Publicar Órbita no GitHub Pages → Run workflow**. Alterações somente neste README não disparam uma publicação automática.

O site e o código-fonte são públicos. O conteúdo inicial inclui os links pessoais do Drive cuja publicação foi autorizada. As permissões dos arquivos no Drive continuam sendo respeitadas. Os registros pessoais de estudo permanecem somente no navegador e não fazem parte do código enviado.

Para migrar do endereço anterior, exporte o backup no Órbita atual e importe-o no novo endereço. A versão privada anterior continua disponível em https://orbita-fisica-matheus.teteu-orfeu.chatgpt.site.

## Estrutura

- `dist/index.html`: entrada.
- `dist/app.js`: interface e armazenamento.
- `dist/model.js`: cálculos, ordenação e validação de backups.
- `dist/seed.json`: dados iniciais.
- `dist/roadmaps.json`: roteiros de referência.
- `dist/electromechanics.json`: blocos, atividades, projetos e referências da trilha integrada.
- `dist/electromechanics-view.js`: interface da trilha com os registros compartilhados.
- `dist/electromechanics.css`: estilos responsivos da trilha integrada.
- `dist/style.css`: tema responsivo.
- `tests/model.test.mjs`: cenários, médias ponderadas, datas, importação e atualização aditiva dos dados.



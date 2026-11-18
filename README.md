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
- Roteiros originais de 25 e 51 semanas, preservados como referência.
- 60 materiais iniciais do acervo, listas com gabarito, simulados e videoaulas.
- Registro de horas, acertos, erros e notas; gráficos calculados de registros reais.
- Comparação dos cenários, carga e datas editáveis, planejamento adaptativo.
- Calendário com distinção entre metas e prazos confirmados.
- Backup JSON com validação e prévia antes da substituição.

## Persistência

O armazenamento é local ao navegador, sob a chave `orbita-fisica-v1`. Não há conta de aplicativo, banco remoto, sincronização entre dispositivos ou integração contínua com o Google Drive. Exporte backups regularmente. A mudança de endereço de hospedagem exige exportar e importar o backup. O seed não é alterado pelas sessões locais.

## Fontes e interpretação

Dados iniciais importados em 18/11/2026 da planilha de estudos, mantida sem alterações. Livros adicionais confirmados nas conversas de 17/11/2026. Datas 2027/2028 são estimativas quando assim indicadas; confirme editais. EUF e doutorado UFC são frentes distintas. Provas do mestrado são material complementar, não prova de doutorado. Os materiais autorais estão identificados.

Horas-base de tarefas cobrem uma primeira passagem de competências; metas de 400/612 h incluem aprofundamento, exercícios e revisões. O usuário pode adicionar atividades para detalhar toda a carga. Não são computadas horas ao marcar checklists; use Registrar estudo.

## GitHub Pages

O código está no repositório privado `fobos123deimos/orbita-fisica`. Para publicar, selecione **Settings → Pages → Source: GitHub Actions** e execute **Actions → Publicar Órbita no GitHub Pages → Run workflow**. O fluxo publica somente `dist/`. Novos commits não são publicados automaticamente; execute o workflow novamente após cada atualização.

O GitHub Pages comum publica um website público, mesmo quando o repositório de origem é privado. O conteúdo inicial inclui links pessoais do Drive; revise essa exposição antes de habilitar a publicação. As permissões dos arquivos no Drive continuam sendo respeitadas. Os registros pessoais de estudo permanecem somente no navegador e não fazem parte do código enviado.

Para migrar do endereço anterior, exporte o backup no Órbita atual e importe-o no novo endereço. Repositórios privados precisam de plano GitHub elegível para Pages. A publicação privada atual continua disponível em https://orbita-fisica-matheus.teteu-orfeu.chatgpt.site.


## Estrutura

- `dist/index.html`: entrada.
- `dist/app.js`: interface e armazenamento.
- `dist/model.js`: cálculos, ordenação e validação de backups.
- `dist/seed.json`: dados iniciais.
- `dist/roadmaps.json`: roteiros de referência.
- `dist/style.css`: tema responsivo.
- `tests/model.test.mjs`: cenários, médias ponderadas, datas e importação.

/** Reading, coursework and original activities share Órbita's existing state. */
const unique = values => [...new Set(values)];
const list = value => Array.isArray(value) ? value : value ? [value] : [];

function windowLabel(startDate, weeks) {
  if (!Array.isArray(weeks) || weeks.length !== 2) return 'Janela ajustável';
  const start = new Date(`${startDate}T12:00:00Z`);
  const first = new Date(start.getTime() + (weeks[0] - 1) * 7 * 86400000);
  const last = new Date(start.getTime() + (weeks[1] * 7 - 1) * 86400000);
  const format = date => new Intl.DateTimeFormat('pt-BR', {day:'2-digit', month:'short', year:'numeric', timeZone:'UTC'}).format(date);
  return `Janela sugerida · semanas ${weeks[0]}–${weeks[1]} · ${format(first)} a ${format(last)}`;
}

export function renderResearch(state, pathway, ui) {
  const {esc, fmt, badge, icon, link, taskRow, progress} = ui;
  const scenario = state.settings.scenario;
  const tasks = new Map(state.tasks.map(task => [task.id, task]));
  const materials = new Map(state.materials.map(material => [material.id, material]));
  const stages = list(pathway.stages);
  const relevant = task => task.scenario === 'both' || task.scenario === scenario;
  const selected = ids => unique(list(ids)).map(id => tasks.get(id)).filter(Boolean).filter(relevant);
  const allTasks = selected(stages.flatMap(stage => list(stage.taskIds)));
  const complete = allTasks.filter(task => task.done).length;
  const percent = allTasks.length ? Math.round(complete * 100 / allTasks.length) : 0;
  const hours = allTasks.filter(task => !task.done).reduce((total, task) => total + task.hours, 0);
  const quizIds = new Set(list(pathway.quizzes).map(quiz => quiz.id));
  const quizSessions = state.sessions.filter(session => quizIds.has(session.activityId));
  const compactSources = sources => list(sources).length ? `<div class="rs-sources"><strong>Fontes de apoio</strong>${list(sources).map((source, index) => link(typeof source === 'string' ? source : source.url, esc(typeof source === 'string' ? `Fonte ${index + 1}` : source.title || `Fonte ${index + 1}`))).join('')}</div>` : '';
  const paragraphs = text => `<p class="rs-text">${esc(text || '')}</p>`;
  const materialActions = (material, label) => `<div class="rs-actions">${link(material.url, label)}${link(material.answerUrl, 'Soluções da fonte')}<button class="text-link" data-action="edit-material" data-id="${esc(material.id)}">Anotar leitura</button></div>`;
  const taskForMaterial = id => allTasks.find(task => task.materialId === id);
  const readingCard = reading => {
    const material = materials.get(reading.materialId);
    if (!material) return '';
    const task = taskForMaterial(material.id);
    return `<article class="rs-reading">
      <div class="rs-reading-top">${badge(`Leitura ${reading.order}`, 'purple')}${reading.priority ? badge(reading.priority, 'muted') : ''}${task?.done ? badge('Concluída', 'green') : ''}</div>
      <h4>${esc(material.title)}</h4><p class="rs-byline">${esc(material.author || material.topic)}</p>
      <p><strong>Na proposta:</strong> ${esc(reading.why)}</p>
      <p><strong>Leia primeiro:</strong> ${esc(list(reading.readFirst).join(' · '))}</p>
      ${list(reading.prerequisites).length ? `<p><strong>Antes:</strong> ${esc(list(reading.prerequisites).join(' · '))}</p>` : ''}
      ${reading.caution ? `<p class="rs-reading-caution"><strong>Atenção às convenções:</strong> ${esc(reading.caution)}</p>` : ''}
      <div class="rs-deliverable"><strong>Ao terminar</strong>${paragraphs(reading.deliverable)}</div>
      <p class="rs-provenance">${esc(reading.provenance || 'Bibliografia selecionada')}${reading.sourceStatus ? ` · ${esc(reading.sourceStatus)}` : ''}</p>
      ${materialActions(material, /livro/i.test(material.type) ? 'Abrir leitura' : 'Abrir artigo')}${reading.openUrl && reading.openUrl !== material.url ? `<div class="rs-actions">${link(reading.openUrl, 'Versão aberta')}</div>` : ''}
    </article>`;
  };
  const courseCard = course => {
    const material = materials.get(course.materialId);
    if (!material) return '';
    const task = taskForMaterial(material.id);
    return `<article class="rs-course"><div class="rs-reading-top">${badge(`Curso / série ${course.order}`, 'purple')}${task?.done ? badge('Concluído', 'green') : badge('Professor M', 'muted')}</div>
      <h4>${esc(material.title)}</h4><p>${esc(course.why)}</p><p class="rs-provenance">${esc(material.type)}</p>
      <p><strong>Entrega:</strong> ${esc(course.deliverable)}</p>
      ${course.provenance ? `<p class="rs-provenance">${esc(course.provenance)}</p>` : ''}
      ${materialActions(material, 'Abrir curso')}
    </article>`;
  };
  const bookCard = book => {
    const material = materials.get(book.materialId);
    if (!material) return '';
    return `<article class="rs-book">${icon('book', 22)}<div><span class="rs-label">${esc(material.type)}</span><h4>${esc(material.title)}</h4>
      ${material.author ? `<p class="rs-byline">${esc(material.author)}</p>` : ''}
      <p>${esc(book.why)}</p><p><strong>Seleção:</strong> ${esc(book.selection || material.notes)}</p>
      ${book.provenance ? `<p class="rs-provenance">${esc(book.provenance)}</p>` : ''}
      ${materialActions(material, 'Abrir referência')}</div></article>`;
  };
  const lessonCard = lesson => `<details class="rs-lesson"><summary>${icon('note', 20)}<span><span class="rs-label">Material autoral do Órbita</span><strong>${esc(lesson.title)}</strong></span><span class="rs-chevron" aria-hidden="true">⌄</span></summary>
    <div class="rs-lesson-body">${list(lesson.sections).map(section => `<section><h5>${esc(section.heading)}</h5>${paragraphs(section.text)}</section>`).join('')}
      ${lesson.workedExample ? `<section class="rs-example"><h5>Exemplo resolvido</h5>${paragraphs(lesson.workedExample.question)}<div class="rs-solution">${paragraphs(lesson.workedExample.solution)}</div></section>` : ''}
      ${list(lesson.exercises).length ? `<section><h5>Pratique antes de abrir a solução</h5>${list(lesson.exercises).map((exercise, index) => `<article class="rs-exercise"><p><strong>Exercício ${index + 1}.</strong> ${esc(exercise.question)}</p><details class="rs-answer"><summary>Ver solução comentada</summary>${paragraphs(exercise.solution)}</details></article>`).join('')}</section>` : ''}
      ${compactSources(lesson.sources)}
    </div></details>`;
  const quizCard = quiz => {
    const attempts = quizSessions.filter(session => session.activityId === quiz.id);
    const latest = [...attempts].reverse().sort((a, b) => b.date.localeCompare(a.date)).at(0);
    return `<article class="rs-quiz-card"><div class="rs-quiz-icon">${icon('list', 24)}</div><div><span class="rs-label">Questionário autoral · ${quiz.questions.length} questões</span><h4>${esc(quiz.title)}</h4>
      <p>Responda, confira a explicação de cada alternativa correta e salve o resultado no seu desempenho.</p>
      ${latest ? `<p class="rs-result">Último registro: <strong>${latest.correct}/${latest.total}</strong> · ${attempts.length} ${attempts.length === 1 ? 'tentativa salva' : 'tentativas salvas'}</p>` : '<p class="rs-provenance">Nenhuma tentativa salva.</p>'}
      <button class="button primary" data-action="research-quiz" data-id="${esc(quiz.id)}">Responder questionário</button>
    </div></article>`;
  };
  const labCard = lab => `<details class="rs-lesson rs-lab"><summary>${icon('target', 20)}<span><span class="rs-label">Laboratório autoral</span><strong>${esc(lab.title)}</strong></span><span class="rs-chevron" aria-hidden="true">⌄</span></summary>
    <div class="rs-lesson-body">${paragraphs(lab.objective)}<h5>Procedimento</h5><ol>${list(lab.steps).map(step => `<li>${esc(step)}</li>`).join('')}</ol>
      <h5>Verificações</h5><ul>${list(lab.checks).map(check => `<li>${esc(check)}</li>`).join('')}</ul>
      <div class="rs-deliverable"><strong>Resultado esperado e interpretação</strong>${paragraphs(lab.expectedResult)}</div>${compactSources(lab.sources)}</div></details>`;
  const stageCards = stages.map((stage, index) => {
    const current = selected(stage.taskIds);
    const done = current.filter(task => task.done).length;
    const ratio = current.length ? Math.round(done * 100 / current.length) : 0;
    const readings = list(pathway.readings).filter(item => item.stageId === stage.id).sort((a, b) => a.order - b.order);
    const courses = list(pathway.courses).filter(item => item.stageId === stage.id).sort((a, b) => a.order - b.order);
    const books = list(pathway.books).filter(item => item.stageId === stage.id);
    const lessons = list(pathway.lessons).filter(item => item.stageId === stage.id);
    const quizzes = list(pathway.quizzes).filter(item => item.stageId === stage.id);
    const labs = list(pathway.labs).filter(item => item.stageId === stage.id);
    const displayedMaterialIds = new Set([...readings, ...courses, ...books, ...lessons, ...quizzes, ...labs].flatMap(item => [item.materialId, item.id]).filter(Boolean));
    const otherMaterials = unique(list(stage.materialIds)).filter(id => !displayedMaterialIds.has(id)).map(id => materials.get(id)).filter(Boolean);
    const prerequisiteNames = list(stage.prerequisites).map(id => stages.find(item => item.id === id)?.title || id);
    const other = unique(list(stage.taskIds)).map(id => tasks.get(id)).filter(Boolean).filter(task => !relevant(task));
    return `<details class="rs-stage" data-research-stage="${esc(stage.id)}" ${index === 0 ? 'open' : ''}><summary>
      <span class="rs-stage-mark">${icon(index < 2 ? 'book' : index < 4 ? 'route' : 'target', 24)}</span>
      <span class="rs-stage-title"><span class="rs-label">${esc(windowLabel(state.settings.startDate, stage.windows?.[scenario]))}</span><strong>${esc(stage.title)}</strong><span class="rs-stage-meta">${readings.length} leituras · ${courses.length} cursos · ${done}/${current.length} atividades</span></span>
      <span class="rs-stage-progress">${ratio}%${progress(ratio)}</span><span class="rs-chevron" aria-hidden="true">⌄</span></summary>
      <div class="rs-stage-body"><p>${esc(stage.description)}</p>${prerequisiteNames.length ? `<p class="rs-prerequisite"><strong>Base recomendada:</strong> ${esc(prerequisiteNames.join(' · '))}</p>` : ''}
        ${courses.length ? `<section class="rs-section"><h3>Cursos para construir a base</h3><div class="rs-card-grid">${courses.map(courseCard).join('')}</div><p class="rs-provenance">As horas dos checklists são sessões sugeridas, não durações oficiais. Problem sets podem exigir login na plataforma. Blocos propostos pelo Órbita estão identificados no tipo do material.</p></section>` : ''}
        ${readings.length ? `<section class="rs-section"><h3>Leituras em sequência</h3><div class="rs-card-grid">${readings.map(readingCard).join('')}</div></section>` : ''}
        ${books.length ? `<section class="rs-section"><h3>Livros e materiais de apoio</h3><div class="rs-books">${books.map(bookCard).join('')}</div></section>` : ''}
        ${lessons.length || quizzes.length || labs.length ? `<section class="rs-section"><h3>Estude e pratique aqui</h3><div class="rs-learning">${lessons.map(lessonCard).join('')}${quizzes.map(quizCard).join('')}${labs.map(labCard).join('')}</div></section>` : ''}
        ${otherMaterials.length ? `<section class="rs-section"><h3>Outras fontes deste bloco</h3><div class="rs-companions">${otherMaterials.map(material => `<article class="rs-companion"><span class="rs-label">${esc(material.type)}</span><h4>${esc(material.title)}</h4>${material.author ? `<p>${esc(material.author)}</p>` : ''}<div class="rs-actions">${link(material.url, 'Abrir fonte')}<button class="text-link" data-action="edit-material" data-id="${esc(material.id)}">Ver material e anotações</button></div></article>`).join('')}</div></section>` : ''}
        <section class="rs-section"><h3>Entregas no seu planejamento</h3><p class="rs-prerequisite">Use o título da atividade para guardar fichamentos e evidências. Marcar conclusão não registra horas.</p><div class="rs-checklist">${current.map(task => taskRow(task)).join('') || '<p class="rs-empty">Nenhuma atividade vinculada disponível neste cenário.</p>'}</div>
        ${other.length ? `<p class="rs-other-scenario">${other.length} atividades adicionais estão no outro cenário. Troque o ingresso no topo para consultá-las.</p>` : ''}</section>
      </div></details>`;
  }).join('');
  return `<div class="rs-pathway"><section class="rs-intro"><div><span class="rs-kicker">DA LEITURA À DEFESA</span><h2>${esc(pathway.title || 'Pesquisa e leituras')}</h2><p>${esc(pathway.intro)}</p><div class="rs-tags"><span>Fundamentos</span><span>Reprodução numérica</span><span>Argumentação científica</span></div></div><div class="rs-progress-card"><span class="rs-label">Percurso · ${esc(scenario)}</span><strong>${percent}<span>%</span></strong>${progress(percent)}<p>${complete} de ${allTasks.length} atividades concluídas</p></div></section>
    <div class="rs-metrics"><div><strong>${list(pathway.readings).length}</strong><span>leituras selecionadas</span></div><div><strong>${list(pathway.courses).length}</strong><span>cursos e aulas do Professor M</span></div><div><strong>${fmt(hours, 1)} h</strong><span>estimativa de atividades pendentes</span></div></div>
    <section class="rs-guidance">${icon('calendar', 24)}<div><h3>Seu ritmo para ${esc(scenario)}</h3><p>${esc(pathway.scenarioGuidance?.[scenario] || '')}</p><p>As janelas abaixo partem da data-base configurada. São sugestões de sequência; o Plano ajustável distribui as atividades conforme sua carga. As horas são estimativas do Órbita para estudo e exercícios. O planejamento continua ${state.settings.status === 'standby' ? 'em stand-by' : 'em andamento'}.</p></div></section>
    <section class="rs-method"><h3>Como transformar leitura em domínio</h3><ol><li><strong>Preparar</strong><span>Revise os pré-requisitos e faça as aulas indicadas.</span></li><li><strong>Reconstruir</strong><span>Refaça uma derivação e explicite as hipóteses.</span></li><li><strong>Testar</strong><span>Resolva, reproduza e compare com um controle.</span></li><li><strong>Defender</strong><span>Registre a ligação com o projeto e uma limitação.</span></li></ol></section>
    <div class="rs-section-heading"><div><h2>Uma sequência para sua proposta</h2><p>Abra cada etapa para acessar artigos, cursos, materiais autorais e entregas.</p></div><span>${stages.length} etapas</span></div><div class="rs-stages">${stageCards}</div>
    <section class="rs-notes-guide"><h3>Seu fichamento, ligado à atividade</h3><p>Em cada leitura, registre: problema; hipóteses; convenções; equação central; resultado reproduzido; limitações; contribuição para sua proposta; dúvidas para a arguição. Use <strong>Anotar leitura</strong> para notas da referência ou clique no título da atividade para registrar a entrega.</p><p>Os resultados dos questionários salvos aparecem em <strong>Desempenho</strong>. O tempo de estudo é registrado separadamente, e as tentativas não concluem leituras automaticamente.</p></section>
    <p class="rs-scope">${esc(pathway.scopeNote || 'Seleção orientada à proposta e ao acervo consultado. Leituras e atividades são ajustáveis conforme seus resultados.')}</p></div>`;
}

/** Answers are integer option indexes; never coerce a missing answer into zero. */
export function gradeQuiz(quiz, answers) {
  const details = quiz.questions.map(question => {
    const raw = answers[`q-${question.id}`];
    if (raw === undefined || raw === null || !/^\d+$/.test(String(raw))) throw new Error('Responda todas as questões antes de corrigir.');
    const selected = Number(raw);
    if (!Number.isInteger(selected) || selected < 0 || selected >= question.options.length) throw new Error('Uma resposta contém uma alternativa inválida.');
    return {id:question.id, selected, answer:question.answer, correct:selected === question.answer};
  });
  return {correct:details.filter(item => item.correct).length, total:details.length, details};
}

export function renderQuizBody(quiz, ui) {
  const {esc} = ui;
  return `<div class="rs-quiz-form"><p class="rs-quiz-instructions">Questionário autoral do Órbita. Responda sem consultar o gabarito; ao corrigir, você poderá revisar as explicações antes de salvar o resultado.</p>${quiz.questions.map((question, index) => `<fieldset class="rs-question"><legend>${index + 1}. ${esc(question.prompt)}</legend><div class="rs-options">${question.options.map((option, optionIndex) => `<label class="rs-option"><input type="radio" name="q-${esc(question.id)}" value="${optionIndex}" required><span><strong>${String.fromCharCode(65 + optionIndex)}.</strong> ${esc(option)}</span></label>`).join('')}</div></fieldset>`).join('')}<p class="rs-quiz-instructions">Esta tentativa não ativa o plano nem marca atividades como concluídas. As horas são registradas separadamente.</p></div>`;
}

export function renderQuizFeedback(quiz, answers, ui) {
  const {esc, badge} = ui;
  const result = gradeQuiz(quiz, answers);
  return `<div class="rs-quiz-feedback"><div class="rs-feedback-score"><strong>${result.correct}/${result.total}</strong><span>questões corretas</span></div><p>Confira as justificativas. Salve esta tentativa para incluí-la no desempenho; cancelar mantém o histórico como está.</p>${quiz.questions.map((question, index) => {
    const detail = result.details[index];
    return `<section class="rs-feedback-item">${badge(detail.correct ? 'Correta' : 'Revisar', detail.correct ? 'green' : 'orange')}<h3>${index + 1}. ${esc(question.prompt)}</h3><p><strong>Sua resposta:</strong> ${esc(question.options[detail.selected])}</p><p><strong>Resposta correta:</strong> ${esc(question.options[question.answer])}</p><div class="rs-feedback-explanation"><strong>Por quê?</strong><p>${esc(question.explanation)}</p></div></section>`;
  }).join('')}</div>`;
}

/** One sequence for all study activities. Completion and notes use the existing records. */
const list = value => Array.isArray(value) ? value : value ? [value] : [];
const unique = values => [...new Set(values.filter(Boolean))];
const belongs = (task, scenario) => task.scenario === 'both' || task.scenario === scenario;

function windowLabel(startDate, weeks) {
  if (!Array.isArray(weeks) || weeks.length !== 2) return 'Janela ajustável';
  const start = new Date(`${startDate}T12:00:00Z`).getTime();
  const format = day => new Intl.DateTimeFormat('pt-BR', {day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(day));
  return `Semanas ${weeks[0]}–${weeks[1]} · ${format(start + (weeks[0] - 1) * 7 * 86400000)} a ${format(start + (weeks[1] * 7 - 1) * 86400000)}`;
}

/** Locate site-authored content independently from the learner's checklist. */
export function findOriginalMaterial(research, id) {
  for (const [kind, collection] of [['lesson',research.lessons],['quiz',research.quizzes],['lab',research.labs]]) {
    const item = list(collection).find(item => item.materialId === id || item.id === id);
    if (item) return {kind,item};
  }
  return null;
}

/** Only built-in placeholder links become study buttons; edited external links remain links. */
export function originalMaterialAction(material, research, url = material?.url) {
  if (!material || !findOriginalMaterial(research,material.id)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.origin !== 'https://fobos123deimos.github.io' || parsed.pathname !== '/orbita-fisica/' || parsed.hash !== '#pesquisa') return null;
  } catch { return null; }
  return {action:'study-material',id:material.id};
}

/** Shared by the integrated step and the library reader; never recreates a record. */
export function renderOriginalMaterial(state, research, id, ui, expanded = false) {
  const material = state.materials.find(material => material.id === id);
  const original = findOriginalMaterial(research,id);
  if (!material || !original) return '';
  const {esc,icon,link} = ui;
  const paragraph = value => `<p class="ut-text">${esc(value || '')}</p>`;
  const sources = values => list(values).length ? `<div class="ut-sources"><span>Fontes de apoio</span>${list(values).map((source,index) => link(typeof source === 'string' ? source : source.url,esc(typeof source === 'string' ? `Fonte ${index + 1}` : source.title || `Fonte ${index + 1}`))).join('')}</div>` : '';
  const title = material.title || original.item.title;
  if (original.kind === 'lesson') {
    const lesson = original.item;
    return `<details class="ut-content-details" ${expanded ? 'open' : ''}><summary>${icon('note',18)}<span>Estudar aqui: ${esc(title)}</span><span aria-hidden="true">⌄</span></summary><div class="ut-lesson-body">${list(lesson.sections).map(section => `<section><h4>${esc(section.heading)}</h4>${paragraph(section.text)}</section>`).join('')}${lesson.workedExample ? `<section class="ut-example"><h4>Exemplo resolvido</h4>${paragraph(lesson.workedExample.question)}<div class="ut-solution">${paragraph(lesson.workedExample.solution)}</div></section>` : ''}${list(lesson.exercises).map((exercise,index) => `<section class="ut-exercise"><h4>Exercício ${index + 1}</h4>${paragraph(exercise.question)}<details class="ut-answer"><summary>Ver solução comentada</summary>${paragraph(exercise.solution)}</details></section>`).join('')}${sources(lesson.sources)}</div></details>`;
  }
  if (original.kind === 'lab') {
    const lab = original.item;
    return `<details class="ut-content-details" ${expanded ? 'open' : ''}><summary>${icon('target',18)}<span>Executar o laboratório: ${esc(title)}</span><span aria-hidden="true">⌄</span></summary><div class="ut-lesson-body">${paragraph(lab.objective)}<h4>Procedimento</h4><ol>${list(lab.steps).map(step => `<li>${esc(step)}</li>`).join('')}</ol><h4>Verificações</h4><ul>${list(lab.checks).map(check => `<li>${esc(check)}</li>`).join('')}</ul><div class="ut-example"><h4>Resultado esperado e interpretação</h4>${paragraph(lab.expectedResult)}</div>${sources(lab.sources)}</div></details>`;
  }
  const quiz = original.item;
  const attempts = state.sessions.filter(session => session.activityId === quiz.id);
  const latest = [...attempts].reverse().sort((a,b) => b.date.localeCompare(a.date))[0];
  return `<div class="ut-quiz"><div><strong>${esc(title)}</strong><p>${quiz.questions.length} questões autorais com correção comentada. Salve o resultado para acompanhar o desempenho.</p>${latest ? `<p class="ut-muted">Último registro: ${latest.correct}/${latest.total} · ${attempts.length} ${attempts.length === 1 ? 'tentativa salva' : 'tentativas salvas'}.</p>` : ''}</div><button type="button" class="button primary" data-action="research-quiz" data-id="${esc(quiz.id)}">Responder questionário</button></div>`;
}

export function renderUnifiedTrail(state, curriculum, resources, ui) {
  const {esc,fmt,badge,icon,link,taskRow,progress} = ui;
  const research = resources.research || {}, electromechanics = resources.electromechanics || {};
  const scenario = state.settings.scenario;
  const tasks = new Map(state.tasks.map(task => [task.id,task]));
  const materials = new Map(state.materials.map(material => [material.id,material]));
  const phases = list(curriculum.phases);
  const all = state.tasks.filter(task => belongs(task,scenario));
  const completed = all.filter(task => task.done).length;
  const percent = all.length ? Math.round(100 * completed / all.length) : 0;
  const remaining = all.filter(task => !task.done).reduce((sum,task) => sum + task.hours,0);
  const schedule = typeof ui.plan === 'function' ? ui.plan(state,scenario) : [];
  const planned = new Map(schedule.map(task => [task.id,task]));
  const lookup = (collection,id) => list(collection).find(item => item.materialId === id || item.id === id);
  const paragraph = value => `<p class="ut-text">${esc(value || '')}</p>`;
  const materialActions = (material,label='Abrir material') => `<div class="ut-actions">${link(material.url,label)}${material.answerUrl && material.answerUrl !== material.url ? link(material.answerUrl,'Consultar soluções') : ''}<button class="text-link" data-action="edit-material" data-id="${esc(material.id)}">Anotar neste material</button></div>`;
  const materialContent = id => {
    const material = materials.get(id);
    if (!material) return '';
    const reading = lookup(research.readings,id), course = lookup(research.courses,id), book = lookup(research.books,id);
    if (findOriginalMaterial(research,id)) return renderOriginalMaterial(state,research,id,ui);
    let description = '';
    if (reading) description = `<p><strong>Leia primeiro:</strong> ${esc(list(reading.readFirst).join(' · '))}</p><p><strong>Relação com a proposta:</strong> ${esc(reading.why)}</p>${reading.caution ? `<p class="ut-caution"><strong>Ao comparar:</strong> ${esc(reading.caution)}</p>` : ''}<p><strong>Entrega:</strong> ${esc(reading.deliverable)}</p><p class="ut-muted">${esc(reading.provenance || '')}${reading.sourceStatus ? ` · ${esc(reading.sourceStatus)}` : ''}</p>`;
    else if (course) description = `<p>${esc(course.why)}</p><p><strong>Concluir:</strong> ${esc(course.deliverable)}</p><p class="ut-muted">${esc(material.type)}. As horas são estimativas ajustáveis de estudo; confira o acesso na plataforma.</p>`;
    else if (book) description = `<p><strong>Trecho de apoio:</strong> ${esc(book.selection || material.notes)}</p><p>${esc(book.why)}</p><p class="ut-muted">${esc(book.provenance || '')}</p>`;
    else description = material.notes ? `<p>${esc(material.notes)}</p>` : '';
    return `<details class="ut-material"><summary><span>${icon(course ? 'spark' : 'book',17)}<span>${esc(material.title)}</span></span><span class="ut-material-kind">${esc(material.type)}</span></summary><div class="ut-material-body">${material.author ? `<p class="ut-byline">${esc(material.author)}</p>` : ''}${description}${materialActions(material,course ? 'Abrir curso ou aula' : reading ? 'Abrir leitura' : 'Abrir material')}${reading?.openUrl && reading.openUrl !== material.url ? `<div class="ut-actions">${link(reading.openUrl,'Versão aberta')}</div>` : ''}</div></details>`;
  };
  let sequence = 0;
  const renderStep = step => {
    const task = tasks.get(step.taskId);
    if (!task || !belongs(task,scenario)) return '';
    const ordinal = ++sequence;
    const ids = unique([task.materialId,...list(step.materialIds)]);
    const projects = list(electromechanics.projects).filter(project => list(project.taskIds).includes(task.id));
    const primary = materials.get(task.materialId);
    const kind = step.kind || (lookup(research.quizzes,task.materialId) ? 'Verificar compreensão' : lookup(research.lessons,task.materialId) ? 'Estudo guiado' : lookup(research.courses,task.materialId) ? 'Curso e prática' : lookup(research.readings,task.materialId) ? 'Leitura e fichamento' : projects.length ? 'Aplicação' : primary?.type || 'Fundamento e prática');
    return `<article class="ut-step ${task.done ? 'ut-step-done' : ''}" id="atividade-${esc(task.id)}" data-trail-task="${esc(task.id)}"><div class="ut-step-meta"><span>Passo ${ordinal}</span>${badge(kind,'muted')}</div>${taskRow(planned.get(task.id) || task,planned.has(task.id))}${step.why ? `<p class="ut-connection">${esc(step.why)}</p>` : ''}${ids.length ? `<div class="ut-step-materials">${ids.map(materialContent).join('')}</div>` : ''}${projects.map(project => `<details class="ut-content-details ut-project"><summary>${icon('target',18)}<span>Aplicar em ${esc(project.title)}</span><span aria-hidden="true">⌄</span></summary><div class="ut-lesson-body">${paragraph(project.description)}<p><strong>Entrega do projeto:</strong> ${esc(project.deliverable)}</p></div></details>`).join('')}<div class="ut-step-footer"><button class="text-link" data-action="edit-task" data-id="${esc(task.id)}">Registrar entrega e dúvidas</button></div></article>`;
  };
  const availablePhases = phases.map(phase => ({phase,steps:list(phase.steps).filter(step => tasks.has(step.taskId) && belongs(tasks.get(step.taskId),scenario))})).filter(item => item.steps.length);
  const firstPending = availablePhases.find(item => item.steps.some(step => !tasks.get(step.taskId).done))?.phase.id || availablePhases[0]?.phase.id;
  const phaseHtml = availablePhases.map(({phase,steps}) => {
    const done = steps.filter(step => tasks.get(step.taskId).done).length;
    const ratio = Math.round(done * 100 / steps.length);
    const phaseHours = steps.filter(step => !tasks.get(step.taskId).done).reduce((sum,step) => sum + tasks.get(step.taskId).hours,0);
    return `<details class="ut-phase" data-trail-phase="${esc(phase.id)}" ${phase.id === firstPending ? 'open' : ''}><summary><span class="ut-phase-mark">${icon('route',22)}</span><span class="ut-phase-title"><span class="ut-label">${esc(windowLabel(state.settings.startDate,phase.windows?.[scenario]))}</span><strong>${esc(phase.title)}</strong><span class="ut-phase-meta">${done}/${steps.length} atividades concluídas · ${fmt(phaseHours,1)} h pendentes</span></span><span class="ut-phase-progress">${ratio}%${progress(ratio)}</span><span class="ut-chevron" aria-hidden="true">⌄</span></summary><div class="ut-phase-body"><p class="ut-phase-description">${esc(phase.description)}</p><div class="ut-steps">${steps.map(renderStep).join('')}</div></div></details>`;
  }).join('');
  const knownIds = new Set(phases.flatMap(phase => list(phase.steps).map(step => step.taskId)));
  const custom = all.filter(task => !knownIds.has(task.id));
  const guide = typeof curriculum.guide === 'string' ? curriculum.guide : curriculum.guide?.[scenario] || '';
  return `<div class="ut-pathway"><section class="ut-intro"><div><span class="ut-kicker">UM PERCURSO · DO FUNDAMENTO À DEFESA</span><h2>${esc(curriculum.title || 'Sua trilha integrada')}</h2><p>${esc(curriculum.intro || 'Estude os fundamentos e aplique cada ideia no momento certo: livros, cursos, artigos, exercícios e projetos fazem parte da mesma sequência.')}</p><p class="ut-intro-foot">O ingresso ${esc(scenario)} define o ritmo desta trilha. O avanço é o mesmo em todas as atividades.</p></div><div class="ut-progress-card"><span>Progresso da trilha</span><strong>${percent}<span>%</span></strong>${progress(percent)}<p>${completed} de ${all.length} atividades concluídas</p></div></section><section class="ut-pacing"><div>${icon('calendar',22)}<span><strong>${esc(scenario)} · ${fmt(state.settings.scenarios[scenario].hours,1)} h por semana</strong><span>Janelas sugeridas a partir da sua data-base</span></span></div><div><strong>${fmt(remaining,1)} h</strong><span>estimadas nas atividades pendentes</span></div></section><div class="ut-guidance"><p>${guide ? esc(guide) : 'Siga os passos dentro de cada etapa: a explicação, a leitura e a prática aparecem junto da atividade correspondente. Abra o material para estudar, resolva os exercícios e registre a entrega antes de avançar.'}</p><p>As estimativas se ajustam à sua carga e aos pré-requisitos. Os aprofundamentos aparecem ao escolher o ritmo 2028.1. O planejamento permanece ${state.settings.status === 'standby' ? 'em stand-by' : 'em andamento'}; marque apenas o que concluiu.</p></div><div class="ut-phases">${phaseHtml}</div>${custom.length ? `<section class="ut-custom"><h2>Atividades que você acrescentou</h2><p>Estas atividades também contam no seu progresso e no planejamento.</p><div class="ut-steps">${custom.map(task => renderStep({taskId:task.id})).join('')}</div></section>` : ''}<p class="ut-footer-note">Conclusão, anotações e resultados usam seus registros existentes. O resultado dos questionários é salvo explicitamente; horas de estudo são registradas separadamente.</p></div>`;
}

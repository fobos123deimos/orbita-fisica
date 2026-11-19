/** The integrated pathway uses the same tasks and materials as the rest of Órbita. */
export function renderElectromechanics(state, pathway, ui) {
  const {esc, fmt, badge, icon, link, taskRow, progress} = ui;
  const scenario = state.settings.scenario;
  const tasks = new Map(state.tasks.map(task => [task.id, task]));
  const materials = new Map(state.materials.map(material => [material.id, material]));
  const relevant = task => task.scenario === 'both' || task.scenario === scenario;
  const unique = values => [...new Set(values)];
  const selectedTasks = ids => unique(ids).map(id => tasks.get(id)).filter(Boolean).filter(relevant);
  const pathwayTasks = selectedTasks(pathway.stages.flatMap(stage => stage.taskIds));
  const completed = pathwayTasks.filter(task => task.done).length;
  const percent = pathwayTasks.length ? Math.round(100 * completed / pathwayTasks.length) : 0;
  const remainingHours = pathwayTasks.filter(task => !task.done).reduce((sum, task) => sum + task.hours, 0);
  const existingIds = new Set(pathway.tasks.map(task => task.id));
  const reused = pathwayTasks.filter(task => !existingIds.has(task.id)).length;
  const materialButton = (id, compact = false) => {
    const material = materials.get(id);
    if (!material) return '';
    return `<article class="em-material ${compact ? 'em-material-compact' : ''}">
      <span class="em-material-icon">${icon(material.type === 'Livro físico' ? 'book' : 'note', 20)}</span>
      <div><span class="em-label">${esc(material.type)}</span>
        <h3><button class="plain-title" data-action="edit-material" data-id="${esc(id)}">${esc(material.title)}</button></h3>
        <p>${esc(material.author || material.topic)}</p>
        <div class="em-material-actions">${link(material.url, 'Abrir material')}${link(material.answerUrl, 'Ver soluções')}
          <button class="text-link" data-action="edit-material" data-id="${esc(id)}">Anotar leitura</button>
        </div>
      </div>
    </article>`;
  };

  const stageCards = pathway.stages.map((stage, index) => {
    const current = selectedTasks(stage.taskIds);
    const done = current.filter(task => task.done).length;
    const available = unique(stage.taskIds).map(id => tasks.get(id)).filter(Boolean);
    const outside = available.filter(task => !relevant(task));
    const ratio = current.length ? Math.round(100 * done / current.length) : 0;
    const prerequisiteNames = (stage.prerequisites || []).map(id => pathway.stages.find(item => item.id === id)?.title).filter(Boolean);
    const resources = unique(stage.materialIds).map(id => materials.get(id)).filter(Boolean);
    return `<details class="em-stage" data-em-stage="${esc(stage.id)}" ${index === 0 ? 'open' : ''}>
      <summary>
        <span class="em-stage-icon">${icon(stage.type === 'Aprofundamento' ? 'spark' : stage.type === 'Integração' ? 'route' : 'book', 22)}</span>
        <div class="em-stage-heading"><span class="em-label">${esc(stage.type)}</span><h3>${esc(stage.title)}</h3>
          <span class="em-stage-count">${current.length ? `${done} de ${current.length} atividades concluídas` : outside.length ? 'Aprofundamento no outro cenário' : 'Nenhuma atividade vinculada disponível'}</span>
        </div>
        <span class="em-stage-progress">${current.length ? `${ratio}%` : esc(outside[0]?.scenario || '—')}${progress(ratio)}</span>
        <span class="em-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="em-stage-content">
        <p>${esc(stage.description)}</p>
        <ul class="em-objectives">${stage.objectives.map(objective => `<li>${esc(objective)}</li>`).join('')}</ul>
        ${prerequisiteNames.length ? `<p class="em-prerequisites"><strong>Base recomendada:</strong> ${esc(prerequisiteNames.join(' · '))}</p>` : ''}
        <div class="em-checklist">${current.map(task => taskRow(task)).join('') || `<p class="em-empty">${outside.length ? 'As atividades deste bloco estão sugeridas para o outro cenário.' : 'As atividades vinculadas a este bloco foram removidas do seu planejamento.'}</p>`}</div>
        ${outside.length ? `<div class="em-scenario-note"><p>${outside.length} ${outside.length === 1 ? 'atividade complementar disponível' : 'atividades complementares disponíveis'} no cenário ${esc(outside[0].scenario)}.</p><button class="button secondary small" data-action="scenario" data-id="${esc(outside[0].scenario)}">Ver cenário ${esc(outside[0].scenario)}</button></div>` : ''}
        ${resources.length ? `<div class="em-stage-resources"><h4>Materiais para este bloco</h4><div>${resources.map(material => `<button class="em-resource-button" data-action="edit-material" data-id="${esc(material.id)}">${icon('book', 15)} ${esc(material.title)}</button>`).join('')}</div></div>` : ''}
      </div>
    </details>`;
  }).join('');

  const projectCards = pathway.projects.map(project => {
    const current = selectedTasks(project.taskIds);
    const available = unique(project.taskIds).map(id => tasks.get(id)).filter(Boolean);
    const done = available.filter(task => task.done).length;
    const outside = available.filter(task => !relevant(task));
    const anotherScenario = (outside.find(task => !task.done) || outside[0])?.scenario;
    const first = current.find(task => !task.done) || (outside.some(task => !task.done) ? null : current[0]);
    return `<article class="em-project">
      <div class="em-project-top">${badge(project.level, 'purple')}${available.length ? badge(`${done}/${available.length} concluídas`, done === available.length ? 'green' : 'muted') : badge('Atividade removida', 'muted')}</div>
      <h3>${esc(project.title)}</h3><p>${esc(project.description)}</p>
      <div class="em-project-deliverable"><strong>Entrega</strong><p>${esc(project.deliverable)}</p></div>
      ${outside.length ? `<p class="em-label">${outside.length} ${outside.length === 1 ? 'atividade deste projeto está' : 'atividades deste projeto estão'} no cenário ${esc(anotherScenario)}.</p>` : ''}
      ${first ? `<button class="button secondary" data-action="edit-task" data-id="${esc(first.id)}">Ver atividade</button>` : anotherScenario ? `<button class="button secondary" data-action="scenario" data-id="${esc(anotherScenario)}">Ver cenário ${esc(anotherScenario)}</button>` : ''}
    </article>`;
  }).join('');

  const resourceIds = unique(pathway.materials.map(material => material.id));
  return `<div class="em-pathway">
    <section class="em-intro">
      <div class="em-intro-copy"><span class="em-kicker">TRILHA INTEGRADA · FÍSICA E ENGENHARIA</span>
        <h2>${esc(pathway.subtitle)}</h2><p>${esc(pathway.intro)}</p>
        <div class="em-domain-tags"><span>Mecânica analítica</span><span>Eletromagnetismo</span><span>Modelagem e controle</span></div>
      </div>
      <div class="em-progress-card"><span class="em-label">Seu percurso · ${esc(scenario)}</span><strong>${percent}<span>%</span></strong>${progress(percent)}
        <p>${completed} de ${pathwayTasks.length} atividades concluídas</p>
      </div>
    </section>
    <div class="em-metrics">
      <div><strong>${pathwayTasks.length}</strong><span>atividades neste cenário</span></div>
      <div><strong>${reused}</strong><span>atividades da base de Física reaproveitadas</span></div>
      <div><strong>${fmt(remainingHours, 1)} h</strong><span>estimativa das atividades pendentes</span></div>
    </div>
    <section class="em-guidance"><span class="em-guidance-icon">${icon('target', 22)}</span><div>
      <h3>Como seguir no cenário ${esc(scenario)}</h3><p>${esc(pathway.scenarioGuidance[scenario])}</p>
      <p class="em-guidance-foot">As atividades e os materiais são compartilhados com a Trilha de estudos, a Biblioteca e o Plano ajustável. Marque a conclusão aqui e registre as horas de estudo pelo botão Registrar estudo.</p>
    </div></section>
    <div class="em-section-heading"><div><h2>Do fundamento ao sistema completo</h2><p>Estude elétrica e mecânica em paralelo e reúna as duas nos projetos.</p></div><span>${pathway.stages.length} blocos conectados</span></div>
    <div class="em-stages">${stageCards}</div>
    <div class="em-section-heading"><div><h2>Projetos que conectam a teoria</h2><p>Derive, simule, confira as hipóteses e interprete cada resultado.</p></div></div>
    <div class="em-projects">${projectCards}</div>
    <section class="em-study-method"><h2>Um método para cada sistema</h2><ol>
      <li><strong>Descrever</strong><span>Componentes, entradas, saídas e hipóteses.</span></li>
      <li><strong>Derivar</strong><span>Balanços físicos e formulação energética.</span></li>
      <li><strong>Simular</strong><span>Condições iniciais e variação dos parâmetros.</span></li>
      <li><strong>Verificar</strong><span>Unidades, casos limite e balanço de energia.</span></li>
      <li><strong>Controlar</strong><span>Equilíbrios, estabilidade e realimentação.</span></li>
    </ol></section>
    <div class="em-section-heading"><div><h2>Sua estante participa da trilha</h2><p>Use as observações de cada livro para registrar capítulos, páginas e dúvidas.</p></div></div>
    <div class="em-books">${unique(pathway.existingBookIds).map(id => materialButton(id, true)).join('')}</div>
    <div class="em-section-heading"><div><h2>Referências e materiais abertos</h2><p>Conteúdos para apoiar os blocos, com soluções identificadas quando disponíveis.</p></div></div>
    <div class="em-resources">${resourceIds.map(id => materialButton(id)).join('')}</div>
    <p class="em-scope">Percurso complementar à preparação em Física. A seleção de aplicações e as horas são sugestões de estudo ajustáveis; os critérios de ingresso continuam em Seleções e prazos.</p>
  </div>`;
}

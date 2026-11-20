/** Pure planning and data-validation functions. No storage or DOM side effects. */
const DAY = 86400000;
const SCENARIOS = ['2027.2', '2028.1'];

function dateNumber(value) {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function dateString(value) {
  return new Date(value).toISOString().slice(0, 10);
}

/** The application follows the user's Fortaleza calendar, independent of host timezone. */
export function todayISO() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const round = number => Math.round((number + Number.EPSILON) * 100) / 100;
const relevant = (task, scenario) => task.scenario === 'both' || task.scenario === scenario;
const add = (items, key) => items.reduce((total, item) => total + item[key], 0);

/** Shared study history is applied to both admission scenarios, never counted twice. */
export function summary(state, scenario = state.settings.scenario, today = todayISO()) {
  const selected = state.settings.scenarios[scenario];
  if (!selected) throw new Error('Cenário de ingresso inválido.');
  const tasks = state.tasks.filter(task => relevant(task, scenario));
  const completed = tasks.filter(task => task.done).length;
  const studyHours = round(add(state.sessions, 'hours'));
  const questions = add(state.sessions, 'total');
  const correct = add(state.sessions, 'correct');
  const start = state.settings.startDate;
  const target = selected.target;
  const days = Math.max(0, (dateNumber(target) - dateNumber(start)) / DAY + 1);
  const weeks = Math.ceil(days / 7);
  const remainingStart = today > start ? today : start;
  const remainingDays = Math.max(0, (dateNumber(target) - dateNumber(remainingStart)) / DAY + 1);
  const remainingWeeks = remainingDays / 7;
  const remainingHours = Math.max(0, round(selected.goalHours - studyHours));
  const remainingCapacity = round(remainingWeeks * selected.hours);
  return {
    scenario, tasks: tasks.length, total: tasks.length, completed,
    percent: tasks.length ? Math.round(100 * completed / tasks.length) : 0,
    studyHours, questions, correct,
    accuracy: questions ? Math.round(100 * correct / questions) : null,
    goalHours: selected.goalHours, remainingHours, weeks,
    requiredWeeklyHours: remainingWeeks ? round(remainingHours / remainingWeeks) : (remainingHours ? null : 0),
    capacity: round(weeks * selected.hours), remainingCapacity,
    feasible: remainingCapacity >= remainingHours,
    remainingWeeks: round(remainingWeeks), weeklyHours: selected.hours,
    start, target,
    daysUntilStart: Math.max(0, (dateNumber(start) - dateNumber(today)) / DAY),
    hoursPercent: Math.min(100, Math.round(100 * studyHours / selected.goalHours)),
  };
}

/** Accuracy is weighted by questions, not by an average of session percentages. */
export function topicStats(state) {
  const topics = new Map();
  function get(topic) {
    if (!topics.has(topic)) topics.set(topic, {topic, total: 0, done: 0, percent: 0, hours: 0, correct: 0, questions: 0, accuracy: null});
    return topics.get(topic);
  }
  for (const task of state.tasks) {
    const row = get(task.topic);
    row.total++;
    if (task.done) row.done++;
  }
  for (const session of state.sessions) {
    const row = get(session.topic);
    row.hours += session.hours;
    row.correct += session.correct;
    row.questions += session.total;
  }
  return [...topics.values()].map(row => ({
    ...row, hours: round(row.hours),
    percent: row.total ? Math.round(100 * row.done / row.total) : 0,
    accuracy: row.questions ? Math.round(100 * row.correct / row.questions) : null,
  }));
}

/** Prioritize measured weaknesses (<70%); preserve original order without evidence. */
export function recommendedOrder(state, scenario = state.settings.scenario) {
  const metrics = new Map(topicStats(state).map(row => [row.topic, row]));
  const score = task => {
    // The integrated course has an explicit pedagogical sequence. Results guide
    // review, but never move a later reading ahead of its planned foundation.
    if (task.curriculumOrder !== undefined) return 1;
    const row = metrics.get(task.topic);
    return row?.questions && row.accuracy < 70 ? row.correct / row.questions : 1;
  };
  const pending = state.tasks.filter(task => !task.done && relevant(task, scenario))
    .map((task, index) => ({task, index}))
    .sort((a, b) => score(a.task) - score(b.task) || a.index - b.index);
  const ordered = [];
  const remaining = new Set(pending.map(item => item.task.id));
  while (pending.length) {
    const at = pending.findIndex(({task}) => !(task.prerequisiteIds || []).some(id => remaining.has(id)));
    if (at < 0) throw new Error('Há um ciclo entre os pré-requisitos das atividades.');
    const [{task}] = pending.splice(at, 1);
    ordered.push(task);
    remaining.delete(task.id);
  }
  return ordered;
}

/**
 * Suggested dates are computed, never written into tasks. Explicit dates remain fixed.
 * A long activity can span weeks; its displayed date marks the start of that work.
 * In stand-by the plan stays anchored to the configured start, with no auto-activation.
 */
export function plan(state, scenario = state.settings.scenario, today = todayISO()) {
  const settings = state.settings.scenarios[scenario];
  if (!settings) throw new Error('Cenário de ingresso inválido.');
  const base = state.settings.status === 'active' && today > state.settings.startDate ? today : state.settings.startDate;
  const baseNumber = dateNumber(base);
  const spentByWeek = new Map();
  const tasks = recommendedOrder(state, scenario);
  // Reserve dated tasks first, so suggestions take their workload into account.
  for (const task of tasks) {
    if (!task.due) continue;
    let week = Math.max(0, Math.floor((dateNumber(task.due) - baseNumber) / DAY / 7));
    let remaining = task.hours;
    while (remaining > 0) {
      const used = Math.min(remaining, settings.hours);
      spentByWeek.set(week, (spentByWeek.get(week) || 0) + used);
      remaining -= used;
      week++;
    }
  }
  const ends = new Map();
  const taskMap = new Map(state.tasks.map(task => [task.id, task]));
  return tasks.map(task => {
    const planningWarnings = (task.prerequisiteIds || []).flatMap(id => {
      const dependency = taskMap.get(id);
      if (!dependency) return ['Um pré-requisito foi removido; confira a sequência.'];
      return !dependency.done && !relevant(dependency, scenario) ? ['Há pré-requisito pendente fora deste cenário.'] : [];
    });
    const prerequisiteEnd = Math.max(0, ...(task.prerequisiteIds || []).map(id => ends.get(id) || 0));
    const earliest = task.startWeeks?.[scenario] || 1;
    const earliestDate = dateNumber(state.settings.startDate) + (earliest - 1) * 7 * DAY;
    if (task.due) {
      const manualDate = dateNumber(task.due);
      if (manualDate < prerequisiteEnd) planningWarnings.push('Prazo manual anterior a um pré-requisito planejado.');
      if (manualDate < earliestDate) planningWarnings.push('Prazo manual anterior à semana de entrada sugerida.');
      ends.set(task.id, manualDate + (Math.ceil(task.hours / settings.hours) - 1) * 7 * DAY);
      return {...task, planningWarnings, plannedDate: task.due, week: Math.max(1, Math.floor((manualDate - dateNumber(state.settings.startDate)) / DAY / 7) + 1)};
    }
    const relativeStart = Math.max(0, Math.ceil((Math.max(earliestDate, prerequisiteEnd) - baseNumber) / DAY / 7));
    let cursor = relativeStart;
    while ((spentByWeek.get(cursor) || 0) >= settings.hours) cursor++;
    const begin = cursor;
    let remaining = task.hours;
    while (remaining > 0.000001) {
      const used = spentByWeek.get(cursor) || 0;
      const taken = Math.min(remaining, Math.max(0, settings.hours - used));
      spentByWeek.set(cursor, used + taken);
      remaining -= taken;
      if (remaining > 0.000001) cursor++;
    }
    const plannedDate = dateString(baseNumber + begin * 7 * DAY);
    ends.set(task.id, baseNumber + cursor * 7 * DAY);
    return {...task, planningWarnings, plannedDate, week: Math.max(1, Math.floor((dateNumber(plannedDate) - dateNumber(state.settings.startDate)) / DAY / 7) + 1)};
  });
}

function fail(path, reason) { throw new Error(`Dados inválidos em ${path}: ${reason}.`); }
function object(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'objeto esperado');
  return value;
}
function string(value, path, max = 5000, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) fail(path, 'texto inválido');
  return value;
}
function number(value, path, min, max = 1000000, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(path, 'número fora do intervalo permitido');
  return value;
}
function choice(value, path, options) {
  if (!options.includes(value)) fail(path, 'opção não reconhecida');
  return value;
}
function date(value, path, optional = false) {
  if (optional && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(dateNumber(value)) || dateString(dateNumber(value)) !== value || value < '1900-01-01' || value > '2200-12-31') fail(path, 'data de calendário inválida');
  return value;
}
function url(value, path) {
  const text = string(value, path, 4096, true);
  if (!text) return '';
  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) fail(path, 'use um link HTTP ou HTTPS sem credenciais');
  } catch { fail(path, 'use um link HTTP ou HTTPS válido'); }
  return text;
}
function array(value, path, sanitize) {
  if (!Array.isArray(value) || value.length > 10000) fail(path, 'lista inválida ou muito extensa');
  const ids = new Set();
  return value.map((item, index) => {
    const current = `${path}[${index}]`;
    object(item, current);
    const result = sanitize(item, current);
    if (ids.has(result.id)) fail(current, 'identificador duplicado');
    ids.add(result.id);
    return result;
  });
}
const id = (value, path) => string(value, `${path}.id`, 200);
const textField = (value, path, key, max = 5000, optional = false) => string(value[key], `${path}.${key}`, max, optional);

/** Validate an entire import atomically and retain only recognized fields. */
export function validateState(raw) {
  object(raw, 'arquivo');
  if (raw.version !== 1) fail('version', 'versão não suportada');
  const settings = object(raw.settings, 'settings');
  const scenarios = object(settings.scenarios, 'settings.scenarios');
  const startDate = date(settings.startDate, 'settings.startDate');
  const cleanScenarios = {};
  for (const key of SCENARIOS) {
    const scenario = object(scenarios[key], `settings.scenarios.${key}`);
    const target = date(scenario.target, `settings.scenarios.${key}.target`);
    if (target < startDate) fail(`settings.scenarios.${key}.target`, 'o prazo deve ser igual ou posterior ao início');
    cleanScenarios[key] = {target,
      hours: number(scenario.hours, `settings.scenarios.${key}.hours`, 0.1, 168),
      goalHours: number(scenario.goalHours, `settings.scenarios.${key}.goalHours`, 0.1, 10000),
    };
  }
  const result = {version: 1, settings: {
    status: choice(settings.status, 'settings.status', ['standby', 'active']),
    startDate, scenario: choice(settings.scenario, 'settings.scenario', SCENARIOS),
    name: string(settings.name, 'settings.name', 120), scenarios: cleanScenarios,
  }};
  result.tasks = array(raw.tasks, 'tasks', (value, path) => {
    if (typeof value.done !== 'boolean') fail(`${path}.done`, 'booleano esperado');
    const task = {id: id(value.id, path), title: textField(value, path, 'title', 500),
      topic: textField(value, path, 'topic', 200), hours: number(value.hours, `${path}.hours`, 0.01, 10000),
      done: value.done, scenario: choice(value.scenario, `${path}.scenario`, [...SCENARIOS, 'both']),
      notes: textField(value, path, 'notes', 20000, true),
    };
    const due = date(value.due, `${path}.due`, true);
    const doneDate = date(value.doneDate, `${path}.doneDate`, true);
    if (due) task.due = due;
    if (doneDate) task.doneDate = doneDate;
    if (value.materialId !== undefined) task.materialId = textField(value, path, 'materialId', 200, true);
    if (value.curriculumOrder !== undefined) task.curriculumOrder = number(value.curriculumOrder, `${path}.curriculumOrder`, 0, 10000, true);
    if (value.prerequisiteIds !== undefined) {
      if (!Array.isArray(value.prerequisiteIds) || value.prerequisiteIds.length > 100) fail(`${path}.prerequisiteIds`, 'liste até 100 pré-requisitos');
      task.prerequisiteIds = [...new Set(value.prerequisiteIds.map((item, index) => string(item, `${path}.prerequisiteIds[${index}]`, 200)))];
      if (task.prerequisiteIds.includes(task.id)) fail(`${path}.prerequisiteIds`, 'uma atividade não pode depender dela mesma');
    }
    if (value.startWeeks !== undefined) {
      object(value.startWeeks, `${path}.startWeeks`);
      task.startWeeks = Object.fromEntries(SCENARIOS.filter(sc => value.startWeeks[sc] !== undefined).map(sc => [sc, number(value.startWeeks[sc], `${path}.startWeeks.${sc}`, 1, 520, true)]));
    }
    return task;
  });
  const byId = new Map(result.tasks.map(task => [task.id, task]));
  const visited = new Set(), visiting = new Set();
  function visit(task) {
    if (visited.has(task.id)) return;
    if (visiting.has(task.id)) fail('tasks', 'ciclo nos pré-requisitos');
    visiting.add(task.id);
    for (const dep of task.prerequisiteIds || []) if (byId.has(dep)) visit(byId.get(dep));
    visiting.delete(task.id);
    visited.add(task.id);
  }
  result.tasks.forEach(visit);
  result.sessions = array(raw.sessions, 'sessions', (value, path) => {
    const total = number(value.total, `${path}.total`, 0, 1000000, true);
    const correct = number(value.correct, `${path}.correct`, 0, total, true);
    const session = {id: id(value.id, path), date: date(value.date, `${path}.date`),
      topic: textField(value, path, 'topic', 200), hours: number(value.hours, `${path}.hours`, 0, 24),
      correct, total, notes: textField(value, path, 'notes', 20000, true),
    };
    if (value.activityId !== undefined) session.activityId = textField(value, path, 'activityId', 200, true);
    return session;
  });
  result.materials = array(raw.materials, 'materials', (value, path) => ({
    id: id(value.id, path), title: textField(value, path, 'title', 500),
    type: textField(value, path, 'type', 120), topic: textField(value, path, 'topic', 200),
    author: textField(value, path, 'author', 500, true),
    url: url(value.url, `${path}.url`), answerUrl: url(value.answerUrl, `${path}.answerUrl`),
    notes: textField(value, path, 'notes', 20000, true), status: textField(value, path, 'status', 120),
  }));
  result.deadlines = array(raw.deadlines, 'deadlines', (value, path) => ({
    id: id(value.id, path), title: textField(value, path, 'title', 500),
    date: date(value.date, `${path}.date`),
    scenario: choice(value.scenario, `${path}.scenario`, [...SCENARIOS, 'both']),
    status: choice(value.status, `${path}.status`, ['estimate', 'official']),
    url: url(value.url, `${path}.url`),
  }));
  result.notes = string(raw.notes, 'notes', 100000, true);
  if (raw.contentPacks !== undefined) {
    if (!Array.isArray(raw.contentPacks) || raw.contentPacks.length > 100) {
      fail('contentPacks', 'lista inválida ou muito extensa');
    }
    const seen = new Set();
    result.contentPacks = raw.contentPacks.map((value, index) => {
      const packId = string(value, `contentPacks[${index}]`, 200);
      if (seen.has(packId)) fail(`contentPacks[${index}]`, 'identificador duplicado');
      seen.add(packId);
      return packId;
    });
  }
  return result;
}

/**
 * Add a versioned curriculum once, without replacing the learner's existing data.
 * The marker survives backups, so later edits and deletions remain intentional.
 * Insertion anchors affect new tasks only; existing task order is preserved.
 */
export function applyContentPack(rawState, pack) {
  const state = validateState(rawState);
  object(pack, 'contentPack');
  const packId = string(pack.id, 'contentPack.id', 200);
  if (state.contentPacks?.includes(packId)) {
    return {state, addedTasks: 0, addedMaterials: 0, applied: false};
  }

  // Validate the entire addition before merging. A failure never mutates rawState.
  const addition = validateState({...state, tasks: pack.tasks, materials: pack.materials});
  const anchors = pack.tasks.map((task, index) =>
    string(task.afterTaskId, `contentPack.tasks[${index}].afterTaskId`, 200, true));
  const taskIds = new Set(state.tasks.map(task => task.id));
  const materialIds = new Set(state.materials.map(material => material.id));
  const insertedAfter = new Map();
  let addedTasks = 0;
  let addedMaterials = 0;

  addition.tasks.forEach((task, index) => {
    if (taskIds.has(task.id)) return;
    const requestedAnchor = anchors[index];
    let anchor = requestedAnchor;
    // Keep siblings after earlier additions and their already-inserted children.
    while (insertedAfter.has(anchor)) anchor = insertedAfter.get(anchor);
    const at = anchor ? state.tasks.findIndex(item => item.id === anchor) : -1;
    if (at === -1) {
      state.tasks.push(task);
    } else {
      state.tasks.splice(at + 1, 0, task);
      insertedAfter.set(requestedAnchor, task.id);
    }
    taskIds.add(task.id);
    addedTasks++;
  });

  for (const material of addition.materials) {
    if (materialIds.has(material.id)) continue;
    state.materials.push(material);
    materialIds.add(material.id);
    addedMaterials++;
  }

  state.contentPacks = [...(state.contentPacks || []), packId];
  return {state: validateState(state), addedTasks, addedMaterials, applied: true};
}

/** Reorganize the existing records once; never recreate deleted activities. */
export function applyUnifiedCurriculum(rawState, curriculum) {
  const state = validateState(rawState);
  const curriculumId = string(curriculum.id, 'curriculum.id', 200);
  if (state.contentPacks?.includes(curriculumId)) return {state, applied: false};
  if (!Array.isArray(curriculum.phases)) fail('curriculum.phases', 'lista esperada');
  const byId = new Map(state.tasks.map(task => [task.id, task]));
  const ordered = [], seen = new Set();
  let lastCore = null;
  const lastByScenario = {'2027.2': null, '2028.1': null};
  for (const phase of curriculum.phases) {
    if (!Array.isArray(phase.steps)) fail('curriculum.steps', 'lista esperada');
    for (const step of phase.steps) {
      const taskId = string(step.taskId, 'curriculum.step.taskId', 200);
      if (seen.has(taskId)) fail('curriculum.steps', 'atividade duplicada');
      seen.add(taskId);
      const task = byId.get(taskId);
      if (!task) continue;
      const previous = task.scenario === 'both' ? lastCore : lastByScenario[task.scenario];
      task.prerequisiteIds = previous ? [previous] : [];
      task.startWeeks = Object.fromEntries(SCENARIOS.map(sc => [sc, number(phase.windows?.[sc]?.[0], 'curriculum.windows', 1, 520, true)]));
      task.curriculumOrder = ordered.length;
      ordered.push(task);
      if (task.scenario === 'both') {
        lastCore = task.id;
        for (const sc of SCENARIOS) lastByScenario[sc] = task.id;
      } else lastByScenario[task.scenario] = task.id;
    }
  }
  state.tasks = [...ordered, ...state.tasks.filter(task => !seen.has(task.id))];
  state.contentPacks = [...(state.contentPacks || []), curriculumId];
  return {state: validateState(state), applied: true};
}

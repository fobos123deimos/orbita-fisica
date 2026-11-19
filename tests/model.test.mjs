import test from 'node:test';
import assert from 'node:assert/strict';
import {summary, topicStats, plan, validateState, recommendedOrder, applyContentPack} from '../dist/model.js';

const state = () => ({version: 1, settings: {status: 'standby', startDate: '2027-01-04', scenario: '2027.2', name: 'Matheus', scenarios: {
  '2027.2': {target: '2027-06-27', hours: 16, goalHours: 400},
  '2028.1': {target: '2027-12-26', hours: 12, goalHours: 612},
}}, tasks: [
  {id: 'a', title: 'Newton', topic: 'Mecânica', hours: 10, done: false, scenario: 'both'},
  {id: 'b', title: 'Maxwell', topic: 'Eletromagnetismo', hours: 10, done: false, scenario: 'both'},
  {id: 'c', title: 'Aprofundamento', topic: 'Mecânica', hours: 20, done: false, scenario: '2028.1'},
], sessions: [], materials: [], deadlines: [], notes: ''});

test('scenario horizons are inclusive and share actual study history', () => {
  const input = state();
  input.tasks[0].done = true;
  input.sessions = [{id: 's', date: '2027-01-05', topic: 'Mecânica', hours: 2, correct: 8, total: 10, notes: ''}];
  const fast = summary(input, '2027.2', '2026-11-18');
  const extended = summary(input, '2028.1', '2026-11-18');
  assert.equal(fast.weeks, 25);
  assert.equal(extended.weeks, 51);
  assert.equal(fast.percent, 50);
  assert.equal(extended.percent, 33);
  assert.equal(fast.studyHours, extended.studyHours);
  assert.equal(fast.remainingHours, 398);
  assert.equal(fast.capacity, 400);
  assert.equal(extended.capacity, 612);
});

test('accuracy weights questions and remains empty without attempts', () => {
  const input = state();
  assert.equal(summary(input).accuracy, null);
  input.sessions = [
    {id: 's1', date: '2027-01-05', topic: 'Mecânica', hours: 1, correct: 1, total: 1},
    {id: 's2', date: '2027-01-06', topic: 'Mecânica', hours: 2, correct: 0, total: 9},
  ];
  assert.equal(summary(input).accuracy, 10);
  assert.equal(topicStats(input)[0].accuracy, 10);
  assert.equal(topicStats(input)[1].accuracy, null);
});

test('expired scenario has zero capacity without Infinity or invented feasibility', () => {
  const output = summary(state(), '2027.2', '2027-07-01');
  assert.equal(output.remainingCapacity, 0);
  assert.equal(output.feasible, false);
  assert.equal(output.requiredWeeklyHours, null);
  assert.equal(JSON.stringify(output).includes('Infinity'), false);
});

test('planning prioritizes measured weakness and respects dated workload', () => {
  const input = state();
  input.sessions = [{id: 's', date: '2027-01-05', topic: 'Eletromagnetismo', hours: 1, correct: 2, total: 10}];
  assert.deepEqual(recommendedOrder(input).map(task => task.id), ['b', 'a']);
  input.tasks[0].due = '2027-01-04';
  input.tasks[0].hours = 16;
  const output = plan(input, '2027.2', '2027-02-01');
  assert.equal(output.find(task => task.id === 'a').plannedDate, '2027-01-04');
  assert.equal(output.find(task => task.id === 'b').plannedDate, '2027-01-11');
  assert.equal(input.settings.status, 'standby');
  assert.equal(input.tasks[1].plannedDate, undefined);
});

test('active planning shifts undated work into the available horizon', () => {
  const input = state();
  input.settings.status = 'active';
  assert.equal(plan(input, '2027.2', '2027-02-01')[0].plannedDate, '2027-02-01');
});

test('validation is atomic, rejects invalid dates, counts and dangerous URLs', () => {
  const source = state();
  source.untrusted = 'ignored';
  const clean = validateState(source);
  assert.equal(clean.untrusted, undefined);
  clean.tasks[0].title = 'Independent copy';
  assert.equal(source.tasks[0].title, 'Newton');
  const invalidDate = state(); invalidDate.settings.startDate = '2027-02-29';
  assert.throws(() => validateState(invalidDate), /data/);
  const invalidScore = state(); invalidScore.sessions = [{id: 's', date: '2027-01-04', topic: 'Mecânica', hours: 1, correct: 3, total: 2}];
  assert.throws(() => validateState(invalidScore), /correct/);
  const invalidURL = state(); invalidURL.materials = [{id: 'm', title: 'Vídeo', type: 'Videoaula', topic: 'Mecânica', status: 'Referência', url: 'javascript:alert(1)'}];
  assert.throws(() => validateState(invalidURL), /HTTP/);
  const duplicate = state(); duplicate.tasks.push({...duplicate.tasks[0]});
  assert.throws(() => validateState(duplicate), /duplicado/);
  const invalidHours = state(); invalidHours.tasks[0].hours = Infinity;
  assert.throws(() => validateState(invalidHours), /hours/);
});

test('arbitrary material types and statuses survive validated imports', () => {
  const input = state();
  input.materials = [{id: 'm', title: 'Meu livro', type: 'Livro físico', topic: 'Matemática', author: 'Autor', url: '', answerUrl: 'https://example.com/gabarito.pdf', notes: '', status: 'Em uso'}];
  input.tasks[0].materialId = 'm'; input.tasks[0].doneDate = '2027-01-05';
  const output = validateState(input);
  assert.equal(output.materials[0].type, 'Livro físico');
  assert.equal(output.materials[0].status, 'Em uso');
  assert.equal(output.tasks[0].materialId, 'm');
});

const contentPack = () => ({
  id: 'electromechanics-2026-11-19',
  tasks: [
    {id: 'EM01', title: 'Comparar RLC e massa–mola', topic: 'Eletromagnetismo', hours: 3, done: false, scenario: 'both', materialId: 'EM-MIT', afterTaskId: 'a', notes: 'Derivar e conferir as unidades.'},
    {id: 'EM02', title: 'Controle por energia', topic: 'Dinâmica eletromecânica', hours: 4, done: false, scenario: '2028.1', afterTaskId: 'EM01'},
  ],
  materials: [
    {id: 'EM-MIT', title: 'Dinâmica eletromecânica', type: 'Livro digital', topic: 'Eletromagnetismo', author: 'MIT', url: 'https://ocw.mit.edu/', answerUrl: '', notes: 'Referência de estudo.', status: 'Referência'},
  ],
});

test('curriculum upgrade preserves study history, custom planning and user records', () => {
  const input = state();
  input.settings.startDate = '2027-02-01';
  input.settings.scenarios['2027.2'].hours = 7;
  input.tasks[0] = {...input.tasks[0], done: true, doneDate: '2027-02-02', due: '2027-02-01', notes: 'Minha solução e revisão.', materialId: 'custom-book'};
  input.tasks.push({id: 'custom-task', title: 'Meu experimento', topic: 'Pesquisa', hours: 1.5, done: false, scenario: 'both', notes: 'Ajustar o sensor.'});
  input.materials = [{id: 'custom-book', title: 'Meu livro', type: 'Livro físico', topic: 'Mecânica', url: '', answerUrl: '', notes: 'Página 23', status: 'Em uso'}];
  input.sessions = [{id: 'real-session', date: '2027-02-02', topic: 'Mecânica', hours: 1.5, total: 4, correct: 3, activityId: 'custom-book', notes: 'Rever o sinal do torque.'}];
  input.deadlines = [{id: 'personal-date', title: 'Revisão pessoal', date: '2027-03-01', scenario: 'both', status: 'estimate', url: ''}];
  input.notes = 'Meu caderno permanece aqui.';
  input.contentPacks = ['previous-curriculum'];
  const snapshot = structuredClone(input);
  const before = validateState(input);
  const {state: upgraded, addedTasks, addedMaterials, applied} = applyContentPack(input, contentPack());

  assert.equal(applied, true);
  assert.equal(addedTasks, 2);
  assert.equal(addedMaterials, 1);
  assert.deepEqual(input, snapshot);
  for (const key of ['settings', 'sessions', 'deadlines', 'notes']) assert.deepEqual(upgraded[key], before[key]);
  assert.deepEqual(upgraded.tasks.filter(task => before.tasks.some(old => old.id === task.id)), before.tasks);
  assert.deepEqual(upgraded.materials.find(material => material.id === 'custom-book'), before.materials[0]);
  assert.deepEqual(upgraded.contentPacks, ['previous-curriculum', contentPack().id]);
  assert.equal(upgraded.tasks.find(task => task.id === 'EM01').afterTaskId, undefined);
  assert.equal(summary(upgraded).studyHours, summary(before).studyHours);
  assert.equal(upgraded.settings.status, 'standby');
});

test('curriculum is idempotent and does not restore intentionally deleted additions', () => {
  const first = applyContentPack(state(), contentPack()).state;
  const again = applyContentPack(first, contentPack());
  assert.equal(again.applied, false);
  assert.equal(again.addedTasks, 0);
  assert.equal(again.addedMaterials, 0);
  assert.deepEqual(again.state, first);

  first.tasks = first.tasks.filter(task => task.id !== 'EM01');
  first.materials = first.materials.filter(material => material.id !== 'EM-MIT');
  const imported = validateState(JSON.parse(JSON.stringify(first)));
  const afterImport = applyContentPack(imported, contentPack());
  assert.equal(afterImport.state.tasks.some(task => task.id === 'EM01'), false);
  assert.equal(afterImport.state.materials.some(material => material.id === 'EM-MIT'), false);
  assert.deepEqual(afterImport.state, imported);
});

test('existing curriculum IDs retain user edits instead of being duplicated or overwritten', () => {
  const input = state();
  input.tasks.push({...contentPack().tasks[0], title: 'Meu título', done: true, hours: 9, notes: 'Anotações pessoais'});
  input.materials.push({...contentPack().materials[0], title: 'Minha referência', status: 'Concluído', notes: 'Leitura finalizada.'});
  const before = validateState(input);
  const output = applyContentPack(input, contentPack());
  assert.equal(output.addedTasks, 1);
  assert.equal(output.addedMaterials, 0);
  assert.deepEqual(output.state.tasks.find(task => task.id === 'EM01'), before.tasks.find(task => task.id === 'EM01'));
  assert.deepEqual(output.state.materials, before.materials);
  assert.equal(output.state.tasks.filter(task => task.id === 'EM01').length, 1);
});

test('anchors support ordered dependencies, siblings and missing anchors without reordering old tasks', () => {
  const pack = contentPack();
  const sample = pack.tasks[0];
  pack.tasks = [
    {...sample, id: 'first', afterTaskId: 'a'},
    {...sample, id: 'child', afterTaskId: 'first'},
    {...sample, id: 'sibling', afterTaskId: 'a'},
    {...sample, id: 'orphan', afterTaskId: 'removed-task'},
  ];
  const output = applyContentPack(state(), pack).state;
  assert.deepEqual(output.tasks.map(task => task.id), ['a', 'first', 'child', 'sibling', 'b', 'c', 'orphan']);
  assert.deepEqual(output.tasks.filter(task => ['a', 'b', 'c'].includes(task.id)).map(task => task.id), ['a', 'b', 'c']);
});

test('legacy backups remain valid and curriculum markers are validated and round-trip safely', () => {
  const legacy = validateState(state());
  assert.equal(Object.hasOwn(legacy, 'contentPacks'), false);
  const upgraded = applyContentPack(legacy, contentPack()).state;
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(upgraded))).contentPacks, [contentPack().id]);
  for (const invalid of [null, 'one-pack', [''], [123], ['same', 'same'], Array.from({length: 101}, (_, index) => `pack-${index}`)]) {
    assert.throws(() => validateState({...state(), contentPacks: invalid}), /contentPacks/);
  }
});

test('invalid curriculum additions are rejected atomically', () => {
  const input = state();
  const snapshot = structuredClone(input);
  const invalidTask = contentPack(); invalidTask.tasks[1].hours = -1;
  assert.throws(() => applyContentPack(input, invalidTask), /hours/);
  const invalidMaterial = contentPack(); invalidMaterial.materials[0].url = 'javascript:alert(1)';
  assert.throws(() => applyContentPack(input, invalidMaterial), /HTTP/);
  const invalidAnchor = contentPack(); invalidAnchor.tasks[0].afterTaskId = 123;
  assert.throws(() => applyContentPack(input, invalidAnchor), /afterTaskId/);
  const duplicate = contentPack(); duplicate.tasks.push({...duplicate.tasks[0]});
  assert.throws(() => applyContentPack(input, duplicate), /duplicado/);
  assert.deepEqual(input, snapshot);
});

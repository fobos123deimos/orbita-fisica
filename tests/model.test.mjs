import test from 'node:test';
import assert from 'node:assert/strict';
import {summary, topicStats, plan, validateState, recommendedOrder} from '../dist/model.js';

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

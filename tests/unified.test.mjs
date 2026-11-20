import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyContentPack,applyUnifiedCurriculum,validateState,recommendedOrder,plan} from '../dist/model.js';
const json=name=>JSON.parse(readFileSync(new URL('../dist/'+name+'.json',import.meta.url),'utf8'));
const curriculum=json('curriculum'),seed=json('seed');
const content=state=>applyContentPack(applyContentPack(state,json('electromechanics')).state,json('research')).state;
const upgrade=state=>applyUnifiedCurriculum(content(state),curriculum).state;
test('one curriculum covers every existing activity once and uses known materials',()=>{
 const state=content(seed),ids=curriculum.phases.flatMap(p=>p.steps.map(s=>s.taskId));
 assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,95);
 assert.deepEqual(new Set(ids),new Set(state.tasks.map(t=>t.id)));
 const materials=new Set(state.materials.map(m=>m.id));for(const phase of curriculum.phases)for(const step of phase.steps)for(const id of step.materialIds||[])assert(materials.has(id),id);
});
test('unification preserves learner data while reorganizing only order and scheduling metadata',()=>{
 const old=content(seed);old.tasks[0].done=true;old.tasks[0].notes='Minha demonstração';old.tasks[0].title='Título pessoal';old.tasks[0].due='2027-02-03';old.tasks[0].hours=1.25;
 old.sessions.push({id:'actual',date:'2026-11-20',topic:'Base quântica',hours:1,total:4,correct:3,notes:'Resultado real',activityId:'quiz-base'});
 old.settings.startDate='2027-01-18';old.notes='Preservar';old.materials[0].notes='Minha edição';
 const oldTask=structuredClone(old.tasks[0]);old.tasks.push({id:'custom',title:'Minha atividade',topic:'Livre',hours:1,done:false,scenario:'both',notes:'Customizada'});
 const result=applyUnifiedCurriculum(old,curriculum).state;const t=result.tasks.find(t=>t.id===oldTask.id);
 for(const key of ['title','done','notes','due','hours','materialId'])assert.deepEqual(t[key],oldTask[key]);
 assert.deepEqual(result.sessions,old.sessions);assert.deepEqual(result.settings,old.settings);assert.deepEqual(result.materials,old.materials);assert.equal(result.notes,old.notes);assert.deepEqual(result.tasks.at(-1),old.tasks.at(-1));
 assert.deepEqual(applyUnifiedCurriculum(JSON.parse(JSON.stringify(result)),curriculum).state,result);
 assert.deepEqual(validateState(result),result);
});
test('deleted activities stay deleted before and after unification, including old backups',()=>{
 let state=content(seed);const id='task-pm-oscillator-1';state.tasks=state.tasks.filter(t=>t.id!==id);state=upgrade(state);assert(!state.tasks.some(t=>t.id===id));
 state.tasks=state.tasks.filter(t=>t.id!=='EM01');assert(!upgrade(state).tasks.some(t=>t.id==='EM01'));
});
test('both pacing scenarios follow the same integrated order even with weak advanced results',()=>{
 const state=upgrade(seed);state.sessions.push({id:'weak',date:'2026-11-20',topic:'Kerr dissipativo e comparação crítica',hours:0,total:4,correct:0,notes:''});
 const all=curriculum.phases.flatMap(p=>p.steps.map(s=>s.taskId));
 for(const scenario of ['2027.2','2028.1']){
  const relevant=state.tasks.filter(t=>t.scenario==='both'||t.scenario===scenario);
  assert.deepEqual(recommendedOrder(state,scenario).map(t=>t.id),all.filter(id=>relevant.some(t=>t.id===id)));
  const schedule=plan(state,scenario,'2026-11-20');assert(schedule.every(t=>!t.planningWarnings.length));
  assert(schedule.at(-1).week<=(scenario==='2027.2'?25:51));
  for(let i=1;i<schedule.length;i++)assert(schedule[i].plannedDate>=schedule[i-1].plannedDate);
 }
});
test('duplicate curriculum steps fail atomically',()=>{
 const state=content(seed),before=structuredClone(state),invalid=structuredClone(curriculum);invalid.phases[0].steps.push(invalid.phases[0].steps[0]);
 assert.throws(()=>applyUnifiedCurriculum(state,invalid),/duplicada/);assert.deepEqual(state,before);
});

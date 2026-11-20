import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyContentPack,validateState,plan,recommendedOrder} from '../dist/model.js';
import {gradeQuiz,renderResearch} from '../dist/research-view.js';
const json=file=>JSON.parse(readFileSync(new URL('../dist/'+file,import.meta.url),'utf8'));
const seed=json('seed.json'), pack=json('research.json');
const upgraded=state=>applyContentPack(applyContentPack(state,json('electromechanics.json')).state,pack).state;
test('research reaches existing users and old backups without losing progress or settings',()=>{
 const old=structuredClone(seed);old.tasks[0].done=true;old.tasks[0].notes='Anotação pessoal';old.settings.startDate='2027-01-18';old.notes='Meu caderno';
 old.sessions.push({id:'actual',date:'2026-11-20',topic:'Mecânica quântica',hours:1,total:5,correct:4,notes:'Sessão real'});
 const state=upgraded(old);assert.equal(state.settings.status,'standby');assert.equal(state.settings.startDate,'2027-01-18');assert.deepEqual(state.sessions,old.sessions);assert.equal(state.tasks[0].notes,'Anotação pessoal');assert.equal(state.notes,'Meu caderno');
 assert.deepEqual(upgraded(JSON.parse(JSON.stringify(state))),state);
 state.tasks=state.tasks.filter(t=>t.id!==pack.tasks[0].id);assert(!upgraded(state).tasks.some(t=>t.id===pack.tasks[0].id));
});
test('reading plan has resolvable sources, quiz choices and shared task references',()=>{
 const state=upgraded(seed),mids=new Set(state.materials.map(m=>m.id)),tids=new Set(state.tasks.map(t=>t.id));
 for(const stage of pack.stages){for(const id of stage.materialIds)assert(mids.has(id),id);for(const id of stage.taskIds)assert(tids.has(id),id);}
 for(const task of pack.tasks){assert(mids.has(task.materialId));for(const id of task.prerequisiteIds||[])assert(tids.has(id),id);assert(!task.done);}
 for(const r of pack.readings)assert(/^https:\/\//.test(r.url));
 assert.equal(pack.quizzes.length,6);assert.equal(pack.quizzes.reduce((n,q)=>n+q.questions.length,0),24);
});
test('weakness prioritization cannot invert research prerequisites or earliest weeks',()=>{
 const state=upgraded(seed);state.sessions.push({id:'weak',date:'2026-11-20',topic:pack.stages.at(-1).title,hours:0,total:4,correct:0,notes:''});
 for(const sc of ['2027.2','2028.1']){
  const order=recommendedOrder(state,sc),positions=new Map(order.map((t,i)=>[t.id,i]));
  for(const t of order)for(const dep of t.prerequisiteIds||[])if(positions.has(dep))assert(positions.get(dep)<positions.get(t.id),t.id+' after '+dep);
  const schedule=plan(state,sc,'2026-11-20'),dates=new Map(schedule.map(t=>[t.id,t.plannedDate]));
  for(const t of schedule){if(t.startWeeks)assert(t.week>=t.startWeeks[sc]);for(const d of t.prerequisiteIds||[])if(dates.has(d)&&!t.due)assert(t.plannedDate>=dates.get(d));}
 }
});
test('manual midweek prerequisites never schedule dependent work earlier; conflicts are visible',()=>{
 const state=structuredClone(seed);state.tasks=[{id:'parent',title:'Pai',topic:'Base',hours:2,done:false,scenario:'both',notes:'',due:'2027-02-10'},{id:'child',title:'Filho',topic:'Base',hours:2,done:false,scenario:'both',notes:'',prerequisiteIds:['parent']}];
 let schedule=plan(state);assert(schedule[1].plannedDate>=schedule[0].plannedDate);
 state.tasks[1].due='2027-02-01';schedule=plan(state);assert.equal(schedule[1].plannedDate,'2027-02-01');assert(schedule[1].planningWarnings.length>0);
 state.tasks[0].scenario='2028.1';schedule=plan(state,'2027.2');assert(schedule[0].planningWarnings.some(w=>w.includes('fora deste cenário')));
});
test('cycles are rejected and dependency metadata round-trips with backups',()=>{
 const state=upgraded(seed);assert.deepEqual(validateState(state),state);
 const first=state.tasks.find(t=>t.id===pack.tasks[0].id);first.prerequisiteIds=[first.id];assert.throws(()=>validateState(state),/dela mesma/);
});
test('quiz grading reports actual selected answers and rejects partial submissions',()=>{
 for(const quiz of pack.quizzes){
  const answers=Object.fromEntries(quiz.questions.map(q=>['q-'+q.id,String(q.answer)]));
  assert.equal(gradeQuiz(quiz,answers).correct,quiz.questions.length);
  const wrong=Object.fromEntries(quiz.questions.map(q=>['q-'+q.id,String((q.answer+1)%q.options.length)]));assert.equal(gradeQuiz(quiz,wrong).correct,0);
  assert.throws(()=>gradeQuiz(quiz,{}));answers['q-'+quiz.questions[0].id]='-1';assert.throws(()=>gradeQuiz(quiz,answers));
 }
});

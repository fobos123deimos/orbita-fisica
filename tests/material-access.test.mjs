import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as model from '../dist/model.js';
import {gradeQuiz,renderQuizBody,renderQuizFeedback} from '../dist/research-view.js';
import {renderUnifiedTrail,findOriginalMaterial,originalMaterialAction,renderOriginalMaterial} from '../dist/trail-view.js';

const json=name=>JSON.parse(readFileSync(new URL('../dist/'+name+'.json',import.meta.url),'utf8'));
const research=json('research'),electromechanics=json('electromechanics'),curriculum=json('curriculum');
const upgraded=()=>model.applyUnifiedCurriculum(model.applyContentPack(model.applyContentPack(json('seed'),electromechanics).state,research).state,curriculum).state;
const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;

// Run the real app with storage and a minimal DOM: interactions remain read-only
// until the learner explicitly submits a result, and no checklist is reconstructed.
async function startApp(saved,hash='') {
 const elements=Object.fromEntries(['#app','#modal','#import-file','#toast'].map(key=>[key,{innerHTML:'',addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},classList:{add(){},remove(){}}}]));
 const handlers={},location={hash,origin:'https://fobos123deimos.github.io',pathname:'/orbita-fisica/',search:''};
 let stored=JSON.stringify(saved);
 const env={...model,renderQuizBody,renderQuizFeedback,gradeQuiz,renderUnifiedTrail,findOriginalMaterial,originalMaterialAction,renderOriginalMaterial,
  fetch:async url=>({json:async()=>json(url.replace(/^\.\//,'').split('.')[0])}),
  localStorage:{getItem:()=>stored,setItem:(_key,value)=>{stored=value;}},
  document:{activeElement:null,querySelector:selector=>elements[selector]||null,querySelectorAll:()=>[],getElementById:()=>null,addEventListener:(event,handler)=>{handlers[event]=handler;}},
  location,history:{replaceState:(_state,_title,url)=>{location.hash=url.includes('#')?url.slice(url.indexOf('#')):'';}},
  window:{scrollTo(){},addEventListener(){}},
 };
 const boot=new AsyncFunction('env',`const {${Object.keys(env).join(',')}}=env;\n${app}\nreturn {state,materialCard,library,studyMaterial,routeTrail};`);
 const api=await boot(env);
 return {...api,elements,handlers,location,stored:()=>JSON.parse(stored)};
}

test('library and practice open original content after its task was deleted or relinked',async()=>{
 const saved=upgraded();
 saved.tasks=saved.tasks.filter(task=>!['task-quiz-base','task-lesson-base'].includes(task.id));
 saved.tasks.find(task=>task.id==='task-lab-controles').materialId='';
 const before=structuredClone(saved),app=await startApp(saved);
 for(const id of ['quiz-base','lesson-base','lab-controles']) {
  const material=app.state.materials.find(material=>material.id===id);
  assert.match(app.materialCard(material),new RegExp(`data-action="study-material" data-id="${id}"`));
  app.handlers.click({target:{closest:()=>({dataset:{action:'study-material',id}})},preventDefault(){}});
  assert.equal(app.elements['#modal'].open,true);
  const modal=app.elements['#modal'].innerHTML;
  if(id==='quiz-base') {
   assert.match(modal,/data-kind="research-quiz"/);
   assert.match(modal,/Corrigir respostas/);
  } else {
   assert.match(modal,/data-kind="study-material"/);
   assert.match(modal,/ut-content-details" open/);
   assert.doesNotMatch(modal,/type="submit"/);
   assert.match(modal,id==='lesson-base'?/Exemplo resolvido/:/Procedimento/);
  }
 }
 assert.match(app.library(true),/data-action="study-material" data-id="quiz-base"/);
 assert.deepEqual(app.state,before);
 assert.deepEqual(app.stored(),before);
});

test('deleting material suppresses access and cannot resurrect the stored content record',async()=>{
 const saved=upgraded();saved.materials=saved.materials.filter(material=>material.id!=='quiz-base');
 const app=await startApp(saved),before=app.elements['#modal'].innerHTML;
 app.studyMaterial('quiz-base');
 assert.equal(app.elements['#modal'].innerHTML,before);
 assert.equal(renderOriginalMaterial(app.state,research,'quiz-base',{}),'');
 assert(!app.state.materials.some(material=>material.id==='quiz-base'));
});

test('external material links and explicit trail deep links retain their destinations',async()=>{
 const saved=upgraded(),material=saved.materials.find(material=>material.id==='lesson-base');
 material.url='https://example.org/my-notes';
 const app=await startApp(saved,'#trilha/task-lesson-base');
 assert.match(app.materialCard(material),/href="https:\/\/example.org\/my-notes"/);
 assert.equal(originalMaterialAction(material,research),null);
 assert.equal(originalMaterialAction({...material,url:'https://fobos123deimos.github.io/orbita-fisica/#pesquisa-external'},research),null);
 assert.equal(app.location.hash,'#trilha/task-lesson-base');
 const legacy=await startApp(saved,'#pesquisa');assert.equal(legacy.location.hash,'#trilha');
});

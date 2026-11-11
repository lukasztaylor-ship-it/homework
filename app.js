import { createQuestions, exerciseModes, normalizeAnswer } from './engine.js';
import { starterCards } from './vocabulary.js';
import { parseImport, mergeCards } from './library.js';
const KEY='lexiforge-exercises-web-v1', $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cards=[], settings={deck:'all',count:10,accent:'en-GB',rate:1,autoplay:true}, view='practice', session=null, search='', libraryDeck='all', locked=false, storageError='', originalStorage='';
const supported='speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const icons={gap:'▤',choice:'☷',translation:'A↔',listening:'♫',matching:'◇',mixed:'⇄'};
try{
 originalStorage=localStorage.getItem(KEY)||'';
 if(originalStorage){const data=JSON.parse(originalStorage);if(data.version!==1||!Array.isArray(data.cards))throw Error('Unsupported saved list.');cards=validateSaved(data.cards);if(data.settings)settings={...settings,...data.settings};}
 else{cards=structuredClone(starterCards);localStorage.setItem(KEY,JSON.stringify({version:1,cards,settings}));}
}catch(error){storageError=error.message;cards=[];}
function validateSaved(items){if(items.length>5000)throw Error('Saved list is too large.');const ids=new Set();return items.map(c=>{if(!Number.isSafeInteger(c.id)||ids.has(c.id)||typeof c.expression!=='string'||!c.expression.trim()||c.expression.length>300||typeof c.translation!=='string'||!c.translation.trim()||c.translation.length>300||typeof c.example!=='string'||c.example.length>1000||typeof c.deck!=='string'||!c.deck.trim())throw Error('The saved list contains an invalid card.');ids.add(c.id);return {...c,type:'Phrase'};});}
function persist(next=cards){try{localStorage.setItem(KEY,JSON.stringify({version:1,cards:next,settings}));cards=next;return true;}catch{notice('Could not save to this browser. Your current list has been kept. Export a backup and free some browser storage.');return false;}}
function notice(text=''){ $('#notice').textContent=text; }
function stop(){if(supported)speechSynthesis.cancel();}
function speak(text){
 stop();if(!supported){audioMessage('Speech playback is not supported in this browser. Try Edge, Chrome or Safari.');return;}
 const voices=speechSynthesis.getVoices().filter(v=>/^en([-_]|$)/i.test(v.lang));
 const voice=voices.find(v=>v.lang.toLowerCase()===settings.accent.toLowerCase())||voices.find(v=>v.localService)||voices[0];
 if(!voice){audioMessage('No English voice is ready. Install or enable an English system voice, then press Play again.');return;}
 const u=new SpeechSynthesisUtterance(text);u.voice=voice;u.lang=voice.lang;u.rate=Number(settings.rate)||1;
 u.onend=()=>audioMessage('');u.onerror=()=>audioMessage('Audio could not play. Press Play to try again.');
 speechSynthesis.speak(u);audioMessage('Playing English pronunciation…');
}
function audioMessage(text){const node=$('.audio-status');if(node)node.textContent=text;else notice(text);}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
addEventListener('pagehide',stop);if(supported)speechSynthesis.getVoices();
function decks(){return [...new Set(cards.map(c=>c.deck))].sort((a,b)=>a.localeCompare(b));}
function options(value){return '<option value="all">All decks</option>'+decks().map(d=>'<option value="'+esc(d)+'" '+(d===value?'selected':'')+'>'+esc(d)+'</option>').join('');}
function pool(){return cards.filter(c=>settings.deck==='all'||c.deck===settings.deck);}
function questions(mode,count=Number(settings.count)){const result=createQuestions(pool(),supported?count:count*2,mode);return supported?result:result.filter(q=>q.type!=='listening').slice(0,count);}
function updateNav(){ $('#word-count').textContent=cards.length;document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===view));}
function render(){
 updateNav();if(storageError){$('#main').innerHTML='<section class="empty"><h1>Your browser list needs attention</h1><p>'+esc(storageError)+'</p><p>The saved data has not been changed. Download a recovery copy before repairing browser storage.</p><button class="primary" data-action="recovery">Download recovery copy</button></section>';return;}
 if(session){renderQuestion();return;}
 if(view==='vocabulary')renderLibrary();else renderSetup();
}
function renderSetup(){
 if(!decks().includes(settings.deck))settings.deck='all';
 $('#main').innerHTML='<div class="intro"><div><p class="eyebrow">Your daily English practice</p><h1>Choose your practice</h1><p>Build confidence with phrases you can use every day. Pick an exercise and get straight into practice.</p></div><span class="pill">'+cards.length+' phrases in your list</span></div><section class="setup" aria-label="Practice settings"><label>Vocabulary deck<select id="deck" aria-label="Vocabulary deck">'+options(settings.deck)+'</select></label><label>Number of questions<select id="count" aria-label="Number of questions">'+[5,10,20,31].map(n=>'<option '+(n===Number(settings.count)?'selected':'')+'>'+n+'</option>').join('')+'</select></label><button class="quiet" data-view="vocabulary">Manage vocabulary</button></section><details class="settings"><summary>Pronunciation settings</summary><div class="audio-fields"><label>English accent<select id="accent" aria-label="English accent"><option value="en-GB" '+(settings.accent==='en-GB'?'selected':'')+'>British English</option><option value="en-US" '+(settings.accent==='en-US'?'selected':'')+'>American English</option></select></label><label>Playback speed<select id="rate" aria-label="Playback speed">'+[.75,1,1.25].map(n=>'<option value="'+n+'" '+(Number(settings.rate)===n?'selected':'')+'>'+n+'×</option>').join('')+'</select></label><label class="check"><input type="checkbox" id="autoplay" '+(settings.autoplay?'checked':'')+'>Play examples after checking</label><button class="quiet" data-action="preview-voice">Test voice</button></div><p>Uses an English voice installed on your device. Available voices depend on your browser and operating system. No AI generation quota is used.</p><p class="audio-status" role="status"></p></details><div class="modes">'+exerciseModes.map(m=>{
 const ready=questions(m.id).length;return '<button class="mode-card" data-mode="'+m.id+'" '+(!ready?'disabled':'')+'><span class="mode-icon" aria-hidden="true">'+icons[m.id]+'</span><span><h2>'+m.title+'</h2><p>'+m.description+'</p><small>'+(!supported&&m.id==='listening'?'Speech is unavailable in this browser':ready?ready+' '+(m.id==='matching'?'rounds':'questions')+' ready':'Add more suitable phrases to practise')+'</small></span><span class="chevron" aria-hidden="true">›</span></button>';}).join('')+'</div><p class="tip">Your '+starterCards.length+' supplied everyday phrases are included. Matching pairs counts each group as one question. Short lists may produce fewer questions.</p>';
}
function renderLibrary(){
 $('#main').innerHTML='<div class="intro"><div><p class="eyebrow">Your separate vocabulary list</p><h1>My vocabulary</h1><p>Start with your 31 everyday phrases, then make this list your own.</p></div><button class="primary" data-action="add">+ Add phrase</button></div><div class="toolbar"><input class="search" id="search" type="search" aria-label="Search vocabulary" placeholder="Search English or Polish…" value="'+esc(search)+'"><select id="library-deck" aria-label="Filter vocabulary deck" style="width:auto">'+options(libraryDeck)+'</select><button class="quiet" data-action="import">Import list</button><button class="quiet" data-action="export">Export backup</button></div><div class="table-wrap"><table><caption class="visually-hidden">English phrases with Polish translations</caption><thead><tr><th>English phrase & example</th><th>Polish translation</th><th>Deck</th><th>Actions</th></tr></thead><tbody>'+cards.map(c=>'<tr data-card="'+c.id+'"><td><strong>'+esc(c.expression)+'</strong><span class="example-text">'+esc(c.example)+'</span></td><td>'+esc(c.translation)+'</td><td><span class="deck-tag">'+esc(c.deck)+'</span></td><td><div class="row-actions"><button class="quiet" data-action="edit" data-id="'+c.id+'" aria-label="Edit '+esc(c.expression)+'">Edit</button><button class="danger" data-action="delete" data-id="'+c.id+'" aria-label="Delete '+esc(c.expression)+'">Delete</button></div></td></tr>').join('')+'</tbody></table></div><p id="filtered-count" class="tip"></p>'+(!cards.length?'<section class="empty"><h2>Your list is ready for its first phrase</h2><p>Add a phrase or import an English–Polish list to start practising.</p><button class="primary" data-action="add">Add phrase</button></section>':'');
 filterRows();
}
function filterRows(){let count=0;document.querySelectorAll('tr[data-card]').forEach(row=>{const card=cards.find(c=>c.id===Number(row.dataset.card));row.hidden=!(libraryDeck==='all'||card.deck===libraryDeck)||!normalizeAnswer([card.expression,card.translation,card.example].join(' ')).includes(normalizeAnswer(search));if(!row.hidden)count++;});if($('#filtered-count'))$('#filtered-count').textContent=count+' of '+cards.length+' phrases shown';}
function start(mode){const list=questions(mode);if(!list.length){notice('Add more suitable vocabulary for this exercise first.');return;}stop();notice();session={mode,questions:list,index:0,answer:'',checked:false,correct:0,mistakes:[],matched:new Set(),selected:null,perfect:true,message:'Choose an English phrase, then its Polish translation.'};locked=false;render();scrollTo(0,0);focusAnswer();}
function current(){return session?.questions[session.index];}
function focusAnswer(){requestAnimationFrame(()=>($('#answer')||$('#next'))?.focus({preventScroll:true}));}
function isRight(q){return q.type==='matching'?session.perfect:normalizeAnswer(session.answer)===normalizeAnswer(q.answer);}
function renderQuestion(){
 const q=current();if(!q){renderResults();return;}const n=session.index+1;
 $('#main').innerHTML='<div class="practice-top"><button class="quiet" data-action="exit">← Exit practice</button><p>'+esc(exerciseModes.find(m=>m.id===session.mode).title)+'</p></div><section class="question-panel" aria-label="Practice question"><div class="question-meta"><span>'+esc(exerciseModes.find(m=>m.id===q.type).title)+'</span><span>Question '+n+' of '+session.questions.length+'</span></div><progress aria-label="Practice progress" value="'+session.index+'" max="'+session.questions.length+'"></progress>'+questionBody(q)+(session.checked?feedback(q):'')+'<p class="audio-status" role="status"></p><div class="question-actions">'+(session.checked?'<button id="next" class="primary" data-action="next" title="Press Enter to continue">'+(n===session.questions.length?'See results':'Next →')+'</button><span class="helper"><kbd>Enter</kbd> to continue</span>':q.type!=='matching'?'<button id="check" class="primary" data-action="check" '+(!session.answer.trim()?'disabled':'')+'>Check answer</button><span class="helper"><kbd>Enter</kbd> to check</span>':'')+'</div></section>';
 if(session.checked)$('#next').focus({preventScroll:true});
}
function questionBody(q){
 if(q.type==='matching')return '<h2>Match the phrases</h2><p class="question-label">Choose an English phrase and its Polish translation.</p><div class="matching"><div role="group" aria-label="English phrases">'+q.pairs.map(p=>pairButton(p,'left')).join('')+'</div><div role="group" aria-label="Polish translations">'+q.translations.map(p=>pairButton(p,'right')).join('')+'</div></div><p class="match-status" role="status">'+esc(session.message)+' '+session.matched.size+' / '+q.pairs.length+' pairs</p>';
 let body=q.type==='listening'?'<div class="listening-center"><p class="question-label">Listen and type the English phrase.</p><button class="play" data-action="listen-prompt">♫ Play audio</button><button class="link" data-action="stop">Stop</button></div>':'<div class="question-prompt">'+esc(q.prompt)+'</div>';
 if(q.type==='gap')body+='<p class="question-label">Polish meaning: '+esc(q.translation)+'</p>';
 if(q.type==='translation')body+='<p class="question-label">Translate into English using a phrase from your list.</p>';
 if(q.type==='choice')body+='<div class="choice-grid" role="group" aria-label="Answer choices">'+q.options.map((o,i)=>'<button data-choice="'+i+'" aria-pressed="'+(session.answer===o)+'" class="'+(session.answer===o?'selected':'')+'" '+(session.checked?'disabled':'')+'>'+esc(o)+'</button>').join('')+'</div>';
 else body+='<label for="answer">Your answer</label><input id="answer" type="text" value="'+esc(session.answer)+'" autocomplete="off" autocapitalize="off" spellcheck="false" '+(session.checked?'disabled':'')+'>';
 return body;
}
function pairButton(p,side){const done=session.matched.has(p.id);return '<button data-pair="'+p.id+'" data-side="'+side+'" class="'+(done?'matched':session.selected===p.id&&side==='left'?'selected':'')+'" '+(done||(side==='right'&&session.selected===null)?'disabled':'')+' aria-pressed="'+(side==='left'&&session.selected===p.id)+'">'+esc(side==='left'?p.expression:p.translation)+(done?' ✓':'')+'</button>';}
function feedback(q){const right=isRight(q);if(q.type==='matching')return '<div class="feedback '+(right?'good':'bad')+'"><h3>'+(right?'All pairs correct!':'Round complete')+'</h3><p>'+(right?'Every pair matched on the first try.':'Keep practising these phrases to build confidence.')+'</p></div>';
 return '<div class="feedback '+(right?'good':'bad')+'"><h3>'+(right?'✓ Correct!':'Not quite — keep practising')+'</h3>'+(!right?'<p>Your answer: '+esc(session.answer)+'</p>':'')+'<p>Correct answer: <strong>'+esc(q.answer)+'</strong> <button class="link" data-action="listen-answer" aria-label="Play correct answer">♫ Play</button></p>'+(q.example?'<p class="example-text">'+esc(q.example)+'</p><button class="play" data-action="listen-example">♫ Play example</button>':'')+'</div>';
}
function check(){const q=current();if(!q||q.type==='matching'||session.checked)return;if(q.type!=='choice')session.answer=$('#answer').value;if(!session.answer.trim())return;session.checked=true;renderQuestion();if(settings.autoplay&&q.example)speak(q.example);}
function match(id,side){const q=current();if(!q||q.type!=='matching'||session.checked||session.matched.has(id))return;if(side==='left'){session.selected=id;renderQuestion();return;}if(session.selected===null)return;
 if(session.selected!==id){session.perfect=false;session.selected=null;session.message='Not a match. Try another pair.';renderQuestion();return;}
 session.matched.add(id);session.selected=null;session.message='Matched!';if(session.matched.size===q.pairs.length)session.checked=true;renderQuestion();const example=q.pairs.find(p=>p.id===id).example;if(settings.autoplay&&example)speak(example);
}
function advance(){const q=current();if(!q||!session.checked||locked)return;locked=true;if(isRight(q))session.correct++;else session.mistakes.push(q);stop();session.index++;session.answer='';session.checked=false;session.matched=new Set();session.selected=null;session.perfect=true;session.message='Choose an English phrase, then its Polish translation.';renderQuestion();scrollTo(0,0);focusAnswer();requestAnimationFrame(()=>{locked=false;});}
function renderResults(){
 const total=session.questions.length, percent=Math.round(session.correct/total*100),misses=session.mistakes.flatMap(q=>q.type==='matching'?q.pairs.map(p=>({english:p.expression,polish:p.translation})): [{english:q.answer,polish:q.type==='choice'?q.prompt:q.translation}]);
 $('#main').innerHTML='<section class="results" aria-label="Practice results"><p class="eyebrow">Session complete</p><h1>Practice makes progress.</h1><div class="score-ring">'+percent+'%</div><h2>'+session.correct+' / '+total+' correct</h2><p>A small step today makes the next conversation easier.</p><div class="toolbar result-actions"><button class="primary" data-action="again">Practise again</button><button class="quiet" data-action="choose">Choose another exercise</button></div>'+(misses.length?'<div class="mistakes"><h2>Worth another look</h2><ul>'+misses.map(p=>'<li><strong>'+esc(p.english)+'</strong><span>'+esc(p.polish)+'</span></li>').join('')+'</ul></div>':'<p class="pill">All answers correct. Nicely done!</p>')+'</section>';
}
function openDialog(html){const d=$('#dialog');d.innerHTML=html;d.showModal();}
function closeDialog(){$('#dialog').close();$('#dialog').innerHTML='';}
function wordDialog(id){const c=cards.find(c=>c.id===id)||{expression:'',translation:'',example:'',deck:settings.deck==='all'?'Everyday English':settings.deck};
 openDialog('<h2 id="dialog-title">'+(id?'Edit phrase':'Add a phrase')+'</h2><p>Keep the English phrase, Polish meaning and a simple example together.</p><form id="word-form" data-edit="'+(id||'')+'"><label>English phrase<input aria-label="English phrase" name="expression" required maxlength="300" value="'+esc(c.expression)+'" autofocus></label><label>Polish translation<input aria-label="Polish translation" name="translation" required maxlength="300" value="'+esc(c.translation)+'"></label><label>Example sentence<textarea aria-label="Example sentence" name="example" maxlength="1000">'+esc(c.example)+'</textarea></label><label>Deck<input aria-label="Deck" name="deck" list="deck-list" maxlength="100" required value="'+esc(c.deck)+'"><datalist id="deck-list">'+decks().map(d=>'<option value="'+esc(d)+'">').join('')+'</datalist></label><p class="error" id="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="quiet" data-action="close-dialog">Cancel</button><button type="submit" name="continue" value="yes">Save & add another</button><button type="submit" class="primary">Save phrase</button></div></form>');
}
function importDialog(){openDialog('<h2 id="dialog-title">Import vocabulary</h2><p>Paste one phrase per line: <strong>English; Polish; Example; Deck</strong>. Example and deck are optional. CSV, TSV and this app’s JSON backups are supported.</p><form id="import-form"><label>Choose a file<input id="import-file" type="file" accept=".csv,.tsv,.txt,.json"></label><label>Or paste your list<textarea aria-label="Or paste your list" id="import-text" rows="8" placeholder="Hello!;Cześć!;Hello! It is good to see you.;Everyday English"></textarea></label><p class="helper">Imported phrases are added to your current list. Exact duplicates in the same deck are skipped.</p><p class="error" id="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="quiet" data-action="close-dialog">Cancel</button><button class="primary" type="submit">Import phrases</button></div></form>');}
function download(content,name,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button||button.disabled)return;
 if(button.dataset.view){stop();session=null;view=button.dataset.view;notice();render();scrollTo(0,0);return;}
 if(button.dataset.mode){start(button.dataset.mode);return;}
 if(button.dataset.choice!==undefined){session.answer=current().options[Number(button.dataset.choice)];renderQuestion();return;}
 if(button.dataset.pair){match(Number(button.dataset.pair),button.dataset.side);return;}
 const action=button.dataset.action;
 if(action==='check')check();if(action==='next')advance();
 if(action==='exit'||action==='choose'){stop();session=null;view='practice';render();scrollTo(0,0);}
 if(action==='again')start(session.mode);
 if(action==='listen-prompt')speak(current().answer);
 if(action==='listen-answer')speak(current().answer);
 if(action==='listen-example')speak(current().example);
 if(action==='preview-voice')speak('Hello! How are you?');
 if(action==='stop')stop();
 if(action==='add')wordDialog();
 if(action==='edit')wordDialog(Number(button.dataset.id));
 if(action==='delete'){const c=cards.find(c=>c.id===Number(button.dataset.id));openDialog('<h2 id="dialog-title">Delete this phrase?</h2><p>'+esc(c.expression)+' — '+esc(c.translation)+'</p><p>This removes it from this browser’s list.</p><div class="dialog-actions"><button class="quiet" data-action="close-dialog">Cancel</button><button class="danger" data-action="confirm-delete" data-id="'+c.id+'">Delete phrase</button></div>');}
 if(action==='confirm-delete'){if(persist(cards.filter(c=>c.id!==Number(button.dataset.id)))){closeDialog();render();notice('Phrase deleted from your browser list.');}}
 if(action==='close-dialog')closeDialog();
 if(action==='import')importDialog();
 if(action==='export')download(JSON.stringify({version:1,cards,settings},null,2),'lexiforge-vocabulary.json');
 if(action==='recovery')download(originalStorage,'lexiforge-recovery.json','text/plain');
});
document.addEventListener('input',e=>{
 if(e.target.id==='answer'&&session&&!session.checked){session.answer=e.target.value;$('#check').disabled=!e.target.value.trim();}
 if(e.target.id==='search'){search=e.target.value;filterRows();}
});
document.addEventListener('change',async e=>{
 const id=e.target.id;
 if(['deck','count','accent','rate','autoplay'].includes(id)){settings[id]=id==='autoplay'?e.target.checked:e.target.value;persist();if(id==='deck'||id==='count')renderSetup();if(id==='accent'||id==='rate')stop();}
 if(id==='library-deck'){libraryDeck=e.target.value;filterRows();}
 if(id==='import-file'){try{const file=e.target.files[0];if(!file)return;if(file.size>2*1024*1024)throw Error('Choose a file smaller than 2 MB.');$('#import-text').value=await file.text();$('#form-error').textContent='';}catch(error){$('#form-error').textContent=error.message;}}
});
document.addEventListener('submit',e=>{
 if(e.target.id==='word-form'){
  e.preventDefault();const f=e.target,data=new FormData(f),id=Number(f.dataset.edit),expression=String(data.get('expression')).trim(),translation=String(data.get('translation')).trim(),example=String(data.get('example')).trim(),deck=String(data.get('deck')).trim();
  if(!expression||!translation||!deck){$('#form-error').textContent='Enter an English phrase, Polish translation and deck.';return;}
  if(cards.some(c=>c.id!==id&&normalizeAnswer(c.expression)===normalizeAnswer(expression)&&normalizeAnswer(c.translation)===normalizeAnswer(translation)&&c.deck===deck)){$('#form-error').textContent='This phrase and translation already exist in that deck.';return;}
  const card={id:id||Math.max(0,...cards.map(c=>c.id))+1,expression,translation,example,deck,deckId:1,type:'Phrase'};
  if(cards.length>=5000&&!id){$('#form-error').textContent='Your list can contain up to 5,000 phrases.';return;}
  if(!persist(id?cards.map(c=>c.id===id?card:c):[...cards,card]))return;
  const another=e.submitter?.value==='yes';closeDialog();render();notice('Phrase saved in this browser.');if(another)wordDialog();
 }
 if(e.target.id==='import-form'){e.preventDefault();try{const incoming=parseImport($('#import-text').value),merged=mergeCards(cards,incoming);if(persist(merged.cards)){closeDialog();render();notice(merged.added+' phrases imported · '+merged.skipped+' duplicates skipped.');}}catch(error){$('#form-error').textContent=error.message;}}
});
document.addEventListener('keydown',e=>{
 if(e.key!=='Enter')return;
 if(e.isComposing||e.repeat){if(session||$('#dialog').open)e.preventDefault();return;}
 if(e.target.id==='answer'&&session&&!session.checked&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();check();}
 if((e.ctrlKey||e.metaKey)&&$('#word-form')){e.preventDefault();const f=$('#word-form');if(f.reportValidity())f.requestSubmit(f.querySelector('[name="continue"]'));}
});
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();stop();session=null;view='practice';notice();render();scrollTo(0,0);});
render();

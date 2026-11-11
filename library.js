import { normalizeAnswer } from './engine.js';
export function parseImport(text){
 text=text.replace(/^\uFEFF/,'').trim();if(!text)throw Error('Paste a list or choose a file first.');if(text.length>2*1024*1024)throw Error('The list must be smaller than 2 MB.');
 let rows;
 if(text.startsWith('[')||text.startsWith('{')){
  let parsed;try{parsed=JSON.parse(text);}catch{throw Error('This JSON file is not valid.');}
  const items=Array.isArray(parsed)?parsed:parsed.cards;
  if(!Array.isArray(items))throw Error('Use an exported vocabulary backup or an array of phrases.');
  rows=items.map(c=>[c?.expression,c?.translation,c?.example??'',c?.deck??'Everyday English']);
 }else{
  const first=text.split(/\r?\n/,1)[0],delimiter=first.includes('\t')?'\t':first.includes(';')?';':',';
  rows=parseDelimited(text,delimiter);
  if(rows[0]&&/^(english|expression|english phrase)$/i.test(rows[0][0].trim())&&/^(polish|translation|polish translation)$/i.test(rows[0][1]?.trim()??''))rows.shift();
 }
 if(!rows.length)throw Error('No phrases were found.');if(rows.length>5000)throw Error('Import up to 5,000 phrases at a time.');
 return rows.map((row,i)=>{
  if(row.length<2||row.length>4)throw Error('Row '+(i+1)+': use English; Polish; Example; Deck.');
  const [expression,translation,example='',deck='Everyday English']=row;
  if(typeof expression!=='string'||!expression.trim()||expression.length>300||typeof translation!=='string'||!translation.trim()||translation.length>300||typeof example!=='string'||example.length>1000||typeof deck!=='string'||deck.length>100)throw Error('Row '+(i+1)+': enter English and Polish text (up to 300 characters), an optional example (up to 1,000), and an optional deck (up to 100).');
  return {expression:expression.trim(),translation:translation.trim(),example:example.trim(),deck:deck.trim()||'Everyday English',deckId:1,type:'Phrase'};
 });
}
export function parseDelimited(text,delimiter){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++;}
   else if(quoted||!field.trim())quoted=!quoted;
   else field+=c;
  }else if(c===delimiter&&!quoted){row.push(field);field='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(s=>s.trim()))rows.push(row);row=[];field='';}
  else field+=c;
 }
 if(quoted)throw Error('A quoted field is missing its closing quote.');
 row.push(field);if(row.some(s=>s.trim()))rows.push(row);
 return rows;
}
export function mergeCards(existing,incoming){
 const key=c=>JSON.stringify([normalizeAnswer(c.expression),normalizeAnswer(c.translation),c.deck.toLocaleLowerCase()]);
 const keys=new Set(existing.map(key)),cards=[...existing];let id=Math.max(0,...existing.map(c=>c.id)),added=0,skipped=0;
 for(const card of incoming){if(keys.has(key(card))){skipped++;continue;}if(cards.length>=5000)throw Error('The list would exceed 5,000 phrases. Your current list has not been changed.');keys.add(key(card));cards.push({...card,id:++id});added++;}
 return {cards,added,skipped};
}

const w=require('wanakana');
const fs=require('fs');
const C=require('path').join(__dirname,'..','..','..','app','src','content')+'/';
const vocab=JSON.parse(fs.readFileSync(C+'vocab.json','utf8'));
const kana=JSON.parse(fs.readFileSync(C+'kana.json','utf8'));
let bad=[];let skipped=0;
const vow={a:'あ',i:'い',u:'う',e:'え',o:'お'};
function expand(s){let out='';for(const ch of s){if(ch==='ー'){const r=w.toRomaji(out.slice(-1));out+=vow[r.slice(-1)]||'ー';}else out+=ch;}return out;}
for(const x of vocab){
  if(/[ぁぃぅぇぉ]|[ァィゥェォ]|ぢ|づ|ヂ|ヅ/.test(x.kana)||x.pos==='particle'||/こんにちは|こんばんは/.test(x.kana)||/を/.test(x.kana)){skipped++;continue;}
  const exp=w.toHiragana(expand(x.kana));
  const back=w.toKana(x.romaji.replace(/-/g,''));
  if(exp!==back) bad.push(['vocab',x.id,x.kana,x.romaji,back]);
}
for(const k of kana){
  const f=k.script==='katakana'?w.toKatakana:w.toHiragana;
  const cands=[k.romaji,...(k.alt||[])];
  const ok=cands.some(r=>(k.script==='katakana'?w.toKatakana(r):w.toKana(r))===k.char);
  if(!ok) bad.push(['kana',k.char,k.romaji,cands.map(r=>w.toKana(r))]);
}
console.log('roundtrip skipped',skipped,'bad',bad.length);
for(const b of bad.slice(0,40)) console.log(JSON.stringify(b));

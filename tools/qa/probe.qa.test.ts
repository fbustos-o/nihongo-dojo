import { renderKana } from '../../app/src/domain/renderPlan';
import { checkAnswer } from '../../app/src/engine/answer';
test('probe', () => {
  const known = new Set(['き','ゃ'].slice(0,1).concat(['きゃ','く','あ','い','う','え','お','か','ょ'.slice(0,0)]));
  console.log(JSON.stringify(renderKana('きゃく', known)));
  console.log(JSON.stringify(renderKana('きょう', new Set(['き','きょ','う']))));
  for (const [i,e,o] of [['konnichiwa','こんにちは',{}],['kinen','きんえん',{}],["kin'en",'きんえん',{}],['ko-hi-','コーヒー',{}],['koohii','コーヒー',{}],['kouhii','コーヒー',{}],['wa','は',{strict:true}],['ha','は',{strict:true}],['kitte','きって',{}],['kite','きって',{}],['onna','おんな',{}],['ona','おんな',{}],['ガッコウ','がっこう',{}],['nn','ん',{}],['n','ん',{}],['わたしわがくせいです','わたしはがくせいです',{}]] as const) console.log(i,e,checkAnswer(i,e,o as any).correct);
});

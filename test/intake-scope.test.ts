import test from 'node:test';
import assert from 'node:assert/strict';
import {detect} from '../src/catalog/intake-map.js';
test('numeric special-angle evaluation maps the task, not every prerequisite',()=>{
 for(const text of ['Tentukan nilai cos30','Hitung cos(30°)','cos 30 derajat','trigonometri sinus sudut 30 derajat','tangen 45°','sin 0° + cos 90°'])
  assert.deepEqual(detect(text).cores,['tri-f'],text);
 assert.deepEqual(detect('Hitung 2³ × cos 60°').cores,['tri-f','eks-b']);
});
test('geometry and symbolic tasks retain modelling concepts',()=>{
 assert.deepEqual(detect('Menara tinggi 20 m, sudut depresi 30°, tentukan jarak').cores,['tri-c','tri-d','tri-f','tri-p']);
 assert.deepEqual(detect('Segitiga siku-siku, sisi miring 10 cm, sudut 30°, cari sisi depan').cores,['tri-c','tri-d','tri-f']);
 assert.deepEqual(detect('Buktikan identitas cos 30° = sin 60°').cores,['tri-c','tri-d','tri-f']);
 assert.deepEqual(detect('sin x + cos 30°').cores,['tri-c','tri-d','tri-f']);
 assert.ok(!detect('cos 300°').cores.includes('tri-f'));
 assert.deepEqual(detect('Apa ibu kota Jakarta?').cores,[]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { project } from '../src/model.js';
import { wav, zip, unzip, packProject, unpackProject, crc32 } from '../src/format.js';
import { makeAsset } from '../src/storage.js';
test('PCM WAV writes correct headers and applies monitor once',()=>{
  const bytes=wav(Float32Array.of(-1,0,1),48000,.5),v=new DataView(bytes.buffer);
  assert.equal(new TextDecoder().decode(bytes.subarray(0,4)),'RIFF');
  assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint16(22,true),1);assert.equal(v.getUint32(40,true),6);
  assert.equal(v.getInt16(44,true),-16384);assert.equal(v.getInt16(48,true),16384);
  assert.throws(()=>wav(Float32Array.of(NaN),48000));
});
test('stored ZIP round-trips and rejects unsafe/corrupt archive entries',()=>{
  const entries={'project.json':'{"hello":1}','manifest.json':'{}'},bytes=zip(entries);
  assert.equal(new TextDecoder().decode(unzip(bytes)['project.json']),entries['project.json']);
  bytes[40]^=1;assert.throws(()=>unzip(bytes));
  assert.throws(()=>unzip(zip({'../project.json':'{}'})),/Unsafe/);
  assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);
});
test('portable bundle owns immutable assets and reproduces PCM without database state',async()=>{
  const p=project(),a=await makeAsset(Float32Array.of(0,.3,-.4),48000,'source');
  p.assets=[a.id];p.modulation.sourceId=a.id;p.modulation.enabled=true;
  const bytes=await packProject(p,{[a.id]:a}),round=await unpackProject(bytes);
  assert.deepEqual(round.project,p);assert.deepEqual(round.assets[a.id].samples,a.samples);
  const entries=unzip(bytes);delete entries['audio/'+a.id+'.f32'];
  assert.throws(()=>unzip(new Uint8Array(32*1024**2+1)),/size/);
  await assert.rejects(unpackProject(zip(entries)),/Missing/);
});

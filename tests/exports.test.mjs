import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { project } from '../src/model.js';
import { render } from '../src/render.js';
import { signalData, evaluateSignal, javascript, python, csv, exportScope } from '../src/exports.js';
import { phaseAt } from '../src/signal.js';
test('source functions preserve DC and analytically integrated envelope pitch',()=>{
  const p=project();p.mode='envelope';p.duration=.1;p.voices[0].pitch=[[0,220],[.4,880],[1,330]];
  p.voices[0].waveform.strokes=[{tool:'line',points:Array.from({length:1025},(_,i)=>[i/1024,.2+.5*Math.sin(2*Math.PI*i/1024)])}];
  p.voices[0].gain=[[0,.4],[1,.4]];
  const data=signalData(p);
  for(const t of [0,.01,.0399,.04,.0401,.07,.099]){
    const expected=.4*(.2+.5*Math.sin(2*Math.PI*phaseAt(p.voices[0].pitch,t,p.duration,440)));
    assert.ok(Math.abs(evaluateSignal(data,t)-expected)<2e-6);
  }
  assert.equal(evaluateSignal(data,-.1),0);assert.equal(evaluateSignal(data,.1),0);
});
test('standalone JS and Python reproduce source, modulation, and monitored render tables',async()=>{
  const p=project();p.duration=.035;p.monitor=.23;p.assets=['mod'];
  p.modulation={...p.modulation,enabled:true,mode:'pitch',target:'oscillator',sourceId:'mod',semitones:12};
  const assets={mod:{samples:new Float32Array(4800).fill(.5),sampleRate:48000}};
  const rendered=await render(p,assets,{includeSource:true}),data=signalData(p,rendered,assets),times=[-.01,0,.003,.01,.034,.035,.06];
  const module=await import('data:text/javascript;base64,'+Buffer.from(javascript(data)).toString('base64'));
  const kinds=['source','modulated','rendered'],expected=kinds.map(kind=>times.map(t=>evaluateSignal(data,t,kind)));
  assert.deepEqual(kinds.map(kind=>times.map(t=>module.signal(t,kind))),expected);
  const dir=await mkdtemp(join(tmpdir(),'sigint-export-'));
  try{
    await writeFile(join(dir,'signal.py'),python(data)+'\nprint(json.dumps([[signal(t, k) for t in '+JSON.stringify(times)+'] for k in '+JSON.stringify(kinds)+']))\n');
    const result=spawnSync('python3',[join(dir,'signal.py')],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);const actual=JSON.parse(result.stdout);
    actual.forEach((row,i)=>row.forEach((v,j)=>assert.ok(Math.abs(v-expected[i][j])<1e-6)));
  }finally{await rm(dir,{recursive:true,force:true});}
  assert.ok(Math.abs(evaluateSignal(data,480/48000,'rendered')-rendered.samples[480]*.23)<1e-7);
  assert.match(csv(data,'rendered'),/time_seconds,amplitude/);
});
test('selected voice exports are independent and periodic function wraps negative time',()=>{
  const p=project(),other=structuredClone(p.voices[0]);other.id='other';other.color=1;p.voices.push(other);p.voices[0].muted=true;
  const before=structuredClone(p),q=exportScope(p,'selected');assert.deepEqual(p,before);
  assert.equal(q.voices[0].muted,false);assert.equal(q.voices[0].solo,true);assert.equal(q.voices[1].solo,false);
  const data=signalData(q),id=q.selectedId;
  assert.ok(Math.abs(evaluateSignal(data,-.0001,'oscillator',id)-evaluateSignal(data,1/440-.0001,'oscillator',id))<1e-9);
  assert.equal(data.voices[0].coefficients.a.length,2049);
});

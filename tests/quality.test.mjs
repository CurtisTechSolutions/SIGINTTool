import test from 'node:test';
import assert from 'node:assert/strict';
import { project, voice, preset } from '../src/model.js';
import { render } from '../src/render.js';
import { downsample, decimationFilter } from '../src/resample.js';
test('independent oscillator phases cancel and muted/solo selections remain silent',async()=>{
  const p=project();p.duration=.04;const other=voice(1);other.phase=.5;p.voices.push(other);
  let out=await render(p);assert.ok(out.peak<1e-6);
  p.voices.forEach(v=>{v.muted=true;v.solo=true;});out=await render(p);assert.ok(out.samples.every(x=>x===0));
});
test('low-pass rejects ring sum above Nyquist and retains difference tone',async()=>{
  const p=project();p.duration=.12;p.voices[0].hz=14000;p.voices[0].source='sine';p.assets=['mod'];p.modulation={...p.modulation,enabled:true,mode:'ring',depth:1,sourceId:'mod'};
  const assets={mod:{sampleRate:48000,samples:Float32Array.from({length:9600},(_,i)=>Math.sin(2*Math.PI*13000*i/48000))}};
  const result=await render(p,assets);
  const mag=hz=>{let a=0,b=0;for(let i=960;i<4800;i++){a+=result.samples[i]*Math.cos(2*Math.PI*hz*i/48000);b+=result.samples[i]*Math.sin(2*Math.PI*hz*i/48000);}return 2*Math.hypot(a,b)/3840;};
  assert.ok(mag(1000)>.30);assert.ok(mag(21000)<.002);
});
test('maximum numerical source stays finite and preserves one global attenuation',async()=>{
  const p=project();p.duration=.02;p.voices=Array.from({length:4},(_,i)=>{const v=voice(i);v.waveform.resolution=16384;v.waveform.strokes=preset('square');v.hz=200+i*11;return v;});p.selectedId=p.modulation.oscillatorId=p.voices[0].id;
  const out=await render(p);assert.ok(out.attenuation<1);assert.ok(out.peak<=.950001);assert.ok(out.samples.every(Number.isFinite));
});

test('geometric pitch stepping tracks an independent logarithmic sweep phase',async()=>{
  const p=project();p.mode='envelope';p.duration=.15;p.voices[0].source='sine';p.voices[0].pitch=[[0,200],[1,1000]];
  const r=await render(p),q=Math.log(5)/p.duration;
  let squared=0,count=0;
  for(let i=960;i<6000;i++){const t=i/48000,expected=.7*Math.sin(2*Math.PI*200*Math.expm1(q*t)/q);squared+=(r.samples[i]-expected)**2;count++;}
  assert.ok(Math.sqrt(squared/count)<.001);
});

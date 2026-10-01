import test from 'node:test';
import assert from 'node:assert/strict';
import { project } from '../src/model.js';
import { render } from '../src/render.js';
import { decimationFilter, resamplePCM } from '../src/resample.js';
test('one headroom attenuation preserves silence and caps the finite mix',async()=>{
  const p=project();p.mode='envelope';p.duration=.06;
  p.voices[0].gain=[[0,0],[1,0]];
  const silent=await render(p);assert.ok(silent.samples.every(x=>x===0));
  p.voices[0].gain=[[0,1],[1,1]];
  const v=structuredClone(p.voices[0]);v.id='other';v.color=1;p.voices.push(v);
  const mix=await render(p);assert.ok(mix.peak<=.950001);assert.ok(mix.attenuation<1);
});
test('pitch-free full ring modulation creates sum and difference tones',async()=>{
  const p=project();p.duration=.12;p.voices[0].hz=1000;
  p.assets=['tone'];p.modulation={...p.modulation,enabled:true,sourceId:'tone',mode:'ring',depth:1};
  const asset={sampleRate:48000,samples:Float32Array.from({length:9600},(_,i)=>Math.sin(2*Math.PI*200*i/48000))};
  const out=await render(p,{tone:asset});
  const amplitude=f=>{
    let re=0,im=0,count=0;
    for(let i=960;i<4800;i++){re+=out.samples[i]*Math.cos(2*Math.PI*f*i/48000);im+=out.samples[i]*Math.sin(2*Math.PI*f*i/48000);count++;}
    return 2*Math.hypot(re,im)/count;
  };
  assert.ok(amplitude(800)>.3);assert.ok(amplitude(1200)>.3);assert.ok(amplitude(1000)<.01);
});
test('zero ring depth matches bypass and absent modulator returns to dry',async()=>{
  const p=project();p.duration=.05;p.assets=['silent'];p.modulation={...p.modulation,enabled:true,mode:'ring',sourceId:'silent',depth:0};
  const assets={silent:{sampleRate:48000,samples:new Float32Array(480)}};
  const wet=await render(p,assets),dry=await render(p,assets,{bypass:true});
  wet.samples.forEach((x,i)=>assert.ok(Math.abs(x-dry.samples[i])<1e-6));
  p.modulation.depth=1;const ended=await render(p,assets);
  assert.ok(ended.samples.slice(1000,1800).some(x=>Math.abs(x)>.5));
});
test('imported carrier bypass stays on the same carrier',async()=>{
  const p=project();p.duration=.03;p.assets=['carrier','mod'];p.modulation={...p.modulation,enabled:true,target:'asset',carrierId:'carrier',sourceId:'mod',depth:0};
  const assets={carrier:{sampleRate:48000,samples:new Float32Array(4800).fill(.2)},mod:{sampleRate:48000,samples:new Float32Array(4800)}};
  const out=await render(p,assets,{bypass:true});
  assert.ok(Math.abs(out.samples[700]-.2)<1e-5);
});
test('decimator meets declared pass and stop bands',()=>{
  const h=decimationFilter();
  const gain=f=>{let a=0,b=0;h.forEach((v,n)=>{a+=v*Math.cos(2*Math.PI*f*n);b-=v*Math.sin(2*Math.PI*f*n);});return Math.hypot(a,b);};
  assert.ok(Math.abs(20*Math.log10(gain(.4/4)))<.5);
  assert.ok(20*Math.log10(gain(.5/4))< -60);
});
test('sample-rate conversion preserves duration and bounded low-frequency tone',()=>{
  const v=Float32Array.from({length:4410},(_,i)=>.5*Math.sin(2*Math.PI*440*i/44100));
  const out=resamplePCM(v,44100,48000);assert.equal(out.length,4800);
  assert.ok(Math.max(...out)<.51);
});

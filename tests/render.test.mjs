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

function toneAmplitude(samples,rate,hz,from=.025,to=.085){
  let re=0,im=0,count=0;
  for(let i=Math.round(from*rate);i<Math.min(samples.length,Math.round(to*rate));i++){re+=samples[i]*Math.cos(2*Math.PI*hz*i/rate);im+=samples[i]*Math.sin(2*Math.PI*hz*i/rate);count++;}
  return 2*Math.hypot(re,im)/count;
}
test('constant bipolar pitch modulators produce octave ratios with continuous integrated phase',async()=>{
  for(const sign of [-1,1]){
    const p=project();p.duration=.12;p.voices[0].hz=1000;p.assets=['dc'];
    p.modulation={...p.modulation,enabled:true,mode:'pitch',target:'oscillator',sourceId:'dc',semitones:12};
    const result=await render(p,{dc:{sampleRate:48000,samples:new Float32Array(9600).fill(sign)}});
    assert.ok(toneAmplitude(result.samples,48000,sign===1?2000:500)>.65);
  }
});
test('clip pitch uses a varispeed readhead and explicit carrier loop behavior',async()=>{
  const p=project();p.duration=.12;p.assets=['tone','dc'];
  p.modulation={...p.modulation,enabled:true,mode:'pitch',target:'asset',sourceId:'dc',carrierId:'tone',semitones:12};
  const assets={tone:{sampleRate:48000,samples:Float32Array.from({length:4800},(_,i)=>.5*Math.sin(2*Math.PI*1000*i/48000))},dc:{sampleRate:48000,samples:new Float32Array(9600).fill(1)}};
  let result=await render(p,assets);
  assert.ok(toneAmplitude(result.samples,48000,2000,.02,.04)>.47);
  assert.ok(result.samples.slice(4000,5000).every(x=>Math.abs(x)<1e-8));
  p.modulation.carrierLoop=true;result=await render(p,assets);
  assert.ok(toneAmplitude(result.samples,48000,2000,.07,.10)>.47);
});
test('volume follower attack, offset, and dry fallback have distinct audible behavior',async()=>{
  const p=project();p.duration=.15;p.voices[0].hz=1000;p.assets=['level'];
  p.modulation={...p.modulation,enabled:true,mode:'volume',target:'mix',sourceId:'level',depth:1,attack:.01,release:.03,offset:.02};
  const a=new Float32Array(4800).fill(.5),out=await render(p,{level:{sampleRate:48000,samples:a}});
  const early=toneAmplitude(out.samples,48000,1000,.024,.029),settled=toneAmplitude(out.samples,48000,1000,.07,.09),outside=toneAmplitude(out.samples,48000,1000,.13,.14);
  assert.ok(early<settled);assert.ok(settled>.32&&settled<.37);assert.ok(outside>.65);
});

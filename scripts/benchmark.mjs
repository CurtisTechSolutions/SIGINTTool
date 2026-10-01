import { cpus, totalmem, platform, release } from 'node:os';
import { performance } from 'node:perf_hooks';
import { project, voice, preset } from '../src/model.js';
import { analyze, resolveStrokes } from '../src/signal.js';
import { render } from '../src/render.js';
const report={node:process.version,platform:platform(),os:release(),cpu:cpus()[0]?.model,cores:cpus().length,ramMiB:Math.round(totalmem()/1024**2),runs:[]};
const p=project();p.duration=10;p.mode='envelope';
p.voices=Array.from({length:4},(_,i)=>{const v=voice(i);v.hz=220+i*43;v.pitch=[[0,v.hz],[.4,v.hz*2],[1,v.hz*.7]];v.waveform.strokes=preset('saw');v.waveform.resolution=16384;v.harmonics=1024;v.gain=[[0,0],[.01,.7],[.8,.5],[1,0]];return v;});
p.selectedId=p.modulation.oscillatorId=p.voices[0].id;p.assets=['clip'];
p.modulation={...p.modulation,enabled:true,mode:'pitch',target:'mix',sourceId:'clip',semitones:24,sourceLoop:true,carrierLoop:true};
const assets={clip:{sampleRate:48000,samples:Float32Array.from({length:480000},(_,i)=>.8*Math.sin(2*Math.PI*7*i/48000))}};
const analysisTimes=[];
for(let i=0;i<20;i++){const t=performance.now();analyze(resolveStrokes(p.voices[0].waveform.strokes,16384),220,1024);analysisTimes.push(performance.now()-t);}
report.analysisP95Ms=analysisTimes.sort((a,b)=>a-b)[18];
for(let i=0;i<10;i++){
  global.gc?.();const before=process.memoryUsage(),start=performance.now(),result=await render(p,assets),ms=performance.now()-start,after=process.memoryUsage();
  report.runs.push({ms,frames:result.samples.length,peak:result.peak,arrayBuffersMiB:after.arrayBuffers/1024**2,heapMiB:after.heapUsed/1024**2,rssMiB:after.rss/1024**2,arrayBufferIncreaseMiB:(after.arrayBuffers-before.arrayBuffers)/1024**2});
}
report.renderWorstMs=Math.max(...report.runs.map(r=>r.ms));report.renderP95Ms=report.runs.map(r=>r.ms).sort((a,b)=>a-b)[Math.ceil(report.runs.length*.95)-1];report.proposedTargets={analysisP95Ms:150,renderMs:2000,appOwnedBufferMiB:128};
console.log('BENCHMARK:'+JSON.stringify(report));
if(report.runs.some(r=>r.frames!==480000||r.peak>.950001||r.arrayBuffersMiB>128))throw new Error('Resource or output invariant failed');
// Performance is reported explicitly; any missed release target must be addressed or documented.

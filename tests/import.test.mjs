import test from 'node:test';
import { Worker } from 'node:worker_threads';
// The browser distribution declares an optional worker subclass; decoding itself is synchronous here.
globalThis.Worker=Worker;
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { inspectWav,inspectMp3,decodeAudio,trimAudio } from '../src/import-audio.js';
import { wav } from '../src/format.js';
test('WAVE preflight checks actual data bounds, channels and sample count',async()=>{
  const bytes=wav(Float32Array.from({length:4800},(_,i)=>.4*Math.sin(2*Math.PI*440*i/48000)),48000,1);
  assert.equal(inspectWav(bytes).frames,4800);assert.throws(()=>inspectWav(bytes.subarray(0,bytes.length-2)),/Truncated/);
  const decoded=await decodeAudio(bytes);assert.equal(decoded.channels.length,1);
  const clip=trimAudio(decoded,{start:.02,end:.08,sampleRate:44100});assert.equal(clip.samples.length,2646);
  assert.throws(()=>trimAudio(decoded,{start:0,end:11}),/excerpt/);
});
test('stereo conversion preserves explicit channels and rejects non-finite audio',()=>{
  const decoded={channels:[new Float32Array(4800).fill(.4),new Float32Array(4800).fill(-.4)],duration:.1,sampleRate:48000,type:'wav'};
  assert.equal(trimAudio(decoded,{end:.1}).samples[100],0);
  assert.ok(Math.abs(trimAudio(decoded,{end:.1,channel:'left'}).samples[100]-.4)<1e-7);
  assert.ok(trimAudio(decoded,{end:.1,channel:'right'}).samples[100]<0);
  assert.throws(()=>inspectMp3(new Uint8Array([255,255,255,255])),/standard/);
});
test('independently encoded WAV and MP3 decode within bounded frames',{skip:!existsSync('.fixtures/tone.mp3')},async()=>{
  for(const type of ['wav','mp3']){
    const bytes=new Uint8Array(await readFile('.fixtures/tone.'+type)),result=await decodeAudio(bytes);
    assert.equal(result.sampleRate,44100);assert.equal(result.channels.length,2);
    assert.ok(result.duration>.18&&result.duration<.25);
    let energy=0;for(const x of result.channels[0])energy+=x*x;assert.ok(energy/result.channels[0].length>.001);
    if(type==='mp3')assert.throws(()=>inspectMp3(bytes.subarray(0,bytes.length-20)),/Truncated/);
  }
});

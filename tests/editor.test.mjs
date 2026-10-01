import test from 'node:test';
import assert from 'node:assert/strict';
import { project } from '../src/model.js';
import { History } from '../src/history.js';
import { editEnvelope } from '../src/canvas.js';
import { envelope } from '../src/signal.js';
test('50 edits are reversible and unchanged drawings share storage',()=>{
  const h=new History(project()),original=h.current;
  for(let i=0;i<50;i++)h.edit(p=>{p.voices[0].hz=500+i;});
  assert.equal(h.current.voices[0].waveform,original.voices[0].waveform);
  for(let i=0;i<50;i++)assert.equal(h.undo(),true);
  assert.deepEqual(h.current,original);
  assert.equal(h.undo(),false);assert.equal(h.redo(),true);
});
test('freehand envelope overwrite retains values outside the touched interval',()=>{
  const old=[[0,.2],[1,.8]],next=editEnvelope(old,[[.4,1],[.6,0]]);
  assert.ok(Math.abs(envelope(next,.2)-envelope(old,.2))<1e-8);
  assert.ok(Math.abs(envelope(next,.8)-envelope(old,.8))<1e-8);
  assert.ok(Math.abs(envelope(next,.5)-.5)<1e-8);
  assert.equal(envelope(editEnvelope(old,[[.3,.8],[.7,.8]],{erase:true,fallback:0}),.5),0);
});

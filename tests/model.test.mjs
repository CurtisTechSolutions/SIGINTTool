import test from 'node:test';
import assert from 'node:assert/strict';
import { project, voice, validateProject, parseProject, includedVoices } from '../src/model.js';
test('projects round-trip with stable identity and stopped model state', () => {
  const p = project();
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
});
test('invalid imported values and duplicate identities are rejected', () => {
  for (const value of [NaN, Infinity, -3, 0]) {
    const p = project(); p.voices[0].hz = value;
    assert.throws(() => validateProject(p));
  }
  const p = project(); p.voices.push(structuredClone(p.voices[0]));
  assert.throws(() => validateProject(p), /Duplicate/);
});
test('mute wins over solo, and plot selection never changes inclusion', () => {
  const p = project(); p.voices.push(voice(1));
  p.voices[0].solo = true; p.voices[0].muted = true;
  assert.equal(includedVoices(p).length, 0);
  p.voices[1].solo = true;
  assert.deepEqual(includedVoices(p).map(v => v.id), [p.voices[1].id]);
});
test('oversized and non-monotonic envelope inputs are rejected', () => {
  const p = project(); p.voices[0].pitch = [[.5, 440],[.5, 880]];
  assert.throws(() => validateProject(p), /distinct/);
  const q = project(); q.voices[0].waveform.strokes[0].points = Array.from({length:20001}, () => [0,0]);
  assert.throws(() => validateProject(q), /20,000/);
});
test('palette conflicts resolve deterministically without changing voice identity', () => {
  const p = project(); p.voices.push(voice(0));
  const fixed = validateProject(p);
  assert.equal(fixed.voices[1].color, 1);
  assert.equal(fixed.voices[1].id, p.voices[1].id);
});

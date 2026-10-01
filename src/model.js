export const VERSION = 1;
export const LIMITS = Object.freeze({ voices: 4, points: 20000, resolution: 16384, seconds: 10, frames: 480000, projectBytes: 10 * 1024 ** 2, assets: 8 });
export const COLORS = ['#55ddce', '#b598ff', '#ffc76a', '#ff899d'];
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const id = () => crypto.randomUUID();
export const clone = value => structuredClone(value);
export function preset(kind = 'sine', count = 128) {
  const points = [];
  for (let i = 0; i <= count; i++) {
    const x = i / count;
    const y = kind === 'square' ? (x < .5 ? .7 : -.7)
      : kind === 'saw' ? .7 * (2 * x - 1)
      : kind === 'triangle' ? .7 * (1 - 4 * Math.abs(x - .5))
      : kind === 'silence' ? 0 : .7 * Math.sin(2 * Math.PI * x);
    points.push([x, y]);
  }
  return [{ tool: 'line', points }];
}
export function voice(index = 0) {
  return { id: id(), name: 'Oscillator ' + (index + 1), color: index, muted: false, solo: false,
    hz: 440, phase: 0, source: 'drawing', harmonics: 64,
    waveform: { strokes: preset(), resolution: 4096, smooth: false },
    pitch: [[0, 440], [1, 440]], gain: [[0, 1], [1, 1]] };
}
export function project() {
  const first = voice();
  return { schemaVersion: VERSION, algorithmVersion: 1, id: id(), name: 'Untitled sound',
    mode: 'waveform', selectedId: first.id, voices: [first],
    duration: 2, timeline: { duration: .1, strokes: [], resolution: 4096 },
    monitor: .1, loop: false, sampleRate: 48000, assets: [],
    modulation: { enabled: false, mode: 'volume', target: 'mix', carrierId: '', sourceId: '',
      depth: .5, semitones: 12, attack: .005, release: .05, offset: 0,
      sourceLoop: false, carrierLoop: false } };
}
function number(x, min, max, label) {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max) throw new Error('Invalid ' + label);
}
function text(x, max, label) { if (typeof x !== 'string' || x.length > max) throw new Error('Invalid ' + label); }
function bool(x, label) { if (typeof x !== 'boolean') throw new Error('Invalid ' + label); }
export function validateProject(value) {
  if (!value || value.schemaVersion !== VERSION || value.algorithmVersion !== 1) throw new Error('Unsupported project version');
  const p = clone(value);
  text(p.id, 128, 'project ID'); text(p.name, 80, 'project name');
  if (!['waveform', 'envelope', 'timeline'].includes(p.mode)) throw new Error('Invalid workspace');
  if (!Array.isArray(p.voices) || p.voices.length < 1 || p.voices.length > LIMITS.voices) throw new Error('Use one to four oscillators');
  let count = 0;
  const points = (list, lo, hi, label, ordered = false) => {
    if (!Array.isArray(list)) throw new Error('Invalid ' + label);
    let prev = -1;
    for (const pt of list) {
      if (!Array.isArray(pt) || pt.length !== 2) throw new Error('Invalid point');
      number(pt[0], 0, 1, label + ' time'); number(pt[1], lo, hi, label + ' value');
      if (ordered && pt[0] <= prev) throw new Error('Envelope knots must have distinct increasing positions');
      prev = pt[0]; count++;
      if (count > LIMITS.points) throw new Error('Project exceeds 20,000 editable points');
    }
  };
  const strokes = s => {
    if (!Array.isArray(s) || s.length > LIMITS.points) throw new Error('Invalid strokes');
    for (const stroke of s) {
      if (!['pencil', 'line', 'eraser'].includes(stroke.tool)) throw new Error('Invalid drawing tool');
      points(stroke.points, -1, 1, 'waveform');
    }
  };
  const ids = new Set(), colors = new Set();
  for (const v of p.voices) {
    text(v.id, 128, 'oscillator ID'); text(v.name, 60, 'oscillator name');
    if (ids.has(v.id)) throw new Error('Duplicate oscillator ID'); ids.add(v.id);
    number(v.color, 0, 3, 'color');
    if (!Number.isInteger(v.color) || colors.has(v.color)) v.color = [0,1,2,3].find(c => !colors.has(c));
    colors.add(v.color);
    bool(v.muted, 'mute'); bool(v.solo, 'solo'); bool(v.waveform?.smooth, 'smoothing');
    number(v.hz, 20, 20000, 'frequency'); number(v.phase, 0, 1, 'phase');
    number(v.harmonics, 1, 1024, 'harmonic count');
    number(v.waveform.resolution, 256, LIMITS.resolution, 'source resolution');
    if (!Number.isInteger(v.harmonics) || !Number.isInteger(Math.log2(v.waveform.resolution))) throw new Error('Invalid resolution or harmonics');
    if (!['drawing', 'sine', 'fourier'].includes(v.source)) throw new Error('Invalid representation');
    strokes(v.waveform.strokes);
    points(v.pitch, 20, 20000, 'pitch', true); points(v.gain, 0, 1, 'gain', true);
  }
  if (!ids.has(p.selectedId)) throw new Error('Selected oscillator is missing');
  number(p.duration, .001, LIMITS.seconds, 'composition duration');
  number(p.timeline?.duration, .001, LIMITS.seconds, 'timeline duration');
  number(p.timeline?.resolution, 256, LIMITS.resolution, 'timeline resolution');
  if (!Number.isInteger(Math.log2(p.timeline.resolution))) throw new Error('Invalid timeline resolution');
  strokes(p.timeline.strokes);
  number(p.monitor, 0, 1, 'monitor gain'); bool(p.loop, 'loop');
  if (![44100, 48000].includes(p.sampleRate)) throw new Error('Unsupported export rate');
  if (!Array.isArray(p.assets) || p.assets.length > LIMITS.assets || new Set(p.assets).size !== p.assets.length) throw new Error('Invalid asset references');
  for (const a of p.assets) text(a, 128, 'asset ID');
  const m = p.modulation;
  if (!m) throw new Error('Missing modulation settings');
  bool(m.enabled, 'modulation'); bool(m.sourceLoop, 'source loop'); bool(m.carrierLoop, 'carrier loop');
  if (!['volume','ring','pitch'].includes(m.mode)) throw new Error('Invalid modulation mode');
  if (!['mix','oscillator','asset'].includes(m.target)) throw new Error('Invalid carrier target');
  text(m.sourceId, 128, 'modulator'); text(m.carrierId, 128, 'carrier');
  number(m.depth, 0, 1, 'depth'); number(m.semitones, 0, 24, 'pitch depth');
  number(m.attack, .001, 1, 'attack'); number(m.release, .001, 1, 'release'); number(m.offset, 0, 10, 'offset');
  if (m.enabled && (!p.assets.includes(m.sourceId) || (m.target === 'asset' && !p.assets.includes(m.carrierId)))) throw new Error('Required modulation asset is missing');
  return p;
}
export function includedVoices(p) {
  const anySolo = p.voices.some(v => v.solo);
  return p.voices.filter(v => !v.muted && (!anySolo || v.solo));
}
export function duration(p) { return p.mode === 'timeline' ? p.timeline.duration : p.duration; }
export function parseProject(json) {
  if (new TextEncoder().encode(json).byteLength > LIMITS.projectBytes) throw new Error('Project exceeds 10 MiB');
  return validateProject(JSON.parse(json));
}

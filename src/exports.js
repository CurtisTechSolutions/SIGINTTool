import { clone, includedVoices, duration } from './model.js';
import { waveform } from './render.js';
import { resolveStrokes, reconstruct } from './signal.js';
/** The exported evaluator is also used here, so code/data contracts have one definition. */
export function evaluateSignal(data,time,kind='source',voiceId=null){
  const T=data.duration;
  function at(values,u,periodic=false){
    if(!Number.isFinite(u)||!values.length)return 0;
    if(periodic)u=((u%1)+1)%1;else if(u<0||u>=1)return 0;
    const x=u*values.length,i=Math.floor(x),fraction=x-i,j=periodic?(i+1)%values.length:Math.min(i+1,values.length-1);
    return values[i]*(1-fraction)+values[j]*fraction;
  }
  function lane(points,u,fallback=0){
    if(!points.length)return fallback;
    if(u<=points[0][0])return points[0][1];
    for(let i=1;i<points.length;i++)if(u<=points[i][0]){
      const [x,a]=points[i-1],[y,b]=points[i],s=(u-x)/(y-x);return a+(b-a)*s;
    }
    return points[points.length-1][1];
  }
  function integral(points,t,fallback){
    if(!points.length)return t*fallback;
    const knots=points.map(([x,v])=>[x*T,v]);
    if(knots[0][0]>0)knots.unshift([0,knots[0][1]]);
    if(knots[knots.length-1][0]<T)knots.push([T,knots[knots.length-1][1]]);
    let cycles=0;
    for(let i=1;i<knots.length;i++){
      const [a,f]=knots[i-1],[b,g]=knots[i];if(t<=a)break;
      const dt=Math.min(t,b)-a,q=Math.log(g/f)/(b-a);
      cycles+=Math.abs(q)<1e-12?f*dt:f*Math.expm1(q*dt)/q;if(t<=b)break;
    }
    return cycles;
  }
  if(!Number.isFinite(time))return 0;
  if(kind==='rendered')return at(data.rendered.samples,time/data.rendered.duration);
  if(kind==='modulated')return at(data.modulated.samples,time/data.modulated.duration);
  if(kind!=='source'&&kind!=='oscillator')throw new Error('Use source, oscillator, modulated, or rendered');
  if(kind==='source'&&(time<0||time>=T))return 0;
  if(data.mode==='timeline')return at(data.timeline,time/T);
  let value=0;
  for(const v of data.voices){
    if(voiceId?v.id!==voiceId:!v.included)continue;
    if(data.mode==='envelope'&&(time<0||time>=T))continue;
    const phase=v.phase+(data.mode==='envelope'?integral(v.pitch,time,v.hz):v.hz*time);
    const gain=data.mode==='envelope'?lane(v.gain,time/T,1):1;
    value+=gain*at(v.samples,phase,true);
  }
  return value;
}
export function exportScope(project,scope='mix'){
  const p=clone(project);
  if(scope==='selected'&&p.mode!=='timeline'){
    p.voices.forEach(v=>{v.solo=v.id===p.selectedId;v.muted=false;});
    if(p.modulation.target!=='oscillator'||p.modulation.oscillatorId!==p.selectedId)p.modulation.enabled=false;
  }
  return p;
}
export function signalData(p,render=null,assets={}){
  const included=new Set(includedVoices(p).map(v=>v.id));
  return {
    schemaVersion:1,algorithmVersion:1,mode:p.mode,duration:duration(p),sampleRate:p.sampleRate,
    units:{time:'seconds',frequency:'Hz',phase:'cycles',amplitude:'linear signed amplitude',gain:'linear'},
    contract:{
      source:'Finite sum of selected drawing/sine/Fourier models with drawn pitch/gain; source DC retained; before clip modulation and audio conditioning.',
      oscillator:'Individual periodic source, including negative time wrap in Waveform mode. Envelopes have a finite domain.',
      modulated:'Numerical route output sampled at the declared rate after carrier DC removal and clip modulation, before final low-pass, headroom, edges and monitor.',
      rendered:'Complete finite output after low-pass, headroom, edges and exactly one monitor multiplier. Linear interpolation; zero outside [0, duration).',
      determinism:'Baked modulated/rendered tables make arbitrary-time queries repeatable without mutable follower/readhead state. Re-render the project bundle to change effects.',
      coefficients:'C=a[0]. Sum a[k]*cos(2*pi*k*u)+b[k]*sin(2*pi*k*u); even Nyquist not doubled. All arrays are complete, not display-rounded.'
    },
    project:clone(p),
    voices:p.voices.map(v=>{
      const w=waveform(v),selected=v.source==='drawing'?w.source:reconstruct(w.selected,w.source.length,w.limit);
      return {id:v.id,name:v.name,color:v.color,included:included.has(v.id),hz:v.hz,phase:v.phase,pitch:v.pitch,gain:v.gain,source:v.source,samples:Array.from(selected),
        coefficients:{a:Array.from(w.data.coefficients.a),b:Array.from(w.data.coefficients.b),sourceSamples:w.source.length,harmonics:v.harmonics},
        fit:w.data.sine,errors:w.data.fourier};
    }),
    timeline:p.mode==='timeline'?Array.from(resolveStrokes(p.timeline.strokes,p.timeline.resolution,false,false)):[],
    assets:Object.values(assets).map(({samples,...meta})=>meta),
    modulation:clone(p.modulation),
    modulated:render?.sourceSamples?{sampleRate:render.sampleRate,duration:render.duration,samples:Array.from(render.sourceSamples)}:null,
    rendered:render?{sampleRate:render.sampleRate,duration:render.duration,monitor:p.monitor,attenuation:render.attenuation,processing:render.warnings,samples:Array.from(render.samples,x=>x*p.monitor)}:null
  };
}
export function csv(data,kind='source'){
  if(!['source','modulated','rendered'].includes(kind))throw new Error('Unknown CSV representation');
  const rate=kind==='source'?data.sampleRate:data[kind].sampleRate,count=Math.round(data.duration*rate);
  const rows=['# SIGINT schema=1 algorithm=1 representation='+kind+' sample_rate_hz='+rate,'time_seconds,amplitude'];
  for(let i=0;i<count;i++)rows.push((i/rate)+','+(kind==='source'?evaluateSignal(data,i/rate,'source'):data[kind].samples[i]));
  return rows.join('\n')+'\n';
}
export function javascript(data){
  return '// Complete SIGINT signal data. No packages or external assets required.\n// Example: signal(0.01, "rendered"); oscillator(0.001, data.voices[0].id)\nexport const data = '+JSON.stringify(data)+';\n'+
    evaluateSignal.toString()+'\nexport const signal=(t,kind="source")=>evaluateSignal(data,t,kind);\nexport const oscillator=(t,id)=>evaluateSignal(data,t,"oscillator",id);\n';
}
export function python(data){
  const json=JSON.stringify(data);
  return '# Complete SIGINT signal data. Python 3 standard library only.\n# Example: signal(0.01, "rendered")\nimport json, math\nDATA = json.loads('+JSON.stringify(json)+')\n'+PYTHON;
}

const PYTHON="\ndef _at(values, u, periodic=False):\n    if not math.isfinite(u) or not values: return 0.0\n    if periodic: u %= 1\n    elif u < 0 or u >= 1: return 0.0\n    x = u * len(values)\n    i = int(math.floor(x))\n    s = x - i\n    j = (i + 1) % len(values) if periodic else min(i + 1, len(values) - 1)\n    return values[i] * (1 - s) + values[j] * s\n\ndef _lane(points, u, fallback=1):\n    if not points: return fallback\n    if u <= points[0][0]: return points[0][1]\n    for i in range(1, len(points)):\n        if u <= points[i][0]:\n            x, a = points[i-1]\n            y, b = points[i]\n            return a + (b-a) * (u-x) / (y-x)\n    return points[-1][1]\n\ndef _phase(points, t, duration, fallback):\n    if not points: return t * fallback\n    knots = [[x * duration, f] for x, f in points]\n    if knots[0][0] > 0: knots.insert(0, [0, knots[0][1]])\n    if knots[-1][0] < duration: knots.append([duration, knots[-1][1]])\n    result = 0.0\n    for i in range(1, len(knots)):\n        a, f = knots[i-1]\n        b, g = knots[i]\n        if t <= a: break\n        dt = min(t, b) - a\n        q = math.log(g/f) / (b-a)\n        result += f*dt if abs(q) < 1e-12 else f*math.expm1(q*dt)/q\n        if t <= b: break\n    return result\n\ndef signal(t, kind=\"source\", voice_id=None):\n    if not math.isfinite(t): return 0.0\n    if kind in (\"rendered\", \"modulated\"):\n        layer = DATA[kind]\n        return _at(layer[\"samples\"], t/layer[\"duration\"])\n    if kind not in (\"source\", \"oscillator\"): raise ValueError(\"Unknown representation\")\n    duration = DATA[\"duration\"]\n    if kind == \"source\" and (t < 0 or t >= duration): return 0.0\n    if DATA[\"mode\"] == \"timeline\": return _at(DATA[\"timeline\"], t/duration)\n    total = 0.0\n    for v in DATA[\"voices\"]:\n        if voice_id:\n            if v[\"id\"] != voice_id: continue\n        elif not v[\"included\"]: continue\n        if DATA[\"mode\"] == \"envelope\":\n            if t < 0 or t >= duration: continue\n            phase = v[\"phase\"] + _phase(v[\"pitch\"], t, duration, v[\"hz\"])\n            gain = _lane(v[\"gain\"], t/duration)\n        else:\n            phase = v[\"phase\"] + v[\"hz\"]*t\n            gain = 1\n        total += gain * _at(v[\"samples\"], phase, True)\n    return total\n\ndef oscillator(t, voice_id):\n    return signal(t, \"oscillator\", voice_id)\n";

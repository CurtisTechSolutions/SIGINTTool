import { validateProject, includedVoices, duration, clamp } from './model.js';
import { resolveStrokes, coefficients, reconstruct, analyze, sample, envelope, phaseAt, metrics } from './signal.js';
import { readClip, downsample } from './resample.js';
const OVERSAMPLE=4;
export function waveform(v) {
  const source=resolveStrokes(v.waveform.strokes,v.waveform.resolution,v.waveform.smooth);
  const data=analyze(source,v.hz,v.harmonics);
  let c=data.coefficients,limit=c.a.length-1;
  if(v.source==='fourier')limit=v.harmonics;
  if(v.source==='sine'){
    const a=new Float64Array(c.a.length),b=new Float64Array(c.b.length),k=data.sine.harmonic;
    a[0]=c.a[0];a[k]=c.a[k];b[k]=c.b[k];c={a,b};limit=k;
  }
  const tables=[];
  for(let h=1;h<=source.length/2;h*=2)tables.push(reconstruct(c,source.length,Math.min(h,limit),true));
  return {source,data,tables,limit,selected:c,dc:c.a[0]};
}
function pitchCurve(points,length,fallback,rate) {
  const nodes=points.length?points:[[0,fallback],[1,fallback]];
  const knots=nodes.map(([x,f])=>[x*length,f]);
  if(knots[0][0]>0)knots.unshift([0,knots[0][1]]);
  if(knots.at(-1)[0]<length)knots.push([length,knots.at(-1)[1]]);
  const prefix=[0],slopes=[];
  for(let i=0;i<knots.length-1;i++){
    const dt=knots[i+1][0]-knots[i][0],q=Math.log(knots[i+1][1]/knots[i][1])/dt;
    slopes[i]=q;prefix[i+1]=prefix[i]+(Math.abs(q)<1e-12?knots[i][1]*dt:knots[i][1]*Math.expm1(q*dt)/q);
  }
  let cursor=0,count=0;const state={hz:0,phase:0},steps=slopes.map(q=>({ratio:Math.exp(q/rate),cycles:Math.abs(q)<1e-12?1/rate:Math.expm1(q/rate)/q}));
  return t=>{
    const old=cursor;while(cursor<knots.length-2&&knots[cursor+1][0]<=t)cursor++;
    // Exact geometric increments between knots; periodic analytical resets bound round-off.
    if(old!==cursor||(count++&1023)===0){
      const tau=t-knots[cursor][0],f=knots[cursor][1],q=slopes[cursor]||0;
      state.hz=f*Math.exp(q*tau);state.phase=prefix[cursor]+(Math.abs(q)<1e-12?f*tau:f*Math.expm1(q*tau)/q);
    }else{state.phase+=state.hz*steps[cursor].cycles;state.hz*=steps[cursor].ratio;}
    return state;
  };
}
function sourceState(asset,t,m) {
  if(!asset)return {value:0,availability:0};
  const length=asset.samples.length/asset.sampleRate,local=t-m.offset;
  if(local<0||(!m.sourceLoop&&local>=length))return {value:0,availability:0};
  const edge=Math.min(.005,length/2),availability=Math.min(1,local/edge,m.sourceLoop?1:(length-local)/edge);
  return {value:clamp(readClip(asset.samples,local,asset.sampleRate,m.sourceLoop),-1,1),availability};
}
function assetAt(assets,id) {
  const a=assets[id];if(!a||!(a.samples instanceof Float32Array)||![44100,48000].includes(a.sampleRate)||a.samples.length>480000)throw new Error('Required audio asset is unavailable');
  for(const x of a.samples)if(!Number.isFinite(x)||Math.abs(x)>1.000001)throw new Error('Invalid audio asset samples');
  return a;
}
export async function render(input,assets={},options={}) {
  const p=validateProject(input),rate=options.rate||p.sampleRate,T=duration(p),n=Math.round(T*rate),internal=rate*OVERSAMPLE;
  if(!Number.isFinite(rate)||rate<8000||rate>192000||n<1)throw new Error('Unsupported audio sample rate');
  const m=p.modulation,route=m.enabled,enabled=route&&!options.bypass;
  const source=enabled?assetAt(assets,m.sourceId):null;
  const carrier=route&&m.target==='asset'?assetAt(assets,m.carrierId):null;
  const needsCopy=enabled&&m.mode==='pitch'&&m.target==='mix';
  if(n*OVERSAMPLE*8*(needsCopy?2:1)+n*(options.includeSource?12:4)+Object.values(assets).reduce((s,a)=>s+(a.samples?.byteLength||0),0)>96*1024**2)throw new Error('Render exceeds the 128 MiB working-buffer budget');
  const raw=new Float64Array(n*OVERSAMPLE),voices=p.mode==='timeline'?[]:includedVoices(p).map(v=>({v,...waveform(v),curve:pitchCurve(v.pitch,T,v.hz,internal),phase:v.phase}));
  const warnings=new Set(),inactive={value:0,availability:0};
  if(voices.some(item=>Math.abs(item.dc)>1e-6))warnings.add('Oscillator DC removed before drawn gain');
  if(p.mode==='timeline'){
    raw.set(resolveStrokes(p.timeline.strokes,raw.length,false,false));
    const dc=metrics(raw).dc;for(let i=0;i<raw.length;i++)raw[i]-=dc;
    if(Math.abs(dc)>1e-6)warnings.add('Timeline DC removed before modulation');
  }
  const attack=Math.exp(-1/(m.attack*internal)),release=Math.exp(-1/(m.release*internal));
  let follower=0;
  for(let block=0;block<raw.length;block+=16384){
    if(options.signal?.aborted)throw new DOMException('Canceled','AbortError');
    for(let i=block;i<Math.min(raw.length,block+16384);i++){
      const t=i/internal,state=enabled&&m.target==='oscillator'?sourceState(source,t,m):inactive;
      const amount=m.depth*state.availability,depth=m.semitones*state.availability;
      if(enabled&&m.target==='oscillator'&&m.mode==='volume'){const abs=Math.abs(state.value),a=abs>follower?attack:release;follower=a*follower+(1-a)*abs;}
      let sum=raw[i];
      for(const item of voices){
        const v=item.v,base=p.mode==='envelope'?item.curve(t):{hz:v.hz,phase:v.hz*t};
        const target=enabled&&m.target==='oscillator'&&v.id===m.oscillatorId;
        let hz=base.hz,phase=v.phase+base.phase;
        if(target&&m.mode==='pitch'){
          const requested=base.hz*2**(depth*state.value/12);
          hz=clamp(requested,20,Math.min(20000,rate/2-1));
          if(hz!==requested)warnings.add('Effective pitch limited to supported frequency range');
          if(i>0)item.phase+=(item.previousHz+hz)/(2*internal);phase=item.phase;item.previousHz=hz;
        }
        const h=Math.floor((rate/2-1)/hz);
        const index=h<1?-1:v.source==='sine'?(h<item.data.sine.harmonic?-1:Math.ceil(Math.log2(item.data.sine.harmonic))):Math.min(item.tables.length-1,31-Math.clz32(h));
        let value=index<0?0:sample(item.tables[index],phase);
        if(h<item.limit&&!item.warned){warnings.add('Harmonics above the playable bandwidth omitted');item.warned=true;}
        value*=p.mode==='envelope'?envelope(v.gain,t/T,false,1):1;
        if(target&&m.mode==='ring')value*=1-amount+amount*state.value;
        if(target&&m.mode==='volume')value*=1-amount+amount*follower;
        sum+=value;
      }
      raw[i]=sum;
    }
    options.progress?.(.5*Math.min(1,(block+16384)/raw.length));
    // Worker termination is immediate; only direct callers with an AbortSignal need event-loop yields.
    if(options.signal)await new Promise(r=>setTimeout(r,0));
  }
  if(route&&m.target!=='oscillator'){
    const dry=needsCopy?raw.slice():raw;
    let position=0,previousRatio=1;follower=0;
    for(let block=0;block<raw.length;block+=16384){
      if(options.signal?.aborted)throw new DOMException('Canceled','AbortError');
      for(let i=block;i<Math.min(raw.length,block+16384);i++){
        const t=i/internal,state=sourceState(source,t,m),amount=m.depth*state.availability;
        if(m.mode==='volume'){const abs=Math.abs(state.value),a=abs>follower?attack:release;follower=a*follower+(1-a)*abs;}
        const ratio=m.mode==='pitch'?2**(m.semitones*state.availability*state.value/12):1;
        if(i>0)position+=(previousRatio+ratio)/(2*internal);previousRatio=ratio;
        let value=carrier?readClip(carrier.samples,position,carrier.sampleRate,m.carrierLoop):needsCopy?readClip(dry,position,internal,m.carrierLoop):dry[i];
        if(m.mode==='ring')value*=1-amount+amount*state.value;
        if(m.mode==='volume')value*=1-amount+amount*follower;
        raw[i]=value;
      }
      options.progress?.(.5+.3*Math.min(1,(block+16384)/raw.length));
      // Worker termination is immediate; only direct callers with an AbortSignal need event-loop yields.
    if(options.signal)await new Promise(r=>setTimeout(r,0));
    }
  }
  if(enabled&&m.mode==='pitch'&&m.target!=='oscillator')warnings.add('Varispeed changes clip pitch and timing together');
  const sourceSamples=options.includeSource?Float64Array.from({length:n},(_,i)=>raw[i*OVERSAMPLE]):null;
  options.progress?.(.85);
  const audio=downsample(raw,OVERSAMPLE),before=metrics(audio),attenuation=before.peak>.95?.95/before.peak:1,ramp=Math.min(Math.round(.005*rate),Math.floor(audio.length/2));
  for(let i=0;i<audio.length;i++)audio[i]*=attenuation*(ramp?Math.min(1,i/ramp,(audio.length-1-i)/ramp):1);
  if(attenuation<1)warnings.add('One global peak attenuation applied');
  warnings.add('4× render · 257-tap low-pass · 5 ms bounded clip edges');
  options.progress?.(1);
  return {samples:audio,...(sourceSamples?{sourceSamples}:{}),sampleRate:rate,duration:audio.length/rate,attenuation,...metrics(audio),warnings:[...warnings],gainStage:'pre-monitor'};
}
export function sourceAt(p,time) {
  const T=duration(p);if(time<0||time>=T)return 0;
  if(p.mode==='timeline')return sample(resolveStrokes(p.timeline.strokes,p.timeline.resolution),time/T,false);
  return includedVoices(p).reduce((sum,v)=>{
    const shape=waveform(v),phase=v.phase+(p.mode==='envelope'?phaseAt(v.pitch,time,T,v.hz):v.hz*time);
    const values=v.source==='drawing'?shape.source:reconstruct(shape.selected,shape.source.length,shape.limit);
    return sum+sample(values,phase)*(p.mode==='envelope'?envelope(v.gain,time/T):1);
  },0);
}

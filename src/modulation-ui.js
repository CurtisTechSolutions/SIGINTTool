import { COLORS } from './model.js';
import { drawSignal } from './canvas.js';
export function installModulation(app){
  const el=app.element,panel=app.addPanel('Shape one sound with another');
  const heading=el('p',{class:'hint'},'Choose a frozen audio clip as the modulator. It can follow volume, multiply the waveform, or bend pitch. Saved sounds are copied by content, so later edits to a pad do not change this sound.');
  const grid=el('div',{class:'control-grid',id:'modulation-controls'}),formula=el('code',{class:'route-formula',id:'modulation-formula'});
  const preview=el('canvas',{class:'preview','aria-label':'Modulator clip waveform'}),summary=el('p',{class:'hint',id:'mod-source-summary'}),audition=el('button',{id:'audition-source'},'Audition modulator');
  panel.append(heading,grid,formula,preview,summary,audition);
  let refreshToken=0,auditioning=false;
  audition.onclick=async()=>{
    app.stop();const token=app.playbackRevision,sourceId=app.project.modulation.sourceId;
    try{
      await app.transport.enable();const a=app.assets[sourceId]||await app.store.get('audio',sourceId);
      if(token!==app.playbackRevision)return;if(!a)throw new Error('Choose a modulator clip first');
      const samples=Float32Array.from(a.samples),edge=Math.min(Math.round(.005*a.sampleRate),Math.floor(samples.length/2));
      for(let i=0;i<samples.length;i++)samples[i]*=.95*(edge?Math.min(1,i/edge,(samples.length-1-i)/edge):1);
      app.transport.setVolume(app.project.monitor);app.transport.play({samples,sampleRate:a.sampleRate,duration:samples.length/a.sampleRate},{tag:'modulator · '+a.name});auditioning=true;app.status('Auditioning modulator '+a.name);
    }catch(e){app.status(e.message,true);}
  };
  function field(label,node){return el('label',{},label,node);}
  function select(id,values,value,change){
    const node=el('select',{id,'data-mod-key':id,onchange:e=>change(e.target.value)},...values.map(([value,text])=>el('option',{value},text)));node.value=value;return node;
  }
  function numeric(id,value,min,max,step,change){return el('input',{id,'data-mod-key':id,type:'number',value,min,max,step,onchange:e=>change(Number(e.target.value))});}
  function check(id,value,change){return el('input',{id,'data-mod-key':id,type:'checkbox',checked:value,onchange:e=>change(e.target.checked)});}
  async function attachAudio(id,key){
    try{
      if(!id){app.edit(p=>{p.modulation[key]='';p.modulation.enabled=false;});return;}
      const asset=app.assets[id]||await app.store.get('audio',id);if(!asset)throw new Error('That clip is unavailable');
      if(!app.project.assets.includes(id)&&app.project.assets.length>=8)throw new Error('Remove an unused clip before adding a ninth audio source');
      app.assets[id]=asset;app.edit(p=>{if(!p.assets.includes(id))p.assets.push(id);p.modulation[key]=id;});
    }catch(e){app.status(e.message,true);refresh();}
  }
  async function refresh(){
    const token=++refreshToken,p=app.project,m=p.modulation;
    const [meta,sounds]=await Promise.all([app.store.list('audioMeta'),app.store.list('sounds')]);
    if(token!==refreshToken)return;
    const focus=document.activeElement?.dataset.modKey;
    const available=new Map();
    for(const a of meta)if(p.assets.includes(a.id))available.set(a.id,a.name+' · imported/frozen clip');
    for(const s of sounds.sort((a,b)=>a.order-b.order))if(!available.has(s.audioId))available.set(s.audioId,s.name+' · soundboard');
    const options=[['','Choose a clip…'],...available.entries()];
    const set=(key,value)=>app.edit(p=>{p.modulation[key]=value;});
    grid.replaceChildren(
      field('Enable modulation',check('mod-enabled',m.enabled,v=>{if(v&&(!m.sourceId||(m.target==='asset'&&!m.carrierId))){app.status('Choose both the modulator and its carrier before enabling this route.',true);refresh();return;}set('enabled',v);})),
      field('Modulator clip',select('mod-source',options,m.sourceId,id=>attachAudio(id,'sourceId'))),
      field('Effect',select('mod-mode',[['volume','Volume follower'],['ring','Ring modulation'],['pitch','Pitch / varispeed']],m.mode,value=>set('mode',value))),
      field('Apply to',select('mod-target',[['mix','Current sound / mix'],...(p.mode==='timeline'?[]:[['oscillator','One oscillator']]),['asset','Another audio clip']],m.target,value=>{
        app.edit(p=>{p.modulation.target=value;if(value==='asset'&&!p.modulation.carrierId)p.modulation.enabled=false;});
      }))
    );
    if(m.target==='oscillator'){
      const node=select('mod-oscillator',p.voices.map(v=>[v.id,v.name]),m.oscillatorId,v=>set('oscillatorId',v));node.style.borderColor=COLORS[p.voices.find(v=>v.id===m.oscillatorId).color];
      grid.append(field('Carrier oscillator',node));
    }
    if(m.target==='asset')grid.append(field('Carrier clip',select('mod-carrier',options,m.carrierId,id=>attachAudio(id,'carrierId'))));
    if(m.mode==='pitch')grid.append(field('Pitch depth · semitones ±',numeric('mod-semitones',m.semitones,0,24,.1,v=>set('semitones',v))));
    else grid.append(field('Depth · 0–1',numeric('mod-depth',m.depth,0,1,.01,v=>set('depth',v))));
    if(m.mode==='volume')grid.append(field('Attack · seconds',numeric('mod-attack',m.attack,.001,1,.001,v=>set('attack',v))),field('Release · seconds',numeric('mod-release',m.release,.001,1,.001,v=>set('release',v))));
    grid.append(field('Modulator starts · seconds',numeric('mod-offset',m.offset,0,10,.001,v=>set('offset',v))),field('Loop modulator',check('mod-loop',m.sourceLoop,v=>set('sourceLoop',v))));
    if(m.target==='asset'||(m.target==='mix'&&m.mode==='pitch'))grid.append(field('Loop carrier',check('carrier-loop',m.carrierLoop,v=>set('carrierLoop',v))));
    formula.textContent=m.mode==='volume'?'y(t) = carrier(t) × [1 − d(t) + d(t) × envelope(|modulator(t)|)]'
      :m.mode==='ring'?'y(t) = carrier(t) × [1 − d(t) + d(t) × modulator(t)]'
      :m.target==='oscillator'?'f(t) = basePitch(t) × 2^(D(t) × modulator(t) / 12); phase = integral of frequency'
      :'readhead(t) = integral of 2^(D(t) × modulator(t) / 12); y(t) = carrier(readhead(t)). Pitch and timing change together.';
    if(!m.sourceLoop)formula.textContent+=m.mode==='pitch'?' Outside the modulator clip: base pitch/rate resumes; accumulated phase and position are preserved.':' Outside the modulator clip: unchanged carrier.';
    audition.disabled=!m.sourceId;
    if(m.sourceId){
      const a=app.assets[m.sourceId]||await app.store.get('audio',m.sourceId);if(token!==refreshToken)return;
      if(a){let low=0,high=0,sum=0;for(const x of a.samples){low=Math.min(low,x);high=Math.max(high,x);sum+=x*x;}
        drawSignal(preview,a.samples,{color:'#e8edf5'});summary.textContent=a.name+' · '+(a.samples.length/a.sampleRate).toFixed(3)+' s · min '+low.toFixed(3)+' · max '+high.toFixed(3)+' · RMS '+Math.sqrt(sum/a.samples.length).toFixed(3)+(m.mode==='pitch'?' · rate range '+(2**(m.semitones*low/12)).toFixed(2)+'–'+(2**(m.semitones*high/12)).toFixed(2)+'× before oscillator limits':'');
      }
    }else{drawSignal(preview,new Float32Array(1));summary.textContent='Choose an imported or saved clip. Preview above shows signed sample amplitude.';}
    if(focus)grid.querySelector('[data-mod-key="'+CSS.escape(focus)+'"]')?.focus();
  }
  app.onChange(()=>{if(auditioning){auditioning=false;app.stop();}refresh().catch(e=>app.status(e.message,true));});app.onAssetsChanged=()=>refresh().catch(e=>app.status(e.message,true));
  const oldRefresh=app.library.refresh;app.library.refresh=async()=>{await oldRefresh();await refresh();};
  // Soundboard operations publish a local event after their atomic transaction.
  window.addEventListener('sigint-library-change',()=>refresh().catch(e=>app.status(e.message,true)));
  refresh().catch(e=>app.status(e.message,true));app.modulationUI={refresh};
}

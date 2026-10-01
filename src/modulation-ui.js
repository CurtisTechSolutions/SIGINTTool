import { COLORS } from './model.js';
export function installModulation(app){
  const el=app.element,panel=app.addPanel('Shape one sound with another');
  const heading=el('p',{class:'hint'},'Choose a frozen audio clip as the modulator. It can follow volume, multiply the waveform, or bend pitch. Saved sounds are copied by content, so later edits to a pad do not change this sound.');
  const grid=el('div',{class:'control-grid',id:'modulation-controls'}),formula=el('code',{class:'route-formula',id:'modulation-formula'});
  panel.append(heading,grid,formula);
  let refreshToken=0;
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
      field('Enable modulation',check('mod-enabled',m.enabled,v=>{if(v&&!m.sourceId){app.status('Choose a modulator clip first.',true);refresh();return;}set('enabled',v);})),
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
    if(!m.sourceLoop)formula.textContent+=' Outside the modulator clip: unchanged carrier.';
    if(focus)grid.querySelector('[data-mod-key="'+CSS.escape(focus)+'"]')?.focus();
  }
  app.onChange(()=>refresh().catch(e=>app.status(e.message,true)));app.onAssetsChanged=()=>refresh().catch(e=>app.status(e.message,true));
  const oldRefresh=app.library.refresh;app.library.refresh=async()=>{await oldRefresh();await refresh();};
  // Soundboard operations publish a local event after their atomic transaction.
  window.addEventListener('sigint-library-change',()=>refresh().catch(e=>app.status(e.message,true)));
  refresh().catch(e=>app.status(e.message,true));app.modulationUI={refresh};
}

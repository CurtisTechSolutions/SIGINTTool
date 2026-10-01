import { Importer } from './importer.js';
import { makeAsset } from './storage.js';
import { drawSignal } from './canvas.js';
export function installAudioLibrary(app){
  const el=app.element,importer=new Importer(),panel=app.addPanel('Audio sources'),list=el('div',{class:'asset-list',id:'audio-assets'});
  const file=el('input',{type:'file',id:'audio-file',accept:'.wav,.mp3,audio/wav,audio/mpeg',hidden:true,'aria-label':'Choose audio file'});
  const choose=el('button',{id:'upload-audio',onclick:()=>file.click()},'＋ Upload WAV or MP3'),cancel=el('button',{id:'cancel-import',hidden:true},'Cancel import');
  const progress=el('p',{class:'hint',role:'status',id:'import-state'},'Keep an excerpt up to 10 seconds. Files stay on this device.');
  const trim=el('div',{class:'trim-editor',hidden:true}),canvas=el('canvas',{class:'preview','aria-label':'Uploaded audio waveform'});
  const fields=el('form',{class:'control-grid'});
  function number(label,id,value){const input=el('input',{id,type:'number',min:0,step:.001,value,required:true});fields.append(el('label',{},label,input));return input;}
  const start=number('Excerpt start · seconds','trim-start',0),end=number('Excerpt end · seconds','trim-end',1);
  const channels=el('select',{id:'trim-channel'},...['mix','left','right'].map(value=>el('option',{value},value==='mix'?'Average L + R':value==='left'?'Left channel':'Right channel')));
  fields.append(el('label',{},'Mono conversion',channels),el('button',{id:'keep-audio',type:'submit',class:'primary'},'Keep excerpt'));
  trim.append(canvas,fields);
  panel.append(el('div',{class:'actions'},choose,cancel,file),progress,trim,list);
  let currentFile=null,job=0,busy=false;
  async function refresh(){
    const token=app.project;
    const ids=token.assets,metas=await Promise.all(ids.map(async id=>app.assets[id]||await app.store.get('audioMeta',id)));
    if(token!==app.project)return;
    list.replaceChildren(...metas.filter(Boolean).map(a=>el('div',{class:'asset-row'},el('strong',{},a.name),el('span',{class:'hint'},((a.frames??a.samples.length)/a.sampleRate).toFixed(3)+' s · '+a.sampleRate/1000+' kHz'),el('button',{'aria-label':'Remove audio source '+a.name,onclick:()=>{
      const m=app.project.modulation;if(m.sourceId===a.id||m.carrierId===a.id){app.status('Choose another modulation source or carrier before removing this clip.',true);return;}
      app.edit(p=>{p.assets=p.assets.filter(id=>id!==a.id);});delete app.assets[a.id];
    }},'Remove'))));
  }
  file.onchange=async()=>{
    const selected=file.files[0];file.value='';if(!selected)return;
    app.stop();const token=++job;busy=true;currentFile=selected;trim.hidden=true;cancel.hidden=false;choose.disabled=true;
    try{
      progress.textContent='Reading and validating audio…';
      const info=await importer.load(selected,n=>{progress.textContent='Decoding '+Math.round(n*100)+'%…';});
      if(token!==job)return;
      currentFile={name:selected.name,info};start.value=0;end.value=Math.min(10,info.duration).toFixed(6);start.max=end.max=info.duration;
      trim.hidden=false;drawSignal(canvas,info.preview);progress.textContent=selected.name+' · '+info.duration.toFixed(3)+' s · '+info.channels+' channel(s) · '+info.sampleRate+' Hz. Choose the excerpt to keep.';
      busy=false;choose.disabled=false;
    }catch(e){if(token===job&&e.name!=='AbortError'){progress.textContent='Audio was not imported: '+e.message;cancel.hidden=true;choose.disabled=false;busy=false;}}
  };
  cancel.onclick=()=>{job++;importer.cancel();currentFile=null;busy=false;choose.disabled=false;trim.hidden=cancel.hidden=true;progress.textContent='Import canceled. Your sound is unchanged.';};
  fields.onsubmit=async e=>{
    e.preventDefault();if(busy||!currentFile)return;
    if(app.project.assets.length>=8){app.status('Keep at most eight audio sources in one project. Remove an unused clip first.',true);return;}
    const token=job;busy=true;fields.querySelector('button').disabled=true;choose.disabled=true;
    try{
      const result=await importer.trim({start:Number(start.value),end:Number(end.value),channel:channels.value,sampleRate:app.project.sampleRate});
      const asset=await makeAsset(result.samples,result.sampleRate,currentFile.name,result.provenance);
      if(token!==job)return;
      await app.store.transaction(['audio','audioMeta'],'readwrite',tx=>app.store.putAsset(tx,asset));
      if(token!==job)return;
      app.assets[asset.id]=asset;app.edit(p=>{if(!p.assets.includes(asset.id))p.assets.push(asset.id);if(!p.modulation.sourceId)p.modulation.sourceId=asset.id;});
      progress.textContent='Kept '+asset.name+' · '+(asset.frames/asset.sampleRate).toFixed(3)+' s. Choose it below to modulate your sound.';
      trim.hidden=cancel.hidden=true;currentFile=null;importer.cancel();await refresh();app.onAssetsChanged?.();
    }catch(error){if(token===job&&error.name!=='AbortError')progress.textContent='Excerpt was not saved: '+error.message;}
    finally{busy=false;choose.disabled=false;fields.querySelector('button').disabled=false;}
  };
  app.onChange(()=>refresh().catch(e=>app.status(e.message,true)));
  app.audioLibrary={refresh,cancel:()=>cancel.click()};
  refresh().catch(e=>app.status(e.message,true));
}

import { clone, parseProject, id } from './model.js';
import { LocalStore } from './storage.js';
import { download, wav, packProject, unpackProject } from './format.js';
export async function installLibrary(app){
  const el=app.element,store=new LocalStore(),panel=app.addPanel('Your soundboard');
  const actions=el('div',{class:'actions'}),save=el('button',{class:'primary',id:'save-sound'},'＋ Save as new sound'),update=el('button',{id:'update-sound',disabled:true},'Update opened sound'),recover=el('button',{id:'recover-draft'},'Recover previous draft'),undo=el('button',{id:'undo-remove',hidden:true},'Undo remove');
  const state=el('span',{id:'persist-state',class:'hint'},'Opening local library…'),board=el('div',{class:'soundboard',id:'soundboard'});
  actions.append(save,update,recover,undo);panel.append(actions,el('p',{class:'hint'},'Saved clips and editable snapshots stay in this browser. Download a backup before clearing browser data.'),state,board);
  let entries=[],opened=null,removed=null,saving=false,padIntent=0,playingId=null,loadingId=null,saveTimer,saveRevision=0;
  const cache=new Map();let cacheBytes=0;
  app.store=store;
  app.prepareAssets=async p=>{
    const result={};
    for(const key of p.assets)result[key]=app.assets[key]||await store.get('audio',key);
    if(p.assets.some(k=>!result[k]))throw new Error('A required audio source is missing. Restore its project bundle.');
    return result;
  };
  async function refreshEntries(){entries=(await store.list('sounds')).sort((a,b)=>a.order-b.order);renderBoard();window.dispatchEvent(new Event('sigint-library-change'));}
  function retain(asset){cache.delete(asset.id);cache.set(asset.id,asset);cacheBytes=[...cache.values()].reduce((n,a)=>n+a.samples.byteLength,0);while(cacheBytes>8*1024**2&&cache.size>1){const key=cache.keys().next().value;cacheBytes-=cache.get(key).samples.byteLength;cache.delete(key);}return asset;}
  async function clip(key){if(cache.has(key))return retain(cache.get(key));const a=await store.get('audio',key);if(!a)throw new Error('Saved audio is missing. Open its project and save a new render.');return retain(a);}
  async function play(entry){
    app.stop();const token=++padIntent;loadingId=entry.id;playingId=null;renderBoard();
    try{
      await app.transport.enable();const asset=await clip(entry.audioId);if(token!==padIntent)return;
      app.transport.setVolume(app.project.monitor);app.transport.play({samples:asset.samples,sampleRate:asset.sampleRate,duration:entry.duration},{tag:entry.name});
      playingId=entry.id;loadingId=null;renderBoard();app.status('Playing '+entry.name);
    }catch(e){if(token===padIntent){loadingId=null;renderBoard();app.status(e.message,true);}}
  }
  const stop=app.stop.bind(app);app.stop=()=>{padIntent++;playingId=null;loadingId=null;stop();renderBoard();};
  const editorPlay=app.play.bind(app);app.play=(...args)=>{padIntent++;playingId=null;loadingId=null;renderBoard();return editorPlay(...args);};
  const onState=app.transport.onState;app.transport.onState=(s,...args)=>{onState(s,...args);if(s==='stopped'){playingId=null;renderBoard();}};
  async function saveSound(existing){
    if(saving)return;saving=true;save.disabled=update.disabled=true;
    const snapshot=clone(app.project);
    try{
      const sources=await app.prepareAssets(snapshot),render=await app.renderSnapshot(snapshot,snapshot.sampleRate);
      const entry=await store.saveSound(snapshot,render,Object.values(sources),existing);
      await refreshEntries();app.status('Saved “'+entry.name+'” to the soundboard.');
      if(existing)opened=entry;
    }catch(e){app.status('Sound was not saved: '+e.message,true);}
    finally{saving=false;save.disabled=false;update.disabled=!opened;}
  }
  save.onclick=()=>saveSound(null);update.onclick=()=>opened&&saveSound(opened);
  async function open(entry){
    try{
      const saved=await store.get('projects',entry.projectId);if(!saved)throw new Error('Saved editable snapshot is missing');
      const sources=await app.prepareAssets(saved.project);
      await store.saveProject('recovery',app.project,Object.values(await app.prepareAssets(app.project)));
      app.stop();app.assets={...app.assets,...sources};
      const copy=clone(saved.project);copy.id=id();copy.name=entry.name;app.replace(copy);opened=entry;update.disabled=false;app.status('Opened an editable copy of “'+entry.name+'”. The saved sound is unchanged.');
    }catch(e){app.status(e.message,true);}
  }
  recover.onclick=async()=>{
    try{const backup=await store.get('projects','recovery');if(!backup)throw new Error('There is no previous draft to recover');await app.prepareAssets(backup.project);app.stop();app.replace(backup.project);opened=null;update.disabled=true;app.status('Previous working draft recovered.');}
    catch(e){app.status(e.message,true);}
  };
  undo.onclick=async()=>{if(!removed)return;try{await store.restore(removed);removed=null;undo.hidden=true;await refreshEntries();app.status('Saved sound restored.');}catch(e){app.status(e.message,true);}};
  function renderBoard(){
    const focus=document.activeElement?.dataset.boardFocus;board.replaceChildren();
    if(!entries.length)board.append(el('p',{class:'empty'},'Keep a sound worth coming back to. Create one above, give it a name, and save it here.'));
    for(const [index,entry] of entries.entries()){
      const card=el('article',{class:'sound-pad'+(playingId===entry.id?' playing':'')});
      const playButton=el('button',{class:'pad-trigger','data-board-focus':entry.id,'aria-label':'Play saved sound '+entry.name,'aria-busy':loadingId===entry.id,onclick:()=>play(entry)},el('span',{class:'pad-icon'},playingId===entry.id?'♫':'▶'),el('strong',{},entry.name),el('span',{class:'hint'},loadingId===entry.id?'Loading…':playingId===entry.id?'Playing':entry.duration.toFixed(2)+' s · '+entry.sampleRate/1000+' kHz'));
      const tools=el('div',{class:'pad-actions'});
      const rename=el('input',{value:entry.name,maxlength:80,'aria-label':'Rename '+entry.name,'data-board-focus':'name-'+entry.id,onchange:async e=>{try{await store.updateEntries([{...entry,name:e.target.value||'Untitled sound'}]);await refreshEntries();}catch(error){app.status(error.message,true);}}});
      tools.append(el('button',{onclick:()=>open(entry)},'Open'),
        el('button',{'aria-label':'Move '+entry.name+' earlier',disabled:index===0,onclick:async()=>{try{const previous=entries[index-1];await store.updateEntries([{...entry,order:previous.order},{...previous,order:entry.order}]);await refreshEntries();}catch(e){app.status(e.message,true);}}},'↑'),
        el('button',{onclick:async()=>{try{const a=await clip(entry.audioId);download(safeName(entry.name)+'.wav',wav(a.samples,a.sampleRate,app.project.monitor),'audio/wav');}catch(e){app.status(e.message,true);}}},'WAV'),
        el('button',{onclick:async()=>{try{const s=await store.get('projects',entry.projectId);await exportProject(s.project,entry.name);}catch(e){app.status(e.message,true);}}},'Project'),
        el('button',{'aria-label':'Remove '+entry.name,onclick:async()=>{try{await store.remove(entry);removed=entry;undo.hidden=false;if(playingId===entry.id)app.stop();if(opened?.id===entry.id){opened=null;update.disabled=true;}await refreshEntries();app.status('Removed “'+entry.name+'”. Undo is available.');}catch(e){app.status(e.message,true);}}},'Remove'));
      card.append(playButton,rename,tools);board.append(card);
    }
    if(focus)board.querySelector('[data-board-focus="'+CSS.escape(focus)+'"]')?.focus();
  }
  async function exportProject(p,name=p.name){
    if(p.assets.length)download(safeName(name)+'.sigint.zip',await packProject(p,await app.prepareAssets(p)),'application/zip');
    else download(safeName(name)+'.json',JSON.stringify(p,null,2),'application/json');
  }
  app.exportProject=exportProject;
  const fileActions=document.querySelector('#file-actions'),file=el('input',{type:'file',accept:'.json,.zip',hidden:true,'aria-label':'Open project file'});
  fileActions.append(el('button',{id:'download-project',onclick:()=>exportProject(app.project).catch(e=>app.status(e.message,true))},'Download project'),
    el('button',{id:'open-project',onclick:()=>file.click()},'Open project'),file);
  file.onchange=async()=>{
    const input=file.files[0];if(!input)return;
    try{
      if(input.size>32*1024**2)throw new Error('Project file exceeds 32 MiB');
      const bytes=new Uint8Array(await input.arrayBuffer());let next,assets={};
      if(bytes[0]===80&&bytes[1]===75){const result=await unpackProject(bytes);next=result.project;assets=result.assets;}
      else{next=parseProject(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(next.assets.length)throw new Error('This project needs an asset-bearing .sigint.zip bundle');}
      await store.saveProject('recovery',app.project,Object.values(await app.prepareAssets(app.project)));
      await store.saveProject('current',next,Object.values(assets));app.stop();app.assets={...app.assets,...assets};app.replace(next);opened=null;update.disabled=true;app.status('Project opened. Playback is stopped.');
    }catch(e){app.status('Project was not opened: '+e.message,true);}finally{file.value='';}
  };
  app.onChange(p=>{
    for(const key of Object.keys(app.assets))if(!p.assets.includes(key))delete app.assets[key];
    const revision=++saveRevision;clearTimeout(saveTimer);state.textContent='Draft has unsaved changes';
    saveTimer=setTimeout(async()=>{try{await store.saveProject('current',p,Object.values(await app.prepareAssets(p)));if(revision===saveRevision)state.textContent='Draft saved locally';}catch(e){if(revision===saveRevision)state.textContent='Draft not saved · '+e.message;}},350);
  });
  const initial=app.project;
  try{
    await store.open();const current=await store.get('projects','current');
    if(current&&app.project===initial){await app.prepareAssets(current.project);app.replace(current.project);app.status('Restored your local project. Playback is stopped.');}
    state.textContent='Local library ready';await refreshEntries();
  }catch(e){state.textContent='Local storage unavailable · use Download project to keep your work';app.status(e.message,true);}
  app.library={store,refresh:refreshEntries,save:saveSound,open,play,get entries(){return entries;}};
}
export function safeName(name){return (String(name).replace(/[^a-z0-9_-]+/gi,'-').slice(0,80)||'sigint-sound');}

import { validateProject, id } from './model.js';
import { floatBytes, hashAudio } from './format.js';
export async function makeAsset(samples,sampleRate,name='Audio clip',provenance={}){
  if(![44100,48000].includes(sampleRate)||samples.length<1||samples.length>480000)throw new Error('Unsupported audio asset size or rate');
  for(const value of samples)if(!Number.isFinite(value)||Math.abs(value)>1.000001)throw new Error('Audio asset contains invalid samples');
  const pcm=Float32Array.from(samples),hash=await hashAudio(floatBytes(pcm));
  return {id:'pcm_'+sampleRate+'_'+hash,name:String(name).slice(0,100),sampleRate,samples:pcm,frames:pcm.length,hash,provenance};
}
export class LocalStore{
  constructor(){this.db=null;}
  async open(){
    this.db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open('sigint-local',1);
      r.onupgradeneeded=()=>{for(const name of ['projects','sounds','audio','audioMeta'])r.result.createObjectStore(name,{keyPath:'id'});};
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Close other SIGINT tabs to upgrade local storage'));
    });
    this.db.onversionchange=()=>{this.db.close();this.db=null;};
    return this;
  }
  transaction(names,mode,fn){
    if(!this.db)return Promise.reject(new Error('Local storage is unavailable. Download a project backup.'));
    return new Promise((resolve,reject)=>{
      const tx=this.db.transaction(names,mode);
      let value;
      tx.oncomplete=()=>resolve(typeof value==='function'?value():value);
      tx.onerror=()=>reject(tx.error||new Error('Storage transaction failed'));
      tx.onabort=()=>reject(tx.error||new Error('Storage transaction was canceled'));
      try{value=fn(tx);}catch(e){tx.abort();reject(e);}
    });
  }
  get(store,key){return this.transaction([store],'readonly',tx=>{const r=tx.objectStore(store).get(key);return ()=>r.result;});}
  list(store){return this.transaction([store],'readonly',tx=>{const r=tx.objectStore(store).getAll();return ()=>r.result;});}
  putAsset(tx,a){
    if(a.id!=='pcm_'+a.sampleRate+'_'+a.hash)throw new Error('Asset identity must match its immutable contents');
    tx.objectStore('audio').put(a);
    const {samples,...meta}=a;tx.objectStore('audioMeta').put(meta);
  }
  async saveProject(key,project,assets=[]){
    const p=validateProject(project);
    return this.transaction(['projects','audio','audioMeta'],'readwrite',tx=>{
      for(const a of assets)this.putAsset(tx,a);
      tx.objectStore('projects').put({id:key,project:p,updatedAt:Date.now()});
    });
  }
  async saveSound(project,render,assets=[],existing=null){
    const snapshot=validateProject(project),audio=await makeAsset(render.samples,render.sampleRate,snapshot.name,{kind:'rendered',gainStage:'pre-monitor',algorithmVersion:1});
    const key=existing?.id||id(),now=Date.now();
    const entry={id:key,name:snapshot.name||'Untitled sound',order:existing?.order??now,createdAt:existing?.createdAt??now,updatedAt:now,projectId:'sound-'+key,audioId:audio.id,duration:render.duration,sampleRate:render.sampleRate,frames:render.samples.length,schemaVersion:1,algorithmVersion:1};
    await this.transaction(['sounds','projects','audio','audioMeta'],'readwrite',tx=>{
      for(const a of [...assets,audio])this.putAsset(tx,a);
      tx.objectStore('projects').put({id:entry.projectId,project:snapshot});
      tx.objectStore('sounds').put(entry);
    });
    return entry;
  }
  async updateEntries(entries){
    await this.transaction(['sounds'],'readwrite',tx=>{for(const e of entries)tx.objectStore('sounds').put(e);});
  }
  async remove(entry){await this.transaction(['sounds'],'readwrite',tx=>tx.objectStore('sounds').delete(entry.id));}
  async restore(entry){await this.updateEntries([entry]);}
  async sources(ids){const assets=Object.create(null);for(const id of ids){const a=await this.get('audio',id);if(!a)throw new Error('A required local audio asset is missing. Import its project bundle.');assets[id]=a;}return assets;}
}

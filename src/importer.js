export class Importer{
  constructor(){this.worker=null;this.pending=null;this.generation=0;}
  cancel(){
    this.generation++;this.worker?.terminate();this.worker=null;
    this.pending?.reject(new DOMException('Import canceled','AbortError'));this.pending=null;
  }
  request(message,transfer=[]){
    if(!this.worker)throw new Error('Choose an audio file first');
    if(this.pending)throw new Error('An import operation is already running');
    return new Promise((resolve,reject)=>{this.pending={resolve,reject};this.worker.postMessage(message,transfer);});
  }
  async load(file,progress=()=>{}){
    this.cancel();const token=this.generation;
    if(file.size>20*1024**2)throw new Error('Audio files must be 20 MiB or smaller');
    const bytes=await file.arrayBuffer();if(token!==this.generation)throw new DOMException('Import canceled','AbortError');
    this.worker=new Worker(new URL('./import-worker.js',import.meta.url),{type:'module'});
    this.worker.onmessage=({data})=>{
      if(data.type==='progress'){progress(data.value);return;}
      const pending=this.pending;this.pending=null;
      if(data.type==='error')pending?.reject(new Error(data.message));else pending?.resolve(data);
    };
    this.worker.onerror=e=>{this.pending?.reject(new Error(e.message||'Audio decoding failed'));this.pending=null;this.cancel();};
    return this.request({type:'load',bytes},[bytes]);
  }
  trim(options){return this.request({type:'trim',options});}
}

export class Renderer {
  constructor(){this.worker=null;this.pending=null;}
  cancel(){
    this.worker?.terminate();this.worker=null;
    this.pending?.reject(new DOMException('Canceled','AbortError'));this.pending=null;
  }
  run(project,assets={},options={}){
    this.cancel();
    return new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('./render-worker.js',import.meta.url),{type:'module'});
      this.worker=worker;this.pending={reject};
      const finish=()=>{worker.terminate();if(this.worker===worker){this.worker=null;this.pending=null;}};
      worker.onmessage=({data})=>{
        if(data.type==='progress'){options.progress?.(data.value);return;}
        finish();if(data.type==='error')reject(new Error(data.message));else resolve(data.result);
      };
      worker.onerror=e=>{finish();reject(new Error(e.message||'Audio rendering failed'));};
      worker.postMessage({project,assets,rate:options.rate||project.sampleRate,bypass:!!options.bypass});
    });
  }
}
export class Transport {
  constructor(onState=()=>{}){this.context=null;this.master=null;this.nodes=new Set();this.buffers=new WeakMap();this.generation=0;this.onState=onState;this.volume=.1;}
  async enable(){
    if(!this.context){
      const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!Context)throw new Error('Web Audio is unavailable in this browser');
      this.context=new Context();this.master=this.context.createGain();this.master.gain.value=this.volume;this.master.connect(this.context.destination);
    }
    let timeout;
    try{await Promise.race([this.context.resume(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Audio could not start. Check the browser permission and output device, then press Play again.')),5000);})]);}
    finally{clearTimeout(timeout);}
    if(this.context.state!=='running')throw new Error('Audio is suspended. Activate Play again.');
    return this.context.sampleRate;
  }
  setVolume(value){
    this.volume=value;
    if(this.master){const t=this.context.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setTargetAtTime(value,t,.005);}
  }
  stop(notify=true){
    this.generation++;
    if(this.context){
      const time=this.context.currentTime;
      for(const item of this.nodes){
        if(item.stopping)continue;item.stopping=true;
        item.gain.gain.cancelScheduledValues(time);
        item.gain.gain.setValueAtTime(item.gain.gain.value,time);
        item.gain.gain.linearRampToValueAtTime(0,time+.005);
        try{item.source.stop(time+.006);}catch{}
      }
    }
    if(notify)this.onState('stopped');
  }
  play(result,{loop=false,tag='editor'}={}){
    if(!this.context||this.context.state!=='running')throw new Error('Activate audio with Play first');
    this.stop(false);const token=this.generation,time=this.context.currentTime+.01;
    let buffer=this.buffers.get(result.samples);
    if(!buffer){buffer=this.context.createBuffer(1,result.samples.length,result.sampleRate);buffer.copyToChannel(result.samples,0);this.buffers.set(result.samples,buffer);}
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=buffer;source.loop=loop;source.connect(gain);gain.connect(this.master);
    gain.gain.setValueAtTime(1,time); // The prepared clip already contains its start/end envelope.
    const item={source,gain,tag};this.nodes.add(item);
    source.onended=()=>{source.disconnect();gain.disconnect();this.nodes.delete(item);if(token===this.generation&&!loop)this.onState('stopped');};
    source.start(time);this.onState('playing',tag,{start:time,duration:result.duration});return token;
  }
  async close(){this.stop();await this.context?.close();this.context=null;this.master=null;}
}

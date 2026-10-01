import { validateProject, parseProject, LIMITS } from './model.js';
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
export function wav(samples,rate,monitor=1){
  const buffer=new ArrayBuffer(44+samples.length*2),v=new DataView(buffer);
  const text=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
  text(0,'RIFF');v.setUint32(4,buffer.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){const x=samples[i]*monitor;if(!Number.isFinite(x)||Math.abs(x)>1.000001)throw new Error('WAV render is outside the encoding bounds');v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,x))*(x<0?32768:32767)),true);}
  return new Uint8Array(buffer);
}
export function crc32(bytes){
  let crc=0xffffffff;
  for(const x of bytes){crc^=x;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
export function zip(entries){
  const chunks=[],directory=[];let offset=0;
  for(const [name,raw] of Object.entries(entries)){
    const bytes=typeof raw==='string'?encoder.encode(raw):raw,n=encoder.encode(name),sum=crc32(bytes);
    const h=new Uint8Array(30+n.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,n.length,true);h.set(n,30);
    chunks.push(h,bytes);
    const c=new Uint8Array(46+n.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,sum,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,n.length,true);d.setUint32(42,offset,true);c.set(n,46);directory.push(c);offset+=h.length+bytes.length;
  }
  const centralSize=directory.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,directory.length,true);e.setUint16(10,directory.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  const result=new Uint8Array(offset+centralSize+22);let at=0;for(const chunk of [...chunks,...directory,end]){result.set(chunk,at);at+=chunk.length;}return result;
}
export function unzip(bytes){
  if(bytes.length>32*1024**2||bytes.length<22)throw new Error('Invalid bundle size (maximum 32 MiB)');
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22;
  if(v.getUint32(end,true)!==0x06054b50||v.getUint16(end+20,true)!==0)throw new Error('Unsupported bundle directory');
  const count=v.getUint16(end+10,true),central=v.getUint32(end+16,true),centralSize=v.getUint32(end+12,true);
  if(count>32||v.getUint16(end+8,true)!==count||central+centralSize!==end)throw new Error('Invalid bundle entry limit or directory');
  const entries=Object.create(null);let pos=central,total=0;
  for(let i=0;i<count;i++){
    if(pos+46>end||v.getUint32(pos,true)!==0x02014b50)throw new Error('Invalid bundle entry');
    const flags=v.getUint16(pos+8,true),method=v.getUint16(pos+10,true),crc=v.getUint32(pos+16,true),size=v.getUint32(pos+20,true),expanded=v.getUint32(pos+24,true),length=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),local=v.getUint32(pos+42,true);
    if(method!==0||flags!==0x800||size!==expanded)throw new Error('Use a SIGINT bundle with stored PCM entries');
    if(pos+46+length+extra+comment>end||local+30>=central)throw new Error('Truncated bundle');
    const name=decoder.decode(bytes.subarray(pos+46,pos+46+length));
    if(!/^(project\.json|manifest\.json|audio\/[a-zA-Z0-9_-]+\.f32)$/.test(name)||Object.hasOwn(entries,name))throw new Error('Unsafe or duplicate bundle path');
    total+=expanded;if(total>64*1024**2)throw new Error('Bundle exceeds extracted byte limit');
    if(v.getUint32(local,true)!==0x04034b50||v.getUint16(local+8,true)!==0||v.getUint32(local+18,true)!==size||v.getUint32(local+22,true)!==size)throw new Error('Mismatched bundle header');
    const n=v.getUint16(local+26,true),x=v.getUint16(local+28,true),start=local+30+n+x;
    if(start+size>central||decoder.decode(bytes.subarray(local+30,local+30+n))!==name)throw new Error('Invalid bundle data extent');
    const data=bytes.subarray(start,start+size);if(crc32(data)!==crc||v.getUint32(local+14,true)!==crc)throw new Error('Corrupt bundle checksum');
    entries[name]=data;pos+=46+length+extra+comment;
  }
  if(pos!==end)throw new Error('Unexpected bundle directory data');
  return entries;
}
export function floatBytes(samples){
  const bytes=new Uint8Array(samples.length*4),v=new DataView(bytes.buffer);
  samples.forEach((x,i)=>v.setFloat32(i*4,x,true));return bytes;
}
export async function hashAudio(bytes){
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function packProject(project,assets){
  const p=validateProject(project),entries={'project.json':JSON.stringify(p)},manifest={version:1,assets:[]};
  for(const id of p.assets){
    const a=assets[id];if(!a)throw new Error('Required audio asset missing');
    const bytes=floatBytes(a.samples),hash=await hashAudio(bytes),path='audio/'+id+'.f32';
    entries[path]=bytes;manifest.assets.push({id,path,hash,sampleRate:a.sampleRate,frames:a.samples.length,name:a.name||'Audio clip',provenance:a.provenance||{}});
  }
  entries['manifest.json']=JSON.stringify(manifest);const result=zip(entries);
  if(result.length>32*1024**2)throw new Error('Project bundle exceeds 32 MiB');return result;
}
export async function unpackProject(bytes){
  const entries=unzip(bytes);
  if(!entries['project.json']||!entries['manifest.json']||entries['project.json'].length>LIMITS.projectBytes||entries['manifest.json'].length>1024*1024)throw new Error('Invalid project manifest');
  const p=parseProject(decoder.decode(entries['project.json'])),manifest=JSON.parse(decoder.decode(entries['manifest.json']));
  if(manifest.version!==1||!Array.isArray(manifest.assets)||manifest.assets.length>8)throw new Error('Unsupported asset manifest');
  const assets=Object.create(null),used=new Set(['project.json','manifest.json']);
  for(const a of manifest.assets){
    if(typeof a.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(a.id)||Object.hasOwn(assets,a.id)||a.path!=='audio/'+a.id+'.f32')throw new Error('Invalid audio identity');
    if(![44100,48000].includes(a.sampleRate)||!Number.isInteger(a.frames)||a.frames<1||a.frames>480000)throw new Error('Invalid audio sample bounds');
    const data=entries[a.path];if(!data||data.length!==a.frames*4||await hashAudio(data)!==a.hash)throw new Error('Missing or corrupt PCM asset');
    const view=new DataView(data.buffer,data.byteOffset,data.byteLength),samples=new Float32Array(a.frames);
    for(let i=0;i<a.frames;i++){const x=view.getFloat32(i*4,true);if(!Number.isFinite(x)||Math.abs(x)>1.000001)throw new Error('Invalid PCM samples');samples[i]=x;}
    if(a.id!=='pcm_'+a.sampleRate+'_'+a.hash)throw new Error('Asset ID does not match its immutable contents');
    assets[a.id]={...a,samples};used.add(a.path);
  }
  if(Object.keys(entries).some(k=>!used.has(k))||p.assets.length!==Object.keys(assets).length||p.assets.some(id=>!assets[id]))throw new Error('Bundle assets do not match the project');
  return {project:p,assets};
}
export function download(name,contents,type='application/octet-stream'){
  const blob=new Blob([contents],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

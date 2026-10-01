import { resamplePCM } from './resample.js';
export const IMPORT_LIMITS=Object.freeze({bytes:20*1024**2,seconds:60,retained:10});
const fail=message=>{throw new Error(message);};
function bounds(channels,rate,frames,bytes){
  if(![1,2].includes(channels)||rate<8000||rate>192000||!Number.isInteger(rate)||frames<1||frames/rate>60)fail('Use mono or stereo audio, 8–192 kHz, at most 60 seconds');
  if(frames*channels*4+bytes>112*1024**2)fail('Decoded audio exceeds the import memory limit');
}
export function inspectWav(bytes){
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),tag=i=>String.fromCharCode(...bytes.subarray(i,i+4));
  if(bytes.length<44||tag(0)!=='RIFF'||tag(8)!=='WAVE')fail('This is not a supported RIFF WAVE file');
  const end=d.getUint32(4,true)+8;if(end>bytes.length||end<44)fail('Truncated WAVE file');
  let fmt,data;
  for(let at=12;at+8<=end;){
    const size=d.getUint32(at+4,true),start=at+8;
    if(start+size>end)fail('Truncated WAVE chunk');
    if(tag(at)==='fmt '){
      if(fmt||size<16)fail('Invalid WAVE format chunk');
      fmt={format:d.getUint16(start,true),channels:d.getUint16(start+2,true),sampleRate:d.getUint32(start+4,true),byteRate:d.getUint32(start+8,true),align:d.getUint16(start+12,true),bits:d.getUint16(start+14,true)};
    }
    if(tag(at)==='data'){if(data)fail('Multiple WAVE data chunks are not supported');data={start,size};}
    at=start+size+(size%2);
  }
  if(!fmt||!data)fail('WAVE format or audio data is missing');
  if(!((fmt.format===1&&[8,16,24,32].includes(fmt.bits))||(fmt.format===3&&fmt.bits===32)))fail('Use uncompressed PCM or 32-bit float WAVE');
  if(fmt.align!==fmt.channels*fmt.bits/8||fmt.byteRate!==fmt.sampleRate*fmt.align||data.size%fmt.align)fail('Invalid WAVE frame layout');
  const frames=data.size/fmt.align;bounds(fmt.channels,fmt.sampleRate,frames,bytes.length);
  return {...fmt,...data,frames,duration:frames/fmt.sampleRate,type:'wav'};
}
export function inspectMp3(bytes){
  let at=0;
  if(bytes.length>=10&&String.fromCharCode(...bytes.subarray(0,3))==='ID3'){
    const version=bytes[3];
    if(![2,3,4].includes(version)||bytes[4]===255||bytes.subarray(6,10).some(x=>x&128))fail('Unsupported ID3 header');
    const size=bytes[6]*2097152+bytes[7]*16384+bytes[8]*128+bytes[9];
    at=10+size+(version===4&&(bytes[5]&16)?10:0);
    if(at>bytes.length)fail('Truncated ID3 metadata');
  }
  const frames=[];let sampleRate=0,channels=0,samples=0;
  while(at<bytes.length){
    if(bytes.length-at===128&&String.fromCharCode(...bytes.subarray(at,at+3))==='TAG'){at+=128;break;}
    // Some encoders pad the tail with zero bytes.
    if(bytes[at]===0&&bytes.length-at<=4096&&bytes.subarray(at).every(v=>v===0))break;
    if(at+4>bytes.length||bytes[at]!==255||(bytes[at+1]&224)!==224)fail('Invalid MP3 frame or unsupported trailing metadata');
    const version=(bytes[at+1]>>3)&3,layer=(bytes[at+1]>>1)&3,rateIndex=(bytes[at+2]>>2)&3,bitIndex=bytes[at+2]>>4;
    if(version===1||layer!==1||rateIndex===3||!bitIndex||bitIndex===15)fail('Use standard MPEG Layer III audio (MP3)');
    const rate=[44100,48000,32000][rateIndex]/(version===3?1:version===2?2:4);
    const kbps=(version===3?[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160])[bitIndex];
    const size=Math.floor((version===3?144:72)*kbps*1000/rate)+((bytes[at+2]>>1)&1),ch=(bytes[at+3]>>6)===3?1:2;
    if(at+size>bytes.length)fail('Truncated MP3 frame');
    if(sampleRate&&(sampleRate!==rate||channels!==ch))fail('MP3 sample rate and channel count must stay constant');
    sampleRate=rate;channels=ch;samples+=version===3?1152:576;
    bounds(channels,sampleRate,samples,bytes.length);frames.push([at,size]);at+=size;
  }
  if(frames.length<2)fail('MP3 contains too few complete frames');
  return {type:'mp3',sampleRate,channels,frames,samples,duration:samples/sampleRate};
}
export async function decodeAudio(bytes,progress=()=>{}){
  if(!(bytes instanceof Uint8Array)||bytes.length>IMPORT_LIMITS.bytes||bytes.length<4)fail('Audio must be no larger than 20 MiB');
  const isWav=String.fromCharCode(...bytes.subarray(0,4))==='RIFF';
  const info=isWav?inspectWav(bytes):inspectMp3(bytes);
  const data=Array.from({length:info.channels},()=>new Float32Array(isWav?info.frames:info.samples));
  if(isWav){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),step=info.bits/8;
    for(let i=0;i<info.frames;i++){
      for(let c=0;c<info.channels;c++){
        const at=info.start+i*info.align+c*step;
        let v=info.format===3?view.getFloat32(at,true):info.bits===8?(view.getUint8(at)-128)/128:info.bits===16?view.getInt16(at,true)/32768:info.bits===32?view.getInt32(at,true)/2147483648:((view.getUint8(at)|view.getUint8(at+1)<<8|view.getInt8(at+2)<<16)/8388608);
        if(!Number.isFinite(v)||Math.abs(v)>16)fail('WAVE contains invalid or extreme sample values');
        data[c][i]=v;
      }
      if(i%16384===0)progress(i/info.frames);
    }
    return {channels:data,sampleRate:info.sampleRate,duration:info.duration,type:'wav'};
  }
  await import('./vendor/mpg123-decoder.js');
  const decoder=new globalThis['mpg123-decoder'].MPEGDecoder({enableGapless:true});
  await decoder.ready;let offset=0;
  try{
    for(const [index,[start,size]] of info.frames.entries()){
      const result=decoder.decodeFrame(bytes.subarray(start,start+size));
      if(result.errors?.length)fail('MP3 decoder reported damaged audio');
      if(result.samplesDecoded){
        if(result.sampleRate!==info.sampleRate||offset+result.samplesDecoded>info.samples||result.channelData.length<info.channels)fail('MP3 decoded beyond its validated bounds');
        for(let c=0;c<info.channels;c++){
          const channel=result.channelData[c];
          if(channel.length!==result.samplesDecoded)fail('Invalid MP3 decoded frame');
          for(const v of channel)if(!Number.isFinite(v)||Math.abs(v)>16)fail('MP3 contains invalid decoded samples');
          data[c].set(channel,offset);
        }
        offset+=result.samplesDecoded;
      }
      if(index%64===0)progress(index/info.frames.length);
    }
  }finally{decoder.free();}
  if(!offset)fail('MP3 did not produce audio');
  return {channels:data.map(c=>c.subarray(0,offset)),sampleRate:info.sampleRate,duration:offset/info.sampleRate,type:'mp3'};
}
export function previewAudio(decoded,bins=1000){
  const out=new Float32Array(bins*2),data=decoded.channels;
  for(let b=0;b<bins;b++){
    let lo=0,hi=0;
    for(let i=Math.floor(b*data[0].length/bins);i<Math.floor((b+1)*data[0].length/bins);i++)for(const c of data){lo=Math.min(lo,c[i]);hi=Math.max(hi,c[i]);}
    out[b*2]=lo;out[b*2+1]=hi;
  }
  return out;
}
export function trimAudio(decoded,{start=0,end=Math.min(10,decoded.duration),channel='mix',sampleRate=48000}={}){
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>decoded.duration+1e-6||end-start<.001||end-start>10.000001)fail('Choose an excerpt between 1 ms and 10 seconds inside the clip');
  if(!['mix','left','right'].includes(channel)||![44100,48000].includes(sampleRate))fail('Invalid channel or destination sample rate');
  const a=Math.round(start*decoded.sampleRate),b=Math.min(decoded.channels[0].length,Math.round(end*decoded.sampleRate)),mono=new Float32Array(b-a);
  for(let i=0;i<mono.length;i++){
    const l=decoded.channels[0][a+i],r=decoded.channels[1]?.[a+i]??l;
    mono[i]=channel==='left'?l:channel==='right'?r:(l+r)/2;
  }
  const samples=resamplePCM(mono,decoded.sampleRate,sampleRate);
  let peak=0;for(const v of samples)peak=Math.max(peak,Math.abs(v));
  const attenuation=peak>1?1/peak:1;if(attenuation<1)for(let i=0;i<samples.length;i++)samples[i]*=attenuation;
  return {samples,sampleRate,provenance:{kind:'imported',type:decoded.type,sourceRate:decoded.sampleRate,sourceChannels:decoded.channels.length,start,end,channel,attenuation,resampling:'blackman-sinc-64 / oversample / fir-257'}};
}

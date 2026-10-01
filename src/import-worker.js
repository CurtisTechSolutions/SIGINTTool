import { decodeAudio, previewAudio, trimAudio } from './import-audio.js';
let decoded;
self.onmessage=async({data})=>{
  try{
    if(data.type==='load'){
      decoded=await decodeAudio(new Uint8Array(data.bytes),value=>postMessage({type:'progress',value}));
      const preview=previewAudio(decoded);
      postMessage({type:'loaded',duration:decoded.duration,sampleRate:decoded.sampleRate,channels:decoded.channels.length,preview},[preview.buffer]);
    }else if(data.type==='trim'){
      if(!decoded)throw new Error('Choose audio first');
      const result=trimAudio(decoded,data.options);
      postMessage({type:'trimmed',...result},[result.samples.buffer]);
    }
  }catch(e){postMessage({type:'error',message:e.message});}
};

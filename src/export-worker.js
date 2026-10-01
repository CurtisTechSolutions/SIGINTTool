import { render } from './render.js';
import { signalData, csv, javascript, python, exportScope } from './exports.js';
import { wav } from './format.js';
self.onmessage=async({data:{project,assets,format,representation,scope}})=>{
  try{
    const p=exportScope(project,scope),needsRender=format!=='coefficients'&&(format!=='csv'||representation!=='source');
    const result=needsRender?await render(p,assets,{includeSource:format!=='wav',progress:value=>postMessage({type:'progress',value})}):null;
    if(format==='wav'){
      const bytes=wav(result.samples,result.sampleRate,p.monitor);
      postMessage({type:'result',bytes,extension:'wav',mime:'audio/wav'},[bytes.buffer]);return;
    }
    const signal=signalData(p,result,assets);
    let text,extension,mime='text/plain';
    if(format==='csv'){text=csv(signal,representation);extension=representation+'.csv';mime='text/csv';}
    else if(format==='coefficients'){
      text=JSON.stringify({schemaVersion:1,algorithmVersion:1,units:signal.units,contract:signal.contract.coefficients,mode:p.mode,project:p,voices:signal.voices,timeline:signal.timeline},null,2);extension='coefficients.json';mime='application/json';
    }else if(format==='javascript'){text=javascript(signal);extension='mjs';mime='text/javascript';}
    else if(format==='python'){text=python(signal);extension='py';}
    else throw new Error('Unknown export format');
    postMessage({type:'result',text,extension,mime});
  }catch(e){postMessage({type:'error',message:e.message});}
};

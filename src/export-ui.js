import { clone } from './model.js';
import { download } from './format.js';
import { safeName } from './library.js';
export function installExports(app){
  const el=app.element,panel=app.addPanel('Take the sound and the math with you'),grid=el('div',{class:'control-grid'});
  const rate=el('select',{id:'export-rate'},...[[48000,'48 kHz'],[44100,'44.1 kHz']].map(([value,text])=>el('option',{value},text)));
  rate.value=app.project.sampleRate;rate.onchange=()=>app.edit(p=>{p.sampleRate=Number(rate.value);});
  const scope=el('select',{id:'export-scope'},el('option',{value:'mix'},'Current sound / mix'),el('option',{value:'selected'},'Selected oscillator'));
  const format=el('select',{id:'export-format'},...[[ 'wav','Audio · WAV (16-bit mono)'],['csv','Samples · CSV'],['coefficients','Models and coefficients · JSON'],['javascript','Complete functions · JavaScript'],['python','Complete functions · Python']].map(([value,text])=>el('option',{value},text)));
  const representation=el('select',{id:'export-representation'},...[[ 'source','Source · before modulation/conditioning'],['modulated','Modulated · before final conditioning'],['rendered','Rendered · includes monitor volume']].map(([value,text])=>el('option',{value},text)));
  const downloadButton=el('button',{id:'export-download',class:'primary'},'Download'),cancel=el('button',{id:'cancel-export',hidden:true},'Cancel export'),state=el('p',{id:'export-state',class:'hint',role:'status'},'WAV and Rendered samples include the current monitor volume exactly once.');
  for(const [label,input] of [['Sample rate',rate],['Scope',scope],['Format',format],['CSV representation',representation]])grid.append(el('label',{},label,input));
  grid.append(downloadButton,cancel);panel.append(grid,state,el('p',{class:'hint'},'Function files contain complete data and callable source, oscillator, modulated, and rendered functions. Drawn envelopes use integrated pitch. Clip effects are reproducible numerical tables, with settings recorded. Download a project bundle to keep editable audio sources. Selected-oscillator exports include only effects routed to that oscillator.'));
  let worker=null,intent=0;
  function stop(){intent++;worker?.terminate();worker=null;downloadButton.disabled=false;cancel.hidden=true;}
  cancel.onclick=()=>{stop();state.textContent='Export canceled. Your project is unchanged.';};
  format.onchange=()=>{representation.disabled=format.value!=='csv';};format.onchange();
  downloadButton.onclick=async()=>{
    stop();const token=intent,snapshot=clone(app.project);downloadButton.disabled=true;cancel.hidden=false;state.textContent='Preparing export…';
    try{
      const assets=await app.prepareAssets(snapshot);if(token!==intent)return;
      worker=new Worker(new URL('./export-worker.js',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{
        if(token!==intent)return;
        if(data.type==='progress'){state.textContent='Rendering export '+Math.round(data.value*100)+'%…';return;}
        if(data.type==='error')state.textContent='Export failed: '+data.message;
        else{download(safeName(snapshot.name)+'.'+data.extension,data.bytes||data.text,data.mime);state.textContent='Downloaded '+data.extension+' · '+snapshot.sampleRate+' Hz · snapshot preserved.';}
        stop();
      };
      worker.onerror=e=>{if(token===intent){state.textContent='Export failed: '+e.message;stop();}};
      worker.postMessage({project:snapshot,assets,format:format.value,representation:representation.value,scope:scope.value});
    }catch(e){if(token===intent){state.textContent='Export failed: '+e.message;stop();}}
  };
  app.onChange(p=>{rate.value=p.sampleRate;scope.disabled=p.mode==='timeline';});
  window.addEventListener('beforeunload',stop);
}

import { render } from './render.js';
self.onmessage=async({data})=>{
  try{
    const result=await render(data.project,data.assets,{rate:data.rate,bypass:data.bypass,progress:value=>self.postMessage({type:'progress',value})});
    self.postMessage({type:'result',result},[result.samples.buffer]);
  }catch(error){self.postMessage({type:'error',message:error.message});}
};

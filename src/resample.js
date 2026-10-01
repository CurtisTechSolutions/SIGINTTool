import { TAU } from './signal.js';
const TAPS=64,PHASES=256,HALF=TAPS/2;
const kernel=new Float64Array((PHASES+1)*TAPS);
for(let p=0;p<=PHASES;p++){
  let sum=0;
  for(let k=0;k<TAPS;k++){
    const x=k-(HALF-1)-p/PHASES;
    const w=.42+.5*Math.cos(Math.PI*x/HALF)+.08*Math.cos(TAU*x/HALF);
    const s=Math.abs(x)<1e-12?.9:Math.sin(Math.PI*.9*x)/(Math.PI*x);
    kernel[p*TAPS+k]=Math.abs(x)<=HALF?s*w:0;sum+=kernel[p*TAPS+k];
  }
  for(let k=0;k<TAPS;k++)kernel[p*TAPS+k]/=sum;
}
/** Band-limited reconstruction. Input is zero outside its finite extent unless loop is explicit. */
export function readClip(values, seconds, rate, loop=false) {
  if(!values.length || !Number.isFinite(seconds))return 0;
  let position=seconds*rate;
  if(loop&&(position<0||position>=values.length))position=((position%values.length)+values.length)%values.length;
  else if(position<0||position>=values.length)return 0;
  const index=Math.floor(position),fraction=(position-index)*PHASES,p=Math.floor(fraction),blend=fraction-p;
  let out=0;const start=index-(HALF-1),left=p*TAPS,right=(p+1)*TAPS,inverse=1-blend;
  if(start>=0&&start+TAPS<=values.length){
    for(let k=0;k<TAPS;k++)out+=values[start+k]*(kernel[left+k]*inverse+kernel[right+k]*blend);
    return out;
  }
  for(let k=0;k<TAPS;k++){
    let i=index+k-(HALF-1);
    if(loop)i=((i%values.length)+values.length)%values.length;
    if(i<0||i>=values.length)continue;
    out+=values[i]*(kernel[p*TAPS+k]*(1-blend)+kernel[(p+1)*TAPS+k]*blend);
  }
  return out;
}
export function decimationFilter(factor=4,taps=257) {
  const h=new Float64Array(taps),mid=(taps-1)/2,cutoff=.45/factor;let sum=0;
  for(let i=0;i<taps;i++){
    const x=i-mid,w=.42-.5*Math.cos(TAU*i/(taps-1))+.08*Math.cos(2*TAU*i/(taps-1));
    h[i]=(x===0?2*cutoff:Math.sin(TAU*cutoff*x)/(Math.PI*x))*w;sum+=h[i];
  }
  for(let i=0;i<taps;i++)h[i]/=sum;
  return h;
}
export function downsample(input,factor=4) {
  const h=decimationFilter(factor),half=(h.length-1)/2,out=new Float32Array(Math.round(input.length/factor));
  for(let n=0;n<out.length;n++){
    const center=n*factor,start=center-half;let sum=0;
    if(start>=0&&center+half<input.length){sum=input[center]*h[half];for(let j=1;j<=half;j++)sum+=(input[center-j]+input[center+j])*h[half+j];}
    else {const end=Math.min(h.length,input.length-start);for(let k=Math.max(0,-start);k<end;k++)sum+=input[start+k]*h[k];}
    out[n]=sum;
  }
  return out;
}
export function resamplePCM(input, sourceRate, targetRate) {
  if(sourceRate===targetRate)return Float32Array.from(input);
  // Resample through an oversampled grid; a final filter bounds the target bandwidth.
  const ratio=Math.max(1,sourceRate/targetRate),factor=ratio>4?8:4;
  if(ratio>8)throw new Error('Audio sample-rate ratio exceeds supported converter range');
  const intermediate=new Float64Array(Math.round(input.length/sourceRate*targetRate)*factor);
  for(let i=0;i<intermediate.length;i++)intermediate[i]=readClip(input,i/(targetRate*factor),sourceRate);
  return downsample(intermediate,factor);
}

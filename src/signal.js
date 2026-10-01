import { clamp } from './model.js';
export const TAU = 2 * Math.PI;
export function resolveStrokes(strokes, size, smooth = false, periodic = true) {
  const values = new Float64Array(size);
  for (const stroke of strokes) {
    const pts = stroke.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[i];
      const y0 = stroke.tool === 'eraser' ? 0 : a[1], y1 = stroke.tool === 'eraser' ? 0 : b[1];
      if (a[0] === b[0]) { values[clamp(Math.round(b[0] * size), 0, size - 1)] = y1; continue; }
      const start = Math.max(0, Math.ceil(Math.min(a[0], b[0]) * size));
      const end = Math.min(size - 1, Math.floor(Math.max(a[0], b[0]) * size));
      for (let n = start; n <= end; n++) values[n] = y0 + (y1-y0) * (n/size-a[0])/(b[0]-a[0]);
    }
  }
  if (!smooth) return values;
  const filtered = new Float64Array(size);
  for (let i=0;i<size;i++) filtered[i] = (values[i]*2 + values[i ? i-1 : periodic ? size-1 : 0] + values[i+1<size ? i+1 : periodic ? 0 : size-1])/4;
  return filtered;
}
export function sample(values, position, periodic = true) {
  if (!values.length || !Number.isFinite(position)) return 0;
  if (periodic) position = ((position % 1) + 1) % 1;
  else if (position < 0 || position >= 1) return 0;
  const x = position * values.length, i = Math.floor(x), f = x-i;
  return values[i]*(1-f) + values[i+1<values.length ? i+1 : periodic ? 0 : i]*f;
}
export function fft(real, imag = new Float64Array(real.length), inverse = false) {
  const n = real.length;
  if (n < 2 || (n & (n-1)) || imag.length !== n) throw new Error('FFT requires equal power-of-two arrays');
  for (let i=1,j=0;i<n;i++) {
    let bit=n>>1;
    for (;j&bit;bit>>=1) j^=bit;
    j^=bit;
    if(i<j){[real[i],real[j]]=[real[j],real[i]];[imag[i],imag[j]]=[imag[j],imag[i]];}
  }
  for(let len=2;len<=n;len*=2){
    const angle=(inverse?1:-1)*TAU/len, wr=Math.cos(angle), wi=Math.sin(angle);
    for(let i=0;i<n;i+=len){
      let ar=1,ai=0;
      for(let j=0;j<len/2;j++){
        const p=i+j,q=p+len/2,vr=real[q]*ar-imag[q]*ai,vi=real[q]*ai+imag[q]*ar;
        real[q]=real[p]-vr;imag[q]=imag[p]-vi;real[p]+=vr;imag[p]+=vi;
        const next=ar*wr-ai*wi;ai=ar*wi+ai*wr;ar=next;
      }
    }
  }
  if(inverse)for(let i=0;i<n;i++){real[i]/=n;imag[i]/=n;}
  return {real,imag};
}
export function coefficients(values) {
  const n=values.length,{real,imag}=fft(Float64Array.from(values)), a=new Float64Array(n/2+1),b=new Float64Array(n/2+1);
  a[0]=real[0]/n;
  for(let k=1;k<=n/2;k++){a[k]=real[k]*(k===n/2?1:2)/n;b[k]=k===n/2?0:-2*imag[k]/n;}
  return {a,b};
}
export function reconstruct(c, size, harmonics=c.a.length-1, removeDC=false) {
  const real=new Float64Array(size),imag=new Float64Array(size);
  real[0]=removeDC?0:c.a[0]*size;
  const max=Math.min(harmonics,c.a.length-1,size/2);
  for(let k=1;k<=max;k++){
    if(k===size/2){real[k]=c.a[k]*size;continue;}
    real[k]=real[size-k]=c.a[k]*size/2;
    imag[k]=-c.b[k]*size/2;imag[size-k]=c.b[k]*size/2;
  }
  return fft(real,imag,true).real;
}
export function metrics(values) {
  let sum=0,squares=0,peak=0;
  for(const x of values){sum+=x;squares+=x*x;peak=Math.max(peak,Math.abs(x));}
  return {peak,rms:Math.sqrt(squares/(values.length||1)),dc:sum/(values.length||1)};
}
export function errorMetric(source, model) {
  const {dc}=metrics(source);let error=0,variance=0,max=0;
  for(let i=0;i<source.length;i++){const d=source[i]-model[i];error+=d*d;variance+=(source[i]-dc)**2;max=Math.max(max,Math.abs(d));}
  return {nrmse:Math.sqrt(error/source.length)/Math.max(Math.sqrt(variance/source.length),1e-6),maxError:max};
}
export function analyze(values, hz=440, harmonics=64) {
  const c=coefficients(values), stats=metrics(values),n=values.length;
  let best=1,power=0;
  for(let k=1;k<Math.min(65,c.a.length-1);k++){const e=c.a[k]**2+c.b[k]**2;if(e>power){best=k;power=e;}}
  const amplitude=Math.sqrt(power),phase=Math.atan2(c.a[best],c.b[best]);
  const source=Float64Array.from({length:n*4},(_,i)=>sample(values,i/(n*4)));
  const fit=Float64Array.from(source,(_,i)=>c.a[0]+amplitude*Math.sin(TAU*best*i/source.length+phase));
  const approximation=reconstruct(c,source.length,harmonics);
  return {coefficients:c,...stats,sine:{amplitude,phase,offset:c.a[0],harmonic:best,hz:best*hz,...errorMetric(source,fit),
    flat:Math.sqrt(Math.max(0,stats.rms**2-stats.dc**2))<1e-6},fourier:errorMetric(source,approximation)};
}
export function envelope(points, position, logarithmic=false, fallback=1) {
  if(!points.length)return fallback;
  if(position<=points[0][0])return points[0][1];
  if(position>=points.at(-1)[0])return points.at(-1)[1];
  let lo=0,hi=points.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid][0]<=position)lo=mid;else hi=mid;}
  const [x,a]=points[lo],[y,b]=points[hi],r=(position-x)/(y-x);
  return logarithmic ? a*Math.exp(Math.log(b/a)*r) : a+(b-a)*r;
}
export function phaseAt(points, time, duration, fallback=440) {
  if(time<=0)return 0;
  if(!points.length)return fallback*time;
  let phase=0,previousTime=0,previousHz=points[0][1];
  for(let i=0;i<points.length;i++){
    const end=points[i][0]*duration,target=points[i][1],dt=end-previousTime;
    if(dt>0){
      const span=Math.min(time,end)-previousTime;
      if(span>0){
        const q=Math.log(target/previousHz)/dt;
        phase+=Math.abs(q)<1e-12 ? previousHz*span : previousHz*Math.expm1(q*span)/q;
      }
      if(time<=end)return phase;
    }
    previousTime=end;previousHz=target;
  }
  return phase+Math.max(0,time-previousTime)*previousHz;
}
export function spectrum(values, rate, maxSize=8192) {
  if(!values.length)return [];
  const n=2**Math.floor(Math.log2(Math.min(values.length,maxSize)));
  if(n<2)return [];
  const input=new Float64Array(n);let gain=0;
  for(let i=0;i<n;i++){const w=n===2?1:.5-.5*Math.cos(TAU*i/(n-1));gain+=w;input[i]=values[i]*w;}
  const {real,imag}=fft(input);
  return Array.from({length:n/2+1},(_,k)=>({hz:k*rate/n,magnitude:Math.hypot(real[k],imag[k])*(k===0||k===n/2?1:2)/gain}));
}

import { clamp, COLORS } from './model.js';
import { sample, envelope } from './signal.js';
export function editEnvelope(old,points,{fallback=1,log=false,erase=false,epsilon=1/480000}={}){
  let result=old.map(p=>[...p]);
  for(let i=0;i<points.length;i++){
    const a=points[Math.max(0,i-1)],b=points[i],lo=Math.min(a[0],b[0]),hi=Math.max(a[0],b[0]);
    const guards=[];
    if(lo>0){const x=Math.max(0,lo-epsilon);guards.push([x,envelope(result,x,log,fallback)]);}
    if(hi<1){const x=Math.min(1,hi+epsilon);guards.push([x,envelope(result,x,log,fallback)]);}
    result=result.filter(p=>p[0]<lo||p[0]>hi);
    const values=erase?[[a[0],fallback],[b[0],fallback]]:[a,b];
    const unique=new Map([...result,...guards,...values].map(p=>[p[0],p]));
    result=[...unique.values()].sort((a,b)=>a[0]-b[0]);
  }
  return result;
}
export class DrawingCanvas {
  constructor(canvas,settings,onStroke){
    this.canvas=canvas;this.settings=settings;this.onStroke=onStroke;this.points=null;this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(canvas);
    canvas.style.touchAction='none';
    canvas.addEventListener('pointerdown',e=>this.start(e));
    canvas.addEventListener('pointermove',e=>this.move(e));
    canvas.addEventListener('pointerup',e=>this.end(e));
    canvas.addEventListener('pointercancel',()=>{this.points=null;this.draw();});
    canvas.addEventListener('lostpointercapture',()=>{if(this.points){this.points=null;this.draw();}});
  }
  coords(e){
    const box=this.canvas.getBoundingClientRect(),s=this.settings(),x=s.pan+clamp((e.clientX-box.left)/box.width,0,1)/s.zoom,y=clamp((e.clientY-box.top)/box.height,0,1);
    let value=s.lane==='pitch'?20*1000**(1-y):s.lane==='gain'?1-y:1-2*y;
    let time=x;
    if(s.snap){time=Math.round(time*64)/64;value=s.lane==='pitch'?440*2**(Math.round(12*Math.log2(value/440))/12):Math.round(value*20)/20;}
    return [clamp(time,0,1),s.lane==='pitch'?clamp(value,20,20000):value];
  }
  start(e){if(e.button!==0)return;e.preventDefault();this.canvas.setPointerCapture(e.pointerId);this.points=[this.coords(e)];this.draw();}
  move(e){
    if(!this.points)return;
    const list=e.getCoalescedEvents?.()||[e],s=this.settings();
    for(const item of list){const p=this.coords(item),last=this.points.at(-1);if(Math.abs(p[0]-last[0])<1e-5&&Math.abs(p[1]-last[1])<1e-5)continue;if(s.tool==='line')this.points=[this.points[0],p];else if(this.points.length<20000)this.points.push(p);}
    this.draw();
  }
  end(e){if(!this.points)return;this.move(e);const points=this.points;this.points=null;this.canvas.releasePointerCapture(e.pointerId);this.onStroke(points,this.settings());this.draw();}
  draw(){
    const c=this.canvas,rect=c.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const dpr=Math.min(devicePixelRatio||1,2),w=rect.width,h=rect.height;
    if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
    const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const s=this.settings(),mapY=v=>s.lane==='pitch'?h*(1-Math.log(v/20)/Math.log(1000)):s.lane==='gain'?h*(1-v):h*(1-v)/2;
    ctx.strokeStyle='#273448';ctx.lineWidth=1;
    for(let i=0;i<=8;i++){ctx.beginPath();ctx.moveTo(w*i/8,0);ctx.lineTo(w*i/8,h);ctx.stroke();}
    for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(0,h*i/4);ctx.lineTo(w,h*i/4);ctx.stroke();}
    if(s.lane==='waveform'||s.lane==='timeline'){ctx.strokeStyle='#586882';ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();}
    for(const curve of s.curves){
      ctx.beginPath();ctx.strokeStyle=COLORS[curve.color]||'#b4c8df';ctx.lineWidth=curve.selected?2.5:1.5;ctx.globalAlpha=curve.selected?1:.55;ctx.setLineDash(curve.selected?[]:[5+curve.color*2,4]);
      for(let x=0;x<=w;x++){const u=s.pan+x/w/s.zoom,v=curve.value(u),y=mapY(v);if(!x)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
      ctx.stroke();
    }
    ctx.globalAlpha=1;ctx.setLineDash([]);
    if(this.points){
      ctx.beginPath();ctx.strokeStyle=s.tool==='eraser'?'#eef4ff':COLORS[s.color];ctx.lineWidth=3;
      this.points.forEach(([u,v],i)=>{const x=(u-s.pan)*s.zoom*w,y=mapY(v);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
    }
  }
  destroy(){this.observer.disconnect();}
}
export function drawSignal(canvas,values,{color='#55ddce',spectrum=false}={}){
  const box=canvas.getBoundingClientRect();if(!box.width)return;
  const dpr=Math.min(devicePixelRatio||1,2),w=box.width,h=box.height;
  canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  ctx.strokeStyle='#29384d';ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();
  for(let x=0;x<w;x++){const u=x/w,v=sample(values,u,false),y=spectrum?h*(1-Math.max(0,Math.min(1,v))):h*(.5-v*.45);if(x)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
  ctx.stroke();
}

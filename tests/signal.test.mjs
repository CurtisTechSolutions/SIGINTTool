import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStrokes, sample, coefficients, reconstruct, analyze, envelope, phaseAt, spectrum } from '../src/signal.js';
const close=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e, a+' != '+b);
test('latest segment wins including backward strokes, eraser, and vertical final value',()=>{
  const s=[{tool:'line',points:[[0,0],[1,1]]},{tool:'line',points:[[.75,-.5],[.25,.5]]},{tool:'eraser',points:[[.4,1],[.5,1]]},{tool:'line',points:[[.75,.9],[.75,.2]]}];
  const v=resolveStrokes(s,100);
  close(v[10],.1);close(v[30],.4);close(v[45],0);close(v[75],.2);close(v[90],.9);
});
test('periodic samples exclude duplicate endpoint and finite boundaries hold last interval',()=>{
  const v=resolveStrokes([{tool:'line',points:[[0,0],[1,1]]}],4);
  assert.deepEqual([...v],[0,.25,.5,.75]);
  close(sample(v,1),0);close(sample(v,-.25),.75);close(sample(v,.99,false),.75);close(sample(v,1,false),0);
});
test('DFT conventions recover phase, offset, harmonics and even Nyquist scaling',()=>{
  const n=128,values=Float64Array.from({length:n},(_,i)=>.1+.8*Math.sin(2*Math.PI*3*i/n+.4)+.2*Math.cos(Math.PI*i));
  const c=coefficients(values);
  close(c.a[0],.1);close(c.a[3],.8*Math.sin(.4));close(c.b[3],.8*Math.cos(.4));close(c.a[n/2],.2);
  const back=reconstruct(c,n);
  values.forEach((x,i)=>close(x,back[i]));
});
test('single-sine model recognizes repeated cycles and reports real error',()=>{
  const values=Float64Array.from({length:1024},(_,i)=>.1+.8*Math.sin(2*Math.PI*2*i/1024+Math.PI/6));
  const a=analyze(values,440,64);
  close(a.sine.amplitude,.8);close(a.sine.hz,880);close(a.sine.phase,Math.PI/6);
  assert.ok(a.sine.nrmse<.001);
  assert.equal(analyze(new Float64Array(256).fill(.3)).sine.flat,true);
});
test('log pitch integrates continuously and near-identical knots remain stable',()=>{
  close(envelope([[0,440],[1,880]],.5,true),440*Math.SQRT2);
  close(phaseAt([[0,440],[1,880]],2,2),880/Math.log(2));
  close(phaseAt([[0,440],[.5,440],[1,440]],2,2),880);
  close(phaseAt([[0,440],[1,440+1e-10]],2,2),880,1e-7);
  assert.equal(envelope([], .5, false, 1),1);
});
test('Hann spectrum peak identifies physical frequency',()=>{
  const rate=48000,values=Float64Array.from({length:8192},(_,i)=>Math.sin(2*Math.PI*1000*i/rate));
  const bins=spectrum(values,rate),peak=bins.reduce((a,b)=>a.magnitude>b.magnitude?a:b);
  assert.ok(Math.abs(peak.hz-1000)<rate/8192);
});

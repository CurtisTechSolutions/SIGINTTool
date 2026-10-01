import { project, voice, id, clone, COLORS, duration, preset } from './model.js';
import { History } from './history.js';
import { resolveStrokes, analyze, reconstruct, sample, envelope, spectrum } from './signal.js';
import { DrawingCanvas, editEnvelope, drawSignal } from './canvas.js';
import { Renderer, Transport } from './audio.js';
const $=selector=>document.querySelector(selector);
export function element(tag,attrs={},...children){
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(attrs)){
    if(key.startsWith('on'))node.addEventListener(key.slice(2),value);
    else if(key==='class')node.className=value;
    else if(key==='text')node.textContent=value;
    else if(key.startsWith('aria-'))node.setAttribute(key,String(value));
    else if(key==='style')for(const [name,v] of Object.entries(value))node.style.setProperty(name,v);
    else if(value!==undefined&&value!==false)node.setAttribute(key,value===true?'':String(value));
  }
  for(const child of children.flat())node.append(child instanceof Node?child:document.createTextNode(String(child)));
  return node;
}
const history=new History(project()),renderer=new Renderer(),changes=new Set(),cache=new Map();
let playbackClock=null,playbackFrame=0;
let playing=false,playingTag='editor',intent=0,lastRender=null,bypass=false,renderQueue=Promise.resolve();
const view={modelOverlay:false,tool:'pencil',zoom:1,pan:0,snap:false,only:false,hidden:new Set()};
const transport=new Transport((state,tag,details)=>{playing=state==='playing';playingTag=tag||playingTag;playbackClock=playing?{...details,loop:tag==='editor'&&app.project.loop}:null;cancelAnimationFrame(playbackFrame);updatePlayhead();$('#play').textContent=playing?'↻ Restart':'▶ Play';$('#play').setAttribute('aria-label',playing?'Restart playback':'Play sound');$('#transport-state').textContent=playing?'Playing '+(tag==='editor'?'current sound':tag):'Stopped';});
export const app={
  get project(){return history.current;},
  retainedAssetIds(){return [...new Set([history.current,...history.past,...history.future].flatMap(p=>p.assets))];},get lastRender(){return lastRender;},get playbackRevision(){return intent;},assets:{},
  element,transport,renderer,
  status(message,error=false){$('#status').textContent=message;$('#status').classList.toggle('error',error);},
  onChange(fn){changes.add(fn);return()=>changes.delete(fn);},
  edit(fn){try{if(history.edit(fn))changed();}catch(e){this.status(e.message,true);}},
  replace(value){history.replace(value);changed();},
  stop(){intent++;renderer.cancel();transport.stop();$('#render-progress').hidden=true;app.status('Stopped.');},
  async play(options={}){
    const token=++intent;
    try{
      app.status('Starting browser audio…');
      const rate=await transport.enable();if(token!==intent)return;
      const snapshot=clone(app.project);
      app.status('Rendering sound…');$('#render-progress').hidden=false;
      const assets=app.prepareAssets?await app.prepareAssets(snapshot):app.assets;
      if(token!==intent)return;
      const result=await renderer.run(snapshot,assets,{rate,bypass:options.bypass??bypass,progress:n=>{$('#render-progress').value=n;}});
      if(token!==intent)return;
      lastRender=result;transport.setVolume(snapshot.monitor);transport.play(result,{loop:snapshot.loop});
      app.status('Playing · '+result.warnings.join(' · '));inspectOutput();
    }catch(e){if(e.name!=='AbortError'&&token===intent)app.status(e.message,true);}
    finally{if(token===intent)$('#render-progress').hidden=true;}
  },
  async renderSnapshot(snapshot,rate){
    renderer.cancel();
    renderQueue=renderQueue.catch(()=>{}).then(async()=>{
      const assets=app.prepareAssets?await app.prepareAssets(snapshot):app.assets,worker=new Renderer();
      try{return await worker.run(snapshot,assets,{rate,progress:n=>app.status('Preparing audio '+Math.round(n*100)+'%…')});}
      finally{worker.cancel();}
    });
    return renderQueue;
  },
  refresh,addPanel(title){
    const panel=element('section',{class:'panel extra-panel'},element('h2',{text:title}));
    $('#extensions').append(panel);return panel;
  }
};

$('#app').innerHTML="<header class=\"topbar\"><a class=\"brand\" href=\"./\" aria-label=\"SIGINT home\">◒ SIGINT<span>Signal sketchpad</span></a><div class=\"transport\"><button id=\"play\" class=\"primary\" aria-label=\"Play sound\">▶ Play</button><button id=\"stop\">■ Stop</button><label class=\"monitor\">Monitor <input id=\"monitor\" type=\"range\" min=\"0\" max=\"1\" step=\".01\" value=\".1\" aria-label=\"Monitor volume\"><output id=\"monitor-value\">10%</output></label><span id=\"transport-state\">Stopped</span></div><div id=\"file-actions\" class=\"actions\"></div></header>\n<main id=\"workspace\">\n<div class=\"workspace-heading\"><div><p class=\"eyebrow\">DRAW → UNDERSTAND → HEAR</p><h1>Your next sound starts with a line.</h1></div><label class=\"project-name\">Sound name<input id=\"project-name\" maxlength=\"80\" value=\"Untitled sound\"></label></div>\n<div class=\"workspace-grid\">\n<aside class=\"panel voices-panel\"><div class=\"section-heading\"><h2>Oscillators</h2><button id=\"add-voice\" aria-label=\"Add oscillator\">＋</button></div><p class=\"hint\">One color. One voice. Your mix.</p><div id=\"voices\"></div><label class=\"check\"><input id=\"only\" type=\"checkbox\">Show selected voice only</label></aside>\n<section class=\"panel editor-panel\">\n<div class=\"tabs\" role=\"tablist\" aria-label=\"Workspace mode\"><button data-mode=\"waveform\" role=\"tab\">Waveform</button><button data-mode=\"envelope\" role=\"tab\">Envelopes</button><button data-mode=\"timeline\" role=\"tab\">Timeline</button></div>\n<div class=\"tool-row\"><div class=\"segmented\" aria-label=\"Drawing tools\"><button data-tool=\"pencil\">Pencil</button><button data-tool=\"line\">Line</button><button data-tool=\"eraser\">Eraser</button></div><button id=\"undo\" aria-label=\"Undo last edit\">↶ Undo</button><button id=\"redo\" aria-label=\"Redo last edit\">↷ Redo</button><button id=\"clear\">Clear</button><label class=\"check\"><input id=\"snap\" type=\"checkbox\">Snap</label></div>\n<div class=\"plot-heading\"><span id=\"canvas-title\">Waveform · signed amplitude</span><span id=\"time-extent\"></span></div>\n<div class=\"canvas-wrap\"><span class=\"axis-label\">+1<br><span>0</span><br>−1</span><canvas id=\"wave-canvas\" tabindex=\"0\" aria-label=\"Waveform drawing canvas. Numeric point controls are below.\"></canvas></div>\n<div class=\"axis-footer\"><span>Time →</span><span id=\"drawing-note\"></span></div>\n<div id=\"envelopes\" hidden><div class=\"plot-heading\"><span>Pitch · 20–20,000 Hz · logarithmic</span><span class=\"envelope-extent\"></span></div><canvas id=\"pitch-canvas\" class=\"lane\" tabindex=\"0\" aria-label=\"Pitch envelope drawing canvas\"></canvas><div class=\"plot-heading\"><span>Volume · linear gain 0–1</span><span class=\"envelope-extent\"></span></div><canvas id=\"gain-canvas\" class=\"lane\" tabindex=\"0\" aria-label=\"Volume envelope drawing canvas\"></canvas><p class=\"hint\">Pitch changes cycle spacing. Volume scales both sides of zero. Moving a waveform vertically adds DC.</p></div>\n<div class=\"viewport\"><label>Zoom<input id=\"zoom\" type=\"range\" min=\"1\" max=\"16\" step=\".5\" value=\"1\"></label><label>Position<input id=\"pan\" type=\"range\" min=\"0\" max=\"0\" step=\".001\" value=\"0\"></label><output id=\"zoom-value\">1×</output></div>\n<div id=\"voice-controls\" class=\"control-grid\"></div>\n<details class=\"numeric\"><summary>Edit exact points without drawing</summary><form id=\"point-form\" class=\"control-grid\"><label>Lane<select id=\"point-lane\"><option value=\"waveform\">Waveform</option><option value=\"pitch\">Pitch</option><option value=\"gain\">Volume</option></select></label><label>Time (seconds)<input id=\"point-time\" type=\"number\" min=\"0\" step=\"any\" value=\"0\" required></label><label>Value<input id=\"point-value\" type=\"number\" step=\"any\" value=\"0\" required></label><button type=\"submit\">Set point</button></form><p class=\"hint\">Waveform: −1…1. Pitch: 20…20,000 Hz. Volume: 0…1. Undo restores every edit.</p></details>\n</section>\n<aside class=\"panel inspector\"><p class=\"eyebrow\">THE MATH BEHIND THE SOUND</p><h2>Signal inspector</h2><div id=\"formula\" class=\"formula\"></div><label class=\"check\"><input id=\"model-overlay\" type=\"checkbox\">Overlay selected model · white dotted line</label><div id=\"metrics\" class=\"metrics\"></div><h3>What you hear</h3><p id=\"hearing\" class=\"hint\">Press Play to render the selected source.</p><canvas id=\"output-canvas\" class=\"preview\" aria-label=\"Rendered output waveform\"></canvas><p class=\"plot-caption\">Rendered time → · signed amplitude</p><canvas id=\"spectrum-canvas\" class=\"preview\" aria-label=\"Rendered frequency spectrum\"></canvas><p class=\"plot-caption\" id=\"spectrum-caption\">Frequency → Hz · linear component magnitude<br>Hann window · up to 8192 samples</p><label class=\"check\"><input id=\"bypass\" type=\"checkbox\">Compare without clip modulation</label><p class=\"hint\">Comparison restarts from the same initial phase and clip position.</p></aside>\n</div>\n<div class=\"status-bar\"><span id=\"status\" role=\"status\" aria-live=\"polite\">Draw on the canvas, then press Play. Sound stays on this device.</span><progress id=\"render-progress\" value=\"0\" max=\"1\" hidden aria-label=\"Audio render progress\"></progress></div>\n<div id=\"playhead\" hidden><progress id=\"playback-progress\" max=\"1\" value=\"0\" aria-label=\"Playback position\"></progress><output id=\"playback-time\"></output></div>\n<div id=\"extensions\"></div>\n</main><footer>Built for curiosity. Made to stay local. <a href=\"https://github.com/CurtisTechSolutions/SIGINTTool\">Source & documentation</a></footer>";
function updatePlayhead(){
  const root=$('#playhead');if(!root)return;root.hidden=!playbackClock;
  if(!playbackClock)return;
  const elapsed=Math.max(0,transport.context.currentTime-playbackClock.start),T=playbackClock.duration;
  const position=playbackClock.loop?elapsed%T:Math.min(T,elapsed);
  $('#playback-progress').value=position/T;$('#playback-time').textContent=position.toFixed(2)+' / '+T.toFixed(2)+' s';
  playbackFrame=requestAnimationFrame(updatePlayhead);
}
function selected(){return app.project.voices.find(v=>v.id===app.project.selectedId);}
function data(v){
  const old=cache.get(v.id);if(old?.voice===v)return old;
  const samples=resolveStrokes(v.waveform.strokes,v.waveform.resolution,v.waveform.smooth);
  const analysis=analyze(samples,v.hz,v.harmonics),model=v.source==='sine'?Float64Array.from({length:samples.length},(_,i)=>analysis.sine.offset+analysis.sine.amplitude*Math.sin(2*Math.PI*analysis.sine.harmonic*i/samples.length+analysis.sine.phase)):reconstruct(analysis.coefficients,samples.length,v.harmonics);
  const next={voice:v,samples,analysis,model};cache.set(v.id,next);return next;
}
function changed(){
  const wasPlaying=playing&&playingTag==='editor';intent++;renderer.cancel();
  lastRender=null;refresh();for(const fn of changes)fn(app.project);
  if(wasPlaying)app.play();else app.status('Updated. Press Play to hear the result.');
}
function field(label,tag,attrs,onchange){
  const input=element(tag,{...attrs,onchange:e=>onchange(e.target)});if('value'in attrs)input.value=attrs.value;
  return element('label',{},label,input);
}
function button(text,action,attrs={}){return element('button',{...attrs,onclick:action},text);}
function refreshVoices(){
  const p=app.project;$('#voices').replaceChildren();
  for(const [index,v] of p.voices.entries()){
    const row=element('article',{class:'voice'+(v.id===p.selectedId?' selected':''),style:{'--voice':COLORS[v.color]}});
    const select=button(v.name,()=>app.edit(p=>{p.selectedId=v.id;}),{class:'voice-select','aria-pressed':v.id===p.selectedId});
    row.append(select,field('Name','input',{value:v.name,maxlength:60,'data-key':v.id+'-name'},i=>app.edit(p=>{p.voices[index].name=i.value;})));
    const controls=element('div',{class:'voice-actions'});
    controls.append(button('M',()=>app.edit(p=>{p.voices[index].muted=!v.muted;}),{'aria-label':'Mute '+v.name,'aria-pressed':v.muted}),
      button('S',()=>app.edit(p=>{p.voices[index].solo=!v.solo;}),{'aria-label':'Solo '+v.name,'aria-pressed':v.solo}),
      button(view.hidden.has(v.id)?'Show':'Hide',()=>{view.hidden.has(v.id)?view.hidden.delete(v.id):view.hidden.add(v.id);refresh();},{'aria-label':'Toggle plot visibility for '+v.name}),
      button('↑',()=>app.edit(p=>{if(index>0)[p.voices[index-1],p.voices[index]]=[p.voices[index],p.voices[index-1]];}),{'aria-label':'Move '+v.name+' up',disabled:index===0}),
      button('Copy',()=>app.edit(p=>{if(p.voices.length===4)throw new Error('The initial limit is four oscillators');const copy=clone(v);copy.id=id();copy.name=(v.name+' copy').slice(0,60);copy.color=[0,1,2,3].find(c=>!p.voices.some(v=>v.color===c));p.voices.push(copy);p.selectedId=copy.id;}),{'aria-label':'Duplicate '+v.name}),
      button('×',()=>app.edit(p=>{if(p.voices.length===1)throw new Error('Keep at least one oscillator');p.voices=p.voices.filter(x=>x.id!==v.id);if(p.selectedId===v.id)p.selectedId=p.voices[0].id;if(p.modulation.oscillatorId===v.id)p.modulation.oscillatorId=p.voices[0].id;}),{'aria-label':'Remove '+v.name,disabled:p.voices.length===1}));
    row.append(controls);$('#voices').append(row);
  }
  $('#add-voice').disabled=p.voices.length===4;
}
function refreshControls(){
  const p=app.project,v=selected(),root=$('#voice-controls');root.replaceChildren();
  const change=fn=>app.edit(p=>fn(p.voices.find(x=>x.id===p.selectedId)));
  if(p.mode!=='timeline'){
    root.append(field('Repetition frequency · Hz','input',{type:'number',min:20,max:20000,step:'any',value:v.hz,'data-key':'frequency'},i=>change(v=>{v.hz=Number(i.value);})),
      field('Initial phase · cycles','input',{type:'number',min:0,max:1,step:.01,value:v.phase,'data-key':'phase'},i=>change(v=>{v.phase=Number(i.value);})));
    const source=field('Playback source','select',{'data-key':'source'},i=>change(v=>{v.source=i.value;}));
    source.lastChild.append(...[['drawing','Drawing'],['sine','Sine fit'],['fourier','Fourier approximation']].map(([value,text])=>element('option',{value},text)));source.lastChild.value=v.source;root.append(source);
    root.append(field('Fourier harmonics','input',{type:'number',min:1,max:1024,step:1,value:v.harmonics,'data-key':'harmonics'},i=>change(v=>{v.harmonics=Number(i.value);})));
    const presets=field('Start from a shape','select',{'data-key':'preset'},i=>{if(i.value)change(v=>{v.waveform.strokes=preset(i.value);});});
    presets.lastChild.append(...[['','Choose preset…'],['sine','Sine'],['triangle','Triangle'],['square','Square'],['saw','Sawtooth'],['silence','Silence']].map(([value,text])=>element('option',{value},text)));root.append(presets);
    const resolution=field('Source samples','select',{'data-key':'resolution'},i=>change(v=>{v.waveform.resolution=Number(i.value);}));
    resolution.lastChild.append(...[256,1024,4096,16384].map(n=>element('option',{value:n},n)));resolution.lastChild.value=v.waveform.resolution;root.append(resolution);
    root.append(field('Smooth drawing (reversible)','input',{type:'checkbox',checked:v.waveform.smooth,'data-key':'smooth'},i=>change(v=>{v.waveform.smooth=i.checked;})));
  }
  root.append(field('Sound duration · seconds','input',{type:'number',min:.001,max:10,step:'any',value:duration(p),'data-key':'duration'},i=>app.edit(p=>{if(p.mode==='timeline')p.timeline.duration=Number(i.value);else p.duration=Number(i.value);})),
    field('Loop playback','input',{type:'checkbox',checked:p.loop,'data-key':'loop'},i=>app.edit(p=>{p.loop=i.checked;})));
  if(p.mode==='envelope'){
    root.append(button('Pitch sweep',()=>change(v=>{v.pitch=[[0,220],[1,880]];})),button('Attack / decay',()=>change(v=>{v.gain=[[0,0],[.08,1],[.4,.6],[.8,.4],[1,0]];})));
  }
}
function curveSettings(lane){
  const p=app.project,v=selected(),actual=lane==='waveform'&&p.mode==='timeline'?'timeline':lane;
  let curves;
  if(actual==='timeline'){
    const values=resolveStrokes(p.timeline.strokes,p.timeline.resolution);
    curves=[{color:v.color,selected:true,value:u=>sample(values,u,false)}];
  }else curves=p.voices.filter(o=>(!view.only||o.id===v.id)&&!view.hidden.has(o.id)).map(o=>({
    color:o.color,selected:o.id===v.id,value:u=>actual==='waveform'?sample(data(o).samples,u*o.hz/v.hz):envelope(o[actual],u,actual==='pitch',actual==='pitch'?o.hz:1)
  }));
  if(actual==='waveform'&&view.modelOverlay)curves.push({color:v.color,strokeColor:'#e8edf5',pattern:[3,5],selected:false,value:u=>sample(data(v).model,u)});
  return {...view,lane:actual,color:v.color,curves};
}
function stroke(points,s){
  app.edit(p=>{
    const v=p.voices.find(x=>x.id===p.selectedId);
    if(s.lane==='waveform'||s.lane==='timeline'){
      const lane=s.lane==='timeline'?p.timeline:v.waveform;lane.strokes.push({tool:s.tool,points});
    }else v[s.lane]=editEnvelope(v[s.lane],points,{log:s.lane==='pitch',fallback:s.lane==='pitch'?v.hz:0,erase:s.tool==='eraser',epsilon:1/(p.duration*p.sampleRate)});
  });
}
const canvases=[
  new DrawingCanvas($('#wave-canvas'),()=>curveSettings('waveform'),stroke),
  new DrawingCanvas($('#pitch-canvas'),()=>curveSettings('pitch'),stroke),
  new DrawingCanvas($('#gain-canvas'),()=>curveSettings('gain'),stroke)
];
function draw(){canvases.forEach(c=>c.draw());}
function inspect(){
  const p=app.project,v=selected(),a=data(v).analysis,s=a.sine,fmt=n=>Number(n.toPrecision(5)).toString();
  $('#formula').replaceChildren();
  if(p.mode==='timeline')$('#formula').append(element('p',{},'Finite piecewise signal'),element('code',{},'x(t) = interpolated drawing; 0 outside [0, T)'));
  else{
    $('#formula').append(element('span',{class:'pill'},s.flat?'Constant / silence':s.nrmse<=.1?'Sine fit':'Best sine approximation'),
      element('code',{},s.flat?'x(t) = '+fmt(s.offset):'x(t) ≈ '+fmt(s.offset)+' + '+fmt(s.amplitude)+' sin(2π × '+fmt(s.hz)+'t + '+fmt(s.phase)+')'),
      element('p',{},'t in seconds · phase in radians'),
      element('p',{},'General function: piecewise-linear sample table, '+v.waveform.resolution+' samples.'),
      element('p',{},'Fourier: C + Σ[aₖ cos(2πkf₀t) + bₖ sin(2πkf₀t)]'));
    if(p.mode==='envelope')$('#formula').append(element('code',{},'s(t) = g(t) p(frac(θ₀ + ∫f(τ)dτ))'));
    if(p.voices.length>1)$('#formula').append(element('p',{},'Mix = sum of included oscillator functions. Muted voices are excluded.'));
  }
  const stats=p.mode==='timeline'?{...a,...(function(){const x=resolveStrokes(p.timeline.strokes,4096);let peak=0,sum=0,sq=0;for(const y of x){peak=Math.max(peak,Math.abs(y));sum+=y;sq+=y*y;}return {peak,dc:sum/x.length,rms:Math.sqrt(sq/x.length)};})()}:a;
  $('#metrics').replaceChildren(...[['Peak',fmt(stats.peak)],['RMS',fmt(stats.rms)],['Source DC',fmt(stats.dc)],['Sine error',p.mode==='timeline'?'—':(s.nrmse*100).toFixed(2)+'%'],['Fourier error',p.mode==='timeline'?'—':(a.fourier.nrmse*100).toFixed(2)+'%'],['Export rate',(p.sampleRate/1000)+' kHz']].map(([label,value])=>element('div',{},element('span',{},label),element('strong',{},value))));
  $('#hearing').textContent='Source: '+(p.mode==='timeline'?'direct amplitude timeline':v.source+' · selected '+v.name)+'. '+(p.mode==='timeline'&&p.timeline.duration>1?'A slow curve can be sub-audible. ':'')+'Press Play to inspect the rendered mix.';
  drawSignal($('#output-canvas'),new Float32Array(1));drawSignal($('#spectrum-canvas'),new Float32Array(1));
}
function inspectOutput(){
  if(!lastRender)return;
  drawSignal($('#output-canvas'),lastRender.samples);
  const bins=spectrum(lastRender.samples,lastRender.sampleRate),max=Math.max(1e-9,...bins.map(b=>b.magnitude));
  drawSignal($('#spectrum-canvas'),Float32Array.from(bins,b=>b.magnitude/max),{spectrum:true,color:'#b598ff'});
  $('#spectrum-caption').textContent='0 → '+(lastRender.sampleRate/2).toLocaleString()+' Hz · magnitude, display peak = '+max.toFixed(3)+' · Hann, '+Math.max(0,(bins.length-1)*2)+' samples';
  $('#hearing').textContent=lastRender.sampleRate+' Hz · '+lastRender.duration.toFixed(3)+' s · peak '+lastRender.peak.toFixed(3)+' · DC '+lastRender.dc.toFixed(5)+' · pre-monitor. '+lastRender.warnings.join('. ');
}
function refresh(){
  const active=document.activeElement?.dataset.key,p=app.project,v=selected();
  for(const key of cache.keys())if(!p.voices.some(v=>v.id===key))cache.delete(key);
  refreshVoices();refreshControls();inspect();if(lastRender)inspectOutput();
  $('#project-name').value=p.name;$('#monitor').value=p.monitor;$('#monitor-value').textContent=Math.round(p.monitor*100)+'%';transport.setVolume(p.monitor);
  $('#envelopes').hidden=p.mode!=='envelope';
  document.querySelectorAll('[data-mode]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.mode===p.mode));b.classList.toggle('active',b.dataset.mode===p.mode);});
  document.querySelectorAll('[data-tool]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.tool===view.tool));});
  $('#undo').disabled=!history.past.length;$('#redo').disabled=!history.future.length;
  $('#canvas-title').textContent=p.mode==='timeline'?'Timeline · direct signed amplitude':v.name+' · waveform · signed amplitude';
  const extent=p.mode==='timeline'?p.timeline.duration:1/v.hz;
  $('#time-extent').textContent=(view.pan*extent*1000).toFixed(2)+' → '+((view.pan+1/view.zoom)*extent*1000).toFixed(2)+' ms';
  $('#drawing-note').textContent=p.mode==='timeline'?'Drawing height is instantaneous amplitude.':'One cycle = '+(1000/v.hz).toFixed(3)+' ms · original shape';
  document.querySelectorAll('.envelope-extent').forEach(n=>{n.textContent=(view.pan*p.duration).toFixed(2)+' → '+((view.pan+1/view.zoom)*p.duration).toFixed(2)+' s';});
  if(p.mode==='timeline')$('#point-lane').value='waveform';
  $('#point-lane').disabled=p.mode!=='envelope';
  if(active)document.querySelector('[data-key="'+CSS.escape(active)+'"]')?.focus();
  requestAnimationFrame(draw);
}
const guide=element('details',{class:'quick-guide'},element('summary',{},'Start here · draw, listen, save'),element('ol',{},
  element('li',{},'Waveform draws one repeating cycle. Left to right is time; up and down is signed amplitude. Closer cycles in the same time mean higher frequency.'),
  element('li',{},'Envelopes add separate pitch (Hz) and volume (gain) lanes over the sound duration. Timeline plays the drawn amplitude directly and may be sub-audible when slowly varying.'),
  element('li',{},'Play starts browser audio. Monitor controls listening/export volume. Escape stops; Ctrl/Cmd+Z undoes. Numeric point controls work without a pointer.'),
  element('li',{},'Name the sound and Save as new. Open edits a copy; Update opened sound explicitly replaces the saved version. Download a project for a portable backup.'),
  element('li',{},'Upload a WAV/MP3 or choose a saved clip to modulate another sound. Ring uses signed samples; Volume follows loudness; clip Pitch also changes playback timing.')
));document.querySelector('.workspace-heading').after(guide);
$('#play').onclick=()=>app.play();$('#stop').onclick=()=>app.stop();
$('#monitor').oninput=e=>{transport.setVolume(Number(e.target.value));$('#monitor-value').textContent=Math.round(e.target.value*100)+'%';};
$('#monitor').onchange=e=>app.edit(p=>{p.monitor=Number(e.target.value);});
$('#project-name').onchange=e=>app.edit(p=>{p.name=e.target.value;});
$('#add-voice').onclick=()=>app.edit(p=>{if(p.voices.length===4)return;const v=voice(p.voices.length);v.color=[0,1,2,3].find(c=>!p.voices.some(v=>v.color===c));p.voices.push(v);p.selectedId=v.id;});
document.querySelectorAll('[data-mode]').forEach(b=>{b.onclick=()=>app.edit(p=>{p.mode=b.dataset.mode;if(p.mode==='timeline'&&p.modulation.target==='oscillator')p.modulation.target='mix';});});
document.querySelectorAll('[data-mode]').forEach((b,index)=>{b.onkeydown=e=>{
  const buttons=[...document.querySelectorAll('[data-mode]')];let next=index;
  if(e.key==='ArrowRight')next=(index+1)%buttons.length;else if(e.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;
  e.preventDefault();buttons[next].click();buttons[next].focus();
};});
document.querySelectorAll('[data-tool]').forEach(b=>{b.onclick=()=>{view.tool=b.dataset.tool;refresh();};});
$('#undo').onclick=()=>{if(history.undo())changed();};$('#redo').onclick=()=>{if(history.redo())changed();};
$('#clear').onclick=()=>app.edit(p=>{if(p.mode==='timeline')p.timeline.strokes=[];else p.voices.find(v=>v.id===p.selectedId).waveform.strokes=[];});
$('#only').onchange=e=>{view.only=e.target.checked;draw();};$('#snap').onchange=e=>{view.snap=e.target.checked;};
$('#zoom').oninput=e=>{view.zoom=Number(e.target.value);view.pan=Math.min(view.pan,1-1/view.zoom);$('#pan').max=1-1/view.zoom;$('#pan').value=view.pan;$('#zoom-value').textContent=view.zoom+'×';refresh();};
$('#pan').oninput=e=>{view.pan=Number(e.target.value);refresh();};
$('#model-overlay').onchange=e=>{view.modelOverlay=e.target.checked;draw();};
$('#bypass').onchange=e=>{bypass=e.target.checked;if(playing)app.play();};
$('#point-lane').onchange=e=>{$('#point-value').value=e.target.value==='pitch'?440:e.target.value==='gain'?1:0;};
$('#point-form').onsubmit=e=>{
  e.preventDefault();const lane=$('#point-lane').value,time=Number($('#point-time').value),value=Number($('#point-value').value),p=app.project,v=selected();
  const extent=lane==='waveform'?(p.mode==='timeline'?p.timeline.duration:1/v.hz):p.duration,u=time/extent;
  if(u<0||u>1){app.status('Point time must be within the visible signal domain.',true);return;}
  if(lane==='waveform')stroke([[u,value]],{lane:p.mode==='timeline'?'timeline':'waveform',tool:'pencil'});
  else app.edit(p=>{const v=p.voices.find(v=>v.id===p.selectedId);v[lane]=[...v[lane].filter(x=>x[0]!==u),[u,value]].sort((a,b)=>a[0]-b[0]);});
};
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){app.stop();return;}
  if(e.target.matches('input,textarea,select')||e.target.isContentEditable)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey?history.redo():history.undo())changed();}
  if(e.code==='Space'&&e.target===document.body){e.preventDefault();playing?app.stop():app.play();}
});
window.addEventListener('beforeunload',()=>{renderer.cancel();transport.stop();});
refresh();

import { installLibrary } from './library.js';
import { installAudioLibrary } from './audio-library.js';
import { installModulation } from './modulation-ui.js';
import { installExports } from './export-ui.js';
app.ready=installLibrary(app).then(()=>{installAudioLibrary(app);installModulation(app);installExports(app);});

import { project } from './model.js';
const p = project();
document.querySelector('#app').innerHTML = '<header><span class="brand">◒ SIGINT</span><span>Signal sketchpad</span></header><main id="workspace"><p class="eyebrow">DRAW → UNDERSTAND → HEAR</p><h1>A canvas for sound.</h1><p>Waveforms, pitch curves, and a place to keep the sounds you discover.</p><div class="panel"><h2>Workspace foundation</h2><p>The signal model and browser workspace are ready. Drawing and playback arrive in the next implementation slice.</p><p id="state"></p></div></main><footer>Local processing · No account required</footer>';
document.querySelector('#state').textContent = p.voices[0].name + ' · 440 Hz · 48 kHz';

import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('.fixtures',{recursive:true});
for(const [name,codec] of [['tone.mp3','libmp3lame'],['tone.wav','pcm_s16le']]){
  const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','sine=frequency=440:duration=0.2:sample_rate=44100','-ac','2','-codec:a',codec,'.fixtures/'+name],{encoding:'utf8'});
  if(result.status!==0)throw new Error('ffmpeg is required to generate codec test fixtures: '+(result.error?.message||result.stderr));
}
console.log('Generated independent WAV and MP3 fixtures.');

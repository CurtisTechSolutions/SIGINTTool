import { chromium, firefox, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const server = spawn(process.execPath, ['scripts/serve.mjs'], { stdio: 'inherit' });
try {
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4173')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  for(const [name,type] of Object.entries({chromium,firefox,webkit})){
    const browser=await type.launch({headless:true});
    let page;
    try{
      page=await browser.newPage({viewport:{width:1440,height:1000}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:4173');await page.locator('#status').waitFor();
      await page.evaluate(async()=>{window.testApp=(await import('/src/app.js')).app;await window.testApp.ready;});
      await page.getByRole('button',{name:'Add oscillator',exact:true}).click();
      assert.equal(await page.locator('.voice').count(),2);
      await page.locator('[data-mode="envelope"]').click();await page.locator('#pitch-canvas').waitFor({state:'visible'});
      await page.getByRole('button',{name:'Pitch sweep',exact:true}).click();
      await page.locator('[data-mode="waveform"]').click();
      await page.locator('[data-key="duration"]').fill('.08');await page.locator('[data-key="duration"]').press('Tab');
      const box=await page.locator('#wave-canvas').boundingBox();
      await page.mouse.move(box.x+box.width*.2,box.y+box.height*.3);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.7,{steps:12});await page.mouse.up();
      const before=await page.evaluate(async()=>JSON.stringify((await import('/src/app.js')).app.project));
      await page.locator('#undo').click();await page.locator('#redo').click();
      assert.equal(await page.evaluate(async()=>JSON.stringify((await import('/src/app.js')).app.project)),before);
      await page.getByRole('button',{name:'Play sound',exact:true}).click();
      await page.waitForFunction(()=>!!window.testApp.lastRender,null,{timeout:30000});
      const result=await page.evaluate(async()=>{const r=(await import('/src/app.js')).app.lastRender;return {peak:r.peak,length:r.samples.length};});
      assert.ok(result.peak>0&&result.peak<=.950001);assert.ok(result.length>3000);
      await page.locator('#stop').click();
      assert.equal(await page.locator('#transport-state').innerText(),'Stopped');
      await page.locator('#project-name').fill('CI saved sound');await page.locator('#project-name').press('Tab');
      await page.locator('#save-sound').click();await page.waitForFunction(()=>window.testApp.library.entries.length===1);
      await page.locator('[data-key="frequency"]').fill('880');await page.locator('[data-key="frequency"]').press('Tab');
      const isolation=await page.evaluate(async()=>{const app=window.testApp,entry=app.library.entries[0],saved=await app.store.get('projects',entry.projectId);return {saved:saved.project.voices[1].hz,current:app.project.voices[1].hz};});
      assert.equal(isolation.saved,440);assert.equal(isolation.current,880);
      await page.waitForFunction(()=>document.querySelector('#persist-state').textContent==='Draft saved locally');
      await page.reload();await page.evaluate(async()=>{window.testApp=(await import('/src/app.js')).app;await window.testApp.ready;});
      assert.equal(await page.locator('.sound-pad').count(),1);
      assert.equal(await page.evaluate(()=>window.testApp.transport.context),null);
      await page.getByRole('button',{name:'Open',exact:true}).click();
      await page.waitForFunction(()=>window.testApp.project.voices[1].hz===440);
      await page.getByRole('button',{name:'Play saved sound CI saved sound',exact:true}).click();
      await page.waitForFunction(()=>window.testApp.transport.context?.state==='running');
      await page.locator('#stop').click();
      for(const type of ['wav','mp3']){
        await page.locator('#audio-file').setInputFiles('.fixtures/tone.'+type);
        await page.locator('#keep-audio').waitFor({state:'visible'});
        await page.locator('#trim-end').fill('.1');
        await page.locator('#keep-audio').click();
        await page.waitForFunction(t=>document.querySelector('#import-state').textContent.startsWith('Kept tone.'+t),type,{timeout:30000});
      }
      assert.equal(await page.locator('.asset-row').count(),2);
      await page.locator('#mod-mode').selectOption('ring');
      await page.locator('#mod-depth').fill('1');await page.locator('#mod-depth').press('Tab');
      await page.locator('#mod-enabled').check();
      await page.getByRole('button',{name:'Play sound',exact:true}).click();
      await page.waitForFunction(()=>!!window.testApp.lastRender);
      assert.ok(await page.evaluate(()=>window.testApp.lastRender.peak>0));
      await page.locator('#stop').click();
      await page.locator('#mod-mode').selectOption('pitch');
      await page.locator('#mod-target').selectOption('oscillator');
      await page.locator('#mod-oscillator').selectOption(await page.evaluate(()=>window.testApp.project.voices[0].id));
      const route=await page.evaluate(()=>({target:window.testApp.project.modulation.oscillatorId,selected:window.testApp.project.selectedId}));
      assert.notEqual(route.target,route.selected);
      await page.getByRole('button',{name:'Play sound',exact:true}).click();await page.waitForFunction(()=>!!window.testApp.lastRender);await page.locator('#stop').click();
      const frozenId=await page.evaluate(()=>window.testApp.library.entries[0].audioId);
      await page.locator('#mod-source').selectOption(frozenId);
      await page.waitForFunction(id=>window.testApp.project.modulation.sourceId===id,frozenId);
      await page.getByRole('button',{name:'Remove CI saved sound',exact:true}).click();
      await page.waitForFunction(()=>window.testApp.library.entries.length===0);
      assert.ok(await page.evaluate(id=>window.testApp.project.assets.includes(id),frozenId));
      await page.locator('#save-sound').click();await page.waitForFunction(()=>window.testApp.library.entries.length===1);
      await page.locator('#export-rate').selectOption('44100');
      const beforeExport=await page.evaluate(()=>JSON.stringify(window.testApp.project));
      const [audioDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#export-download').click()]);
      const audioBytes=await readFile(await audioDownload.path());
      assert.equal(audioBytes.toString('ascii',0,4),'RIFF');assert.equal(audioBytes.readUInt32LE(24),44100);assert.equal(audioBytes.readUInt32LE(40),Math.round(.08*44100)*2);
      assert.equal(await page.evaluate(()=>JSON.stringify(window.testApp.project)),beforeExport);
      await page.locator('#export-format').selectOption('javascript');
      const [functionDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#export-download').click()]);
      const functionText=await readFile(await functionDownload.path(),'utf8');assert.match(functionText,/export const signal=/);assert.match(functionText,/"modulated":/);
      const [bundleDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#download-project').click()]);
      const portable=await browser.newContext({viewport:{width:1440,height:1000}}),fresh=await portable.newPage();
      await fresh.goto('http://127.0.0.1:4173');
      await fresh.evaluate(async()=>{window.testApp=(await import('/src/app.js')).app;await window.testApp.ready;});
      await fresh.getByLabel('Open project file').setInputFiles(await bundleDownload.path());
      await fresh.waitForFunction(()=>window.testApp.project.modulation.enabled&&window.testApp.project.assets.length===3);
      assert.equal(await fresh.evaluate(()=>window.testApp.transport.context),null);
      await fresh.getByRole('button',{name:'Play sound',exact:true}).click();
      await fresh.waitForFunction(()=>!!window.testApp.lastRender);assert.ok(await fresh.evaluate(()=>window.testApp.lastRender.peak>0));
      await portable.close();
      assert.deepEqual(errors,[]);
      if(name==='chromium')console.log('VISUAL:'+((await page.screenshot({type:'jpeg',quality:55,fullPage:true})).toString('base64')));
      console.log(name+': draw, voices, envelopes, undo/redo, worker audio, and Stop passed');
    }catch(error){if(page){console.log('APP_STATE:'+await page.evaluate(()=>JSON.stringify({status:document.querySelector('#status')?.textContent,transport:document.querySelector('#transport-state')?.textContent,hasRender:!!window.testApp?.lastRender,audioState:window.testApp?.transport.context?.state,sampleRate:window.testApp?.transport.context?.sampleRate})));console.log('VISUAL:'+((await page.screenshot({type:'jpeg',quality:50,fullPage:true})).toString('base64')));}throw error;}finally{await browser.close();}
  }
}finally{server.kill();}

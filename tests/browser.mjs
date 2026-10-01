import { chromium, firefox, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
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
      assert.deepEqual(errors,[]);
      if(name==='chromium')console.log('VISUAL:'+((await page.screenshot({type:'jpeg',quality:55,fullPage:true})).toString('base64')));
      console.log(name+': draw, voices, envelopes, undo/redo, worker audio, and Stop passed');
    }catch(error){if(page){console.log('APP_STATE:'+await page.evaluate(()=>JSON.stringify({status:document.querySelector('#status')?.textContent,transport:document.querySelector('#transport-state')?.textContent,hasRender:!!window.testApp?.lastRender,audioState:window.testApp?.transport.context?.state,sampleRate:window.testApp?.transport.context?.sampleRate})));console.log('VISUAL:'+((await page.screenshot({type:'jpeg',quality:50,fullPage:true})).toString('base64')));}throw error;}finally{await browser.close();}
  }
}finally{server.kill();}

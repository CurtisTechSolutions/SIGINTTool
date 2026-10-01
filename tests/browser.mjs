import { chromium, firefox, webkit } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn(process.execPath, ['scripts/serve.mjs'], { stdio: 'inherit' });
try {
  for (let i=0;i<100;i++) {
    try { if ((await fetch('http://127.0.0.1:4173')).ok) break; } catch {}
    await new Promise(r => setTimeout(r,100));
  }
  for (const [name,type] of Object.entries({chromium,firefox,webkit})) {
    const browser = await type.launch({headless:true});
    try {
      const page = await browser.newPage();
      const errors=[]; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:4173');
      await page.locator('#state').waitFor();
      assert.match(await page.title(), /SIGINT/);
      assert.match(await page.locator('#state').innerText(), /440/);
      assert.deepEqual(errors, []);
      console.log(name + ': workspace smoke passed');
    } finally { await browser.close(); }
  }
} finally { server.kill(); }

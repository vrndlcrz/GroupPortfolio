// Run with NODE_PATH pointing to a Playwright installation. Does not modify app data.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
(async () => {
  const phase = process.argv[2] || 'after';
  const out = path.resolve('.verification', phase); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type() === 'error') errors.push(m.text()); });
  await page.route('**/js/scene.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('this.init();', 'window.__desk = this; this.init();') });
  });
  await page.route('**/js/book.js', async route => {
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace('this.initDOM();','window.__book=this;this.initDOM();')});
  });
  if(phase==='before') {
    // Reproduce the starting frontend from Git without altering the working checkout.
    const originals=new Map(['index.html','css/book.css','js/main.js','js/scene.js'].map(file=>
      [file,execFileSync('git',['show','HEAD:src/main/resources/static/'+file],{encoding:'utf8',maxBuffer:4*1024*1024})]));
    await page.route('**/*',async route=>{
      const file=new URL(route.request().url()).pathname.replace(/^\//,'')||'index.html';
      if(!originals.has(file)) return route.fallback();
      let body=originals.get(file);if(file==='js/scene.js')body=body.replace('this.init();','window.__desk=this;this.init();');
      await route.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript'});
    });
  }
  // The visit counter request is stubbed to avoid creating persistent visitor data.
  await page.route('**/api/visit', route => route.fulfill({ json: { count: 1 } }));
  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver(list => window.__longTasks.push(...list.getEntries().map(e => e.duration))).observe({ type: 'longtask', buffered: true });
  });
  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(out, 'default.png') });
  const metrics = await page.evaluate(async () => {
    const intervals = []; let previous = performance.now(); const start = previous;
    await new Promise(resolve => { function frame(now) { intervals.push(now - previous); previous = now; if(now - start < 4000) requestAnimationFrame(frame); else resolve(); } requestAnimationFrame(frame); });
    return { fps: 1000 / (intervals.reduce((a,b) => a+b,0) / intervals.length), longestTaskMs: Math.max(0,...window.__longTasks), draws: __desk.renderer.info.render.calls, geometries: __desk.renderer.info.memory.geometries };
  });
  await page.evaluate(() => { __desk.rig.pitch = __desk.rig.targetPitch = -0.95; });
  await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, 'table.png') });
  await page.evaluate(() => { __desk.rig.yaw = __desk.rig.targetYaw = 1.3; __desk.rig.pitch = __desk.rig.targetPitch = 0; });
  await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, 'window.png') });
  await page.evaluate(() => { __desk.rig.yaw = __desk.rig.targetYaw = 0; __desk.rig.pitch = __desk.rig.targetPitch = -0.351; __desk.onFolderSelect(__desk.members[0]); });
  await page.waitForTimeout(1800); await page.screenshot({ path: path.join(out, 'book.png') });
  {
    await page.evaluate(()=>gsap.ticker.lagSmoothing(0));
    await page.locator('#nextPageBtn').click();await page.waitForFunction(()=>!__book.isFlipping);
    await page.locator('#nextPageBtn').click();await page.waitForFunction(()=>!__book.isFlipping);
    await page.screenshot({path:path.join(out,'book-open.png')});
    const contrast=await page.evaluate(()=>{
      const luminance=color=>{
        const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
        return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
      };
      const results=[];
      for(const member of __desk.members) {
        __book.open(member);
        const colors=[...new Set([...document.querySelectorAll('#pagesDeck .page-text,#pagesDeck .page-inner p,#pagesDeck .page-inner li,#pagesDeck .skill-funny-label')].map(el=>getComputedStyle(el).color))];
        const light=luminance('rgb(241,228,191)');
        results.push({member:member.name,colors,minimumContrastAgainstCream:Math.min(...colors.map(c=>(light+.05)/(luminance(c)+.05)))});
      }
      return results;
    });
    fs.writeFileSync(path.join(out,'contrast.json'),JSON.stringify(contrast,null,2));
  }
  fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify({ ...metrics, errors }, null, 2));
  console.log(JSON.stringify({ phase, ...metrics, errors })); await browser.close();
})();

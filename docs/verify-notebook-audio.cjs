// Start Spring first. Use NODE_PATH=.verification/node_modules (absolute on Windows).
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..');
  const report = { normalErrors: [], missingErrors: [], timings: [] };
  const browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  async function newPage(errors) {
    const page = await browser.newPage({viewport:{width:1100,height:800}});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.addInitScript(()=>{
      window.__audios=[];const NativeAudio=window.Audio;
      window.Audio=new Proxy(NativeAudio,{construct(target,args){const audio=Reflect.construct(target,args);__audios.push(audio);return audio;}});
      window.__timings=[];
    });
    await page.route('**/api/visit',route=>route.fulfill({json:{count:1}}));
    await page.route('**/js/book.js',async route=>{
      const response=await route.fetch();let body=(await response.text()).replace('this.initDOM();','window.__book=this;this.initDOM();');
      body+='\nfor(const name of ["open","prepareMusic"]) {const original=ClearBook.prototype[name];ClearBook.prototype[name]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{__timings.push({name,ms:performance.now()-start});}}}';
      await route.fulfill({response,body});
    });
    await page.route('**/js/scene.js',async route=>{
      const response=await route.fetch();let body=(await response.text()).replace('this.init();','window.__desk=this;this.init();');
      body+='\nconst originalSelect=DeskScene.prototype.selectFolder;DeskScene.prototype.selectFolder=function(...args){const start=performance.now();try{return originalSelect.apply(this,args);}finally{__timings.push({name:"selectFolder",ms:performance.now()-start});}}';
      await route.fulfill({response,body});
    });
    await page.goto('http://localhost:8080/',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__book && window.__desk?.renderer && document.getElementById('loadingScreen').style.display==='none');
    // Only test timing: compensate for multi-second software-rendered animation frames.
    await page.evaluate(()=>gsap.ticker.lagSmoothing(0));
    return page;
  }
  async function clickMember(page,index) {
    const point=await page.evaluate(index=>{
      const hit=__desk.folders[index].hitBox;__desk.scene.updateMatrixWorld(true);
      const target=hit.getWorldPosition(new THREE.Vector3()),delta=target.clone().sub(__desk.camera.position);
      __desk.rig.yaw=__desk.rig.targetYaw=Math.atan2(delta.x,-delta.z);
      __desk.rig.pitch=__desk.rig.targetPitch=Math.atan2(delta.y,Math.hypot(delta.x,delta.z));
      __desk.rig.applyLook();__desk.camera.updateMatrixWorld();const p=target.project(__desk.camera),r=__desk.renderer.domElement.getBoundingClientRect();
      return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
    },index);
    await page.mouse.click(point.x,point.y);
    await page.waitForFunction(()=>document.getElementById('bookOverlay').classList.contains('active'));
  }
  async function close(page) {
    await page.locator('#bookCloseBtn').click();
    await page.waitForFunction(()=>__book.music.audio.paused && !__desk.isCameraZoomed);
    await page.waitForTimeout(300);
  }
  const renamed=[];
  try {
    const page=await newPage(report.normalErrors);
    const head=await page.request.head('http://localhost:8080/assets/audio/notebook-theme.mp3');
    report.head={status:head.status(),length:head.headers()['content-length'],type:head.headers()['content-type']};assert.equal(head.status(),200);
    report.api=(await (await page.request.get('http://localhost:8080/api/site/classroom')).json()).audio;
    assert.equal(report.api.notebookTheme,'/assets/audio/notebook-theme.mp3');
    try { await page.waitForFunction(()=>__book.music.ready && __book.music.audio.readyState>=2); }
    catch(error) { report.preloadFailure=await page.evaluate(()=>({ready:__book.music.ready,disabled:__book.music.disabled,state:__book.music.audio.readyState,network:__book.music.audio.networkState,error:__book.music.audio.error?.message,src:__book.music.audio.src})); throw error; }
    report.startup=await page.evaluate(()=>({count:__audios.length,paused:__audios[0].paused,preload:__audios[0].preload,duration:__audios[0].duration,volume:__audios[0].volume}));
    assert.equal(report.startup.count,1);assert.equal(report.startup.paused,true);assert.equal(report.startup.preload,'auto');
    await clickMember(page,0);
    await page.waitForFunction(()=>!__book.music.audio.paused && __book.music.audio.currentTime>.1);
    report.playing=await page.evaluate(()=>({paused:__book.music.audio.paused,currentTime:__book.music.audio.currentTime,volume:__book.music.audio.volume,buttonHidden:__book.music.button.hidden}));
    assert.equal(report.playing.volume,.5);assert.equal(report.playing.buttonHidden,false);
    await page.locator('.book-music-btn').click();assert.equal(await page.evaluate(()=>__book.music.audio.muted),true);
    await close(page);
    report.closed=await page.evaluate(()=>({paused:__book.music.audio.paused,currentTime:__book.music.audio.currentTime,volume:__book.music.audio.volume}));
    assert.equal(report.closed.volume,0);assert.equal(report.closed.currentTime,0);
    await clickMember(page,0);assert.equal(await page.evaluate(()=>__book.music.audio.muted),true);
    // Switching directly to another portfolio must also fade and hide the toggle.
    await page.evaluate(()=>__book.open(__desk.members[1]));await page.waitForFunction(()=>__book.music.audio.paused);
    assert.equal(await page.locator('.book-music-btn').isVisible(),false);report.switchStops=true;
    await close(page);
    for(let i=1;i<4;i++) {await clickMember(page,i);assert.equal(await page.evaluate(()=>__book.music.audio.paused),true);assert.equal(await page.locator('.book-music-btn').isVisible(),false);await close(page);}
    report.otherMembersSilent=true;
    report.timings=await page.evaluate(()=>__timings);assert.equal(await page.evaluate(()=>__audios.length),1);
    await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__book?.music.ready);
    assert.equal(await page.evaluate(()=>__book.music.audio.muted),true);report.muteSurvivesReload=true;
    await page.close();
    // Actually remove both source and served build copies, restoring each in finally.
    for(const rel of ['src/main/resources/static/assets/audio/notebook-theme.mp3','target/classes/static/assets/audio/notebook-theme.mp3']) {
      const source=path.resolve(root,rel),backup=source+'.verification-backup';
      assert.ok(source.startsWith(root+path.sep));assert.ok(!fs.existsSync(backup));fs.renameSync(source,backup);renamed.push({source,backup});
    }
    const missing=await newPage(report.missingErrors);
    report.missingStatus=(await missing.request.head('http://localhost:8080/assets/audio/notebook-theme.mp3')).status();assert.equal(report.missingStatus,204);
    await missing.waitForFunction(()=>__book.music.disabled);await clickMember(missing,0);
    report.missing=await missing.evaluate(()=>({disabled:__book.music.disabled,paused:__book.music.audio.paused,buttonHidden:__book.music.button.hidden,toasts:document.querySelectorAll('.humor-toast').length,open:__book.isOpen()}));
    assert.equal(report.missing.open,true);assert.equal(report.missing.paused,true);assert.equal(report.missing.buttonHidden,true);assert.equal(report.missing.toasts,0);
    assert.deepEqual(report.normalErrors,[]);assert.deepEqual(report.missingErrors,[]);
  } finally {
    for(const {source,backup} of renamed.reverse()) fs.renameSync(backup,source);
    await browser.close();fs.writeFileSync(path.join(root,'.verification/notebook-audio.json'),JSON.stringify(report,null,2));
  }
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});

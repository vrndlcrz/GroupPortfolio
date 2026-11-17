const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1.5});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/api/visit',route=>route.fulfill({json:{count:1}}));
  await page.route('**/js/scene.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('this.init();','window.__desk=this;this.init();')});});
  await page.route('**/js/book.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('this.initDOM();','window.__book=this;this.initDOM();')});});
  const results={};
  await page.goto('http://localhost:8080/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__desk?.renderer && document.getElementById('loadingScreen').style.display==='none');
  // Software-rendered frames can exceed GSAP's lag threshold. Use wall-clock animation time in this test only.
  await page.evaluate(()=>gsap.ticker.lagSmoothing(0));
  results.scene=await page.evaluate(()=>({outlines:__desk.scene.userData.outlineCount,
    doorInteractive:__desk.interactiveObjects.some(o=>o.userData.type==='door'),
    outlinesShareGeometry:(()=>{let valid=true;__desk.scene.traverse(o=>{if(o.userData.themeOutline && (o.geometry!==o.parent.geometry||o.castShadow))valid=false;});return valid;})()}));
  assert.equal(results.scene.doorInteractive,false);assert.ok(results.scene.outlines<=120);assert.ok(results.scene.outlinesShareGeometry);
  const seat=await page.evaluate(()=>__desk.camera.position.toArray());
  await page.keyboard.down('d');await page.waitForTimeout(350);await page.keyboard.up('d');
  assert.deepEqual(await page.evaluate(()=>__desk.camera.position.toArray()),seat);results.wasdFixedSeat=true;
  // Aim the existing seated camera at each real hit box, then dispatch an actual pointer click.
  async function clickType(type,index=0) {
    const point=await page.evaluate(({type,index})=>{
      const hit=__desk.interactiveObjects.filter(o=>o.userData.type===type)[index];
      __desk.scene.updateMatrixWorld(true);const target=hit.getWorldPosition(new THREE.Vector3());
      const delta=target.clone().sub(__desk.camera.position);
      __desk.rig.yaw=__desk.rig.targetYaw=Math.atan2(delta.x,-delta.z);
      __desk.rig.pitch=__desk.rig.targetPitch=Math.atan2(delta.y,Math.hypot(delta.x,delta.z));
      __desk.rig.applyLook();__desk.camera.updateMatrixWorld();
      const p=target.project(__desk.camera),r=__desk.renderer.domElement.getBoundingClientRect();
      return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
    },{type,index});
    await page.mouse.click(point.x,point.y);
  }
  await clickType('teacher');
  await page.waitForFunction(()=>document.querySelector('.teacher-speech')?.classList.contains('visible'));
  results.seanSpeech=await page.locator('.teacher-speech').textContent();assert.ok(results.seanSpeech.length);
  for(let i=0;i<4;i++) {
    await clickType('folder',i);
    await page.locator('#bookOverlay.active').waitFor({timeout:30000});
    results['member'+(i+1)]=await page.locator('#memberPillName').textContent();
    await page.locator('#nextPageBtn').click();await page.waitForFunction(()=>!__book.isFlipping);
    assert.equal(await page.evaluate(()=>__book.currentPageIndex),1);
    if(i===0) {
      await page.locator('#nextPageBtn').click();await page.waitForFunction(()=>!__book.isFlipping);
      await page.screenshot({path:'.verification/after/book-open.png'});
    }
    await page.locator('#bookCloseBtn').click();
    await page.waitForFunction(()=>!__desk.isCameraZoomed);await page.waitForTimeout(400);
  }
  await clickType('laptop');await page.locator('#laptopErrorModal.active').waitFor({timeout:30000});results.laptop=true;
  const variants=[];
  for(const query of ['?filter=off','?filter=0.4','']) {
    await page.goto('http://localhost:8080/'+query,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__desk?.renderer);
    variants.push(await page.evaluate(()=>({query:location.search,config:Theme.config,hidden:document.getElementById('retro-filter').hidden,pixelRatio:__desk.renderer.getPixelRatio(),black:Theme.grade('#000000').getHexString(),canvasFilter:getComputedStyle(__desk.renderer.domElement).filter,date:document.getElementById('retro-date').textContent})));
    await page.screenshot({path:'.verification/after/filter-'+(query.includes('off')?'off':query?'04':'default')+'.png'});
  }
  assert.equal(variants[0].hidden,true);assert.equal(variants[0].black,'000000');assert.equal(variants[0].pixelRatio,1.5);
  assert.equal(variants[1].config.filterIntensity,.4);assert.equal(variants[1].pixelRatio,1.25);
  assert.equal(variants[2].config.filterIntensity,.7);assert.ok(variants.every(v=>v.canvasFilter==='none'));
  results.variants=variants;
  await page.emulateMedia({reducedMotion:'reduce'});
  results.reducedMotion=await page.evaluate(()=>getComputedStyle(document.getElementById('retro-filter'),'::after').animationName);assert.equal(results.reducedMotion,'none');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
  await page.screenshot({path:'.verification/after/mobile.png'});
  results.mobile=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth,date:document.getElementById('retro-date').getBoundingClientRect().toJSON()}));
  results.errors=errors;assert.deepEqual(errors,[]);
  fs.writeFileSync('.verification/interactions.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

// Requires Playwright and a running Spring server. Does not write real visitor data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const base=process.env.BASE_URL||'http://localhost:8082';
const out=path.join(root,'.verification');fs.mkdirSync(out,{recursive:true});
const result={};
(async()=>{
  for(let attempt=0;attempt<60;attempt++){
    try{const response=await fetch(base,{method:'HEAD',signal:AbortSignal.timeout(1000)});if(response.ok)break}catch{}
    if(attempt===59)throw new Error('Spring server is not ready at '+base);
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  const configured=process.env.BROWSER_PATH;
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const executablePath=configured||(fs.existsSync(edge)?edge:undefined);
  const browser=await chromium.launch({executablePath,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:850},reducedMotion:'reduce'});
    page.setDefaultTimeout(60000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const badResponses=[];page.on('response',r=>{if(r.status()>=400)badResponses.push(r.status()+' '+r.url())});
    await page.route('**/api/visit',r=>r.fulfill({json:{count:1,message:'Test visit'}}));
    await page.route('**/api/notes',r=>r.fulfill({json:[]}));
    await page.route('**/js/classroom/scene.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('this.init();','window.__desk=this;this.init();')})});
    await page.route('**/js/portfolio/book.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('this.initDOM();','window.__book=this;this.initDOM();')})});
    await page.goto(base+'/?intro=off',{waitUntil:'load'});
    await page.waitForFunction(()=>window.__desk?.renderer && __desk.experiences && window.__book);
    await page.evaluate(()=>gsap.ticker.lagSmoothing(0));
    result.classroom=true;
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('#easterEggBtn').click();
    await page.waitForFunction(()=>__desk.isFloating);
    await page.waitForFunction(()=>__desk.antiGravityRoots.every(o=>o.position.y!==__desk.getHomePose(o).position.y));
    result.zeroG=await page.evaluate(()=>({roots:__desk.antiGravityRoots.length,
      students:__desk.students.every(s=>__desk.antiGravityRoots.includes(s.person)),
      bags:__desk.studentBags.every(b=>__desk.antiGravityRoots.includes(b.mesh)),
      teacher:__desk.antiGravityRoots.includes(__desk.teacher),
      moved:__desk.antiGravityRoots.every(o=>o.position.y!==__desk.getHomePose(o).position.y)}));
    assert.ok(result.zeroG.roots>20);for(const key of ['students','bags','teacher','moved'])assert.ok(result.zeroG[key],key);
    await page.screenshot({path:path.join(out,'classroom-zero-g.png')});
    await page.locator('#easterEggBtn').click();await page.waitForFunction(()=>!__desk.antiGravityLanding);
    assert.equal(await page.evaluate(()=>__desk.antiGravityRoots.every(o=>{const h=__desk.getHomePose(o);return o.position.equals(h.position)&&o.rotation.equals(h.rotation)&&o.scale.equals(h.scale)})),true);
    result.gravityRestored=true;
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>__desk.enterDeskView());await page.waitForFunction(()=>__desk.view==='desk');
    for(let index=0;index<4;index++){
      await page.evaluate(i=>__desk.selectFolder(__desk.folders[i].mesh),index);
      await page.locator('#bookOverlay.active').waitFor();
      await page.locator('#nextPageBtn').click();await page.waitForFunction(()=>!__book.isFlipping);
      assert.equal(await page.evaluate(()=>__book.currentPageIndex),1);
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!__book.isOpen());
    }
    result.portfolios=4;
    await page.evaluate(()=>__desk.backToSeat());await page.waitForFunction(()=>__desk.view==='seat');
    await page.evaluate(()=>__desk.whiteboardController.open());
    await page.locator('#whiteboard-overlay.active').waitFor();
    const board=await page.locator('#whiteboard-canvas').boundingBox();
    await page.mouse.move(board.x+50,board.y+50);await page.mouse.down();await page.mouse.move(board.x+180,board.y+100,{steps:5});await page.mouse.up();
    await page.keyboard.press('Escape');
    assert.ok(await page.evaluate(()=>localStorage.getItem('gp.whiteboard.v1')?.startsWith('data:image/png')));
    result.whiteboard=true;
    await page.keyboard.press('c');await page.locator('#portfolio-phone:not([hidden])').waitFor();
    await page.getByRole('button',{name:'SpotiBai',exact:true}).click();
    assert.equal(await page.locator('.spotibai-track').count(),7);
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Labibi',exact:true}).click();
    await page.getByRole('button',{name:'Roll',exact:true}).click();await page.getByRole('button',{name:/^Keep and place on Sir Sean/}).click();
    await page.keyboard.press('Escape');result.phone=true;
    await page.locator('#darkModeBtn').click();await page.locator('#classroom-blackout:not([hidden])').click();
    assert.equal(await page.evaluate(()=>__desk.experiences.dark),false);result.darkMode=true;
    result.cursor=await page.locator('#phoneToggleBtn').evaluate(el=>getComputedStyle(el).cursor);
    assert.ok(result.cursor.includes('cartoon-hand.svg'));
    // Developer pages must work independently of the classroom scene.
    await page.goto(base+'/dev/book.html',{waitUntil:'load'});
    await page.waitForFunction(()=>window.__book?.isOpen());
    for(let i=1;i<=4;i++){
      await page.evaluate(id=>loadAndOpen(id),i);await page.waitForFunction(id=>__book.currentMember.id===id,i);
      await page.evaluate(()=>__book.close());
    }
    result.standalonePortfolios=4;
    await page.goto(base+'/dev/borders-test.html',{waitUntil:'load'});
    assert.equal(await page.locator('.border-card').count(),6);
    assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
    result.errors=errors;result.badResponses=badResponses;
    await page.close();
    // A genuine no-WebGL path still allows the portfolios to open.
    const fallback=await browser.newPage({reducedMotion:'reduce'});
    await fallback.addInitScript(()=>{Object.defineProperty(window,'WebGLRenderingContext',{value:undefined})});
    const fallbackErrors=[];fallback.on('pageerror',e=>fallbackErrors.push(e.message));
    await fallback.route('**/api/visit',r=>r.fulfill({json:{count:1}}));
    await fallback.goto(base+'/?intro=off');await fallback.locator('#fallbackGrid').waitFor();
    assert.equal(await fallback.locator('.fallback-folder-card').count(),4);
    await fallback.locator('.fallback-open-btn').first().click();await fallback.locator('#bookOverlay.active').waitFor();
    assert.deepEqual(fallbackErrors,[]);result.webglFallback=true;
  }finally{await browser.close();fs.writeFileSync(path.join(out,'ui-checks.json'),JSON.stringify(result,null,2));}
  console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});

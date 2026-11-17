const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/visit',route=>route.fulfill({json:{count:1}}));
    await page.route('**/api/site/classroom',route=>route.fulfill({status:503,body:''}));
    await page.route('**/*.woff2',route=>route.fulfill({status:404,body:''}));
    await page.route('**/*.ttf',route=>route.fulfill({status:404,body:''}));
    await page.goto('http://localhost:8080/',{waitUntil:'networkidle'});
    await page.waitForSelector('#scene-container canvas, #fallbackGrid');
    const result=await page.evaluate(()=>{
      const defaults=Theme.config;
      Theme.configure({...defaults,dateStamp:'01/02/2000'});
      return {defaults,dateOverride:document.getElementById('retro-date').textContent,sceneReady:!!document.querySelector('#scene-container canvas, #fallbackGrid')};
    });
    assert.equal(result.defaults.filterEnabled,true);assert.equal(result.defaults.filterIntensity,.7);
    assert.equal(result.dateOverride,'01/02/2000');assert.equal(result.sceneReady,true);assert.deepEqual(errors,[]);
    result.pageErrors=errors;fs.writeFileSync('.verification/fallbacks.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});

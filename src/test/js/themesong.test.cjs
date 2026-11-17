const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup({status=200,rejectPlay=false,pending=false,source}={}) {
  const instances=[],tweens=[],storage=new Map(),requests=[];
  class FakeAudio {
    constructor(){instances.push(this);this.paused=true;this.currentTime=0;this.events={};this.calls=0;}
    addEventListener(name,fn){this.events[name]=fn;}
    load(){this.loaded=true;}
    play(){this.calls++;this.paused=false;return rejectPlay?Promise.reject(new Error('blocked')):Promise.resolve();}
    pause(){this.paused=true;}
  }
  const button={hidden:true,addEventListener(name,fn){this.click=fn;},setAttribute(){}},credit={hidden:true};
  let finishHead;
  const context={Audio:FakeAudio,navigator:{userActivation:{isActive:true}},AbortSignal,
    sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    fetch:(url,options)=>{requests.push({url,options});return pending?new Promise(r=>finishHead=r):Promise.resolve({ok:status<400,status,headers:new Map()});},
    gsap:{killTweensOf(){},to:(target,options)=>{tweens.push(options);return {};}}};
  context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync('src/main/resources/static/js/themesong.js','utf8')+'\nglobalThis.Song=ThemeSong;',context);
  const song=new context.Song(button,credit,source);
  return {song,button,credit,context,instances,tweens,storage,requests,finishHead:()=>finishHead({ok:true,status:200,headers:new Map()})};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('preloads one startup audio and restarts it without new objects or requests',async()=>{
  const x=setup();assert.equal(x.instances.length,1);await x.song.prepared;
  assert.equal(x.song.audio.preload,'auto');assert.equal(x.song.audio.loop,true);assert.equal(x.song.audio.volume,.5);
  assert.equal(x.song.audio.calls,0);assert.equal(x.requests[0].options.method,'HEAD');
  x.song.start();await settle();x.song.audio.currentTime=40;x.song.stop(false);x.song.start();await settle();
  assert.equal(x.song.audio.currentTime,0);assert.equal(x.instances.length,1);assert.equal(x.requests.length,1);assert.equal(x.song.audio.calls,2);
});
test('missing and empty assets disable playback for the session',async()=>{
  for(const status of [204,404]) {const x=setup({status});await x.song.prepared;x.song.start();x.song.start();assert.equal(x.song.disabled,true);assert.equal(x.song.audio.calls,0);assert.equal(x.button.hidden,true);}
});
test('a pending HEAD never schedules playback after the click',async()=>{
  const x=setup({pending:true});x.song.start();x.finishHead();await x.song.prepared;assert.equal(x.song.audio.calls,0);
  x.context.navigator.userActivation.isActive=false;x.song.start();assert.equal(x.song.audio.calls,0);
});
test('autoplay rejection and decode failure remain silent and disable retries',async()=>{
  const blocked=setup({rejectPlay:true});await blocked.song.prepared;blocked.song.start();await settle();blocked.song.start();assert.equal(blocked.song.audio.calls,1);assert.equal(blocked.song.disabled,true);
  const corrupt=setup();await corrupt.song.prepared;corrupt.song.audio.events.error();corrupt.song.start();assert.equal(corrupt.song.audio.calls,0);assert.equal(corrupt.song.disabled,true);
});
test('close fades for 400ms and obsolete completions cannot pause a reopened song',async()=>{
  const x=setup();await x.song.prepared;x.song.start();await settle();x.song.stop();const old=x.tweens.at(-1);assert.equal(old.duration,.4);
  x.song.start();await settle();old.onComplete();assert.equal(x.song.audio.paused,false);
  x.song.stop();x.tweens.at(-1).onComplete();assert.equal(x.song.audio.paused,true);assert.equal(x.song.audio.currentTime,0);
});
test('existing mute choice is remembered and configuration defaults safely',async()=>{
  const x=setup({source:' '});await x.song.prepared;assert.equal(x.song.src,'/assets/audio/notebook-theme.mp3');x.song.start();await settle();x.button.click();assert.equal(x.song.audio.muted,true);assert.equal(x.storage.get('notebook.music.muted'),'true');
  const configured=setup({source:'/assets/audio/alternate.mp3'});await configured.song.prepared;assert.equal(configured.requests[0].url,'/assets/audio/alternate.mp3');
});

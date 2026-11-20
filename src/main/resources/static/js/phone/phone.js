/* Lazy phone UI for the classroom apps. */
const LABIBI_ROLLS = [
  {name:'Riam Choco Labibi', photo:'labibi-riam.png', fur:'#674C41', trim:'#D8A781', face:[94/519, 240/870, 309/519, 259/870]},
  {name:'Charella Berry Labibi', photo:'labibi-charella.png', fur:'#D987A7', trim:'#F4D4D4', face:[100/485, 226/831, 286/485, 239/831]},
  {name:'Vernie The Black Dog Labibi', photo:'labibi-vernie.png', fur:'#4D5055', trim:'#DED1C6', face:[118/517, 424/964, 269/517, 203/964]},
  {name:'Nicole Ube Labibi', photo:'labibi-nicole.png', fur:'#6BC9E1', trim:'#DCF1F0', face:[83/494, 385/979, 288/494, 241/979]}
];
class PortfolioPhone {
  constructor({button,config={},canOpen=()=>true,stopNotebook=()=>{}}) {
    Object.assign(this,{button,config:config||{},canOpen,stopNotebook});
    this.opened=false;this.media=new Map();this.likes=new Set();this.gesture=false;
    button.addEventListener('click',event=>{this.gesture ||= event.isTrusted;this.opened?this.close():this.open()});
    document.addEventListener('keydown',event=>{
      if(event.code!=='KeyC'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
      event.preventDefault();event.stopPropagation();this.gesture ||= event.isTrusted;this.opened?this.close():this.open();
    });
    this.offerShortcutHint();
  }
  offerShortcutHint() {
    if(this.hintShown)return;
    if(!this.canOpen()){this.hintWaitTimer=setTimeout(()=>this.offerShortcutHint(),250);return}
    this.hintShown=true;
    const hint=this.shortcutHint=this.element('div','phone-shortcut-hint','Use C to see Phone');
    hint.id='phone-shortcut-hint';hint.setAttribute('role','status');hint.setAttribute('aria-live','polite');
    document.body.append(hint);this.hintTimer=setTimeout(()=>hint.remove(),10000);
  }
  element(tag,className,text) {
    const node=document.createElement(tag);if(className)node.className=className;
    if(text!==undefined)node.textContent=text;return node;
  }
  icon(type) {
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('aria-hidden','true');
    const shapes=type==='spotibai'?
      [['circle',{cx:32,cy:32,r:27,fill:'#42B86B'}],['path',{d:'M28 40V20l18-4v21M28 24l18-4',fill:'none'}],['ellipse',{cx:23,cy:42,rx:6,ry:4,fill:'#FFF3D4'}],['ellipse',{cx:41,cy:39,rx:6,ry:4,fill:'#FFF3D4'}]]:
      type==='heart'||type==='labibi'?[['path',{d:'M32 53 10 32C-4 12 20 3 32 20 44 3 68 12 54 32Z',fill:'none'}]]:
      [['path',{d:'m8 17 32-8 10 35-32 9Z',fill:'#47BEB3'}],['path',{d:'m23 13 30 9-10 33-30-9Z',fill:'#EC7298'}],['path',{d:'m29 26 13 8-15 7Z',fill:'#FFF3D4'}]];
    for(const [tag,attrs] of shapes){const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);svg.append(node)}return svg;
  }
  action(label,handler,className='') {
    const button=this.element('button',className,label);button.type='button';button.addEventListener('click',handler);return button;
  }
  build() {
    if(this.root)return;
    const root=this.root=this.element('section','portfolio-phone');root.id='portfolio-phone';root.hidden=true;
    root.setAttribute('role','dialog');root.setAttribute('aria-modal','false');root.setAttribute('aria-labelledby','phone-title');
    const status=this.element('div','phone-status');status.setAttribute('aria-hidden','true');
    const signal=this.element('span','phone-signal');for(let i=0;i<3;i++)signal.append(this.element('i'));
    status.append(signal,this.element('span','phone-notch'),this.element('span','phone-battery'));
    const header=this.header=this.element('header','phone-header');
    this.title=this.element('h2','','Phone');this.title.id='phone-title';
    header.append(this.title);
    this.screen=this.element('div','phone-screen');
    this.content=this.element('div','phone-content');
    this.screen.append(status,header,this.content);
    root.append(this.screen);document.body.append(root);
    for(const type of ['pointerdown','pointerup','pointermove','mousedown','mouseup','mousemove','click','dblclick','wheel','touchstart','touchmove','touchend'])
      root.addEventListener(type,event=>event.stopPropagation(),{passive:true});
    root.addEventListener('pointerdown',event=>{this.gesture ||= event.isTrusted});
    root.addEventListener('keydown',event=>{this.gesture ||= event.isTrusted;
      if(this.app==='tiktik'&&['ArrowUp','ArrowDown'].includes(event.key)){
        event.preventDefault();event.stopPropagation();const index=Math.max(0,Math.min(this.pages.length-1,this.visible+(event.key==='ArrowDown'?1:-1)));
        this.pages[index]?.scrollIntoView({behavior:'smooth',block:'nearest'});
      }
    });
    document.addEventListener('keydown',event=>{
      if(!this.opened)return;
      if(event.key!=='Tab')return;
      const nodes=[...root.querySelectorAll('button,video[tabindex]'),document.getElementById('deskBackBtn')]
        .filter(node=>node&&!node.disabled&&node.getClientRects().length);
      const first=nodes[0],last=nodes[nodes.length-1],active=document.activeElement;
      if(event.shiftKey&&(active===first||!nodes.includes(active))){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&(active===last||!nodes.includes(active))){event.preventDefault();first?.focus()}
    },true);
    window.AudioMaster?.onChange(muted=>{for(const video of this.media.values())video.muted=muted});
    // Watch overlay roots, not frame-by-frame scene/bubble style changes. Discover lazy bag DOM too.
    const selector='#bookOverlay,#whiteboard-overlay,#bagOverlay,#bag-overlay,.bag-overlay,[data-bag-overlay]';
    this.overlayRoots=new Set();this.overlayStates=new Map();
    const active=node=>{
      if(node.classList.contains('active')||node.getAttribute('aria-hidden')==='false')return true;
      if(!node.matches('#bagOverlay,#bag-overlay,.bag-overlay,[data-bag-overlay]')||node.hidden||node.getAttribute('aria-hidden')==='true')return false;
      const style=getComputedStyle(node);return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0;
    };
    const register=node=>{if(node.nodeType!==1)return;const roots=[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)];
      for(const overlay of roots)if(!this.overlayRoots.has(overlay)){this.overlayRoots.add(overlay);this.overlayStates.set(overlay,active(overlay));if(this.opened&&active(overlay))this.close(true);this.overlayObserver.observe(overlay,{attributes:true,attributeFilter:['class','hidden','aria-hidden','style']})}};
    this.overlayObserver=new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes)register(node);
      for(const record of records)if(record.type==='attributes'&&this.overlayRoots.has(record.target)){
        const isActive=active(record.target),wasActive=this.overlayStates.get(record.target);this.overlayStates.set(record.target,isActive);
        if(this.opened&&isActive&&!wasActive)this.close(true);
      }
    });
    this.overlayObserver.observe(document.body,{childList:true,subtree:true});register(document.body);
  }
  open() {
    if(this.opened||!this.canOpen())return false;
    this.hintShown=true;clearTimeout(this.hintWaitTimer);clearTimeout(this.hintTimer);this.shortcutHint?.remove();
    this.build();this.stopNotebook();this.opened=true;this.root.hidden=false;this.root.inert=false;
    this.root.style.pointerEvents='auto';this.button.setAttribute('aria-expanded','true');this.showHome();
    if(window.gsap){gsap.killTweensOf(this.root);gsap.fromTo(this.root,{yPercent:110},{yPercent:0,duration:.5,ease:'power2.out'})}
    this.screen.querySelector('button')?.focus();return true;
  }
  close(immediate=false) {
    if(!this.root||!this.opened)return;
    const restore=this.root.contains(document.activeElement);this.opened=false;this.stopMedia();
    this.root.inert=true;this.root.style.pointerEvents='none';this.button.setAttribute('aria-expanded','false');
    const finish=()=>{if(!this.opened)this.root.hidden=true};
    if(window.gsap){gsap.killTweensOf(this.root);if(!immediate)gsap.to(this.root,{yPercent:110,duration:.4,ease:'power2.out',onComplete:finish});else finish()}else finish();
    if(restore)this.button.focus();
  }
  showHome() {
    this.stopMedia();this.app='home';this.title.textContent='Phone';
    this.header.hidden=true;
    const home=this.element('div','phone-apps');
    for(const [type,name,open] of [['spotibai','SpotiBai',()=>this.showSpotiBai()],['labibi','Labibi',()=>this.showLabibi()]]){
      const button=this.action('',open,'phone-app');
      button.append(this.icon(type),this.element('span','',name));home.append(button);
    }
    this.content.replaceChildren(home);
  }

  goBack() {
    if (this.app==='home') this.close(true);
    else {this.showHome();this.screen.querySelector('button')?.focus();}
  }
  static localVideoPath(value) {
    try {
      if(typeof value!=='string'||!value.startsWith('/assets/videos/')||value.includes('\\'))return null;
      const decoded=decodeURIComponent(value);if(decoded.split('/').some(part=>part==='..'||part==='.')||decoded.includes('\\'))return null;
      const url=new URL(value,location.origin);
      return url.origin===location.origin&&url.pathname.startsWith('/assets/videos/')&&!url.search&&!url.hash?url.pathname:null;
    }catch{return null}
  }
  showSpotiBai() {
    this.stopMedia();this.app='spotibai';this.title.textContent='SpotiBai';
    this.header.hidden=false;
    const list=this.element('div','phone-playlists');
    const status=this.element('p','phone-placeholder');
    status.setAttribute('role','status');
    for (const track of this.config.tracks || []) {
      const row=this.element('article','phone-playlist-card spotibai-track');
      const name=this.element('strong','phone-playlist-copy',track.title);
      const play=this.action('Play',()=>{
        const experience=this.experiences;
        if (experience.track===track) {
          experience.stopTrack();
          play.textContent='Play';
          status.textContent='';
          return;
        }
        list.querySelectorAll('[data-track-play]').forEach(button=>button.textContent='Play');
        experience.playTrack(track,()=>{
          play.textContent='Play';
          status.textContent='';
        }).then(started=>{
          play.textContent=started?'Stop':'Play';
          status.textContent=started?'Playing '+track.title:'Audio could not start.';
          if (started && track.id==='tma') this.close(true);
        });
      });
      play.dataset.trackPlay='';
      play.disabled=!track.audioAvailable;
      if (this.experiences?.track===track) play.textContent='Stop';
      row.append(name,play);
      if (!track.audioAvailable) row.append(this.element('small','','Audio pending'));
      if (track.videoAvailable) row.append(this.action('Connect to TV',()=>{
        this.close(true);
        this.experiences?.playTV(track);
      }));
      list.append(row);
    }
    this.content.replaceChildren(list,status);
  }

  showLabibi(rolled = this.rolledLabibi) {
    this.stopMedia();this.app='labibi';this.title.textContent='Labibi';
    this.header.hidden=false;
    const card=this.element('div',rolled?'phone-labibi phone-labibi-rolled':'phone-labibi');
    const controls=this.element('div','phone-labibi-controls');
    const ready=!!this.experiences?.s.deskGroup;
    if (ready && rolled) {
      const toy=this.element('img','phone-labibi-preview');
      toy.src='assets/photos/'+rolled.photo;toy.alt=rolled.name;
      card.append(toy,this.element('strong','',rolled.name));
      const keep=this.action('Keep and place on Sir Sean’s desk',()=>{
        this.experiences.placeLabibi(rolled);
        this.rolledLabibi=null;
        this.close(true);
        this.experiences.zoomLabibi();
      });
      keep.setAttribute('aria-label',keep.textContent);keep.textContent='Keep';
      controls.append(keep);
    }
    const roll=this.action(rolled?'Roll again':'Roll',()=>{
      this.rolledLabibi=LABIBI_ROLLS[Math.floor(Math.random()*LABIBI_ROLLS.length)];
      this.showLabibi(this.rolledLabibi);
    });
    roll.disabled=!ready;
    controls.append(roll);card.append(controls);
    this.content.replaceChildren(card);
  }

  showTiktik() {
    this.stopMedia();this.app='tiktik';this.title.textContent='Tiktik';
    this.header.hidden=false;
    this.entries=Array.isArray(this.config.videos)?this.config.videos:[];this.failed=new Set();this.visible=-1;
    const feed=this.feed=this.element('div','phone-video-feed');feed.setAttribute('aria-label','Group videos');feed.tabIndex=0;
    this.pages=[];this.mounts=[];
    if(!this.entries.length)feed.append(this.element('p','phone-placeholder','Our videos go here'));
    this.entries.forEach((entry,index)=>{
      const page=this.element('section','phone-video-page');page.dataset.index=index;
      const mount=this.element('div','phone-video-mount'),caption=this.element('div','phone-video-caption');
      caption.append(this.element('strong','',entry.member||'Group member'),this.element('p','',entry.title||'Our video'));
      const heart=this.action('',()=>{const id=entry.id||index;if(this.likes.has(id))this.likes.delete(id);else this.likes.add(id);heart.setAttribute('aria-pressed',String(this.likes.has(id)))},'phone-heart');
      heart.setAttribute('aria-label','Like '+(entry.title||'video'));heart.setAttribute('aria-pressed',String(this.likes.has(entry.id||index)));heart.append(this.icon('heart'));
      page.append(mount,caption,heart);feed.append(page);this.pages.push(page);this.mounts.push(mount);
    });
    this.content.replaceChildren(feed);
    this.videoObserver=new IntersectionObserver(entries=>{
      if(!this.opened||this.app!=='tiktik')return;
      for(const entry of entries)if(entry.isIntersecting&&entry.intersectionRatio>=.6)this.setVisible(Number(entry.target.dataset.index));
    },{root:feed,threshold:[.6]});
    for(const page of this.pages)this.videoObserver.observe(page);
  }
  unload(index) {
    const video=this.media.get(index);if(!video)return;this.media.delete(index);
    video.onerror=null;video.pause();video.removeAttribute('src');video.load();video.remove();
  }
  videoFailure(index) {
    this.unload(index);this.failed.add(index);
    this.mounts[index]?.replaceChildren(this.element('p','phone-placeholder','Our videos go here'));
    if(!this.loggedFailure){this.loggedFailure=true;console.debug('Phone: a group video is unavailable.')}
  }
  loadVideo(index) {
    if(this.media.has(index)||this.failed.has(index)||!this.entries[index])return;
    const entry=this.entries[index],src=PortfolioPhone.localVideoPath(entry.src);
    if(!src||entry.available===false){this.videoFailure(index);return}
    const video=document.createElement('video');video.playsInline=true;video.loop=true;video.preload='none';video.tabIndex=0;
    video.setAttribute('aria-label',(entry.title||'Group video')+' — play or pause');video.muted=window.AudioMaster?.muted??false;
    const poster=PortfolioPhone.localVideoPath(entry.poster);if(poster&&entry.posterAvailable!==false)video.poster=poster;
    video.onerror=()=>{if(this.media.get(index)===video)this.videoFailure(index)};
    video.onplay=()=>{if(!this.opened||this.app!=='tiktik'||this.visible!==index)video.pause()};
    const toggle=()=>{this.gesture=true;video.paused?video.play().catch(()=>{}):video.pause()};
    video.onclick=toggle;video.onkeydown=event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();event.stopPropagation();toggle()}};
    this.media.set(index,video);video.src=src;this.mounts[index].replaceChildren(video);
  }
  setVisible(index) {
    if(index===this.visible||!this.entries[index])return;this.visible=index;
    for(const key of [...this.media.keys()])if(key!==index&&key!==index+1)this.unload(key);
    this.loadVideo(index);this.loadVideo(index+1);
    for(const [key,video] of this.media)if(key!==index)video.pause();
    const current=this.media.get(index);if(current&&this.gesture)current.play().catch(()=>{});
  }
  stopMedia() {
    this.videoObserver?.disconnect();this.videoObserver=null;
    for(const index of [...this.media.keys()])this.unload(index);
  }
}

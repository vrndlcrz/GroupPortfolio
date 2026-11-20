const SPOTIBAI_START_SECONDS = Object.freeze({ preso: 20, tma: 148 });

/* Classroom events reuse the room's geometry, ink and toon palette. */
class ClassroomExperiences {
  constructor(scene,{phone,book}) {
    this.s=scene;this.phone=phone;this.book=book;scene.experiences=this;phone.experiences=this;
    if (!scene.renderer) return;
    this.teacherLines=['Nak ano yan nak','I don’t know menn','Ah ganon agnas'];
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');this.materials=new Map();this.actors={};this.scraps=[];this.cueIndex=-1;
    this.point=new THREE.Vector3();this.concertStart=97.06;
    this.buildBanner();this.buildScraps();this.registerDoor();this.buildBasketball();
    const enter=scene.enterDeskView.bind(scene);scene.enterDeskView=(...args)=>{this.stopConcert();return enter(...args)};
    window.addEventListener('keydown',event=>{
      if(this.dark){event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape')this.leaveDark();return;}
      if(event.key!=='Escape')return;
      if(this.concertTransition){event.preventDefault();event.stopImmediatePropagation();this.stopConcert();}
      else if(this.cameraFocus){event.preventDefault();event.stopImmediatePropagation();if(this.cleaning)this.finishCleanup();else this.releaseFocus();}
      else if(this.concertActive){event.preventDefault();event.stopImmediatePropagation();this.stopConcert();}
      else if(this.scrapOpen){event.preventDefault();event.stopImmediatePropagation();this.closeScrap();}
    },true);
    window.AudioMaster?.onChange(muted=>{
      for (const media of [this.audio,this.trackAudio,this.tvAudio,this.cueAudio]) if (media) media.muted=muted;
    });
  }
  get blocking(){return !!(this.dark||this.scrapOpen||this.cameraFocus||this.throwingNote||this.concertTransition)}
  get speaking(){return !!(this.concertActive||this.cleaning||this.kimActive)}
  paint(color){if(!this.materials.has(color))this.materials.set(color,Theme.toon(color));return this.materials.get(color)}
  mesh(parent,shape,color,x,y,z,w,h,d,outline=true) {
    const mesh=new THREE.Mesh(this.s.studentGeometry[shape],this.paint(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
    mesh.castShadow=false;mesh.receiveShadow=true;parent.add(mesh);if(outline)Theme.addOutline(mesh);return mesh;
  }
  batch(parent,shape,color,poses) {
    const mesh=new THREE.InstancedMesh(this.s.studentGeometry[shape],this.paint(color),poses.length),pose=new THREE.Object3D();
    for(let i=0;i<poses.length;i++){const [x,y,z,w,h,d]=poses[i];pose.position.set(x,y,z);pose.scale.set(w,h,d);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix)}
    mesh.castShadow=false;parent.add(mesh);Theme.addOutline(mesh);return mesh;
  }
  buildBanner() {
    const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=160;canvas.textContent='Para sa G ang temang to';
    const map=new THREE.CanvasTexture(canvas);
    document.fonts.load('86px "Lilita One"').catch(()=>{}).then(()=>{
      const draw=()=>{const ctx=canvas.getContext('2d'),text=canvas.textContent;ctx.strokeStyle=Theme.ink;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(10,18);ctx.quadraticCurveTo(1024,65,2038,18);ctx.stroke();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='86px "Lilita One", sans-serif';ctx.lineJoin='round';
        for(let i=0;i<text.length;i++){if(text[i]===' ')continue;const x=90+i*(1868/(text.length-1)),y=92+12*Math.sin(i*.45);ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(i*7)*.08);ctx.strokeStyle=Theme.ink;ctx.lineWidth=7;ctx.fillStyle=['#FFE3A3','#77BCAE','#E99D67'][i%3];ctx.strokeText(text[i],0,0);ctx.fillText(text[i],0,0);ctx.restore()}map.needsUpdate=true};
      if(window.requestIdleCallback)requestIdleCallback(draw,{timeout:800});else setTimeout(draw,0);
    });
    const banner=this.banner=new THREE.Mesh(new THREE.PlaneGeometry(19.8,.92),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false}));
    banner.position.set(0,9.43,-14.5);banner.name='Para sa G ang temang to';this.s.scene.add(banner);
  }
  buildScraps() {
    const makeTexture=type=>this.s.roomTexture(512,256,ctx=>{
      ctx.canvas.textContent=type==='chocolate'?'Goodbye Chocolate':'Cornymo';ctx.lineJoin='round';ctx.strokeStyle=Theme.ink;ctx.lineWidth=8;
      if(type==='chocolate'){
        ctx.beginPath();ctx.moveTo(8,20);for(let i=0;i<12;i++)ctx.lineTo(i%2?22:8,20+i*19);ctx.lineTo(490,236);for(let i=0;i<12;i++)ctx.lineTo(i%2?490:505,236-i*19);ctx.closePath();ctx.fillStyle='#F6D75E';ctx.fill();ctx.stroke();ctx.fillStyle='#855032';ctx.fillRect(340,23,146,211);
        ctx.fillStyle='#26386C';ctx.font='bold 68px "Lilita One",sans-serif';ctx.textAlign='center';ctx.fillText('GOODBYE!',180,112,295);ctx.font='40px "Patrick Hand",cursive';ctx.fillText('CHOCOLATE',180,180,290);
        ctx.strokeStyle='#B49440';ctx.lineWidth=3;for(let x=30;x<60;x+=7){ctx.beginPath();ctx.moveTo(x,28);ctx.lineTo(x,226);ctx.stroke()}
      } else {
        ctx.fillStyle='#A9573B';ctx.fillRect(0,0,512,256);ctx.fillStyle='#FFF1C2';ctx.beginPath();ctx.ellipse(256,128,231,105,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#4D3529';ctx.textAlign='center';ctx.font='bold 70px "Lilita One",sans-serif';ctx.fillText('CORNYMO',256,135,430);ctx.font='30px "Patrick Hand",cursive';ctx.fillText('a little corny, a little sweet',256,183,420);
      }
    });
    const chocolateMap=makeTexture('chocolate'),coneMap=makeTexture('cornymo');
    const geometry=new THREE.PlaneGeometry(1,.5),lidGeometry=new THREE.CircleGeometry(.38,24),materials={chocolate:new THREE.MeshBasicMaterial({map:chocolateMap,alphaTest:.5,side:THREE.DoubleSide}),cornymo:new THREE.MeshBasicMaterial({map:coneMap,side:THREE.DoubleSide})};
    const placements=[['chocolate',-1.15,2.5],['cornymo',1.3,3.4],['chocolate',1,-1.8],['cornymo',-1.2,-3.7],['chocolate',-1.5,5],['cornymo',1.25,-6.3]];
    placements.forEach(([type,x,z],index)=>{
      const mesh=new THREE.Mesh(type==='cornymo'?lidGeometry:geometry,materials[type]);mesh.position.set(x,-2.79,z);mesh.rotation.set(-Math.PI/2,0,(index*.83)%1-.5);mesh.name=type+'-scrap-'+index;this.s.roomGroup.add(mesh);
      const hit=new THREE.Mesh(this.s.studentGeometry.box,this.s.studentHitMaterial);hit.position.set(x,-2.72,z);hit.scale.set(1.2,.35,.9);hit.layers.set(1);
      const scrap={type,index,mesh,hit,collected:false};hit.userData={type:'floor-scrap',scrap};this.s.roomGroup.add(hit);this.s.interactiveObjects.push(hit);this.scraps.push(scrap);
    });
  }
  registerDoor() {
    const hit=new THREE.Mesh(this.s.studentGeometry.box,this.s.studentHitMaterial);hit.position.set(0,1.38,8.58);hit.scale.set(3.55,8.36,.4);hit.layers.set(1);hit.userData.type='exit-door';this.s.roomGroup.add(hit);this.s.interactiveObjects.push(hit);
  }
  handleClick(object) {
    const type=object.userData.type;
    if(this.concertActive&&type!=='teacher')return true;
    if(this.cleaning||this.throwingNote)return true;
    if(type==='classroom-tv'){if(this.s.view==='seat')this.zoomTV();return true}
    if(type==='basketball'){if(this.s.view==='seat')this.showRin();return true}
    if(type==='labibi'){this.zoomLabibi();return true}
    if(type==='floor-scrap'){this.openScrap(object.userData.scrap);return true}
    if(type==='exit-door'){this.showKim();return true}
    return false;
  }
  paintBubble(name,line,hint='') {
    const strong=document.createElement('strong');strong.className='speaker-name';strong.textContent=name;
    const body=document.createElement('span');body.className='speaker-line';body.textContent=line;
    this.s.teacherBubble.replaceChildren(strong,body);
    if(hint){const prompt=document.createElement('span');prompt.className='speaker-hint';prompt.textContent=hint;this.s.teacherBubble.append(prompt)}
    this.s.teacherBubble.style.whiteSpace='pre-line';return body;
  }
  speak(name,line,anchor) {
    const node=this.paintBubble(name,line);this.speaker={name,node,anchor};this.s.bubbleStudentId=null;this.s.bubbleAnchor=anchor;this.s.speechUntil=Infinity;this.s.hideTooltip();return node;
  }
  clearSpeaker() {this.speaker=null;this.s.hideSean()}
  buildActor(kind) {
    if(this.actors[kind])return this.actors[kind];
    const group=new THREE.Group(),head=new THREE.Group(),arms=[],legs=[];this.s.roomGroup.add(group);group.position.y=-2.84;group.visible=false;
    const outfit={jeo:'#FFF8E7',rin:'#3975D2',tubo:'#D8402F'}[kind]||'#E4A64C',skin='#D9A278',hair='#231C1A';
    this.mesh(group,'box',outfit,0,2.15,0,1.05,1.4,.62);
    for(const side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.27,1.5,0);group.add(leg);this.mesh(leg,'box','#35465C',0,-.65,0,.41,1.35,.43);this.mesh(leg,'box',Theme.ink,0,-1.35,.14,.5,.28,.7);legs.push(leg);
      const arm=new THREE.Group();arm.position.set(side*.65,2.7,0);group.add(arm);this.mesh(arm,'box',outfit,0,-.48,0,.32,1,.38);this.mesh(arm,'sphere',skin,0,-1.03,0,.19,.22,.2);arms.push(arm);
    }
    head.position.set(0,3.45,.03);group.add(head);this.mesh(head,'sphere',skin,0,0,0,.56,.66,.48);
    this.batch(head,'sphere',Theme.ink,[[-.21,.07,.46,.049,.056,.026],[.21,.07,.46,.049,.056,.026],[0,-.24,.46,.12,.025,.026]]);
    if (kind !== 'tubo') {
      this.mesh(head,'sphere',hair,0,.43,-.05,.59,.3,.49);
      this.mesh(head,'box',hair,0,-.18,-.34,.95,kind==='jeo'?1.4:.95,.37);
    }
    if(kind==='jeo'){
      this.mesh(head,'box','#111111',0,.28,.41,1.1,.18,.09);
      const knot=this.mesh(head,'box','#111111',.42,.12,-.47,.14,.65,.09);knot.rotation.z=-.4;
      this.mesh(head,'box','#111111',.59,.13,-.44,.12,.58,.08).rotation.z=.2;
    }
    const anchor=new THREE.Object3D();anchor.position.set(0,.9,0);head.add(anchor);
    const actor={group,head,arms,legs,anchor};this.actors[kind]=actor;return actor;
  }
  showKim() {
    if(this.s.view!=='seat')return;this.stopRin();this.stopKim();this.stopTrack();
    const actor=this.buildActor('kim');
    actor.group.visible=true;actor.group.position.set(0,-2.84,7.35);actor.group.rotation.y=Math.PI;
    this.kimActive=true;this.playCue('kim',36,40);this.speak('Kim Chiu','Sa classroom may batas, bawal lumabas',actor.anchor);
    this.kimTween=gsap.timeline().fromTo(actor.group.scale,{x:.05,y:.05,z:.05},{x:1,y:1,z:1,duration:this.reduced.matches?0:.5,ease:'back.out(1.3)'})
      .call(()=>this.stopKim(),null,5);
  }
  stopKim() {this.kimTween?.kill();if(this.actors.kim)this.actors.kim.group.visible=false;if(this.kimActive){this.stopCue();this.clearSpeaker()}this.kimActive=false}
  openScrap(scrap) {
    if(scrap.collected||this.s.view!=='seat')return;this.stopKim();this.stopRin();this.phone.close(true);
    if(!this.scrapDialog){
      const root=this.scrapDialog=document.createElement('div');root.id='scrap-overlay';root.className='scrap-overlay';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Wrapper pickup line');
      const card=document.createElement('section');card.className='scrap-card';this.scrapTitle=document.createElement('h2');this.scrapText=document.createElement('p');
      const actions=document.createElement('div');actions.className='scrap-actions';this.throwButton=document.createElement('button');this.throwButton.type='button';this.throwButton.textContent='Throw';this.throwButton.onclick=()=>{const target=this.currentScrap;this.closeScrap();this.tossScrap(target)};
      const close=document.createElement('button');close.type='button';close.textContent='Close';close.setAttribute('aria-label','Close wrapper');close.onclick=()=>this.closeScrap();actions.append(this.throwButton,close);card.append(this.scrapTitle,this.scrapText,actions);root.append(card);document.body.append(root);
      root.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();(document.activeElement===this.throwButton?close:this.throwButton).focus()}});
      root.onclick=event=>{event.stopPropagation();if(event.target===root)this.closeScrap()};for(const event of ['pointerdown','pointermove','pointerup','wheel'])root.addEventListener(event,e=>e.stopPropagation());
    }
    const choices=scrap.type==='chocolate'?['Pwede ka ba makasama sa gym? Para maging fit tayo together\n\n#GoodbyeChocolate','Walang sinabi ang dictionary. Ikaw lang kasi nagbibigay ng meaning sa buhay ko.\n\n#GoodbyeChocolate']:
      ['Traffic ka ba? Di kasi ako makagalaw pag nandyan ka.','Geometry ka ba, ganda mo kasi sa lahat ng angles.'];
    const count=scrap.reads||0;scrap.reads=count+1;this.currentScrap=scrap;
    this.scrapTitle.textContent=scrap.type==='chocolate'?'Goodbye Chocolate':'Cornymo';this.scrapText.textContent=choices[count%choices.length];
    this.scrapDialog.hidden=false;this.scrapDialog.classList.add('active');this.scrapOpen=true;this.scrapWasInput=this.s.rig.inputEnabled;this.s.rig.setInputEnabled(false);this.s.resetHoverState();this.s.hideSean();this.throwButton.focus();
  }
  closeScrap() {
    if(!this.scrapOpen)return;this.scrapOpen=false;this.scrapDialog.hidden=true;this.scrapDialog.classList.remove('active');this.s.rig.setInputEnabled(this.scrapWasInput);
  }
  throwNote(note) {
    if (!note||this.cleaning||this.throwingNote) return;
    const s=this.s;
    const position=note.getWorldPosition(new THREE.Vector3());
    const rotation=note.getWorldQuaternion(new THREE.Quaternion());
    s.closeNoteViewerModal({throwing:true});
    gsap.killTweensOf(note.position);
    const hit=note.children.find(child=>child.userData.type==='sticky-note');
    const index=s.interactiveObjects.indexOf(hit);
    if (index>=0) s.interactiveObjects.splice(index,1);
    s.roomGroup.add(note);
    note.position.copy(position);note.quaternion.copy(rotation);
    const scrap={mesh:note,hit};
    this.throwingNote=true;
    const targetZ=-7.4;
    const apexY=Math.max(1,position.y+1.5);
    const toss=gsap.timeline().to(note.position,{x:1.05,y:apexY,z:(position.z+targetZ)*.5,duration:.34,ease:'power2.out'})
      .to(note.position,{y:-2.78,z:targetZ,duration:.45,ease:'power2.in'})
      .to(note.rotation,{x:Math.PI*1.5,z:.25,duration:.79},0)
      .call(()=>{this.throwingNote=false;this.cleanScrap(scrap)});
    if (this.reduced.matches) toss.progress(1);
  }

  tossScrap(scrap) {
    if (!scrap||scrap.collected||this.cleaning||this.throwingNote) return;
    this.throwingNote=true;
    const mesh=scrap.mesh;
    const z=THREE.MathUtils.clamp(mesh.position.z-1.5,-9,6);
    const toss=gsap.timeline().to(mesh.position,{y:-.9,duration:.28,ease:'power2.out'})
      .to(mesh.position,{y:-2.79,z,duration:.32,ease:'power2.in'})
      .call(()=>{this.throwingNote=false;this.cleanScrap(scrap)});
    if (this.reduced.matches) toss.progress(1);
  }

  collectScrap(scrap) {
    if (scrap.collected) return;
    scrap.collected=true;
    scrap.mesh.parent?.remove(scrap.mesh);
    const index=this.s.interactiveObjects.indexOf(scrap.hit);
    if(index>=0)this.s.interactiveObjects.splice(index,1);
    scrap.hit?.parent?.remove(scrap.hit);
  }

  finishCleanup() {
    if (!this.cleaning) return;
    this.cleanTween?.kill();
    this.collectScrap(this.cleanTarget);this.cleanTarget=null;
    const actor=this.actors.jeo;
    actor.group.visible=false;
    actor.legs.forEach(leg=>leg.rotation.x=0);
    this.cleaning=false;this.stopCue();this.clearSpeaker();this.releaseFocus();
  }

  cleanScrap(scrap) {
    if(!scrap||scrap.collected||this.cleaning)return;this.stopKim();this.stopRin();this.stopTrack();this.stopTV();const actor=this.buildActor('jeo');
    if(!actor.broom){const broom=actor.broom=new THREE.Group();broom.position.set(.87,1.05,.3);actor.group.add(broom);this.mesh(broom,'box','#93623E',0,0,0,.075,1.85,.075);this.mesh(broom,'box','#DDB653',0,-.94,0,.65,.28,.24);}
    this.lockFocus('jeo');
    const hearts=this.hearts=document.createElement('div');
    hearts.className='jeo-hearts';hearts.setAttribute('aria-hidden','true');
    for (let i=0;i<8;i++) {
      const heart=document.createElement('span');heart.textContent='♥';heart.style.setProperty('--heart',i);
      hearts.append(heart);
    }
    document.body.append(hearts);
    this.cleaning=true;this.cleanTarget=scrap;this.jeoStarted=performance.now()/1000;
    this.playCue('jeo',8);
    actor.group.visible=true;actor.group.position.set(0,-2.84,8.1);actor.group.rotation.y=Math.PI;
    const x=scrap.mesh.position.x-Math.sign(scrap.mesh.position.x)*.8,z=scrap.mesh.position.z+.5;
    this.speak('Jeo “Linis King” Ong','',actor.anchor);
    this.cleanTween=gsap.timeline().to(actor.group.position,{x,z,duration:this.reduced.matches ? .3 : 2,ease:'power1.inOut'})
      .to(actor.group.rotation,{y:Math.atan2(scrap.mesh.position.x-x,scrap.mesh.position.z-z),duration:.25})
      .to(actor.broom.rotation,{z:.3,duration:.2,repeat:5,yoyo:true,ease:'sine.inOut'})
      .call(()=>this.collectScrap(scrap))
      .to(actor.group.rotation,{y:0,duration:.25}).to(actor.group.position,{x:0,z:8.1,duration:this.reduced.matches ? .3 : 2,ease:'power1.inOut'})
      .call(()=>this.finishCleanup());
    this.cleanTween.timeScale(this.reduced.matches?1:.65);
  }
  buildBasketball() {
    const ball=new THREE.Group();ball.position.set(9.5,-2.28,7.3);this.s.roomGroup.add(ball);
    const skin=this.mesh(ball,'sphere','#D87932',0,0,0,.56,.56,.56);
    for (const rotation of [[0,0,0],[Math.PI/2,0,0],[0,Math.PI/2,0]]) {
      const seam=new THREE.Mesh(new THREE.TorusGeometry(.553,.016,5,24),this.paint(Theme.ink));
      seam.rotation.set(...rotation);ball.add(seam);
    }
    skin.userData.type='basketball';this.s.interactiveObjects.push(skin);
  }

  showRin() {
    this.stopKim();this.stopRin();
    const actor=this.buildActor('rin');
    const {group}=actor;
    const door=this.s.exitDoorLeaf;
    group.visible=true;group.position.set(8.7,-1.76,7.0);
    group.rotation.set(Math.PI/2,-Math.PI/2,0,'YXZ');
    this.playCue('rin',5);
    this.speak('Rin','MAMAAAAAAAAAAA',actor.anchor);
    const reduced=this.reduced.matches;
    this.rinTween=gsap.timeline()
      .to(group.position,{x:4.65,z:6.8,duration:reduced?.32:1.3,ease:'power1.out'})
      .to(group.position,{x:0,z:7.25,duration:reduced?.32:1.45,ease:'none'})
      .to(group.rotation,{y:0,duration:reduced?.15:.45},'-=.40')
      .to(door.rotation,{y:-Math.PI/2,duration:reduced?.15:.48},'<')
      .to(group.position,{z:12.4,duration:reduced?.4:1.7,ease:'power1.in'})
      .call(()=>{group.visible=false})
      .to(door.rotation,{y:0,duration:reduced?.15:.5})
      .call(()=>this.stopRin());
  }

  stopRin() {
    if (!this.rinTween) return;
    this.rinTween.kill();this.rinTween=null;
    this.actors.rin.group.visible=false;
    this.s.exitDoorLeaf.rotation.y=0;
    if (this.speaker?.name==='Rin') {this.stopCue();this.clearSpeaker();}
  }

  async playTrack(track,onStop) {
    if (!track.audioAvailable) return false;
    this.stopTrack();this.stopTV();this.stopConcert();this.book.music.stop(true);
    const audio=this.trackAudio=new Audio(track.audio);
    this.track=track;this.trackStopped=onStop;
    audio.muted=window.AudioMaster?.muted??false;
    audio.onended=()=>this.stopTrack();
    audio.onerror=()=>{if(this.trackAudio===audio)this.stopTrack()};
    try {
      audio.currentTime=SPOTIBAI_START_SECONDS[track.id] ?? 0;
      await audio.play();
      if (this.trackAudio!==audio) return false;
      if (track.id==='tma') {
        if (this.s.view==='desk') this.s.backToSeat();
        this.startTubo();
      }
      return true;
    } catch {
      if (this.trackAudio===audio) this.stopTrack();
      return false;
    }
  }

  stopTrack() {
    this.trackAudio?.pause();this.trackAudio=null;this.track=null;
    this.trackStopped?.();this.trackStopped=null;
    if (this.tubo) {
      this.tubo.group.visible=false;
      this.tubo=null;
      this.tuboSeat.person.visible=true;
      if (!this.s.interactiveObjects.includes(this.tuboSeat.hitbox)) this.s.interactiveObjects.push(this.tuboSeat.hitbox);
    }
  }

  startTubo() {
    const seat=this.s.students?.find(({student})=>student.name==='Dinorobong Tubo');
    if (!seat) return;
    this.tuboSeat=seat;seat.person.visible=false;
    const index=this.s.interactiveObjects.indexOf(seat.hitbox);
    if (index>=0) this.s.interactiveObjects.splice(index,1);
    const actor=this.tubo=this.buildActor('tubo');
    actor.group.visible=true;actor.group.position.set(0,-2.84,-4);
  }

  updateTubo() {
    const t=this.trackAudio.currentTime, motion=this.reduced.matches?0:1;
    const actor=this.tubo, p=t*6;
    actor.group.position.set(motion*.65*Math.sin(t*2),-2.84+motion*.19*Math.abs(Math.sin(p)),-4+motion*.8*Math.cos(t*1.4));
    actor.group.rotation.y=motion*.4*Math.sin(t*2.2);
    actor.head.rotation.z=motion*.14*Math.sin(p);
    actor.arms.forEach((arm,i)=>{arm.rotation.x=-.65+motion*.75*Math.sin(p+i*Math.PI);arm.rotation.z=(i?1:-1)*.54});
    actor.legs.forEach((leg,i)=>{leg.rotation.x=motion*.32*Math.sin(p+i*Math.PI)});
  }

  lockFocus(type) {
    const s=this.s;
    if (!s.camera || this.cameraFocus || s.isCameraZoomed || s.view==='gliding') return false;
    this.cameraFocus={type,pose:s.rig.capturePose(),input:s.rig.inputEnabled};
    s.isCameraZoomed=true;s.rig.setInputEnabled(false);s.pendingHover=null;s.resetHoverState();s.hideSean();
    s.isDraggingView=false;s.hasDraggedMeaningfully=false;
    return true;
  }

  releaseFocus() {
    if (!this.cameraFocus) return;
    const s=this.s,{pose,input}=this.cameraFocus;
    this.cameraFocus=null;this.focusBack?.remove();this.focusBack=null;
    this.hearts?.remove();this.hearts=null;s.isCameraZoomed=false;
    s.rig.applyPose(pose);
    if (this.dark) this.darkHome.input=input;
    s.rig.setInputEnabled(!this.dark&&input&&s.inputEnabled);
  }

  focusButton(label) {
    const button=this.focusBack=document.createElement('button');
    button.type='button';button.className='experience-focus-back';button.textContent=label;
    button.addEventListener('click', event => {
      event.stopPropagation();
      this.releaseFocus();
    });
    document.body.append(button);button.focus({preventScroll:true});
  }

  zoomTV() {
    if (!this.s.tvScreen || !this.lockFocus('tv')) return;
    this.focusButton('Back from TV');
    this.updateFocus(performance.now()/1000);
  }

  playTV(track) {
    if (!track.videoAvailable||!this.s.tvScreen) return;
    this.stopTrack();this.stopConcert();this.stopKim();this.stopTV();
    const video=this.tvVideo=document.createElement('video');
    video.playsInline=true;video.preload='metadata';video.muted=true;video.defaultMuted=true;
    video.src=track.video;
    this.tvPlaying=true;this.zoomTV();
    const texture=this.tvVideoTexture=new THREE.VideoTexture(video);
    texture.encoding=THREE.sRGBEncoding;
    this.s.tvScreen.material.map=texture;this.s.tvScreen.material.needsUpdate=true;

    const stop=this.tvStopButton=document.createElement('button');
    stop.type='button';stop.className='experience-focus-back tv-stop-button';stop.textContent='Stop video';
    stop.addEventListener('click',()=>{this.stopTV();this.focusBack?.focus({preventScroll:true});});
    document.body.append(stop);

    video.onended=video.onerror=()=>{if(this.tvVideo===video)this.stopTV();};
    const startTime=SPOTIBAI_START_SECONDS[track.id] ?? 0;
    video.currentTime=startTime;
    const playback=[video.play()];
    if (track.audioAvailable) {
      const audio=this.tvAudio=new Audio(track.audio);
      audio.currentTime=startTime;
      audio.muted=window.AudioMaster?.muted??false;
      audio.ontimeupdate=()=>{
        if (video.readyState>=2 && !video.seeking && Math.abs(video.currentTime-audio.currentTime)>.4) {
          video.currentTime=Math.min(audio.currentTime,video.duration);
        }
      };
      playback.push(audio.play());
    }
    Promise.all(playback).catch(()=>{
      if(this.tvVideo!==video)return;
      this.stopTV();window.PortfolioHumor?.showToast('TV playback could not start.');
    });
  }

  stopTV() {
    if (!this.tvVideo) return;
    const video=this.tvVideo;
    this.tvVideo=null;this.tvAudio?.pause();this.tvAudio=null;
    video.pause();video.removeAttribute('src');video.load();
    this.tvStopButton?.remove();this.tvStopButton=null;
    this.tvVideoTexture?.dispose();this.tvVideoTexture=null;this.tvPlaying=false;
    this.s.tvScreen.material.map=this.s.tvTexture;this.s.tvScreen.material.needsUpdate=true;
    this.s.tvDVD.dirty=true;
  }

  placeLabibi(roll) {
    if (!this.labibi) {
      const doll=this.labibi=new THREE.Group();
      this.s.deskGroup.add(doll);
      doll.position.set(-4.82,.44,1.67);doll.rotation.y=Math.PI;
      const body=this.mesh(doll,'sphere',roll.fur,0,.14,0,.27,.34,.21);
      const head=this.mesh(doll,'sphere',roll.fur,0,.53,0,.33,.33,.24);
      this.dollFur=[body,head];
      this.dollTrim=[];
      for (const side of [-1,1]) {
        const ear=this.mesh(doll,'sphere',roll.fur,side*.16,.87,0,.091,.26,.07);
        ear.rotation.z=-side*.24;
        const innerEar=this.mesh(doll,'sphere',roll.trim,side*.164,.89,.052,.045,.17,.023,false);
        innerEar.rotation.z=ear.rotation.z;
        this.dollTrim.push(innerEar);
        this.dollFur.push(ear,
          this.mesh(doll,'sphere',roll.fur,side*.24,.19,0,.12,.12,.14),
          this.mesh(doll,'sphere',roll.fur,side*.14,-.12,.03,.14,.12,.15));
      }
      const face=this.dollFace=new THREE.Mesh(new THREE.CircleGeometry(.225,32),new THREE.MeshBasicMaterial());
      face.scale.y=.84;face.position.set(0,.54,.23);doll.add(face);
      for (const hit of [head,body,face]) {hit.userData.type='labibi';this.s.interactiveObjects.push(hit);}
    }
    if (this.labibi.name===roll.name) return;
    this.labibi.name=roll.name;
    this.dollFur.forEach(mesh=>mesh.material=this.paint(roll.fur));
    this.dollTrim.forEach(mesh=>mesh.material=this.paint(roll.trim));
    const [left,top,width,height]=roll.face;
    const photo=new THREE.TextureLoader().load('assets/photos/'+roll.photo);
    photo.encoding=THREE.sRGBEncoding;
    photo.repeat.set(width,height);
    photo.offset.set(left,1-top-height);
    const material=this.dollFace.material;
    material.map?.dispose();
    material.map=photo;
    material.needsUpdate=true;
  }

  zoomLabibi() {
    if (!this.labibi || !this.lockFocus('labibi')) return;
    this.focusButton('Back from Labibi');
    this.updateFocus(performance.now()/1000);
  }

  updateFocus(seconds) {
    if (!this.cameraFocus) return;
    const {type}=this.cameraFocus,{camera}=this.s;
    if (type==='tv') {
      this.s.tvScreen.getWorldPosition(this.point);
      const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
      const distance=Math.max(1.55,2.67/camera.aspect)/tan;
      camera.position.copy(this.point);camera.position.z+=distance;
    } else if (type==='labibi') {
      this.labibi.getWorldPosition(this.point);this.point.y+=.46;
      camera.position.copy(this.point).add(new THREE.Vector3(.32,.32,1.85));
    } else {
      const actor=this.actors.jeo;
      actor.head.getWorldPosition(this.point);
      const phase=this.reduced.matches?0:Math.floor((seconds-this.jeoStarted)/1.35)%3;
      const offsets=[[0,.32,3.6],[-1.55,.68,3.4],[1.35,.1,2.9]];
      const [x,y,z]=offsets[phase];
      const angle=actor.group.rotation.y;
      camera.position.set(this.point.x+x*Math.cos(angle)+z*Math.sin(angle),this.point.y+y,
        this.point.z+z*Math.cos(angle)-x*Math.sin(angle));
    }
    camera.lookAt(this.point);
  }

  playCue(id,start,end=Infinity) {
    this.stopCue();
    const source=this.s.classroom.audio?.[id+'Entry'];
    if (!source) return;
    const media=this.cueAudio=new Audio(source);
    media.muted=window.AudioMaster?.muted??false;
    media.addEventListener('loadedmetadata',()=>{
      if (this.cueAudio!==media) return;
      media.currentTime=start;
      if (Number.isFinite(end)) media.ontimeupdate=()=>{if(media.currentTime>=end)media.pause()};
    },{once:true});
    media.addEventListener('seeked',()=>{if(this.cueAudio===media)media.play().catch(()=>{})},{once:true});
  }

  stopCue() {
    this.cueAudio?.pause();this.cueAudio=null;
  }

  onCurtainOpened() {if(!this.titan)this.buildTitan();this.titan.visible=true}
  buildTitan() {
    const titan=this.titan=new THREE.Group();titan.name='cartoon-colossal-titan';titan.position.set(14.4,-7,.6);titan.rotation.y=-Math.PI/2;titan.scale.setScalar(3);this.s.scene.add(titan);
    const muscle='#AC4B3C',bone='#E6C4A2',dark='#49312F';
    this.batch(titan,'sphere',muscle,[[0,2.4,0,.95,1.12,.43],[-1.08,2.7,0,.3,.8,.3],[1.08,2.7,0,.3,.8,.3],[-1.15,1.6,.05,.23,.64,.24],[1.15,1.6,.05,.23,.64,.24],[-.45,.7,0,.35,.85,.32],[.45,.7,0,.35,.85,.32]]);
    this.batch(titan,'sphere',bone,[[0,4.05,0,.63,.8,.54],[0,3.3,0,.28,.45,.28]]);
    this.batch(titan,'sphere',muscle,[[-.43,4.02,.35,.22,.52,.18],[.43,4.02,.35,.22,.52,.18],[-.4,2.95,.38,.48,.35,.21],[.4,2.95,.38,.48,.35,.21],[-.32,2.4,.43,.29,.2,.16],[.32,2.4,.43,.29,.2,.16],[-.28,1.98,.42,.25,.2,.16],[.28,1.98,.42,.25,.2,.16]]);
    this.batch(titan,'box',bone,[[-1.08,2.45,.3,.08,1.2,.04],[1.08,2.45,.3,.08,1.2,.04],[0,2.45,.48,.1,1.15,.05],[0,3.7,.52,.85,.21,.05]]);
    this.batch(titan,'sphere',dark,[[-.25,4.24,.48,.15,.1,.06],[.25,4.24,.48,.15,.1,.06]]);
    this.batch(titan,'box',dark,[[-.28,3.7,.56,.025,.16,.025],[-.1,3.7,.56,.025,.16,.025],[.1,3.7,.56,.025,.16,.025],[.28,3.7,.56,.025,.16,.025]]);
  }
  showStadium() {
    const s=this.s;
    if (!this.stadium) {
      const stadium=this.stadium=new THREE.Group();
      s.scene.add(stadium);
      this.mesh(stadium,'box','#292441',0,-.54,-4,32,.85,30,false);
      this.mesh(stadium,'box','#8755A0',0,-.17,-13.6,10,.34,4,false);
      for (const side of [-1,1]) {
        for (let row=0;row<3;row++) {
          this.mesh(stadium,'box',row%2?'#524475':'#403758',side*(7.7+row*2),-.3+row*.85,-4,2.4,.62,17,false);
        }
        this.mesh(stadium,'box','#B86191',side*5.3,0,-13.3,.16,.24,4,false);
      }
      const light=new THREE.MeshBasicMaterial({color:'#FFEAB1'});
      this.crowd=[];
      const fans=[...s.students.map(entry=>entry.student.look),...s.extras.map(entry=>entry.look)];
      fans.forEach((look,i)=>{
        const side=i%2?1:-1,row=Math.floor(i/6),seat=Math.floor(i/2)%3;
        const person=s.buildStudent(look);
        const height=row*.85;
        person.position.set(side*(7.6+row*2),height,-9.2+seat*4.6);
        person.rotation.y=side*.95;
        const {arms}=person.userData.parts;
        arms.forEach(arm=>arm.rotation.x=-1.2);
        if (i%3===0) {
          const phone=new THREE.Mesh(s.studentGeometry.box,light);
          phone.scale.set(.13,.22,.05);phone.position.set(.04,.12,-.79);arms[1].add(phone);
        }
        stadium.add(person);this.crowd.push({person,arms,height});
      });
      this.mesh(stadium,'box','#795C93',0,1,-17.1,29,3,.4,false);
      for (let x=-12;x<=12;x+=2) {
        const bulb=new THREE.Mesh(s.studentGeometry.sphere,light);
        bulb.position.set(x,4,-16.85);bulb.scale.set(.23,.23,.18);stadium.add(bulb);
      }
    }
    this.stadium.visible=true;
    this.stadium.add(s.teacher);
    this.concertHidden=[s.roomGroup,s.deskGroup,this.banner,s.windowSky,s.windowHorizon,s.windowGlow,this.titan]
      .filter(object=>object?.visible);
    this.concertHidden.forEach(object=>object.visible=false);
    const lines=['Sir sean!! Ang pogi mo','Go dyogi~~~','WHOOO SEANTI ON THE HOUSE','ANGAS MENNN'];
    this.cheers=lines.map((line,index)=>{
      const box=document.createElement('p');
      box.className='stadium-cheer';box.textContent=line;box.hidden=true;
      document.body.append(box);
      const head=this.crowd[[2,5,4,3][index]].person.userData.parts.head;
      const anchor=new THREE.Object3D();anchor.position.y=.85;head.add(anchor);
      return {box,anchor};
    });
  }

  hideStadium() {
    const s=this.s;
    s.roomGroup.add(s.teacher);
    this.concertHidden.forEach(object=>object.visible=true);
    this.stadium.visible=false;
    this.cheers.forEach(({box,anchor})=>{box.remove();anchor.parent.remove(anchor);});this.cheers=null;
  }

  updateCrowd(t,motion) {
    this.crowd.forEach(({person,arms,height},i)=>{
      const bounce=Math.sin(t*8+i*.66);
      person.position.y=height+motion*.58*Math.max(0,bounce);
      arms.forEach(arm=>arm.rotation.x=-1.25+.19*motion*bounce);
    });
    const {camera}=this.s;
    camera.updateMatrixWorld(true);
    this.cheers.forEach(({box,anchor},index)=>{
      anchor.getWorldPosition(this.point).project(camera);
      const {x,y,z}=this.point;
      const show=z>-1&&z<1&&Math.abs(x)<1.2&&Math.abs(y)<1&&Math.floor(t/2+index)%4!==1;
      box.hidden=!show;
      if (show) {
        box.style.left=THREE.MathUtils.clamp((x+1)*50,12,88)+'%';
        box.style.top=THREE.MathUtils.clamp((1-y)*50,14,85)+'%';
      }
    });
  }

  prepareMedia() {
    if(this.audio)return;
    const audio=this.audio=new Audio('/assets/audio/nadarang.mp3');audio.preload='metadata';audio.volume=.5;audio.muted=window.AudioMaster?.muted??false;
    audio.onloadedmetadata=()=>{if(this.concertActive)audio.currentTime=this.concertStart};audio.onended=()=>this.stopConcert();audio.onerror=()=>this.stopConcert();
    fetch('/assets/audio/nadarang.lrc').then(r=>r.ok?r.text():'').then(text=>{
      const offset=Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1]||0)/1000,rows=[];
      for(const line of text.split(/\r?\n/)){const times=[...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];if(!times.length)continue;const words=line.replace(/\[[^\]]*\]/g,'').trim();for(const time of times)rows.push({time:Number(time[1])*60+Number(time[2])-offset,text:words})}
      rows.sort((a,b)=>a.time-b.time);this.lyrics=rows;this.cueIndex=-1;
    }).catch(()=>{this.lyrics=[]});
  }
  prepareStage() {
    if(this.stage)return;
    this.stage=new THREE.Group();this.stage.visible=false;this.s.scene.add(this.stage);
    const map=this.s.roomTexture(128,128,ctx=>{const gradient=ctx.createRadialGradient(64,64,1,64,64,63);gradient.addColorStop(0,'rgba(224,213,209,.6)');gradient.addColorStop(.55,'rgba(204,192,195,.25)');gradient.addColorStop(1,'rgba(204,192,195,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128)});
    const geometry=new THREE.PlaneGeometry(1,1),material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,opacity:.5,fog:false});this.smoke=[];
    for(let i=0;i<6;i++){const mesh=new THREE.Mesh(geometry,material);mesh.scale.set(6,3,1);this.stage.add(mesh);this.smoke.push(mesh)}
    const spot=this.spot=new THREE.SpotLight('#FFF1D5',3,30,.5,.45,1);spot.shadow.mapSize.set(512,512);spot.shadow.bias=-.00012;spot.shadow.normalBias=.025;this.s.scene.add(spot,spot.target);spot.visible=false;
    const beam=this.beam=new THREE.Mesh(new THREE.ConeGeometry(2.7,9,20,1,true),new THREE.MeshBasicMaterial({color:'#FFF0D1',transparent:true,opacity:.08,depthWrite:false,side:THREE.DoubleSide,fog:false}));beam.position.set(0,4.8,-13.4);this.stage.add(beam);
  }
  startConcert() {
    if (this.concertActive) {this.stopConcert();return;}
    if (!this.s.inputEnabled||this.blocking||this.cleaning||this.s.view!=='seat') return;
    this.prepareMedia();
    if (this.reduced.matches) {this.beginConcert();return;}

    const fire=this.concertTransition=document.createElement('video');
    fire.className='concert-fire';fire.setAttribute('aria-hidden','true');
    fire.muted=true;fire.playsInline=true;fire.src='/assets/videos/fire-transition.mp4';
    document.body.append(fire);
    let started=false;
    const begin=()=>{
      if(this.concertTransition!==fire||started)return;
      started=true;this.beginConcert();
    };
    fire.ontimeupdate=()=>{if(fire.currentTime>=1.4)begin();};
    const finish=()=>{
      if (this.concertTransition!==fire) return;
      begin();this.clearConcertTransition();
    };
    fire.onended=fire.onerror=finish;
    fire.play().catch(finish);
  }

  clearConcertTransition() {
    const fire=this.concertTransition;
    if(!fire)return;
    this.concertTransition=null;
    fire.pause();fire.remove();
  }

  beginConcert() {
    this.s.pendingHover=null;this.s.resetHoverState();this.s.hideSean();
    this.stopKim();this.stopRin();this.stopTrack();this.stopTV();this.phone.close(true);this.book.music.stop(true);
    if(this.s.isFloating){this.s.stopAntiGravity();this.s.finishAntiGravityReset()}
    this.prepareMedia();this.prepareStage();this.concertActive=true;this.concertHome=new Map();
    this.s.teacher.traverse(o=>this.concertHome.set(o,{p:o.position.clone(),r:o.rotation.clone(),scale:o.scale.clone()}));
    this.lightHome=[];
    this.s.scene.traverse(o=>{if(o.isLight&&o!==this.spot){this.lightHome.push({light:o,intensity:o.intensity,shadow:o.castShadow});o.intensity*=.1;o.castShadow=false}});
    this.oldBackground=this.s.scene.background;this.oldFog=this.s.scene.fog;this.s.scene.background=new THREE.Color('#302537');this.s.scene.fog=new THREE.Fog('#655864',3,33);
    const children=this.s.teacher.children;this.thighs=[];this.seanArms=[];
    for(const child of children){if(!child.isMesh)continue;if(Math.abs(child.position.y-1.64)<.01){child.position.y=.34;child.position.z=.25;child.scale.z=.78}
      else if(Math.abs(child.position.y-3.12)<.01){child.position.y=2.65;child.position.z=0;child.rotation.x=0;this.thighs.push(child)}else if(Math.abs(child.position.y-2.34)<.01){child.position.y=1.2;child.position.z=0}}
    for(const child of this.s.teacherTorso.children)if(child.isGroup&&Math.abs(child.position.y-1.94)<.01)this.seanArms.push(child);
    this.s.teacher.position.set(0,.08,-13.6);this.showStadium();this.stage.visible=true;this.spot.visible=true;this.spot.castShadow=true;
    this.concertLine=this.speak('Sean-ti dope','Nadarang',this.s.speechAnchor);this.cueIndex=-1;
    if(this.audio.readyState)this.audio.currentTime=this.concertStart;else try{this.audio.currentTime=this.concertStart}catch{}
    this.audio.play().catch(()=>this.stopConcert());this.s.renderer.shadowMap.needsUpdate=true;
  }
  stopConcert() {
    this.clearConcertTransition();
    if(!this.concertActive)return;this.concertActive=false;this.audio?.pause();
    this.concertHome.forEach((home,o)=>{o.position.copy(home.p);o.rotation.copy(home.r);o.scale.copy(home.scale)});
    for(const home of this.lightHome){home.light.intensity=home.intensity;home.light.castShadow=home.shadow}
    this.s.scene.background=this.oldBackground;this.s.scene.fog=this.oldFog;this.stage.visible=false;this.spot.visible=false;this.spot.castShadow=false;
    this.hideStadium();this.clearSpeaker();this.s.renderer.shadowMap.needsUpdate=true;
  }
  enterDark() {
    if(!this.s.inputEnabled||this.s.view==='gliding'||this.dark)return;
    this.s.resetHoverState();this.s.pendingHover=null;
    this.darkHome={input:this.s.rig.inputEnabled,focus:document.activeElement};
    if(!this.blackout){
      this.blackout=document.createElement('div');this.blackout.id='classroom-blackout';this.blackout.tabIndex=-1;
      this.blackout.setAttribute('role','dialog');this.blackout.setAttribute('aria-modal','true');
      this.blackout.setAttribute('aria-label','Dark mode. Click anywhere or press Escape to return.');
      this.blackout.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();this.leaveDark()});
      for(const type of ['pointerdown','pointerup','pointermove','wheel'])this.blackout.addEventListener(type,event=>event.stopPropagation());
      document.body.append(this.blackout);
    }
    this.dark=true;document.documentElement.classList.add('classroom-blackout-mode');
    document.getElementById('darkModeBtn').setAttribute('aria-pressed','true');
    this.blackout.hidden=false;this.s.rig.setInputEnabled(false);this.blackout.focus();
  }
  leaveDark() {
    if(!this.dark)return;
    this.dark=false;document.documentElement.classList.remove('classroom-blackout-mode');
    document.getElementById('darkModeBtn').setAttribute('aria-pressed','false');this.blackout.hidden=true;
    this.s.rig.setInputEnabled(this.cameraFocus?false:this.darkHome.input);this.darkHome.focus?.focus({preventScroll:true});
  }
  update(seconds) {
    if(this.concertActive){
      const t=Math.max(0,this.audio.currentTime-this.concertStart),motion=this.reduced.matches?0:1,s=this.s;
      s.teacher.position.x=motion*3.15*Math.sin(t*.32);s.teacher.position.y=.08+motion*.06*Math.abs(Math.sin(t*3));s.teacher.rotation.y=motion*.12*Math.cos(t*.32);
      s.teacherTorso.rotation.z=motion*.055*Math.sin(t*3.5);s.teacherHead.rotation.z=motion*.06*Math.sin(t*2);
      for(let i=0;i<this.thighs.length;i++)this.thighs[i].rotation.x=motion*.22*Math.sin(t*3+i*Math.PI);
      for(let i=0;i<this.seanArms.length;i++)this.seanArms[i].rotation.x=-.55+motion*.18*Math.sin(t*3+i*Math.PI);
      this.updateCrowd(t,motion);
      this.spot.position.set(s.teacher.position.x,9.3,-12.6);this.spot.target.position.set(s.teacher.position.x,3.4,-13.6);this.beam.position.x=s.teacher.position.x;
      for(let i=0;i<this.smoke.length;i++){const mesh=this.smoke[i];mesh.position.set((i%3-1)*6+motion*Math.sin(t*.2+i),-.8+motion*.5*Math.sin(t*.15+i),-11+Math.floor(i/3)*7);mesh.quaternion.copy(s.camera.quaternion)}
      if(this.lyrics?.length){let index=this.cueIndex;while(index+1<this.lyrics.length&&this.lyrics[index+1].time<=this.audio.currentTime)index++;while(index>=0&&this.lyrics[index].time>this.audio.currentTime)index--;
        if(index!==this.cueIndex){this.cueIndex=index;this.concertLine.textContent=index>=0?this.lyrics[index].text:'Nadarang'}}
    }
    if(this.cleaning&&!this.reduced.matches){const actor=this.actors.jeo;actor.legs[0].rotation.x=.25*Math.sin(seconds*6);actor.legs[1].rotation.x=-actor.legs[0].rotation.x;}
    if (this.rinTween && !this.reduced.matches) {
      const actor=this.actors.rin,stroke=this.rinTween.time()*Math.PI*2.5;
      actor.arms.forEach((arm,i)=>{arm.rotation.x=stroke+i*Math.PI;arm.rotation.z=i?.25:-.25;});
      actor.legs.forEach((leg,i)=>{leg.rotation.x=.35*Math.sin(stroke*2+i*Math.PI);});
    }
    if (this.tubo) this.updateTubo();
    this.updateFocus(seconds);
    if(this.speaker&&!this.dark){this.s.bubbleAnchor=this.speaker.anchor;this.s.bubbleStudentId=null;this.s.speechUntil=Infinity;}
  }
}

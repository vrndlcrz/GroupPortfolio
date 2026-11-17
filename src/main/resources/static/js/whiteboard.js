/** Visitor-local paint layer. The board's original lettering is never painted or erased. */
class WhiteboardDrawing {
  constructor(scene) {
    this.scene=scene;scene.whiteboardController=this;
    this.root=document.getElementById('whiteboard-overlay');
    this.canvas=document.getElementById('whiteboard-canvas');
    this.context=this.canvas.getContext('2d');
    this.snapshot=document.createElement('canvas');this.snapshot.width=1600;this.snapshot.height=600;
    this.snapshotContext=this.snapshot.getContext('2d');
    this.texture=scene.attachWhiteboardDrawing(this.snapshot);
    this.key='gp.whiteboard.v1';this.color='#1B1B1B';this.tool='marker';this.opened=false;this.drawing=false;this.dirty=false;
    this.buttons=[...this.root.querySelectorAll('button')];
    this.swatches=[...this.root.querySelectorAll('[data-marker]')];
    this.eraser=document.getElementById('whiteboard-eraser');
    this.closeButton=document.getElementById('whiteboard-close');
    this.swatches.forEach(button=>button.addEventListener('click',()=>this.selectTool('marker',button.dataset.marker)));
    this.eraser.addEventListener('click',()=>this.selectTool('eraser'));
    document.getElementById('whiteboard-clear').addEventListener('click',()=>this.clear());
    this.closeButton.addEventListener('click',()=>this.close());
    this.root.addEventListener('click',event=>{if(event.target===this.root){event.stopPropagation();this.close();}});
    this.canvas.addEventListener('pointerdown',event=>this.startStroke(event));
    this.canvas.addEventListener('pointermove',event=>this.moveStroke(event));
    this.canvas.addEventListener('pointerup',event=>this.finishStroke(event));
    this.canvas.addEventListener('pointercancel',()=>this.finishStroke());
    this.canvas.addEventListener('lostpointercapture',()=>this.finishStroke());
    // Capture keyboard input before the scene's existing WASD, Escape, and Zero-G handlers.
    document.addEventListener('keydown',event=>{
      if(!this.opened)return;
      event.stopImmediatePropagation();
      if(event.key==='Escape'){event.preventDefault();this.close();return;}
      if(event.key==='Tab'){
        const first=this.buttons[0],last=this.buttons[this.buttons.length-1];
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    },true);
    document.addEventListener('keyup',event=>{if(this.opened)event.stopImmediatePropagation();},true);
    this.restoring=true;
    this.ready=this.restore().then(()=>{this.restoring=false;this.publish();});
  }

  selectTool(tool,color=this.color) {
    this.tool=tool;this.color=color;
    this.swatches.forEach(button=>{
      const selected=tool==='marker' && button.dataset.marker===color;
      button.classList.toggle('is-selected',selected);button.setAttribute('aria-pressed',String(selected));
    });
    this.eraser.classList.toggle('is-selected',tool==='eraser');
    this.eraser.setAttribute('aria-pressed',String(tool==='eraser'));
    this.canvas.classList.toggle('is-erasing',tool==='eraser');
  }

  open() {
    if(this.opened || this.scene.view!=='seat' || this.scene.interactionBlocked())return false;
    if(this.restoring){this.ready.then(()=>this.open());return false;}
    this.previousFocus=document.activeElement;
    this.previousInput=this.scene.inputEnabled;this.previousRigInput=this.scene.rig.inputEnabled;
    // CSS provides a preview of the existing names; they never enter the paint canvas or saved PNG.
    try{this.canvas.style.backgroundImage='url("'+this.scene.whiteboardBaseCanvas.toDataURL('image/png')+'")';}catch{}
    this.scene.setInputEnabled(false);
    this.root.hidden=false;this.root.classList.add('active');this.opened=true;
    this.closeButton.focus({preventScroll:true});return true;
  }

  close() {
    if(!this.opened)return;
    this.finishStroke();clearTimeout(this.saveTimer);if(this.dirty)this.save();
    this.publish();this.opened=false;this.root.classList.remove('active');this.root.hidden=true;
    this.scene.setInputEnabled(this.previousInput);
    this.scene.rig.setInputEnabled(this.previousRigInput && this.previousInput && this.scene.view==='seat');
    if(this.previousFocus?.isConnected)this.previousFocus.focus({preventScroll:true});
  }

  point(event) {
    const rect=this.canvas.getBoundingClientRect();
    const border=this.canvas.clientLeft;
    return {x:(event.clientX-rect.left-border)/(rect.width-border*2)*this.canvas.width,y:(event.clientY-rect.top-border)/(rect.height-border*2)*this.canvas.height};
  }

  startStroke(event) {
    if(!this.opened || this.drawing || event.button!==0)return;
    event.preventDefault();clearTimeout(this.saveTimer);
    const p=this.point(event),ctx=this.context;
    this.drawing=true;this.pointer=event.pointerId;this.dirty=true;
    this.lastX=this.midX=p.x;this.lastY=this.midY=p.y;
    ctx.globalCompositeOperation=this.tool==='eraser'?'destination-out':'source-over';
    ctx.strokeStyle=this.color;ctx.lineWidth=this.tool==='eraser'?28:4;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.01,p.y);ctx.stroke();
    this.canvas.setPointerCapture(event.pointerId);
  }

  moveStroke(event) {
    if(!this.drawing || event.pointerId!==this.pointer)return;
    event.preventDefault();const p=this.point(event),ctx=this.context;
    const midX=(this.lastX+p.x)/2,midY=(this.lastY+p.y)/2;
    ctx.beginPath();ctx.moveTo(this.midX,this.midY);ctx.quadraticCurveTo(this.lastX,this.lastY,midX,midY);ctx.stroke();
    this.midX=midX;this.midY=midY;this.lastX=p.x;this.lastY=p.y;
  }

  finishStroke(event) {
    if(!this.drawing || (event && event.pointerId!==this.pointer))return;
    const p=event?this.point(event):{x:this.lastX,y:this.lastY},ctx=this.context;
    ctx.beginPath();ctx.moveTo(this.midX,this.midY);ctx.quadraticCurveTo(this.lastX,this.lastY,p.x,p.y);ctx.stroke();
    this.drawing=false;
    if(this.canvas.hasPointerCapture(this.pointer))this.canvas.releasePointerCapture(this.pointer);
    clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>this.save(),300);
  }

  save() {
    if(!this.dirty)return;
    try{localStorage.setItem(this.key,this.canvas.toDataURL('image/png'));}catch{}
    this.dirty=false;
  }

  clear() {
    this.finishStroke();clearTimeout(this.saveTimer);
    this.context.clearRect(0,0,1600,600);this.dirty=false;
    try{localStorage.removeItem(this.key);}catch{}
    this.publish();
  }

  publish() {
    this.snapshotContext.clearRect(0,0,1600,600);
    this.snapshotContext.drawImage(this.canvas,0,0);
    this.texture.needsUpdate=true;
  }

  restore() {
    let stored;try{stored=localStorage.getItem(this.key);}catch{return Promise.resolve();}
    if(!stored?.startsWith('data:image/png;base64,'))return Promise.resolve();
    return new Promise(resolve=>{
      const image=new Image();image.onload=()=>{this.context.drawImage(image,0,0,1600,600);resolve();};image.onerror=()=>resolve();image.src=stored;
    });
  }
}

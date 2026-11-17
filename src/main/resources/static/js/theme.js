/* Shared paint, creation-time grading and one-time handmade assets. */
window.Theme = (() => {
  const palette = Object.freeze({ gold:'#F2B632', amber:'#E8892B', orange:'#D9622B', 'sun-glow':'#FFD866',
    cream:'#FFF1C9', ink:'#3A2312', wood:'#D49A4F', 'wood-dark':'#9A6428',
    'card-red':'#D8402F', teal:'#2E9C8F', leaf:'#3FBF6B',
    sun:'#F2B632', 'x-orange':'#D9622B' });
  const defaults = Object.freeze({ goldenIntensity:0.8, skyDrift:true });
  let config = { ...defaults }, ramp, outlineMaterial, wood, cards, trail, windowLayers;
  const materials = new Map();
  function random(seed = 1741) { return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; }; }
  function vivid(hex, amt = 0.15 * config.goldenIntensity) {
    const color = new THREE.Color(hex), hsl = {};
    color.getHSL(hsl);
    // Preserve greens and skin tones: warm hues gently, without turning chairs orange.
    const warmHue = .10;
    const delta = ((warmHue - hsl.h + 1.5) % 1) - .5;
    color.setHSL((hsl.h + delta * amt * .2 + 1) % 1,
      Math.min(1, hsl.s * (1 + amt)), hsl.l);
    return color;
  }
  function toon(hex) {
    const key = new THREE.Color(hex).getHexString();
    if (!ramp) {
      ramp = new THREE.DataTexture(new Uint8Array([75, 165, 255]), 3, 1, THREE.LuminanceFormat);
      ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
      ramp.generateMipmaps = false; ramp.needsUpdate = true;
    }
    if (!materials.has(key)) materials.set(key, new THREE.MeshToonMaterial({ color: vivid(hex), gradientMap: ramp }));
    return materials.get(key);
  }
  function addOutline(mesh, scale = 1.04) {
    const paints=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if (!mesh.visible || paints.some(mat=>!mat.visible || mat.opacity===0 || mat.colorWrite===false)) return null;
    if (mesh.userData.outlineAdded || !mesh.isMesh || (mesh.material?.map && mesh.material.map !== wood) || mesh.layers.mask !== 1 ||
        (Array.isArray(mesh.material) && mesh.material.some(m => m.map))) return null;
    outlineMaterial ||= new THREE.MeshBasicMaterial({ color: palette.ink, side: THREE.BackSide });
    let hull;
    if (mesh.isInstancedMesh) {
      hull = new THREE.InstancedMesh(mesh.geometry, outlineMaterial, mesh.count);
      const matrix = new THREE.Matrix4(), expansion = new THREE.Matrix4().makeScale(scale, scale, scale);
      for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); hull.setMatrixAt(i, matrix.multiply(expansion)); }
    } else { hull = new THREE.Mesh(mesh.geometry, outlineMaterial); hull.scale.setScalar(scale); }
    hull.userData.themeOutline = true; hull.raycast = () => {};
    hull.castShadow = hull.receiveShadow = false; mesh.add(hull); mesh.userData.outlineAdded = true;
    return hull;
  }
  function canvasTexture(width, height, draw) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d')); return new THREE.CanvasTexture(canvas);
  }
  function woodTexture() {
    return wood ||= canvasTexture(512, 512, ctx => {
      const rand = random(49); ctx.fillStyle = palette.wood; ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = palette['wood-dark']; ctx.lineWidth = 2;
      for (let i = 0; i < 85; i++) {
        const x = rand() * 512, y = rand() * 512;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 20, y - 4, x + 50, y + 6, x + 85, y + 1); ctx.stroke();
      }
      ctx.strokeStyle = palette.ink; ctx.lineWidth = 7;
      for (let y = 0; y <= 512; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(255, y + 2); ctx.lineTo(512, y); ctx.stroke(); }
      for (const [x,y] of [[150,0],[350,128],[110,256],[320,384]]) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+2,y+128); ctx.stroke(); }
    });
  }
  function drawTitle(ctx, text, x, y, maxWidth) {
    ctx.font = '52px "Lilita One", "Trebuchet MS", sans-serif'; ctx.lineJoin = 'round';
    ctx.lineWidth = 10; ctx.strokeStyle = palette.ink; ctx.strokeText(text,x,y,maxWidth);
    ctx.fillStyle = palette['sun-glow']; ctx.fillText(text,x-2,y-3,maxWidth);
    ctx.fillStyle = palette.gold; ctx.fillText(text,x,y,maxWidth);
  }
  function decorate(scene) {
    const geo = new THREE.PlaneGeometry(0.42, 0.61);
    cards ||= canvasTexture(128, 192, ctx => {
      ctx.fillStyle = palette['card-red']; ctx.fillRect(0,0,128,192);
      ctx.strokeStyle = palette.ink; ctx.lineWidth = 7; ctx.strokeRect(4,4,120,184);
      ctx.beginPath();
      for(let y=18;y<180;y+=16) { ctx.moveTo(14,y); ctx.lineTo(27,y+8); ctx.lineTo(14,y+16); ctx.moveTo(114,y); ctx.lineTo(101,y+8); ctx.lineTo(114,y+16); }
      ctx.strokeStyle=palette.cream; ctx.lineWidth=4; ctx.stroke();
      ctx.fillStyle=palette.sun; ctx.beginPath(); ctx.moveTo(64,42); ctx.lineTo(90,96); ctx.lineTo(64,150); ctx.lineTo(38,96); ctx.closePath(); ctx.fill(); ctx.strokeStyle=palette.ink; ctx.stroke();
      ctx.fillStyle=palette.ink; ctx.fillRect(52,88,7,7); ctx.fillRect(70,88,7,7); ctx.fillRect(57,112,17,4);
    });
    const material = new THREE.MeshBasicMaterial({ map: cards, side: THREE.DoubleSide, toneMapped:false });
    const rand = random(74);
    for (let i=0;i<8;i++) {
      const card = new THREE.Mesh(geo,material); card.rotation.set(-Math.PI/2,0,(rand()-.5)*.052);
      card.position.set(-4.6+i*1.3, .204, 2.57+(i%2)*.12); card.scale.setScalar(.97+rand()*.06);
      card.raycast=()=>{}; scene.add(card);
    }
    trail ||= canvasTexture(1024, 640, ctx => {
      const point = (x,z) => [(x+5.25)/10.5*1024,(z+3.1)/6.2*640];
      ctx.strokeStyle=palette.ink; ctx.lineWidth=4; ctx.setLineDash([12,9]); ctx.lineCap='round';
      for(const item of tabletopLayout.filter(item=>item.item!=='laptop')) {
        const [x,y]=point(item.x,item.z), [endX,endY]=point(0,-.55);
        ctx.beginPath(); ctx.moveTo(x,y); ctx.bezierCurveTo(x+80,y-85,endX-80,endY+80,endX,endY); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.strokeStyle=palette['x-orange']; ctx.lineWidth=14;
      const [x,y]=point(0,-.55); ctx.beginPath(); ctx.moveTo(x-16,y-16);ctx.lineTo(x+16,y+16);ctx.moveTo(x+16,y-16);ctx.lineTo(x-16,y+16);ctx.stroke();
    });
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(10.5,6.2), new THREE.MeshBasicMaterial({ map:trail,toneMapped:false,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2 }));
    decal.rotation.x=-Math.PI/2; decal.position.y=.203; decal.raycast=()=>{}; scene.add(decal);
    for (const folder of scene.userData.folders || []) {
      const tag = canvasTexture(512,128,ctx=>{
        ctx.fillStyle=palette.cream;ctx.fillRect(0,0,512,128);ctx.strokeStyle=palette.ink;ctx.lineWidth=12;ctx.strokeRect(6,6,500,116);
        ctx.fillStyle=palette.ink;ctx.font='38px "Patrick Hand", "Comic Sans MS", sans-serif';ctx.textAlign='center';ctx.fillText(folder.member.name,256,78,470);
      });
      const label=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:tag}));label.scale.set(2.5,.5,1);
      label.rotation.x=-Math.PI/2;label.position.set(folder.mesh.position.x,.215,folder.mesh.position.z+1.12);label.raycast=()=>{};scene.add(label);
    }
  }
  function applyScene(desk) {
    const meshes=[]; desk.scene.traverse(obj=>{ if(obj.isMesh) meshes.push(obj); });
    const replacements=new Map();
    // Keep Sean's hover tint local even when his base paint matches other props.
    const jacket=desk.teacherJacket;
    const jacketPaint=toon(jacket.color).clone();
    for(const mesh of meshes) {
      const convert = mat => {
        // All mapped surfaces, including supplied covers and portraits, retain their original material.
        if(!mat.isMeshStandardMaterial || mat.map || mat.transparent) return mat;
        const next=mat===jacket?jacketPaint:toon(mat.color);replacements.set(mat,next);return next;
      };
      mesh.material=Array.isArray(mesh.material)?mesh.material.map(convert):convert(mesh.material);
    }
    desk.teacherJacket=replacements.get(desk.teacherJacket)||desk.teacherJacket;
    const priorities=meshes.filter(mesh=>mesh.isInstancedMesh || mesh.userData.type==='teacher');
    for(const root of [desk.deskGroup,...desk.folders.map(f=>f.mesh),desk.laptop]) root?.traverse(obj=>{if(obj.isMesh) priorities.push(obj);});
    for(const mesh of meshes) {
      mesh.geometry.computeBoundingBox(); const size=new THREE.Vector3();mesh.geometry.boundingBox.getSize(size).multiply(mesh.scale);
      if(mesh.isInstancedMesh || mesh.userData.type==='teacher' || (Math.max(size.x,size.y,size.z)<19 && Math.max(size.x,size.y,size.z)>.8)) priorities.push(mesh);
    }
    let count=0;
    for(const mesh of new Set(priorities)) {
      if(count>=120) break;
      const size=new THREE.Vector3();mesh.geometry.boundingBox?.getSize(size).multiply(mesh.scale);
      if(!mesh.isInstancedMesh && Math.max(size.x,size.y,size.z)<.16) continue;
      if(addOutline(mesh)) count++;
    }
    desk.scene.userData.outlineCount=count;
    desk.scene.userData.folders=desk.folders; decorate(desk.scene);
    const rand=random(424);
    for(const {mesh} of desk.folders) {
      mesh.rotation.y+=(rand()-.5)*Math.PI/60;
      mesh.scale.multiplyScalar(.97+rand()*.06);
    }
  }
  const HORIZON_Y = .88;
  const idle = () => new Promise(resolve => {
    if (window.requestIdleCallback) window.requestIdleCallback(resolve,{timeout:100});
    else setTimeout(resolve,0);
  });
  function windowTextures() {
    return windowLayers ||= buildWindowTextures();
  }
  async function buildWindowTextures() {
    // Both success and failure are cached. Never regenerate during rendering or clicking.
    const canvas = document.createElement('canvas');
    let source = 'photo';
    try {
      const response = await fetch('/assets/textures/window-sunset.jpg');
      if (!response.ok) throw new Error('Optional sunset unavailable');
      const photo = await createImageBitmap(await response.blob());
      const scale = Math.min(1,1024 / Math.max(photo.width,photo.height));
      canvas.width = Math.round(photo.width*scale); canvas.height = Math.round(photo.height*scale);
      const ctx = canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(photo,0,0,canvas.width,canvas.height); photo.close();
      const pixels = ctx.getImageData(0,0,canvas.width,canvas.height), data=pixels.data;
      const horizon = Math.floor(canvas.height*HORIZON_Y), width=canvas.width;
      const dark = new Uint8Array(width*(canvas.height-horizon));
      // Small idle chunks keep the one-time pass out of interaction tasks.
      for (let y=0;y<canvas.height;y++) {
        if (y%24===0) await idle();
        for (let x=0;x<width;x++) {
          const i=(y*width+x)*4, r=data[i],g=data[i+1],b=data[i+2];
          const lum=(.2126*r+.7152*g+.0722*b)/255;
          if(y>=horizon && lum<.18) dark[(y-horizon)*width+x]=1;
          const gray=.299*r+.587*g+.114*b;
          // Quantize the warm saturated result to six levels in each channel.
          data[i]=Math.round(Math.max(0,Math.min(255,gray+(r-gray)*1.2+9))/51)*51;
          data[i+1]=Math.round(Math.max(0,Math.min(255,gray+(g-gray)*1.2+3))/51)*51;
          data[i+2]=Math.round(Math.max(0,Math.min(255,gray+(b-gray)*1.2-9))/51)*51;
        }
      }
      // Dilate-minus-original, confined to the horizon strip; never outline clouds.
      const rows=canvas.height-horizon;
      for(let y=0;y<rows;y++) {
        if(y%12===0) await idle();
        for(let x=0;x<width;x++) {
          if(dark[y*width+x]) continue;
          let edge=false;
          for(let dy=-2;dy<=2&&!edge;dy++) for(let dx=-2;dx<=2;dx++) {
            if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<rows&&dark[(y+dy)*width+x+dx]) {edge=true;break;}
          }
          if(edge) {const i=((y+horizon)*width+x)*4;data[i]=58;data[i+1]=35;data[i+2]=18;}
        }
      }
      ctx.putImageData(pixels,0,0);
    } catch {
      source='fallback';
      console.debug('Optional sunset unavailable; using golden sky.');
      canvas.width=512;canvas.height=512;
      const ctx=canvas.getContext('2d'), gradient=ctx.createLinearGradient(0,0,0,512);
      gradient.addColorStop(0,palette.orange);gradient.addColorStop(.55,palette.amber);gradient.addColorStop(1,palette['sun-glow']);
      ctx.fillStyle=gradient;ctx.fillRect(0,0,512,512);
    }
    const split=Math.floor(canvas.height*HORIZON_Y);
    const layer=(top,height)=>canvasTexture(canvas.width,height,ctx=>ctx.drawImage(canvas,0,top,canvas.width,height,0,0,canvas.width,height));
    const sky=layer(0,split), horizon=layer(split,canvas.height-split);
    for(const texture of [sky,horizon]) {
      texture.minFilter=texture.magFilter=THREE.LinearFilter;
      texture.generateMipmaps=false; texture.encoding=THREE.sRGBEncoding;
    }
    sky.wrapS=THREE.MirroredRepeatWrapping;
    sky.wrapT=THREE.MirroredRepeatWrapping;
    return {sky,horizon,source};
  }
  function configure(input = {}) {
    input = input && typeof input === 'object' ? input : {};
    config = {
      goldenIntensity: typeof input.goldenIntensity === 'number' && Number.isFinite(input.goldenIntensity)
        ? Math.max(0,Math.min(1,input.goldenIntensity)) : defaults.goldenIntensity,
      skyDrift: typeof input.skyDrift === 'boolean' ? input.skyDrift : defaults.skyDrift
    };
    return config;
  }
  return { ...palette, palette, defaults, configure, vivid, toon, addOutline, woodTexture, drawTitle, applyScene,
    windowTextures, HORIZON_Y, get config(){return {...config};} };
})();
window.addOutline = window.Theme.addOutline;

/* Shared paint, creation-time grading and one-time handmade assets. */
window.Theme = (() => {
  const palette = Object.freeze({ gold:'#F2B632', amber:'#E8892B', orange:'#D9622B', 'sun-glow':'#FFD866',
    cream:'#FFF1C9', ink:'#3A2312', wood:'#D49A4F', 'wood-dark':'#9A6428',
    'card-red':'#D8402F', teal:'#2E9C8F', leaf:'#3FBF6B',
    sun:'#F2B632', 'x-orange':'#D9622B' });
  const defaults = Object.freeze({ goldenIntensity:0.8, skyDrift:true });
  let config = { ...defaults }, ramp, outlineMaterial, wood, trail, windowLayers;
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
    decal.name='treasure-trail';decal.rotation.x=-Math.PI/2; decal.position.y=.203; decal.raycast=()=>{}; scene.add(decal);
    const tagGeometry = new THREE.PlaneGeometry(0.42, 0.61);
    for (const folder of scene.userData.folders || []) {
      const tag = canvasTexture(512,128,ctx=>{
        ctx.fillStyle=palette.cream;ctx.fillRect(0,0,512,128);ctx.strokeStyle=palette.ink;ctx.lineWidth=12;ctx.strokeRect(6,6,500,116);
        ctx.fillStyle=palette.ink;ctx.font='38px "Patrick Hand", "Comic Sans MS", sans-serif';ctx.textAlign='center';ctx.fillText(folder.member.name,256,78,470);
      });
      const label=new THREE.Mesh(tagGeometry,new THREE.MeshBasicMaterial({map:tag}));label.scale.set(2.5,.5,1);label.name='member-name-tag';
      label.rotation.x=-Math.PI/2;label.position.set(folder.mesh.position.x,.215,folder.mesh.position.z+1.12);label.raycast=()=>{};scene.add(label);
    }
  }
  function addVandalism(desk, seatSlot) {
    if (desk.vandalismReady) return desk.vandalismReady;
    // Capture Sean's resting footprint before his breathing/blink animation starts.
    const teacherBounds=desk.teacher?new THREE.Box3().setFromObject(desk.teacher):null;
    desk.vandalismReady=new Promise(resolve=>{
      const create=()=>{
        const rand=random(9147),pen='#2B4C9B',pencil='#6B6B6B';
        const roots=new Set(),inverse=desk.deskGroup.matrixWorld.clone().invert();
        for (const hit of desk.interactiveObjects) {
          if (hit.userData.type==='front-desk' || !desk.tabletopObject(hit)) continue;
          let root=hit;while(root.parent && root.parent!==desk.deskGroup) root=root.parent;roots.add(root);
        }
        for (const root of desk.deskGroup.children) if(root.name==='member-name-tag') roots.add(root);
        const obstacles=[];
        const boxes=[...roots].map(root=>{
          if(root.userData.type==='sticky-note' && root.geometry) {
            // Existing visitor notes have random tilts. Reserve their full rotation envelope
            // without changing them, so the seeded doodles stay identical after a reload.
            root.geometry.computeBoundingSphere();
            const r=root.geometry.boundingSphere.radius*Math.max(Math.abs(root.scale.x),Math.abs(root.scale.y),Math.abs(root.scale.z))+.08;
            return {local:true,bounds:new THREE.Box3(new THREE.Vector3(root.position.x-r,0,root.position.z-r),new THREE.Vector3(root.position.x+r,0,root.position.z+r))};
          }
          return {local:false,bounds:new THREE.Box3().setFromObject(root)};
        });
        if(teacherBounds)boxes.push({local:false,bounds:teacherBounds});
        for (const {bounds,local} of boxes) {
          const b=local?bounds:bounds.clone().applyMatrix4(inverse);
          obstacles.push({x:(b.min.x+5.25)/10.5*1024-8,y:(b.min.z+3.1)/6.2*512-8,
            w:(b.max.x-b.min.x)/10.5*1024+16,h:(b.max.z-b.min.z)/6.2*512+16});
        }
        desk.vandalismFootprints=obstacles;
        const overlaps=(a,b)=>a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
        const placed=[];
        const locate=(w,h)=>{
          const candidates=[];
          for(let y=8;y+h<=504;y+=12) for(let x=8;x+w<=1016;x+=12) {
            const rect={x,y,w,h};if(obstacles.some(b=>overlaps(rect,b)) || placed.some(b=>overlaps(rect,b))) continue;
            candidates.push({...rect,score:Math.min(y,512-y-h)+rand()*10});
          }
          candidates.sort((a,b)=>a.score-b.score);const rect=candidates[0];if(rect) placed.push(rect);return rect;
        };
        const frontMap=canvasTexture(1024,512,ctx=>{
          ctx.lineCap='round';ctx.lineJoin='round';
          const shaky=(points,close=false)=>{
            ctx.beginPath();points.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](x+(rand()-.5)*1.5,y+(rand()-.5)*1.5));if(close)ctx.closePath();ctx.stroke();
          };
          const blocks=[
            [280,60,()=>{ctx.fillStyle=pencil;ctx.font='44px "Patrick Hand", cursive';ctx.fillText('09XX-XXX-XXXX',3,44,274);}],
            [246,90,()=>{
              ctx.strokeStyle=pen;ctx.fillStyle=pen;shaky([[4,8],[166,7],[168,77],[3,78]],true);
              ctx.font='40px "Patrick Hand", cursive';ctx.fillText('BSIT 3-1',15,57,142);
              ctx.beginPath();ctx.arc(210,43,27,0,Math.PI*2);ctx.stroke();ctx.fillRect(187,32,20,12);ctx.fillRect(212,32,20,12);
              shaky([[207,36],[212,36]]);ctx.beginPath();ctx.arc(210,50,12,.15,Math.PI-.15);ctx.stroke();
            }],
            [105,100,()=>{
              ctx.strokeStyle=pen;ctx.fillStyle=pen;ctx.beginPath();ctx.moveTo(52,89);ctx.bezierCurveTo(-17,49,1,-9,52,24);ctx.bezierCurveTo(102,-9,121,49,52,89);ctx.stroke();
              ctx.font='30px "Patrick Hand", cursive';ctx.fillText('A + B',22,55,66);
            }],
            [76,84,()=>{
              ctx.strokeStyle=pencil;const points=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?15:35;points.push([38+Math.cos(a)*r,42+Math.sin(a)*r]);}shaky(points,true);
            }],
            [65,96,()=>{
              ctx.strokeStyle=pencil;ctx.beginPath();ctx.arc(32,16,11,0,Math.PI*2);ctx.stroke();shaky([[32,27],[32,62]]);shaky([[8,47],[32,35],[58,47]]);shaky([[12,91],[32,62],[52,91]]);
            }],
            [96,65,()=>{
              ctx.strokeStyle=pencil;for(let x=13;x<=73;x+=20)shaky([[x,7],[x-2,56]]);shaky([[4,50],[85,15]]);
            }]
          ];
          // Plan the whole set before painting so an early large doodle cannot crowd out a later one.
          let plan=[];
          for(const scale of [1,.85,.7,.55,.45]) {
            placed.length=0;plan=[];
            for(const [w,h,draw] of blocks) {
              const pad=Math.ceil(Math.max(w,h)*scale*.075)+3,rect=locate(w*scale+pad*2,h*scale+pad*2);
              if(!rect){plan=[];break;}plan.push({w,h,draw,rect,scale});
            }
            if(plan.length===blocks.length)break;
          }
          for(const {w,h,draw,rect,scale} of plan) {
            const angle=(rand()-.5)*16*Math.PI/180;rect.angle=angle;rect.scale=scale;
            ctx.save();ctx.translate(rect.x+rect.w/2,rect.y+rect.h/2);ctx.rotate(angle);ctx.scale(scale,scale);ctx.translate(-w/2,-h/2);ctx.lineWidth=2.6;draw();ctx.restore();
          }
          // Leave every prop/name-tag footprint and the existing treasure trail untouched.
          ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#000';
          obstacles.forEach(r=>ctx.fillRect(r.x,r.y,r.w,r.h));ctx.drawImage(trail.image,0,0,1024,512);ctx.globalCompositeOperation='source-over';
        });
        frontMap.colorSpace=THREE.SRGBColorSpace;
        const makePlane=(map,name)=>{
          const material=new THREE.MeshBasicMaterial({map,transparent:true,opacity:.85,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
          const mesh=new THREE.Mesh(desk.deskGroup.getObjectByName('treasure-trail').geometry,material);mesh.name=name;mesh.rotation.x=-Math.PI/2;mesh.raycast=()=>{};return mesh;
        };
        const front=desk.tableVandalism=makePlane(frontMap,'front-table-vandalism');front.position.y=.207;desk.deskGroup.add(front);
        desk.vandalismPlacements=placed;
        if(seatSlot) {
          const seatMap=canvasTexture(512,256,ctx=>{
            // Keep the ink on the exposed outer strip, beyond the student's hands and head silhouette.
            // Compensate for the narrow plane so the handwriting and heart retain their proportions.
            ctx.scale(5.2,1);ctx.strokeStyle=pen;ctx.fillStyle=pen;ctx.lineWidth=1.5;ctx.lineCap='round';ctx.font='600 27px "Patrick Hand", cursive';ctx.fillText('Crush kita',5,62,88);
            for(const y of [72,81]){ctx.beginPath();ctx.moveTo(5,y);ctx.quadraticCurveTo(48,y+2,93,y-1);ctx.stroke();}
            ctx.beginPath();ctx.moveTo(49,168);ctx.bezierCurveTo(8,145,22,117,49,135);ctx.bezierCurveTo(76,117,91,145,49,168);ctx.stroke();
            ctx.fillStyle=pencil;ctx.font='20px "Patrick Hand", cursive';ctx.fillText('secret',15,220,75);
            for(const y of [207,217,228]){ctx.beginPath();ctx.moveTo(10,y);ctx.lineTo(91,y+4);ctx.stroke();}
          });
          seatMap.colorSpace=THREE.SRGBColorSpace;
          const seat=desk.seatVandalism=makePlane(seatMap,'seat-tablet-vandalism');seat.scale.set(.4/10.5,1.04/6.2,1);
          seat.position.set(seatSlot.x+.86,-2.84+2.768,seatSlot.z-.48);
          (desk.roomGroup.getObjectByName('floating-classroom-chairs')||desk.roomGroup).add(seat);desk.seatDecalSlot=seatSlot;
        }
        resolve();
      };
      if(window.requestIdleCallback)window.requestIdleCallback(create,{timeout:800});else setTimeout(create,0);
    });
    return desk.vandalismReady;
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
  return { ...palette, palette, defaults, configure, vivid, toon, addOutline, woodTexture, drawTitle, applyScene, addVandalism,
    windowTextures, HORIZON_Y, get config(){return {...config};} };
})();
window.addOutline = window.Theme.addOutline;

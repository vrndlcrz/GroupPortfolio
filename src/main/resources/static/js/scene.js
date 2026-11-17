/** Interactive group portfolio desk in a Philippine high school classroom. */
// Keyboard look direction; drag keeps its original direction.
const INVERT_X = false;
const INVERT_Y = false;
const MOUSE_YAW_RANGE = Math.PI * 1.15;
const PITCH_RANGE = 1.5;
const KEY_LOOK_VIEWPORTS_PER_SECOND = 0.5;
const tabletopLayout = [
  { item: 'spiral-notebook', x: -4.4, z: -.04, yaw: 0.14 },
  { item: 'long-folder', x: -2.35, z: -.04, yaw: -0.11 },
  { item: 'laptop', x: 0, z: 0, yaw: 0 },
  { item: 'theme-book', x: 2.35, z: -.04, yaw: 0.08 },
  { item: 'intermediate-pad', x: 4.35, z: -.04, yaw: -0.14 }
];

class CameraRig {
  static SEAT_POSE = Object.freeze({ x: -8.2, y: 4, z: 3.7, yaw: .493, pitch: -.10, fov: 50 });
  static DESK_POSE = Object.freeze({ x: 0, y: 8, z: -11.55, yaw: Math.PI, pitch: -Math.PI * 85 / 180 });

  capturePose() {
    const p = this.camera.position;
    return { x: p.x, y: p.y, z: p.z, yaw: this.yaw, pitch: this.pitch };
  }

  applyPose(pose) {
    this.camera.position.set(pose.x, pose.y, pose.z);
    this.yaw = this.targetYaw = pose.yaw;
    this.pitch = this.targetPitch = pose.pitch;
    this.applyLook();
  }

  constructor(camera) {
    this.camera = camera;
    this.inputEnabled = true;
    this.keys = new Set();
    const pose = CameraRig.SEAT_POSE;
    this.seat = new THREE.Vector3(pose.x, pose.y, pose.z);
    camera.position.copy(this.seat);
    camera.rotation.order = 'YXZ';
    this.yaw = this.targetYaw = pose.yaw;
    this.pitch = this.targetPitch = pose.pitch;
    this.applyLook();
  }

  setInputEnabled(enabled) {
    this.inputEnabled = enabled;
    this.keys.clear();
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
  }

  bindKeyboardLook(isZoomed) {
    this.lookBlocked = () => !this.inputEnabled || isZoomed() || document.activeElement?.matches('input, textarea') ||
      document.querySelector('#bookOverlay.active');
    const controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyR']);
    window.addEventListener('keydown', event => {
      if (!controls.has(event.code) || event.repeat || event.ctrlKey || event.metaKey ||
          event.altKey || this.lookBlocked()) return;
      if (event.code === 'KeyR') {
        this.keys.clear();
        this.yaw = this.targetYaw = CameraRig.SEAT_POSE.yaw;
        this.pitch = this.targetPitch = CameraRig.SEAT_POSE.pitch;
        this.applyLook();
      } else {
        this.keys.add(event.code);
      }
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('focusin', event => {
      if (event.target.matches?.('input, textarea')) this.keys.clear();
    });
  }

  updateKeyboardLook(dt) {
    if (!this.keys.size) return;
    if (this.lookBlocked()) {
      this.keys.clear();
      return;
    }
    const horizontal = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const vertical = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    const fast = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const distance = dt * KEY_LOOK_VIEWPORTS_PER_SECOND * (fast ? 1.8 : 1);
    this.aim(this.targetYaw + horizontal * (INVERT_X ? -1 : 1) * distance * MOUSE_YAW_RANGE,
      this.targetPitch + vertical * (INVERT_Y ? -1 : 1) * distance * PITCH_RANGE);
  }

  aim(yaw, pitch) {
    if (!this.inputEnabled) return;
    this.targetYaw = yaw;
    this.targetPitch = THREE.MathUtils.clamp(pitch, -1.32, 1.22);
  }

  applyLook() {
    this.camera.rotation.set(this.pitch, -this.yaw, 0, 'YXZ');
  }

  update() {
    if (!this.inputEnabled) return;
    this.yaw += (this.targetYaw - this.yaw) * 0.08;
    this.pitch += (this.targetPitch - this.pitch) * 0.08;
    this.applyLook();
  }
}

class DeskScene {
  constructor(options = {}) {
    this.inputEnabled = options.inputEnabled !== false;
    this.view = 'seat';
    this.container = document.getElementById(options.containerId || 'scene-container');
    this.onFolderClick = options.onFolderClick;
    this.onFolderSelect = options.onFolderSelect || null;
    this.members = options.members || [];
    this.classroom = options.classroom || classroomDefaults;
    this.notes = options.notes || [];

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = null;
    this.mouse = new THREE.Vector2();

    this.folders = [];
    this.interactiveObjects = [];
    this.hoveredObject = null;
    this.activeFolder = null;
    this.isCameraZoomed = false;
    this.isSpilled = false;
    this.isFloating = false;

    this.isDraggingView = false;
    this.dragStartPos = { x: 0, y: 0 };
    this.dragStartAngles = { yaw: 0, pitch: 0 };

    this.tooltip = document.getElementById('deskTooltip');

    this.init();
  }

  static isWebGLAvailable() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  init() {
    if (!DeskScene.isWebGLAvailable() || typeof THREE === 'undefined') {
      console.warn('WebGL or Three.js unavailable, activating 2D desk fallback.');
      this.initFallback2D();
      return;
    }

    // 1. Setup Three.js Scene
    this.scene = new THREE.Scene();
    this.scene.background = Theme.vivid(Theme.cream);
    this.scene.fog = new THREE.Fog(Theme.vivid('#FFE3A3'),18,60);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 2. Setup Renderer FIRST so it is immediately available
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.lastShadowUpdate = 0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 3. Setup Camera with default position guaranteed
    this.camera = new THREE.PerspectiveCamera(CameraRig.SEAT_POSE.fov, width / height, 0.1, 100);
    this.rig = new CameraRig(this.camera);
    this.rig.setInputEnabled(this.inputEnabled);
    this.adjustCameraForScreen();

    // 4. Lighting & Ambience
    this.setupLighting();

    // 5. Build Room Surrounding Environment
    this.buildSurroundingRoom();

    // 6. Build Desk & Props
    this.buildDesk();
    const roomObjects = new Set(this.scene.children);
    this.buildFolders();
    this.buildProps();
    this.buildStickyNotes();
    Theme.applyScene(this);
    this.moveTableContents(roomObjects);
    this.installWindowShadowFade();
    this.renderer.shadowMap.needsUpdate = true;

    // 7. Raycasting & Events
    this.raycaster = new THREE.Raycaster();
    // CRITICAL: Enable layer 1 so raycaster can hit invisible hitboxes on that layer.
    // Camera only renders layer 0 (default), so layer-1 meshes are NEVER drawn but are always intersectable.
    this.raycaster.layers.enable(1);
    this.bookOverlay = document.getElementById('bookOverlay');
    this.bindEvents();

    // 8. Render Loop
    this.animate();

    // 9. Guarantee proper camera framing after DOM layout without needing Inspect
    requestAnimationFrame(() => {
      this.adjustCameraForScreen();
    });
    setTimeout(() => {
      this.adjustCameraForScreen();
    }, 100);
  }

  setupLighting() {
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    const strength = Theme.config.goldenIntensity;
    this.scene.add(new THREE.HemisphereLight('#FFE3A3','#C98A45',.9*strength));
    const fill = new THREE.DirectionalLight('#FFD9A0',.35*strength);
    fill.position.set(0,5,8); this.scene.add(fill);
    const sun = new THREE.DirectionalLight('#FFC862',1.4*strength);
    sun.position.set(18,7.6,5.4);
    sun.target.position.set(-9,-2.84,-4.8);
    sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    Object.assign(sun.shadow.camera,{left:-17,right:17,top:11,bottom:-11,near:1,far:44});
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias=.018;sun.shadow.bias=-.00012;
    this.scene.add(sun,sun.target);
    this.windowSun = sun; this.windowSunIntensity = sun.intensity;
    this.windowLight = 1;
  }

  buildSurroundingRoom() {
    const room = this.roomGroup = new THREE.Group();
    this.scene.add(room);
    // Four scene units per metre. A 1.8-unit seat and 3.02-unit table are 45 and 75.5 cm high.
    const floor = -2.84, ceiling = 10, front = -15, back = 9, side = 11;
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const paint = color => new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
    const white = paint(Theme.cream), yellow = paint(Theme.sun), green = paint(0x69bd4c);
    const frame = paint(Theme.ink), silver = paint(Theme.teal);
    const box = (parent, mat, x, y, z, w, h, d) => {
      const mesh = new THREE.Mesh(unitBox, mat);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const texture = (w, h, draw) => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      draw(canvas.getContext('2d'));
      return new THREE.CanvasTexture(canvas);
    };
    const panel = (map, w, h, x, y, z, yaw = 0) => {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
      face.position.set(x, y, z);
      face.rotation.y = yaw;
      face.receiveShadow = true;
      room.add(face);
      return face;
    };
    const tile = texture(128, 128, ctx => {
      ctx.fillStyle = '#F5D69A'; ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#D4AE6D'; ctx.strokeRect(0, 0, 128, 128);
    });
    tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
    tile.repeat.set(11, 12);
    box(room, new THREE.MeshStandardMaterial({ map: tile, roughness: 0.9 }), 0, floor - 0.08, -3, 22, 0.16, 24);
    const wallHeight = ceiling - floor;
    box(room, paint(0xffe3a3), 0, floor + wallHeight / 2, front, 22, wallHeight, 0.18);
    box(room, paint(0x69ad42), 0, floor + wallHeight * .05, front + .11, 22, wallHeight * .1, .08);
    box(room, paint(Theme.gold), 0, ceiling - .25, front + .14, 22, .12, .12);
    box(room, white, 0, ceiling + 0.1, -3, 22, 0.2, 24);
    for (const z of [back]) {
      box(room, white, 0, (ceiling + floor) / 2, z, 22, ceiling - floor, 0.18);
      box(room, green, 0, floor + 0.23, z + (z === front ? 0.11 : -0.11), 22, 0.46, 0.07);
      for (const x of [-10.75, 10.75]) box(room, yellow, x, (ceiling + floor) / 2, z + (z === front ? 0.2 : -0.2), 0.5, ceiling - floor, 0.5);
    }
    const door = new THREE.Group();
    door.position.set(0, floor, back - 0.25);
    door.userData = { type: 'door', enabled: false };
    room.add(door);
    // TODO: Register the exit-to-outside handler when the door is enabled.
    const timber = paint(Theme.wood);
    const daylight = new THREE.MeshStandardMaterial({
      color: 0xe8f2ef, emissive: 0xfff8d7, emissiveIntensity: 1.1, roughness: 0.95
    });
    for (const x of [-1.86, 1.86]) box(door, green, x, 4.23, 0, 0.18, 8.46, 0.35);
    box(door, green, 0, 8.48, 0, 3.9, 0.18, 0.35);
    box(door, timber, 0, 4.22, 0, 3.52, 8.36, 0.19);
    box(door, green, 0, 6.84, -0.12, 2.06, 1.63, 0.08);
    box(door, daylight, 0, 6.84, -0.17, 1.88, 1.45, 0.035);
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9c1bf, metalness: 0.68, roughness: 0.35 });
    box(door, steel, 0, 0.57, -0.11, 3.29, 0.91, 0.04);
    box(door, steel, -1.38, 3.9, -0.17, 0.24, 0.62, 0.13);
    box(door, steel, -1.16, 4, -0.29, 0.62, 0.09, 0.16);
    box(door, daylight, 0, 0.026, -0.13, 3.49, 0.04, 0.07);
    box(room, white, -side, (ceiling + floor) / 2, -3, 0.18, ceiling - floor, 24);
    for (const x of [-10.89, 10.89]) box(room, green, x, floor + 0.23, -3, 0.08, 0.46, 24);
    for (const z of [-12, -4, 4]) box(room, yellow, 0, ceiling - 0.22, z, 22, 0.44, 0.42);

    // Build the right wall around an actual opening. Solid masonry blocks the sun elsewhere.
    const sill = 0.25, lintel = 6.85, start = -6, end = 7.2;
    const wallPiece = (y0, y1, z0, z1) => box(room, white, side, (y0+y1)/2, (z0+z1)/2, 0.18, y1-y0, z1-z0);
    wallPiece(floor, sill, front, back); wallPiece(lintel, ceiling, front, back);
    wallPiece(sill, lintel, front, start); wallPiece(sill, lintel, end, back);
    for (const y of [sill, lintel]) box(room, green, side, y, (start+end)/2, 0.32, 0.22, end-start);
    for (const z of [start, (start+end)/2, end]) box(room, green, side, (sill+lintel)/2, z, 0.32, lintel-sill, 0.2);
    const glass = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD866'), transparent: true, opacity: .18, depthWrite: false });
    const slats = [];
    for (let column = 0; column < 2; column++) {
      for (let i = 0; i < 12; i++) {
        const slat = box(room, glass, side, sill + (i + 0.5) * 0.55, start + 3.3 + column * 6.6, 0.05, 0.51, 6.42);
        slat.rotation.z = -0.94;
        slats.push(slat);
      }
    }

    // One shared outline draw for all 24 existing blades, without changing their poses.
    const slatOutlines=new THREE.InstancedMesh(unitBox,
      new THREE.MeshBasicMaterial({color:Theme.ink,side:THREE.BackSide,transparent:true,opacity:.13,depthWrite:false}),slats.length);
    const expansion=new THREE.Matrix4().makeScale(1.045,1.045,1.045),matrix=new THREE.Matrix4();
    slats.forEach((slat,i)=>{slat.updateMatrix();slatOutlines.setMatrixAt(i,matrix.copy(slat.matrix).multiply(expansion));});
    slatOutlines.userData.outlineAdded=true;slatOutlines.raycast=()=>{};room.add(slatOutlines);
    this.buildWindowView(side,sill,lintel,start,end);
    this.buildCurtain(room, box, texture, side, sill, lintel, start, end);

    const boardX = 0, boardWidth = 22 * .75, boardHeight = wallHeight * .37, boardY = 3.5;
    box(room, paint(Theme.gold), boardX, boardY, front + .18, boardWidth, boardHeight, .2);
    const board = texture(2048, 560, () => {});
    const writeBoard = () => {
      const ctx = board.image.getContext('2d');
      const { title, subtitle, names } = this.classroom.board;
      ctx.fillStyle = '#F7F7F5'; ctx.fillRect(0, 0, 2048, 560);
      ctx.textAlign = 'right';
      Theme.drawTitle(ctx, title, 1940, 94, 1010);
      ctx.fillStyle = '#b3333b'; ctx.font = 'bold 56px Caveat, cursive';
      ctx.fillText(subtitle, 1935, 161, 970);
      const step = Math.min(82, 322 / Math.max(1, names.length));
      ctx.font = Math.floor(step * .86) + 'px Caveat, cursive'; ctx.fillStyle = '#265294';
      names.forEach((name, i) => ctx.fillText(name, 1940 - (i % 3) * 5, 183 + step * (i + .8), 970));
      ctx.strokeStyle = '#4c7397'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      for (const [x,y,r] of [[185,125,24],[245,158,12],[470,365,15]]) {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = i * Math.PI * .8 - Math.PI / 2;
          ctx[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(angle), y + r * Math.sin(angle));
        }
        ctx.closePath(); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(155,195); ctx.quadraticCurveTo(210,183,270,191); ctx.stroke();
      board.needsUpdate = true;
    };
    writeBoard();
    Promise.all([document.fonts.load('76px "Gochi Hand"'), document.fonts.load('70px Caveat')]).then(writeBoard).catch(() => {});
    panel(board, boardWidth - .36, boardHeight - .36, boardX, boardY, front + .29);
    const trayY = boardY - boardHeight / 2;
    box(room, silver, boardX, trayY, front + .37, boardWidth, .12, .45);
    [0x205587,0xc14741,0x242628].forEach((color,i) => {
      box(room, white, i - 1, trayY + .11, front + .42, .61, .09, .09);
      box(room, paint(color), i - .72, trayY + .11, front + .42, .12, .1, .1);
    });
    for (const [key, x] of [['mission', -5.5], ['vision', 5.5]]) {
      const content = this.classroom[key];
      const sign = texture(768, 320, ctx => {
        ctx.fillStyle = '#D9D9D9'; ctx.fillRect(0, 0, 768, 320);
        ctx.textAlign = 'center'; ctx.fillStyle = '#24282a'; ctx.font = 'bold 74px sans-serif';
        ctx.fillText(content.title, 384, 102, 710);
        ctx.font = '42px sans-serif';
        const words = content.text.trim().split(/\s+/);
        const middle = Math.ceil(words.length / 2);
        ctx.fillText(words.slice(0, middle).join(' '), 384, 195, 700);
        ctx.fillText(words.slice(middle).join(' '), 384, 250, 700);
      });
      const face = panel(sign, 22 * .17, 1.65, x, 7.75, front + .25);
      face.userData = { type: 'placard', content };
      this.interactiveObjects.push(face);
    }
    const tv = new THREE.Group(); room.add(tv);
    tv.position.set(boardX, boardY + boardHeight / 2 + .35 + 2.75 / 2, front + .21);
    box(tv, frame, 0, 0, 0, 4.87, 2.75, .2);
    this.tvTexture = texture(768,432,() => {});
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.72,2.61),
      new THREE.MeshBasicMaterial({map:this.tvTexture}));
    screen.position.z = .11; tv.add(screen);
    this.tvStart = performance.now();
    this.drawTVSlide(0);
    this.buildTeacher(room, floor, box, paint, texture);
    const notices = texture(1024, 560, ctx => {
      ctx.fillStyle = '#aa7952'; ctx.fillRect(0,0,1024,560);
      const cards = [
        ['CLASS OFFICERS', 'President', 'Vice President', 'Secretary', 'Treasurer'],
        ['SCHEDULE', '7:30   Filipino', '8:30   Mathematics', '9:30   Recess', '10:00  Science'],
        ['PAALALA', 'Bawal magkalat.', 'Bawal kumain', 'sa loob ng klase.']
      ];
      cards.forEach(([title,...rows], i) => {
        const x = 26 + i * 330;
        ctx.fillStyle = ['#fff8cc','#f9f6ef','#e7f2df'][i]; ctx.fillRect(x,41,310,470);
        ctx.fillStyle = '#ab4637'; ctx.beginPath(); ctx.arc(x+155,55,7,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#234941'; ctx.font = 'bold 30px sans-serif'; ctx.fillText(title,x+16,115);
        ctx.font = '25px sans-serif'; rows.forEach((line,j) => ctx.fillText(line,x+16,195+j*63));
      });
    });
    box(room, frame, -10.84, 2.9, -4, 0.2, 4.4, 8.4);
    panel(notices, 8.15, 4.15, -10.72, 2.9, -4, Math.PI/2);

    const tube = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d9, emissiveIntensity: 0.95 });
    for (const x of [-5.3, 5.3]) {
      box(room, silver, x, 9.84, -4, 0.58, 0.24, 5);
      box(room, tube, x, 9.65, -4, 0.24, 0.14, 4.8);
    }
    this.classroomRotors = [];
    const fan = (x,y,z,wall) => {
      const mount = new THREE.Group();
      mount.position.set(x,y,z);
      if (wall) { mount.rotation.z = Math.PI/2; mount.scale.setScalar(0.57); }
      room.add(mount);
      box(mount, silver, 0, 0.35, 0, 0.12, 0.7, 0.12);
      const rotor = new THREE.Group(); mount.add(rotor);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.23,0.28,16), frame);
      rotor.add(hub);
      for (let i=0; i<3; i++) {
        const arm = new THREE.Group(); arm.rotation.y = i * Math.PI * 2 / 3;
        rotor.add(arm); box(arm, green, 0.88, 0, 0, 1.48, 0.07, 0.33);
      }
      if (wall) {
        for (const radius of [1.1,1.7]) {
          const guard = new THREE.Mesh(new THREE.TorusGeometry(radius,0.045,6,32),silver);
          guard.rotation.x = Math.PI/2; guard.position.y = -0.21; mount.add(guard);
        }
      }
      this.classroomRotors.push(rotor);
    };
    fan(0,9.24,-9,false); fan(0,9.24,1,false); fan(-10.48,6.3,2,true);

    // Each tablet-arm chair uses the same local parts; one instanced draw per material.
    const seats = [];
    for (const z of [-12,-8.9,-5.8,0.1,3.7]) {
      for (const x of [-8.2,-4.2,4.2,8.2]) {
        if (z === -12 && (x > 0 || x === -4.2)) continue;
        if (z >= 0 && Math.abs(x) < 6) continue;
        if (x !== CameraRig.SEAT_POSE.x || z !== CameraRig.SEAT_POSE.z) seats.push([x,z]);
      }
    }
    const chairBatch = (material, parts) => {
      const mesh = new THREE.InstancedMesh(unitBox, material, seats.length * parts.length);
      const pose = new THREE.Object3D(); let i = 0;
      for (const [x,z] of seats) for (const [dx,dy,dz,w,h,d,tilt=0] of parts) {
        pose.position.set(x+dx,floor+dy,z+dz); pose.scale.set(w,h,d);
        pose.rotation.x = tilt; pose.updateMatrix(); mesh.setMatrixAt(i++,pose.matrix);
      }
      mesh.castShadow = mesh.receiveShadow = true; room.add(mesh);
    };
    chairBatch(green, [[0,1.73,0,1.67,0.14,1.55],[0,2.56,0.68,1.62,1.24,0.13,0.1],[0.48,2.7,-0.48,1.22,0.12,1.28]]);
    const supports = [[0.77,2.13,-0.36,0.1,1.04,0.1],[0,1.54,0,1.62,0.12,1.46]];
    for (const x of [-0.69,0.69]) for (const z of [-0.58,0.58]) supports.push([x,0.83,z,0.11,1.66,0.11]);
    chairBatch(frame,supports);
    // One plain monoblock for the viewer; all tablet-arm classroom chairs stay unchanged.
    const viewerChair = this.viewerChair = new THREE.Group(); room.add(viewerChair);
    viewerChair.position.set(CameraRig.SEAT_POSE.x,0,CameraRig.SEAT_POSE.z);
    const plastic = Theme.toon(0x8fb3c9);
    box(viewerChair,plastic,0,floor+1.73,0,1.67,.14,1.55);
    const backShape = new THREE.Shape();
    backShape.moveTo(-.82,-.65); backShape.lineTo(.82,-.65);
    backShape.lineTo(.78,.45); backShape.quadraticCurveTo(.76,.78,0,.78);
    backShape.quadraticCurveTo(-.76,.78,-.78,.45); backShape.closePath();
    const plasticBack = new THREE.Mesh(new THREE.ExtrudeGeometry(backShape,{depth:.09,bevelEnabled:false}),plastic);
    plasticBack.position.set(0,floor+2.42,.68); plasticBack.rotation.x=.12; viewerChair.add(plasticBack);
    for (const x of [-.69,.69]) for (const z of [-.58,.58]) box(viewerChair,plastic,x,floor+.83,z,.11,1.66,.11);

    const glow = texture(128,128,ctx => {
      const g = ctx.createRadialGradient(64,64,0,64,64,64);
      g.addColorStop(0,'rgba(255,222,144,.85)'); g.addColorStop(1,'rgba(255,220,140,0)');
      ctx.fillStyle=g; ctx.fillRect(0,0,128,128);
    });
    const shaftMat = new THREE.MeshBasicMaterial({map:glow,color:0xffd27a,transparent:true,opacity:0.18,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    this.classroomShafts = [];
    for (let i=0;i<3;i++) {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(15,1.7),shaftMat);
      beam.rotation.order = 'YXZ'; beam.rotation.y = -0.36; beam.rotation.z = 0.35;
      beam.position.set(4,2.42,-4+i*3); room.add(beam); this.classroomShafts.push(beam);
    }
    const positions = new Float32Array(60*3);
    for (let i=0;i<60;i++) {
      const x = (i*59 % 83)/6 - 3;
      positions.set([x, 0.38*x + (i*23 % 37)/18, (i*41 % 89)/9 - 4.5],i*3);
    }
    const cloud = new THREE.BufferGeometry(); cloud.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.classroomDust = new THREE.Points(cloud,new THREE.PointsMaterial({map:glow,color:0xffd27a,size:0.055,transparent:true,opacity:0.65,blending:THREE.AdditiveBlending,depthWrite:false}));
    room.add(this.classroomDust);
  }


  buildCurtain(room, box, texture, side, sill, lintel, start, end) {
    const map = texture(256, 256, ctx => {
      ctx.fillStyle = '#FFE3A3'; ctx.fillRect(0, 0, 256, 256);
      for (let x = 0; x < 256; x += 32) {
        ctx.fillStyle = '#E8B650'; ctx.fillRect(x + 20, 0, 12, 256);
        ctx.fillStyle = '#FFF1C9'; ctx.fillRect(x + 3, 0, 7, 256);
      }
      ctx.strokeStyle = Theme.ink; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 248, 248);
    });
    const fabric = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
    const ink = new THREE.MeshBasicMaterial({ color: Theme.ink });
    const tieMaterial = new THREE.MeshBasicMaterial({ color: Theme.gold, transparent: true });
    const geometry = new THREE.PlaneGeometry(1, 1), width = (end - start) / 2;
    this.curtainPanels = []; this.curtainTies = [];
    for (let i = 0; i < 2; i++) {
      const panel = new THREE.Mesh(geometry, fabric);
      panel.rotation.y = -Math.PI / 2;
      panel.position.set(side - .55, (sill + lintel) / 2, i ? end - .55 : start + .55);
      panel.scale.set(1.1, lintel - sill, 1);
      panel.userData.openZ = panel.position.z;
      panel.userData.closedZ = start + width * (i + .5);
      room.add(panel); this.curtainPanels.push(panel);
      const tie = box(room, tieMaterial, side - .59, sill + 2.1, panel.position.z, .08, .22, 1.16);
      tie.castShadow = tie.receiveShadow = false; this.curtainTies.push(tie);
    }
    box(room, ink, side - .55, lintel + .25, (start + end) / 2, .16, .16, end - start + .8);
    const hit = box(room, new THREE.MeshBasicMaterial({ visible: false }), side - .7,
      (sill + lintel) / 2, (start + end) / 2, .15, lintel - sill, end - start);
    hit.castShadow = hit.receiveShadow = false;
    hit.userData = { type: 'curtain' }; this.interactiveObjects.push(hit);
    this.curtainWidth = width; this.curtainClosed = false;
  }

  installWindowShadowFade() {
    // Real louvre shadows share the sunlight's opacity; keep existing material programs.
    this.windowShadowFade = { value: 1 };
    const seen = new Set();
    this.scene.traverse(obj => {
      if (!obj.receiveShadow) return;
      for (const mat of (Array.isArray(obj.material) ? obj.material : [obj.material])) {
        if (!mat || seen.has(mat) || mat.isMeshBasicMaterial) continue;
        seen.add(mat);
        const previous = mat.onBeforeCompile;
        mat.onBeforeCompile = (shader, renderer) => {
          previous.call(mat, shader, renderer);
          shader.uniforms.gpWindowLight = this.windowShadowFade;
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
            '#include <common>\nuniform float gpWindowLight;').replace('#include <lights_fragment_begin>',
            THREE.ShaderChunk.lights_fragment_begin.replace(/getShadow\( directionalShadowMap\[ i \],[^;]*?\)/g,
              match => 'mix(1.0, ' + match + ', gpWindowLight)'));
        };
        mat.needsUpdate = true;
      }
    });
  }

  toggleCurtain() {
    if (this.view !== 'seat' || this.curtainAnimating || this.interactionBlocked()) return;
    this.curtainAnimating = true;
    this.curtainClosed = !this.curtainClosed;
    gsap.to(this, {
      windowLight: this.curtainClosed ? .25 : 1, duration: .7, ease: 'power2.inOut',
      onUpdate: () => {
        const light = this.windowLight, closed = (1 - light) / .75;
        this.curtainPanels.forEach(panel => {
          panel.position.z = THREE.MathUtils.lerp(panel.userData.openZ, panel.userData.closedZ, closed);
          panel.scale.x = THREE.MathUtils.lerp(1.1, this.curtainWidth, closed);
        });
        this.curtainTies[0].material.opacity = 1 - closed;
        this.windowSun.intensity = this.windowSunIntensity * light;
        this.classroomShafts[0].material.opacity = .18 * light;
        this.windowGlow.material.opacity = .25 * light;
        this.classroomDust.material.opacity = .65 * light;
        this.windowShadowFade.value = light;
        this.windowSky.material.color.setScalar(light);
        this.windowHorizon.material.color.setScalar(light);
      },
      onComplete: () => {
        this.curtainAnimating = false;
        this.renderer.shadowMap.needsUpdate = true;
      }
    });
  }

  buildWindowView(side,sill,lintel,start,end) {
    const width=(end-start)*1.2,height=(lintel-sill)*1.2;
    // Keep the narrow sea strip above the sill; put most overscan above the opening.
    const bottom=sill-.1, centerZ=(start+end)/2;
    const geometry=new THREE.PlaneGeometry(1,1);
    const make=(x,y,h,color)=>{
      const material=new THREE.MeshBasicMaterial({color,toneMapped:false,fog:false,depthWrite:false});
      const mesh=new THREE.Mesh(geometry,material);
      mesh.rotation.y=-Math.PI/2;mesh.position.set(x,y,centerZ);mesh.scale.set(width,h,1);
      mesh.raycast=()=>{};this.scene.add(mesh);return mesh;
    };
    const horizonHeight=height*(1-Theme.HORIZON_Y),skyHeight=height*Theme.HORIZON_Y;
    this.windowSky=make(side+.42,bottom+horizonHeight+skyHeight/2,skyHeight,Theme.amber);
    this.windowHorizon=make(side+.40,bottom+horizonHeight/2,horizonHeight,Theme['sun-glow']);
    this.windowCenterZ=centerZ;
    this.skyDriftEnabled=Theme.config.skyDrift;
    this.skyMotionPreference=matchMedia('(prefers-reduced-motion: reduce)');
    Theme.windowTextures().then(layers=>{
      this.windowSky.material.map=layers.sky;this.windowHorizon.material.map=layers.horizon;
      for(const mesh of [this.windowSky,this.windowHorizon]) {mesh.material.color.setScalar(this.windowLight);mesh.material.needsUpdate=true;}
      this.windowSkyTexture=layers.sky;this.windowSource=layers.source;
    }).catch(()=>{});
    const glow=make(side-.22,(sill+lintel)/2,lintel-sill,Theme['sun-glow']);
    glow.scale.x=end-start;glow.material.transparent=true;glow.material.opacity=.25;
    glow.material.blending=THREE.AdditiveBlending;glow.renderOrder=1;
    this.windowGlow = glow;
  }

  updateWindowView(seconds) {
    if(!this.windowSky) return;
    const yaw=this.rig.yaw;
    this.windowSky.position.z=this.windowCenterZ-yaw*.04;
    this.windowHorizon.position.z=this.windowCenterZ-yaw*.015;
    if(this.windowSkyTexture&&this.skyDriftEnabled&&!this.skyMotionPreference.matches) {
      // Two mirrored repeats keep wraparound continuous at the boundary.
      this.windowSkyTexture.offset.x=(seconds*.004)%2;
      this.windowSkyTexture.offset.y=Math.sin(seconds*.12)*.004;
    }
  }

  drawTVSlide(index) {
    this.tvIndex = index;
    const ctx = this.tvTexture.image.getContext('2d');
    ctx.fillStyle = Theme.cream; ctx.fillRect(0,0,768,432);
    Theme.drawTitle(ctx,this.classroom.tvSlides[index],64,245,640);
    ctx.fillStyle = Theme.sun; ctx.fillRect(64,125,120,40);
    ctx.fillStyle = Theme.ink; ctx.font='26px "Patrick Hand", "Comic Sans MS", sans-serif';
    ctx.fillText(this.classroom.board.subtitle,72,153,104);
    this.tvTexture.needsUpdate = true;
  }

  buildTeacher(room, floor, box, paint, texture) {
    const desk = paint(Theme['wood-dark']), black = paint(Theme.ink), mint = paint(0x9bd36b);
    const teacherChair = this.teacherChair = new THREE.Group(); room.add(teacherChair);
    teacherChair.position.set(0,0,-.68);
    box(teacherChair,mint,0,floor+1.74,-13.44,1.82,.18,1.4);
    box(teacherChair,mint,0,floor+3.05,-14.02,1.82,2.4,.16);
    const chairStripe = paint(0xfffdf6);
    for (const x of [-.48,-.24,0,.24,.48]) box(teacherChair,chairStripe,x,floor+3.35,-13.92,.09,1.28,.02);
    for (const x of [-.7,.7]) for (const z of [-14,-12.9]) box(teacherChair,mint,x,floor+.86,z,.15,1.72,.15);

    const person = new THREE.Group();
    person.position.set(0,floor - 1.5,-14.22); person.rotation.y = 0;
    this.teacher = person;
    person.userData.type = 'teacher'; room.add(person); 
    const skin = paint(0xb98058), slacks = paint(0x35373d), hair = paint(0x242021);
    this.teacherJacket = paint(Theme.ink);
    const oval = (parent, material, x,y,z, w,h,d) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1,10,8),material);
      mesh.position.set(x,y,z); mesh.scale.set(w,h,d);
      mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const limb = (parent, material,x,y,z,top,bottom,height) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,10),material);
      mesh.position.set(x,y,z); parent.add(mesh); mesh.castShadow = true; return mesh;
    };
    for (const x of [-0.43,0.43]) {
      box(person,black,x,1.64,1.55,0.69,0.48,1.08);
      const thigh = limb(person,slacks,x,3.12,.72,.45,.31,2.98);
      thigh.scale.y = .5; thigh.rotation.x = Math.PI / 2;
      const shin = new THREE.Mesh(thigh.geometry, slacks);
      shin.position.set(x,2.34,1.45); shin.scale.y = .5;
      shin.castShadow = true; person.add(shin);
    }
    const torso = this.teacherTorso = new THREE.Group(); torso.position.y=3.15; person.add(torso);
    limb(torso,this.teacherJacket,0,1.08,0,1.02,0.84,2.2).scale.z=0.64;
    box(torso,paint(0xece7db),0,1.12,0.57,0.65,1.95,0.09);
    for (const side of [-1,1]) {
      const arm = new THREE.Group(); arm.position.set(side === 1 ? .58 : -.94,1.94,0); torso.add(arm);
      const upper = limb(arm,this.teacherJacket,side*.08,-.15,.33,.32,.23,1.45);
      upper.scale.y = .5; upper.rotation.x = -1.16;
      const forearm = new THREE.Mesh(upper.geometry, this.teacherJacket);
      forearm.scale.set(.8,.45,.8); forearm.rotation.x = Math.PI / 2;
      forearm.position.set(side*.08,-.24,.98); forearm.castShadow = true; arm.add(forearm);
      oval(arm,skin,side*.08,-.24,1.36,.23,.21,.32);
      if (side === -1) this.teacherArm = arm;
      box(torso,black,side*0.16,1.5,0.66,0.045,0.98,0.035).rotation.z=-side*0.32;
    }
    const badge = texture(256,112,ctx => {
      ctx.fillStyle='#f7f2db';ctx.fillRect(0,0,256,112);ctx.fillStyle='#184b40';ctx.fillRect(0,0,256,18);
      ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillText('SEAN DYOGI',128,76,234);
    });
    box(torso,new THREE.MeshStandardMaterial({map:badge}),0,0.9,0.71,0.56,0.32,0.045);
    limb(torso,skin,0,2.22,0,0.29,0.32,0.46);
    const head = this.teacherHead = new THREE.Group();head.position.y=2.92;torso.add(head);
    oval(head,skin,0,0,0,0.66,0.91,0.61);
    oval(head,hair,0,0.55,-0.05,0.69,0.5,0.64);
    oval(head,skin,0,-0.06,0.59,0.12,0.16,0.14);
    this.teacherEyes = [];
    for (const x of [-0.27,0.27]) {
      this.teacherEyes.push(oval(head,black,x,0.11,0.563,0.068,0.073,0.04));
      for (const dy of [-0.14,0.14]) box(head,black,x,0.11+dy,0.596,0.46,0.045,0.055);
      for (const dx of [-0.21,0.21]) box(head,black,x+dx,0.11,0.596,0.045,0.3,0.055);
      box(head,black,Math.sign(x)*0.51,0.11,0.33,0.045,0.045,0.55);
    }
    box(head,black,0,0.14,0.60,0.14,0.04,0.05);
    // Four scene units per metre. Reuse the unit cube from the room builder.
    const hitbox = box(person, new THREE.MeshBasicMaterial({ visible: false }), 0, 4.45, .6, 3.2, 5.2, 2.4);
    this.interactiveObjects.push(hitbox);
    hitbox.castShadow = hitbox.receiveShadow = false;
    person.traverse(child => {
      if (child.isMesh) Object.assign(child.userData, { type: 'teacher', interactive: true });
    });
    this.speechAnchor = new THREE.Object3D();this.speechAnchor.position.y=1.23;head.add(this.speechAnchor);
    this.speechPoint = new THREE.Vector3();
    this.speechIndex=0; this.speechUntil=0;
    this.teacherBubble=document.createElement('div');
    this.teacherBubble.className='teacher-speech'; this.teacherBubble.setAttribute('role','status');
    document.body.appendChild(this.teacherBubble);
  }

  updateFrontWall(seconds) {
    const index=Math.floor((seconds*1000-this.tvStart)/4000) % this.classroom.tvSlides.length;
    if (index !== this.tvIndex) this.drawTVSlide(index);
    this.teacherTorso.scale.y=1+0.005*Math.sin(seconds*2);
    this.teacherHead.rotation.z=0.026*Math.sin(seconds*0.8);
    // Seated forearms remain resting on the desk.
    const blink=Math.abs((seconds%4.8)-2.4);
    for (const eye of this.teacherEyes) eye.scale.y=0.073*Math.min(1,blink/0.085);
    if (this.view !== 'seat' || this.interactionBlocked()) { this.hideSean(); return; }
    if (!this.speechUntil) return;
    if (seconds*1000 >= this.speechUntil) {
      this.teacherBubble.classList.remove('visible'); this.speechUntil=0; return;
    }
    this.camera.updateMatrixWorld();
    this.speechAnchor.getWorldPosition(this.speechPoint).project(this.camera);
    const p=this.speechPoint, rect=this.renderer.domElement.getBoundingClientRect();
    const half = this.teacherBubble.offsetWidth / 2 + 8;
    this.teacherBubble.style.left = THREE.MathUtils.clamp(rect.left + (p.x + 1) * rect.width / 2, half, window.innerWidth - half) + 'px';
    this.teacherBubble.style.top = THREE.MathUtils.clamp(rect.top + (1 - p.y) * rect.height / 2, this.teacherBubble.offsetHeight + 8, window.innerHeight - 8) + 'px';
    this.teacherBubble.classList.toggle('visible', Math.abs(p.z)<1 && !this.isCameraZoomed);
  }

  moveTableContents(roomObjects) {
    // Includes Theme's name tags, dashed trail/X and existing table graffiti decals.
    for (const obj of [...this.scene.children]) {
      if (roomObjects.has(obj)) continue;
      if (obj.position.y === .215) { obj.position.z = .87; obj.position.y = .38; }
      this.deskGroup.add(obj);
    }
    this.deskGroup.position.set(0,0,-11.55);
    this.deskGroup.rotation.y = Math.PI;
    const hit = new THREE.Mesh(this.deskGroup.children[0].geometry, new THREE.MeshBasicMaterial({ visible:false }));
    hit.scale.set(1,.5,.99); hit.position.y = .08;
    hit.userData.type = 'front-desk';
    this.deskGroup.add(hit);
    this.deskHit = hit; this.interactiveObjects.push(hit);
    this.deskGroup.updateMatrixWorld(true);
  }

  tabletopObject(obj) {
    for (let node = obj; node; node = node.parent) if (node === this.deskGroup) return true;
    return false;
  }

  pickInteraction(intersects) {
    const first = intersects[0];
    if (!first) return null;
    if (this.view === 'seat') {
      // A visible item occludes the desk below it, but cannot open from the seat.
      const sean = intersects.find(hit => hit.object.userData.type === 'teacher');
      if (sean) return sean;
      if (this.tabletopObject(first.object)) return { object: this.deskHit };
      return first;
    }
    return intersects.find(hit => hit.object.userData.type === 'folder') || intersects.find(hit => hit.object.userData.type !== "front-desk" && this.tabletopObject(hit.object)) || null;
  }

  enterDeskView() {
    if (this.view !== 'seat' || this.interactionBlocked()) return;
    this.storedSeatPose = this.rig.capturePose();
    const pose = CameraRig.DESK_POSE;
    const height = 6.3 / (this.camera.aspect * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.glideTo({ ...pose, y: Math.max(4.7,height) + .3 }, 1.2, 'desk');
  }

  backToSeat() {
    if (this.view !== 'desk' || this.interactionBlocked()) return;
    this.glideTo(this.storedSeatPose, 1, 'seat');
  }

  glideTo(pose, duration, view) {
    this.viewTween?.kill();
    this.view = 'gliding'; this.backButton.hidden = true;
    this.rig.setInputEnabled(false);
    this.isDraggingView = false; this.hasDraggedMeaningfully = false;
    this.pendingHover = null; this.resetHoverState(); this.hideSean();
    const state = this.rig.capturePose();
    const yaw = state.yaw + Math.atan2(Math.sin(pose.yaw-state.yaw), Math.cos(pose.yaw-state.yaw));
    this.viewTween = gsap.to(state, {
      x: pose.x, y: pose.y, z: pose.z, yaw, pitch: pose.pitch,
      duration, ease: 'power2.inOut', onUpdate: () => this.rig.applyPose(state),
      onComplete: () => {
        this.viewTween.kill(); this.viewTween = null;
        this.rig.applyPose(pose); this.view = view;
        this.rig.setInputEnabled(view === 'seat' && this.inputEnabled);
        this.backButton.hidden = view !== 'desk';
        this.renderer.shadowMap.needsUpdate = true;
      }
    });
  }

  buildDesk() {
    this.deskGroup = new THREE.Group();

    // Wooden tabletop
    const deskGeo = new THREE.BoxGeometry(10.5, 0.35, 6.2);
    const deskMat = new THREE.MeshBasicMaterial({ map: Theme.woodTexture(), toneMapped:false });
    const deskMesh = new THREE.Mesh(deskGeo, deskMat);
    deskMesh.receiveShadow = true;
    this.deskGroup.add(deskMesh);

    // Desk edge trim
    const trimGeo = new THREE.BoxGeometry(10.6, 0.4, 6.3);
    const trimMat = Theme.toon(Theme['wood-dark']);
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.y = -0.04;
    this.deskGroup.add(trimMesh);

    // Desk legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 2.65, 12);
    const legMat = Theme.toon(Theme.ink);
    const legPositions = [
      [-4.8, -1.515, -2.6],
      [4.8, -1.515, -2.6],
      [-4.8, -1.515, 2.6],
      [4.8, -1.515, 2.6]
    ];
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(pos[0], pos[1], pos[2]);
      leg.castShadow = true;
      this.deskGroup.add(leg);
    });

    // Desk mat
    const matGeo = new THREE.BoxGeometry(9.2, 0.02, 4.6);
    const matMaterial = new THREE.MeshBasicMaterial({ map: Theme.woodTexture(), toneMapped:false });
    const mat = new THREE.Mesh(matGeo, matMaterial);
    mat.position.set(0, 0.18, 0.2);
    mat.receiveShadow = true;
    this.deskGroup.add(mat);

    this.scene.add(this.deskGroup);
  }

  createFolderTexture(label, name, coverColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 700;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = coverColor || '#FF7A00';
    ctx.fillRect(0, 0, 512, 700);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, 60, 700);

    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 12;
    ctx.fillRect(80, 100, 350, 480);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 4;
    ctx.strokeRect(90, 110, 330, 460);

    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('AET PORTFOLIO CASE', 115, 155);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(name.toUpperCase(), 115, 230, 370);

    ctx.strokeStyle = coverColor || '#FF7A00';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(115, 255);
    ctx.lineTo(395, 255);
    ctx.stroke();

    ctx.fillStyle = '#DC2626';
    ctx.font = 'italic bold 22px monospace';
    const cleanLabel = label || 'FINAL_v7_dontopen';
    ctx.fillText(cleanLabel.length > 20 ? cleanLabel.substring(0, 20) : cleanLabel, 115, 310);
    if (cleanLabel.length > 20) {
      ctx.fillText(cleanLabel.substring(20, 40), 115, 340);
    }

    ctx.fillStyle = '#000000';
    for (let x = 120; x < 380; x += 6) {
      const barW = (x % 12 === 0) ? 4 : 2;
      ctx.fillRect(x, 480, barW, 45);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }

  createFolderMesh(member) {
    const folderGeo = new THREE.BoxGeometry(1.15, 0.08, 1.55);

    const topTexture = this.createFolderTexture(member.folderLabel, member.name, member.coverColor);
    const spineColor = new THREE.Color(member.coverColor || '#FF7A00').multiplyScalar(0.7);

    const materials = [
      new THREE.MeshStandardMaterial({ color: spineColor }),
      new THREE.MeshStandardMaterial({ color: spineColor }),
      new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: spineColor }),
      new THREE.MeshStandardMaterial({ color: 0xFFFFFF }),
      new THREE.MeshStandardMaterial({ color: spineColor })
    ];

    return new THREE.Mesh(folderGeo, materials);
  }

  createSpiralNotebook(member) {
    const notebook = new THREE.Group();
    const board = new THREE.MeshStandardMaterial({ color: 0x142647, roughness: 0.85 });
    const sheets = new THREE.MeshStandardMaterial({ color: 0xf7f3df, roughness: 1 });
    for (const [width, height, length, y, material] of [
      [1, 0.012, 1.4, -0.054, board],
      [0.98, 0.096, 1.38, 0, sheets],
      [1, 0.012, 1.4, 0.054, board]
    ]) {
      const layer = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
      layer.position.y = y;
      layer.castShadow = layer.receiveShadow = true;
      notebook.add(layer);
    }
    const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(0.068, 0.009, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0x363c4c, metalness: 0.68, roughness: 0.32 }), 20);
    for (let i = 0; i < rings.count; i++) {
      rings.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-0.474, 0, -0.637 + i * 0.067));
    }
    rings.castShadow = true;
    notebook.add(rings);

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1120;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#142647';
    ctx.fillRect(0, 0, 800, 1120);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.4),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82 }));
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.061;
    face.receiveShadow = true;
    notebook.add(face);

    const art = new Image();
    const avatar = new Image();
    function drawCover() {
      if (art.naturalWidth) ctx.drawImage(art, 0, 0, 800, 1120);
      ctx.save();
      ctx.translate(280, 430);
      ctx.scale(0.61, 0.61);
      ctx.beginPath();
      ctx.roundRect(156, 790, 602, 282, 30);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 16;
      ctx.strokeStyle = '#36cfea';
      ctx.stroke();
      ctx.fillStyle = '#7132aa';
      ctx.font = '900 58px sans-serif';
      ctx.fillText('PORTFOLIO', 327, 875, 395);
      ctx.fillStyle = '#f179ad';
      ctx.fillRect(324, 890, 391, 8);
      ctx.fillStyle = '#21713d';
      ctx.font = 'bold 38px sans-serif';
      ctx.fillText(member.name, 326, 955, 397);
      ctx.fillStyle = '#405478';
      ctx.font = 'bold 25px sans-serif';
      ctx.fillText('SECTION  ' + (member.section || ''), 326, 1015);
      ctx.fillStyle = '#ec9b25';
      ctx.font = '48px sans-serif';
      ctx.fillText('★', 251, 1034);
      if (avatar.naturalWidth) ctx.drawImage(avatar, 181, 838, 126, 145);
      ctx.restore();
      texture.needsUpdate = true;
    }
    art.onload = avatar.onload = drawCover;
    art.src = 'assets/textures/aldub-cover.png';
    avatar.src = member.photo || 'assets/photos/member1.svg';
    drawCover();
    return notebook;
  }

  createIntermediatePad(member) {
    const pad = new THREE.Group();
    const cream = new THREE.MeshStandardMaterial({ color: 0xfff5d8, roughness: 1 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xe1d7bb, roughness: 1 });
    const glue = new THREE.MeshStandardMaterial({ color: 0x365b55, roughness: 0.88 });
    function layer(w, h, d, y, z, material) {
      const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      part.position.set(0, y, z);
      part.castShadow = part.receiveShadow = true;
      pad.add(part);
    }
    for (let i = 0; i < 14; i++) {
      layer(1 - (i % 3) * 0.002, 0.01, 1.25, -0.07 + 0.01 * i, 0, i % 3 ? cream : edge);
    }
    layer(1, 0.01, 1.25, 0.07, 0, cream);
    layer(1, 0.15, 0.025, 0, -0.6126, glue);

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    const map = new THREE.CanvasTexture(canvas);
    map.anisotropy = 4;
    const art = new Image();
    function draw() {
      ctx.fillStyle = '#fff9e8';
      ctx.fillRect(0, 0, 800, 1000);
      if (art.naturalWidth) ctx.drawImage(art, 0, 0, 800, 1000);
      ctx.font = '43px "Patrick Hand", cursive';
      ctx.fillStyle = '#21457a';
      [member.name, member.school, member.grade, member.section].forEach((value, i) => {
        if (value) ctx.fillText(value, 232, 675 + 70 * i, 495);
      });
      map.needsUpdate = true;
    }
    art.onload = draw;
    art.src = 'assets/textures/pad-cover.png';
    document.fonts.load('43px "Patrick Hand"').then(draw).catch(() => {});
    draw();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.25),
      new THREE.MeshStandardMaterial({ map, roughness: 0.91 }));
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.0755;
    pad.add(face);
    return pad;
  }

  createLongFolder(member) {
    const folder = new THREE.Group();
    const card = new THREE.MeshStandardMaterial({ color: 0xfffdfa, roughness: 0.96 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    function cardLayer(parent, width, height, length, x, y, z, material) {
      const part = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
      part.position.set(x, y, z);
      part.castShadow = part.receiveShadow = true;
      parent.add(part);
    }
    cardLayer(folder, 1, 0.014, 1.53, 0, -0.021, 0, card);
    cardLayer(folder, 0.34, 0.014, 0.09, 0.27, -0.021, -0.796, card);
    for (let i = 0; i < 6; i++) {
      cardLayer(folder, 0.94, 0.004, 1.45, (i % 3) * 0.004, -0.011 + i * 0.004, 0, paper);
    }
    const hinge = new THREE.Group();
    hinge.name = 'long-folder-hinge';
    hinge.position.set(-0.5, 0.018, 0);
    folder.add(hinge);
    folder.scale.set(1.18, 1, 1.18);
    cardLayer(hinge, 1, 0.012, 1.53, 0.5, 0, 0, card);

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1224;
    const ctx = canvas.getContext('2d');
    const map = new THREE.CanvasTexture(canvas);
    map.anisotropy = 4;
    const border = new Image();
    function draw() {
      ctx.fillStyle = '#fffdfa';
      ctx.fillRect(0, 0, 800, 1224);
      if (border.naturalWidth) ctx.drawImage(border, 22, 26, 756, 1172);
      ctx.beginPath();
      ctx.roundRect(105, 460, 590, 185, 30);
      ctx.fillStyle = '#fff2f6';
      ctx.fill();
      ctx.strokeStyle = '#d99caf';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#423942';
      ctx.textAlign = 'center';
      ctx.font = '600 48px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(member.name, 400, 571, 540);
      ctx.font = '30px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Do Not Open (Seriously)', 400, 1070);
      map.needsUpdate = true;
    }
    border.onload = draw;
    border.src = 'assets/borders/wavy-pink.svg';
    draw();
    document.fonts.load('600 48px "Plus Jakarta Sans"').then(draw).catch(() => {});
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.53),
      new THREE.MeshStandardMaterial({ map, roughness: 0.96 }));
    face.rotation.x = -Math.PI / 2;
    face.position.set(0.5, 0.0065, 0);
    hinge.add(face);
    return folder;
  }

  createThemeBook(member) {
    const book = new THREE.Group();
    const lacquer = new THREE.MeshStandardMaterial({ color: 0x21589b, roughness: 0.23 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xf4efdf, roughness: 0.95 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9c3ce, metalness: 0.75, roughness: 0.28 });
    function addBox(w, h, d, x, y, z, material) {
      const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      part.position.set(x, y, z);
      part.castShadow = part.receiveShadow = true;
      book.add(part);
    }
    addBox(1.10, 0.008, 1.54, 0, -0.036, 0, lacquer);
    addBox(1.082, 0.064, 1.522, 0, 0, 0, paper);
    addBox(1.10, 0.008, 1.54, 0, 0.036, 0, lacquer);
    addBox(0.016, 0.08, 1.54, -0.542, 0, 0, lacquer);
    for (const z of [-0.42, 0.42]) {
      addBox(0.012, 0.009, 0.105, -0.515, 0.044, z, steel);
      for (const end of [-0.048, 0.048]) {
        addBox(0.012, 0.025, 0.009, -0.515, 0.033, z + end, steel);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = 840;
    canvas.height = 1160;
    const ctx = canvas.getContext('2d');
    const cover = new Image();
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    const draw = () => {
      ctx.fillStyle = '#21589b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (cover.naturalWidth) ctx.drawImage(cover, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#071e50';
      ctx.font = '600 35px "Dancing Script", cursive';
      ctx.fillText(member.name, 232, 866, 500);
      ctx.fillText(member.section || '', 345, 913, 385);
      texture.needsUpdate = true;
    };
    cover.onload = draw;
    cover.src = 'assets/textures/themebook-cover.png';
    draw();
    document.fonts.load('600 35px "Dancing Script"').then(draw).catch(() => {});
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.10, 1.54),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.24 }));
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.0405;
    face.receiveShadow = true;
    book.add(face);
    return book;
  }

  buildFolders() {
    this.folders = [];
    const membersList = this.members.length ? this.members : [
      {
            "id": 1,
            "name": "Riam Jaye Santiago",
            "deskItem": "spiral-notebook",
            "tagline": "Emerging technologies, emerging deadlines",
            "folderLabel": "FINAL_v7_REALLYFINAL_dontopen",
            "coverColor": "#FF7A00"
      },
      {
            "id": 2,
            "name": "John Vernie Dela Cruz",
            "deskItem": "long-folder",
            "tagline": "Powered by coffee, panic, and StackOverflow",
            "folderLabel": "Do Not Open (Seriously)",
            "coverColor": "#8B5CF6"
      },
      {
            "id": 3,
            "name": "Charella Magalpoc",
            "section": "BSIT 3-1",
            "deskItem": "theme-book",
            "tagline": "99% skill, 1% luck, 100% procrastination",
            "folderLabel": "Homework (Unfinished)",
            "coverColor": "#0284C7"
      },
      {
            "id": 4,
            "name": "Nicole De Guzman",
            "section": "BSIT 3-1",
            "deskItem": "intermediate-pad",
            "tagline": "My code works, but nobody knows why (especially me)",
            "folderLabel": "secret_thesis_do_not_delete",
            "coverColor": "#059669"
      }
];


    membersList.forEach((member, i) => {
      const layout = tabletopLayout.find(entry => entry.item === member.deskItem) || tabletopLayout.filter(entry => entry.item !== 'laptop')[i % 4];
      let folderMesh;
      switch (member.deskItem) {
        case 'intermediate-pad': folderMesh = this.createIntermediatePad(member); break;
        case 'long-folder': folderMesh = this.createLongFolder(member); break;
        case 'theme-book': folderMesh = this.createThemeBook(member); break;
        case 'spiral-notebook': folderMesh = this.createSpiralNotebook(member); break;
        default: folderMesh = this.createFolderMesh(member);
      }
      const posY = 0.22 + i * 0.01;
      folderMesh.scale.multiplyScalar(1.25);
      folderMesh.position.set(layout.x, posY, layout.z);
      folderMesh.rotation.set(0, layout.yaw, 0);
      folderMesh.castShadow = true;
      folderMesh.receiveShadow = true;

      folderMesh.userData = {
        type: 'folder',
        memberId: member.id,
        member: member,
        index: i,
        originalPos: { x: layout.x, y: posY, z: layout.z },
        originalRot: { x: 0, y: layout.yaw, z: 0 }
      };

      // Full-coverage generous hit-box mesh on Layer 1 (raycaster-only, never rendered by camera)
      // Proportionally covers the book without spilling into sticky notes behind
      const hitBoxGeo = new THREE.BoxGeometry(1.3, 0.35, 1.65);
      const hitBoxMat = new THREE.MeshBasicMaterial();
      const folderHitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
      folderHitBox.layers.set(1);  // Layer 1 = invisible to camera, visible to raycaster
      folderHitBox.position.set(0, 0.18, 0);
      folderHitBox.userData = {
        type: 'folder',
        memberId: member.id,
        member: member,
        folderMesh: folderMesh
      };
      folderMesh.add(folderHitBox);

      this.scene.add(folderMesh);
      this.folders.push({
        mesh: folderMesh,
        hitBox: folderHitBox,
        member: member,
        originalPos: { x: layout.x, y: posY, z: layout.z },
        originalRot: { x: 0, y: layout.yaw, z: 0 }
      });

      this.interactiveObjects.push(folderHitBox);
    });
  }

  buildProps() {
    // 1. LAPTOP (Whole laptop is 100% clickable)
    const laptopGroup = new THREE.Group();
    const baseGeo = new THREE.BoxGeometry(2.2, 0.06, 1.6);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.25 });
    const laptopBase = new THREE.Mesh(baseGeo, metalMat);
    laptopBase.castShadow = true;
    laptopBase.userData = { type: 'laptop' };
    laptopGroup.add(laptopBase);

    const lidGeo = new THREE.BoxGeometry(2.2, 1.45, 0.05);
    const laptopLid = new THREE.Mesh(lidGeo, metalMat);
    laptopLid.position.set(0, 0.72, -0.78);
    laptopLid.rotation.x = 0.18;
    laptopLid.castShadow = true;
    laptopLid.userData = { type: 'laptop' };
    laptopGroup.add(laptopLid);

    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 512;
    screenCanvas.height = 320;
    const sCtx = screenCanvas.getContext('2d');
    sCtx.fillStyle = '#0F172A';
    sCtx.fillRect(0, 0, 512, 320);

    sCtx.fillStyle = '#38BDF8';
    sCtx.font = '16px monospace';
    sCtx.fillText('const coffee = require("caffeine");', 25, 40);
    sCtx.fillText('async function finishDegree() {', 25, 65);
    sCtx.fillStyle = '#F43F5E';
    sCtx.fillText('  throw new Error("Motivation.exe crashed");', 25, 90);
    sCtx.fillStyle = '#38BDF8';
    sCtx.fillText('}', 25, 115);

    sCtx.fillStyle = '#EF4444';
    sCtx.fillRect(25, 150, 460, 130);
    sCtx.fillStyle = '#FFFFFF';
    sCtx.font = 'bold 22px sans-serif';
    sCtx.fillText('System Error: Motivation.exe crashed', 45, 195);
    sCtx.font = '16px sans-serif';
    sCtx.fillText('Click anywhere to restart motivation...', 45, 235);

    const screenTex = new THREE.CanvasTexture(screenCanvas);
    const screenGeo = new THREE.PlaneGeometry(2.05, 1.3);
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, 0.72, -0.75);
    screenMesh.rotation.x = 0.18;
    screenMesh.userData = { type: 'laptop' };
    laptopGroup.add(screenMesh);

    // Full-coverage hit box for laptop on Layer 1 (camera-invisible, raycaster-visible)
    const laptopHitBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 2.2, 2.4),
      new THREE.MeshBasicMaterial()
    );
    laptopHitBox.layers.set(1);
    laptopHitBox.position.set(0, 0.85, -0.6);
    laptopHitBox.userData = { type: 'laptop' };
    laptopGroup.add(laptopHitBox);

    const layout = tabletopLayout.find(entry => entry.item === 'laptop');
    laptopGroup.scale.multiplyScalar(1.25);
    laptopGroup.position.set(layout.x, 0.22, layout.z);
    laptopGroup.rotation.y = layout.yaw;

    laptopGroup.userData = { type: 'laptop' };
    this.scene.add(laptopGroup);




    this.interactiveObjects.push(laptopHitBox);
    this.laptop = laptopGroup;

    // 2. COFFEE CUP (Whole mug, handle, liquid, and puddle are 100% clickable)
    const cupGroup = new THREE.Group();
    const cupGeo = new THREE.CylinderGeometry(0.35, 0.28, 0.75, 24);
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.2 });
    const cupMesh = new THREE.Mesh(cupGeo, cupMat);
    cupMesh.position.y = 0.375;
    cupMesh.castShadow = true;
    cupMesh.userData = { type: 'coffee' };
    cupGroup.add(cupMesh);

    const liquidGeo = new THREE.CircleGeometry(0.32, 24);
    const liquidMat = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.1 });
    const liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    liquidMesh.rotation.x = -Math.PI / 2;
    liquidMesh.position.y = 0.72;
    liquidMesh.userData = { type: 'coffee' };
    cupGroup.add(liquidMesh);

    const handleGeo = new THREE.TorusGeometry(0.18, 0.05, 12, 24, Math.PI);
    const handleMesh = new THREE.Mesh(handleGeo, cupMat);
    handleMesh.position.set(0.38, 0.38, 0);
    handleMesh.rotation.z = -Math.PI / 2;
    handleMesh.userData = { type: 'coffee' };
    cupGroup.add(handleMesh);

    // Full-coverage hit box for coffee cup on Layer 1 (camera-invisible, raycaster-visible)
    const coffeeHitBox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 1.5, 16),
      new THREE.MeshBasicMaterial()
    );
    coffeeHitBox.layers.set(1);
    coffeeHitBox.position.set(0.1, 0.5, 0);
    coffeeHitBox.userData = { type: 'coffee' };
    cupGroup.add(coffeeHitBox);

    cupGroup.position.set(5.45, .2, .15);
    cupGroup.userData = { type: 'coffee' };
    this.scene.add(cupGroup);




    this.interactiveObjects.push(coffeeHitBox);
    this.coffeeCup = cupGroup;

    // Coffee Puddle (Clickable to trigger or clean up)
    const puddleGeo = new THREE.CircleGeometry(1.0, 32);
    const puddleMat = new THREE.MeshStandardMaterial({
      color: 0x3E2723,
      roughness: 0.2,
      transparent: true,
      opacity: 0.88
    });
    this.puddle = new THREE.Mesh(puddleGeo, puddleMat);
    this.puddle.rotation.x = -Math.PI / 2;
    this.puddle.position.set(5.15,.2,0);
    this.puddle.scale.set(0, 0, 0);
    this.puddle.userData = { type: 'coffee' };
    this.scene.add(this.puddle);
    this.interactiveObjects.push(this.puddle);

    // 3. "DO NOT TOUCH" STICKY NOTE (With easy Easter Egg trigger!)
    const stickyCanvas = document.createElement('canvas');
    stickyCanvas.width = 256;
    stickyCanvas.height = 256;
    const nCtx = stickyCanvas.getContext('2d');
    nCtx.fillStyle = '#FEF08A';
    nCtx.fillRect(0, 0, 256, 256);

    nCtx.fillStyle = '#DC2626';
    nCtx.font = 'bold 30px sans-serif';
    nCtx.textAlign = 'center';
    nCtx.fillText('DO NOT', 128, 80);
    nCtx.fillText('TOUCH!', 128, 125);
    nCtx.font = 'bold 16px sans-serif';
    nCtx.fillStyle = '#4B5563';
    nCtx.fillText('(Double-click = Zero-G)', 128, 175);
    nCtx.font = 'italic 14px sans-serif';
    nCtx.fillStyle = '#6B7280';
    nCtx.fillText('Press "E" anytime!', 128, 210);

    const stickyTex = new THREE.CanvasTexture(stickyCanvas);
    const stickyGeo = new THREE.PlaneGeometry(0.75, 0.75);
    const stickyMat = new THREE.MeshStandardMaterial({ map: stickyTex, roughness: 0.8 });
    const stickyNote = new THREE.Mesh(stickyGeo, stickyMat);
    stickyNote.rotation.x = -Math.PI / 2;
    stickyNote.rotation.z = -0.15;
    stickyNote.scale.setScalar(.5); stickyNote.position.set(-4.7,.21,-2.15);
    stickyNote.userData = { type: 'dont-touch-note' };

    // Elevated Layer 1 hitbox for dont-touch-note
    const dontTouchHitBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.45, 0.9),
      new THREE.MeshBasicMaterial()
    );
    dontTouchHitBox.layers.set(1);
    dontTouchHitBox.position.set(0, 0, 0.15);
    dontTouchHitBox.userData = { type: 'dont-touch-note' };
    stickyNote.add(dontTouchHitBox);

    this.scene.add(stickyNote);

    this.interactiveObjects.push(dontTouchHitBox);
    this.dontTouchNote = stickyNote;

    // 4. DESK CALENDAR
    const calCanvas = document.createElement('canvas');
    calCanvas.width = 256;
    calCanvas.height = 256;
    const cCtx = calCanvas.getContext('2d');
    cCtx.fillStyle = '#FFFFFF';
    cCtx.fillRect(0, 0, 256, 256);
    cCtx.fillStyle = '#EF4444';
    cCtx.fillRect(0, 0, 256, 60);
    cCtx.fillStyle = '#FFFFFF';
    cCtx.font = 'bold 26px sans-serif';
    cCtx.textAlign = 'center';
    cCtx.fillText('OCTOBER', 128, 42);

    cCtx.fillStyle = '#0F172A';
    cCtx.font = 'bold 64px sans-serif';
    cCtx.fillText('TODAY', 128, 140);

    cCtx.strokeStyle = '#EF4444';
    cCtx.lineWidth = 8;
    cCtx.beginPath();
    cCtx.arc(128, 130, 75, 0, Math.PI * 2);
    cCtx.stroke();

    cCtx.fillStyle = '#DC2626';
    cCtx.font = 'bold 20px monospace';
    cCtx.fillText('DEADLINE!', 128, 225);

    const calTex = new THREE.CanvasTexture(calCanvas);
    const calGeo = new THREE.PlaneGeometry(0.8, 0.8);
    const calMat = new THREE.MeshStandardMaterial({ map: calTex });
    const calendar = new THREE.Mesh(calGeo, calMat);
    calendar.rotation.x = -Math.PI / 2;
    calendar.rotation.z = 0.25;
    calendar.scale.setScalar(.65); calendar.position.set(-4.7,.21,1.95);
    this.scene.add(calendar);
  }

  buildStickyNotes() {
    this.deskStickyNotes = [];
    const colors = ['#FEF08A', '#FBCFE8', '#BAE6FD', '#BBF7D0', '#DDD6FE'];
    const notesToPlace = this.notes.slice(-6);
    notesToPlace.forEach((n, idx) => {
      this.addStickyNoteToDesk(n, idx, colors[idx % colors.length]);
    });
  }

  addStickyNoteToDesk(note, slotIndex = 0, color = '#FEF08A') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 18px sans-serif';
    const author = note.author || 'Visitor';
    ctx.fillText(`“${author}”:`, 15, 45);

    ctx.font = '16px sans-serif';
    const text = note.text || '';
    const words = text.split(' ');
    let line = '';
    let y = 80;
    for (let w of words) {
      const testLine = line + w + ' ';
      if (ctx.measureText(testLine).width > 220) {
        ctx.fillText(line, 15, y);
        line = w + ' ';
        y += 24;
        if (y > 220) break;
      } else {
        line = testLine;
      }
    }
    if (line && y <= 220) {
      ctx.fillText(line, 15, y);
    }

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(0.65, 0.65);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);

    const xPos = [-4.35, -3.55, -2.75, 2.75, 3.55, 4.35][slotIndex % 6];
    const zPos = -1.7;
    const rot = (Math.random() - 0.5) * 0.4;

    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rot;
    mesh.position.set(xPos, 0.205, zPos);
    mesh.userData = {
      type: 'sticky-note',
      note: note,
      originalY: 0.205
    };

    // Add a thick elevated box hitbox on Layer 1 — prominent and easy to raycast
    const noteHitBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.45, 0.85),
      new THREE.MeshBasicMaterial()
    );
    noteHitBox.layers.set(1);
    noteHitBox.position.set(0, 0, 0.15);
    noteHitBox.userData = { type: 'sticky-note', note: note, originalY: 0.205 };
    mesh.add(noteHitBox);

    this.deskGroup.add(mesh);

    this.interactiveObjects.push(noteHitBox);
  }

  setInputEnabled(enabled) {
    this.inputEnabled = enabled;
    this.rig?.setInputEnabled(enabled && this.view === 'seat');
    if (!enabled) { this.resetHoverState(); this.hideSean(); }
    this.isDraggingView = false;
    this.pendingHover = null;
    this.hideTooltip();
  }

  bindEvents() {
    this.rig.bindKeyboardLook(() => this.isCameraZoomed || this.view !== 'seat');
    this.backButton = document.getElementById('deskBackBtn');
    this.backButton.addEventListener('click', () => this.backToSeat());
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.view === 'desk' && !this.interactionBlocked()) {
        event.preventDefault(); event.stopImmediatePropagation(); this.backToSeat();
      }
    }, true);
    window.addEventListener('resize', () => this.onWindowResize());

    // Seated Look Around Event Listeners
    const dom = this.renderer.domElement;
    dom.addEventListener('mouseleave', () => this.resetHoverState());
    document.addEventListener('pointerdown', () => {
      if (matchMedia('(pointer: coarse)').matches) this.hideSean();
    });

    // Mouse Drag to Look Around
    dom.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));

    // Mouse Wheel to Tilt POV Up / Down smoothly
    dom.addEventListener('wheel', (e) => {
      if (this.view !== 'seat' || this.isCameraZoomed) return;
      this.rig.aim(this.rig.targetYaw, this.rig.targetPitch - e.deltaY * 0.0018);
    }, { passive: true });

    // Touch Swipe to Look Around
    dom.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    window.addEventListener('touchend', () => { this.isDraggingView = false; });

    // Click handler for 3D props & folders
    dom.addEventListener('click', (e) => this.onClick(e));
  }

  adjustCameraForScreen() {
    if (!this.camera) return;
    const width = (this.container && this.container.clientWidth) ? this.container.clientWidth : window.innerWidth;
    const height = (this.container && this.container.clientHeight) ? this.container.clientHeight : window.innerHeight;
    if (!width || !height) return;

    const aspect = width / height;
    this.camera.aspect = aspect;

    const portrait = aspect < 0.75;
    const compact = aspect < 1.15;
    this.camera.fov = portrait ? 68 : compact ? 58 : 50;
    if (this.view === 'seat' && !this.isCameraZoomed) this.camera.position.copy(this.rig.seat);
    this.camera.updateProjectionMatrix();
    if (this.renderer) {
      this.renderer.setSize(width, height);
    }
  }

  onWindowResize() {
    this.adjustCameraForScreen();
  }

  onMouseDown(e) {
    if (!this.inputEnabled || this.view === 'gliding') return;
    this.dragStartPos = { x: e.clientX, y: e.clientY };
    this.hasDraggedMeaningfully = false;
    if (this.view !== 'seat') return;
    if (this.isCameraZoomed) return;
    // Don't drag if clicking buttons, modals, or clear-book overlay
    if (e.target.closest('button') || e.target.closest('.guestbook-modal-overlay') || e.target.closest('#bookOverlay') || e.target.closest('.error-modal-overlay')) return;

    this.isDraggingView = true;
    this.dragStartPos = { x: e.clientX, y: e.clientY };
    this.dragStartAngles = { yaw: this.rig.targetYaw, pitch: this.rig.targetPitch };
    this.mouseDownTime = Date.now();
    this.hasDraggedMeaningfully = false;
  }

  onMouseUp(e) {
    this.isDraggingView = false;
  }

  onTouchStart(e) {
    if (!this.inputEnabled) return;
    if (this.isCameraZoomed || !e.touches || e.touches.length === 0) return;
    this.dragStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    this.hasDraggedMeaningfully = false;
    if (this.view !== 'seat') return;
    this.isDraggingView = true;
    this.dragStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    this.dragStartAngles = { yaw: this.rig.targetYaw, pitch: this.rig.targetPitch };
    this.mouseDownTime = Date.now();
    this.hasDraggedMeaningfully = false;
  }

  onTouchMove(e) {
    if (!this.inputEnabled) return;
    if (!this.isDraggingView || this.isCameraZoomed || !e.touches || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - this.dragStartPos.x;
    const dy = e.touches[0].clientY - this.dragStartPos.y;

    if (Math.hypot(dx, dy) >= 5) {
      this.hasDraggedMeaningfully = true;
    }

    // Horizontal 180 degrees (-90° to +90°) and vertical look up (-0.65 to +1.15)
    // Consistent drag directions across all axes
    const yawDelta = -(dx / window.innerWidth) * Math.PI;
    const pitchDelta = -(dy / window.innerHeight) * PITCH_RANGE;

    this.rig.aim(this.dragStartAngles.yaw + yawDelta, this.dragStartAngles.pitch + pitchDelta);
  }

  onMouseMove(e) {
    if (!this.inputEnabled) return;
    if (this.isCameraZoomed) {
      this.hideTooltip();
      return;
    }

    // 1. If dragging, rotate camera with expanded look-up POV
    if (this.isDraggingView) {
      const dx = e.clientX - this.dragStartPos.x;
      const dy = e.clientY - this.dragStartPos.y;

      if (Math.hypot(dx, dy) >= 5) {
        this.hasDraggedMeaningfully = true;
        this.hideTooltip();
      }

      // Dragging UP looks UP (consistent negative sign with yaw)
      const yawDelta = -(dx / window.innerWidth) * MOUSE_YAW_RANGE;
      const pitchDelta = -(dy / window.innerHeight) * PITCH_RANGE;

      this.rig.aim(this.dragStartAngles.yaw + yawDelta, this.dragStartAngles.pitch + pitchDelta);
      return;
    }

    this.pendingHover = e;
  }

  updateHover(e) {
    if (this.interactionBlocked()) { this.resetHoverState(); this.hideSean(); return; }
    // Raycast hovered props & folders
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, false);

    const selected = this.pickInteraction(intersects);
    if (selected) {
      // Keep note priority only among interactive items in desk view.
      let chosenIntersect = selected;
      const noteIntersect = intersects.find(it => {
        let cur = it.object;
        while (cur.parent && cur.parent !== this.scene && !cur.userData.type) {
          cur = cur.parent;
        }
        return cur.userData && (cur.userData.type === 'sticky-note' || cur.userData.type === 'dont-touch-note');
      });

      if (this.view === 'desk' && noteIntersect && chosenIntersect.object.userData.type !== 'folder') {
        chosenIntersect = noteIntersect;
      }

      let hitObject = chosenIntersect.object;
      while (hitObject.parent && hitObject.parent !== this.scene && !hitObject.userData.type) {
        hitObject = hitObject.parent;
      }

      if (this.hoveredObject !== hitObject) {
        this.resetHoverState();
        this.hoveredObject = hitObject;
        this.applyHoverState(hitObject, e);
      } else if (this.hoveredObject) {
        this.positionTooltip(e);
      }
    } else {
      this.resetHoverState();
    }
  }

  applyHoverState(obj, e) {
    document.body.style.cursor = 'pointer';

    if (obj.userData.type === 'placard') {
      obj.material.color.set(Theme['sun-glow']);
      this.showTooltip('Click to read placard', e);
    } else if (obj.userData.type === 'teacher') {
      if (!matchMedia('(pointer: coarse)').matches) this.showSean();
    } else if (obj.userData.type === 'front-desk') {
      this.showTooltip('Click to view the front desk', e);
    } else if (obj.userData.type === 'curtain') {
      this.hideTooltip();
    } else if (obj.userData.type === 'folder') {
      const folder = obj.userData.folderMesh || obj;
      const member = folder.userData.member;
      this.showTooltip(`<strong>${member.deskItem === 'spiral-notebook' ? 'Spiral notebook' : member.deskItem === 'theme-book' ? 'Theme book' : member.deskItem === 'intermediate-pad' ? 'Intermediate pad' : 'Long folder'}: ${member.name}</strong><br><em>“${member.tagline}”</em><br><small style="color:#38BDF8">Click anywhere to open portfolio</small>`, e);
    } else if (obj.userData.type === 'coffee') {
      const coffeeHint = this.isSpilled
        ? '<strong>Spilled Coffee:</strong> What a mess...<br><small style="color:#34D399">Click to clean desk &amp; brew fresh coffee</small>'
        : '<strong>Coffee Mug:</strong> 90% caffeine, 10% panic.<br><small style="color:#38BDF8">Click anywhere to spill</small>';
      this.showTooltip(coffeeHint, e);
    } else if (obj.userData.type === 'dont-touch-note') {
      this.showTooltip('<strong>Sticky Note:</strong> "Do not touch"<br><small style="color:#FBBF24">Click to shake • Double-click for Zero-G</small>', e);
    } else if (obj.userData.type === 'laptop') {
      this.showTooltip('<strong>Student Laptop:</strong> Motivation.exe crash<br><small style="color:#F43F5E">Click anywhere to inspect</small>', e);
    } else if (obj.userData.type === 'calendar') {
      this.showTooltip('<strong>Desk Calendar:</strong> Every single day is circled as DEADLINE!', e);
    } else if (obj.userData.type === 'duck') {
      this.showTooltip('<strong>Senior Rubber Duck:</strong> Chief Debugging Officer!', e);
    } else if (obj.userData.type === 'sticky-note') {
      const n = obj.userData.note;
      this.showTooltip(`<strong>Note from ${n.author || 'Visitor'}:</strong><br>“${n.text}”`, e);
    }
  }

  resetHoverState() {
    if (this.hoveredObject?.userData.type === 'placard') this.hoveredObject.material.color.set(0xffffff);
    if (this.hoveredObject?.userData.type === 'teacher') {
      clearTimeout(this.seanHideTimer);
      this.seanHideTimer = setTimeout(() => this.hideSean(), 600);
    }
    if (this.hoveredObject) {
      if (this.hoveredObject.userData.type === 'folder' && !this.isCameraZoomed) {
        const folder = this.hoveredObject.userData.folderMesh || this.hoveredObject;
        if (typeof gsap !== 'undefined') {
          gsap.to(folder.position, {
            y: folder.userData.originalPos.y,
            duration: 0.25,
            ease: 'power2.out'
          });
          gsap.to(folder.rotation, {
            x: 0,
            duration: 0.25
          });
        } else {
          folder.position.y = folder.userData.originalPos.y;
        }
      }
      this.hoveredObject = null;
    }
    document.body.style.cursor = 'grab';
    this.hideTooltip();
  }

  showTooltip(html, e) {
    if (!this.tooltip) return;
    this.tooltip.innerHTML = html;
    this.tooltip.style.display = 'block';
    this.positionTooltip(e);
  }

  positionTooltip(e) {
    if (!this.tooltip) return;
    this.tooltip.style.left = (e.clientX + 16) + 'px';
    this.tooltip.style.top = (e.clientY + 16) + 'px';
  }

  hideTooltip() {
    if (!this.tooltip) return;
    this.tooltip.style.display = 'none';
  }

  onClick(e) {
    if (this.interactionBlocked()) return;
    if (matchMedia('(pointer: coarse)').matches) this.hideSean();
    if (this.isCameraZoomed) {
      return;
    }
    if (e.target.closest('button') || e.target.closest('#bookOverlay') || e.target.closest('.error-modal-overlay') || e.target.closest('.guestbook-modal-overlay') || e.target.closest('.note-view-modal-overlay')) {
      return;
    }

    const startX = this.dragStartPos ? this.dragStartPos.x : e.clientX;
    const startY = this.dragStartPos ? this.dragStartPos.y : e.clientY;
    const dragDist = Math.hypot(e.clientX - startX, e.clientY - startY);

    // Only abort if the user deliberately dragged across screen for look-around
    if (dragDist >= 5 || this.hasDraggedMeaningfully) {
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, false);

    const selected = this.pickInteraction(intersects);
    if (selected) {
      // Keep note priority only among interactive items in desk view.
      let chosenIntersect = selected;
      const noteIntersect = intersects.find(it => {
        let cur = it.object;
        while (cur.parent && cur.parent !== this.scene && !cur.userData.type) {
          cur = cur.parent;
        }
        return cur.userData && (cur.userData.type === 'sticky-note' || cur.userData.type === 'dont-touch-note');
      });

      if (this.view === 'desk' && noteIntersect && chosenIntersect.object.userData.type !== 'folder') {
        chosenIntersect = noteIntersect;
      }

      let hit = chosenIntersect.object;
      while (hit.parent && hit.parent !== this.scene && !hit.userData.type) {
        hit = hit.parent;
      }
      this.handleObjectClick(hit);
    } else {
      console.warn("[Sean] No interactive hit at the clicked position.");
    }
  }

  interactionBlocked() {
    return !this.inputEnabled || this.view === 'gliding' || this.isCameraZoomed || !!document.querySelector(
      '#bookOverlay.active, .error-modal-overlay.active, .guestbook-modal-overlay.active, .note-view-modal-overlay.active, #termsModal.active');
  }

  hideSean() {
    clearTimeout(this.seanHideTimer);
    this.speechUntil = 0;
    this.teacherBubble?.classList.remove('visible');
  }

  showSean(duration = Infinity) {
    if (this.view !== 'seat' || this.interactionBlocked()) return;
    clearTimeout(this.seanHideTimer);
    const lines = Array.isArray(this.classroom.teacherLines) && this.classroom.teacherLines.length
      ? this.classroom.teacherLines : classroomDefaults.teacherLines;
    this.teacherBubble.textContent = lines[this.speechIndex % lines.length];
    this.speechIndex = (this.speechIndex + 1) % lines.length;
    this.speechUntil = performance.now() + duration;
    if (Number.isFinite(duration)) this.seanHideTimer = setTimeout(() => this.hideSean(), duration);
    this.hideTooltip();
  }

  onSeanClick() {
    // TODO: later feature
  }

  handleObjectClick(obj) {
    if (this.interactionBlocked()) return;
    const type = obj.userData.type;
    const tabletop = this.tabletopObject(obj);
    if (this.view === 'seat' && tabletop && type !== 'front-desk') return;
    if (this.view === 'desk' && !tabletop) return;

    if (type === 'front-desk') {
      this.enterDeskView();
    } else if (type === 'placard') {
      this.openPlacard(obj);
    } else if (type === 'teacher') {
      if (matchMedia('(pointer: coarse)').matches) this.showSean(3000);
      this.onSeanClick();
    } else if (type === 'curtain') {
      this.toggleCurtain();
    } else if (type === 'folder') {
      const folderMesh = obj.userData.folderMesh || obj;
      this.selectFolder(folderMesh);
    } else if (type === 'coffee') {
      this.handleCoffeeInteraction();
    } else if (type === 'dont-touch-note') {
      this.handleStickyNoteClick();
    } else if (type === 'laptop') {
      if (window.PortfolioHumor) {
        window.PortfolioHumor.showLaptopErrorDialog();
      }
    } else if (type === 'calendar') {
      if (window.PortfolioHumor) {
        window.PortfolioHumor.playSound('error');
        window.PortfolioHumor.showToast('Final submission is due soon! No pressure.');
      }
    } else if (type === 'duck') {
      if (window.PortfolioHumor) {
        window.PortfolioHumor.playSound('pop');
        window.PortfolioHumor.showToast('*Quack!* The Rubber Duck approves of your clean architecture.');
      }
    } else if (type === 'sticky-note') {
      this.viewStickyNote(obj);
    }
  }

  openPlacard(face) {
    if (this.isCameraZoomed) return;
    this.resetHoverState();
    this.isDraggingView = false;
    this.rig.keys.clear();
    this.rig.targetYaw = this.rig.yaw;
    this.rig.targetPitch = this.rig.pitch;
    this.preZoomOrientation = this.camera.quaternion.clone();
    this.preZoomPosition = this.camera.position.clone();
    this.isCameraZoomed = true;
    const target = face.getWorldPosition(new THREE.Vector3());
    this.camera.position.copy(target);
    this.camera.position.z += 5;
    this.camera.lookAt(target);
    const card = document.createElement('div');
    card.className = 'note-view-modal-overlay active';
    card.style.display = 'flex';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'placard-heading');
    card.innerHTML = '<div class="note-view-card"><h2 id="placard-heading"></h2><p class="note-view-body"></p><button class="note-view-return-btn">Return to Desk</button></div>';
    card.querySelector('h2').textContent = face.userData.content.title;
    card.querySelector('p').textContent = face.userData.content.text;
    const previousFocus = document.activeElement;
    const close = () => {
      document.removeEventListener('keydown', onKey, true);
      card.remove();
      this.returnToDesk();
      previousFocus?.focus();
    };
    const onKey = event => {
      if (event.key === 'Escape') { event.stopImmediatePropagation(); close(); }
      if (event.key === 'Tab') event.preventDefault();
    };
    document.body.appendChild(card);
    const button = card.querySelector('button');
    button.addEventListener('click', close);
    button.focus();
    document.addEventListener('keydown', onKey, true);
  }

  handleStickyNoteClick() {
    const now = Date.now();
    if (this.lastStickyClick && (now - this.lastStickyClick) < 450) {
      // Double click! Trigger Zero-G Anti-Gravity Easter Egg easily!
      this.toggleAntiGravity();
    } else {
      this.triggerShakeNearestFolder();
    }
    this.lastStickyClick = now;
  }

  selectFolder(obj) {
    if (this.view !== 'desk' || this.interactionBlocked()) return;
    const folderMesh = obj.userData.folderMesh || obj;
    const member = folderMesh.userData.member;
    this.onFolderClick?.(member);
    this.bookOpen = true;
    this.isCameraZoomed = true;
    this.hideTooltip();
    window.PortfolioHumor?.playSound('pageFlip');
    this.onFolderSelect?.(member);
  }

  returnToDesk() {
    if (this.bookOpen) {
      this.bookOpen = false;
      this.isCameraZoomed = false;
      return;
    }
    if (!this.isCameraZoomed) return;
    const hinge = this.activeFolder?.getObjectByName('long-folder-hinge');
    if (hinge && typeof gsap !== 'undefined') {
      gsap.to(hinge.rotation, { z: 0, duration: 0.45, overwrite: true });
    } else if (hinge) {
      hinge.rotation.z = 0;
    }

    if (typeof gsap !== 'undefined') {
      if (this.activeFolder) {
        gsap.to(this.activeFolder.position, {
          x: this.activeFolder.userData.originalPos.x,
          y: this.activeFolder.userData.originalPos.y,
          z: this.activeFolder.userData.originalPos.z,
          duration: 0.6,
          ease: 'power2.out'
        });
        gsap.to(this.activeFolder.rotation, {
          x: 0,
          y: this.activeFolder.userData.originalRot.y,
          z: this.activeFolder.userData.originalRot.z,
          duration: 0.6
        });
      }

      const fromOrientation = this.camera.quaternion.clone();
      const turn = { progress: 0 };
      gsap.to(turn, {
        progress: 1, duration: 0.8, ease: 'power3.inOut',
        onUpdate: () => this.camera.quaternion.slerpQuaternions(fromOrientation, this.preZoomOrientation, turn.progress)
      });
      gsap.to(this.camera.position, {
        overwrite: true,
        x: this.preZoomPosition.x,
        y: this.preZoomPosition.y,
        z: this.preZoomPosition.z,
        duration: 0.8,
        ease: 'power3.inOut',
        onComplete: () => {
          this.camera.position.copy(this.preZoomPosition);
          this.camera.quaternion.copy(this.preZoomOrientation);
          this.isCameraZoomed = false;
          this.activeFolder = null;
        }
      });
    } else {
      this.camera.position.copy(this.preZoomPosition);
      this.camera.quaternion.copy(this.preZoomOrientation);
      this.isCameraZoomed = false;
      this.activeFolder = null;
    }
  }

  handleCoffeeInteraction() {
    if (this.isSpilled) {
      this.cleanAndRecreateCoffee();
    } else {
      this.triggerCoffeeSpill();
    }
  }

  triggerCoffeeSpill() {
    if (this.isSpilled) return;
    this.isSpilled = true;

    if (window.PortfolioHumor) {
      window.PortfolioHumor.playSound('spill');
      window.PortfolioHumor.showToast('Oops! Coffee spilled on the desk! Click the puddle to clean up.');
    }

    if (typeof gsap !== 'undefined') {
      gsap.to(this.coffeeCup.rotation, { z: 1.4, duration: 0.35, ease: 'power2.in' });
      gsap.to(this.puddle.scale, { x: 1, y: 1, z: 1, duration: 1.2, delay: 0.2, ease: 'power1.out' });
    } else {
      this.coffeeCup.rotation.z = 1.4;
      this.puddle.scale.set(1, 1, 1);
    }
  }

  cleanAndRecreateCoffee() {
    if (!this.isSpilled) return;

    if (window.PortfolioHumor) {
      window.PortfolioHumor.playSound('pop');
      window.PortfolioHumor.showToast('Desk cleaned! Fresh coffee brewing... motivation restored.');
    }

    if (typeof gsap !== 'undefined') {
      // 1. Shrink puddle away
      gsap.to(this.puddle.scale, {
        x: 0, y: 0, z: 0,
        duration: 0.7,
        ease: 'power2.in'
      });

      // 2. Rotate cup back upright with a satisfying bounce
      gsap.to(this.coffeeCup.rotation, {
        z: 0,
        duration: 0.65,
        ease: 'back.out(1.7)'
      });

      // 3. Pop cup up slightly then settle — like a fresh brew landing on desk
      gsap.to(this.coffeeCup.position, {
        y: this.coffeeCup.position.y + 0.35,
        duration: 0.25,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(this.coffeeCup.position, {
            y: this.coffeeCup.position.y - 0.35,
            duration: 0.5,
            ease: 'bounce.out',
            onComplete: () => {
              this.isSpilled = false;
            }
          });
        }
      });
    } else {
      this.coffeeCup.rotation.z = 0;
      this.puddle.scale.set(0, 0, 0);
      this.isSpilled = false;
    }
  }

  viewStickyNote(stickyMesh) {
    // If clicked object is a child hitbox, walk up to the visual parent note mesh
    const visualMesh = (stickyMesh.parent && stickyMesh.parent.userData && stickyMesh.parent.userData.type === 'sticky-note')
      ? stickyMesh.parent
      : stickyMesh;
    const note = visualMesh.userData.note || stickyMesh.userData.note;
    if (!note) return;

    this.isCameraZoomed = true;
    this.preZoomOrientation = this.camera.quaternion.clone();
    this.preZoomPosition = this.camera.position.clone();
    this.rig.targetYaw = this.rig.yaw;
    this.rig.targetPitch = this.rig.pitch;
    this.rig.keys.clear();
    this.isDraggingView = false;
    this.hideTooltip();
    this.activeStickyMesh = visualMesh;

    if (window.PortfolioHumor) {
      window.PortfolioHumor.playSound('pageFlip');
    }

    // Animate camera zooming close to the sticky note
    if (typeof gsap !== 'undefined') {
      const noteWorldPos = new THREE.Vector3();
      visualMesh.getWorldPosition(noteWorldPos);

      gsap.to(this.camera.position, {
        x: noteWorldPos.x,
        y: noteWorldPos.y + 2.2,
        z: noteWorldPos.z + 1.6,
        overwrite: true,
        onUpdate: () => this.camera.lookAt(noteWorldPos),
        duration: 0.7,
        ease: 'power3.inOut'
      });

      // Lift the sticky note toward the camera with a spring bounce
      gsap.to(visualMesh.position, {
        y: visualMesh.position.y + 0.55,
        duration: 0.5,
        ease: 'back.out(1.5)',
        onComplete: () => {
          this.openNoteViewerModal(note);
        }
      });
    } else {
      this.openNoteViewerModal(note);
    }
  }

  openNoteViewerModal(note) {
    const modal = document.getElementById('noteViewModal');
    const authorEl = document.getElementById('noteViewAuthor');
    const dedicatedEl = document.getElementById('noteViewDedicated');
    const bodyEl = document.getElementById('noteViewBody');

    if (!modal) return;

    if (authorEl) authorEl.textContent = note.author || 'Anonymous Visitor';
    if (dedicatedEl) dedicatedEl.textContent = 'Left on the 3D Desk';
    if (bodyEl) bodyEl.textContent = `"${note.text || 'No message written.'}"`;

    // Set display:flex first, then add .active next frame so CSS opacity/transform transition fires
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.classList.add('active');
      });
    });
  }

  closeNoteViewerModal() {
    const modal = document.getElementById('noteViewModal');
    if (modal) {
      modal.classList.remove('active');
      // After opacity transition ends, fully remove from layout
      modal.addEventListener('transitionend', () => {
        modal.style.display = 'none';
      }, { once: true });
    }

    // Animate sticky note back to desk surface
    if (this.activeStickyMesh && typeof gsap !== 'undefined') {
      gsap.to(this.activeStickyMesh.position, {
        y: this.activeStickyMesh.userData.originalY !== undefined
          ? this.activeStickyMesh.userData.originalY
          : 0.205,
        duration: 0.45,
        ease: 'power2.out'
      });
    }
    this.activeStickyMesh = null;
    this.returnToDesk();
  }

  triggerShakeNearestFolder() {
    if (window.PortfolioHumor) {
      window.PortfolioHumor.playSound('error');
      window.PortfolioHumor.showToast('🚨 I said DO NOT TOUCH! (Double-click or press "E" for Zero-G!)');
    }

    const targetFolder = this.folders[2] ? this.folders[2].mesh : (this.folders[0] ? this.folders[0].mesh : null);
    if (!targetFolder) return;

    if (typeof gsap !== 'undefined') {
      const origX = targetFolder.userData.originalPos.x;
      gsap.to(targetFolder.position, {
        x: origX + 0.15,
        duration: 0.05,
        repeat: 9,
        yoyo: true,
        ease: 'none',
        onComplete: () => { targetFolder.position.x = origX; }
      });
    }
  }

  toggleAntiGravity() {
    if (this.isFloating) {
      this.stopAntiGravity();
    } else {
      this.triggerAntiGravity();
    }
  }

  triggerAntiGravity() {
    this.isFloating = true;

    if (window.PortfolioHumor) {
      window.PortfolioHumor.playSound('fanfare');
      window.PortfolioHumor.showToast('🚀 ZERO-G MODE ENGAGED! Desk is floating in zero gravity. Press "E" to toggle.');
    }

    if (typeof gsap !== 'undefined') {
      gsap.to(this.deskGroup.position, {
        y: 2.2,
        duration: 2.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
      gsap.to(this.deskGroup.rotation, {
        x: 0.08,
        z: -0.06,
        duration: 3.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });

      this.folders.forEach((f, idx) => {
        gsap.to(f.mesh.position, {
          y: f.originalPos.y + 0.6 + (idx * 0.12),
          duration: 2 + idx * 0.3,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut'
        });
        gsap.to(f.mesh.rotation, {
          y: f.originalRot.y + 0.35,
          duration: 2.8 + idx * 0.4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut'
        });
      });
    }
  }

  stopAntiGravity() {
    this.isFloating = false;
    if (window.PortfolioHumor) {
      window.PortfolioHumor.playSound('pop');
      window.PortfolioHumor.showToast('🌍 Gravity Restored: Desk back on the ground.');
    }

    if (typeof gsap !== 'undefined') {
      gsap.killTweensOf(this.deskGroup.position);
      gsap.killTweensOf(this.deskGroup.rotation);
      gsap.to(this.deskGroup.position, { y: 0, duration: 1.2, ease: 'bounce.out' });
      gsap.to(this.deskGroup.rotation, { x: 0, y: 0, z: 0, duration: 0.8, ease: 'power2.out' });

      this.folders.forEach((f) => {
        gsap.killTweensOf(f.mesh.position);
        gsap.killTweensOf(f.mesh.rotation);
        gsap.to(f.mesh.position, {
          x: f.originalPos.x,
          y: f.originalPos.y,
          z: f.originalPos.z,
          duration: 0.8,
          ease: 'power2.out'
        });
        gsap.to(f.mesh.rotation, {
          x: 0,
          y: f.originalRot.y,
          z: f.originalRot.z,
          duration: 0.8,
          ease: 'power2.out'
        });
      });
    }
  }


  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.pendingHover) {
      if (!this.isDraggingView && !this.isCameraZoomed) this.updateHover(this.pendingHover);
      this.pendingHover = null;
    }
    const seconds = performance.now() * 0.001;
    this.classroomRotors.forEach((rotor, i) => { rotor.rotation.y = seconds * (i === 2 ? 1.3 : 0.78) + i; });
    this.classroomShafts.forEach((beam, i) => { beam.position.y = 2.42 + 0.055 * Math.sin(seconds * 0.24 + i); });
    this.classroomDust.position.set(0.13 * Math.sin(seconds * 0.31), 0.12 * Math.sin(seconds * 0.21), 0.11 * Math.cos(seconds * 0.25));

    const dt = Math.min(seconds - (this.lastFrameSeconds ?? seconds), 0.05);
    this.lastFrameSeconds = seconds;
    if (!this.isCameraZoomed) {
      this.rig.updateKeyboardLook(dt);
      this.rig.update();
    }

    this.updateWindowView(seconds);

    if (this.renderer && this.scene && this.camera) {
      // Rotating fan blades and active prop tweens are the moving shadow casters.
      if ((this.classroomRotors.length || this.isFloating || this.isCameraZoomed || this.hoveredObject) && seconds - this.lastShadowUpdate >= 1 / 15) {
        this.renderer.shadowMap.needsUpdate = true;
        this.lastShadowUpdate = seconds;
      }
      const covered = this.bookOverlay?.classList.contains('active') ||
        document.getElementById('laptopErrorModal')?.classList.contains('active');
      if (covered && seconds - this.lastSceneRender < 0.25) return;
      this.lastSceneRender = seconds;
      this.updateFrontWall(seconds);
      this.renderer.render(this.scene, this.camera);
    }
  }

  initFallback2D() {
    this.container.innerHTML = `
      <div class="fallback-2d-desk">
        <div class="fallback-header">
          <h2>📁 The Messy Desk (2D Safe Mode)</h2>
          <p>WebGL is unavailable on your device, but the clear-book engine is 100% operational!</p>
        </div>
        <div class="fallback-folders-grid" id="fallbackGrid"></div>
      </div>
    `;

    const grid = document.getElementById('fallbackGrid');
    const membersList = this.members.length > 0 ? this.members : [];

    membersList.forEach(m => {
      const card = document.createElement('div');
      card.className = 'fallback-folder-card';
      card.style.borderColor = m.coverColor || '#FF7A00';
      card.innerHTML = `
        <div class="fallback-folder-spine" style="background:${m.coverColor};"></div>
        <div class="fallback-folder-content">
          <span class="fallback-label">${m.folderLabel}</span>
          <h3 class="fallback-name">${m.name}</h3>
          <p class="fallback-tagline">“${m.tagline}”</p>
          <button class="fallback-open-btn" style="background:${m.coverColor};">Open Clear-Book</button>
        </div>
      `;
      card.addEventListener('click', () => {
        if (typeof this.onFolderSelect === 'function') {
          this.onFolderClick?.(m);
          this.onFolderSelect(m);
        }
      });
      grid.appendChild(card);
    });
  }
}

window.DeskScene = DeskScene;

// One shared canvas supplies John's 3D folder and opened cover from the attached AET aesthetic image.
const JohnFolderArt = (() => {
  const cache = new Map();
  return {
    get(member) {
      const key = member.name + '|' + member.section;
      if (cache.has(key)) return cache.get(key);
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1536;
      canvas.textContent = 'Application and Emerging Technologies - John Vernie Dela Cruz';
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, 1024, 1536);
      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = 4;
      const entry = { canvas, texture };
      cache.set(key, entry);

      const coverImg = new Image();
      coverImg.crossOrigin = 'anonymous';
      const drawCover = () => {
        if (coverImg.naturalWidth) {
          ctx.drawImage(coverImg, 0, 0, 1024, 1536);
          // Draw the corrected subject over the cover image's printed lettering.
          ctx.save();
          ctx.scale(canvas.width / 764, canvas.height / 1024);
          ctx.fillStyle = '#1E1E1D';
          ctx.fillRect(202, 369, 425, 60);
          ctx.fillRect(201, 435, 454, 64);
          ctx.fillRect(197, 504, 518, 57);
          ctx.font = '900 50px Georgia, serif';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#EBF6FA';
          ctx.fillStyle = '#2A638A';
          for (const [line, y, width] of [
            ['APPLICATION AND', 422, 419], ['EMERGING', 490, 446], ['TECHNOLOGIES', 553, 508]
          ]) {
            ctx.strokeText(line, 207, y, width);
            ctx.fillText(line, 207, y, width);
          }
          ctx.restore();
        }
        texture.needsUpdate = true;
      };
      coverImg.onload = drawCover;
      coverImg.src = 'assets/textures/john-cover.jpg';
      if (coverImg.complete && coverImg.naturalWidth) drawCover();

      entry.ready = Promise.resolve(entry);
      return entry;
    }
  };
})();

/** Interactive group portfolio desk in a Philippine high school classroom. */
// Keyboard look direction; drag keeps its original direction.
const INVERT_X = false;
const INVERT_Y = false;
const MOUSE_YAW_RANGE = Math.PI * 1.15;
const PITCH_RANGE = 1.5;
const KEY_LOOK_VIEWPORTS_PER_SECOND = 0.5;
// Sixteen seats in four even rows; keep the front row clear of the fixed table.
const SEAT_SLOTS = Object.freeze([
  [1, 1, -8.2, -6.65], [1, 2, -4.2, -6.65], [1, 3, 4.2, -6.65], [1, 4, 8.2, -6.65],
  [2, 1, -8.2, -3.2], [2, 2, -4.2, -3.2], [2, 3, 4.2, -3.2], [2, 4, 8.2, -3.2],
  [3, 1, -8.2, .25], [3, 2, -4.2, .25], [3, 3, 4.2, .25], [3, 4, 8.2, .25],
  [4, 1, -8.2, 3.7], [4, 2, -4.2, 3.7], [4, 3, 4.2, 3.7], [4, 4, 8.2, 3.7]
].map(([row, col, x, z]) => Object.freeze({ row, col, x, z, yaw: 0 })));
const VIEWER_SLOT = SEAT_SLOTS.find(slot => slot.row === 4 && slot.col === 2);
const ABSENT_SLOT = SEAT_SLOTS.find(slot => slot.row === 4 && slot.col === 1);
const studentDefaults = [
  ['s1', 'Dinorobong Tubo', '', 1, 1, true, '#C68A5E', 'bald', '#3B2A1E', '#D8402F', 'none'],
  ['s2', 'Diwata Pares', 'I love pares', 1, 4, false, '#E0AC82', 'bob', '#1E1A18', '#2E9C8F', 'hairclip'],
  ['s3', 'Bea Borres', "My baby daddy Meray, Hopea, I'm dinadaan-daanan lang", 2, 2, false, '#F0C9A0', 'twin buns', '#4A2C2A', '#9A7BC8', 'none'],
  ['s4', 'Lans', 'THIS IS LANS!!!', 2, 3, false, '#B97A52', 'ponytail', '#231815', '#F2B632', 'headband'],
  ['s5', 'Buseng', 'Sir, walang kanin, sir?', 3, 1, false, '#D69A6B', 'crew cut', '#1B1B1B', '#E8892B', 'spoon'],
  ['s6', 'Mosh', 'Miss you mosh', 3, 2, false, '#E6B88C', 'side part', '#3A2312', '#7A1F3A', 'none'],
  ['iannah', 'Iannah', '...', 1, 2, false, '#BA805C', 'ponytail', '#30201A', '#648C72', 'none'],
  ['sherwin', 'Sherwin', 'Patingin nga ng system niyo', 3, 4, false, '#F1CFB5', 'side part', '#291D19', '#6383B7', 'glasses']
].map(([id, name, line, row, col, dance, skin, hairStyle, hairColor, outfitColor, accessory]) =>
  ({ id, name, line, row, col, dance, look: { skin, hairStyle, hairColor, outfitColor, accessory } })); const tabletopLayout = [
    { item: 'spiral-notebook', x: -4.4, z: -.04, yaw: 0.14 },
    { item: 'long-folder', x: -2.35, z: -.04, yaw: -0.11 },
    { item: 'laptop', x: 0, z: 0, yaw: 0 },
    { item: 'theme-book', x: 2.35, z: -.04, yaw: 0.08 },
    { item: 'intermediate-pad', x: 4.35, z: -.04, yaw: -0.14 }
  ];

class CameraRig {
  static SEAT_POSE = Object.freeze({ x: VIEWER_SLOT.x, y: 3.45, z: VIEWER_SLOT.z, yaw: Math.atan2(-VIEWER_SLOT.x, VIEWER_SLOT.z + 11.55), pitch: -.18, fov: 55 }); static DESK_POSE = Object.freeze({ x: 0, y: 8, z: -11.55, yaw: Math.PI, pitch: -Math.PI * 85 / 180 });

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
    this.antiGravityHomes = null;
    this.antiGravityTweens = [];
    this.antiGravityResetTweens = [];
    this.antiGravityLanding = false;

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
    this.scene.fog = new THREE.Fog(Theme.vivid('#FFE3A3'), 18, 60);

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
    this.buildExtras(this.roomGroup, -2.84);
    this.buildStudentBags(this.roomGroup, -2.84);
    Theme.applyScene(this);
    this.moveTableContents(roomObjects);
    const ahead = SEAT_SLOTS.filter(slot => slot.col === VIEWER_SLOT.col && slot.row < VIEWER_SLOT.row).sort((a, b) => b.row - a.row)[0];
    Theme.addVandalism(this, ahead);
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
    this.scene.add(new THREE.HemisphereLight('#FFE3A3', '#C98A45', .9 * strength));
    const fill = new THREE.DirectionalLight('#FFD9A0', .35 * strength);
    fill.position.set(0, 5, 8); this.scene.add(fill);
    const sun = new THREE.DirectionalLight('#FFC862', 1.4 * strength);
    sun.position.set(18, 7.6, 5.4);
    sun.target.position.set(-9, -2.84, -4.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 11, bottom: -11, near: 1, far: 44 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = .018; sun.shadow.bias = -.00012;
    this.scene.add(sun, sun.target);
    this.windowSun = sun; this.windowSunIntensity = sun.intensity;
    this.windowLight = 1;
  }

  buildSurroundingRoom() {
    const room = this.roomGroup = new THREE.Group();
    this.scene.add(room);
    // Four scene units per metre. A 1.8-unit seat and 3.02-unit table are 45 and 75.5 cm high.
    const floor = -2.84, ceiling = 10.25, front = -15, back = 9, side = 11;
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const paint = color => new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
    const paints = new Map();
    this.studentPaint = color => {
      const key = new THREE.Color(color).getHex();
      if (!paints.has(key)) paints.set(key, paint(color));
      return paints.get(key);
    };
    this.studentGeometry = { box: unitBox, sphere: new THREE.SphereGeometry(1, 10, 8) };
    this.studentHitMaterial = new THREE.MeshBasicMaterial({ visible: false });
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
    // One subtle, shared grain map; chair color comes from the three cached toon materials.
    const grain = texture(128, 128, ctx => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 128); ctx.strokeStyle = 'rgba(90,58,30,.12)'; ctx.lineWidth = 1;
      for (let y = 5; y < 128; y += 11) { ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(38, y - 3, 82, y + 3, 128, y - 1); ctx.stroke(); }
    });
    grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(2, 2);
    const wood = color => { const material = Theme.toon(color).clone(); material.color.set(color); material.map = grain; return material; };
    this.chairMaterials = { plank: wood('#A8743F'), tablet: wood('#B98650'), legs: wood('#5A3A1E') };
    this.roomTexture = texture; const panel = (map, w, h, x, y, z, yaw = 0) => {
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
    const doorHeight = 8.38;
    for (const side of [-1, 1]) {
      box(room, white, side * 6.39, (ceiling + floor) / 2, back, 9.22, wallHeight, .18);
      box(room, green, side * 6.39, floor + .23, back - .11, 9.22, .46, .07);
      box(room, yellow, side * 10.75, (ceiling + floor) / 2, back - .2, .5, wallHeight, .5);
    }
    box(room, white, 0, floor + (doorHeight + wallHeight) / 2, back, 3.56, wallHeight - doorHeight, .18);
    box(room, paint('#DDC8A6'), 0, floor - .08, back + 2.75, 8, .16, 5.5);
    const door = new THREE.Group();
    door.position.set(0, floor, back - 0.25);
    door.userData = { type: 'door', enabled: false };
    room.add(door);
    const leaf = this.exitDoorLeaf = new THREE.Group();
    leaf.position.x = -1.76;
    door.add(leaf);
    const doorPart = (mat, x, ...args) => box(leaf, mat, x + 1.76, ...args);
    const timber = paint(Theme.wood);
    const daylight = new THREE.MeshStandardMaterial({
      color: 0xe8f2ef, emissive: 0xfff8d7, emissiveIntensity: 1.1, roughness: 0.95
    });
    for (const x of [-1.86, 1.86]) box(door, green, x, 4.23, 0, 0.18, 8.46, 0.35);
    box(door, green, 0, 8.48, 0, 3.9, 0.18, 0.35);
    doorPart(timber, 0, 4.22, 0, 3.52, 8.36, 0.19);
    doorPart(green, 0, 6.84, -0.12, 2.06, 1.63, 0.08);
    doorPart(daylight, 0, 6.84, -0.17, 1.88, 1.45, 0.035);
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9c1bf, metalness: 0.68, roughness: 0.35 });
    doorPart(steel, 0, 0.57, -0.11, 3.29, 0.91, 0.04);
    doorPart(steel, -1.38, 3.9, -0.17, 0.24, 0.62, 0.13);
    doorPart(steel, -1.16, 4, -0.29, 0.62, 0.09, 0.16);
    box(door, daylight, 0, 0.026, -0.13, 3.49, 0.04, 0.07);
    box(room, white, -side, (ceiling + floor) / 2, -3, 0.18, ceiling - floor, 24);
    for (const x of [-10.89, 10.89]) box(room, green, x, floor + 0.23, -3, 0.08, 0.46, 24);
    for (const z of [-12, -4, 4]) box(room, yellow, 0, ceiling - 0.22, z, 22, 0.44, 0.42);

    // Build the right wall around an actual opening. Solid masonry blocks the sun elsewhere.
    const sill = 0.25, lintel = 6.85, start = -6, end = 7.2;
    const wallPiece = (y0, y1, z0, z1) => box(room, white, side, (y0 + y1) / 2, (z0 + z1) / 2, 0.18, y1 - y0, z1 - z0);
    wallPiece(floor, sill, front, back); wallPiece(lintel, ceiling, front, back);
    wallPiece(sill, lintel, front, start); wallPiece(sill, lintel, end, back);
    for (const y of [sill, lintel]) box(room, green, side, y, (start + end) / 2, 0.32, 0.22, end - start);
    for (const z of [start, (start + end) / 2, end]) box(room, green, side, (sill + lintel) / 2, z, 0.32, lintel - sill, 0.2);
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
    const slatOutlines = new THREE.InstancedMesh(unitBox,
      new THREE.MeshBasicMaterial({ color: Theme.ink, side: THREE.BackSide, transparent: true, opacity: .13, depthWrite: false }), slats.length);
    const expansion = new THREE.Matrix4().makeScale(1.045, 1.045, 1.045), matrix = new THREE.Matrix4();
    slats.forEach((slat, i) => { slat.updateMatrix(); slatOutlines.setMatrixAt(i, matrix.copy(slat.matrix).multiply(expansion)); });
    slatOutlines.userData.outlineAdded = true; slatOutlines.raycast = () => { }; room.add(slatOutlines);
    this.buildWindowView(side, sill, lintel, start, end);
    this.buildCurtain(room, box, texture, side, sill, lintel, start, end);

    const boardX = 0, boardWidth = 22 * .75, boardHeight = wallHeight * .37, boardY = 3.5;
    box(room, paint(Theme.gold), boardX, boardY, front + .18, boardWidth, boardHeight, .2);
    const board = texture(2048, 560, () => { });
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
      for (const [x, y, r] of [[185, 125, 24], [245, 158, 12], [470, 365, 15]]) {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = i * Math.PI * .8 - Math.PI / 2;
          ctx[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(angle), y + r * Math.sin(angle));
        }
        ctx.closePath(); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(155, 195); ctx.quadraticCurveTo(210, 183, 270, 191); ctx.stroke();
      board.needsUpdate = true;
    };
    writeBoard();
    Promise.all([document.fonts.load('76px "Gochi Hand"'), document.fonts.load('70px Caveat')]).then(writeBoard).catch(() => { });
    this.whiteboardFace = panel(board, boardWidth - .36, boardHeight - .36, boardX, boardY, front + .29);
    this.whiteboardBaseCanvas = board.image;
    const boardHit = new THREE.Mesh(unitBox, this.studentHitMaterial);
    boardHit.position.set(boardX, boardY, front + .45); boardHit.scale.set(boardWidth * 1.15, boardHeight * 1.15, .18); boardHit.layers.set(1);
    boardHit.userData.type = 'whiteboard'; room.add(boardHit); this.interactiveObjects.push(boardHit); const trayY = boardY - boardHeight / 2;
    box(room, silver, boardX, trayY, front + .37, boardWidth, .12, .45);
    [0x205587, 0xc14741, 0x242628].forEach((color, i) => {
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
    this.tvTexture = texture(512, 288, ctx => { ctx.fillStyle = "#1034A6"; ctx.fillRect(0, 0, 512, 288) });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.72, 2.61),
      new THREE.MeshBasicMaterial({ map: this.tvTexture }));
    screen.position.z = .11; tv.add(screen);
    screen.userData.type = 'classroom-tv';
    this.interactiveObjects.push(screen);
    this.initDVD(screen);
    this.buildTeacher(room, floor, box, paint, texture);
    const notices = texture(1024, 560, ctx => {
      ctx.fillStyle = '#aa7952'; ctx.fillRect(0, 0, 1024, 560);
      const cards = [
        ['CLASS OFFICERS', 'President: Nicole', 'Vice President: Vernie', 'Secretary: Charella', 'Muse: Riam'],
        ['SCHEDULE', '7:30   Filipino', '8:30   Mathematics', '9:30   Recess', '10:00  Science'],
        ['PAALALA', 'Bawal magkalat.', 'Bawal kumain', 'sa loob ng klase.']
      ];
      cards.forEach(([title, ...rows], i) => {
        const x = 26 + i * 330;
        ctx.fillStyle = ['#fff8cc', '#f9f6ef', '#e7f2df'][i]; ctx.fillRect(x, 41, 310, 470);
        ctx.fillStyle = '#ab4637'; ctx.beginPath(); ctx.arc(x + 155, 55, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#234941'; ctx.font = 'bold 30px sans-serif'; ctx.fillText(title, x + 16, 115);
        ctx.font = '25px sans-serif'; rows.forEach((line, j) => ctx.fillText(line, x + 16, 195 + j * 63));
      });
    });
    box(room, frame, -10.84, 2.9, -4, 0.2, 4.4, 8.4);
    panel(notices, 8.15, 4.15, -10.72, 2.9, -4, Math.PI / 2);

    // Place the portrait just beyond the Class Officers end of the noticeboard.
    const portraitZ = 1.95, portraitY = 3.18;
    box(room, frame, -10.84, portraitY, portraitZ, .18, 3.45, 2.84);
    box(room, paint(Theme.gold), -10.73, portraitY, portraitZ, .07, 3.25, 2.63);
    const portraitMap = new THREE.TextureLoader().load('assets/photos/tzuyu-pic.jpg');
    portraitMap.encoding = THREE.sRGBEncoding;
    const portrait = panel(portraitMap, 2.4, 3, -10.68, portraitY, portraitZ, Math.PI / 2);
    portrait.name = 'mother of all';
    const plaque = texture(512, 104, ctx => {
      ctx.canvas.textContent = portrait.name;
      ctx.fillStyle = '#F8E8BE'; ctx.fillRect(0, 0, 512, 104);
      ctx.fillStyle = Theme.ink; ctx.font = 'bold 53px Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillText(portrait.name, 256, 69, 468);
    });
    box(room, frame, -10.8, 1.15, portraitZ, .15, .56, 2.5);
    panel(plaque, 2.36, .48, -10.715, 1.15, portraitZ, Math.PI / 2);


    const tube = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d9, emissiveIntensity: 0.95 });
    for (const x of [-5.3, 5.3]) {
      box(room, silver, x, ceiling - .12, -5.2, 5, .24, .58);
      box(room, tube, x, ceiling - .31, -5.2, 4.8, .14, .24);
    }
    this.classroomRotors = [];
    const fan = (x, y, z, wall) => {
      const mount = new THREE.Group();
      mount.position.set(x, y, z);
      if (wall) { mount.rotation.z = Math.PI / 2; mount.scale.setScalar(0.57); }
      room.add(mount);
      box(mount, silver, 0, 0.35, 0, 0.12, 0.7, 0.12);
      const rotor = new THREE.Group(); mount.add(rotor);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.23, 0.28, 16), frame);
      rotor.add(hub);
      for (let i = 0; i < 3; i++) {
        const arm = new THREE.Group(); arm.rotation.y = i * Math.PI * 2 / 3;
        rotor.add(arm); box(arm, green, 0.88, 0, 0, 1.48, 0.07, 0.33);
      }
      if (wall) {
        for (const radius of [1.1, 1.7]) {
          const guard = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.045, 6, 32), silver);
          guard.rotation.x = Math.PI / 2; guard.position.y = -0.21; mount.add(guard);
        }
      }
      this.classroomRotors.push(rotor);
    };
    fan(0, 9.24, -9, false); fan(0, 9.24, 1, false); fan(-10.48, 6.3, 2, true);

    // The viewer gets the same seat and legs as the class, without a tablet or its support.
    const seats = SEAT_SLOTS.filter(slot => slot !== VIEWER_SLOT);
    const chairBatch = (material, parts, slots = SEAT_SLOTS, castShadow = true) => {
      const mesh = new THREE.InstancedMesh(unitBox, material, slots.length * parts.length);
      const pose = new THREE.Object3D(); let i = 0;
      for (const { x, z, yaw } of slots) for (const [dx, dy, dz, w, h, d, tilt = 0] of parts) {
        pose.position.set(x + dx, floor + dy, z + dz); pose.scale.set(w, h, d);
        pose.rotation.set(tilt, yaw, 0); pose.updateMatrix(); mesh.setMatrixAt(i++, pose.matrix);
      }
      mesh.castShadow = castShadow; mesh.receiveShadow = true; mesh.name = 'wooden-student-chairs'; room.add(mesh);
    };
    chairBatch(this.chairMaterials.plank, [[0, 1.73, 0, 1.67, 0.14, 1.55], [0, 2.56, 0.68, 1.62, 1.24, 0.13, 0.1]]);
    chairBatch(this.chairMaterials.tablet, [[0.48, 2.7, -0.48, 1.22, 0.12, 1.28]], seats);
    const supports = [[0, 1.54, 0, 1.62, 0.12, 1.46]];
    for (const x of [-0.69, 0.69]) for (const z of [-0.58, 0.58]) supports.push([x, 0.83, z, 0.11, 1.66, 0.11]);
    chairBatch(this.chairMaterials.legs, supports, SEAT_SLOTS, false);
    chairBatch(this.chairMaterials.legs, [[0.77, 2.13, -0.36, 0.1, 1.04, 0.1]], seats, false); this.buildStudents(room, floor);
    this.buildAbsentSeat(room, floor);

    const glow = texture(128, 128, ctx => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,222,144,.85)'); g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    });
    const shaftMat = new THREE.MeshBasicMaterial({ map: glow, color: 0xffd27a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.classroomShafts = [];
    for (let i = 0; i < 3; i++) {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.7), shaftMat);
      beam.rotation.order = 'YXZ'; beam.rotation.y = -0.36; beam.rotation.z = 0.35;
      beam.position.set(4, 2.42, -4 + i * 3); room.add(beam); this.classroomShafts.push(beam);
    }
    const positions = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      const x = (i * 59 % 83) / 6 - 3;
      positions.set([x, 0.38 * x + (i * 23 % 37) / 18, (i * 41 % 89) / 9 - 4.5], i * 3);
    }
    const cloud = new THREE.BufferGeometry(); cloud.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.classroomDust = new THREE.Points(cloud, new THREE.PointsMaterial({ map: glow, color: 0xffd27a, size: 0.055, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
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

  toggleCurtain(force = false) {
    if (this.view !== 'seat' || this.curtainAnimating || (!force && this.interactionBlocked())) return;
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
        if (!this.curtainClosed) this.experiences?.onCurtainOpened();
        this.renderer.shadowMap.needsUpdate = true;
      }
    });
  }

  buildStudent(look, bottoms = '#35373D') {
    const person = new THREE.Group(), torso = new THREE.Group(), head = new THREE.Group();
    const paint = this.studentPaint, geometry = this.studentGeometry;
    // Batch repeated primitives by color within each moving part. All six share geometry/materials.
    const part = (parent, shape, color, poses) => {
      const mesh = new THREE.InstancedMesh(geometry[shape], paint(color), poses.length);
      const pose = new THREE.Object3D();
      for (let i = 0; i < poses.length; i++) {
        const [x, y, z, w, h, d] = poses[i];
        pose.position.set(x, y, z); pose.scale.set(w, h, d); pose.updateMatrix(); mesh.setMatrixAt(i, pose.matrix);
      }
      mesh.receiveShadow = true; mesh.castShadow = false; parent.add(mesh); return mesh;
    };
    part(person, 'box', bottoms, [
      [-.29, 1.96, -.36, .38, .3, .92], [.29, 1.96, -.36, .38, .3, .92],
      [-.29, 1.1, -.74, .34, 1.42, .32], [.29, 1.1, -.74, .34, 1.42, .32],
      [-.29, .34, -.9, .43, .28, .64], [.29, .34, -.9, .43, .28, .64]]);
    torso.position.set(0, 2.05, 0); person.add(torso);
    part(torso, 'box', look.outfitColor, [[0, .43, .08, .93, .9, .56]]);
    head.position.set(0, 1.48, .03); torso.add(head);
    part(head, 'sphere', look.skin, [[0, 0, 0, .43, .53, .4]]);
    // Generic dot eyes and a small mouth, one shared primitive and one ink material.
    part(head, 'sphere', Theme.ink, [[-.16, .06, -.38, .043, .046, .025], [.16, .06, -.38, .043, .046, .025], [0, -.19, -.379, .09, .025, .02]]);
    const hair = [[0, .34, .06, .45, .23, .4]];
    switch (look.hairStyle) {
      case 'bald': hair.length = 0; break;
      case 'curly': hair.splice(0, 1, [-.28, .34, 0, .25, .26, .35], [.27, .36, 0, .25, .26, .35], [0, .48, .06, .27, .25, .36]); break;
      case 'bob': hair[0] = [0, .16, .17, .48, .48, .35]; break;
      case 'twin buns': hair.push([-.4, .44, .1, .21, .21, .21], [.4, .44, .1, .21, .21, .21]); break;
      case 'ponytail': hair.push([0, .18, .5, .18, .4, .22]); break;
      case 'crew cut': hair[0] = [0, .43, .04, .43, .13, .37]; break;
      case 'side part': hair.push([-.16, .44, -.13, .29, .12, .27]); break;
    }
    if (hair.length) part(head, 'sphere', look.hairColor, hair);
    if (look.hairStyle === 'curly') part(torso, 'sphere', look.outfitColor, [[0, 1.13, .28, .48, .38, .23]]);
    if (look.hairStyle === 'bob') part(torso, 'box', '#FFF3D6', [[0, .74, -.211, .32, .06, .025]]);
    if (look.hairStyle === 'twin buns') part(torso, 'box', '#FFF3D6', [[0, .43, -.211, .05, .86, .025]]);
    if (look.hairStyle === 'crew cut') part(torso, 'box', '#FFF3D6', [[-.14, .8, -.22, .18, .12, .03], [.14, .8, -.22, .18, .12, .03]]);
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * .46, .72, -.02); torso.add(arm); arms.push(arm);
      part(arm, 'box', look.outfitColor, [[side < 0 ? .22 : .04, .17, -.17, side < 0 ? .58 : .24, .32, .55]]);
      part(arm, 'sphere', look.skin, [[side < 0 ? .62 : .04, .12, -.66, .14, .1, .22]]);
    }
    if (look.accessory === 'hairclip') part(head, 'box', '#F2B632', [[.35, .27, -.25, .16, .06, .06]]);
    if (look.accessory === 'headband') part(head, 'box', '#FFF3D6', [[0, .34, -.32, .79, .085, .055]]);
    if (look.accessory === 'glasses') {
      const frames = [];
      for (const x of [-.16, .16]) {
        frames.push([x, .16, -.414, .245, .025, .045], [x, -.03, -.414, .245, .025, .045],
          [x - .12, .065, -.414, .025, .2, .045], [x + .12, .065, -.414, .025, .2, .045]);
      }
      frames.push([0, .08, -.426, .10, .025, .045]);
      part(head, 'box', Theme.ink, frames);
    }
    if (look.accessory === 'spoon') {
      part(arms[1], 'box', '#BEC9CF', [[.04, .08, -.91, .045, .045, .36]]);
      part(arms[1], 'sphere', '#BEC9CF', [[.04, .08, -1.12, .1, .035, .14]]);
    }
    person.userData.parts = { torso, head, arms };
    return person;
  }

  buildStudents(room, floor) {
    this.students = [];
    this.studentMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    const data = Array.isArray(this.classroom.students) ? this.classroom.students : studentDefaults;
    const occupied = this.occupiedStudentSeats = new Set([VIEWER_SLOT, ABSENT_SLOT].map(slot => slot.row + ':' + slot.col));
    for (const student of data) {
      const key = student.row + ':' + student.col;
      const slot = SEAT_SLOTS.find(seat => seat.row === student.row && seat.col === student.col);
      if (!student.look || !slot || slot.row === 4 || occupied.has(key)) continue;
      occupied.add(key);
      const person = this.buildStudent(student.look);
      person.position.set(slot.x, floor, slot.z); person.rotation.y = slot.yaw;
      person.name = student.id; room.add(person);
      const parts = person.userData.parts;
      // Stable id hash supplies a fixed +/-3 degree head tilt without per-frame randomness.
      let seed = 17; for (const char of student.id) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
      parts.head.rotation.z = ((seed % 601) / 600 - .5) * Math.PI / 30;
      const anchor = new THREE.Object3D(); anchor.position.set(0, .8, 0); parts.head.add(anchor);
      const hitbox = new THREE.Mesh(this.studentGeometry.box, this.studentHitMaterial);
      hitbox.position.set(0, 2.5, 0); hitbox.scale.set(1.6, 3, 1.5); hitbox.layers.set(1);
      hitbox.userData = { type: 'student', student, anchor }; person.add(hitbox); this.interactiveObjects.push(hitbox);
      this.students.push({ student, person, ...parts, anchor, hitbox });
    }
  }

  buildExtras(room, floor) {
    this.extras = []; this.extraSightlineSkips = []; this.extraBatches = [];
    const targets = [], point = new THREE.Vector3(), origin = new THREE.Vector3(CameraRig.SEAT_POSE.x, CameraRig.SEAT_POSE.y, CameraRig.SEAT_POSE.z);
    const frontDesk = new THREE.Matrix4().makeRotationY(Math.PI); frontDesk.setPosition(0, 0, -11.55);
    const protectedTypes = new Set(['folder', 'laptop', 'coffee', 'dont-touch-note', 'sticky-note']);
    this.scene.updateMatrixWorld(true);
    for (const object of this.interactiveObjects) if (protectedTypes.has(object.userData.type)) {
      object.getWorldPosition(point); targets.push(point.clone().applyMatrix4(frontDesk));
    }
    this.teacherHead.getWorldPosition(point); targets.push(point.clone());
    const ray = new THREE.Ray(), bounds = new THREE.Box3(), intersection = new THREE.Vector3(), direction = new THREE.Vector3();
    const skins = ['#B97A52', '#C68A5E', '#D69A6B', '#E0AC82', '#E6B88C', '#F0C9A0'];
    const hairstyles = ['crew cut', 'bob', 'side part', 'ponytail', 'curly', 'twin buns'];
    const outfits = ['#F7F1E4', '#2E9C8F', '#5383B5', '#D8402F', '#F2B632'];
    let seed = 73129, index = 0;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const batches = new Map(), instance = new THREE.Matrix4(), matrix = new THREE.Matrix4();
    for (const slot of SEAT_SLOTS) {
      if (this.occupiedStudentSeats.has(slot.row + ':' + slot.col)) continue;
      const look = {
        skin: skins[Math.floor(random() * skins.length)], hairStyle: hairstyles[index % hairstyles.length], hairColor: '#231815',
        outfitColor: outfits[index++ % outfits.length], accessory: 'none'
      };
      bounds.min.set(slot.x - .68, floor + 1.8, slot.z - .8); bounds.max.set(slot.x + .68, floor + 4.2, slot.z + .8);
      const blocks = targets.some(target => {
        direction.subVectors(target, origin); const distance = direction.lengthSq(); ray.set(origin, direction.normalize());
        return ray.intersectBox(bounds, intersection) && intersection.distanceToSquared(origin) < distance;
      });
      if (blocks) { this.extraSightlineSkips.push({ row: slot.row, col: slot.col }); continue; }
      const person = this.buildStudent(look, '#22345D'); person.position.set(slot.x, floor, slot.z); person.rotation.y = slot.yaw;
      person.userData.parts.head.rotation.z = (random() - .5) * Math.PI / 30; person.updateMatrixWorld(true);
      // Extras stay still: combine all their primitive instances into shared color/geometry batches.
      person.traverse(mesh => {
        if (!mesh.isInstancedMesh) return;
        const key = mesh.geometry.uuid + ':' + mesh.material.uuid;
        if (!batches.has(key)) batches.set(key, { geometry: mesh.geometry, material: mesh.material, matrices: [] });
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, instance); matrix.multiplyMatrices(mesh.matrixWorld, instance); batches.get(key).matrices.push(matrix.clone());
        }
      });
      const hitbox = new THREE.Mesh(this.studentGeometry.box, this.studentHitMaterial);
      hitbox.position.set(slot.x, floor + 2.5, slot.z); hitbox.scale.set(1.45, 3.1, 1.6); hitbox.layers.set(1);
      hitbox.userData = { type: 'student-extra', slot }; room.add(hitbox); this.interactiveObjects.push(hitbox);
      this.extras.push({ slot, look, hitbox });
    }
    for (const data of batches.values()) {
      const mesh = new THREE.InstancedMesh(data.geometry, data.material, data.matrices.length);
      data.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.receiveShadow = true; mesh.castShadow = false;
      mesh.name = 'still-student-extras'; room.add(mesh); this.extraBatches.push(mesh);
    }
  }

  buildStudentBags(room, floor) {
    const pool = [
      { type: 'navy-backpack', colors: ['#22345D', '#2D426F', '#1D2D50'], parts: [['box', 0, .43, 0, .64, .82, .32], ['box', 0, .29, .19, .47, .30, .09], ['ring', 0, .92, 0, .34, .25, .35]] },
      { type: 'teal-backpack', colors: ['#2E9C8F', '#288A81', '#3BA99A'], parts: [['sphere', 0, .44, 0, .35, .44, .19], ['box', 0, .30, .20, .48, .30, .08], ['ring', 0, .92, 0, .34, .26, .35]] },
      { type: 'red-sling', colors: ['#D8402F', '#BE382A', '#E24B37'], parts: [['box', 0, .29, 0, .72, .50, .28], ['box', 0, .50, .03, .74, .16, .32], ['ring', 0, .78, -.04, .62, .95, .30]] },
      { type: 'canvas-tote', colors: ['#E8D8B5', '#EFE1C3', '#DCCAA3'], parts: [['box', 0, .36, 0, .72, .68, .30], ['ring', 0, .82, -.11, .42, .70, .24], ['ring', 0, .82, .11, .42, .70, .24]] },
      { type: 'yellow-drawstring', colors: ['#F2B632', '#E4AA2B', '#F5C344'], parts: [['sphere', 0, .42, 0, .33, .40, .16], ['box', 0, .78, 0, .44, .12, .25], ['box', -.22, .53, .18, .035, .55, .035], ['box', .22, .53, .18, .035, .55, .035]] },
      { type: 'orange-lunch', colors: ['#E8892B', '#D97B26', '#F09637'], parts: [['box', 0, .25, 0, .62, .46, .34], ['box', 0, .52, 0, .66, .10, .38], ['ring', 0, .67, 0, .36, .34, .35]] },
      { type: 'white-plastic', colors: ['#FAFAF5', '#F0F0E7', '#FFFFFF'], parts: [['crumpled', 0, .34, 0, .62, .64, .30], ['box', 0, .69, 0, .40, .15, .28, 0, 0, .14], ['ring', -.15, .90, 0, .20, .40, .30], ['ring', .15, .90, 0, .20, .40, .30]] },
      { type: 'olive-shoulder', colors: ['#687544', '#5E6D3C', '#75814C'], parts: [['box', 0, .29, 0, .76, .54, .30], ['box', 0, .50, .04, .78, .20, .34], ['ring', 0, .80, -.04, .68, 1.02, .30]] }
    ];
    let seed = 13771; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const crumpled = this.studentGeometry.box.clone(), corners = new Map(), vertices = crumpled.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const key = [vertices.getX(i), vertices.getY(i), vertices.getZ(i)].join(':');
      if (!corners.has(key)) corners.set(key, [(random() - .5) * .16, (random() - .5) * .16, (random() - .5) * .16]);
      const d = corners.get(key); vertices.setXYZ(i, vertices.getX(i) + d[0], vertices.getY(i) + d[1], vertices.getZ(i) + d[2]);
    }
    crumpled.computeVertexNormals();
    const ring = new THREE.TorusGeometry(.5, .07, 5, 12), primitives = { ...this.studentGeometry, ring, crumpled }, pose = new THREE.Object3D();
    this.bagGeometries = new Map();
    for (const bag of pool) {
      const positions = [], normals = [], uv = [];
      for (const [shape, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0] of bag.parts) {
        const base = primitives[shape], part = base.index ? base.toNonIndexed() : base.clone();
        pose.position.set(x, y, z); pose.scale.set(w, h, d); pose.rotation.set(rx, ry, rz); pose.updateMatrix(); part.applyMatrix4(pose.matrix);
        positions.push(...part.attributes.position.array); normals.push(...part.attributes.normal.array); uv.push(...part.attributes.uv.array); part.dispose();
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geometry.computeBoundingBox(); geometry.computeBoundingSphere(); this.bagGeometries.set(bag.type, geometry);
    }
    ring.dispose(); crumpled.dispose();
    const occupants = [...this.students.map(s => ({ id: s.student.id, slot: SEAT_SLOTS.find(p => p.row === s.student.row && p.col === s.student.col) })),
    ...this.extras.map(s => ({ id: 'extra-' + s.slot.row + '-' + s.slot.col, slot: s.slot }))].sort((a, b) => a.slot.row - b.slot.row || a.slot.col - b.slot.col);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]; }
    const counts = new Map(), bounds = new THREE.Box3(); this.studentBags = [];
    for (const [index, occupant] of occupants.entries()) {
      const { slot } = occupant, neighbors = this.studentBags.filter(b => Math.abs(b.slot.row - slot.row) + Math.abs(b.slot.col - slot.col) === 1);
      let type = pool[index % pool.length];
      if (neighbors.some(b => b.type === type.type)) type = pool.find(candidate => !neighbors.some(b => b.type === candidate.type));
      const variant = counts.get(type.type) || 0; counts.set(type.type, variant + 1);
      const color = type.colors[variant % type.colors.length], mesh = new THREE.Mesh(this.bagGeometries.get(type.type), this.studentPaint(color));
      const aisleSide = slot.x < 0 ? 1 : -1;
      const space = side => Math.min(11 - side * slot.x, ...SEAT_SLOTS.filter(p => p.row === slot.row && side * (p.x - slot.x) > 0).map(p => Math.abs(p.x - slot.x) - 1.7)) + (side === aisleSide ? .2 : 0);
      const side = space(aisleSide) >= space(-aisleSide) ? aisleSide : -aisleSide;
      mesh.rotation.set((random() - .5) * .08, slot.yaw + (random() - .5) * .24, side * (.035 + random() * .065));
      mesh.position.set(slot.x + side * 1.55, 0, slot.z + .10 + (random() - .5) * .12); mesh.updateMatrixWorld(true);
      bounds.setFromObject(mesh); mesh.position.y = floor - bounds.min.y + .015;
      mesh.name = 'student-bag-' + occupant.id; mesh.userData = { type: 'student-bag', owner: occupant.id, bagType: type.type, variant, slot };
      mesh.castShadow = false; mesh.receiveShadow = true; mesh.raycast = () => { }; room.add(mesh); Theme.addOutline(mesh);
      this.studentBags.push({ mesh, type: type.type, variant, color, slot, owner: occupant.id, side });
    }
  }

  buildAbsentSeat(room, floor) {
    // Display-name override requested without changing Spring or the classroom API.
    this.absentName = 'Sara Duterte';
    const map = this.roomTexture(512, 256, ctx => {
      // textContent supplies both accessible canvas fallback text and the painted label; no HTML.
      ctx.canvas.textContent = this.absentName + '\nAbsent';
      const lines = ctx.canvas.textContent.split('\n'); ctx.fillStyle = '#FFF4DA'; ctx.fillRect(0, 0, 512, 256);
      ctx.strokeStyle = Theme.ink; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 496, 240); ctx.fillStyle = Theme.ink; ctx.textAlign = 'center';
      ctx.font = '600 42px "Patrick Hand", cursive'; ctx.fillText(lines[0], 256, 102, 472);
      ctx.font = '600 48px "Patrick Hand", cursive'; ctx.fillText(lines[1], 256, 188, 472);
    });
    const paper = new THREE.MeshBasicMaterial({ map, toneMapped: false });
    const geometry = new THREE.PlaneGeometry(1.2, .6), card = new THREE.Group();
    card.position.set(ABSENT_SLOT.x + .48, floor + 3.05, ABSENT_SLOT.z - .48); card.rotation.y = -Math.PI / 2; room.add(card);
    for (const side of [-1, 1]) {
      const face = new THREE.Mesh(geometry, paper); face.position.z = side * .157; face.rotation.set(-side * .55, side > 0 ? 0 : Math.PI, 0); card.add(face);
    }
    const anchor = new THREE.Object3D(); anchor.position.set(ABSENT_SLOT.x + .48, floor + 3.65, ABSENT_SLOT.z - .48); room.add(anchor);
    const hitbox = new THREE.Mesh(this.studentGeometry.box, this.studentHitMaterial);
    hitbox.position.set(ABSENT_SLOT.x, floor + 2.5, ABSENT_SLOT.z); hitbox.scale.set(1.6, 3, 1.5); hitbox.layers.set(1);
    hitbox.userData = { type: 'absent-seat', student: { id: 'absent', name: 'Absent', line: '' }, anchor }; room.add(hitbox); this.interactiveObjects.push(hitbox);
  }

  isSpeakingSeat(object) {
    return object?.userData.type === 'student' || object?.userData.type === 'absent-seat';
  }

  studentInteractionBlocked() {
    return this.view !== 'seat' || !!this.experiences?.speaking || this.interactionBlocked();
  }

  showStudentBubble(obj, duration = 600) {
    if (this.studentInteractionBlocked()) return;
    clearTimeout(this.seanHideTimer);
    const { student, anchor } = obj.userData;
    this.bubbleAnchor = anchor;
    this.bubbleStudentId = student.id;
    this.teacherBubble.textContent = student.name + (student.line ? '\n' + student.line : '');
    this.teacherBubble.style.whiteSpace = 'pre-line';
    this.teacherBubble.style.maxWidth = 'min(18em, calc(100vw - 16px))';
    this.teacherBubble.style.overflowWrap = 'anywhere';
    this.speechUntil = performance.now() + duration;
    this.hideTooltip();
  }

  buildWindowView(side, sill, lintel, start, end) {
    const width = (end - start) * 1.2, height = (lintel - sill) * 1.2;    // Keep the narrow sea strip above the sill; put most overscan above the opening.
    const bottom = sill - .1, centerZ = (start + end) / 2;
    const geometry = new THREE.PlaneGeometry(1, 1);
    const make = (x, y, h, color) => {
      const material = new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: false, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.y = -Math.PI / 2; mesh.position.set(x, y, centerZ); mesh.scale.set(width, h, 1);
      mesh.raycast = () => { }; this.scene.add(mesh); return mesh;
    };
    const horizonHeight = height * (1 - Theme.HORIZON_Y), skyHeight = height * Theme.HORIZON_Y;
    this.windowSky = make(side + .42, bottom + horizonHeight + skyHeight / 2, skyHeight, Theme.amber);
    this.windowHorizon = make(side + .40, bottom + horizonHeight / 2, horizonHeight, Theme['sun-glow']);
    this.windowCenterZ = centerZ;
    this.skyDriftEnabled = Theme.config.skyDrift;
    this.skyMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    Theme.windowTextures().then(layers => {
      this.windowSky.material.map = layers.sky; this.windowHorizon.material.map = layers.horizon;
      for (const mesh of [this.windowSky, this.windowHorizon]) { mesh.material.color.setScalar(this.windowLight); mesh.material.needsUpdate = true; }
      this.windowSkyTexture = layers.sky; this.windowSource = layers.source;
    }).catch(() => { });
    const glow = make(side - .22, (sill + lintel) / 2, lintel - sill, Theme['sun-glow']);
    glow.scale.x = end - start; glow.material.transparent = true; glow.material.opacity = .25;
    glow.material.blending = THREE.AdditiveBlending; glow.renderOrder = 1;
    this.windowGlow = glow;
  }

  updateWindowView(seconds) {
    if (!this.windowSky) return;
    const yaw = this.rig.yaw;
    this.windowSky.position.z = this.windowCenterZ - yaw * .04;
    this.windowHorizon.position.z = this.windowCenterZ - yaw * .015;
    if (this.windowSkyTexture && this.skyDriftEnabled && !this.skyMotionPreference.matches) {
      // Two mirrored repeats keep wraparound continuous at the boundary.
      this.windowSkyTexture.offset.x = (seconds * .004) % 2;
      this.windowSkyTexture.offset.y = Math.sin(seconds * .12) * .004;
    }
  }

  initDVD(screen) {
    this.tvScreen = screen; this.tvFrustum = new THREE.Frustum(); this.tvMatrix = new THREE.Matrix4();
    screen.updateWorldMatrix(true, false); this.tvBounds = new THREE.Box3().setFromObject(screen);
    this.tvMotion = matchMedia('(prefers-reduced-motion: reduce)'); this.tvLastCheck = -Infinity; this.tvPrevious = 0;
    this.tvDVD = { x: 166.4, y: 84, width: 179.2, height: 120, phaseX: 166.4, phaseY: 84, dirty: true, image: null };
    this.tvMotion.addEventListener('change', () => { this.tvDVD.dirty = true });
    // Loading failure keeps the canvas-drawn fallback, without throwing or logging.
    fetch('assets/textures/dvd-bounce.png').then(r => { if (!r.ok) throw new Error(); return r.blob() })
      .then(blob => createImageBitmap(blob)).then(async image => {
        // Trim transparent padding once, so the visible cutout gets the requested width.
        const scan = document.createElement('canvas'), scale = Math.min(1, 768 / Math.max(image.width, image.height));
        scan.width = Math.ceil(image.width * scale); scan.height = Math.ceil(image.height * scale);
        const ctx = scan.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0, scan.width, scan.height);
        const pixels = ctx.getImageData(0, 0, scan.width, scan.height).data; let left = scan.width, top = scan.height, right = -1, bottom = -1;
        for (let y = 0; y < scan.height; y++)for (let x = 0; x < scan.width; x++)if (pixels[(y * scan.width + x) * 4 + 3] > 24) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y) }
        if (right >= left) {
          const sx = Math.max(0, Math.floor(left / scale) - 1), sy = Math.max(0, Math.floor(top / scale) - 1);
          const cropped = await createImageBitmap(image, sx, sy, Math.min(image.width - sx, Math.ceil((right - left + 1) / scale) + 2), Math.min(image.height - sy, Math.ceil((bottom - top + 1) / scale) + 2)); image.close(); image = cropped
        }
        const d = this.tvDVD; d.image = image; d.width = Math.min(512 * .35, 272 * image.width / image.height); d.height = d.width * image.height / image.width;
        d.phaseX = (512 - d.width) / 2; d.phaseY = (288 - d.height) / 2; d.dirty = true;
      }).catch(() => { });
  }

  updateDVD(seconds) {
    if (this.experiences?.tvPlaying || seconds - this.tvLastCheck < 1 / 15) return;
    const dt = this.tvPrevious ? Math.min(seconds - this.tvPrevious, .15) : 0;
    this.tvLastCheck = this.tvPrevious = seconds;
    if (this.view !== 'seat' || this.interactionBlocked() || !this.inputEnabled || document.hidden) return;
    this.tvMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse); this.tvFrustum.setFromProjectionMatrix(this.tvMatrix);
    if (!this.tvFrustum.intersectsBox(this.tvBounds)) return;
    const d = this.tvDVD, maxX = 512 - d.width, maxY = 288 - d.height;
    if (this.tvMotion.matches) { if (!d.dirty) return; d.x = maxX / 2; d.y = maxY / 2 }
    else {
      d.phaseX = (d.phaseX + dt * 76.8) % (2 * maxX); d.phaseY = (d.phaseY + dt * 56.064) % (2 * maxY);
      d.x = d.phaseX <= maxX ? d.phaseX : 2 * maxX - d.phaseX; d.y = d.phaseY <= maxY ? d.phaseY : 2 * maxY - d.phaseY
    }
    const ctx = this.tvTexture.image.getContext('2d'); ctx.fillStyle = '#1034A6'; ctx.fillRect(0, 0, 512, 288);
    if (d.image) ctx.drawImage(d.image, d.x, d.y, d.width, d.height);
    else { ctx.save(); ctx.translate(d.x, d.y); ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(d.width / 2, 24, d.width * .44, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1034A6'; ctx.beginPath(); ctx.ellipse(d.width / 2, 24, 12, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold italic 27px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('VIDEO', d.width / 2, 68, d.width); ctx.restore() }
    d.dirty = false; this.tvTexture.needsUpdate = true;
  }

  buildTeacher(room, floor, box, paint, texture) {
    const black = paint(Theme.ink), mint = this.chairMaterials.plank;
    const teacherChair = new THREE.Group(); room.add(teacherChair);
    teacherChair.position.set(0, 0, -.68);
    box(teacherChair, mint, 0, floor + 1.74, -13.44, 1.82, .18, 1.4);
    box(teacherChair, mint, 0, floor + 3.05, -14.02, 1.82, 2.4, .16); const chairStripe = this.chairMaterials.legs;
    for (const x of [-.48, -.24, 0, .24, .48]) box(teacherChair, chairStripe, x, floor + 3.35, -13.92, .09, 1.28, .02);
    for (const x of [-.7, .7]) for (const z of [-14, -12.9]) box(teacherChair, this.chairMaterials.legs, x, floor + .86, z, .15, 1.72, .15).castShadow = false;

    const person = new THREE.Group();
    person.position.set(0, floor - 1.5, -14.22); person.rotation.y = 0;
    this.teacher = person;
    person.userData.type = 'teacher'; room.add(person);
    const skin = paint(0xb98058), slacks = paint(0x35373d), hair = paint(0x242021);
    this.teacherJacket = paint(Theme.ink);
    const oval = (parent, material, x, y, z, w, h, d) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), material);
      mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
      mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const limb = (parent, material, x, y, z, top, bottom, height) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 10), material);
      mesh.position.set(x, y, z); parent.add(mesh); mesh.castShadow = true; return mesh;
    };
    for (const x of [-0.43, 0.43]) {
      box(person, black, x, 1.64, 1.55, 0.69, 0.48, 1.08);
      const thigh = limb(person, slacks, x, 3.12, .72, .45, .31, 2.98);
      thigh.scale.y = .5; thigh.rotation.x = Math.PI / 2;
      const shin = new THREE.Mesh(thigh.geometry, slacks);
      shin.position.set(x, 2.34, 1.45); shin.scale.y = .5;
      shin.castShadow = true; person.add(shin);
    }
    const torso = this.teacherTorso = new THREE.Group(); torso.position.y = 3.15; person.add(torso);
    limb(torso, this.teacherJacket, 0, 1.08, 0, 1.02, 0.84, 2.2).scale.z = 0.64;
    box(torso, paint(0xece7db), 0, 1.12, 0.57, 0.65, 1.95, 0.09);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side === 1 ? .58 : -.94, 1.94, 0); torso.add(arm);
      const upper = limb(arm, this.teacherJacket, side * .08, -.15, .33, .32, .23, 1.45);
      upper.scale.y = .5; upper.rotation.x = -1.16;
      const forearm = new THREE.Mesh(upper.geometry, this.teacherJacket);
      forearm.scale.set(.8, .45, .8); forearm.rotation.x = Math.PI / 2;
      forearm.position.set(side * .08, -.24, .98); forearm.castShadow = true; arm.add(forearm);
      oval(arm, skin, side * .08, -.24, 1.36, .23, .21, .32);
      box(torso, black, side * 0.16, 1.5, 0.66, 0.045, 0.98, 0.035).rotation.z = -side * 0.32;
    }
    const badge = texture(256, 112, ctx => {
      ctx.fillStyle = '#f7f2db'; ctx.fillRect(0, 0, 256, 112); ctx.fillStyle = '#184b40'; ctx.fillRect(0, 0, 256, 18);
      ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SEAN DYOGI', 128, 76, 234);
    });
    box(torso, new THREE.MeshStandardMaterial({ map: badge }), 0, 0.9, 0.71, 0.56, 0.32, 0.045);
    limb(torso, skin, 0, 2.22, 0, 0.29, 0.32, 0.46);
    const head = this.teacherHead = new THREE.Group(); head.position.y = 2.92; torso.add(head);
    oval(head, skin, 0, 0, 0, 0.66, 0.91, 0.61);
    oval(head, hair, 0, 0.55, -0.05, 0.69, 0.5, 0.64);
    oval(head, skin, 0, -0.06, 0.59, 0.12, 0.16, 0.14);
    this.teacherEyes = [];
    for (const x of [-0.27, 0.27]) {
      this.teacherEyes.push(oval(head, black, x, 0.11, 0.563, 0.068, 0.073, 0.04));
      for (const dy of [-0.14, 0.14]) box(head, black, x, 0.11 + dy, 0.596, 0.46, 0.045, 0.055);
      for (const dx of [-0.21, 0.21]) box(head, black, x + dx, 0.11, 0.596, 0.045, 0.3, 0.055);
      box(head, black, Math.sign(x) * 0.51, 0.11, 0.33, 0.045, 0.045, 0.55);
    }
    box(head, black, 0, 0.14, 0.60, 0.14, 0.04, 0.05);
    // Four scene units per metre. Reuse the unit cube from the room builder.
    const hitbox = box(person, new THREE.MeshBasicMaterial({ visible: false }), 0, 4.45, .6, 3.2, 5.2, 2.4);
    this.interactiveObjects.push(hitbox);
    hitbox.castShadow = hitbox.receiveShadow = false;
    person.traverse(child => {
      if (child.isMesh) Object.assign(child.userData, { type: 'teacher', interactive: true });
    });
    this.speechAnchor = new THREE.Object3D(); this.speechAnchor.position.y = 1.23; head.add(this.speechAnchor);
    this.speechPoint = new THREE.Vector3();
    this.speechIndex = 0; this.speechUntil = 0;
    this.teacherBubble = document.createElement('div');
    this.teacherBubble.className = 'teacher-speech'; this.teacherBubble.setAttribute('role', 'status');
    document.body.appendChild(this.teacherBubble);
  }

  updateFrontWall(seconds) {
    this.updateDVD(seconds);
    if (!this.experiences?.concertActive) {
      this.teacherTorso.scale.y = 1 + 0.005 * Math.sin(seconds * 2);
      this.teacherHead.rotation.z = 0.026 * Math.sin(seconds * 0.8);
    }
    // Seated forearms remain resting on the desk.
    const blink = Math.abs((seconds % 4.8) - 2.4);
    for (const eye of this.teacherEyes) eye.scale.y = 0.073 * Math.min(1, blink / 0.085);
    if ((this.view !== 'seat' || this.interactionBlocked()) && !this.experiences?.speaker) { this.hideSean(); return; } if (!this.speechUntil) return;
    if (seconds * 1000 >= this.speechUntil) {
      this.teacherBubble.classList.remove('visible'); this.speechUntil = 0; return;
    }
    this.camera.updateMatrixWorld();
    (this.bubbleAnchor || this.speechAnchor).getWorldPosition(this.speechPoint).project(this.camera);
    const p = this.speechPoint, rect = this.renderer.domElement.getBoundingClientRect();
    const half = this.teacherBubble.offsetWidth / 2 + 8;
    this.teacherBubble.style.left = THREE.MathUtils.clamp(rect.left + (p.x + 1) * rect.width / 2, half, window.innerWidth - half) + 'px';
    this.teacherBubble.style.top = THREE.MathUtils.clamp(rect.top + (1 - p.y) * rect.height / 2, this.teacherBubble.offsetHeight + (document.getElementById('topNavbar')?.offsetHeight || 52) + 32, window.innerHeight - 8) + 'px';
    this.teacherBubble.classList.toggle('visible', Math.abs(p.z) < 1 && (!this.isCameraZoomed || this.experiences?.cleaning));
  }

  attachWhiteboardDrawing(canvas) {
    if (this.whiteboardDrawingLayer) return this.whiteboardDrawingTexture;
    const map = this.whiteboardDrawingTexture = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const layer = this.whiteboardDrawingLayer = new THREE.Mesh(this.whiteboardFace.geometry, material);
    layer.name = 'whiteboard-drawing-layer'; layer.position.copy(this.whiteboardFace.position); layer.position.z += .014; layer.raycast = () => { };
    this.roomGroup.add(layer); return map;
  }

  moveTableContents(roomObjects) {
    // Includes Theme's name tags, dashed trail/X and existing table graffiti decals.
    for (const obj of [...this.scene.children]) {
      if (roomObjects.has(obj)) continue;
      if (obj.position.y === .215) { obj.position.z = .87; obj.position.y = .38; }
      this.deskGroup.add(obj);
    }
    this.deskGroup.position.set(0, 0, -11.55);
    this.deskGroup.rotation.y = Math.PI;
    const hit = new THREE.Mesh(this.deskGroup.children[0].geometry, new THREE.MeshBasicMaterial({ visible: false }));
    hit.scale.set(1, .5, .99); hit.position.y = .08;
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
      if (this.isSpeakingSeat(first.object) || ['student-extra', 'floor-scrap', 'exit-door', 'classroom-tv', 'basketball', 'labibi'].includes(first.object.userData.type)) return first; const sean = intersects.find(hit => hit.object.userData.type === 'teacher');
      if (sean) return sean;
      if (this.tabletopObject(first.object)) return { object: this.deskHit };
      return first;
    }
    if (first.object.userData.type === 'labibi') return first;
    return intersects.find(hit => hit.object.userData.type === 'folder') || intersects.find(hit => hit.object.userData.type !== "front-desk" && this.tabletopObject(hit.object)) || null;
  }

  enterDeskView() {
    if (this.view !== 'seat' || this.interactionBlocked()) return;
    this.storedSeatPose = this.rig.capturePose();
    const pose = CameraRig.DESK_POSE;
    const height = 6.3 / (this.camera.aspect * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.glideTo({ ...pose, y: Math.max(4.7, height) + .3 }, 1.2, 'desk');
  }

  backToSeat() {
    if (this.view !== 'desk' || this.interactionBlocked()) return;
    this.glideTo(this.storedSeatPose, 1, 'seat');
  }

  glideTo(pose, duration, view) {
    this.viewTween?.kill();
    this.view = 'gliding'; window.dispatchEvent(new Event('portfolio-navigation'));
    this.rig.setInputEnabled(false);
    this.isDraggingView = false; this.hasDraggedMeaningfully = false;
    this.pendingHover = null; this.resetHoverState(); this.hideSean();
    const state = this.rig.capturePose();
    const yaw = state.yaw + Math.atan2(Math.sin(pose.yaw - state.yaw), Math.cos(pose.yaw - state.yaw));
    this.viewTween = gsap.to(state, {
      x: pose.x, y: pose.y, z: pose.z, yaw, pitch: pose.pitch,
      duration, ease: 'power2.inOut', onUpdate: () => this.rig.applyPose(state),
      onComplete: () => {
        this.viewTween.kill(); this.viewTween = null;
        this.rig.applyPose(pose); this.view = view;
        this.rig.setInputEnabled(view === 'seat' && this.inputEnabled);
        window.dispatchEvent(new Event('portfolio-navigation'));
        this.renderer.shadowMap.needsUpdate = true;
      }
    });
  }

  buildDesk() {
    this.deskGroup = new THREE.Group();

    // Wooden tabletop
    const deskGeo = new THREE.BoxGeometry(10.5, 0.35, 6.2);
    const deskMat = new THREE.MeshBasicMaterial({ map: Theme.woodTexture(), toneMapped: false });
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
    const matMaterial = new THREE.MeshBasicMaterial({ map: Theme.woodTexture(), toneMapped: false });
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

  createNicoleNotebook(member) {
    const book = new THREE.Group();
    const cream = new THREE.MeshStandardMaterial({ color: 0xfffcf0, roughness: 0.95 });
    const spineMat = new THREE.MeshStandardMaterial({ color: 0x14461B, roughness: 0.65 });

    function addPart(w, h, d, x, y, z, material) {
      const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      part.position.set(x, y, z);
      part.castShadow = part.receiveShadow = true;
      book.add(part);
    }

    // Page block stack
    addPart(1.02, 0.065, 1.38, 0, 0, 0, cream);
    // Slim dark-green cloth spine strip covering the left edge
    addPart(0.012, 0.067, 1.382, -0.51, 0, 0, spineMat);

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;

    const ringDots = [];
    for (let i = 0; i < 23; i++) {
      ringDots.push(`<circle cx="38" cy="${38 + i * 46}" r="4" fill="#FFFFFF" opacity="0.88"/>`);
    }

    // High-resolution SVG vector artwork matching Image 5 (actual notebook cover)
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100">
      <defs>
        <pattern id="coverGrid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(79, 109, 84, 0.09)" stroke-width="1"/>
        </pattern>
        <linearGradient id="spineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#14461B"/>
          <stop offset="25%" stop-color="#235E28"/>
          <stop offset="55%" stop-color="#2E7D32"/>
          <stop offset="85%" stop-color="#235E28"/>
          <stop offset="100%" stop-color="#14461B"/>
        </linearGradient>
        <radialGradient id="patronHaloGlow" cx="50%" cy="38%" r="44%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/>
          <stop offset="65%" stop-color="#C2DEC8" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#B2D8BD" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <!-- Background with graph paper grid -->
      <rect width="800" height="1100" fill="#FAF7EF"/>
      <rect x="76" width="724" height="1100" fill="url(#coverGrid)"/>

      <!-- Left Green Spine Band -->
      <rect x="0" y="0" width="76" height="1100" fill="url(#spineGrad)"/>
      <line x1="76" y1="0" x2="76" y2="1100" stroke="#0D2E12" stroke-width="2"/>

      <!-- White Dashed Stitching Line -->
      <line x1="38" y1="15" x2="38" y2="1085" stroke="rgba(255, 255, 255, 0.75)" stroke-width="2.5" stroke-dasharray="8 8"/>

      <!-- White Ring Dots / Eyelets -->
      ${ringDots.join('')}

      <!-- School Header: Crest -->
      <g transform="translate(118, 58)">
        <g fill="none" stroke="#1E6532" stroke-width="2.2" stroke-linecap="round">
          <path d="M50 88 C32 88 18 74 18 50 C18 36 26 22 38 14" />
          <path d="M22 65 Q14 60 18 52 Q24 58 22 65 Z" fill="#1E6532" />
          <path d="M20 48 Q12 42 18 36 Q23 42 20 48 Z" fill="#1E6532" />
          <path d="M26 33 Q18 26 26 22 Q29 29 26 33 Z" fill="#1E6532" />
          <path d="M36 21 Q30 14 38 12 Q40 19 36 21 Z" fill="#1E6532" />
          <path d="M50 88 C68 88 82 74 82 50 C82 36 74 22 62 14" />
          <path d="M78 65 Q86 60 82 52 Q76 58 78 65 Z" fill="#1E6532" />
          <path d="M80 48 Q88 42 82 36 Q77 42 80 48 Z" fill="#1E6532" />
          <path d="M74 33 Q82 26 74 22 Q71 29 74 33 Z" fill="#1E6532" />
          <path d="M64 21 Q70 14 62 12 Q60 19 64 21 Z" fill="#1E6532" />
        </g>
        <path d="M34 26 L66 26 C66 52 50 68 50 68 C50 68 34 52 34 26 Z" fill="#E8F4EA" stroke="#1E6532" stroke-width="2.4" />
        <path d="M40 38 Q50 35 50 42 Q50 35 60 38 L60 48 Q50 45 50 52 Q50 45 40 48 Z" fill="#FFFFFF" stroke="#1E6532" stroke-width="1.4" />
        <line x1="50" y1="36" x2="50" y2="52" stroke="#1E6532" stroke-width="1.4" />
        <circle cx="50" cy="30" r="3" fill="#D9822B" />
        <polygon points="50,6 52,11 57,11 53,14 55,19 50,16 45,19 47,14 43,11 48,11" fill="#1E6532" />
        <path d="M24 84 Q50 92 76 84 L73 78 Q50 84 27 78 Z" fill="#1E6532" />
        <text x="50" y="83" font-family="'Plus Jakarta Sans', sans-serif" font-size="4.6" font-weight="800" fill="#FFF" text-anchor="middle" letter-spacing="0.5">EST. 2026</text>
      </g>

      <!-- Centerpiece Framed Portrait (San John Gi) -->
      <g transform="translate(246, 230)">
        <rect x="0" y="0" width="356" height="420" fill="#BDD9C3" stroke="#1E6532" stroke-width="4.5" rx="2"/>
        <rect x="8" y="8" width="340" height="404" fill="none" stroke="#1E6532" stroke-width="1.8" stroke-dasharray="5 3"/>

        <g transform="translate(8, 8) scale(1.41, 1.43)">
          <circle cx="120" cy="115" r="76" fill="url(#patronHaloGlow)" stroke="#1E6532" stroke-width="2.2" />
          <circle cx="120" cy="115" r="71" fill="none" stroke="#1E6532" stroke-width="0.8" stroke-dasharray="3 3" />

          <path d="M42 278 C46 220 78 190 102 184 L102 165 L138 165 L138 184 C162 190 194 220 198 278 Z" fill="#1E6532" />
          <path d="M85 200 C80 230 75 260 70 278" stroke="#134720" stroke-width="3" stroke-linecap="round" />
          <path d="M155 200 C160 230 165 260 170 278" stroke="#134720" stroke-width="3" stroke-linecap="round" />

          <rect x="108" y="165" width="24" height="42" fill="#FFFFFF" stroke="#1E6532" stroke-width="1.8" />
          <line x1="120" y1="165" x2="120" y2="207" stroke="#1E6532" stroke-width="1.5" />
          <path d="M102 165 L138 165 L134 158 L106 158 Z" fill="#FFFFFF" stroke="#1E6532" stroke-width="1.5" />

          <ellipse cx="120" cy="120" rx="38" ry="46" fill="#E8F4EB" stroke="#1E6532" stroke-width="2" />
          <path d="M84 104 C84 76 156 76 156 104 C156 86 142 80 120 80 C98 80 84 86 84 104 Z" fill="#1E6532" />
          <ellipse cx="120" cy="80" rx="28" ry="10" fill="#1E6532" />
          <path d="M83 104 C81 122 84 136 86 142 C89 132 88 116 86 104 Z" fill="#1E6532" />
          <path d="M157 104 C159 122 156 136 154 142 C151 132 152 116 154 104 Z" fill="#1E6532" />

          <path d="M96 108 Q107 105 114 108" fill="none" stroke="#1E6532" stroke-width="2.5" stroke-linecap="round" />
          <path d="M126 108 Q133 105 144 108" fill="none" stroke="#1E6532" stroke-width="2.5" stroke-linecap="round" />
          <ellipse cx="106" cy="115" rx="5" ry="3.5" fill="#1E6532" />
          <ellipse cx="134" cy="115" rx="5" ry="3.5" fill="#1E6532" />
          <path d="M100 112 Q106 110 112 113" fill="none" stroke="#1E6532" stroke-width="1.6" />
          <path d="M128 113 Q134 110 140 112" fill="none" stroke="#1E6532" stroke-width="1.6" />
          <path d="M120 110 L118 132 L124 133" fill="none" stroke="#1E6532" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M110 145 Q120 148 130 145" fill="none" stroke="#1E6532" stroke-width="2.2" stroke-linecap="round" />
          <path d="M114 154 Q120 156 126 154" fill="none" stroke="#1E6532" stroke-width="1.5" />
          <path d="M96 125 Q99 135 102 142" fill="none" stroke="#1E6532" stroke-width="1" stroke-dasharray="1 2" />
          <path d="M144 125 Q141 135 138 142" fill="none" stroke="#1E6532" stroke-width="1" stroke-dasharray="1 2" />
        </g>
      </g>

      <!-- Form Underline Rules aligned with Image 5 -->
      <line x1="295" y1="795" x2="735" y2="795" stroke="#1E6532" stroke-width="2.2"/>
      <line x1="295" y1="885" x2="735" y2="885" stroke="#1E6532" stroke-width="2.2"/>
      <line x1="295" y1="950" x2="735" y2="950" stroke="#1E6532" stroke-width="2.2"/>
      <line x1="295" y1="1010" x2="735" y2="1010" stroke="#1E6532" stroke-width="2.2"/>

      <!-- Outer fine border -->
      <rect x="1" y="1" width="798" height="1098" fill="none" stroke="#235E28" stroke-width="2" rx="4"/>
    </svg>`;

    const img = new Image();
    let isRendered = false;

    const render = () => {
      ctx.clearRect(0, 0, 800, 1100);
      if (img.naturalWidth) {
        ctx.drawImage(img, 0, 0, 800, 1100);
      } else {
        // Immediate base background before image load
        ctx.fillStyle = '#FAF7EF';
        ctx.fillRect(0, 0, 800, 1100);
        ctx.fillStyle = '#235E28';
        ctx.fillRect(0, 0, 76, 1100);
        ctx.strokeStyle = '#1E6532';
        ctx.lineWidth = 2.2;
        [795, 885, 950, 1010].forEach(y => {
          ctx.beginPath();
          ctx.moveTo(295, y);
          ctx.lineTo(735, y);
          ctx.stroke();
        });
      }

      // School Institution Title & Subtitle rendered with crisp document web fonts
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1E6532';
      ctx.font = '900 32px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('STA. JOHN GI ACADEMY', 202, 102);

      ctx.fillStyle = '#2E7D32';
      ctx.font = '800 12.5px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('OFFICIAL STUDENT NOTEBOOK', 204, 128);

      // Form Field Labels
      ctx.fillStyle = '#1E6532';
      ctx.font = '800 17px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('NAME', 120, 785);
      ctx.fillText('SUBJECT', 120, 845);
      ctx.fillText('GRADE / LEVEL', 120, 940);
      ctx.fillText('TEACHER', 120, 1000);

      // Student Blue Ballpen Handwriting in Patrick Hand (exact match to Image 5)
      ctx.fillStyle = '#174092';
      ctx.font = 'bold 34px "Patrick Hand", "Caveat", cursive';
      ctx.fillText(member.name || 'Nicole De Guzman', 300, 785);

      ctx.font = 'bold 29px "Patrick Hand", "Caveat", cursive';
      ctx.fillText('Advanced Emerging', 300, 836);
      ctx.fillText('Technologies', 300, 872);

      ctx.font = 'bold 34px "Patrick Hand", "Caveat", cursive';
      ctx.fillText(member.section || 'BSIT 3-1', 300, 940);
      ctx.fillText(member.teacher || 'Sir Sean Dyogi', 300, 1000);

      texture.needsUpdate = true;
      isRendered = true;
    };

    img.onload = render;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

    if (img.complete && img.naturalWidth) {
      render();
    } else {
      render(); // Initial fast draw
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(render).catch(() => { });
      if (document.fonts.load) {
        Promise.all([
          document.fonts.load('900 32px "Plus Jakarta Sans"'),
          document.fonts.load('bold 34px "Patrick Hand"')
        ]).then(render).catch(() => { });
      }
    }

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.02, 1.38),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88 })
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.0335;
    face.receiveShadow = true;
    book.add(face);

    return book;
  }

  createIntermediatePad(member) {
    if (member && member.id === 4) {
      return this.createNicoleNotebook(member);
    }
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
      const displayName = member.titleText || member.name;
      [displayName, member.school, member.grade, member.section].forEach((value, i) => {
        if (value) ctx.fillText(value, 232, 675 + 70 * i, 495);
      });
      map.needsUpdate = true;
    }
    art.onload = draw;
    art.src = 'assets/textures/pad-cover.png';
    document.fonts.load('43px "Patrick Hand"').then(draw).catch(() => { });
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
    cardLayer(folder, 0.09, 0.014, 0.34, 0.535, -0.021, -0.35, this.studentPaint('#1F3FBF'));
    for (let i = 0; i < 6; i++) {
      cardLayer(folder, 0.94, 0.004, 1.45, (i % 3) * 0.004, -0.011 + i * 0.004, 0, paper);
    }
    const hinge = new THREE.Group();
    hinge.name = 'long-folder-hinge';
    hinge.position.set(-0.5, 0.018, 0);
    folder.add(hinge);
    folder.scale.set(1.18, 1, 1.18);
    cardLayer(hinge, 1, 0.012, 1.53, 0.5, 0, 0, card);

    const map = JohnFolderArt.get(member).texture;
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
    document.fonts.load('600 35px "Dancing Script"').then(draw).catch(() => { });
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
        "titleText": "Nicole Leigh G. De Guzman",
        "section": "BSIT 3-1",
        "school": "Sta. John Gi Academy",
        "grade": "BSIT 3-1",
        "subject": "Advanced Emerging Technologies",
        "teacher": "Sir Sean Dyogi",
        "deskItem": "intermediate-pad",
        "tagline": "Powered by careful planning and a fear of redoing work.",
        "folderLabel": "sta_john_gi_notebook",
        "photo": "assets/photos/nicole-portrait.jpg",
        "coverColor": "#2E7D32"
      }
    ];

    membersList.forEach((member, i) => {
      const layout = tabletopLayout.find(entry => entry.item === member.deskItem) || tabletopLayout.filter(entry => entry.item !== 'laptop')[i % 4];
      let folderMesh;
      switch (member.deskItem) {
        case 'intermediate-pad': folderMesh = (member.id === 4) ? this.createNicoleNotebook(member) : this.createIntermediatePad(member); break;
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

  cachedDetailTexture(key, width, height, draw) {
    this.detailTextures ||= new Map();
    if (this.detailTextures.has(key)) return this.detailTextures.get(key);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const texture = new THREE.CanvasTexture(canvas); texture.anisotropy = 4;
    this.detailTextures.set(key, texture);
    const paint = () => { draw(canvas.getContext('2d')); texture.needsUpdate = true };
    document.fonts.ready.then(() => { if (window.requestIdleCallback) requestIdleCallback(paint, { timeout: 600 }); else setTimeout(paint, 0) });
    return texture;
  }

  detailLaptop(laptop, lid, metal) {
    const ink = this.studentPaint('#1F2937'), trim = this.studentPaint('#64748B');
    const stickers = this.cachedDetailTexture('laptop-stickers', 512, 384, ctx => {
      ctx.fillStyle = '#475569'; ctx.fillRect(0, 0, 512, 384); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      let seed = 913; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      const sticker = (x, y, w, h, color, draw) => { ctx.save(); ctx.translate(x, y); ctx.rotate((random() - .5) * .22); ctx.fillStyle = color; ctx.strokeStyle = '#3A2312'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 12); ctx.fill(); ctx.stroke(); draw(); ctx.restore() };
      sticker(110, 98, 130, 112, '#FFF3D6', () => { ctx.fillStyle = '#D98236'; ctx.fillRect(-34, -14, 60, 45); ctx.strokeRect(-34, -14, 60, 45); ctx.beginPath(); ctx.arc(31, 4, 14, -Math.PI / 2, Math.PI / 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-45, 37); ctx.lineTo(42, 37); ctx.stroke(); ctx.strokeStyle = '#A1593A'; ctx.beginPath(); ctx.moveTo(-12, -24); ctx.bezierCurveTo(-36, -48, 18, -45, -5, -62); ctx.stroke() });
      sticker(290, 85, 124, 90, '#F8CECE', () => { ctx.fillStyle = '#D84B5A'; ctx.beginPath(); ctx.moveTo(0, 29); ctx.bezierCurveTo(-78, -15, -19, -56, 0, -23); ctx.bezierCurveTo(24, -59, 77, -13, 0, 29); ctx.fill(); ctx.stroke() });
      sticker(375, 194, 170, 67, '#D0E7F5', () => { ctx.font = 'bold 31px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#263D64'; ctx.fillText('Ctrl+Z', 0, 11) });
      sticker(90, 264, 100, 99, '#F8D66B', () => { ctx.fillStyle = '#E9A82D'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 17 : 38; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) } ctx.closePath(); ctx.fill(); ctx.stroke() });
      sticker(251, 234, 115, 113, '#D9E6C9', () => { ctx.fillStyle = '#FFFEF4'; for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate(i * Math.PI * 2 / 5); ctx.beginPath(); ctx.ellipse(0, -21, 13, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore() } ctx.fillStyle = '#F1C958'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke() });
      sticker(357, 325, 200, 63, '#FFF8E7', () => { ctx.font = 'bold 28px "Patrick Hand", cursive'; ctx.textAlign = 'center'; ctx.fillStyle = '#264C8C'; ctx.fillText('BSIT 3-1', 0, 10) });
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2.12, 1.36), new THREE.MeshStandardMaterial({ map: stickers, roughness: .8 }));
    back.name = 'laptop-sticker-lid'; back.position.z = -.043; back.rotation.y = Math.PI; lid.add(back);
    const keyboard = this.cachedDetailTexture('laptop-keyboard', 512, 256, ctx => {
      ctx.fillStyle = '#596A80'; ctx.fillRect(0, 0, 512, 256); ctx.fillStyle = '#283547'; ctx.fillRect(12, 12, 488, 179);
      for (let row = 0; row < 5; row++)for (let col = 0; col < 14; col++) {
        if (row === 4 && col > 3 && col < 10) continue;
        const x = 20 + col * 34, y = 20 + row * 32, w = row === 4 && col === 3 ? 234 : 29;
        ctx.fillStyle = '#D6DFE6'; ctx.strokeStyle = '#17283D'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, 26, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4E6079'; ctx.fillRect(x + 6, y + 6, row === 4 ? 10 : 6, 3);
      }
      ctx.fillStyle = '#334458'; ctx.beginPath(); ctx.roundRect(171, 202, 170, 45, 6); ctx.fill(); ctx.strokeStyle = '#8797A9'; ctx.lineWidth = 2; ctx.stroke();
    });
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(2.09, 1.45), new THREE.MeshStandardMaterial({ map: keyboard, roughness: .9 })); deck.name = 'laptop-keyboard'; deck.rotation.x = -Math.PI / 2; deck.position.set(0, .041, .02); laptop.add(deck);
    const pad = new THREE.Mesh(this.studentGeometry.box, trim); pad.name = 'laptop-recessed-trackpad'; pad.scale.set(.63, .002, .23); pad.position.set(0, .039, .57); laptop.add(pad);
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, 2.05, 12), metal); hinge.name = 'laptop-hinge'; hinge.rotation.z = Math.PI / 2; hinge.position.set(0, .06, -.73); laptop.add(hinge);
    const hardware = new THREE.InstancedMesh(this.studentGeometry.box, ink, 6), pose = new THREE.Object3D();
    const parts = [[-1.101, -.003, .35, .006, .025, .16], [1.101, -.003, .16, .006, .025, .18], ...[-.85, .85].flatMap(x => [-.56, .56].map(z => [x, -.038, z, .14, .015, .10]))];
    parts.forEach(([x, y, z, w, h, d], i) => { pose.position.set(x, y, z); pose.scale.set(w, h, d); pose.updateMatrix(); hardware.setMatrixAt(i, pose.matrix) }); hardware.name = 'laptop-ports-and-feet'; laptop.add(hardware);
    const webcam = new THREE.Mesh(this.studentGeometry.sphere, ink); webcam.scale.set(.023, .023, .012); webcam.position.set(0, .647, .046); lid.add(webcam);
    const chin = new THREE.Mesh(this.studentGeometry.box, ink); chin.scale.set(2.08, .04, .012); chin.position.set(0, -.645, .046); lid.add(chin);
    const edge = new THREE.Mesh(this.studentGeometry.box, trim); edge.scale.set(2.17, .014, 1.57); edge.position.y = .031; laptop.add(edge);
    laptop.traverse(o => { if (o.isMesh) o.userData.type = 'laptop' });
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

    const shape = new THREE.Shape(), w = 2.2, h = 1.45, r = .065;
    shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const lidGeo = new THREE.ExtrudeGeometry(shape, { depth: .08, bevelEnabled: false, curveSegments: 4 }); lidGeo.translate(0, 0, -.04);
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
    const screenGeo = new THREE.PlaneGeometry(2.04, 1.20);
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, 0.72, -0.75);
    screenMesh.rotation.x = 0.18;
    screenMesh.userData = { type: 'laptop' };
    laptopGroup.add(screenMesh);

    this.detailLaptop(laptopGroup, laptopLid, metalMat);

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

    cupGroup.position.set(4.44, .2, 1.52);
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
    this.puddle.position.set(4.12, .2, 1.30); this.puddle.scale.set(0, 0, 0);
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
    stickyNote.scale.setScalar(.5); stickyNote.position.set(-4.7, .21, -2.15);
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
    calendar.scale.setScalar(.65); calendar.position.set(-4.7, .21, 1.95);
    this.scene.add(calendar);
  }

  buildStickyNotes() {
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
    window.addEventListener('mouseup', () => this.onMouseUp());

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
    dom.addEventListener('pointerup', e => {
      if (e.pointerType !== 'touch' || this.studentInteractionBlocked() || this.hasDraggedMeaningfully) return;
      this.updateHover(e);
      if (this.isSpeakingSeat(this.hoveredObject)) {
        this.showStudentBubble(this.hoveredObject, 3000);
        this.resetHoverState();
      }
    });
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
    this.camera.fov = portrait ? 71 : compact ? 62 : CameraRig.SEAT_POSE.fov;
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
    this.hasDraggedMeaningfully = false;
  }

  onMouseUp() {
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
    if (e.sourceCapabilities?.firesTouchEvents) return;
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
    if (this.experiences?.concertActive) return;
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
      if (hitObject.userData.type === 'student-extra') { this.resetHoverState(); return; }

      if (this.hoveredObject !== hitObject) {
        this.resetHoverState();
        this.hoveredObject = hitObject;
        this.applyHoverState(hitObject, e);
      } else if (this.hoveredObject) {
        if (this.isSpeakingSeat(hitObject)) this.showStudentBubble(hitObject);
        else this.positionTooltip(e);
      }
    } else {
      this.resetHoverState();
    }
  }

  applyHoverState(obj, e) {
    document.body.style.cursor = 'pointer';

    if (this.isSpeakingSeat(obj)) {
      this.showStudentBubble(obj);
    } else if (obj.userData.type === 'whiteboard') {
      this.showTooltip('Click to draw on the whiteboard', e);
    } else if (obj.userData.type === 'placard') {
      obj.material.color.set(Theme['sun-glow']);
      this.showTooltip('Click to read placard', e);
    } else if (obj.userData.type === 'teacher') {
      if (!matchMedia('(pointer: coarse)').matches) this.showSean();
    } else if (obj.userData.type === 'front-desk') {
      this.showTooltip('Click to view the front desk', e);
    } else if (obj.userData.type === 'classroom-tv') {
      this.showTooltip('Click to zoom the TV', e);
    } else if (obj.userData.type === 'basketball') {
      this.showTooltip('Click the basketball', e);
    } else if (obj.userData.type === 'labibi') {
      this.showTooltip('Click to inspect ' + this.experiences.labibi.name, e);
    } else if (obj.userData.type === 'floor-scrap') {
      if (this.experiences?.speaking) this.hideTooltip(); else this.showTooltip('Click to read the wrapper', e);
    } else if (obj.userData.type === 'exit-door') {
      if (this.experiences?.speaking) this.hideTooltip(); else this.showTooltip('Try to leave the classroom', e);
    } else if (obj.userData.type === 'curtain') {
      this.hideTooltip();
    } else if (obj.userData.type === 'folder') {
      const folder = obj.userData.folderMesh || obj;
      const member = folder.userData.member;
      const itemLabel = (member.id === 4) ? 'School notebook' : (member.deskItem === 'spiral-notebook' ? 'Spiral notebook' : member.deskItem === 'theme-book' ? 'Theme book' : member.deskItem === 'intermediate-pad' ? 'Intermediate pad' : 'Long folder');
      const displayName = member.titleText || member.name;
      this.showTooltip(`<strong>${itemLabel}: ${displayName}</strong><br><em>“${member.tagline}”</em><br><small style="color:#38BDF8">Click anywhere to open portfolio</small>`, e);
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
    return !!this.experiences?.blocking || !this.inputEnabled || this.view === 'gliding' || this.isCameraZoomed || !!document.querySelector(
      '#bookOverlay.active, #whiteboard-overlay.active, .error-modal-overlay.active, .guestbook-modal-overlay.active, .note-view-modal-overlay.active');
  }

  hideSean() {
    clearTimeout(this.seanHideTimer);
    this.speechUntil = 0;
    this.teacherBubble?.classList.remove('visible');
  }

  showSean(duration = Infinity) {
    if (this.experiences?.speaking) return;
    if (this.view !== 'seat' || this.interactionBlocked()) return;
    clearTimeout(this.seanHideTimer);
    this.bubbleAnchor = null; this.bubbleStudentId = null;
    this.teacherBubble.style.maxWidth = ''; this.teacherBubble.style.overflowWrap = '';
    const lines = this.experiences?.teacherLines || (Array.isArray(this.classroom.teacherLines) && this.classroom.teacherLines.length
      ? this.classroom.teacherLines : classroomDefaults.teacherLines);
    if (this.experiences) this.experiences.paintBubble('Sir Sean', lines[this.speechIndex % lines.length], 'Click Sir Sean');
    else this.teacherBubble.textContent = lines[this.speechIndex % lines.length];
    this.speechIndex = (this.speechIndex + 1) % lines.length;
    this.speechUntil = performance.now() + duration;
    if (Number.isFinite(duration)) this.seanHideTimer = setTimeout(() => this.hideSean(), duration);
    this.hideTooltip();
  }

  onSeanClick() {
    this.experiences?.startConcert();
  }

  handleObjectClick(obj) {
    if (this.interactionBlocked()) return;
    if (this.experiences?.handleClick(obj)) return;
    const type = obj.userData.type;
    if (type === 'student-extra' || type === 'absent-seat') return;
    const tabletop = this.tabletopObject(obj);
    if (this.view === 'seat' && tabletop && type !== 'front-desk') return;
    if (this.view === 'desk' && !tabletop) return;

    if (type === 'whiteboard') {
      if (this.view === 'seat') this.whiteboardController?.open();
    } else if (type === 'front-desk') {
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
      this.closePlacard = null;
      card.remove();
      this.returnToDesk();
      previousFocus?.focus();
    };
    const onKey = event => {
      if (event.key === 'Escape') { event.stopImmediatePropagation(); close(); }
      if (event.key === 'Tab') event.preventDefault();
    };
    this.closePlacard = close;
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

  closeNoteViewerModal({ throwing = false } = {}) {
    const modal = document.getElementById('noteViewModal');
    if (modal) {
      modal.classList.remove('active');
      // After opacity transition ends, fully remove from layout
      modal.addEventListener('transitionend', () => {
        modal.style.display = 'none';
      }, { once: true });
    }

    // Animate sticky note back to desk surface
    if (!throwing && this.activeStickyMesh && typeof gsap !== 'undefined') {
      gsap.to(this.activeStickyMesh.position, {
        y: this.activeStickyMesh.userData.originalY !== undefined
          ? this.activeStickyMesh.userData.originalY
          : 0.205,
        duration: 0.45,
        ease: 'power2.out'
      });
    }
    this.activeStickyMesh = null;
    if (throwing) {
      this.camera.position.copy(this.preZoomPosition);
      this.camera.quaternion.copy(this.preZoomOrientation);
      this.isCameraZoomed = false;
    } else {
      this.returnToDesk();
    }
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

  getHomePose(obj) {
    return this.antiGravityHomes?.get(obj);
  }

  snapshotAntiGravityHomes() {
    this.antiGravityHomes = new Map();
    this.antiGravityMaterials = new Map();
    this.deskGroup.traverse(obj => {
      this.antiGravityHomes.set(obj, {
        position: obj.position.clone(), rotation: obj.rotation.clone(), scale: obj.scale.clone(),
        castShadow: obj.castShadow, receiveShadow: obj.receiveShadow, material: obj.material,
        materials: Array.isArray(obj.material) ? obj.material.slice() : null
      });
      for (const material of (Array.isArray(obj.material) ? obj.material : [obj.material])) {
        if (!material || this.antiGravityMaterials.has(material)) continue;
        const state = {};
        for (const key of ['opacity', 'transparent', 'depthWrite', 'depthTest', 'visible', 'wireframe', 'side', 'map']) state[key] = material[key];
        if (material.color) state.color = material.color.clone();
        if (material.emissive) state.emissive = material.emissive.clone();
        this.antiGravityMaterials.set(material, state);
      }
    });
  }

  finishAntiGravityReset() {
    for (const tween of this.antiGravityResetTweens) tween.kill();
    this.antiGravityResetTweens.length = 0;
    this.antiGravityHomes?.forEach((home, obj) => {
      obj.position.copy(home.position); obj.rotation.copy(home.rotation); obj.scale.copy(home.scale);
      obj.castShadow = home.castShadow; obj.receiveShadow = home.receiveShadow; obj.material = home.material;
      if (home.materials) home.material.splice(0, home.material.length, ...home.materials);
    });
    this.antiGravityMaterials?.forEach((state, material) => {
      let changed = false;
      for (const [key, value] of Object.entries(state)) {
        if (key === 'color' || key === 'emissive') {
          if (!material[key].equals(value)) { material[key].copy(value); changed = true; }
        } else if (material[key] !== value) { material[key] = value; changed = true; }
      }
      if (changed) material.needsUpdate = true;
    });
    this.deskGroup.updateMatrixWorld(true);
    this.antiGravityLanding = false;
    this.renderer.shadowMap.needsUpdate = true;
  }

  triggerAntiGravity() {
    if (this.isFloating) return;
    // A quick restart finishes the previous landing before taking a new snapshot.
    if (this.antiGravityLanding) this.finishAntiGravityReset();
    this.snapshotAntiGravityHomes();
    this.isFloating = true;

    if (window.PortfolioHumor) {
      window.PortfolioHumor.playSound('fanfare');
      window.PortfolioHumor.showToast('?? ZERO-G MODE ENGAGED! Desk is floating in zero gravity. Press "E" to toggle.');
    }

    if (typeof gsap !== 'undefined') {
      const home = this.getHomePose(this.deskGroup);
      const float = (target, vars) => this.antiGravityTweens.push(gsap.to(target, vars));
      float(this.deskGroup.position, { y: home.position.y + 2.2, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      float(this.deskGroup.rotation, { x: home.rotation.x + .08, z: home.rotation.z - .06, duration: 3.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      this.folders.forEach((f, idx) => {
        const pose = this.getHomePose(f.mesh);
        float(f.mesh.position, { y: pose.position.y + .6 + idx * .12, duration: 2 + idx * .3, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        float(f.mesh.rotation, { y: pose.rotation.y + .35, duration: 2.8 + idx * .4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      });
    }
  }

  stopAntiGravity() {
    if (!this.isFloating) return;
    this.isFloating = false;
    if (window.PortfolioHumor) {
      window.PortfolioHumor.playSound('pop');
      window.PortfolioHumor.showToast('?? Gravity Restored: Desk back on the ground.');
    }
    for (const tween of this.antiGravityTweens) tween.kill();
    this.antiGravityTweens.length = 0;
    this.antiGravityLanding = true;
    if (typeof gsap === 'undefined') { this.finishAntiGravityReset(); return; }
    this.antiGravityHomes.forEach((home, obj) => {
      for (const key of ['position', 'rotation', 'scale']) {
        const target = obj[key], pose = home[key];
        if (target.x === pose.x && target.y === pose.y && target.z === pose.z) continue;
        gsap.killTweensOf(target);
        const deskPosition = obj === this.deskGroup && key === 'position';
        this.antiGravityResetTweens.push(gsap.to(target, {
          x: pose.x, y: pose.y, z: pose.z,
          duration: deskPosition ? 1.2 : .8, ease: deskPosition ? 'bounce.out' : 'power2.out'
        }));
      }
    });
    // Copy exact values after the tween, including scale and Euler order, to prevent drift.
    this.antiGravityResetTweens.push(gsap.delayedCall(1.2, () => this.finishAntiGravityReset()));
  }


  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.experiences?.dark) return;

    if (this.pendingHover) {
      if (!this.isDraggingView && !this.isCameraZoomed) this.updateHover(this.pendingHover);
      this.pendingHover = null;
    }
    const seconds = performance.now() * 0.001;
    if (this.bubbleStudentId && this.studentInteractionBlocked()) {
      this.teacherBubble.classList.remove('visible'); this.speechUntil = 0;
    } else if (this.isSpeakingSeat(this.hoveredObject) && !this.isDraggingView) {
      this.speechUntil = Math.max(this.speechUntil, seconds * 1000 + 600);
    }
    for (const dancer of this.students) {
      if (!dancer.student.dance || this.view !== 'seat' || this.isCameraZoomed || !this.inputEnabled || this.studentMotionPreference.matches) continue;
      dancer.torso.rotation.z = .14 * Math.sin(seconds * 3.6);
      dancer.arms[0].rotation.x = .28 * (1 + Math.sin(seconds * 3.6));
      dancer.arms[1].rotation.x = .28 * (1 - Math.sin(seconds * 3.6));
      dancer.head.position.y = 1.48 + .045 * Math.sin(seconds * 7.2);
    }

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
      this.experiences?.update(seconds);
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

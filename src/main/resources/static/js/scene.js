/**
 * scene.js - 3D Messy Desk Environment using Three.js & GSAP
 * Features:
 * - 180-Degree Panoramic Free Look: Mouse drag or cursor movement sweeps full 180° around the room
 * - Rich surrounding student dorm room:
 *    • Left Wall: Window with moon/stars, floating bookshelf with textbooks & 3D yellow rubber duck, corkboard
 *    • Back Wall: Whiteboard with architecture sketch, fairy lights, AET poster
 *    • Right Wall: Framed diploma, mini-fridge with soda cans, cozy floor lamp, wastebasket
 * - 5 Member Folders labeled with folderLabel & name
 * - Interactive props: Coffee cup (spills), "Do not touch" sticky note (shakes folder or floats desk on double-click), Laptop (Motivation.exe error)
 * - Guestbook sticky notes on the desk
 * - Hover raycasting with funny tooltips
 * - GSAP camera zoom & folder animation
 * - 2D CSS Fallback if WebGL is unavailable
 */

class DeskScene {
  constructor(options = {}) {
    this.container = document.getElementById(options.containerId || 'scene-container');
    this.onFolderSelect = options.onFolderSelect || null;
    this.members = options.members || [];
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

    // 180-Degree Look-Around State
    // Yaw: -Math.PI / 2 (-90° left) to +Math.PI / 2 (+90° right) = 180 degrees
    this.targetYaw = 0;
    this.currentYaw = 0;
    this.targetPitch = 0;
    this.currentPitch = 0;
    this.isDraggingView = false;
    this.dragStartPos = { x: 0, y: 0 };
    this.dragStartAngles = { yaw: 0, pitch: 0 };

    this.defaultCameraPos = new THREE.Vector3(0, 4.0, 5.2);
    this.lookTarget = new THREE.Vector3(0, 1.2, 0);

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
    this.scene.background = new THREE.Color(0x0A0F1D);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 2. Setup Camera
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.camera.position.copy(this.defaultCameraPos);
    this.updateCameraLookAt();

    // 3. Setup Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting & Ambience
    this.setupLighting();

    // 5. Build Room Surrounding Environment (180° view)
    this.buildSurroundingRoom();

    // 6. Build Desk & Props
    this.buildDesk();
    this.buildFolders();
    this.buildProps();
    this.buildStickyNotes();

    // 7. Raycasting & Events
    this.raycaster = new THREE.Raycaster();
    // CRITICAL: Enable layer 1 so raycaster can hit invisible hitboxes on that layer.
    // Camera only renders layer 0 (default), so layer-1 meshes are NEVER drawn but are always intersectable.
    this.raycaster.layers.enable(1);
    this.bindEvents();

    // 8. Render Loop
    this.animate();
  }

  setupLighting() {
    // Warm ambient study room light
    const ambientLight = new THREE.AmbientLight(0xFFF1E6, 0.7);
    this.scene.add(ambientLight);

    // Main overhead study light above desk
    const deskLight = new THREE.DirectionalLight(0xFFFFFF, 0.9);
    deskLight.position.set(3, 8, 4);
    deskLight.castShadow = true;
    deskLight.shadow.mapSize.width = 1024;
    deskLight.shadow.mapSize.height = 1024;
    deskLight.shadow.camera.near = 0.5;
    deskLight.shadow.camera.far = 25;
    deskLight.shadow.bias = -0.001;
    this.scene.add(deskLight);

    // Cool blue laptop glow
    const laptopGlow = new THREE.PointLight(0x38BDF8, 0.8, 5);
    laptopGlow.position.set(-2.8, 1.6, -0.6);
    this.scene.add(laptopGlow);

    // Cozy floor lamp glow on right side
    const lampLight = new THREE.PointLight(0xF59E0B, 1.2, 10);
    lampLight.position.set(7.5, 5.0, -3.5);
    this.scene.add(lampLight);

    // Soft moon light coming from left window
    const windowLight = new THREE.DirectionalLight(0x818CF8, 0.4);
    windowLight.position.set(-12, 7, 0);
    this.scene.add(windowLight);
  }

  /**
   * Builds the surrounding room visible when looking 180 degrees left and right
   */
  buildSurroundingRoom() {
    this.roomGroup = new THREE.Group();

    // Room Box (Walls, Floor, Ceiling)
    const roomGeo = new THREE.BoxGeometry(22, 14, 18);
    const wallMat = new THREE.MeshLambertMaterial({
      color: 0x1E293B,
      side: THREE.BackSide
    });
    const roomBox = new THREE.Mesh(roomGeo, wallMat);
    roomBox.position.set(0, 5, -1);
    this.roomGroup.add(roomBox);

    // Cozy Rug on the floor
    const rugGeo = new THREE.PlaneGeometry(12, 9);
    const rugCanvas = document.createElement('canvas');
    rugCanvas.width = 512;
    rugCanvas.height = 384;
    const rCtx = rugCanvas.getContext('2d');
    rCtx.fillStyle = '#334155';
    rCtx.fillRect(0, 0, 512, 384);
    rCtx.strokeStyle = '#64748B';
    rCtx.lineWidth = 12;
    rCtx.strokeRect(20, 20, 472, 344);
    rCtx.strokeStyle = '#38BDF8';
    rCtx.lineWidth = 4;
    rCtx.strokeRect(36, 36, 440, 312);
    // Geometric diamonds pattern
    rCtx.fillStyle = '#1E293B';
    for (let x = 70; x < 450; x += 60) {
      rCtx.beginPath();
      rCtx.arc(x, 192, 18, 0, Math.PI * 2);
      rCtx.fill();
    }
    const rugTex = new THREE.CanvasTexture(rugCanvas);
    const rugMat = new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.9 });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, -0.01, 0.5);
    rug.receiveShadow = true;
    this.roomGroup.add(rug);

    // ==========================================
    // 1. LEFT WALL (-90° view): Window, Bookshelf, Rubber Duck, Corkboard
    // ==========================================
    const leftWallGroup = new THREE.Group();

    // Window with Night Sky & Moon
    const windowGeo = new THREE.BoxGeometry(0.2, 5.0, 4.0);
    const winCanvas = document.createElement('canvas');
    winCanvas.width = 256;
    winCanvas.height = 320;
    const wCtx = winCanvas.getContext('2d');
    // Dark starry sky
    const skyGrad = wCtx.createLinearGradient(0, 0, 0, 320);
    skyGrad.addColorStop(0, '#020617');
    skyGrad.addColorStop(1, '#1E1B4B');
    wCtx.fillStyle = skyGrad;
    wCtx.fillRect(0, 0, 256, 320);
    // Glowing Moon
    wCtx.fillStyle = '#FEF08A';
    wCtx.shadowColor = '#FDE047';
    wCtx.shadowBlur = 20;
    wCtx.beginPath();
    wCtx.arc(190, 70, 28, 0, Math.PI * 2);
    wCtx.fill();
    wCtx.shadowBlur = 0;
    // Stars
    wCtx.fillStyle = '#FFFFFF';
    for (let s = 0; s < 40; s++) {
      const sx = (s * 47) % 256;
      const sy = (s * 31) % 280;
      wCtx.fillRect(sx, sy, 2, 2);
    }
    // Window Panes
    wCtx.strokeStyle = '#334155';
    wCtx.lineWidth = 10;
    wCtx.strokeRect(0, 0, 256, 320);
    wCtx.beginPath();
    wCtx.moveTo(128, 0); wCtx.lineTo(128, 320);
    wCtx.moveTo(0, 160); wCtx.lineTo(256, 160);
    wCtx.stroke();

    const winTex = new THREE.CanvasTexture(winCanvas);
    const winMat = new THREE.MeshBasicMaterial({ map: winTex });
    const windowMesh = new THREE.Mesh(windowGeo, winMat);
    windowMesh.position.set(-10.8, 5.5, 0.5);
    leftWallGroup.add(windowMesh);

    // Bookshelf
    const shelfGeo = new THREE.BoxGeometry(0.8, 0.12, 3.2);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350F, roughness: 0.7 });
    const shelf = new THREE.Mesh(shelfGeo, woodMat);
    shelf.position.set(-10.4, 4.0, 3.2);
    leftWallGroup.add(shelf);

    // Colorful 3D Books on shelf
    const bookColors = [0xEF4444, 0x3B82F6, 0x10B981, 0xF59E0B, 0x8B5CF6, 0x06B6D4];
    bookColors.forEach((color, idx) => {
      const bGeo = new THREE.BoxGeometry(0.55, 0.75 + (idx % 2) * 0.15, 0.18);
      const bMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5 });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.set(-10.4, 4.45 + (idx % 2) * 0.08, 2.0 + idx * 0.28);
      leftWallGroup.add(bMesh);
    });

    // 3D Yellow Rubber Duck (Official Debugger) on shelf
    const duckGroup = new THREE.Group();
    const duckMat = new THREE.MeshStandardMaterial({ color: 0xFACC15, roughness: 0.3 });
    // Duck body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), duckMat);
    duckGroup.add(body);
    // Duck head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), duckMat);
    head.position.set(0.15, 0.22, 0);
    duckGroup.add(head);
    // Duck beak
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xFB923C, roughness: 0.4 });
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 12), beakMat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.35, 0.22, 0);
    duckGroup.add(beak);
    // Duck eye
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeMat);
    eye.position.set(0.24, 0.28, 0.1);
    duckGroup.add(eye);

    duckGroup.position.set(-10.4, 4.3, 3.8);
    duckGroup.rotation.y = -Math.PI / 2;
    duckGroup.userData = { type: 'duck' };
    this.duck = duckGroup;
    this.interactiveObjects.push(duckGroup);
    leftWallGroup.add(duckGroup);

    // Corkboard on left wall
    const corkCanvas = document.createElement('canvas');
    corkCanvas.width = 256;
    corkCanvas.height = 256;
    const ckCtx = corkCanvas.getContext('2d');
    ckCtx.fillStyle = '#B45309';
    ckCtx.fillRect(0, 0, 256, 256);
    ckCtx.fillStyle = '#D97706';
    ckCtx.fillRect(10, 10, 236, 236);
    // Sticky notes on corkboard
    ckCtx.fillStyle = '#FEF08A';
    ckCtx.fillRect(30, 30, 80, 80);
    ckCtx.fillStyle = '#0F172A';
    ckCtx.font = 'bold 12px sans-serif';
    ckCtx.fillText('TODO:', 40, 50);
    ckCtx.font = '10px sans-serif';
    ckCtx.fillText('1. Code', 40, 70);
    ckCtx.fillText('2. Panic', 40, 85);
    ckCtx.fillText('3. A+ grade!', 40, 100);

    ckCtx.fillStyle = '#FBCFE8';
    ckCtx.fillRect(140, 70, 85, 75);
    ckCtx.fillStyle = '#831843';
    ckCtx.font = 'bold 10px sans-serif';
    ckCtx.fillText('"Sleep is a DLC"', 145, 110);

    const corkTex = new THREE.CanvasTexture(corkCanvas);
    const corkGeo = new THREE.BoxGeometry(0.1, 2.5, 2.5);
    const corkMat = new THREE.MeshStandardMaterial({ map: corkTex, roughness: 0.9 });
    const corkboard = new THREE.Mesh(corkGeo, corkMat);
    corkboard.position.set(-10.8, 6.2, -2.8);
    leftWallGroup.add(corkboard);

    this.roomGroup.add(leftWallGroup);

    // ==========================================
    // 2. BACK WALL (Center View): Whiteboard, AET Banner, Fairy String Lights
    // ==========================================
    const backWallGroup = new THREE.Group();

    // Large Whiteboard with Architecture Diagram
    const wbCanvas = document.createElement('canvas');
    wbCanvas.width = 512;
    wbCanvas.height = 256;
    const bCtx = wbCanvas.getContext('2d');
    bCtx.fillStyle = '#F8FAFC';
    bCtx.fillRect(0, 0, 512, 256);
    bCtx.strokeStyle = '#94A3B8';
    bCtx.lineWidth = 8;
    bCtx.strokeRect(0, 0, 512, 256);

    // Diagram title
    bCtx.fillStyle = '#0369A1';
    bCtx.font = 'bold 20px sans-serif';
    bCtx.fillText('AET PROJECT SYSTEM ARCHITECTURE', 30, 40);

    // Diagram boxes
    bCtx.fillStyle = '#0284C7';
    bCtx.fillRect(30, 70, 110, 60);
    bCtx.fillStyle = '#FFFFFF';
    bCtx.font = 'bold 14px sans-serif';
    bCtx.fillText('Browser UI', 45, 95);
    bCtx.font = '11px sans-serif';
    bCtx.fillText('Three.js / GSAP', 38, 115);

    bCtx.fillStyle = '#64748B';
    bCtx.font = 'bold 20px sans-serif';
    bCtx.fillText('➔ fetch ➔', 150, 105);

    bCtx.fillStyle = '#059669';
    bCtx.fillRect(250, 70, 110, 60);
    bCtx.fillStyle = '#FFFFFF';
    bCtx.font = 'bold 14px sans-serif';
    bCtx.fillText('Spring Boot 3', 258, 95);
    bCtx.font = '11px sans-serif';
    bCtx.fillText('REST Controller', 258, 115);

    bCtx.fillStyle = '#64748B';
    bCtx.font = 'bold 20px sans-serif';
    bCtx.fillText('➔ JSON ➔', 370, 105);

    bCtx.fillStyle = '#7C3AED';
    bCtx.fillRect(455, 70, 50, 60);
    bCtx.fillStyle = '#FFFFFF';
    bCtx.font = 'bold 12px sans-serif';
    bCtx.fillText('Files', 462, 105);

    // Funny note at bottom of whiteboard
    bCtx.fillStyle = '#DC2626';
    bCtx.font = 'italic bold 15px sans-serif';
    bCtx.fillText('Formula: Coffee + Caffeine = High GPA (Hypothesis under test)', 30, 200);

    const wbTex = new THREE.CanvasTexture(wbCanvas);
    const wbGeo = new THREE.PlaneGeometry(6.5, 3.25);
    const wbMat = new THREE.MeshBasicMaterial({ map: wbTex });
    const whiteboard = new THREE.Mesh(wbGeo, wbMat);
    whiteboard.position.set(0, 6.2, -9.85);
    backWallGroup.add(whiteboard);

    // Fairy String Lights hanging along the top of the back wall
    const lightCordGeo = new THREE.BufferGeometry();
    const cordPoints = [];
    for (let x = -7; x <= 7; x += 0.5) {
      cordPoints.push(new THREE.Vector3(x, 9.5 + Math.sin(x * 1.5) * 0.2, -9.7));
    }
    lightCordGeo.setFromPoints(cordPoints);
    const cordMat = new THREE.LineBasicMaterial({ color: 0x334155 });
    const cord = new THREE.Line(lightCordGeo, cordMat);
    backWallGroup.add(cord);

    // Glowing fairy light bulbs
    for (let x = -6.5; x <= 6.5; x += 1.1) {
      const bulbGeo = new THREE.SphereGeometry(0.08, 8, 8);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xFDE047 });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(x, 9.4 + Math.sin(x * 1.5) * 0.2, -9.7);
      backWallGroup.add(bulb);
    }

    this.roomGroup.add(backWallGroup);

    // ==========================================
    // 3. RIGHT WALL (+90° view): Certificate, Floor Lamp, Snack Corner / Mini Fridge
    // ==========================================
    const rightWallGroup = new THREE.Group();

    // Framed Certificate on the wall
    const certCanvas = document.createElement('canvas');
    certCanvas.width = 256;
    certCanvas.height = 320;
    const crCtx = certCanvas.getContext('2d');
    crCtx.fillStyle = '#FDF6E2';
    crCtx.fillRect(0, 0, 256, 320);
    crCtx.strokeStyle = '#D97706';
    crCtx.lineWidth = 14;
    crCtx.strokeRect(0, 0, 256, 320);

    crCtx.fillStyle = '#78350F';
    crCtx.font = 'bold 18px serif';
    crCtx.textAlign = 'center';
    crCtx.fillText('CERTIFICATE OF ACCOMPLISHMENT', 128, 60);

    crCtx.font = 'italic 12px serif';
    crCtx.fillText('This hereby certifies that', 128, 100);

    crCtx.font = 'bold 20px sans-serif';
    crCtx.fillStyle = '#1E3A8A';
    crCtx.fillText('AET GROUP 5', 128, 135);

    crCtx.font = '12px serif';
    crCtx.fillStyle = '#451A03';
    crCtx.fillText('has successfully centered a <div>', 128, 175);
    crCtx.fillText('without having a mental breakdown.', 128, 195);

    // Gold seal
    crCtx.fillStyle = '#F59E0B';
    crCtx.beginPath();
    crCtx.arc(128, 250, 24, 0, Math.PI * 2);
    crCtx.fill();
    crCtx.fillStyle = '#78350F';
    crCtx.font = 'bold 11px sans-serif';
    crCtx.fillText('100% OK', 128, 254);

    const certTex = new THREE.CanvasTexture(certCanvas);
    const certGeo = new THREE.BoxGeometry(0.1, 2.8, 2.2);
    const certMat = new THREE.MeshStandardMaterial({ map: certTex, roughness: 0.6 });
    const certMesh = new THREE.Mesh(certGeo, certMat);
    certMesh.position.set(10.8, 6.0, -1.5);
    rightWallGroup.add(certMesh);

    // Cozy Floor Lamp (Pole + Lampshade)
    const lampPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 6.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.8 })
    );
    lampPole.position.set(8.5, 3.25, -4.5);
    rightWallGroup.add(lampPole);

    const shadeGeo = new THREE.CylinderGeometry(0.5, 0.8, 0.9, 16, 1, true);
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0xFDE68A, roughness: 0.2, side: THREE.DoubleSide });
    const shadeMesh = new THREE.Mesh(shadeGeo, shadeMat);
    shadeMesh.position.set(8.5, 6.2, -4.5);
    rightWallGroup.add(shadeMesh);

    // Student Snack Corner: Mini-Fridge
    const fridgeGeo = new THREE.BoxGeometry(1.6, 2.2, 1.6);
    const fridgeMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.3, roughness: 0.4 });
    const fridge = new THREE.Mesh(fridgeGeo, fridgeMat);
    fridge.position.set(9.2, 1.1, 2.5);
    fridge.castShadow = true;
    rightWallGroup.add(fridge);

    // Energy Drink Cans on top of the mini-fridge
    const canColors = [0xEF4444, 0x10B981, 0x3B82F6];
    canColors.forEach((cc, cIdx) => {
      const canGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.35, 16);
      const canMat = new THREE.MeshStandardMaterial({ color: cc, metalness: 0.8, roughness: 0.2 });
      const can = new THREE.Mesh(canGeo, canMat);
      can.position.set(9.0 + (cIdx * 0.24) - 0.24, 2.38, 2.5 + ((cIdx % 2) * 0.15) - 0.08);
      rightWallGroup.add(can);
    });

    // Pizza box on fridge
    const pizzaGeo = new THREE.BoxGeometry(0.9, 0.09, 0.9);
    const pizzaMat = new THREE.MeshStandardMaterial({ color: 0xCA8A04, roughness: 0.8 });
    const pizzaBox = new THREE.Mesh(pizzaGeo, pizzaMat);
    pizzaBox.position.set(9.2, 2.25, 2.1);
    pizzaBox.rotation.y = 0.25;
    rightWallGroup.add(pizzaBox);

    // Wastepaper basket with crumpled paper balls
    const binGeo = new THREE.CylinderGeometry(0.35, 0.25, 0.7, 16, 1, true);
    const binMat = new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.5, side: THREE.DoubleSide });
    const bin = new THREE.Mesh(binGeo, binMat);
    bin.position.set(4.8, 0.35, 3.2);
    rightWallGroup.add(bin);

    // Crumpled paper
    for (let p = 0; p < 4; p++) {
      const paperBall = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.08),
        new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.9 })
      );
      paperBall.position.set(4.8 + (Math.random() - 0.5) * 0.15, 0.25 + p * 0.08, 3.2 + (Math.random() - 0.5) * 0.15);
      rightWallGroup.add(paperBall);
    }

    this.roomGroup.add(rightWallGroup);

    this.scene.add(this.roomGroup);
  }

  buildDesk() {
    this.deskGroup = new THREE.Group();

    // Wooden tabletop
    const deskGeo = new THREE.BoxGeometry(10.5, 0.35, 6.2);
    const deskMat = new THREE.MeshStandardMaterial({
      color: 0x854D0E,
      roughness: 0.65,
      metalness: 0.08
    });
    const deskMesh = new THREE.Mesh(deskGeo, deskMat);
    deskMesh.receiveShadow = true;
    this.deskGroup.add(deskMesh);

    // Desk edge trim
    const trimGeo = new THREE.BoxGeometry(10.6, 0.4, 6.3);
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x713F12, roughness: 0.8 });
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.y = -0.04;
    this.deskGroup.add(trimMesh);

    // Desk legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 5, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.8, roughness: 0.3 });
    const legPositions = [
      [-4.8, -2.6, -2.6],
      [4.8, -2.6, -2.6],
      [-4.8, -2.6, 2.6],
      [4.8, -2.6, 2.6]
    ];
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(pos[0], pos[1], pos[2]);
      leg.castShadow = true;
      this.deskGroup.add(leg);
    });

    // Desk mat
    const matGeo = new THREE.BoxGeometry(9.2, 0.02, 4.6);
    const matMaterial = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.9 });
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
    ctx.fillText(name.toUpperCase(), 115, 230);

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

  buildFolders() {
    this.folders = [];
    const membersList = this.members.length > 0 ? this.members : [
      { id: 1, name: "Joshua Deliva", folderLabel: "FINAL_v7_REALLYFINAL_dontopen", coverColor: "#FF7A00" },
      { id: 2, name: "Maria Santos", folderLabel: "Do Not Open (Seriously)", coverColor: "#8B5CF6" },
      { id: 3, name: "Kenji Sato", folderLabel: "Homework (Unfinished)", coverColor: "#0284C7" },
      { id: 4, name: "Sophia Reyes", folderLabel: "secret_thesis_do_not_delete", coverColor: "#059669" },
      { id: 5, name: "Liam Garcia", folderLabel: "Project_Backup_Of_Backup_FINAL", coverColor: "#E11D48" }
    ];

    const folderLayouts = [
      { x: -3.0, z: 0.9, rotY: 0.08, rotZ: 0.02 },
      { x: -1.5, z: 0.7, rotY: -0.06, rotZ: -0.01 },
      { x: 0.0,  z: 0.8, rotY: 0.04, rotZ: 0.01 },
      { x: 1.5,  z: 0.65, rotY: -0.08, rotZ: -0.02 },
      { x: 3.0,  z: 0.85, rotY: 0.10, rotZ: 0.03 }
    ];

    membersList.forEach((member, i) => {
      const layout = folderLayouts[i % folderLayouts.length];
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

      const folderMesh = new THREE.Mesh(folderGeo, materials);
      const posY = 0.22 + i * 0.01;
      folderMesh.position.set(layout.x, posY, layout.z);
      folderMesh.rotation.set(0, layout.rotY, layout.rotZ);
      folderMesh.castShadow = true;
      folderMesh.receiveShadow = true;

      folderMesh.userData = {
        type: 'folder',
        member: member,
        index: i,
        originalPos: { x: layout.x, y: posY, z: layout.z },
        originalRot: { x: 0, y: layout.rotY, z: layout.rotZ }
      };

      // Full-coverage generous hit-box mesh on Layer 1 (raycaster-only, never rendered by camera)
      const hitBoxGeo = new THREE.BoxGeometry(1.7, 0.9, 2.3);
      const hitBoxMat = new THREE.MeshBasicMaterial();
      const folderHitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
      folderHitBox.layers.set(1);  // Layer 1 = invisible to camera, visible to raycaster
      folderHitBox.position.set(0, 0.38, 0);
      folderHitBox.userData = {
        type: 'folder',
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
        originalRot: { x: 0, y: layout.rotY, z: layout.rotZ }
      });
      this.interactiveObjects.push(folderMesh);
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

    laptopGroup.position.set(-3.6, 0.22, -1.5);
    laptopGroup.rotation.y = 0.35;
    laptopGroup.userData = { type: 'laptop' };
    this.scene.add(laptopGroup);
    this.interactiveObjects.push(laptopGroup);
    this.interactiveObjects.push(laptopBase);
    this.interactiveObjects.push(laptopLid);
    this.interactiveObjects.push(screenMesh);
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

    cupGroup.position.set(4.0, 0.18, -1.2);
    cupGroup.userData = { type: 'coffee' };
    this.scene.add(cupGroup);
    this.interactiveObjects.push(cupGroup);
    this.interactiveObjects.push(cupMesh);
    this.interactiveObjects.push(liquidMesh);
    this.interactiveObjects.push(handleMesh);
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
    this.puddle.position.set(4.1, 0.19, -1.0);
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
    stickyNote.position.set(0.1, 0.21, 2.3);
    stickyNote.userData = { type: 'dont-touch-note' };
    this.scene.add(stickyNote);
    this.interactiveObjects.push(stickyNote);
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
    calendar.position.set(-1.8, 0.21, -1.6);
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

    const xPos = 0.2 + (slotIndex % 4) * 0.75;
    const zPos = -1.6 + Math.floor(slotIndex / 4) * 0.75;
    const rot = (Math.random() - 0.5) * 0.4;

    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rot;
    mesh.position.set(xPos, 0.205, zPos);
    mesh.userData = {
      type: 'sticky-note',
      note: note,
      originalY: 0.205
    };

    // Add a thick box hitbox on Layer 1 — PlaneGeometry is zero-thickness and hard to raycast
    const noteHitBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.12, 0.7),
      new THREE.MeshBasicMaterial()
    );
    noteHitBox.layers.set(1);
    noteHitBox.userData = { type: 'sticky-note', note: note, originalY: 0.205 };
    mesh.add(noteHitBox);

    this.scene.add(mesh);
    this.interactiveObjects.push(mesh);
    this.interactiveObjects.push(noteHitBox);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onWindowResize());

    // 180-Degree Look Around Event Listeners
    const dom = this.renderer.domElement;

    // Mouse Drag to Look Around
    dom.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));

    // Mouse Wheel to Tilt POV Up / Down smoothly
    dom.addEventListener('wheel', (e) => {
      if (this.isCameraZoomed) return;
      this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - e.deltaY * 0.0018, -0.65, 1.15);
    }, { passive: true });

    // Touch Swipe to Look Around
    dom.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    window.addEventListener('touchend', () => { this.isDraggingView = false; });

    // Click handler for 3D props & folders
    dom.addEventListener('click', (e) => this.onClick(e));
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  onMouseDown(e) {
    if (this.isCameraZoomed) return;
    // Don't drag if clicking buttons, modals, or clear-book overlay
    if (e.target.closest('button') || e.target.closest('.guestbook-modal-overlay') || e.target.closest('#bookOverlay') || e.target.closest('.error-modal-overlay')) return;

    this.isDraggingView = true;
    this.dragStartPos = { x: e.clientX, y: e.clientY };
    this.dragStartAngles = { yaw: this.targetYaw, pitch: this.targetPitch };
    this.mouseDownTime = Date.now();
    this.hasDraggedMeaningfully = false;
  }

  onMouseUp(e) {
    this.isDraggingView = false;
  }

  onTouchStart(e) {
    if (this.isCameraZoomed || !e.touches || e.touches.length === 0) return;
    this.isDraggingView = true;
    this.dragStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    this.dragStartAngles = { yaw: this.targetYaw, pitch: this.targetPitch };
    this.mouseDownTime = Date.now();
    this.hasDraggedMeaningfully = false;
  }

  onTouchMove(e) {
    if (!this.isDraggingView || this.isCameraZoomed || !e.touches || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - this.dragStartPos.x;
    const dy = e.touches[0].clientY - this.dragStartPos.y;

    if (Math.hypot(dx, dy) > 18) {
      this.hasDraggedMeaningfully = true;
    }

    // Horizontal 180 degrees (-90° to +90°) and vertical look up (-0.65 to +1.15)
    const yawDelta = -(dx / window.innerWidth) * Math.PI;
    const pitchDelta = (dy / window.innerHeight) * 1.5;

    this.targetYaw = THREE.MathUtils.clamp(this.dragStartAngles.yaw + yawDelta, -Math.PI / 2, Math.PI / 2);
    this.targetPitch = THREE.MathUtils.clamp(this.dragStartAngles.pitch + pitchDelta, -0.65, 1.15);
  }

  onMouseMove(e) {
    if (this.isCameraZoomed) {
      this.hideTooltip();
      return;
    }

    // 1. If dragging, rotate camera with expanded look-up POV
    if (this.isDraggingView) {
      const dx = e.clientX - this.dragStartPos.x;
      const dy = e.clientY - this.dragStartPos.y;

      if (Math.hypot(dx, dy) > 18) {
        this.hasDraggedMeaningfully = true;
        this.hideTooltip();
      }

      // Dragging UP looks UP (dy < 0 -> pitchDelta > 0)
      const yawDelta = -(dx / window.innerWidth) * (Math.PI * 1.15);
      const pitchDelta = (dy / window.innerHeight) * 1.5;

      this.targetYaw = THREE.MathUtils.clamp(this.dragStartAngles.yaw + yawDelta, -Math.PI / 2, Math.PI / 2);
      this.targetPitch = THREE.MathUtils.clamp(this.dragStartAngles.pitch + pitchDelta, -0.65, 1.15);
      return;
    }

    // 2. Cursor subtle parallax look (lets you look up when cursor reaches top)
    const normX = (e.clientX / window.innerWidth) * 2 - 1;
    const normY = -(e.clientY / window.innerHeight) * 2 + 1;

    this.targetYaw = THREE.MathUtils.clamp(this.currentYaw + ((-normX * 0.45) - this.currentYaw) * 0.05, -Math.PI / 2, Math.PI / 2);
    this.targetPitch = THREE.MathUtils.clamp(this.currentPitch + ((normY * 0.4) - this.currentPitch) * 0.05, -0.65, 1.15);

    // 3. Raycast hovered props & folders
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    if (intersects.length > 0) {
      let hitObject = intersects[0].object;
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

    if (obj.userData.type === 'folder') {
      const folder = obj.userData.folderMesh || obj;
      if (typeof gsap !== 'undefined') {
        gsap.to(folder.position, { y: folder.userData.originalPos.y + 0.35, duration: 0.25, ease: 'power2.out' });
        gsap.to(folder.rotation, { x: -0.12, duration: 0.25 });
      } else {
        folder.position.y = folder.userData.originalPos.y + 0.35;
      }
      const member = folder.userData.member;
      this.showTooltip(`<strong>Clear-Book: ${member.name}</strong><br><em>“${member.tagline}”</em><br><small style="color:#38BDF8">Click anywhere to open portfolio</small>`, e);
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
    if (this.isCameraZoomed) {
      return;
    }
    if (e.target.closest('button') || e.target.closest('#bookOverlay') || e.target.closest('.error-modal-overlay') || e.target.closest('.guestbook-modal-overlay') || e.target.closest('.note-view-modal-overlay')) {
      return;
    }

    const startX = this.dragStartPos ? this.dragStartPos.x : e.clientX;
    const startY = this.dragStartPos ? this.dragStartPos.y : e.clientY;
    const dragDist = Math.hypot(e.clientX - startX, e.clientY - startY);
    const dragDuration = Date.now() - (this.mouseDownTime || 0);

    // Only abort if the user deliberately dragged across screen for look-around
    if (dragDist > 22 && dragDuration > 280) {
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    if (intersects.length > 0) {
      let hit = intersects[0].object;
      while (hit.parent && hit.parent !== this.scene && !hit.userData.type) {
        hit = hit.parent;
      }
      this.handleObjectClick(hit);
    }
  }

  handleObjectClick(obj) {
    const type = obj.userData.type;

    if (type === 'folder') {
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
    const folderMesh = obj.userData.folderMesh || obj;
    const member = folderMesh.userData.member;
    this.activeFolder = folderMesh;
    this.isCameraZoomed = true;
    this.hideTooltip();

    if (window.PortfolioHumor) {
      window.PortfolioHumor.playSound('pageFlip');
    }

    if (typeof gsap !== 'undefined') {
      gsap.to(this.camera.position, {
        x: folderMesh.position.x,
        y: folderMesh.position.y + 2.8,
        z: folderMesh.position.z + 1.8,
        duration: 0.8,
        ease: 'power3.inOut'
      });

      gsap.to(folderMesh.position, {
        y: folderMesh.userData.originalPos.y + 0.8,
        duration: 0.6,
        ease: 'back.out(1.5)',
        onComplete: () => {
          if (typeof this.onFolderSelect === 'function') {
            this.onFolderSelect(member);
          }
        }
      });
      if (typeof this.onFolderSelect === 'function') {
        this.onFolderSelect(member);
      }
    }
  }

  returnToDesk() {
    if (!this.isCameraZoomed) return;

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

      gsap.to(this.camera.position, {
        x: this.defaultCameraPos.x,
        y: this.defaultCameraPos.y,
        z: this.defaultCameraPos.z,
        duration: 0.8,
        ease: 'power3.inOut',
        onComplete: () => {
          this.isCameraZoomed = false;
          this.activeFolder = null;
        }
      });
    } else {
      this.camera.position.copy(this.defaultCameraPos);
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
          y: f.userData.originalPos.y + 0.6 + (idx * 0.12),
          duration: 2 + idx * 0.3,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut'
        });
        gsap.to(f.mesh.rotation, {
          y: f.userData.originalRot.y + 0.35,
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
          x: f.userData.originalPos.x,
          y: f.userData.originalPos.y,
          z: f.userData.originalPos.z,
          duration: 0.8,
          ease: 'power2.out'
        });
        gsap.to(f.mesh.rotation, {
          x: 0,
          y: f.userData.originalRot.y,
          z: f.userData.originalRot.z,
          duration: 0.8,
          ease: 'power2.out'
        });
      });
    }
  }

  updateCameraLookAt() {
    // 180-Degree Look: Calculate look target from yaw & pitch with expanded vertical POV
    const lookDistance = 6.0;
    this.lookTarget.x = this.camera.position.x + Math.sin(this.currentYaw) * lookDistance;
    this.lookTarget.y = (this.camera.position.y - 2.2) + (this.currentPitch * 6.8);
    this.lookTarget.z = this.camera.position.z - Math.cos(this.currentYaw) * lookDistance;

    this.camera.lookAt(this.lookTarget);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // 180-Degree Look Smooth Interpolation
    if (!this.isCameraZoomed && this.camera) {
      this.currentYaw += (this.targetYaw - this.currentYaw) * 0.08;
      this.currentPitch += (this.targetPitch - this.currentPitch) * 0.08;

      this.updateCameraLookAt();
    }

    if (this.renderer && this.scene && this.camera) {
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
          this.onFolderSelect(m);
        }
      });
      grid.appendChild(card);
    });
  }
}

window.DeskScene = DeskScene;

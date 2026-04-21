import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ═══════════════════════════════════════════════════════════════
// SCENE CONFIG
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  fog: { color: 0x05050c, density: 0.018 },
  bloom: { strength: 0.8, radius: 0.4, threshold: 0.3 },
  particles: { count: 2000, size: 0.04 },
  movement: { speed: 8, dampen: 0.92 }
};

// ═══════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════
let camera, scene, renderer, composer, controls;
let particles, monoliths = [];
let lastTime = 0;
let moveState = { forward: false, backward: false, left: false, right: false };
let velocity = new THREE.Vector3();
let positionDisplay;

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
function init() {
  const canvas = document.getElementById('canvas');
  positionDisplay = document.getElementById('position-display');
  
  // Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(CONFIG.fog.color, CONFIG.fog.density);
  scene.background = new THREE.Color(CONFIG.fog.color);
  
  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 1.6, 10);
  
  // Renderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } catch (e) {
    console.warn('WebGL init failed, falling back');
    canvas.style.background = '#05050c';
    return;
  }
  
  // Controls
  controls = new PointerLockControls(camera, document.body);
  
  // Post-processing
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.bloom.strength,
    CONFIG.bloom.radius,
    CONFIG.bloom.threshold
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  
  // Build scene
  createLights();
  createParticles();
  createMonoliths();
  createFloorGrid();
  
  // Events
  setupEventListeners();
  
  // Start loop
  lastTime = performance.now();
  requestAnimationFrame(animate);
}

// ═══════════════════════════════════════════════════════════════
// SCENE CREATION
// ═══════════════════════════════════════════════════════════════
function createLights() {
  const ambient = new THREE.AmbientLight(0x111122, 0.3);
  scene.add(ambient);
  
  const pointLight = new THREE.PointLight(0x22aaaa, 2, 50);
  pointLight.position.set(0, 8, 0);
  scene.add(pointLight);
  
  const pointLight2 = new THREE.PointLight(0x6622aa, 1.5, 40);
  pointLight2.position.set(-15, 5, -15);
  scene.add(pointLight2);
}

function createParticles() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(CONFIG.particles.count * 3);
  const colors = new Float32Array(CONFIG.particles.count * 3);
  
  for (let i = 0; i < CONFIG.particles.count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 80;
    positions[i3 + 1] = Math.random() * 30;
    positions[i3 + 2] = (Math.random() - 0.5) * 80;
    
    // Teal to purple gradient
    const t = Math.random();
    colors[i3] = 0.13 + t * 0.4;
    colors[i3 + 1] = 0.67 - t * 0.2;
    colors[i3 + 2] = 0.67 + t * 0.2;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const material = new THREE.PointsMaterial({
    size: CONFIG.particles.size,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending
  });
  
  particles = new THREE.Points(geometry, material);
  scene.add(particles);
}

function createMonoliths() {
  const positions = [
    { x: 0, z: -20, h: 12 },
    { x: 15, z: -30, h: 8 },
    { x: -12, z: -25, h: 15 },
    { x: 8, z: -45, h: 10 },
    { x: -18, z: -40, h: 20 },
    { x: 20, z: -55, h: 14 },
    { x: -25, z: -60, h: 18 },
    { x: 0, z: -70, h: 25 },
  ];
  
  positions.forEach((p, idx) => {
    const geo = new THREE.BoxGeometry(2, p.h, 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a0a12,
      emissive: 0x22aaaa,
      emissiveIntensity: 0.15 + Math.random() * 0.1,
      roughness: 0.8,
      metalness: 0.3
    });
    
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, p.h / 2, p.z);
    mesh.userData.baseEmissive = mat.emissiveIntensity;
    scene.add(mesh);
    monoliths.push(mesh);
    
    // Edge glow lines
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ 
      color: 0x22aaaa, 
      transparent: true, 
      opacity: 0.3 
    });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    wireframe.position.copy(mesh.position);
    scene.add(wireframe);
  });
}

function createFloorGrid() {
  const gridHelper = new THREE.GridHelper(100, 50, 0x1a1a28, 0x0f0f18);
  gridHelper.position.y = 0;
  scene.add(gridHelper);
}

// ═══════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════
function setupEventListeners() {
  // Start button
  document.getElementById('start-btn').addEventListener('click', () => {
    controls.lock();
  });
  
  // Lock/unlock
  controls.addEventListener('lock', () => {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('hud').classList.add('visible');
    document.getElementById('crosshair').classList.add('visible');
    document.getElementById('info-panel').classList.add('visible');
  });
  
  controls.addEventListener('unlock', () => {
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('hud').classList.remove('visible');
    document.getElementById('crosshair').classList.remove('visible');
    document.getElementById('info-panel').classList.remove('visible');
  });
  
  // Keyboard
  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': moveState.forward = true; break;
      case 'KeyS': case 'ArrowDown': moveState.backward = true; break;
      case 'KeyA': case 'ArrowLeft': moveState.left = true; break;
      case 'KeyD': case 'ArrowRight': moveState.right = true; break;
    }
  });
  
  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': moveState.forward = false; break;
      case 'KeyS': case 'ArrowDown': moveState.backward = false; break;
      case 'KeyA': case 'ArrowLeft': moveState.left = false; break;
      case 'KeyD': case 'ArrowRight': moveState.right = false; break;
    }
  });
  
  // Resize
  window.addEventListener('resize', onResize);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}

// ═══════════════════════════════════════════════════════════════
// ANIMATION LOOP
// ═══════════════════════════════════════════════════════════════
function animate(time) {
  requestAnimationFrame(animate);
  
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  
  // Movement
  if (controls.isLocked) {
    const speed = CONFIG.movement.speed;
    velocity.x *= CONFIG.movement.dampen;
    velocity.z *= CONFIG.movement.dampen;
    
    if (moveState.forward) velocity.z -= speed * dt;
    if (moveState.backward) velocity.z += speed * dt;
    if (moveState.left) velocity.x -= speed * dt;
    if (moveState.right) velocity.x += speed * dt;
    
    controls.moveRight(velocity.x);
    controls.moveForward(velocity.z);
    
    // Update position display
    const pos = camera.position;
    positionDisplay.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
  }
  
  // Animate particles (slow drift)
  if (particles) {
    particles.rotation.y += dt * 0.02;
  }
  
  // Pulse monolith emissive
  monoliths.forEach((m, i) => {
    const mat = m.material;
    const pulse = Math.sin(time * 0.001 + i * 0.5) * 0.05;
    mat.emissiveIntensity = m.userData.baseEmissive + pulse;
  });
  
  // Render with post-processing
  composer.render();
}

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════
init();

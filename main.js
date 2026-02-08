import {
  postScoreToFirebase,
  getScoresFromFirebase,
} from "./firebaseScores.js";

let playerName = null;

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
// import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
// import vertexShader from '/shaders/portal.vert?raw';
// import fragmentShader from '/shaders/portal.frag?raw';

const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();

// --- STRANGER THINGS TONE ---
const BASE_FOG_COLOR = 0x100000;

scene.fog = new THREE.FogExp2(
  BASE_FOG_COLOR,
  0.06 // start dense (slow speed)
);
const FOG_DENSE = 0.145;  // slow / struggling
const FOG_THIN  = 0.02;   // fast / confident

function updateFogBySpeed(dt) {
  if (!scene.fog || !scene.fog.isFogExp2) return;

  // Normalize speed (0 → slow, 1 → fast)
  const speed01 = Math.min(player0Speed / 2, 1);

  // Invert: slow = dense fog
  const targetDensity =
    FOG_DENSE + (FOG_THIN - FOG_DENSE) * speed01;

  const current = scene.fog.density;

  // Different smoothing speeds
  const SMOOTH_IN  = 1.5;  // dense comes slowly
  const SMOOTH_OUT = 7.5;  // clears quickly

  const smooth =
    targetDensity > current ? SMOOTH_IN : SMOOTH_OUT;

  scene.fog.density +=
    (targetDensity - current) * smooth * dt;
}

// scene.fog = new THREE.Fog(new THREE.Color(0x2a0b07), 10, 220); // deep red-ish fog

// Camera + Controls
const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 2.2, 5);
// camera.rotation.y = Math.PI / 2;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableZoom = false;
controls.target.set(0, 1.5, 0);

let momentum = 0;

// resize
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// BGM TRACK
// Create an AudioListener
const listener = new THREE.AudioListener();
camera.add(listener);

// Create a global audio source
const bgm = new THREE.Audio(listener);

// Load the audio file
const audioLoader = new THREE.AudioLoader();
audioLoader.load("/bgm.mp3", function (buffer) {
  bgm.setBuffer(buffer);
  bgm.setLoop(true); // loop forever
  bgm.setVolume(0.4); // 0.0 to 1.0
});

window.addEventListener("single-game-start", (e) => {
  loadPlayer();
  startCountdownAndGame();
  if (!bgm.isPlaying) bgm.play();
  // if (enemyBGMReady && !enemyBGM.isPlaying) enemyBGM.play();
});

// Enemy / danger music
// const enemyBGM = new THREE.Audio(listener);
// let enemyBGMReady = false;

// audioLoader.load("/enemy.mp3", (buffer) => {
//   enemyBGM.setBuffer(buffer);
//   enemyBGM.setLoop(true);
//   enemyBGM.setVolume(0.0); // start silent
//   enemyBGMReady = true;
// });


// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight(0xffe9d6, 0x0b0b10, 0.8);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffd1a6, 0.9);
dir.position.set(5, 10, 2);
scene.add(dir);

// extra fill red-ish rim to tint scene
const fillLight = new THREE.PointLight(0xff6b3b, 0.12, 40);
fillLight.position.set(-6, 6, -6);
scene.add(fillLight);

// lightning (dynamic)
const lightningLight = new THREE.PointLight(0xffffff, 0, 120); // start off
lightningLight.position.set(0, 30, -40);
scene.add(lightningLight);

// ---------- SKY / BACKDROP ----------
// Uses the provided image as dramatic clouds background. We set it as a large distant plane
const loader = new THREE.TextureLoader();
loader.load("/backdrop3.png", function (texture) {
  scene.background = texture; // directly set as background
});
// Create HTML video element
// ---------- SKY / BACKDROP ----------

// Create HTML video element
// --- Video Element ---
const video = document.createElement("video");
video.src = "/background.mp4"; // your file
video.loop = true;
video.muted = true;
video.autoplay = true;
video.playsInline = true;
video.play().catch((err) => console.warn("Autoplay blocked:", err));

// --- Video Texture ---
const videoTexture = new THREE.VideoTexture(video);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.generateMipmaps = false;
videoTexture.colorSpace = THREE.SRGBColorSpace;

// --- Fullscreen Quad ---
const videoGeometry = new THREE.PlaneGeometry(25, 25);
const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);

videoMesh.material.depthTest = false;
videoMesh.material.depthWrite = false;
videoMesh.renderOrder = -1;
videoMesh.position.y = 2.5;
scene.add(videoMesh);

function updateVideoBackdrop() {
  videoMesh.position.copy(camera.position);
  videoMesh.position.z -= 5; // always 20 units behind camera
  videoMesh.position.y = camera.position.y;
  // videoMesh.lookAt(camera.position);
}

scene.fog = new THREE.FogExp2(0x100000, 0.04); // adjust density

// Portal
let portalActive = false;
let portalFade = 0; // 0 → 1
let portalFadingIn = false;

let sinking = false;
let sinkProgress = 0;

const portal = new THREE.Group();
// scene.add(portal);
portal.visible = false;
portal.scale.set(1.8, 1.8, 1.8); // big cinematic size

function spawnPortalAtPlayer() {
  if (!player || portalActive) return;
  animate();
  scene.add(portal);
  portalActive = true;
  portal.visible = true;

  portal.position.set(
    player.position.x,
    player.position.y + 1.2,
    player.position.z - 10,
  );

  portalFade = 0;
  portalFadingIn = true;
  sinking = false;

  controls.enabled = false;
}

function updatePortalFade(dt) {
  if (!portalFadingIn) return;

  portalFade += dt / 1.5; // 1.5s fade
  portalFade = Math.min(portalFade, 1);

  setPortalOpacity(portalFade);

  sinking = true; // NOW start pulling player
  if (portalFade >= 1) {
    portalFadingIn = false;
  }
}

function setPortalOpacity(alpha) {
  portal.traverse((obj) => {
    if (obj.material && obj.material.transparent) {
      obj.material.opacity = obj.material.userData.baseOpacity * alpha;
    }
  });
}

// ==================================================
// 🔥 HELPER: CREATE SPORE RING
// ==================================================
function createSporeRing(count, innerR, outerR, color, size) {
  const positions = new Float32Array(count * 3);
  const angles = new Float32Array(count);
  const radii = new Float32Array(count);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    angles[i] = Math.random() * Math.PI * 2;
    radii[i] = innerR + Math.random() * (outerR - innerR);
    speeds[i] = (Math.random() * 0.01 + 0.003) * (Math.random() < 0.5 ? -1 : 1);

    positions[i * 3] = Math.cos(angles[i]) * radii[i];
    positions[i * 3 + 1] = Math.sin(angles[i]) * radii[i];
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);

  return { points, geo, angles, radii, speeds, count };
}

// ==================================================
// 🔥 LAYERS
// ==================================================

// 1️⃣ OUTER SPORES
const outerSpores = createSporeRing(1400, 2.2, 2.9, 0xff4400, 0.05);
outerSpores.points.renderOrder = 1;
portal.add(outerSpores.points);

// 2️⃣ DISC 1
const disc1 = new THREE.Mesh(
  new THREE.CircleGeometry(2.05, 64),
  new THREE.MeshBasicMaterial({
    color: 0x660000,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  }),
);
disc1.position.z = -0.01;
disc1.renderOrder = 2;
portal.add(disc1);

// 3️⃣ MID SPORES
const midSpores = createSporeRing(1100, 1.6, 2.1, 0xff5500, 0.045);
midSpores.points.renderOrder = 3;
portal.add(midSpores.points);

// 4️⃣ DISC 2
const disc2 = new THREE.Mesh(
  new THREE.CircleGeometry(1.35, 64),
  new THREE.MeshBasicMaterial({
    color: 0x770000,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  }),
);
disc2.position.z = -0.02;
disc2.renderOrder = 4;
portal.add(disc2);

// 5️⃣ INNER SPORES
const innerSpores = createSporeRing(800, 0.9, 1.3, 0xff6600, 0.04);
innerSpores.points.renderOrder = 5;
portal.add(innerSpores.points);

// 6️⃣ CORE DISC
const core = new THREE.Mesh(
  new THREE.CircleGeometry(0.6, 48),
  new THREE.MeshBasicMaterial({
    color: 0xff330000,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  }),
);
core.position.z = -0.03;
core.renderOrder = 6;
portal.add(core);

// ---------------- GLOW LIGHT ----------------
const glowLight = new THREE.PointLight(0xff3300, 2.5, 10);
portal.add(glowLight);

// ---------------- POSITION ----------------
portal.position.set(0, 3, 0);

// ==================================================
// 🔄 ANIMATION
// ==================================================
function animate() {
  requestAnimationFrame(animate);

  animateSpores(outerSpores);
  animateSpores(midSpores);
  animateSpores(innerSpores);

  // subtle overall rotation
  portal.rotation.z += 0.0015;

  renderer.render(scene, camera);
}

function animateSpores(layer) {
  const pos = layer.geo.attributes.position.array;
  for (let i = 0; i < layer.count; i++) {
    layer.angles[i] += layer.speeds[i];
    pos[i * 3] = Math.cos(layer.angles[i]) * layer.radii[i];
    pos[i * 3 + 1] = Math.sin(layer.angles[i]) * layer.radii[i];
  }
  layer.geo.attributes.position.needsUpdate = true;
}

disc1.material.userData.baseOpacity = disc1.material.opacity;
disc2.material.userData.baseOpacity = disc2.material.opacity;
core.material.userData.baseOpacity = core.material.opacity;

outerSpores.points.material.userData.baseOpacity = 0.9;
midSpores.points.material.userData.baseOpacity = 0.9;
innerSpores.points.material.userData.baseOpacity = 0.9;
setPortalOpacity(0);

// --- Road Material ---
const roadColor = loader.load("/ground/color.jpg");
const roadNormal = loader.load("/ground/normal.jpg");
const roadRough = loader.load("/ground/roughness.jpg");
// const roadMat = new THREE.MeshStandardMaterial({
//     color: 0x333333,   // asphalt grey
//     roughness: 0.8,
//     metalness: 0.2,
// });

[roadColor, roadNormal, roadRough].forEach((tex) => {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 100); // wide grass field
});

const groundMat = new THREE.MeshStandardMaterial({
  // color: 0x1d5e20,   // dark green
  // roughness: 1,
  // metalness: 0,
  map: roadColor,
  normalMap: roadNormal,
  roughnessMap: roadRough,
  roughness: 1,
  metalness: 0,
});
groundMat.color.set(0x6b6b6b);

// --- Grass Material ---
const grassColor = loader.load("/grass/color.jpg");
const grassNormal = loader.load("/grass/normal.jpg");
const grassRough = loader.load("/grass/roughness.jpg");

[grassColor, grassNormal, grassRough].forEach((tex) => {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 40); // wide grass field
});

const grassMat = new THREE.MeshStandardMaterial({
  // color: 0x1d5e20,   // dark green
  // roughness: 1,
  // metalness: 0,
  map: grassColor,
  normalMap: grassNormal,
  roughnessMap: grassRough,
  roughness: 1,
  metalness: 0,
});
grassMat.color.set(0x228c22); // dark green tint

// --- Grass Geometry ---
const grassGeo = new THREE.PlaneGeometry(100, 400);

// Left grass
const grassLeft = new THREE.Mesh(grassGeo, grassMat);
grassLeft.rotation.x = -Math.PI / 2;
grassLeft.position.set(-30, -0.01, -150); // pushed left, slightly lower
scene.add(grassLeft);

// Right grass
const grassRight = new THREE.Mesh(grassGeo, grassMat);
grassRight.rotation.x = -Math.PI / 2;
grassRight.position.set(30, -0.01, -150); // pushed right, slightly lower
scene.add(grassRight);

// const roadTex = makeRoadTexture();
const groundGeo = new THREE.PlaneGeometry(4, 400, 1, 1); // wider road
// const groundMat = new THREE.MeshStandardMaterial({
//     map: roadTexture,
//     metalness: 0.05,
//     roughness: 0.9,
// });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.z = -150;
scene.add(ground);

// --- BILLBOARD MESHES ---
const signTex = makeSignTexture();
const signMat = new THREE.MeshBasicMaterial({
  map: signTex,
  transparent: false,
});
const signGeo = new THREE.PlaneGeometry(3, 1.5);
const signMesh = new THREE.Mesh(signGeo, signMat);
const postGeo = new THREE.BoxGeometry(0.15, 2.2, 0.15);
const postMat = new THREE.MeshStandardMaterial({
  color: 0x4b2f1a,
  metalness: 0.02,
  roughness: 0.9,
});
const post = new THREE.Mesh(postGeo, postMat);
const billboard = new THREE.Group();
billboard.add(signMesh, post);

// ====== THEMED BILLBOARDS POOL ======
const billboardTexts = [
  "WELCOME\nTO\nHAWKINS",
  "STRANGER THINGS\nX\nGDGC",
  "MISSING\nHAVE YOU\nSEEN WILL?",
  "HOPPER'S\nCABIN",
];

function makeSignTexture(text = "WELCOME\nTO\nHAWKINS") {
  const W = 512,
    H = 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");

  // dark sign + red glow edge for vibe
  ctx.fillStyle = "#1e0707";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#ff1515";
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, W - 12, H - 12);

  // retro serif-ish look approximation; later swap to ITC Benguiat if licensed
  ctx.font = "700 40px Georgia";
  ctx.fillStyle = "#ffdddd";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W / 2, (H / (lines.length + 1)) * (i + 1));
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeBillboard() {
  const signTex = makeSignTexture(
    billboardTexts[(Math.random() * billboardTexts.length) | 0],
  );
  const signMat = new THREE.MeshBasicMaterial({
    map: signTex,
    transparent: false,
  });
  const signGeo = new THREE.PlaneGeometry(3, 1.5);

  const signMesh = new THREE.Mesh(signGeo, signMat);
  const postGeo = new THREE.BoxGeometry(0.15, 2.2, 0.15);
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x4b2f1a,
    metalness: 0.02,
    roughness: 0.9,
  });
  const post = new THREE.Mesh(postGeo, postMat);

  const group = new THREE.Group();
  // position meshes inside group
  signMesh.position.set(0, 1.2, 0);
  post.position.set(0, -0.1, -0.1);
  group.add(signMesh, post);
  group.userData.signMesh = signMesh; // for retheming when recycled
  return group;
}

const billboardPool = [];
const BILLBOARD_COUNT = 15;

function resetBillboard(group, first = false) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const offsetX = 2 + Math.random() * 10;
  const z = first
    ? camera.position.z - (60 + Math.random() * 260)
    : camera.position.z - (120 + Math.random() * 240);
  group.position.set(offsetX * side, 0, z);
  // occasionally change the text to keep variety
  if (Math.random() < 0.4) {
    const newTex = makeSignTexture(
      billboardTexts[(Math.random() * billboardTexts.length) | 0],
    );
    group.userData.signMesh.material.map.dispose?.();
    group.userData.signMesh.material.map = newTex;
    group.userData.signMesh.material.needsUpdate = true;
  }
}

for (let i = 0; i < BILLBOARD_COUNT; i++) {
  const bb = makeBillboard();
  resetBillboard(bb, true);
  scene.add(bb);
  billboardPool.push(bb);
}

// SIDE ELEMENTS

// ===== Upside Down Spores (particles) — DENSE & VISIBLE =====
function makeCircleSprite(
  size = 64,
  inner = "rgba(255,220,220,0.8)",
  outer = "rgba(255,40,30,0)",
) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const sporeTex = makeCircleSprite(64);
const SPORE_COUNT = 100; // denser
const SPORE_MAX_Y = 14; // recycle when spores float above this height
const sporeGeo = new THREE.BufferGeometry();
const sporePos = new Float32Array(SPORE_COUNT * 3);
const sporeVel = new Float32Array(SPORE_COUNT);

// Shoulder-focused spawn bands near the road: x in ±[6.5..10]
function randomShoulderX() {
  const side = Math.random() < 0.5 ? -1 : 1;
  return side * (6.5 + Math.random() * 3.5);
}

// Closer Z spawn so they are visible sooner
function randomSpawnZ() {
  // spawn relative to camera so objects remain ahead even when camera/player Z grows
  const ahead = Math.random() * 110 + 5; // 5..115
  return camera.position.z - ahead;
}

for (let i = 0; i < SPORE_COUNT; i++) {
  sporePos[i * 3 + 0] = randomShoulderX(); // x near road shoulders
  sporePos[i * 3 + 1] = Math.random() * 2 + 0.5; // start low near ground (0.5..2.5)
  sporePos[i * 3 + 2] = randomSpawnZ(); // z closer to camera
  sporeVel[i] = 0.025 + Math.random() * 0.065; // gentle up drift
}
sporeGeo.setAttribute("position", new THREE.BufferAttribute(sporePos, 3));

// Bigger size, additive, no fog; optional sizeAttenuation=false for screen-constant size
const sporeMat = new THREE.PointsMaterial({
  map: sporeTex,
  size: 0.55, // was 0.35; larger for visibility
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  color: new THREE.Color(0xff3b2f),
  opacity: 0.9,
  fog: false, // ignore scene fog to stay visible
  sizeAttenuation: true, // set to false if wanting constant screen size
});
const spores = new THREE.Points(sporeGeo, sporeMat);
scene.add(spores);

function updateSpores(dt, worldMove) {
  const arr = spores.geometry.attributes.position.array;
  for (let i = 0; i < SPORE_COUNT; i++) {
    const j = i * 3;
    // drift with world and float upward
    arr[j + 2] += worldMove * 0.95; // slightly faster approach
    arr[j + 1] += sporeVel[i] * dt * 60;

    // Mild lateral shimmer near shoulders for movement variety
    arr[j + 0] += Math.sin(last * 0.001 + i * 0.17) * 0.005;

    // recycle when past camera or when they've floated too high off-screen
    if (arr[j + 2] > camera.position.z + 6 || arr[j + 1] > SPORE_MAX_Y) {
      arr[j + 0] = randomShoulderX();
      // respawn near ground so they rise into view again
      arr[j + 1] = Math.random() * 2 + 0.5;
      arr[j + 2] = randomSpawnZ();
      sporeVel[i] = 0.025 + Math.random() * 0.065;
    }
  }
  spores.geometry.attributes.position.needsUpdate = true;
}

// ===== Flickering Streetlamps =====
function makeStreetLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 5, 8),
    new THREE.MeshStandardMaterial({
      color: 0x202020,
      metalness: 0.6,
      roughness: 0.7,
    }),
  );
  pole.position.y = 2.5;
  g.add(pole);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: 0x330000,
    emissiveIntensity: 2,
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), headMat);
  head.position.set(0, 5.1, 0);
  g.add(head);
  const spot = new THREE.SpotLight(0xff5533, 0.0, 12, Math.PI / 5, 0.4, 1.2);
  spot.position.set(0, 5.1, 0);
  spot.target.position.set(0, 0, -2);
  g.add(spot, spot.target);
  g.userData = { head, spot, phase: Math.random() * Math.PI * 2 };
  return g;
}

const lampPool = [];
const LAMP_COUNT = 15;
for (let i = 0; i < LAMP_COUNT; i++) {
  const L = makeStreetLamp();
  L.position.set(
    (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 6),
    0,
    camera.position.z - (60 + Math.random() * 160),
  );
  scene.add(L);
  lampPool.push(L);
}
function resetLamp(L) {
  L.position.set(
    (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 6),
    0,
    camera.position.z - (80 + Math.random() * 180),
  );
  L.userData.phase = Math.random() * Math.PI * 2;
}

function updateLamps(dt, worldMove, t) {
  for (const L of lampPool) {
    // move with world
    L.position.z += worldMove;

    // --- INIT USER DATA ---
    if (L.userData.flickerTimer === undefined) {
      L.userData.flickerTimer = 0;
      L.userData.targetIntensity = 0;
    }

    // --- RANDOM FLICKER TRIGGER ---
    if (L.userData.flickerTimer <= 0 && Math.random() < 0.08) {
      L.userData.flickerTimer = 0.08 + Math.random() * 0.18; // burst duration
      L.userData.targetIntensity = 0.6 + Math.random() * 1.4;
    }

    // countdown
    L.userData.flickerTimer -= dt;

    if (L.userData.flickerTimer <= 0) {
      L.userData.targetIntensity = 0;
    }

    // --- SMOOTH INTENSITY ---
    const current = L.userData.spot.intensity;
    const next = current + (L.userData.targetIntensity - current) * 10 * dt;

    L.userData.spot.intensity = next;
    L.userData.head.material.emissiveIntensity = next * 2.2;

    // recycle
    if (L.position.z > camera.position.z + 6) {
      resetLamp(L);
    }
  }
}

// ===== Creeping Vines =====
function makeVineCluster() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3a0b0f,
    roughness: 0.95,
    metalness: 0.05,
  });
  const count = 6 + ((Math.random() * 6) | 0);
  for (let i = 0; i < count; i++) {
    const h = 0.6 + Math.random() * 1.4;
    const r = 0.04 + Math.random() * 0.05;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), mat);
    seg.position.set(
      Math.random() * 1.8 - 0.9,
      h / 2,
      Math.random() * 1.8 - 0.9,
    );
    seg.rotation.z = Math.random() * 0.6 - 0.3;
    seg.rotation.x = Math.random() * 0.4 - 0.2;
    g.add(seg);
  }
  g.userData = {
    baseScale: 1 + Math.random() * 0.2,
    phase: Math.random() * Math.PI * 2,
  };
  return g;
}

const vinesPool = [];
const VINES_COUNT = 20;
for (let i = 0; i < VINES_COUNT; i++) {
  const v = makeVineCluster();
  v.position.set(
    (Math.random() < 0.5 ? -1 : 1) * (7.5 + Math.random() * 5.5),
    0,
    -(50 + Math.random() * 160),
  );
  scene.add(v);
  vinesPool.push(v);
}
function resetVine(v) {
  v.position.set(
    (Math.random() < 0.5 ? -1 : 1) * (7.5 + Math.random() * 5.5),
    0,
    camera.position.z - (70 + Math.random() * 180),
  );
  v.userData.phase = Math.random() * Math.PI * 2;
}

function updateVines(dt, worldMove, t) {
  for (const v of vinesPool) {
    v.position.z += worldMove;
    const s =
      v.userData.baseScale * (1 + Math.sin(t * 0.8 + v.userData.phase) * 0.03);
    v.scale.set(s, s, s);
    if (v.position.z > camera.position.z + 6) resetVine(v);
  }
}

// Layered Rift: membrane + glow veins + inner void
function makeRiftGroup() {
  const g = new THREE.Group();

  function canvasTex(draw) {
    const W = 512,
      H = 1024;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    draw(ctx, W, H);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }

  // Inner dark membrane (main body that participates in fog)
  const memTex = canvasTex((ctx, W, H) => {
    ctx.fillStyle = "#0b0709";
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(
      W / 2,
      H / 2,
      20,
      W / 2,
      H / 2,
      Math.min(W, H) / 2,
    );
    g.addColorStop(0, "rgba(15,10,12,0.95)");
    g.addColorStop(1, "rgba(15,10,12,0.0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // jagged silhouette alpha mask
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = W * (0.5 + 0.12 * Math.sin(t * 7 + Math.random() * 0.4));
      const y = H * t;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  });
  const memMat = new THREE.MeshBasicMaterial({
    map: memTex,
    transparent: true,
    depthWrite: true,
    fog: true,
    opacity: 0.9,
  });
  const mem = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 5.2, 1, 1), memMat);
  g.add(mem);

  // Outer emissive veins (additive, no fog)
  const veinsTex = canvasTex((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,70,50,0.9)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    function branch(x, y, len, angle, w) {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const x2 = x + Math.cos(angle) * len,
        y2 = y + Math.sin(angle) * len;
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (w > 2) {
        const n = (1 + Math.random() * 2) | 0;
        for (let i = 0; i < n; i++) {
          branch(
            x2,
            y2,
            len * 0.6,
            angle + (Math.random() * 0.8 - 0.4),
            w * 0.65,
          );
        }
      }
    }
    for (let i = 0; i < 6; i++) {
      branch(
        W * 0.5 + (Math.random() * 60 - 30),
        H * (0.15 + 0.7 * Math.random()),
        60 + Math.random() * 120,
        -Math.PI / 2 + (Math.random() * 0.6 - 0.3),
        5,
      );
    }
  });
  const veinsMat = new THREE.MeshBasicMaterial({
    map: veinsTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    opacity: 0.85,
  });
  const veins = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 5.4, 1, 1),
    veinsMat,
  );
  veins.position.z = 0.01;
  g.add(veins);

  // Inner void (gives sense of depth behind membrane)
  const voidTex = canvasTex((ctx, W, H) => {
    const grd = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    grd.addColorStop(0, "rgba(3,2,3,1)");
    grd.addColorStop(1, "rgba(3,2,3,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  });
  const voidMat = new THREE.MeshBasicMaterial({
    map: voidTex,
    transparent: true,
    depthWrite: false,
    fog: false,
    opacity: 0.7,
  });
  const inner = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 4.8, 1, 1),
    voidMat,
  );
  inner.position.z = -0.01;
  g.add(inner);

  g.userData = { pulse: 0, phase: Math.random() * Math.PI * 2 };
  return g;
}

// Pool
const riftPool = [];
const RIFT_COUNT = 17;
function placeRift(r, first = false) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const x = side * (3 + Math.random() * 6);
  const y = 0.6 + Math.random() * 1.6;
  const z = first
    ? camera.position.z - (70 + Math.random() * 160)
    : camera.position.z - (100 + Math.random() * 200);
  r.position.set(x, y, z);
  r.rotation.y = Math.random() * 0.3 - 0.15;
  r.userData.pulse = 0;
  r.userData.phase = Math.random() * Math.PI * 2;
}
for (let i = 0; i < RIFT_COUNT; i++) {
  const r = makeRiftGroup();
  placeRift(r, true);
  scene.add(r);
  riftPool.push(r);
}

function updateRifts(dt, worldMove, t) {
  for (const r of riftPool) {
    r.position.z += worldMove;
    // subtle wobble and emissive pulse
    r.rotation.y += Math.sin(t * 0.6 + r.userData.phase) * 0.0015;
    const base = 0.6 + 0.3 * Math.sin(t * 1.3 + r.userData.phase);
    r.children[1].material.opacity = base + r.userData.pulse * 0.5; // veins layer brighter
    r.userData.pulse = Math.max(0, r.userData.pulse - dt * 2.0);
    if (r.position.z > camera.position.z + 6) placeRift(r);
  }
}

// Optional: call during lightning to spike the glow
function triggerRiftFlash(intensity = 1.0) {
  for (const r of riftPool) {
    r.userData.pulse = intensity;
  }
}

// ---------- Simple animated lightning sprite (faint) ----------
const boltCanvas = document.createElement("canvas");
boltCanvas.width = 256;
boltCanvas.height = 512;
const bctx = boltCanvas.getContext("2d");
bctx.fillStyle = "rgba(255,255,255,0)";
bctx.fillRect(0, 0, 256, 512);
// simple streak
bctx.fillStyle = "rgba(255,255,255,0.95)";
bctx.fillRect(120, 0, 8, 512);
const boltTex = new THREE.CanvasTexture(boltCanvas);
const boltMat = new THREE.MeshBasicMaterial({
  map: boltTex,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const boltGeo = new THREE.PlaneGeometry(6, 16);
const boltMesh = new THREE.Mesh(boltGeo, boltMat);
boltMesh.position.set(-6, 18, -60);
scene.add(boltMesh);

// ---------- Player/Enemy loaders & base game logic kept largely unchanged ----------

let countdownInterval;
let countdownValue = 5;
let isRunning = false;
// Game timer (2 minutes)
const GAME_DURATION_MS = 12 * 1000; // 120 seconds
let gameEndTime = null;
let gameTimerRunning = false;

function startCountdownAndGame() {
  countdownValue = 5;

  // Optional: show countdown in DOM
  const countdownEl = document.getElementById("countdown");
  if (countdownEl) countdownEl.innerText = countdownValue;
  renderer.render(scene, camera);

  countdownInterval = setInterval(() => {
    countdownValue--;

    if (countdownEl)
      countdownEl.innerText = countdownValue > 0 ? countdownValue : "GO!";

    if (countdownValue <= 0) {
      clearInterval(countdownInterval);

      setTimeout(() => {
        if (countdownEl) countdownEl.innerText = "";
        // ensure the typing input receives focus when the countdown finishes
        try {
          document.getElementById("input")?.focus();
        } catch (e) {
          /* ignore focus errors */
        }
        // start match timer (2 minutes) and game loop
        gameEndTime = performance.now() + GAME_DURATION_MS;
        gameTimerRunning = true;
        requestAnimationFrame(tick);
      }, 1000); // small pause after "GO!"
    }
  }, 1000);
}

let enemy, enemyMixer, enemyAction, enemyIdleAction;

const fbxLoader = new FBXLoader();

// const gltfLoader = new GLTFLoader();

// const textureLoader = new THREE.TextureLoader();

// const textures = {
//     Arms: textureLoader.load('/textures/T_QK_Arms00_BC.png'),
//     Body: textureLoader.load('/textures/T_QK_Body00_BC.png'),
//     Head: textureLoader.load('/textures/T_QK_Head00_BC.png'),
//     Teeth: textureLoader.load('/textures/T_QK_Teeth00_BC.png'),
// };

// fbxLoader.load('/models/enemy.fbx', (object) => {
//   object.traverse((child) => {
//         if (child.isMesh) {
//             // Look at the material/mesh name in console to match properly
//             console.log("Mesh:", child.name);

//             if (child.name.includes("Arm")) {
//                 child.material = new THREE.MeshStandardMaterial({ map: textures.Arms });
//             } else if (child.name.includes("Body")) {
//                 child.material = new THREE.MeshStandardMaterial({ map: textures.Body });
//             } else if (child.name.includes("Head")) {
//                 child.material = new THREE.MeshStandardMaterial({ map: textures.Head });
//             } else if (child.name.includes("Teeth")) {
//                 child.material = new THREE.MeshStandardMaterial({ map: textures.Teeth });
//             }
//         }
//     });
//     enemy = object;
//     const n = 0.1;
//     enemy.scale.set(n, n, n);
//     // enemy.position.set(0, -2, 5);
//     enemy.rotation.set(0, 135, 0);
//     scene.add(enemy);
//     enemyMixer = new THREE.AnimationMixer(enemy);

//     if (object.animations && object.animations.length > 0) {
//         enemyAction = enemyMixer.clipAction(object.animations[0]);
//     }
//     fbxLoader.load('/models/idle.fbx', (animObj) => {
//         if (animObj.animations.length > 0) {
//             const idleClip = animObj.animations[0];
//             enemyIdleAction = enemyMixer.clipAction(idleClip);
//             enemyIdleAction.play();
//         }
//     });
//     resetPositions();
// });

// Define 4 lanes
// const lanes = [0];
const PLAYER_LANE_X = 0;

let player = null;
let playerMixer = null;
let playerRunAction = null;
let playerIdleAction = null;

// Each player starts in their own lane
function loadPlayer() {
  fbxLoader.load("/models/player.fbx", (object) => {
    player = object;
    let size = 0.007;
    player.scale.set(size, size, size);
    player.rotation.set(0, 135, 0);
    player.position.set(PLAYER_LANE_X, 0.02, 10);
    player.visible = false;
    scene.add(player);

    playerMixer = new THREE.AnimationMixer(player);
    if (object.animations.length > 0) {
      playerRunAction = playerMixer.clipAction(object.animations[0]);
    }

    fbxLoader.load("/models/cat.fbx", (animObj) => {
      playerIdleAction = playerMixer.clipAction(animObj.animations[0]);
      playerIdleAction.reset().setEffectiveWeight(1).play();

      // 🔥 force animation pose instantly
      playerMixer.update(0);

      // 🔥 ONLY NOW show player
      player.visible = true;
    });
  });
}

// --- Typing Logic ---
// ---------- Typing + Game Logic (updated) ----------
const promptEl = document.getElementById("prompt");
const inputEl = document.getElementById("input");
const wpmEl = document.getElementById("wpm");
const accEl = document.getElementById("acc");
const spdEl = document.getElementById("spd");
const gapEl = document.getElementById("gap");
const refreshBtn = document.getElementById("refresh");
const pauseBtn = document.getElementById("pause");
const prog = document.getElementById("prog");
const banner = document.getElementById("banner");

const LINES = [
  "something is wrong here",
  "the air feels heavy tonight",
  "the lights are flickering again",
  "do not go alone",
  "this place feels different",
  "you should not be here",
  "did you hear that sound",
  "it is getting colder",
  "stay close to the others",
  "the walls feel alive",
  "time feels broken",
  "reality is slipping away",
  "the silence is watching",
  "do not trust the dark",
  "something is coming",
  "the ground is shaking",
  "you are not safe here",
  "it is closer than you think",
  "do not look back",
  "the shadows are moving",
  "the door should not open",
  "this is not our world",
  "the lights just went out",
  "your heart is racing",
  "breathe and keep moving",
  "it knows you are here",
  "do not stop now",
  "the night feels endless",
  "hold on to hope",
  "run before it finds you",
  "gdgc is the best club of dypcoe",
  "gdgc brings ideas together",
  "gdgc is more than a community",
  "techfest sparks innovation",
  "ideas turn into action here",
  "collaboration drives progress",
  "techfest is where passion meets technology",
  "thanks for playing made by yash and tejas",
];


let target = "",
  idx = 0,
  startedAt = null;
// typedCount and wrongCount will be recomputed from input each time
let typedCount = 0,
  wrongCount = 0;
// Session-wide stats (persist across lines)
let sessionTyped = 0,
  sessionWrong = 0,
  sessionStart = null;

let paused = false,
  gameOver = false;
let enemyBoost = 0.1;

// helper to track previous input length so we only trigger stumble on newly typed wrong char
let prevInputLen = 0;

function newLine() {
  target = LINES[(Math.random() * LINES.length) | 0];
  idx = 0;
  inputEl.value = "";
  // keep session stats intact; only reset line-level counters
  typedCount = 0;
  wrongCount = 0;
  prevInputLen = 0;
  startedAt = null;
  renderPrompt();
  prog.style.width = "0%";
  if (gameOver) {
    resetPositions();
    gameOver = false;
  }
  inputEl.focus();
}

function resetPositions() {
  if (player) {
    player.position.set(PLAYER_LANE_X, 0, 0);
  }
  // if (playerRunAction) playerRunAction.reset();
  momentum = 0;

  if (enemy) enemy.position.set(0, 0, 5);
}

// --- RENDER PROMPT FUNCTION ---
function renderPrompt() {
  const inputVal = inputEl.value || "";
  let html = "";

  for (let i = 0; i < target.length; i++) {
    const expected = target[i];
    const typed = inputVal[i];

    if (typed !== undefined) {
      if (typed === expected) {
        html += `<span class="char correct">${escapeHTML(expected)}</span>`;
      } else {
        html += `<span class="char wrong">${escapeHTML(expected)}</span>`;
      }
    } else if (i === inputVal.length) {
      html += `<span class="char current">${escapeHTML(expected)}</span>`;
    } else {
      html += `<span class="char future">${escapeHTML(expected)}</span>`;
    }
  }

  promptEl.innerHTML = html;
  idx = inputVal.length; // always advance by input length, even with mistakes
}

function escapeHTML(s) {
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );
}

inputEl.addEventListener("keydown", (e) => {
  if (!gameStarted || gameOver) {
    e.preventDefault(); // 🚫 ignore typing
  }
});
const ACC_WINDOW = 20; // last 20 keystrokes (tune 15–30)
let recentHits = [];

// --- INPUT HANDLER ---
inputEl.addEventListener("input", () => {
  if (gameOver) return;

  lastTypeTime = performance.now();

  // start the run on first input
  if (!startedAt && inputEl.value.length > 0) {
    momentum = 10;
    // if (playerRunAction) {
    //     player.visible = false;
    //     playerIdleAction?.fadeOut(0.15);

    //     playerRunAction
    //         .reset()
    //         .fadeIn(0.15)
    //         .play();

    //     playerMixer.update(0);
    //     player.visible = true;
    // }
    // if (enemyAction) enemyAction.play();
    // if (enemyIdleAction) enemyIdleAction.stop();
    startedAt = performance.now();
  }

  const inputVal = inputEl.value || "";

  // recompute stats
  typedCount = inputVal.length;
  wrongCount = 0;
  for (let i = 0; i < inputVal.length && i < target.length; i++) {
    if (inputVal[i] !== target[i]) wrongCount++;
  }
  if (inputVal.length > target.length) {
    wrongCount += inputVal.length - target.length;
  }

  // Session start (only once)
  if (!sessionStart && inputVal.length > 0) {
    sessionStart = performance.now();
  }

  // trigger stumble only on newly added char and track session counters
  if (inputVal.length > prevInputLen) {
  const pos = inputVal.length - 1;
  sessionTyped++;

  let correct = true;

  if (pos < target.length && inputVal[pos] !== target[pos]) {
    correct = false;
    sessionWrong++;
    stumble();
  } else if (pos >= target.length) {
    correct = false;
    sessionWrong++;
    stumble();
  }

  // ---- RECENT ACCURACY WINDOW ----
  recentHits.push(correct ? 1 : 0);
  if (recentHits.length > ACC_WINDOW) {
    recentHits.shift();
  }
}

  prevInputLen = inputVal.length;

  // update visuals
  renderPrompt();
  // updatePlayer0Speed(dt);
  prog.style.width = (idx / Math.max(1, target.length)) * 100 + "%";

  // completed line?
  if (idx >= target.length) {
    lineCompleteBurst = 1.2;
    newLine();
  }
});

refreshBtn.addEventListener("click", newLine);
pauseBtn.addEventListener("click", () => {
  paused = !paused;
  banner.style.display = paused ? "" : "none";
});
document.addEventListener("keydown", (e) => {
  if (gameOver && e.key === "Enter") {
    banner.style.display = "none";
    paused = false;
    newLine();
  }
});

// Speed mapping & game variables (kept structure, modified tuning slightly)
let stumbleTimer = 0;
let lineCompleteBurst = 0;
function stumble() {
  stumbleTimer = Math.min(stumbleTimer + 0.6, 1.2);
  enemyBoost *= 1.001;
}

function computeStats() {
  if (!sessionStart) return { wpm: 0, acc: 1 };
  const now = performance.now();
  const minutes = (now - sessionStart) / 60000;
  const grossWPM = minutes > 0 ? sessionTyped / 5 / minutes : 0;
  const accuracy =
    sessionTyped > 0
      ? Math.max(0, (sessionTyped - sessionWrong) / sessionTyped)
      : 1;

  return { wpm: grossWPM, acc: accuracy };
}

// --- Player Speeds ---
// const baseSpeed = 1.52;        // constant speed for AI players
let player0Speed = 0; // typing-controlled speed
let targetSpeed = 0; // desired speed from typing
let lastTypeTime = 0; // timestamp of last keypress
const SPEED_STOP_TIME = 0.1;
let effectiveWPM = 0; // smoothed WPM used for speed
const WPM_COOLDOWN_TIME = 2.0; // seconds to reach 0

function getRecentAccuracy() {
  if (recentHits.length === 0) return 1;
  let sum = 0;
  for (let i = 0; i < recentHits.length; i++) {
    sum += recentHits[i];
  }
  return sum / recentHits.length;
}


// function updatePlayer0Speed(dt) {
//   const now = performance.now();
//   const typingActive = now - lastTypeTime < 300;

//   if (typingActive) {
//     const { wpm, acc } = computeStats();

//     const MAX_SPEED = 7.5;

//     const accFactor = 0.6 + 0.4 * Math.pow(acc, 1.2);
//     const wpmFactor = Math.min(wpm / 60, 1);

//     targetSpeed = MAX_SPEED * accFactor * wpmFactor;
//   } else {
//     targetSpeed = 0;
//   }

//   // ---- ACCELERATION ----
//   if (player0Speed < targetSpeed) {
//     const ACCEL = 14.0;
//     player0Speed += (targetSpeed - player0Speed) * ACCEL * dt;
//   }

//   // ---- SMOOTH DECELERATION (KEY FIX) ----
//   if (targetSpeed === 0 && player0Speed > 0) {
//     // Linear time-based slowdown
//     const decelPerSecond =
//       player0Speed / (SPEED_STOP_TIME + player0Speed * 0.1);
//     player0Speed -= decelPerSecond * dt;

//     if (player0Speed < 0.05) {
//       player0Speed = 0;
//     }
//   }
// }

function updatePlayer0Speed(dt) {
  const now = performance.now();
  const typingActive = now - lastTypeTime < 300;

  if (typingActive) {
    const { wpm } = computeStats();
    const recentAcc = getRecentAccuracy();

    const MAX_SPEED = 7.5;

    // ---- ACCURACY HAS STRONG EFFECT ----
    // Below 80% accuracy → harsh slowdown
    const accFactor = Math.pow(recentAcc, 2.5); // 🔥 nonlinear punishment

    // WPM contributes, but accuracy gates it
    const wpmFactor = Math.min(wpm / 60, 1);

    targetSpeed = MAX_SPEED * accFactor * wpmFactor;
  } else {
    targetSpeed = 0;
  }

  // ---- ACCELERATION (fast recovery) ----
  const ACCEL = 16.0;
  player0Speed += (targetSpeed - player0Speed) * ACCEL * dt;

  // Clamp
  if (player0Speed < 0.05) player0Speed = 0;
}

// function updateEnemyMusic(dt) {
//   if (!enemyBGMReady) return;

//   const SPEED_THRESHOLD = 1.0;

//   const normalTarget =
//     player0Speed < SPEED_THRESHOLD ? 0.0 : 1;

//   const enemyTarget =
//     player0Speed < SPEED_THRESHOLD ? 1 : 0.0;

//   const FADE_SPEED = 1.8; // higher = faster crossfade

//   bgm.setVolume(
//     bgm.getVolume() +
//       (normalTarget - bgm.getVolume()) * FADE_SPEED * dt
//   );

//   enemyBGM.setVolume(
//     enemyBGM.getVolume() +
//       (enemyTarget - enemyBGM.getVolume()) * FADE_SPEED * dt
//   );
// }


function updateEffectiveWPM(dt) {
  const now = performance.now();
  const typingActive = now - lastTypeTime < 300;

  const raw = computeStats().wpm;

  if (typingActive) {
    // Smoothly rise toward real WPM
    const RISE = 10.0;
    effectiveWPM += (raw - effectiveWPM) * RISE * dt;
  } else {
    // Time-based decay to zero (same philosophy as speed)
    const decel = effectiveWPM / WPM_COOLDOWN_TIME;
    effectiveWPM -= decel * dt;

    if (effectiveWPM < 0.1) effectiveWPM = 0;
  }
}

// function getSmoothedWPM(raw) {
//     // simple low-pass filter
//     smoothWPM = smoothWPM * 0.85 + raw * 0.15;
//     return smoothWPM;
// }

// --- Animate Players ---
function updatePlayer(delta) {
  if (!player) return;

  player.position.z -= player0Speed * delta;

  if (player0Speed > 0.1) {
    if (!playerRunAction.isRunning()) {
      playerIdleAction.fadeOut(0.15);
      playerRunAction.reset().fadeIn(0.15).play();
    }
  } else {
    if (!playerIdleAction.isRunning()) {
      playerRunAction.fadeOut(0.15);
      playerIdleAction.reset().fadeIn(0.15).play();
    }
  }
}

// --- Camera Follow ---
function updateCamera() {
  if (!player) return;
  camera.position.z = player.position.z + 3;
}

function enemySpeed() {
  return player0Speed + enemyBoost * wrongCount;
}

function formatMS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function showFinalLeaderboard() {
  let overlay = document.getElementById("finalLeaderboard");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "finalLeaderboard";
    overlay.style.position = "fixed";
    overlay.style.left = "50%";
    overlay.style.top = "50%";
    overlay.style.transform = "translate(-50%,-50%)";
    overlay.style.background = "#0f1115";
    overlay.style.border = "1px solid #2a2f3a";
    overlay.style.padding = "18px";
    overlay.style.borderRadius = "12px";
    overlay.style.zIndex = "50";
    overlay.style.minWidth = "260px";
    overlay.style.color = "#e5e7eb";
    document.body.appendChild(overlay);
  }
  // const standings = computeFinalStandings();
  let standings = [];
  const progress = -player.position.z || 0;
  standings.push({ "Distance Covered": progress });
  overlay.innerHTML =
    `<h3 style="margin:0 0 8px 0">Final Standings</h3>` +
    standings
      .map(
        (s, i) =>
          `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.03)"><strong>#${i + 1}</strong> ${s["Distance Covered"]}m</div>`,
      )
      .join("") +
    '<div style="margin-top:10px;text-align:center"><button id="closeFinal" class="btn">Close</button></div>';
  const btn = document.getElementById("closeFinal");
  if (btn)
    btn.onclick = () => {
      overlay.remove();
      location.reload();
    };
}

let leaderboardTimer = 0;

function finishGameByTime() {
  if (!gameTimerRunning) return;
  gameTimerRunning = false;
  paused = true;
  gameOver = true;

  // Get final stats
  const { wpm, acc } = computeStats();
  const playerNameInput = document.getElementById("playerName");
  const playerName = playerNameInput?.value || "Anonymous";
  const distanceCovered = Math.round(-player.position.z) || 0;

  // Store game results to Firebase
  const gameStats = {
    wpm: Math.round(wpm * 100) / 100,
    accuracy: Math.round(acc * 10000) / 100, // as percentage
    distance: distanceCovered,
    sessionTyped: sessionTyped,
    sessionWrong: sessionWrong,
  };

  postScoreToFirebase(distanceCovered, {
    name: playerName,
    meta: gameStats,
  }).catch((err) => console.error("Failed to save score:", err));

  console.log("Game finished - Final stats:", {
    name: playerName,
    ...gameStats,
  });
  bgm.setVolume(0.15); // muffled creepy feel
  spawnPortalAtPlayer();
}

function setGameOver(msg) {
  gameOver = true;
  paused = true;
  banner.textContent = msg + " Press Enter";
  banner.style.display = "";

  if (playerRunAction) {
    player.visible = false;
    playerIdleAction?.fadeOut(0.15);

    playerAction.reset().fadeIn(0.15).play();

    playerMixer.update(0);
    player.visible = true;
  }

  // if (enemyAction) { enemyAction.stop(); }
  // if (enemyIdleAction) { enemyIdleAction.play(); }
}

function updatePlayerSink(dt) {
  if (!sinking || !player) return;

  sinkProgress += dt;

  // smooth easing
  const t = Math.min(sinkProgress / 2.5, 1); // 2.5 seconds
  const ease = t * t * (3 - 2 * t);

  // move player into portal center
  player.position.lerp(
    new THREE.Vector3(
      portal.position.x,
      portal.position.y - 0.6,
      portal.position.z,
    ),
    ease,
  );

  // sink downward
  player.position.y -= dt * 0.6;

  // shrink player
  const scale = THREE.MathUtils.lerp(1, 0.05, ease);
  player.scale.set(scale * 0.007, scale * 0.007, scale * 0.007);

  // optional fade (if material supports it)
  player.traverse((obj) => {
    if (obj.isMesh && obj.material.transparent) {
      obj.material.opacity = 1 - ease;
    }
  });

  // finish
  if (t >= 1) {
    sinking = false;
    player.visible = false;
  }
}

// ---------- Lightning logic ----------
let nextLightningTime = performance.now() + 2000;
function triggerLightning() {
  // random small flashes + big flashes
  const isBig = Math.random() > 0.6;
  const flashIntensity = isBig
    ? 6.0 + Math.random() * 4
    : 1.5 + Math.random() * 1.5;
  const flashDuration = isBig
    ? 200 + Math.random() * 300
    : 60 + Math.random() * 100;

  // animate bolt visibility (immediate)
  boltMat.opacity = isBig ? 0.85 : 0.35;
  lightningLight.intensity = flashIntensity;
  scene.fog.density *= 0.6; // momentary clarity

  // trigger rift flash: stronger for big flashes, smaller for small flickers
  triggerRiftFlash(isBig ? 1.0 : 0.35);

  // small flicker sequence
  const t0 = performance.now();
  const steps = isBig ? 5 : 2;
  let i = 0;
  const interval = setInterval(() => {
    const now = performance.now();
    // pulse intensity
    lightningLight.intensity = flashIntensity * (0.7 + Math.random() * 0.6);
    boltMat.opacity = (0.3 + Math.random() * 0.7) * (isBig ? 1.0 : 0.5);
    if (++i >= steps || now - t0 > flashDuration + 300) {
      clearInterval(interval);
      lightningLight.intensity = 0;
      boltMat.opacity = 0;
    }
  }, 60);

  // schedule next lightning
  nextLightningTime = performance.now() + 2000 + Math.random() * 6000;

  for (const L of lampPool) {
    L.userData.targetIntensity = 2.5;
    L.userData.flickerTimer = 0.15;
  }
}

// --- Scenery Pools ---
const sceneryPool = [];

// Helper to spawn objects
function spawnScenery(mesh, roadWidth = 5, sideOffset = 5, worldDepth = 100) {
  // pick left or right side
  const side = Math.random() > 0.5 ? 1 : -1;

  // place outside road width
  const x = side * (roadWidth / 2 + sideOffset + Math.random() * 10);
  const z = camera.position.z - (20 + Math.random() * worldDepth);

  mesh.position.set(x, 0, z);

  scene.add(mesh);
  sceneryPool.push(mesh);
  return mesh;
}

// --- Procedural Elements ---
// Tree (cylinder trunk + cone leaves)
function makeDeadTree() {
  const tree = new THREE.Group();

  const barkMat = new THREE.MeshStandardMaterial({
    color: 0x2b1c12,
    roughness: 0.98,
    metalness: 0.02,
  });

  // Utility: cylinder whose BASE is at y = 0
  function makeBranchMesh(radiusTop, radiusBottom, height) {
    const geo = new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      7,
      1,
      true,
    );
    geo.translate(0, height / 2, 0); // 🔑 anchor base at y=0
    return new THREE.Mesh(geo, barkMat);
  }

  // ---------------- TRUNK ----------------
  const trunkHeight = 3 + Math.random() * 5;
  const trunk = makeBranchMesh(
    0.35 + Math.random() * 0.1,
    0.65 + Math.random() * 0.2,
    trunkHeight,
  );
  trunk.rotation.z = (Math.random() - 0.5) * 0.15;
  tree.add(trunk);

  // ---------------- RECURSIVE BRANCH ----------------
  function growBranch(parent, length, radius, depth) {
    const branch = makeBranchMesh(radius * 0.55, radius, length);

    // rotate away from parent
    branch.rotation.z =
      (0.4 + Math.random() * 0.6) * (Math.random() < 0.5 ? -1 : 1);
    branch.rotation.x = (Math.random() - 0.5) * 0.4;
    branch.rotation.y = Math.random() * Math.PI * 2;

    parent.add(branch);

    // spawn sub-branches FROM THE END of this branch
    if (depth > 0) {
      const count = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const child = new THREE.Group();
        child.position.y = length * (0.5 + Math.random() * 0.4);
        branch.add(child);

        growBranch(
          child,
          length * (0.5 + Math.random() * 0.3),
          radius * 0.55,
          depth - 1,
        );
      }
    } else {
      // broken tip
      const tipGeo = new THREE.ConeGeometry(radius * 0.6, radius * 2, 5);
      tipGeo.translate(0, radius, 0);
      const tip = new THREE.Mesh(tipGeo, barkMat);
      tip.position.y = length;
      tip.rotation.z = (Math.random() - 0.5) * 0.6;
      branch.add(tip);
    }
  }

  // ---------------- MAIN BRANCHES ----------------
  const branchCount = 3 + Math.floor(Math.random() * 3);

  for (let i = 0; i < branchCount; i++) {
    const attach = new THREE.Group();
    attach.position.y = trunkHeight * (0.45 + Math.random() * 0.35);
    trunk.add(attach);

    growBranch(
      attach,
      2.4 + Math.random() * 2.2,
      0.18 + Math.random() * 0.06,
      1, // sub-branch depth
    );
  }

  // ---------------- BROKEN TRUNK TOP ----------------
  if (Math.random() > 0.55) {
    const topGeo = new THREE.ConeGeometry(0.45, 1.2, 6);
    topGeo.translate(0, 0.6, 0);
    const brokenTop = new THREE.Mesh(topGeo, barkMat);
    brokenTop.position.y = trunkHeight;
    brokenTop.rotation.z = (Math.random() - 0.5) * 0.7;
    trunk.add(brokenTop);
  }

  return tree;
}

// Rock (icosahedron)
function makeRock() {
  return new THREE.Mesh(
    new THREE.IcosahedronGeometry(2, 0),
    new THREE.MeshStandardMaterial({ color: 0x555555, flatShading: true }),
  );
}

// Mushroom (cylinder + sphere)
function makeMushroom() {
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.5, 1.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  );
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xff0000 }),
  );
  cap.position.y = 0.9;
  stem.add(cap);
  return stem;
}

// Streetlamp (cylinder + sphere light)
function makeLamp() {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0xaaaaaa }),
  );
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 8),
    new THREE.MeshStandardMaterial({
      emissive: 0xffffaa,
      emissiveIntensity: 2,
    }),
  );
  bulb.position.y = 3;
  pole.add(bulb);
  return pole;
}

// Road sign (plane)
function makeSign() {
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1.2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x3366ff }),
  );
  board.position.y = 1.8;
  post.add(board);
  return post;
}

// Floating debris (box)
function makeDebris() {
  return new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xaaaaaa }),
  );
}

// --- Initialize a few of each ---
function initScenery() {
  for (let i = 0; i < 20; i++) {
    spawnScenery(makeDeadTree(), 3, 2);
  }
  spawnScenery(makeRock());
  for (let i = 0; i < 10; i++) {
    spawnScenery(makeMushroom());
    spawnScenery(makeLamp());
    spawnScenery(makeSign());
    spawnScenery(makeDebris(), 10, 30);
  }
}
initScenery();

function updateScenery(worldMove) {
  for (const obj of sceneryPool) {
    obj.position.z += worldMove;

    // Only recycle after object has passed the camera (small margin)
    if (obj.position.z > camera.position.z + 6) {
      const side = Math.random() > 0.5 ? 1 : -1;
      obj.position.z = camera.position.z - (80 + Math.random() * 50); // push far into distance
      obj.position.x = side * (10 + Math.random() * 15);
    }
  }
}

// ---------- Game Loop ----------
let last = performance.now();
let gameStarted = false;
newLine();

function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  // update mixers
  if (playerMixer) playerMixer.update(dt);
  // if (enemyMixer) enemyMixer.update(dt);

  // lightning auto trigger
  if (now > nextLightningTime && !paused) {
    triggerLightning();
  }

  if (portalFade >= 1) {
    location.assign("/leaderboard.html");
  }
  updatePlayerSink(dt);
  updatePortalFade(dt);
  updateFogBySpeed(dt);
  // updateEnemyMusic(dt);

  if (!paused) {
    // updateEnemyMusic(dt);

    gameStarted = true;
    // const spd = playerSpeed(dt);
    const worldMove = player0Speed * dt;

    // ground scroll
    ground.position.z += worldMove;
    // wrap ground back when it passes the camera. Use the actual ground length (400)
    // Snap the plane directly behind the camera to avoid any brief visible gap.
    const GROUND_LENGTH = 400;
    const HALF_GROUND = GROUND_LENGTH / 2;
    if (ground.position.z - camera.position.z > HALF_GROUND - 10) {
      // place ground such that its far edge aligns just behind the camera
      ground.position.z = camera.position.z - HALF_GROUND - 1;
    }

    // Also wrap grass planes so they stay under the road without disappearing
    if (grassLeft.position.z - camera.position.z > HALF_GROUND - 10) {
      grassLeft.position.z = camera.position.z - HALF_GROUND - 1;
    }
    if (grassRight.position.z - camera.position.z > HALF_GROUND - 10) {
      grassRight.position.z = camera.position.z - HALF_GROUND - 1;
    }

    // --- NEW: UPDATE BILLBOARD POSITION ---
    // multiple billboards (pool)
    for (const bb of billboardPool) {
      bb.position.z += worldMove;
      if (bb.position.z > camera.position.z + 6) resetBillboard(bb);
    }

    // worldMove computed above
    updateSpores(dt, worldMove);
    updateLamps(dt, worldMove, now * 0.001);
    updateVines(dt, worldMove, now * 0.001);
    updateRifts(dt, worldMove, now * 0.001);
    updateVideoBackdrop();
    updateScenery(worldMove);

    updatePlayer(dt);
    updatePlayer0Speed(dt);
    updateEffectiveWPM(dt);
    updateCamera();
    // const eSpd = enemySpeed();

    // if (enemy) {enemy.position.z -= eSpd * dt;}

    // if (stumbleTimer > 0) { stumbleTimer = Math.max(0, stumbleTimer - dt); }
    // if (lineCompleteBurst > 0) { lineCompleteBurst = Math.max(0, lineCompleteBurst - dt * 1.5); }

    // if (players[playerName] && enemy && enemy.position.z <= players[playerName].position.z - 0.2) {
    //     setGameOver("Caught! Press New Line.");
    // }
  }

  // HUD
  const { wpm, acc } = computeStats();
  wpmEl.textContent = Math.round(wpm);
  accEl.textContent = ((acc * 100) | 0) + "%";
  const spdNow = player0Speed;
  spdEl.textContent = spdNow.toFixed(1);
  let gap = 0;
  // if (players[playerName] && enemy) gap = players[playerName].position.z - enemy.position.z;
  // gapEl.textContent = (gap > 0 ? "Lead " : "Behind ") + Math.abs(gap).toFixed(1) + "m";
  accEl.className = "ok";
  if (acc < 0.93) accEl.className = "danger";

  // Update match timer display (MM:SS) and auto-finish when time runs out
  const countdownEl = document.getElementById("countdown");
  if (gameTimerRunning && countdownEl) {
    const timeLeft = Math.max(0, gameEndTime - performance.now());
    countdownEl.innerText = formatMS(timeLeft);
    // optional visual warning when 10s or less
    if (timeLeft <= 10000) countdownEl.style.color = "#ffd54f";
    else countdownEl.style.color = "red";
    if (timeLeft <= 0) {
      finishGameByTime();
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// Army Men: Microplastic Warfare — an original 3D toy-soldier shooter for phones.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TEAMS, CLASSES, CLASS_IDS, WEAPONS, NADE, MAPS, MODES, COSMETICS, COS_SLOTS, botName, randomCos } from './data.js';
import { World } from './world.js';
import { buildSoldier, pose, stow, crouchPose, buildViewGeometry, plasticMaterial, soldierMaterial, SKINS, SOLDIER_Q } from './soldier.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { initPhysics, buildPhysicsWorld, stepPhysics, startRagdoll, syncRagdoll, endRagdoll, startGetUp, updateGetUp, ragdollCentre, ragdollSpeed, nudgeRagdoll, ballBody, removeBody, PH } from './physics.js';
import { Vehicle, PADS } from './vehicles.js';
import { buildCat, buildKid, buildDad, buildMower } from './critters.js';
import { softSprite, smokeSprite, flashSprite, scorchTex } from './tex.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// ------------------------------------------------------------ profile (stats, cosmetics, settings)
const SAVE = 'plasticfront.v1';
const blankStats = () => ({ matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0, shots: 0, hits: 0, nadeKills: 0, rocketKills: 0, melts: 0, bestStreak: 0, bestMatch: 0, time: 0, classKills: {}, mapWins: {} });
let P = { name: 'Recruit', coins: 150, owned: { head: ['helmet'], finish: ['standard'], base: ['square'], gear: ['none'] }, eq: { head: 'helmet', finish: 'standard', base: 'square', gear: 'none' }, team: 0, cls: 'rifle', map: 'living', mode: 'battle',
  stats: blankStats(), set: { sens: 1, assist: true, sound: true, shadows: true, diff: 'normal' } };
if (!P.skin) P.skin = SKINS[(Math.random() * SKINS.length) | 0];
try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s) P = { ...P, ...s, set: { ...P.set, ...s.set }, stats: { ...blankStats(), ...s.stats } }; } catch (e) {}
const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(P)); } catch (e) {} };

// ------------------------------------------------------------ renderer + post-processing
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.shadowMap.enabled = P.set.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 900);
const hemi = new THREE.HemisphereLight(0xffffff, 0x6b5a40, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.2); sun.castShadow = true;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3; scene.add(sun); scene.add(sun.target);
// a few pooled lights for muzzle flashes and blasts (constant count so shaders never recompile)
const flashLights = [0].map(() => { const l = new THREE.PointLight(0xffb75a, 0, 9, 2); scene.add(l); return l; }); let flashI = 0;
function flashLight(p, power, range, life) { if (P.set.q === 'low') return; const l = flashLights[flashI++ % flashLights.length]; if (l.intensity > power * 0.5) return; l.position.copy(p); l.intensity = power; l.distance = range; l.userData.life = life; l.userData.max = life; l.userData.p0 = power; }
// first-person arms + weapon live in their own little scene with their own camera
const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
const vmHemi = new THREE.HemisphereLight(0xffffff, 0x6b5a40, 0.9), vmSun = new THREE.DirectionalLight(0xfff2dc, 2.2); vmScene.add(vmHemi, vmSun, vmSun.target);
vmScene.environment = scene.environment; vmScene.environmentIntensity = 0.5;
const VMADS = { rifle: { ox: -0.11, oy: -0.063, oz: 0.07 }, sniper: { ox: -0.11, oy: -0.08, oz: 0.07 }, bazooka: { ox: -0.11, oy: -0.138, oz: 0.12 }, flamer: { ox: 0.03, oy: -0.1, oz: -0.1 } };
const VMOFF = { rifle: { ox: 0.08, oy: -0.1, oz: 0.0, oyaw: -0.04 }, sniper: { ox: 0.08, oy: -0.11, oz: 0.01, oyaw: -0.04 }, flamer: { ox: 0.12, oy: -0.06, oz: -0.12, oyaw: -0.08 }, bazooka: { ox: 0.18, oy: -0.2, oz: 0.05, oyaw: -0.03 } };
const vm = { ox: 0.13, oy: -0.15, oz: 0.14, oyaw: -0.05, group: new THREE.Group(), mesh: null, key: '', kick: 0, bob: 0, swayX: 0, swayY: 0, flash: null };
vmScene.add(vm.group);

const QUAL = { low: { pr: 0.85, shadow: 1024, dof: false, bloom: false, samples: 0, post: false }, medium: { pr: 1, shadow: 1024, dof: false, bloom: true, samples: 0, post: true }, high: { pr: 1.5, shadow: 2048, dof: true, bloom: true, samples: 2, post: true } };
if (!P.set.q || !P.set.perf2) { P.set.q = 'medium'; P.set.perf2 = 1; }
if (!P.set.view) P.set.view = 'fp';
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.32 }, uHurt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uHurt; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb;
      float l = dot(col, vec3(.299,.587,.114)); col = mix(vec3(l), col, 1.12);            // a touch more saturation
      col = col * vec3(1.03, 1.0, 0.96);                                                  // warm grade
      vec2 d = vUv - .5; float v = 1. - dot(d, d) * uVig * 2.6; col *= clamp(v, 0., 1.);
      col = mix(col, vec3(col.r * 1.3 + .08, col.g * .55, col.b * .5), uHurt * smoothstep(.15, .7, length(d)));
      col += (h(vUv * 800. + uTime) - .5) * .018;                                          // light film grain
      gl_FragColor = vec4(col, c.a); }` };
let composer = null, passes = {}, titleMen = [];
// dynamic resolution: drop the render scale when the frame rate dips, raise it when there's headroom
const DYN = { scale: 0, max: 1, min: 0.55, acc: 0, frames: 0, fps: 60, cool: 0 };
function dynRes(dt) {
  DYN.acc += dt; DYN.frames++; DYN.cool -= dt; if (DYN.acc < 1) return;
  DYN.fps = DYN.frames / DYN.acc; DYN.acc = 0; DYN.frames = 0; if (DYN.cool > 0) return;
  let ns = DYN.scale; if (DYN.fps < 44) ns = Math.max(DYN.min, DYN.scale - (DYN.fps < 32 ? 0.15 : 0.08)); else if (DYN.fps > 57) ns = Math.min(DYN.max, DYN.scale + 0.05);
  if (Math.abs(ns - DYN.scale) > 0.01) { DYN.scale = ns; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ns)); resize(); DYN.cool = 1.5; }
  const f = $('fps'); if (f && P.set.fps) f.textContent = Math.round(DYN.fps) + ' fps';
}
function setupPost() {
  const Q = QUAL[P.set.q]; SOLDIER_Q.physical = P.set.q === 'high'; DYN.max = Q.pr; DYN.scale = Math.min(DYN.scale || Q.pr, Q.pr); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DYN.scale));
  sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: Q.samples });
  composer = new EffectComposer(renderer, rt); passes = {};
  composer.addPass(new RenderPass(scene, camera));
  if (Q.dof) { passes.dof = new BokehPass(scene, camera, { focus: 4, aperture: 0.0016, maxblur: 0.006 }); composer.addPass(passes.dof); }
  const vmPass = new RenderPass(vmScene, vmCam); vmPass.clear = false; vmPass.clearDepth = true; composer.addPass(vmPass); passes.vm = vmPass;
  if (Q.bloom) { passes.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.28, 0.5, 1.05); composer.addPass(passes.bloom); }
  passes.grade = new ShaderPass(GradeShader); composer.addPass(passes.grade);
  composer.addPass(new OutputPass());
  composer.setSize(w, h);
}
// Low quality skips post-processing entirely: world, then the first-person arms on top
function renderFrame(dt) {
  renderer.info.autoReset = false; renderer.info.reset();
  if (QUAL[P.set.q].post) { composer.render(dt); return; }
  renderer.autoClear = true; renderer.render(scene, camera);
  if (vm.group.visible) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(vmScene, vmCam); renderer.autoClear = true; }
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); if (composer && passes.bloom) passes.bloom.setSize(w * renderer.getPixelRatio() / 2, h * renderer.getPixelRatio() / 2); camera.aspect = w / h; camera.updateProjectionMatrix(); vmCam.aspect = w / h; vmCam.updateProjectionMatrix(); if (composer) composer.setSize(w, h); }
addEventListener('resize', resize); setupPost(); resize();

// ------------------------------------------------------------ sound (synthesised, no files)
const AU = {
  ac: null, out: null,
  init() { if (this.ac) return; try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); this.out = this.ac.createGain(); this.out.gain.value = 0.5; this.out.connect(this.ac.destination); this.nb = this.ac.createBuffer(1, this.ac.sampleRate, this.ac.sampleRate); const d = this.nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) {} },
  noise(dur, f, type, vol, at = 0) { if (!this.ac || !P.set.sound) return; const t = this.ac.currentTime + at, s = this.ac.createBufferSource(); s.buffer = this.nb; const fl = this.ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = this.ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(fl); fl.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); },
  tone(f0, f1, dur, vol, type = 'square', at = 0) { if (!this.ac || !P.set.sound) return; const t = this.ac.currentTime + at, o = this.ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = this.ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.02); },
  vol(p) { if (!p || !G) return 1; return clamp(1 - camera.position.distanceTo(p) / 70, 0.05, 1); },
  shot(p, kind) { const v = this.vol(p); if (kind === 'sniper') { this.noise(0.5, 2200, 'lowpass', 0.9 * v); this.noise(0.08, 5000, 'highpass', 0.5 * v); this.tone(180, 40, 0.3, 0.35 * v, 'sine'); this.noise(0.9, 400, 'lowpass', 0.25 * v, 0.12); }
    else { this.noise(0.12, 3000, 'bandpass', 0.7 * v); this.noise(0.05, 6000, 'highpass', 0.3 * v); this.tone(260, 70, 0.08, 0.25 * v, 'sine'); this.noise(0.35, 600, 'lowpass', 0.12 * v, 0.06); } },
  tink(p) { const v = this.vol(p) * 0.5; this.tone(5200, 4800, 0.04, 0.06 * v, 'sine'); this.tone(6100, 5900, 0.03, 0.04 * v, 'sine', 0.05); },
  medal(n) { for (let i = 0; i < Math.min(n, 4); i++) this.tone(660 * (1 + i * 0.26), 880 * (1 + i * 0.26), 0.12, 0.14, 'triangle', i * 0.09); },
  mowerOn() { if (!this.ac || this.mow) return; const o = this.ac.createOscillator(), o2 = this.ac.createOscillator(), g = this.ac.createGain(), f = this.ac.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 62; o2.type = 'square'; o2.frequency.value = 124.5; f.type = 'lowpass'; f.frequency.value = 700; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g); g.connect(this.out); o.start(); o2.start(); this.mow = { o, o2, g }; },
  mowerVol(v) { if (this.mow) this.mow.g.gain.value = P.set.sound ? v : 0; },
  mowerOff() { if (!this.mow) return; try { this.mow.o.stop(); this.mow.o2.stop(); } catch (e) {} this.mow = null; },
  shred(p) { const v = this.vol(p); this.noise(0.35, 2200, 'bandpass', 0.8 * v); this.tone(300, 80, 0.2, 0.3 * v, 'sawtooth'); },
  meow() { this.tone(500, 900, 0.18, 0.25, 'sawtooth'); this.tone(900, 420, 0.4, 0.22, 'sawtooth', 0.18); },
  hiss() { this.noise(0.8, 4000, 'highpass', 0.45); },
  thump(p) { const v = this.vol(p); this.tone(70, 30, 0.25, 0.6 * v, 'sine'); this.noise(0.15, 300, 'lowpass', 0.5 * v); },
  scream() { if (!this.ac || !P.set.sound) return; const t = this.ac.currentTime, o = this.ac.createOscillator(), lfo = this.ac.createOscillator(), lg = this.ac.createGain(), g = this.ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(900, t); o.frequency.linearRampToValueAtTime(1300, t + 0.3); o.frequency.linearRampToValueAtTime(1100, t + 1.6); lfo.frequency.value = 9; lg.gain.value = 60; lfo.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.08); g.gain.setValueAtTime(0.28, t + 1.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8); const f = this.ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8; o.connect(f); f.connect(g); g.connect(this.out); o.start(t); lfo.start(t); o.stop(t + 1.9); lfo.stop(t + 1.9); },
  melee() { this.noise(0.12, 900, 'lowpass', 0.6); this.tone(140, 60, 0.12, 0.4, 'sine'); },
  boom(p) { const v = this.vol(p); this.noise(1.4, 420, 'lowpass', 1.2 * v); this.noise(0.25, 2400, 'bandpass', 0.5 * v); this.tone(110, 25, 0.7, 0.7 * v, 'sine'); this.noise(1.6, 180, 'lowpass', 0.5 * v, 0.15); },
  whoosh(p) { this.noise(0.4, 900, 'bandpass', 0.35 * this.vol(p)); },
  clack(p) { const v = this.vol(p); this.tone(1400, 900, 0.03, 0.25 * v, 'triangle'); this.tone(1100, 700, 0.03, 0.2 * v, 'triangle', 0.07); this.tone(900, 600, 0.03, 0.12 * v, 'triangle', 0.13); },
  tick(p) { this.tone(2200, 1800, 0.02, 0.15 * this.vol(p), 'triangle'); },
  flame(p) { this.noise(0.12, 700, 'lowpass', 0.25 * this.vol(p)); },
  hit() { this.tone(1600, 1200, 0.04, 0.12, 'triangle'); },
  ui() { this.tone(660, 880, 0.06, 0.12, 'triangle'); },
};

// ------------------------------------------------------------ game state
let G = null;            // the running match
let world = null;
let mode = 'title';      // title | play | paused | over
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function fwd(yaw, pitch, out = new THREE.Vector3()) { return out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)); }

const markTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 6; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(10, 14); g.lineTo(32, 50); g.lineTo(54, 14); g.lineTo(32, 26); g.closePath(); g.stroke(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
function makeMarker(color) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, color, depthTest: false, depthWrite: false, transparent: true, fog: false, sizeAttenuation: false })); s.scale.set(0.085, 0.085, 1); s.renderOrder = 999; s.center.set(0.5, 0); scene.add(s); return s; }
class Soldier {
  constructor(team, cls, isPlayer, name, cos) {
    this.team = team; this.cls = cls; this.isPlayer = isPlayer; this.name = name; this.cos = cos;
    this.pos = new THREE.Vector3(); this.vy = 0; this.yaw = 0; this.pitch = 0; this.onGround = true;
    this.alive = false; this.respawn = 0; this.hp = 100; this.walk = 0; this.streak = 0;
    this.k = 0; this.d = 0; this.shots = 0; this.hits = 0; this.lastHurt = 9; this.lastFired = 9;
    this.path = null; this.pi = 0; this.repath = 0; this.target = null; this.think = Math.random() * 0.3; this.strafe = 1; this.stuck = 0;
    this.make();
  }
  make() {
    if (this.m) scene.remove(this.m.root);
    this.m = buildSoldier(TEAMS[G.teamIds[this.team]].color, this.cls, this.cos); scene.add(this.m.root);
    this.def = CLASSES[this.cls]; this.w = WEAPONS[this.def.weapon];
  }
  marker() { if (!this.mark) this.mark = makeMarker(new THREE.Color(TEAMS[G.teamIds[this.team]].color).multiplyScalar(1.6)); return this.mark; }
  spawn() {
    const z = world.spawnZone(this.team, G.teams);
    const p = world.randomOpen(z[0], z[1], z[2], z[3]); this.pos.copy(p); this.pos.y = world.groundAt(p.x, p.z, 2);
    this.yaw = Math.atan2(-p.x, -p.z); this.pitch = 0; this.vy = 0;
    this.hp = this.def.hp; this.ammo = this.w.mag; this.reload = 0; this.cool = 0; this.nades = NADE.per; this.alive = true; this.lastHurt = 9; this.dying = null;
    this.protect = 1.5; this.down = null; this.goSeat = null; this.path = null; this.target = null; this.streak = 0;
    this.m.body.rotation.set(0, 0, 0); this.m.body.position.set(0, 0, 0); this.m.body.scale.set(1, 1, 1); this.m.root.visible = true;
  }
  get eye() { return tmpV2.set(this.pos.x, this.pos.y + 0.9, this.pos.z); }
  chest(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 0.62, this.pos.z); }
  muzzleWorld(out = new THREE.Vector3()) { this.m.root.updateMatrixWorld(true); return out.copy(this.m.muzzle).applyMatrix4(this.m.aim.matrixWorld); }
}

// ray against the plastic men: two spheres per man (legs + chest/head)
function rayMen(o, d, maxT, skip) {
  let best = maxT, who = null, head = false;
  for (const s of G.men) {
    if (!s.alive || s === skip || s.hidden) continue;
    const down = s.m.rag ? ragdollCentre(s.m) : null;
    for (const [yy, r, hd] of down ? [[0, 0.34]] : [[0.92, 0.075, 1], [0.32, 0.25], [0.66, 0.24]]) {
      const cx = (down ? down.x : s.pos.x) - o.x, cy = (down ? down.y : s.pos.y + yy) - o.y, cz = (down ? down.z : s.pos.z) - o.z;
      const tc = cx * d.x + cy * d.y + cz * d.z; if (tc < 0) continue;
      const d2 = cx * cx + cy * cy + cz * cz - tc * tc; if (d2 > r * r) continue;
      const t = tc - Math.sqrt(r * r - d2); if (t < best - (hd ? -0.02 : 0)) { best = t; who = s; head = !!hd; }
    }
  }
  return { t: best, who, head };
}
function lineOfSight(a, b) { tmpV.subVectors(b, a); const L = tmpV.length(); tmpV.divideScalar(L); return world.ray(a, tmpV, L) >= L - 0.05; }

// ------------------------------------------------------------ effects (sprites, sparks, casings, decals)
const FX = { parts: [], tracers: [], decals: [], casings: [] };
const SPR = { soft: softSprite(), smoke: smokeSprite(), flash: flashSprite(), scorch: scorchTex() };
const chipGeo = new THREE.BoxGeometry(0.07, 0.05, 0.07); const chipMats = new Map(); const chipMat = (c) => chipMats.get(c) || (chipMats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })), chipMats.get(c));
// kind: 'smoke' (normal blend), 'fire'/'spark' (additive), 'chip' (solid plastic bit that bounces)
function part(kind, p, o = {}) {
  let obj;
  if (kind === 'chip') { obj = new THREE.Mesh(chipGeo, o.mat || chipMat(o.color ?? 0x888888)); obj.castShadow = false; obj.rotation.set(rnd(0, 6), rnd(0, 6), 0); }
  else {
    const add = kind !== 'smoke';
    obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: kind === 'smoke' ? SPR.smoke : kind === 'flash' ? SPR.flash : SPR.soft, color: o.color ?? 0xffffff, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: o.op ?? 1, rotation: rnd(0, 6) }));
  }
  if (FX.parts.length > (P.set.q === 'low' ? 120 : 220)) { const old = FX.parts.shift(); old.sc.remove(old.obj); if (old.kind !== 'chip') old.obj.material.dispose(); }
  obj.position.copy(p); obj.scale.setScalar(o.size ?? 0.3); (o.scene || scene).add(obj);
  FX.parts.push({ obj, kind, v: o.v ? o.v.clone() : new THREE.Vector3(), life: o.life ?? 0.6, max: o.life ?? 0.6, grow: o.grow ?? 1.5, g: o.g ?? (kind === 'chip' ? 16 : kind === 'spark' ? 9 : 0), op: o.op ?? 1, drag: o.drag ?? 0.6, sc: o.scene || scene, spin: rnd(-3, 3) });
}
function updateFX(dt) {
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const q = FX.parts[i]; q.life -= dt;
    if (q.life <= 0) { q.sc.remove(q.obj); if (q.kind !== 'chip') q.obj.material.dispose(); FX.parts.splice(i, 1); continue; }
    q.v.y -= q.g * dt; q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt)); q.obj.position.addScaledVector(q.v, dt);
    const k = q.life / q.max;
    if (q.kind === 'chip') { q.obj.rotation.x += q.spin * dt * 4; if (q.obj.position.y < 0.04) { q.obj.position.y = 0.04; q.v.y = Math.abs(q.v.y) * 0.3; q.v.x *= 0.5; q.v.z *= 0.5; q.spin *= 0.5; } if (k < 0.2) q.obj.scale.setScalar(k * 5); continue; }
    q.obj.scale.multiplyScalar(1 + q.grow * dt); q.obj.material.opacity = q.op * (q.kind === 'smoke' ? Math.min(1, k * 1.6) * Math.min(1, (1 - k) * 8 + 0.2) : k);
    if (q.kind === 'smoke') q.obj.material.rotation += q.spin * dt * 0.2;
  }
  for (let i = FX.tracers.length - 1; i >= 0; i--) { const t = FX.tracers[i]; t.life -= dt; t.m.material.opacity = Math.max(0, t.life / t.max) * 0.9; if (t.life <= 0) { scene.remove(t.m); t.m.material.dispose(); FX.tracers.splice(i, 1); } }
  for (let i = FX.casings.length - 1; i >= 0; i--) { const c = FX.casings[i]; c.life -= dt; c.v.y -= 18 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.spin * dt; c.m.rotation.z += c.spin * 0.7 * dt;
    const g = world.groundAt(c.m.position.x, c.m.position.z, c.m.position.y + 0.2, 0.02); if (c.m.position.y < g + 0.02) { c.m.position.y = g + 0.02; c.v.y = Math.abs(c.v.y) * 0.35; c.v.x *= 0.6; c.v.z *= 0.6; c.spin *= 0.6; if (!c.tinked && Math.abs(c.v.y) > 0.5) { AU.tink(c.m.position); c.tinked = true; } }
    if (c.life <= 0) { (c.sc || scene).remove(c.m); FX.casings.splice(i, 1); } }
  for (let i = FX.decals.length - 1; i >= 0; i--) { const d = FX.decals[i]; d.life -= dt; if (d.life < 2) d.m.material.opacity = d.op * Math.max(0, d.life / 2); if (d.life <= 0) { scene.remove(d.m); d.m.material.dispose(); FX.decals.splice(i, 1); } }
  for (const l of flashLights) if (l.intensity > 0) { l.userData.life -= dt; l.intensity = Math.max(0, l.userData.p0 * (l.userData.life / l.userData.max)); }
}
const tracerGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 5, 1, true); tracerGeo.rotateX(Math.PI / 2); tracerGeo.translate(0, 0, 0.5);
function tracer(a, b, color = 0xffd27a, width = 1) {
  const L = a.distanceTo(b); if (L < 0.2) return;
  if (FX.tracers.length > 24) { const t = FX.tracers.shift(); scene.remove(t.m); t.m.material.dispose(); }
  const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
  m.position.copy(a); m.lookAt(b); m.scale.set(width, width, L); scene.add(m); FX.tracers.push({ m, life: 0.09, max: 0.09 });
}
const casingGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), casingMat = new THREE.MeshStandardMaterial({ color: 0xd6a945, metalness: 1, roughness: 0.3 });
function casing(p, right, sc = scene) {
  if (FX.casings.length > 40) { const c = FX.casings.shift(); (c.sc || scene).remove(c.m); }
  const m = new THREE.Mesh(casingGeo, casingMat); m.position.copy(p); sc.add(m);
  FX.casings.push({ m, v: right.clone().multiplyScalar(rnd(2, 3)).add(new THREE.Vector3(0, rnd(2, 3.5), 0)), life: 2.5, spin: rnd(10, 20), sc });
}
function decal(p, n, size, tex, op = 0.85, life = 25) {
  if (FX.decals.length > 70) { const d = FX.decals.shift(); scene.remove(d.m); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: op, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.position.copy(p).addScaledVector(n, 0.015); m.lookAt(p.clone().add(n)); m.rotateZ(rnd(0, 6)); scene.add(m); FX.decals.push({ m, life, op });
}
const holeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  let gr = g.createRadialGradient(32, 32, 4, 32, 32, 30); gr.addColorStop(0, 'rgba(60,50,40,.55)'); gr.addColorStop(1, 'rgba(60,50,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(8,6,4,1)'; g.beginPath(); g.arc(32, 32, 9, 0, 7); g.fill(); g.strokeStyle = 'rgba(230,225,210,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(32, 32, 11, 0, 7); g.stroke();
  for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28; g.strokeStyle = 'rgba(10,8,6,.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(32 + Math.cos(a) * 10, 32 + Math.sin(a) * 10); g.lineTo(32 + Math.cos(a) * (15 + Math.random() * 8), 32 + Math.sin(a) * (15 + Math.random() * 8)); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
// shot props: soup cans spring a leak, cheerios burst apart
const LEAKS = []; const dropMats = new Map();
function leak(b, p, n) {
  if (LEAKS.length > 12) LEAKS.shift();
  const pud = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshStandardMaterial({ color: b.fill, roughness: 0.15, transparent: true, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: -3 }));
  pud.rotation.x = -Math.PI / 2; const fx = p.x + n.x * 0.9, fz = p.z + n.z * 0.9; pud.position.set(fx, 0.02, fz); pud.scale.setScalar(0.05); scene.add(pud);
  LEAKS.push({ p: p.clone().addScaledVector(n, 0.05), n: n.clone(), color: b.fill, t: 14, pud, size: 0.05 }); FX.decals.push({ m: pud, life: 60, op: 0.92 });
}
function updateLeaks(dt) {
  for (const L of LEAKS) { if (L.t <= 0) continue; L.t -= dt; const rate = Math.min(1, L.t / 6);
    if (Math.random() < 0.7 * rate) { if (!dropMats.has(L.color)) dropMats.set(L.color, new THREE.MeshStandardMaterial({ color: L.color, roughness: 0.2 })); part('chip', L.p, { mat: dropMats.get(L.color), life: 0.9, v: L.n.clone().multiplyScalar(rnd(1.2, 2) * rate + 0.3).add(new THREE.Vector3(rnd(-0.1, 0.1), 0, rnd(-0.1, 0.1))) }); }
    L.size = Math.min(2.6, L.size + dt * 0.25 * rate); L.pud.scale.setScalar(L.size); }
}
function burstCheerio(i, push) {
  const C = world.cheerios; if (!C || !C.alive[i]) return; C.alive[i] = false;
  const m4 = new THREE.Matrix4().makeScale(0, 0, 0); C.im.setMatrixAt(i, m4); C.im.instanceMatrix.needsUpdate = true;
  const p = C.pos[i]; for (let k = 0; k < 8; k++) part('chip', p, { color: 0xd9a441, life: 2, v: (push || new THREE.Vector3()).clone().add(new THREE.Vector3(rnd(-2.5, 2.5), rnd(2, 4.5), rnd(-2.5, 2.5))) });
  part('smoke', p, { size: 0.3, life: 0.6, grow: 2, op: 0.4, color: 0xe8c890 }); AU.tick(p);
}
function rayCheerio(o, d, maxT) { const C = world.cheerios; if (!C) return null; let best = null, bt = maxT; for (let i = 0; i < C.pos.length; i++) { if (!C.alive[i]) continue; const c = C.pos[i], cx = c.x - o.x, cy = c.y - o.y, cz = c.z - o.z, tc = cx * d.x + cy * d.y + cz * d.z; if (tc < 0 || tc > bt) continue; const d2 = cx * cx + cy * cy + cz * cz - tc * tc; if (d2 < 0.36) { bt = tc; best = i; } } return best == null ? null : { i: best, t: bt }; }
function muzzle(p, dir, s) {
  const fpv = s.isPlayer && P.set.view === 'fp' && s.alive;
  if (fpv && vm.mesh) { const wp = vm.mesh.localToWorld(vm.muzzle.clone()); part('flash', wp, { size: s.cls === 'sniper' ? 0.22 : 0.16, life: 0.05, grow: 2, scene: vmScene }); }
  else part('flash', p, { size: s.cls === 'sniper' ? 0.42 : 0.3, life: 0.05, grow: 2 });
  part('smoke', p.clone().addScaledVector(dir, 0.1), { size: 0.12, life: 0.5, grow: 2.5, op: 0.35, v: dir.clone().multiplyScalar(0.8).add(new THREE.Vector3(0, 0.4, 0)), color: 0xd8d4cc });
  flashLight(p, s.isPlayer ? 18 : 10, 7, 0.06);
}
function explosion(p, owner, kind) {
  AU.boom(p);
  flashLight(p.clone().add(new THREE.Vector3(0, 0.6, 0)), 260, 22, 0.35);
  for (let i = 0; i < 10; i++) part('fire', p.clone().add(new THREE.Vector3(rnd(-0.5, 0.5), rnd(0, 0.6), rnd(-0.5, 0.5))), { size: rnd(0.8, 1.6), life: rnd(0.25, 0.5), grow: 2.2, color: [0xffe08a, 0xffa040, 0xff6a20][i % 3], v: new THREE.Vector3(rnd(-3, 3), rnd(1, 4), rnd(-3, 3)) });
  for (let i = 0; i < 14; i++) part('smoke', p.clone().add(new THREE.Vector3(rnd(-0.6, 0.6), rnd(0.2, 1), rnd(-0.6, 0.6))), { size: rnd(0.9, 1.6), life: rnd(1.4, 2.6), grow: 0.9, op: 0.7, color: [0x6a6660, 0x8a857c, 0x4a4844][i % 3], v: new THREE.Vector3(rnd(-1.6, 1.6), rnd(1.2, 3), rnd(-1.6, 1.6)), drag: 1.2 });
  for (let i = 0; i < 16; i++) part('spark', p.clone(), { size: 0.07, life: rnd(0.3, 0.7), grow: 0, color: 0xffc860, v: new THREE.Vector3(rnd(-8, 8), rnd(3, 9), rnd(-8, 8)), drag: 0.3 });
  for (let i = 0; i < 8; i++) part('chip', p.clone().add(new THREE.Vector3(0, 0.2, 0)), { color: world.mapId === 'backyard' ? 0x4a3a24 : 0x6a5a48, life: 2, v: new THREE.Vector3(rnd(-5, 5), rnd(3, 7), rnd(-5, 5)) });
  if (world.cheerios) world.cheerios.pos.forEach((c, i) => { const dd = c.distanceTo(p); if (dd < 4.5) burstCheerio(i, c.clone().sub(p).normalize().multiplyScalar(6 * (1 - dd / 4.5))); });
  const g = world.groundAt(p.x, p.z, p.y + 0.5, 0.1); if (p.y - g < 1.2) decal(new THREE.Vector3(p.x, g, p.z), new THREE.Vector3(0, 1, 0), 4.5, SPR.scorch, 0.9, 40);
  const r = kind === 'nade' ? NADE.radius : kind === 'shell' ? 4.4 : kind === 'bomb' ? 5 : WEAPONS.bazooka.radius, dmg = kind === 'nade' ? NADE.dmg : kind === 'shell' ? 150 : kind === 'bomb' ? 170 : WEAPONS.bazooka.dmg;
  for (const v of G.vehicles || []) { if (!v.alive) continue; const dd = v.pos.distanceTo(p) - 1; if (dd < r) { hurtVehicle(v, dmg * 1.4 * (1 - Math.max(0, dd) / r), owner); const imp = v.pos.sub(p).normalize().multiplyScalar(v.body.mass() * 5 * (1 - Math.max(0, dd) / r)); imp.y = Math.abs(imp.y) + v.body.mass() * 3; v.body.applyImpulseAtPoint({ x: imp.x, y: imp.y, z: imp.z }, { x: p.x, y: p.y, z: p.z }, true); } }
  for (const s of G.men) {
    if (!s.alive) continue; const c = s.chest(tmpV); const dist = c.distanceTo(p);
    if (dist > r) continue;
    const self = s === owner; if (!self && s.team === owner.team) continue;
    const away = tmpV.clone().sub(p).setY(0).normalize();
    hurt(s, dmg * (1 - (dist / r) * 0.6) * (self ? 0.5 : 1), owner, kind, away.clone().setY(0.6).normalize());
    if (s.alive && !s.inVehicle && dist < r * 0.8) knockDown(s, away.multiplyScalar(6 * (1 - dist / r) + 2).setY(5 * (1 - dist / r) + 2));
  }
  if (G.player) { const d = camera.position.distanceTo(p); if (d < 16) G.shake = Math.max(G.shake, 0.7 * (1 - d / 16)); }
}

// ------------------------------------------------------------ combat
function hurt(s, dmg, by, kind, dir) {
  if (!s.alive || s.protect > 0) return;
  if (s.isPlayer && by && !by.isPlayer) dmg *= G.botDmg;
  if (by && G.player && by.team === G.player.team && s.team !== G.player.team) s.spotT = 5;
  s.hp -= dmg; s.lastHurt = 0; s.hurtFrom = by; s.hurtBy = by && by.cls;
  if (by && by !== s) { by.hits++; if (by.isPlayer) { AU.hit(); flashHit(); } }
  if (s.isPlayer) { $('hurt').style.boxShadow = 'inset 0 0 90px rgba(210,30,20,.75)'; setTimeout(() => $('hurt').style.boxShadow = 'inset 0 0 90px rgba(210,30,20,0)', 160); }
  if (s.hp <= 0) knockOver(s, by, kind, dir);
}
// alive but flattened: ragdoll for a moment, then pick yourself up
function knockDown(s, push) {
  if (!s.alive || s.down || s.inVehicle) return;
  s.down = { t: 0, phase: 'fall' }; startRagdoll(s.m, push, 6); if (s.isPlayer) { IN.fire = false; G.scoped = false; }
}
function updateDown(s, dt) {
  const D = s.down; D.t += dt;
  if (D.phase === 'fall') {
    syncRagdoll(s.m); const c = ragdollCentre(s.m); s.pos.set(c.x, world.groundAt(c.x, c.z, c.y), c.z);
    if ((D.t > 1.1 && ragdollSpeed(s.m) < 1.2) || D.t > 3.5) {
      // stand up where the body landed, facing the way the torso points
      const t = s.m.rag.parts[0].body.rotation(); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(t.x, t.y, t.z, t.w));
      let x = c.x, z = c.z; for (let k = 0; k < 12 && world.blocked(x, z, 0); k++) { x += rnd(-0.5, 0.5); z += rnd(-0.5, 0.5); }
      s.pos.set(x, world.groundAt(x, z, c.y + 0.3), z); s.yaw = Math.atan2(f.x, f.z) + (f.y > 0 ? Math.PI : 0);
      s.m.root.position.copy(s.pos); s.m.root.rotation.y = s.yaw; pose(s.m, 0, false); s.m.body.position.set(0, 0, 0);
      startGetUp(s.m, s.m.root); D.phase = 'up';
    }
  } else if (updateGetUp(s.m, dt)) { s.down = null; s.protect = Math.max(s.protect, 0.4); }
}
function knockOver(s, by, kind, dir) {
  if (s.inVehicle || (s.anim && s.anim.v)) { const v = s.inVehicle ? s.inVehicle.v : s.anim.v; ejectFrom(s, v); }
  s.alive = false; s.d++; s.respawn = 4; s.streak = 0; AU.clack(s.pos);
  dir = dir || new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw)).negate();
  s.dying = { t: 0, kind, dir: dir.clone().setY(0).normalize(), vel: new THREE.Vector3(), spin: rnd(-8, 8) };
  if (kind !== 'flame') {
    const blast = kind === 'rocket' || kind === 'nade';
    const push = dir.clone().setY(0).normalize().multiplyScalar(blast ? rnd(7, 10) : kind === 'melee' ? 5 : kind === 'shot' && s.hurtBy === 'sniper' ? 6 : 2.6); push.y = blast ? rnd(6, 9) : 1.2;
    if (s.m.rag) { s.down = null; if (s.m.rag.getup) { endRagdoll(s.m); startRagdoll(s.m, push, 6); } else nudgeRagdoll(s.m, push.multiplyScalar(0.3)); } else startRagdoll(s.m, push, blast ? 10 : 3);
  }
  for (let i = 0; i < 7; i++) part('chip', s.chest(), { mat: s.m.mat, life: 2.5, v: new THREE.Vector3(rnd(-3, 3), rnd(2, 5), rnd(-3, 3)) });
  if (kind === 'flame') for (let i = 0; i < 6; i++) part('smoke', s.chest(), { size: 0.5, life: 2, grow: 0.8, op: 0.6, color: 0x3a3a36, v: new THREE.Vector3(rnd(-0.4, 0.4), rnd(0.8, 1.6), rnd(-0.4, 0.4)) });
  if (by && by !== s) {
    by.k++; by.streak++; G.score[by.team]++;
    if (by.isPlayer) { multiKill(); G.ps.kills++; G.ps.bestStreak = Math.max(G.ps.bestStreak, by.streak); G.ps.classKills[by.cls] = (G.ps.classKills[by.cls] || 0) + 1; if (kind === 'nade') G.ps.nadeKills++; if (kind === 'rocket') G.ps.rocketKills++; if (kind === 'flame') G.ps.melts++; toast((kind === 'flame' ? 'Melted ' : 'Knocked over ') + s.name, 1.4); }
  } else if (s === by && G.score[s.team] > 0) { G.score[s.team]--; }
  if (s.isPlayer) G.ps.deaths++;
  const verb = kind === 'mower' ? 'got mowed' : kind === 'head' ? 'headshot' : kind === 'melee' ? 'smacked' : kind === 'flame' ? 'melted' : kind === 'rocket' ? 'blasted' : kind === 'nade' ? 'fragged' : 'tipped';
  feed(by && by !== s ? `<b style="color:${TEAMS[G.teamIds[by.team]].css}">${esc(by.name)}</b> ${verb} <b style="color:${TEAMS[G.teamIds[s.team]].css}">${esc(s.name)}</b>` : `<b style="color:${TEAMS[G.teamIds[s.team]].css}">${esc(s.name)}</b> ${kind === 'mower' ? 'got mowed by Dad' : kind === 'melee' ? 'got squashed' : 'fell over'}`);
  if (G.score.some((v) => v >= G.goal)) endMatch();
}

function updateLock(s, dt, isBot) {
  if (s.cls !== 'bazooka' || !s.alive || s.inVehicle || s.down || s.anim) { s.lockT = 0; s.lockOn = null; return null; }
  const eye = isBot ? s.eye.clone() : camera.position.clone(), look = fwd(s.yaw, s.pitch);
  let best = null, ba = 0.11;
  for (const v of G.vehicles || []) { if (v.kind !== 'plane' || !v.alive || v.pos.y < 2.5) continue; const drv = v.seats[0]; if ((drv ? drv.team : v.team) === s.team) continue;
    const to = v.pos.sub(eye), L = to.length(); if (L > 95) continue; const a = to.normalize().angleTo(look); if (a < ba && lineOfSight(eye, v.pos)) { ba = a; best = v; } }
  if (best && best === s.lockOn) s.lockT += dt; else { s.lockOn = best; s.lockT = 0; }
  if (best && s.lockT >= 3 && s.ammo > 0 && s.reload <= 0) { s.lockT = 0; fireHoming(s, best); }
  return best;
}
function fireHoming(s, target) {
  const mz = s.isPlayer && P.set.view === 'fp' ? fpMuzzle() : s.muzzleWorld(new THREE.Vector3()), d = target.pos.sub(mz).normalize();
  s.ammo--; s.cool = s.w.rate; AU.whoosh(mz); muzzle(mz, d, s); if (s.isPlayer) { callout('Locked!'); AU.medal(1); }
  G.proj.push({ kind: 'rocket', p: mz.clone(), v: d.multiplyScalar(28), owner: s, t: 0, mesh: rocketMesh(s), homing: target });
  if (s.ammo <= 0) startReload(s);
}
function fpMuzzle() { const f = fwd(G.player.yaw, G.player.pitch), r = new THREE.Vector3(-Math.cos(G.player.yaw), 0, Math.sin(G.player.yaw)); return camera.position.clone().addScaledVector(f, 0.6).addScaledVector(r, 0.08).add(new THREE.Vector3(0, -0.15, 0)); }
// back-to-back knockdowns earn a callout
const MULTI = ['', '', 'Double Tip!', 'Triple Tip!', 'Floor Sweep!', 'Toy Box Tyrant!', 'Bag Emptier!'];
function multiKill() {
  const now = G.elapsed; G.mk = now - (G.mkT ?? -9) < 4 ? (G.mk || 1) + 1 : 1; G.mkT = now;
  const st = G.player.streak + 1;
  if (G.mk >= 2) { callout(MULTI[Math.min(G.mk, MULTI.length - 1)]); AU.medal(G.mk); }
  else if (st === 5) { callout('On a Roll!'); AU.medal(2); } else if (st === 10) { callout('Rug Burner!'); AU.medal(3); }
}
function callout(t) { const c = $('callout'); c.textContent = t; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
function playerRates() {
  const st = P.stats, ps = G.ps, me = G.player; const shots = st.shots + ps.shots, hits = st.hits + (me ? me.hits : 0), heads = (st.headshots || 0) + (ps.headshots || 0);
  return { hit: clamp((hits + 3) / (shots + 10), 0.08, 0.9), head: clamp((heads + 0.5) / (hits + 5), 0.02, 0.6) };
}
// bots decide before each shot whether it lands, then aim exactly at the target or deliberately wide
function botShotDir(s, t, mz) {
  const R = playerRates(), hit = Math.random() < R.hit * G.botK, head = hit && Math.random() < R.head * 0.5;
  const aimP = head ? new THREE.Vector3(t.pos.x, t.pos.y + 0.92, t.pos.z) : t.chest(new THREE.Vector3());
  if (t.m.rag) aimP.copy(t.m.rag.parts[0].o.getWorldPosition(new THREE.Vector3()));
  const d = aimP.clone().sub(mz), L = d.length(); d.normalize();
  if (!hit) { const side = new THREE.Vector3(-d.z, 0, d.x).normalize(), up = new THREE.Vector3(0, 1, 0); const miss = rnd(0.55, 1.1) * (Math.random() < 0.5 ? -1 : 1); d.multiplyScalar(L).addScaledVector(side, miss).addScaledVector(up, rnd(-0.3, 0.6)).normalize(); }
  return d;
}
function fire(s, dir) {
  const w = s.w; if (s.reload > 0 || s.cool > 0 || s.ammo <= 0) { if (s.ammo <= 0 && s.reload <= 0) startReload(s); return; }
  s.cool = w.rate; s.lastFired = 0;
  const fpv = s.isPlayer && P.set.view === 'fp';
  const mz = fpv ? fpMuzzle() : s.muzzleWorld(new THREE.Vector3());
  if (s.isPlayer) vm.kick = Math.min(1, vm.kick + (w.kind === 'flame' ? 0.05 : s.cls === 'rifle' ? 0.35 : 1));
  if (w.kind === 'flame') {
    s.ammo -= w.use * w.rate; if (Math.random() < 0.6) AU.flame(mz);
    for (let i = 0; i < 3; i++) { const v = dir.clone().multiplyScalar(rnd(9, 13)).add(new THREE.Vector3(rnd(-1, 1), rnd(-0.5, 1), rnd(-1, 1))); part('fire', mz.clone().addScaledVector(dir, 0.2), { size: rnd(0.12, 0.25), life: rnd(0.45, 0.7), grow: 4.5, v, drag: 1.4, g: -2, color: [0xffd04a, 0xff8a2a, 0xff5a1a][i] }); }
    if (Math.random() < 0.3) part('smoke', mz.clone().addScaledVector(dir, 5), { size: 0.6, life: 1.2, grow: 1, op: 0.35, color: 0x555048, v: new THREE.Vector3(0, 1.4, 0) });
    flashLight(mz.clone().addScaledVector(dir, 2), 30, 9, 0.08);
    const mzx = mz.clone();
    for (const t of G.men) {
      if (!t.alive || t.team === s.team) continue; const c = t.chest(tmpV); const L = c.distanceTo(mzx); if (L > w.range) continue;
      const a = c.clone().sub(mzx).normalize().angleTo(dir); if (a > 0.3) continue; if (!lineOfSight(mzx, c)) continue;
      hurt(t, w.dmg * w.rate, s, 'flame', dir);
    }
    if (s.ammo <= 0) startReload(s);
    return;
  }
  s.ammo--; s.shots++; if (s.isPlayer) G.ps.shots++;
  if (!s.isPlayer && s.target && w.kind === 'hit') dir = botShotDir(s, s.target, mz);
  const spread = !s.isPlayer && w.kind === 'hit' ? 0 : (s.isPlayer && w.scoped && G.scoped ? w.scoped : w.spread * (s.isPlayer ? 1 + (G.bloom || 0) : 1.8 * G.botSpread)) * (s.isPlayer && G.crouch ? 0.5 : 1) * (s.isPlayer && G.prone ? 0.3 : 1) * (s.isPlayer && G.ads ? 0.45 : 1);
  if (s.isPlayer) { const c = (G.prone ? 0.3 : G.crouch ? 0.55 : 1) * (G.ads ? 0.6 : 1); G.recoil += w.recoil * c; G.recoilYaw += rnd(-w.wob, w.wob) * c; G.bloom = Math.min(2.5, (G.bloom || 0) + w.recoil * 18); }
  const d = dir.clone().add(new THREE.Vector3(rnd(-spread, spread), rnd(-spread, spread), rnd(-spread, spread))).normalize();
  if (w.kind === 'rocket') {
    AU.whoosh(mz); muzzle(mz, d, s); for (let i = 0; i < 4; i++) part('smoke', mz.clone().addScaledVector(d, -0.9), { size: 0.4, life: 1, grow: 1.4, op: 0.5, color: 0xbab4aa, v: d.clone().multiplyScalar(-rnd(1, 3)).add(new THREE.Vector3(rnd(-0.5, 0.5), 0.5, rnd(-0.5, 0.5))) }); G.proj.push({ kind: 'rocket', p: mz.clone(), v: d.multiplyScalar(w.speed), owner: s, t: 0, mesh: rocketMesh(s) });
  } else {
    AU.shot(mz, s.cls);
    const wt0 = world.ray(mz, d, w.range), vh = rayVehicles(mz, d, wt0, s), wt = Math.min(wt0, vh.t), mh = rayMen(mz, d, wt, s);
    const end = mz.clone().addScaledVector(d, mh.who ? mh.t : wt);
    if (G.critter && G.critter.kind === 'cat' && G.critter.p.distanceTo(end) < 6 && end.y < 9) G.critter.hits++;
    const ch = !mh.who ? rayCheerio(mz, d, wt) : null; if (ch) { burstCheerio(ch.i, d.clone().multiplyScalar(3)); }
    const hitBox = world.lastBox;
    if (!mh.who && vh.v && vh.t <= wt0) { hurtVehicle(vh.v, w.dmg * (vh.v.kind === 'tank' ? 0.2 : 0.55), s); for (let i = 0; i < 5; i++) part('spark', end.clone(), { size: 0.05, life: rnd(0.15, 0.3), grow: 0, color: 0xffe0a0, v: d.clone().multiplyScalar(-rnd(2, 4)).add(new THREE.Vector3(rnd(-3, 3), rnd(0, 4), rnd(-3, 3))) }); }
    muzzle(mz, d, s); if (Math.random() < 0.75 || s.cls === 'sniper') tracer(mz.clone().addScaledVector(d, 0.4), end, s.cls === 'sniper' ? 0xfff6e0 : 0xffc870, s.cls === 'sniper' ? 1.6 : 1);
    const right = new THREE.Vector3(-Math.cos(s.yaw), 0, Math.sin(s.yaw));
    if (fpv && vm.mesh) casing(vm.mesh.localToWorld(vm.muzzle.clone().multiplyScalar(0.35)), new THREE.Vector3(1, 0.4, 0.3), vmScene); else casing(mz.clone().addScaledVector(d, -0.4), right);
    if (mh.who) { if (mh.who.team !== s.team) { if (mh.head) { if (s.isPlayer) { G.ps.headshots = (G.ps.headshots || 0) + 1; callout('Headshot!'); } hurt(mh.who, 999, s, 'head', d); } else hurt(mh.who, w.dmg, s, 'shot', d); for (let i = 0; i < 3; i++) part('chip', end, { mat: mh.who.m.mat, life: 1.2, v: d.clone().multiplyScalar(-2).add(new THREE.Vector3(rnd(-2, 2), rnd(1, 3), rnd(-2, 2))) }); } }
    else if (!ch && wt < w.range && !(vh.v && vh.t <= wt0)) {
      const n = world.rayNormal(end);
      decal(end, n, 0.3, holeTex, 1); if (hitBox && hitBox.kind === 'can' && n.y < 0.5 && end.y < hitBox.top - 0.3) leak(hitBox, end, n);
      part('smoke', end.clone().addScaledVector(n, 0.05), { size: 0.18, life: 0.7, grow: 2.2, op: 0.55, color: 0xd8d0c0, v: n.clone().multiplyScalar(1.2).add(new THREE.Vector3(0, 0.6, 0)) });
      for (let i = 0; i < 4; i++) part('spark', end.clone(), { size: 0.05, life: rnd(0.15, 0.35), grow: 0, color: 0xffd890, v: n.clone().multiplyScalar(rnd(3, 6)).add(new THREE.Vector3(rnd(-3, 3), rnd(0, 4), rnd(-3, 3))) });
    }
  }
  if (s.ammo <= 0) startReload(s);
}
function melee(s) {
  if (!s.alive || (s.meleeCool || 0) > 0) return; s.meleeCool = 0.8; if (s.isPlayer) { vm.melee = 0.35; AU.melee(); }
  const f = fwd(s.yaw, 0);
  for (const t of G.men) { if (!t.alive || t.team === s.team) continue; const d = t.pos.clone().sub(s.pos); d.y = 0; const L = d.length(); if (L > 1.7 || d.normalize().angleTo(f) > 0.7) continue;
    hurt(t, 70, s, 'melee', f.clone()); for (let i = 0; i < 5; i++) part('chip', t.chest(), { mat: t.m.mat, life: 1.5, v: f.clone().multiplyScalar(3).add(new THREE.Vector3(rnd(-2, 2), rnd(1, 3), rnd(-2, 2))) }); if (s.isPlayer) G.shake = Math.max(G.shake, 0.25); break; }
}
function startReload(s) { if (s.reload > 0 || s.ammo >= s.w.mag) return; s.reload = s.w.reload; if (s.isPlayer) AU.tone(300, 500, 0.08, 0.1, 'triangle'); }
function rocketMesh(s) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8), new THREE.MeshStandardMaterial({ color: TEAMS[G.teamIds[s.team]].color, roughness: 0.4 })); m.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(m); scene.add(g); return g; }
function throwNade(s, dir) {
  if (s.nades <= 0 || !s.alive) return; s.nades--;
  const { p, v } = nadeLaunch(s, dir); if (s.isPlayer) vm.melee = 0.3;
  const mesh = nadeMesh(); scene.add(mesh);
  G.proj.push({ kind: 'nade', p, v, owner: s, t: 0, mesh, body: ballBody(p, v), lastVy: v.y });
}
// the throwing arc shown while the grenade button is held
const arcGeo = new THREE.BufferGeometry(); arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
const arcLine = new THREE.Line(arcGeo, new THREE.LineDashedMaterial({ color: 0xffe27a, dashSize: 0.25, gapSize: 0.15, transparent: true, opacity: 0.9, depthTest: false }));
arcLine.renderOrder = 998; arcLine.frustumCulled = false; scene.add(arcLine); arcLine.visible = false;
const arcRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.8, depthTest: false })); arcRing.renderOrder = 998; scene.add(arcRing); arcRing.visible = false;
function nadeLaunch(s, dir) { const p = s.chest(new THREE.Vector3()).addScaledVector(dir, 0.4); p.y += 0.3; const el = Math.max(0.35, s.pitch + 0.45); const v = dir.clone().setY(0).normalize().multiplyScalar(11 * Math.cos(el)); v.y = 11 * Math.sin(el); return { p, v }; }
function drawNadeArc() {
  const p = G.player, on = G.nadeAim && p.alive && !p.down && !p.inVehicle; arcLine.visible = arcRing.visible = on; if (!on) return;
  const { p: p0, v } = nadeLaunch(p, fwd(p.yaw, p.pitch)); const a = arcGeo.attributes.position.array; let q = p0.clone(), n = 0, hit = null;
  for (let i = 0; i < 60; i++) { a[i * 3] = q.x; a[i * 3 + 1] = q.y; a[i * 3 + 2] = q.z; n = i + 1; if (hit) continue;
    const step = v.clone().multiplyScalar(0.05); v.y -= 22 * 0.05; const L = step.length(), d = step.clone().divideScalar(L), t = world.ray(q, d, L);
    if (t < L) { q.addScaledVector(d, t); hit = q.clone(); } else q.add(step); }
  for (let i = n; i < 60; i++) { a[i * 3] = q.x; a[i * 3 + 1] = q.y; a[i * 3 + 2] = q.z; }
  arcGeo.attributes.position.needsUpdate = true; arcGeo.computeBoundingSphere(); arcLine.computeLineDistances();
  if (hit) { arcRing.position.copy(hit).add(new THREE.Vector3(0, 0.03, 0)); arcRing.visible = true; } else arcRing.visible = false;
}
function nadeMesh() {
  const g = new THREE.Group(), m = new THREE.MeshPhysicalMaterial({ color: 0x3a4a24, roughness: 0.55, clearcoat: 0.3 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), m); b.scale.set(1, 1.2, 1); g.add(b);
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 5, 14), m); r.rotation.x = Math.PI / 2; r.position.y = -0.05 + i * 0.05; g.add(r); }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 1, roughness: 0.3 })); cap.position.y = 0.13; g.add(cap);
  g.traverse((o) => { o.castShadow = true; }); return g;
}
function updateProj(dt) {
  for (let i = G.proj.length - 1; i >= 0; i--) {
    const q = G.proj[i]; q.t += dt; let boom = false;
    if (q.kind === 'rocket' || q.kind === 'shell') {
      if (q.homing && q.t > 6) { q.t = 99; }
      if (q.homing && q.homing.alive) { const want = q.homing.pos.sub(q.p); if (want.length() < 2.2) { q.p.copy(q.homing.pos); explosion(q.p.clone(), q.owner, 'rocket'); hurtVehicle(q.homing, 999, q.owner); scene.remove(q.mesh); G.proj.splice(i, 1); continue; } const sp = q.v.length(); q.v.lerp(want.normalize().multiplyScalar(sp), Math.min(1, dt * 2.6)).setLength(sp); }
      const step = q.v.length() * dt, d = q.v.clone().normalize();
      const wt = Math.min(world.ray(q.p, d, step), rayVehicles(q.p, d, step, q.owner).t), mh = rayMen(q.p, d, step, q.owner);
      if (mh.who || wt < step || q.t > 3) { q.p.addScaledVector(d, Math.min(wt, mh.t) - 0.05); boom = true; } else q.p.addScaledVector(d, step);
      if (q.kind === 'shell') q.v.y -= 3 * dt;
      q.mesh.position.copy(q.p); q.mesh.lookAt(q.p.clone().add(q.v)); part('smoke', q.p.clone(), { size: 0.18, life: 0.9, grow: 2, op: 0.5, color: 0xcfcac0 }); part('fire', q.p.clone(), { size: 0.22, life: 0.06, grow: 0, color: 0xffb050 });
    } else {
      const t = q.body.translation(), r = q.body.rotation(), lv = q.body.linvel();
      q.p.set(t.x, t.y, t.z); q.mesh.position.copy(q.p); q.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      if (q.lastVy < -1.2 && lv.y > -0.2) AU.tick(q.p); q.lastVy = lv.y;
      if (Math.random() < 0.4) part('smoke', q.p.clone(), { size: 0.06, life: 0.4, grow: 2, op: 0.3, color: 0xbbbbbb });
      boom = q.t > (q.kind === 'bomb' ? 8 : NADE.fuse) || (q.impact && q.t > 0.25 && (q.hitV || (q.lastSpd - Math.hypot(lv.x, lv.y, lv.z) > 3))); q.lastSpd = Math.hypot(lv.x, lv.y, lv.z); if (boom) removeBody(q.body);
    }
    if (boom) { explosion(q.p.clone().setY(Math.max(q.p.y, 0.2)), q.owner, q.kind); scene.remove(q.mesh); G.proj.splice(i, 1); }
  }
}

// ------------------------------------------------------------ vehicles: seats, getting in and out, driving, damage
function vehBlocked(x, y, z) { if (!G || !G.vehicles) return false; const p = new THREE.Vector3(x, y + 0.5, z); for (const v of G.vehicles) if (v.contains(p, 0.25)) return true; return false; }
function rayVehicles(o, d, maxT, skip) { let t = maxT, best = null; for (const v of G.vehicles || []) { if (skip && skip.inVehicle && skip.inVehicle.v === v) continue; const k = v.ray(o, d, t); if (k < t) { t = k; best = v; } } return { t, v: best }; }
function hurtVehicle(v, dmg, by) {
  if (!v.alive) return; v.hp -= dmg; v.lastHitBy = by;
  if (v.seats.some((x) => x && x.isPlayer) && by && by !== G.player) flashHurtVehicle();
  if (v.hp <= 0) destroyVehicle(v, by);
}
function flashHurtVehicle() { passes.grade.uniforms.uHurt.value = Math.max(passes.grade.uniforms.uHurt.value, 0.25); }
function destroyVehicle(v, by) {
  if (!v.alive) return; const p = v.pos; v.destroy(); explosion(p.clone(), by || G.men[0], 'shell');
  for (let i = 0; i < 8; i++) part('chip', p.clone().add(new THREE.Vector3(0, 0.5, 0)), { mat: v.mat, life: 3, v: new THREE.Vector3(rnd(-6, 6), rnd(4, 9), rnd(-6, 6)) });
  for (let i = 0; i < v.seats.length; i++) { const s = v.seats[i]; if (!s) continue; ejectFrom(s, v, true); if (s.alive) { s.hp = 0; knockOver(s, by && by !== s ? by : null, 'rocket', new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1)).normalize()); } }
  feed(`<b>${v.kind[0].toUpperCase() + v.kind.slice(1)}</b> destroyed`);
}
const SIT = (m) => { m.legs[0].rotation.x = m.legs[1].rotation.x = -1.45; m.knees[0].rotation.x = m.knees[1].rotation.x = 1.5; m.body.position.y = 0; };
function nearVehicle(s) {
  let best = null, bd = 2.3;
  for (const v of G.vehicles) { if (!v.alive) continue;
    if (v.upright < 0.4) { const d = v.pos.setY(0).distanceTo(s.pos.clone().setY(0)); if (d < 3.4 && d < bd + 1) { best = { v, flip: true }; bd = d; } continue; }
    for (let i = 0; i < v.seats.length; i++) { if (v.seats[i]) continue; const d = v.doorWorld(i).distanceTo(s.pos.clone().setY(0)); if (d < bd) { bd = d; best = { v, seat: i }; } } }
  return best;
}
function useVehicle(s) {
  if (!s.alive || s.down || s.anim) return;
  if (s.inVehicle) { startExit(s); return; }
  const n = nearVehicle(s); if (!n) return;
  if (n.flip) { n.v.flipUpright(); AU.melee(); return; }
  const { v, seat } = n; v.seats[seat] = s; s.anim = { kind: 'in', v, seat, t: 0, from: s.pos.clone(), fromYaw: s.yaw, dur: v.kind === 'tank' ? 2.6 : v.kind === 'plane' ? 2.0 : v.spec.seats[seat].stand ? 1.2 : 1.4 };
  if (s.isPlayer) { IN.fire = false; G.scoped = false; G.crouch = false; }
}
function startExit(s) {
  const { v, seat } = s.inVehicle;
  // bailing out of something moving fast or high up: tumble out
  if ((v.kind === 'plane' && v.pos.y > 2) || v.speed > 9) { const lv = v.body.linvel(); ejectFrom(s, v); s.pos.y = Math.max(s.pos.y, v.pos.y); knockDown(s, new THREE.Vector3(lv.x * 0.7, Math.max(2, lv.y), lv.z * 0.7)); return; }
  const door = v.doorWorld(seat);
  // find clear ground beside the vehicle
  let tries = 0; while ((world.blocked(door.x, door.z, 0) || vehBlocked(door.x, 0, door.z)) && tries++ < 16) { door.x += rnd(-1.5, 1.5); door.z += rnd(-1.5, 1.5); }
  s.anim = { kind: 'out', v, seat, t: 0, to: door, dur: v.kind === 'tank' ? 2.2 : v.kind === 'plane' ? 1.7 : 1.2 };
  detachFromSeat(s);
}
function attachToSeat(s, v, seat) { const st = v.spec.seats[seat]; v.root.add(s.m.root); s.m.root.position.set(st.x, st.y - 0.35, st.z); s.m.root.rotation.set(0, 0, 0); if (st.stand) pose(s.m, 0, false); else SIT(s.m); s.inVehicle = { v, seat }; s.hidden = !!st.hidden; s.m.root.visible = !st.hidden; }
function detachFromSeat(s) { if (s.m.root.parent !== scene) scene.attach(s.m.root); s.hidden = false; s.m.root.visible = true; }
function ejectFrom(s, v, instant) { if (!s.inVehicle && !(s.anim && s.anim.v === v)) return; stow(s.m, false); if (v.canopy) v.canopy.position.z = 0.25; if (v.doors) for (const d of v.doors) d.rotation.y = 0; const p = s.m.root.getWorldPosition(new THREE.Vector3()); detachFromSeat(s); v.seats[v.seats.indexOf(s)] = null; s.inVehicle = null; s.anim = null; s.pos.set(p.x, Math.max(0, world.groundAt(p.x, p.z, p.y + 0.5)), p.z); if (v.lid) v.lid.rotation.x = 0; }
// the getting-in and getting-out moves, acted out
function updateAnim(s, dt) {
  const A = s.anim; A.t += dt; const k = Math.min(1, A.t / A.dur), v = A.v, m = s.m, ease = (x) => x * x * (3 - 2 * x);
  const loc = (x, y, z) => v.local(new THREE.Vector3(x, y, z));
  const seat = v.spec.seats[A.seat], seatW = loc(seat.x, seat.y - 0.35, seat.z);
  const place = (p, yaw) => { m.root.position.copy(p); m.root.quaternion.copy(v.quat).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)); };
  if (v.kind === 'jeep') {
    const door = seat.door != null ? v.doors[seat.door] : null, dsign = seat.x > 0 ? 1 : -1, swing = (f) => { if (door) door.rotation.y = -dsign * 1.25 * f; };
    const faceIn = v.yaw + (seat.stand ? 0 : -dsign * Math.PI / 2);
    stow(m, A.seat !== 2 ? !(A.kind === 'out' && k > 0.9) : !(A.kind === 'in' && k > 0.85) && !(A.kind === 'out' && k > 0.9), 0.5);
    if (seat.stand) { // climb up over the tailgate, then turn to the gun
      const gate = loc(0, 0.12, -1.3);
      if (A.kind === 'in') { if (k < 0.45) { const kk = ease(k / 0.45), p = A.from.clone().lerp(gate, kk); p.y += Math.sin(kk * Math.PI) * 0.7; m.root.position.copy(p); m.root.rotation.set(0, v.yaw, 0); pose(m, 0, false, true); } else { const kk = ease((k - 0.45) / 0.55); m.root.position.copy(gate.clone().lerp(seatW, kk)); m.root.rotation.set(0, v.yaw, 0); pose(m, kk * 6, kk < 0.9); } }
      else { if (k < 0.45) { const kk = ease(k / 0.45); m.root.position.copy(seatW.clone().lerp(gate, kk)); m.root.rotation.set(0, v.yaw + Math.PI, 0); pose(m, kk * 6, true); } else { const kk = ease((k - 0.45) / 0.55), p = gate.clone().lerp(A.to, kk); p.y += Math.sin(kk * Math.PI) * 0.6; m.root.position.copy(p); pose(m, 0, false, kk < 0.85); } }
    } else if (A.kind === 'in') {
      const step = loc(seat.x + dsign * 0.55, -0.2, seat.z);
      if (k < 0.3) { const kk = ease(k / 0.3); swing(kk); m.root.position.copy(A.from.clone().lerp(step, kk)); m.root.rotation.set(0, faceIn, 0); pose(m, kk * 5, true); }
      else if (k < 0.75) { const kk = ease((k - 0.3) / 0.45), p = step.clone().lerp(seatW, kk); p.y += Math.sin(kk * Math.PI) * 0.35; m.root.position.copy(p); m.root.rotation.set(0, faceIn + (v.yaw - faceIn) * kk, 0); if (kk > 0.4) SIT(m); else pose(m, 0, false, true); }
      else { swing(1 - ease((k - 0.75) / 0.25)); m.root.position.copy(seatW); m.root.rotation.set(0, v.yaw, 0); SIT(m); }
    } else {
      const step = loc(seat.x + dsign * 0.55, -0.2, seat.z);
      if (k < 0.25) { swing(ease(k / 0.25)); m.root.position.copy(seatW); m.root.rotation.set(0, v.yaw, 0); SIT(m); }
      else if (k < 0.7) { const kk = ease((k - 0.25) / 0.45), p = seatW.clone().lerp(step, kk); p.y += Math.sin(kk * Math.PI) * 0.35; m.root.position.copy(p); m.root.rotation.set(0, v.yaw + (faceIn + Math.PI - v.yaw) * kk, 0); pose(m, 0, false, true); }
      else { const kk = ease((k - 0.7) / 0.3); swing(1 - kk); m.root.position.copy(step.clone().lerp(A.to, kk)); pose(m, kk * 5, true); }
    }
  } else if (v.kind === 'tank') {
    // sling the rifle, crouch-climb the rear deck, lift the hatch, slide in, reach up and pull it shut
    const deck = loc(0, 0.62, -1.35), hatch = loc(0, 0.74, -0.5), below = loc(0, -0.35, -0.5), side = loc(1.55, 0.6, -0.9);
    const ph = (a, b) => clamp((k - a) / (b - a), 0, 1);
    if (A.kind === 'in') {
      stow(m, true, 0);
      if (k < 0.12) { pose(m, 0, false); m.root.position.copy(A.from); m.root.rotation.set(0, v.yaw, 0); stow(m, true, ph(0, 0.12) * 0.4); }
      else if (k < 0.42) { const kk = ease(ph(0.12, 0.42)), p = A.from.clone().lerp(deck, kk); p.y += Math.sin(kk * Math.PI) * 0.45; m.root.position.copy(p); m.root.rotation.set(0, v.yaw, 0); crouchPose(m, 0.5 + 0.5 * Math.sin(kk * Math.PI)); stow(m, true, 1.1 - kk * 0.6); }
      else if (k < 0.56) { const kk = ease(ph(0.42, 0.56)); m.root.position.copy(deck.clone().lerp(hatch, kk)); m.root.rotation.set(0, v.yaw, 0); crouchPose(m, 0.85); m.body.position.y += Math.abs(Math.sin(kk * Math.PI * 2)) * 0.03; stow(m, true, 0.3); }
      else if (k < 0.68) { const kk = ease(ph(0.56, 0.68)); m.root.position.copy(hatch); crouchPose(m, 0.85); stow(m, true, 0.3 + kk * 0.9); v.lid.rotation.x = -2.1 * kk; }
      else if (k < 0.86) { const kk = ease(ph(0.68, 0.86)); m.root.position.copy(hatch.clone().lerp(below, kk)); pose(m, 0, false); m.legs[0].rotation.x = m.legs[1].rotation.x = 0; stow(m, true, 1.2 + kk * 0.6); m.root.visible = kk < 0.92; }
      else { const kk = ease(ph(0.86, 1)); m.root.visible = true; m.root.position.copy(below.clone().add(new THREE.Vector3(0, 0.18, 0))); stow(m, true, 2.6); v.lid.rotation.x = -2.1 * (1 - kk); if (kk > 0.9) m.root.visible = false; }
    } else {
      if (k < 0.15) { const kk = ease(ph(0, 0.15)); m.root.visible = true; m.root.position.copy(below.clone().add(new THREE.Vector3(0, 0.18, 0))); m.root.rotation.set(0, v.yaw, 0); stow(m, true, 2.6); v.lid.rotation.x = -2.1 * kk; }
      else if (k < 0.38) { const kk = ease(ph(0.15, 0.38)); m.root.position.copy(below.clone().lerp(hatch, kk)); pose(m, 0, false); stow(m, true, 1.8 - kk); }
      else if (k < 0.55) { const kk = ease(ph(0.38, 0.55)); m.root.position.copy(hatch.clone().lerp(side, kk)); m.root.rotation.set(0, v.yaw + Math.PI / 2 * kk, 0); crouchPose(m, 0.8); stow(m, true, 0.4); v.lid.rotation.x = -2.1 * (1 - kk); }
      else if (k < 0.8) { const kk = ease(ph(0.55, 0.8)), p = side.clone().lerp(A.to, kk); p.y += Math.sin(kk * Math.PI) * 0.5; m.root.position.copy(p); pose(m, 0, false, kk < 0.85); stow(m, true, 0.6); v.lid.rotation.x = 0; }
      else { crouchPose(m, 0.5 * (1 - ph(0.8, 1))); m.root.position.copy(A.to); stow(m, ph(0.8, 1) < 0.6, 0.2); }
    }
  } else { // plane: up onto the wing, slide the canopy back, lower in, slide it shut
    const wing = loc(0.95, 0.0, 0.35), rim = loc(0.32, 0.1, 0.15), ph = (a, b) => clamp((k - a) / (b - a), 0, 1);
    const can = (f) => { v.canopy.position.z = 0.25 - 0.55 * f; };
    if (A.kind === 'in') {
      stow(m, true, 0.3);
      if (k < 0.35) { const kk = ease(ph(0, 0.35)), p = A.from.clone().lerp(wing, kk); p.y += Math.sin(kk * Math.PI) * 0.4; m.root.position.copy(p); m.root.rotation.set(0, v.yaw - Math.PI / 2, 0); crouchPose(m, 0.4 * Math.sin(kk * Math.PI)); }
      else if (k < 0.5) { const kk = ease(ph(0.35, 0.5)); can(kk); m.root.position.copy(wing); crouchPose(m, 0.6); stow(m, true, 0.8 * kk); }
      else if (k < 0.85) { const kk = ease(ph(0.5, 0.85)), p = wing.clone().lerp(rim, Math.min(1, kk * 1.6)).lerp(seatW, Math.max(0, kk * 1.6 - 0.6) / 1); m.root.position.copy(kk < 0.6 ? wing.clone().lerp(rim, kk / 0.6) : rim.clone().lerp(seatW, (kk - 0.6) / 0.4)); m.root.rotation.set(0, v.yaw - Math.PI / 2 * (1 - kk), 0); if (kk > 0.6) SIT(m); else crouchPose(m, 0.6); stow(m, true, 0.8 + kk); }
      else { const kk = ease(ph(0.85, 1)); can(1 - kk); m.root.position.copy(seatW); m.root.rotation.set(0, v.yaw, 0); SIT(m); stow(m, true, 1.6 - kk * 0.8); }
    } else {
      if (k < 0.2) { const kk = ease(ph(0, 0.2)); can(kk); m.root.position.copy(seatW); m.root.rotation.set(0, v.yaw, 0); SIT(m); stow(m, true, 1.4); }
      else if (k < 0.55) { const kk = ease(ph(0.2, 0.55)); m.root.position.copy(kk < 0.4 ? seatW.clone().lerp(rim, kk / 0.4) : rim.clone().lerp(wing, (kk - 0.4) / 0.6)); m.root.rotation.set(0, v.yaw + Math.PI / 2 * kk, 0); crouchPose(m, 0.6); stow(m, true, 1.2 - kk); }
      else if (k < 0.85) { const kk = ease(ph(0.55, 0.85)), p = wing.clone().lerp(A.to, kk); p.y += Math.sin(kk * Math.PI) * 0.45; m.root.position.copy(p); pose(m, 0, false, kk < 0.85); can(1 - kk); }
      else { m.root.position.copy(A.to); can(0); stow(m, ph(0.85, 1) < 0.6, 0.2); }
    }
  }
  if (k >= 1) {
    if (A.kind === 'in') { attachToSeat(s, v, A.seat); const handsFree = !(v.kind === 'jeep' && A.seat >= 1); stow(m, handsFree, v.kind === 'plane' ? 0.8 : 0.4); }
    else { stow(m, false); v.seats[A.seat] = null; s.inVehicle = null; s.pos.copy(A.to); s.pos.y = world.groundAt(A.to.x, A.to.z, 1); s.yaw = v.yaw + (v.kind === 'tank' ? Math.PI / 2 : 0); if (v.lid) v.lid.rotation.x = 0; if (v.doors) for (const d of v.doors) d.rotation.y = 0; pose(m, 0, false); }
    s.anim = null;
  }
}
// what the driver's thumbs and aim do to the vehicle
function vehicleInput(s, dt) {
  const { v, seat } = s.inVehicle; if (seat !== 0 || !v.alive) return null;
  let jx = IN.jx, jy = IN.jy; if (IN.keys.KeyW) jy = 1; if (IN.keys.KeyS) jy = -1; if (IN.keys.KeyA) jx = -1; if (IN.keys.KeyD) jx = 1;
  return { x: jx, y: jy, aimYaw: s.yaw, aimPitch: s.pitch };
}
function vehicleFire(s) {
  const { v, seat } = s.inVehicle; if (!v.alive) return;
  if (v.kind === 'jeep' && seat === 1) { s.m.root.updateMatrixWorld(true); fire(s, s.isPlayer ? aimDir() : s.botAim); return; } // the passenger shoots his own gun
  if (v.kind === 'jeep' && seat === 2) { minigun(s, v); return; }
  if (v.kind === 'tank' && v.cool <= 0) {
    v.cool = 2.2; const tq = v.quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-v.gunPitch, v.turretYaw, 0, 'YXZ')));
    const d = new THREE.Vector3(0, 0, 1).applyQuaternion(tq), mz = v.local(new THREE.Vector3(0, 0.6, -0.15)).addScaledVector(d, 3.2);
    AU.boom(mz); flashLight(mz, 120, 14, 0.12); for (let i = 0; i < 8; i++) part('smoke', mz.clone(), { size: rnd(0.4, 0.8), life: rnd(0.8, 1.6), grow: 1.2, op: 0.6, color: 0xb0aaa0, v: d.clone().multiplyScalar(rnd(1, 4)).add(new THREE.Vector3(rnd(-1, 1), rnd(0, 1), rnd(-1, 1))) });
    part('flash', mz, { size: 1.4, life: 0.08, grow: 2 });
    const mesh = rocketMesh(s); mesh.scale.setScalar(1.6);
    G.proj.push({ kind: 'shell', p: mz.clone(), v: d.multiplyScalar(55), owner: s, t: 0, mesh });
    v.body.applyImpulse({ x: -d.x * v.body.mass() * 0.18, y: 0, z: -d.z * v.body.mass() * 0.18 }, true); v.body.applyTorqueImpulse({ x: -Math.cos(v.yaw + v.turretYaw) * v.body.mass() * 0.15, y: 0, z: Math.sin(v.yaw + v.turretYaw) * v.body.mass() * 0.15 }, true); if (s.isPlayer) G.shake = Math.max(G.shake, 0.35);
  }
  if (v.kind === 'plane') { vehicleAlt(s); return; }
  if (v.kind === 'plane' && v.cool <= 0) {
    v.cool = 0.085; const f = new THREE.Vector3(0, 0, 1).applyQuaternion(v.quat), aim = aimDirFrom(camera.position);
    for (const sx of [-1.3, 1.3]) {
      const mz = v.local(new THREE.Vector3(sx, -0.12, 1.05)), d = aim.clone().lerp(f, 0.5).normalize().add(new THREE.Vector3(rnd(-0.012, 0.012), rnd(-0.012, 0.012), rnd(-0.012, 0.012))).normalize();
      const wt0 = world.ray(mz, d, 90), vh = rayVehicles(mz, d, wt0, s), wt = Math.min(wt0, vh.t), mh = rayMen(mz, d, wt, s);
      const end = mz.clone().addScaledVector(d, mh.who ? mh.t : wt); tracer(mz, end, 0xffd070, 1.3); part('flash', mz, { size: 0.3, life: 0.04 });
      if (mh.who && mh.who.team !== s.team) hurt(mh.who, 16, s, 'shot', d); else if (vh.v && vh.t <= wt0) hurtVehicle(vh.v, 10, s); else if (wt < 90) part('smoke', end, { size: 0.3, life: 0.6, grow: 2, op: 0.5, color: 0xd8d0c0 });
    }
    AU.shot(v.pos, 'rifle');
  }
}
// the 4x4's minigun: spins up, then pours out rounds
function minigun(s, v) {
  v.spin = Math.min(1.6, v.spin + 0.06); if (v.spin < 0.6 || v.cool > 0) return; v.cool = 0.05;
  const { p, d0 = null } = {}; const g = v.gunMuzzle(), d = g.d.clone().add(new THREE.Vector3(rnd(-0.02, 0.02), rnd(-0.02, 0.02), rnd(-0.02, 0.02))).normalize(), mz = g.p;
  const wt0 = world.ray(mz, d, 80), vh = rayVehicles(mz, d, wt0, s), wt = Math.min(wt0, vh.t), mh = rayMen(mz, d, wt, s);
  const end = mz.clone().addScaledVector(d, mh.who ? mh.t : wt);
  v.mgShots = (v.mgShots || 0) + 1; if (v.mgShots % 3 === 0) tracer(mz, end, 0xffb050, 1.4);
  part('flash', mz, { size: 0.35, life: 0.04, grow: 2 }); if (v.mgShots % 2 === 0) casing(mz.clone().addScaledVector(d, -0.6), new THREE.Vector3(-Math.cos(v.yaw + v.mgYawA), 0.3, Math.sin(v.yaw + v.mgYawA)));
  flashLight(mz, 14, 6, 0.05); if (v.mgShots % 2 === 0) AU.shot(mz, 'rifle');
  if (mh.who && mh.who.team !== s.team) hurt(mh.who, 11, s, 'shot', d);
  else if (vh.v && vh.t <= wt0) hurtVehicle(vh.v, 6, s);
  else if (wt < 80 && v.mgShots % 2 === 0) { const n = world.rayNormal(end); decal(end, n, 0.2, holeTex, 0.85); part('smoke', end, { size: 0.2, life: 0.5, grow: 2, op: 0.5, color: 0xd8d0c0 }); }
}
function vehicleAlt(s) { // grenade button: plane drops a bomb
  const { v } = s.inVehicle; if (v.kind !== 'plane' || v.cool2 > 0 || !v.alive) return; v.cool2 = 5; AU.whoosh(v.pos);
  const p = v.local(new THREE.Vector3(0, -0.7, 0)), lv = v.body.linvel(); const mesh = nadeMesh(); mesh.scale.setScalar(1.8); scene.add(mesh);
  G.proj.push({ kind: 'bomb', p, v: new THREE.Vector3(lv.x, lv.y, lv.z), owner: s, t: 0, mesh, body: ballBody(p, new THREE.Vector3(lv.x, lv.y - 1, lv.z), 0.2), lastVy: lv.y, impact: true });
}
function aimDirFrom(co) { const cd = fwd(G.player.yaw, G.player.pitch); const wt = world.ray(co, cd, 150); return co.clone().addScaledVector(cd, wt).sub(co).normalize(); }
function botRideAlong(dt) {
  G.rideT = (G.rideT || 0) - dt; if (G.rideT > 0) return; G.rideT = 0.5;
  const p = G.player; if (!p.inVehicle || p.inVehicle.seat !== 0) return; const v = p.inVehicle.v; if (v.kind !== 'jeep' || !v.alive || v.speed > 3) return;
  for (let seat = 1; seat < v.seats.length; seat++) {
    if (v.seats[seat]) continue;
    let best = null, bd = 16; for (const b of G.men) { if (b.isPlayer || b.team !== p.team || !b.alive || b.down || b.anim || b.inVehicle || b.goSeat) continue; const d = b.pos.distanceTo(v.pos); if (d < bd) { bd = d; best = b; } }
    if (best) { best.goSeat = { v, seat }; best.path = world.path(best.pos.x, best.pos.z, v.doorWorld(seat).x, v.doorWorld(seat).z); best.pi = 0; }
  }
}
// what a bot does when it is heading for a seat, or already riding
function botVehicle(s, dt) {
  if (s.inVehicle) {
    const { v, seat } = s.inVehicle; const drv = v.seats[0];
    if (!drv || !drv.isPlayer || !v.alive) { if (!s.anim && v.speed < 4) startExit(s); return true; }
    s.think -= dt; if (s.think <= 0) { s.think = 0.3; let best = null, bd = 45; const eye = seat === 2 ? v.gunMuzzle().p : s.m.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.9, 0)); for (const t of G.men) { if (!t.alive || t.team === s.team || t.hidden) continue; const d = t.pos.distanceTo(eye); if (d < bd && lineOfSight(eye, t.chest())) { bd = d; best = t; } } s.target = best; if (best && !s.aimErr) s.aimErr = new THREE.Vector3(rnd(-1, 1), rnd(-0.5, 0.5), rnd(-1, 1)).normalize().multiplyScalar(G.botWobble); }
    if (s.target && s.target.alive) { const eye = seat === 2 ? v.gunMuzzle().p : s.m.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.9, 0)); const to = s.target.chest(new THREE.Vector3()).sub(eye); s.yaw = Math.atan2(to.x, to.z); s.pitch = Math.atan2(to.y, Math.hypot(to.x, to.z)); if (s.aimErr) s.aimErr.multiplyScalar(Math.max(0, 1 - dt * 0.8)); s.botAim = to.normalize().add(s.aimErr || new THREE.Vector3()).normalize(); s.pause = (s.pause || 0) - dt; if (s.pause <= 0) { vehicleFire(s); if (Math.random() < dt * 0.6) s.pause = rnd(0.4, 1); } }
    else s.aimErr = null;
    return true;
  }
  if (s.goSeat) {
    const { v, seat } = s.goSeat; if (!v.alive || v.seats[seat] || v.speed > 3 || !G.player.inVehicle) { s.goSeat = null; return false; }
    const door = v.doorWorld(seat); if (door.distanceTo(s.pos.clone().setY(0)) < 1.6) { s.goSeat = null; v.seats[seat] = s; s.anim = { kind: 'in', v, seat, t: 0, from: s.pos.clone(), fromYaw: s.yaw, dur: v.spec.seats[seat].stand ? 1.2 : 1.4 }; return true; }
    if (!s.path || s.pi >= s.path.length) { s.path = world.path(s.pos.x, s.pos.z, door.x, door.z); s.pi = 0; }
    let mx = 0, mz = 0; if (s.path && s.pi < s.path.length) { const wp = s.path[s.pi]; const dx = wp.x - s.pos.x, dz = wp.y - s.pos.z, L = Math.hypot(dx, dz); if (L < 0.7) s.pi++; else { mx = dx / L; mz = dz / L; s.yaw = Math.atan2(mx, mz); } } else { const dx = door.x - s.pos.x, dz = door.z - s.pos.z, L = Math.hypot(dx, dz) || 1; mx = dx / L; mz = dz / L; s.yaw = Math.atan2(mx, mz); }
    moveMan(s, mx, mz, dt); return true;
  }
  return false;
}
function spawnVehicles() {
  G.vehicles = [];
  for (const [kind, x, z, yaw] of PADS[world.mapId] || []) {
    let px = x, pz = z; for (let k = 0; k < 30 && (world.blocked(px, pz, 0, kind === 'tank' ? 2.6 : 2) || world.groundAt(px, pz, 0.3) > 0.2); k++) { px = x + rnd(-6, 6); pz = z + rnd(-6, 6); }
    let team = 0, bd = 1e9; for (let t = 0; t < G.teams; t++) { const zn = world.spawnZone(t, G.teams), cx = (zn[0] + zn[1]) / 2, cz = (zn[2] + zn[3]) / 2, d = Math.hypot(px - cx, pz - cz); if (d < bd) { bd = d; team = t; } }
    G.vehicles.push(new Vehicle(scene, kind, team, TEAMS[G.teamIds[team]].color, px, pz, yaw));
  }
}
function updateVehicles(dt) {
  for (const v of G.vehicles) {
    if (v.kind === 'jeep' && v.alive) { const gn = v.seats[2]; if (gn && gn.inVehicle) v.aimGun(gn.yaw, gn.pitch, dt); }
    const driver = v.seats[0]; let inp = null;
    if (driver && driver.inVehicle && driver.isPlayer) inp = vehicleInput(driver, dt);
    if (v.alive) v.drive(dt, inp); else { v.wreckT += dt; if (Math.random() < 0.5) part('smoke', v.pos.add(new THREE.Vector3(rnd(-0.5, 0.5), 0.6, rnd(-0.5, 0.5))), { size: rnd(0.5, 1), life: 2, grow: 0.8, op: 0.5, color: 0x2a2826, v: new THREE.Vector3(rnd(-0.3, 0.3), 2, rnd(-0.3, 0.3)) }); if (v.wreckT < 6 && Math.random() < 0.4) part('fire', v.pos.add(new THREE.Vector3(rnd(-0.6, 0.6), 0.6, rnd(-0.6, 0.6))), { size: rnd(0.3, 0.6), life: 0.5, grow: 1, color: 0xff7a2a, v: new THREE.Vector3(0, 2, 0) }); if (v.wreckT > 25) v.respawn(); }
    if (v.flipT > 2.5) { v.flipUpright(); v.flipT = 0; }
  }
}
function postPhysicsVehicles(dt) {
  for (const v of G.vehicles) {
    v.sync();
    // plane crashes: a hard sudden stop
    const sp = v.speed; if (v.kind === 'plane' && v.alive) { if (v.pos.y > 2.5) v.flew = 1.5; else v.flew = Math.max(0, (v.flew || 0) - dt); const lv = v.body.linvel(); if (((v.lastSp || 0) - sp > 3.5 && v.lastSp > 7) || (sp < (v.lastSp || 0) * 0.6 && v.lastSp > 6 && v.flew > 0) || (v.flew > 0 && v.pos.y < 1.0 && lv.y < -2) || (v.upright < 0.2 && v.pos.y < 1.5 && sp > 2)) { hurtVehicle(v, 9999, v.seats[0]); } v.lastSp = sp; }
    if (v.alive && v.pos.y < -5) destroyVehicle(v, null);
    // running soldiers over
    if (v.alive && sp > 4.5) { const lv = v.body.linvel(), dir = new THREE.Vector3(lv.x, 0, lv.z).normalize();
      for (const s of G.men) { if (!s.alive || s.inVehicle || s.anim || s.protect > 0 || (s.rammed || 0) > 0) continue; if (!v.contains(s.chest(new THREE.Vector3()), 0.15)) continue;
        s.rammed = 0.6; const drv = v.seats[0]; if (drv && drv.team === s.team) { knockDown(s, dir.clone().multiplyScalar(sp * 0.6).setY(3)); continue; }
        hurt(s, sp * 7, drv || null, 'shot', dir); if (s.alive) knockDown(s, dir.clone().multiplyScalar(sp * 0.9).setY(sp * 0.4 + 2)); AU.clack(s.pos); } }
  }
  for (const s of G.men) if (s.rammed > 0) s.rammed -= dt;
}

// ------------------------------------------------------------ living house: the cat and the kid
function scheduleHouse() { G.houseT = rnd(35, 70); }
function startCritter(kind) {
  const h = world.half, side = Math.random() < 0.5 ? -1 : 1;
  if (kind === 'cat') {
    const m = buildCat(); scene.add(m.root);
    const z = rnd(-h * 0.5, h * 0.5); let from = new THREE.Vector3(side * (h + 8), 0, z), to = new THREE.Vector3(-side * (h + 8), 0, z + rnd(-15, 15)), route = null;
    if (world.doorway) { const D = world.doorway, out = new THREE.Vector3(-h - 30, 0, D.z), inn = new THREE.Vector3(-h + 6, 0, D.z); from = out.clone(); route = [inn, new THREE.Vector3(rnd(-10, 30), 0, rnd(-25, 25)), new THREE.Vector3(rnd(-20, 35), 0, rnd(-25, 30)), inn.clone(), out.clone()]; to = route.shift(); }
    G.critter = { kind, m, p: from.clone(), to, from, route, speed: 5.5, t: 0, phase: 'walk', swatT: 0, stepT: 0, hits: 0 };
    toast('A cat wandered in!', 2.5); AU.meow();
  } else {
    const m = buildKid(); scene.add(m.root);
    const z = rnd(-h * 0.4, h * 0.4); let from = new THREE.Vector3(side * (h + 10), 0, z), stop = new THREE.Vector3(side * (h - 16), 0, z + rnd(-6, 6));
    if (world.doorway) { const D = world.doorway; from = new THREE.Vector3(-h - 30, 0, D.z); stop = new THREE.Vector3(-h + 14, 0, D.z - 4); }
    G.critter = { kind, m, p: from.clone(), to: stop, from, speed: 9, t: 0, phase: 'walk', stepT: 0, lastFoot: 0 };
    toast('Uh oh. A kid is coming in!', 2.5);
  }
}
// anyone standing under a foot or paw gets squashed flat
function stomp(p, r, dmg, push) {
  AU.thump(p); if (G.player && camera.position.distanceTo(p) < 25) G.shake = Math.max(G.shake, 0.35 * (1 - camera.position.distanceTo(p) / 25));
  for (let i = 0; i < 6; i++) part('smoke', p.clone().add(new THREE.Vector3(rnd(-1, 1), 0.2, rnd(-1, 1))), { size: 0.5, life: 0.7, grow: 1.5, op: 0.35, color: 0xd8cfc0, v: new THREE.Vector3(rnd(-2, 2), 0.6, rnd(-2, 2)) });
  for (const s of G.men) { if (!s.alive || s.inVehicle) continue; const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z); if (d > r) continue;
    const away = new THREE.Vector3(s.pos.x - p.x, 0, s.pos.z - p.z).normalize(); hurt(s, dmg * (1 - d / r * 0.5), null, 'melee', away); if (s.alive) knockDown(s, away.multiplyScalar(push).setY(push * 0.6)); }
  for (const v of G.vehicles || []) { const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z); if (d < r + 1) v.body.applyImpulse({ x: (v.pos.x - p.x) * v.body.mass() * 0.8, y: v.body.mass() * 3, z: (v.pos.z - p.z) * v.body.mass() * 0.8 }, true); }
}
function updateCritter(dt) {
  if (!G.critter) { G.houseT = (G.houseT ?? rnd(35, 70)) - dt; if (G.houseT <= 0) { const r = Math.random(); if (world.outdoor && r < 0.5) startMower(); else startCritter(r < 0.75 ? 'cat' : 'kid'); } return; }
  const C = G.critter, m = C.m; C.t += dt;
  if (C.kind === 'mower') { updateMower(C, dt); return; }
  const dir = C.to.clone().sub(C.p); dir.y = 0; const dist = dir.length(); if (dist > 0.01) dir.divideScalar(dist);
  const face = (d, rate) => { const want = Math.atan2(d.x, d.z); let dy = ((want - m.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI; m.root.rotation.y += clamp(dy, -rate * dt, rate * dt); };
  if (C.kind === 'cat') {
    const walking = C.phase === 'walk' || C.phase === 'flee';
    if (walking) { C.p.addScaledVector(dir, C.speed * (C.phase === 'flee' ? 2.4 : 1) * dt); face(dir, 2.5); C.stepT += dt * C.speed * (C.phase === 'flee' ? 2.4 : 1) * 0.42; }
    // legs: diagonal pairs swing together
    const sw = walking ? Math.sin(C.stepT * 3) * 0.5 : 0; m.legs[0].rotation.x = sw; m.legs[3].rotation.x = sw; m.legs[1].rotation.x = -sw; m.legs[2].rotation.x = -sw;
    m.tail.rotation.z = Math.sin(C.t * 1.7) * 0.35; m.body.position.y = walking ? Math.abs(Math.sin(C.stepT * 3)) * 0.25 : 0;
    // a paw lands each half step
    const foot = Math.floor(C.stepT * 3 / Math.PI); if (walking && foot !== C.lastFoot) { C.lastFoot = foot; const leg = m.legs[foot % 4]; const lp = leg.getWorldPosition(new THREE.Vector3()); lp.y = 0; stomp(lp.add(new THREE.Vector3(0, 0, 0).addScaledVector(dir, 0.8)), 1.8, 45, 4); }
    // curious about soldiers in front of it: stop and swat one across the floor
    if (C.phase === 'walk' && C.swatT <= 0) { for (const s of G.men) { if (!s.alive || s.inVehicle || s.down) continue; const to = s.pos.clone().sub(C.p); to.y = 0; const L = to.length(); if (L > 4 && L < 10 && to.normalize().dot(dir) > 0.75) { C.phase = 'swat'; C.victim = s; C.t2 = 0; break; } } }
    C.swatT -= dt;
    if (C.phase === 'swat') { C.t2 += dt; const v = C.victim; const to = v.pos.clone().sub(C.p).setY(0).normalize(); face(to, 3); m.head.rotation.x = -0.25;
      const leg = m.legs[0], k = C.t2; leg.rotation.x = k < 0.5 ? -k * 2.6 : k < 0.7 ? -1.3 + (k - 0.5) * 9 : 0.5 * (1 - (k - 0.7) * 3);
      if (k > 0.55 && !C.swung) { C.swung = true; AU.meow(); if (v.alive && v.pos.distanceTo(C.p) < 11) { const side = new THREE.Vector3(to.z, 0, -to.x).multiplyScalar(Math.random() < 0.5 ? 1 : -1); hurt(v, 30, null, 'melee', side); if (v.alive) knockDown(v, side.multiplyScalar(11).add(to.clone().multiplyScalar(3)).setY(7)); if (v.isPlayer) toast('The cat swatted you!', 2); } }
      if (k > 1.1) { C.phase = 'walk'; C.swung = false; C.swatT = rnd(3, 6); m.head.rotation.x = 0; } }
    if (C.phase === 'walk' && C.hits > 6) { C.phase = 'flee'; AU.hiss(); toast('The cat bolted!', 1.5); if (C.route) { const out = C.route[C.route.length - 1] || C.from; C.route = world.doorway ? [new THREE.Vector3(-world.half + 6, 0, world.doorway.z), out] : []; C.to = C.route.shift(); } }
    if (dist < 1 && C.route && C.route.length) { C.to = C.route.shift(); if (C.phase === 'flee') C.to = C.route.length ? C.route[C.route.length - 2] || C.to : C.to; }
    else if (dist < 1 || (!C.route && Math.abs(C.p.x) > world.half + 12)) { scene.remove(m.root); G.critter = null; scheduleHouse(); return; }
  } else { // the kid: walks in, freezes, screams, runs out
    if (C.phase === 'walk' || C.phase === 'run') {
      const sp = C.phase === 'run' ? 17 : C.speed; C.p.addScaledVector(dir, sp * dt); face(dir, C.phase === 'run' ? 5 : 2); C.stepT += dt * sp * 0.24;
      const sw = Math.sin(C.stepT * 2) * (C.phase === 'run' ? 0.75 : 0.45); m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw; m.arms[0].rotation.x = -sw * (C.phase === 'run' ? 0.4 : 0.8); m.arms[1].rotation.x = sw * (C.phase === 'run' ? 0.4 : 0.8);
      if (C.phase === 'run') { m.arms[0].rotation.z = -2.6; m.arms[1].rotation.z = 2.6; } // hands up, running away
      m.body.position.y = Math.abs(Math.sin(C.stepT * 2)) * 0.6;
      const foot = Math.floor(C.stepT * 2 / Math.PI); if (foot !== C.lastFoot) { C.lastFoot = foot; const lp = m.legs[foot % 2].getWorldPosition(new THREE.Vector3()); lp.y = 0; stomp(lp.addScaledVector(dir, 1.2), 3.2, 70, 6); }
      if (C.phase === 'walk' && dist < 1) { C.phase = 'see'; C.t2 = 0; }
      if (C.phase === 'run' && (dist < 1 || (!world.doorway && Math.abs(C.p.x) > world.half + 14))) { scene.remove(m.root); G.critter = null; scheduleHouse(); return; }
    } else if (C.phase === 'see') {
      C.t2 += dt; m.legs[0].rotation.x = m.legs[1].rotation.x = 0; m.head.rotation.y = Math.sin(C.t2 * 2.5) * 0.6; m.head.rotation.x = 0.45;
      if (C.t2 > 1.4) { m.mouth.scale.set(0.8, 1, 0.6); m.arms[0].rotation.z = -0.9; m.arms[1].rotation.z = 0.9; }
      if (C.t2 > 1.4 && !C.screamed) { C.screamed = true; AU.scream(); toast('AAAAAAH!', 2); }
      if (C.t2 > 2.6) { C.phase = 'run'; C.to = C.from.clone(); m.head.rotation.set(0, 0, 0); }
    }
  }
  m.root.position.copy(C.p);
}
function startMower() {
  const dad = buildDad(), mow = buildMower(); scene.add(dad.root); scene.add(mow.root);
  const lanes = []; for (let z = -47; z <= 50; z += 13.5) lanes.push(z);
  const dir0 = Math.random() < 0.5 ? 1 : -1, pts = [];
  lanes.forEach((z, i) => { const d = i % 2 ? -dir0 : dir0; pts.push(new THREE.Vector3(-d * 52, 0, z), new THREE.Vector3(d * 52, 0, z)); });
  G.critter = { kind: 'mower', m: dad, mow, p: pts[0].clone(), route: pts.slice(1), to: pts[1], t: 0, stepT: 0, speed: 5.2, heading: 0 }; G.critter.route.shift();
  toast("Dad's mowing the lawn!", 3); AU.mowerOn();
}
function updateMower(C, dt) {
  const dir = C.to.clone().sub(C.p); dir.y = 0; const dist = dir.length(); if (dist > 0.01) dir.divideScalar(dist);
  const want = Math.atan2(dir.x, dir.z); let dy = ((want - C.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI; C.heading += clamp(dy, -1.2 * dt, 1.2 * dt);
  const turning = Math.abs(dy) > 0.3, f = new THREE.Vector3(Math.sin(C.heading), 0, Math.cos(C.heading));
  if (!turning || dist > 6) C.p.addScaledVector(f, C.speed * (turning ? 0.4 : 1) * dt);
  if (dist < 2 && C.route.length) C.to = C.route.shift(); else if (dist < 2) { scene.remove(C.m.root); scene.remove(C.mow.root); AU.mowerOff(); G.critter = null; scheduleHouse(); toast('Dad finished the lawn.', 2); return; }
  // mower out front, Dad walking behind it
  const mc = C.p.clone().addScaledVector(f, 14); C.mow.root.position.copy(mc); C.mow.root.rotation.y = C.heading; C.mow.root.position.y = Math.abs(Math.sin(C.t * 40)) * 0.08;
  for (const w of C.mow.wheels) w.rotation.x += C.speed * dt / 2.2;
  C.m.root.position.copy(C.p); C.m.root.rotation.y = C.heading; C.stepT += dt * C.speed * 0.16;
  const sw = Math.sin(C.stepT * 2) * 0.38; C.m.legs[0].rotation.x = sw; C.m.legs[1].rotation.x = -sw; C.m.body.position.y = Math.abs(Math.sin(C.stepT * 2)) * 0.5;
  AU.mowerVol(clamp(1 - camera.position.distanceTo(mc) / 90, 0, 1) * 0.12);
  // the deck: 13 wide, 15 long
  const loc = (p) => { const d = p.clone().sub(mc); return new THREE.Vector3(d.x * Math.cos(-C.heading) + d.z * Math.sin(-C.heading), d.y, -d.x * Math.sin(-C.heading) + d.z * Math.cos(-C.heading)); };
  const side = new THREE.Vector3(Math.cos(C.heading), 0, -Math.sin(C.heading));
  for (const s of G.men) { if (!s.alive || s.inVehicle) continue; const l = loc(s.pos); if (Math.abs(l.x) > 6.8 || Math.abs(l.z) > 7.8 || s.pos.y > 3) continue;
    AU.shred(s.pos); for (let i = 0; i < 14; i++) part('chip', mc.clone().addScaledVector(side, 7.5).setY(2.5), { mat: s.m.mat, life: 2.5, v: side.clone().multiplyScalar(rnd(6, 12)).add(new THREE.Vector3(rnd(-2, 2), rnd(2, 6), rnd(-2, 2))) });
    for (let i = 0; i < 4; i++) part('smoke', mc.clone().addScaledVector(side, 7.5).setY(2), { size: 0.8, life: 1, grow: 1.5, op: 0.4, color: 0x7aa04a, v: side.clone().multiplyScalar(4) });
    hurt(s, 999, null, 'mower', side.clone()); if (s.isPlayer) toast('Dad mowed you over!', 2.5); }
  for (const v of G.vehicles || []) { if (!v.alive) continue; const l = loc(v.pos); if (Math.abs(l.x) < 8 && Math.abs(l.z) < 9) { v.body.applyImpulse({ x: side.x * v.body.mass() * 12, y: v.body.mass() * 8, z: side.z * v.body.mass() * 12 }, true); hurtVehicle(v, 60 * dt * 10, null); } }
  // cut the grass it passes over, spraying clippings out the side
  if ((C.cutT = (C.cutT || 0) - dt) <= 0 && world.grass) { C.cutT = 0.2; const im = world.grass, m4 = new THREE.Matrix4(), pp = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); let any = false;
    for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m4); m4.decompose(pp, q, sc); if (sc.y < 0.15) continue; const l = loc(pp); if (Math.abs(l.x) < 6.5 && Math.abs(l.z) < 7.5) { sc.y = 0.1; m4.compose(pp, q, sc); im.setMatrixAt(i, m4); any = true; } }
    if (any) im.instanceMatrix.needsUpdate = true;
    part('smoke', mc.clone().addScaledVector(side, 7.5).setY(2.2), { size: 0.9, life: 0.9, grow: 1.2, op: 0.45, color: 0x6a9a3a, v: side.clone().multiplyScalar(rnd(4, 7)).setY(1.5) }); }
}
function clearCritter() { AU.mowerOff(); if (G && G.critter) { scene.remove(G.critter.m.root); if (G.critter.mow) scene.remove(G.critter.mow.root); G.critter = null; } }

// ------------------------------------------------------------ movement shared by player and bots
function moveMan(s, mx, mz, dt) {
  const sp = s.def.speed * (s.isPlayer && (G.scoped || G.ads) ? 0.55 : 1) * (s.isPlayer && G.crouch ? 0.5 : 1) * (s.isPlayer && G.prone ? 0.28 : 1);
  const dx = mx * sp * dt, dz = mz * sp * dt;
  if (!world.blocked(s.pos.x + dx, s.pos.z, s.pos.y) && !vehBlocked(s.pos.x + dx, s.pos.y, s.pos.z)) s.pos.x += dx; else s.stuck += dt;
  if (!world.blocked(s.pos.x, s.pos.z + dz, s.pos.y) && !vehBlocked(s.pos.x, s.pos.y, s.pos.z + dz)) s.pos.z += dz; else s.stuck += dt;
  const g = world.groundAt(s.pos.x, s.pos.z, s.pos.y);
  if (s.pos.y > g + 0.001 || s.vy > 0) { s.vy -= 22 * dt; s.pos.y += s.vy * dt; if (s.pos.y <= g) { s.pos.y = g; s.vy = 0; } s.onGround = s.pos.y <= g + 0.01; }
  else { s.pos.y = g; s.vy = 0; s.onGround = true; }
  // the ceiling (table tops, chair seats)
  for (const b of world.boxes) if (s.vy > 0 && b.y0 > s.pos.y && b.y0 < s.pos.y + 1 && s.pos.x > b.minX && s.pos.x < b.maxX && s.pos.z > b.minZ && s.pos.z < b.maxZ) { s.vy = 0; }
  const moving = Math.hypot(mx, mz) > 0.1 && s.onGround; s.walk += moving ? dt * sp * 2.2 : 0;
  pose(s.m, s.walk, moving, !s.onGround);
  s.m.body.position.y = moving ? Math.abs(Math.cos(s.walk)) * 0.03 : 0;
}
function jump(s) { if (s.onGround && s.alive) { s.vy = 7.4; s.onGround = false; } }

function updateDying(s, dt) {
  const D = s.dying; if (!D) return; D.t += dt;
  const b = s.m.body;
  if (s.m.rag) { syncRagdoll(s.m); const c = ragdollCentre(s.m); s.pos.set(c.x, Math.max(0, c.y - 0.3), c.z); if (D.t > 3.2) for (const p of s.m.rag.parts) p.o.visible = Math.floor(D.t * 10) % 2 === 0; return; }
  if (D.kind === 'flame') { const k = clamp(D.t / 0.9, 0, 1); b.scale.set(1 + k * 0.5, 1 - k * 0.8, 1 + k * 0.5); s.m.mat.color.lerp(new THREE.Color(0x222222), dt * 0.6); }
  else if (D.vel.lengthSq() > 0) {
    D.vel.y -= 22 * dt; b.position.addScaledVector(D.vel, dt); b.rotation.x += D.spin * dt; b.rotation.z += D.spin * 0.6 * dt;
    if (s.pos.y + b.position.y < world.groundAt(s.pos.x + b.position.x, s.pos.z + b.position.z, s.pos.y + b.position.y) + 0.1) { b.position.y = Math.max(b.position.y, 0.1 - s.pos.y + world.groundAt(s.pos.x + b.position.x, s.pos.z + b.position.z, 99)); D.vel.multiplyScalar(0.3); D.vel.y = Math.abs(D.vel.y) * 0.5; D.spin *= 0.4; if (D.vel.length() < 0.6) D.vel.set(0, 0, 0); }
  } else {
    // tip over stiff as a board, like a real plastic soldier
    const local = D.dir.clone().applyAxisAngle(UP, -s.yaw);
    const k = Math.min(1, D.t / 0.35), ang = (k * k) * (Math.PI / 2 - 0.08);
    b.rotation.set(local.z * ang, 0, -local.x * ang); b.position.set(local.x * Math.sin(ang) * 0.3, 0.03, local.z * Math.sin(ang) * 0.3);
  }
  if (D.t > 3.2) s.m.root.visible = Math.floor(D.t * 10) % 2 === 0;
}

// ------------------------------------------------------------ bots
function botThink(s, dt) {
  if (s.cls === 'bazooka') { const lk = updateLock(s, dt, true); if (lk) { const to = lk.pos.sub(s.eye); s.yaw = Math.atan2(to.x, to.z); s.pitch = Math.atan2(to.y, Math.hypot(to.x, to.z)); moveMan(s, 0, 0, dt); return; } }
  s.think -= dt;
  if (s.think <= 0) {
    s.think = 0.25 + Math.random() * 0.15;
    let best = null, bd = 48;
    for (const t of G.men) {
      if (!t.alive || t.team === s.team) continue; const d = t.pos.distanceTo(s.pos); if (d >= bd) continue;
      const e = s.eye.clone(); if (lineOfSight(e, t.chest())) { best = t; bd = d; }
    }
    if (best && best !== s.target) { s.react = G.botReact * rnd(0.8, 1.4); s.aimErr = new THREE.Vector3(rnd(-1, 1), rnd(-0.6, 0.6), rnd(-1, 1)).normalize().multiplyScalar(G.botWobble); s.burst = 0; }
    s.target = best;
    if (!best && (!s.path || s.pi >= s.path.length || s.repath <= 0)) {
      s.repath = 6 + Math.random() * 4;
      let goal;
      const foes = G.men.filter((t) => t.alive && t.team !== s.team);
      if (foes.length && Math.random() < 0.65) { const f = foes[(Math.random() * foes.length) | 0]; goal = f.pos.clone().add(new THREE.Vector3(rnd(-6, 6), 0, rnd(-6, 6))); }
      else goal = world.randomOpen(-world.half + 6, world.half - 6, -world.half + 6, world.half - 6);
      s.path = world.path(s.pos.x, s.pos.z, goal.x, goal.z); s.pi = 0;
    }
  }
  s.repath -= dt;
  let mx = 0, mz = 0;
  if (s.target && s.target.alive) {
    const t = s.target, aimP = t.chest(new THREE.Vector3()); aimP.y += 0.05;
    const to = aimP.clone().sub(s.eye); const want = Math.atan2(to.x, to.z), dist = to.length();
    let dy = ((want - s.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; s.yaw += clamp(dy, -6 * dt, 6 * dt);
    s.pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
    const pref = { rifle: [7, 22], bazooka: [10, 26], sniper: [22, 60], flamer: [2, 5] }[s.cls];
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    let adv = dist > pref[1] ? 1 : dist < pref[0] ? -0.7 : 0;
    if (Math.random() < dt * 0.6) s.strafe *= -1;
    mx = fx * adv + -fz * s.strafe * 0.6 * -1; mz = fz * adv + fx * s.strafe * 0.6 * -1;
    if (s.stuck > 0.4) { s.strafe *= -1; s.stuck = 0; if (Math.random() < 0.5) jump(s); }
    s.react -= dt; s.pause = (s.pause || 0) - dt;
    if (s.aimErr) s.aimErr.multiplyScalar(Math.max(0, 1 - dt * 0.9));
    if (s.react <= 0 && s.pause <= 0 && Math.abs(dy) < 0.15 && dist < s.w.range + 1) {
      const dir = fwd(s.yaw, s.pitch); if (s.aimErr) dir.add(s.aimErr).normalize();
      if (s.cls === 'flamer' && dist > 7.5) {} else { const before = s.ammo; fire(s, dir); if (s.ammo < before) { s.cool *= G.botRate; s.burst = (s.burst || 0) + 1; if (s.burst >= 3 + ((Math.random() * 4) | 0)) { s.burst = 0; s.pause = rnd(0.5, 1.2); } } }
    }
    if (s.nades > 0 && dist > 7 && dist < 17 && Math.random() < dt * 0.12 * G.botNade) throwNade(s, fwd(s.yaw, Math.atan2(to.y, dist)));
  } else if (s.path && s.pi < s.path.length) {
    const wp = s.path[s.pi]; const dx = wp.x - s.pos.x, dz = wp.y - s.pos.z; const L = Math.hypot(dx, dz);
    if (L < 0.8) s.pi++; else { mx = dx / L; mz = dz / L; const want = Math.atan2(mx, mz); let dy = ((want - s.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; s.yaw += clamp(dy, -5 * dt, 5 * dt); s.pitch *= 0.9; }
    if (s.stuck > 1.2) { s.path = null; s.stuck = 0; jump(s); }
  }
  // auto reload when idle, a hurt bot backs off a bit
  if (!s.target && s.ammo < s.w.mag && s.reload <= 0) startReload(s);
  const L = Math.hypot(mx, mz); if (L > 1) { mx /= L; mz /= L; }
  moveMan(s, mx, mz, dt);
}

// ------------------------------------------------------------ input
const IN = { lastDX: 0, lastDY: 0, jx: 0, jy: 0, fire: false, lookDX: 0, lookDY: 0, keys: {}, ptrs: new Map(), locked: false };
const touchEl = $('touch'), joyEl = $('joy');
const BTN = ['bFire', 'bJump', 'bNade', 'bScope', 'bReload', 'bMelee', 'bView', 'bCrouch', 'bUse', 'bAim'].map((id) => $(id));
function nearestBtn(x, y, lim = 1.35) {
  let best = null, bd = 1e9;
  for (const b of BTN) { if (b.classList.contains('hidden')) continue; const r = b.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const d = Math.hypot(x - cx, y - cy) / (r.width / 2); if (d < bd) { bd = d; best = b; } }
  return bd < lim ? best : null;
}
function press(name, down) {
  if (!G || !G.player) return; const p = G.player;
  if (name === 'aim') { if (down && !p.inVehicle) G.aimOn = !G.aimOn; return; }
  if (name === 'fire') { if (G.aimOn && !p.inVehicle) { if (!down) { G.shootOnRelease = true; } return; } IN.fire = down; }
  if (name === 'nade') { if (p.inVehicle) { if (down) vehicleAlt(p); } else if (down) { if (p.nades > 0 && p.alive && !p.down) G.nadeAim = true; } else if (G.nadeAim) { G.nadeAim = false; throwNade(p, fwd(p.yaw, p.pitch)); } }
  if (!down) return;
  if (name === 'jump') { if (p.inVehicle) useVehicle(p); else if (G.prone || G.crouch) { G.prone = false; G.crouch = false; } else jump(p); }

  if (name === 'reload') startReload(p);
  if (name === 'scope') G.scoped = !G.scoped;
  if (name === 'melee') melee(p);
  if (name === 'use') useVehicle(p);
  if (name === 'crouch') { const now = performance.now(); if (now - (G.lastCrouchTap || 0) < 400) { G.prone = true; G.crouch = false; } else if (G.prone) { G.prone = false; G.crouch = true; } else G.crouch = !G.crouch; G.lastCrouchTap = now; }
  if (name === 'view') { if (p.inVehicle) P.set.vview = P.set.vview === 'fp' ? 'tp' : 'fp'; else P.set.view = P.set.view === 'fp' ? 'tp' : 'fp'; save(); }
}
touchEl.addEventListener('pointerdown', (e) => {
  AU.init(); e.preventDefault(); const x = e.clientX, y = e.clientY;
  const b = nearestBtn(x, y, x < innerWidth * 0.45 ? 1.05 : 1.35);
  let role;
  if (b) { role = { kind: 'btn', b, name: b.dataset.btn, lx: x, ly: y }; b.classList.add('down'); press(role.name, true); if (role.name === 'fire' && G && G.aimOn) { const fs = $('fireStick'); fs.style.left = x + 'px'; fs.style.top = y + 'px'; fs.classList.remove('hidden'); role.stick = true; } }
  else if (x < innerWidth * 0.42) { role = { kind: 'joy', ox: x, oy: y }; joyEl.style.left = x + 'px'; joyEl.style.top = y + 'px'; joyEl.classList.remove('hidden'); }
  else role = { kind: 'look', lx: x, ly: y };
  IN.ptrs.set(e.pointerId, role); try { touchEl.setPointerCapture(e.pointerId); } catch (er) {}
});
touchEl.addEventListener('pointermove', (e) => {
  const r = IN.ptrs.get(e.pointerId); if (!r) return; e.preventDefault();
  if (r.kind === 'joy') {
    let dx = e.clientX - r.ox, dy = e.clientY - r.oy; const L = Math.hypot(dx, dy), max = 50;
    if (L > max) { r.ox += (dx / L) * (L - max); r.oy += (dy / L) * (L - max); dx = e.clientX - r.ox; dy = e.clientY - r.oy; joyEl.style.left = r.ox + 'px'; joyEl.style.top = r.oy + 'px'; }
    IN.jx = dx / max; IN.jy = -dy / max; joyEl.firstElementChild.style.transform = `translate(${dx}px,${dy}px)`;
  } else { // look (fire and other buttons can be dragged to aim too; the aiming stick is slower and finer)
    const f = r.stick ? 0.55 : 1; IN.lookDX += (e.clientX - r.lx) * f; IN.lookDY += (e.clientY - r.ly) * f; r.lx = e.clientX; r.ly = e.clientY;
  }
});
function ptrUp(e) {
  const r = IN.ptrs.get(e.pointerId); if (!r) return; IN.ptrs.delete(e.pointerId);
  if (r.kind === 'joy') { IN.jx = IN.jy = 0; joyEl.classList.add('hidden'); joyEl.firstElementChild.style.transform = ''; }
  if (r.kind === 'btn') { r.b.classList.remove('down'); press(r.name, false); if (r.name === 'fire') $('fireStick').classList.add('hidden'); }
}
touchEl.addEventListener('pointerup', ptrUp); touchEl.addEventListener('pointercancel', ptrUp);
// keyboard + mouse for testing on a computer
addEventListener('keydown', (e) => { IN.keys[e.code] = true; if (mode !== 'play') return; if (e.code === 'Space') press('jump', true); if (e.code === 'KeyG' && !e.repeat) press('nade', true); if (e.code === 'KeyR') press('reload', true); if (e.code === 'KeyV') press('melee', true); if (e.code === 'KeyE' || e.code === 'KeyF') press('use', true); if (e.code === 'ControlLeft' || e.code === 'KeyQ') press('crouch', true); if (e.code === 'KeyC') { P.set.view = P.set.view === 'fp' ? 'tp' : 'fp'; save(); } if (e.code === 'Escape' || e.code === 'KeyP') pause(); });
addEventListener('keyup', (e) => { IN.keys[e.code] = false; if (mode === 'play' && e.code === 'KeyG') press('nade', false); });
canvas.addEventListener('mousedown', (e) => { AU.init(); if (mode !== 'play' || isTouch) return; if (!IN.locked) { canvas.requestPointerLock?.(); return; } if (e.button === 0) IN.fire = true; if (e.button === 2) IN.ads = true; });
addEventListener('mouseup', (e) => { if (e.button === 2) IN.ads = false; if (e.button === 0 && !isTouch) IN.fire = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { IN.locked = document.pointerLockElement === canvas; });
addEventListener('mousemove', (e) => { if (IN.locked && mode === 'play') { IN.lookDX += e.movementX * 0.6; IN.lookDY += e.movementY * 0.6; } });

// ------------------------------------------------------------ player update + camera
const camState = { pos: new THREE.Vector3(), aim: new THREE.Vector3() };
function updatePlayer(dt) {
  const p = G.player;
  const sens = 0.0052 * P.set.sens * (G.scoped ? 0.3 : 1);
  p.yaw -= IN.lookDX * sens; p.pitch = clamp(p.pitch - IN.lookDY * sens, -1.25, 1.2); IN.lastDX = IN.lookDX / Math.max(dt * 60, 0.3); IN.lastDY = IN.lookDY / Math.max(dt * 60, 0.3); IN.lookDX = IN.lookDY = 0;
  if (G.recoil > 0 || G.recoilYaw) { const k = Math.min(1, dt * 28); const dp = G.recoil * k, dy = G.recoilYaw * k; p.pitch = clamp(p.pitch + dp, -1.25, 1.2); p.yaw += dy; G.recoil -= dp; G.recoilYaw -= dy; G.recoilBack = (G.recoilBack || 0) + dp * 0.7; }
  if (G.recoilBack > 0 && !IN.fire) { const r = Math.min(G.recoilBack, dt * 0.25); p.pitch -= r; G.recoilBack -= r; }
  G.bloom = Math.max(0, (G.bloom || 0) - dt * 3.5);
  if (p.inVehicle && !p.anim) {
    const v = p.inVehicle.v; if (v.kind === 'jeep' && p.inVehicle.seat === 0) { const y = v.yaw; if (p.lastVY != null) p.yaw += ((y - p.lastVY + Math.PI * 3) % (Math.PI * 2)) - Math.PI; p.lastVY = y; } else p.lastVY = null;
    if (IN.fire) vehicleFire(p); return;
  }
  p.lastVY = null;
  if (!p.alive || p.down || p.anim || p.inVehicle) G.aimOn = false;
  const wantAds = p.alive && !p.down && !p.anim && !p.inVehicle && !G.nadeAim && p.w.kind !== 'flame' && (isTouch ? !!G.aimOn : IN.ads);
  G.ads = wantAds; G.adsK = (G.adsK || 0) + ((wantAds ? 1 : 0) - (G.adsK || 0)) * Math.min(1, dt * 12);
  if (p.w.scoped) G.scoped = wantAds && G.adsK > 0.6; else G.scoped = false;
  if (!p.alive || p.down || p.anim) return;
  let jx = IN.jx, jy = IN.jy;
  if (IN.keys.KeyW) jy = 1; if (IN.keys.KeyS) jy = -1; if (IN.keys.KeyA) jx = -1; if (IN.keys.KeyD) jx = 1;
  const L = Math.hypot(jx, jy); if (L > 1) { jx /= L; jy /= L; } if (L < 0.12) { jx = jy = 0; }
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = -fz, rz = fx; // right = (-cos, sin)
  moveMan(p, fx * jy + rx * jx, fz * jy + rz * jx, dt);
  if (G.shootOnRelease) { G.shootOnRelease = false; p.cool = Math.min(p.cool, 0); fire(p, aimDir()); }
  if (IN.fire && !G.nadeAim) fire(p, aimDir());
  drawNadeArc();
}
// camera ray from the crosshair; the gun shoots at whatever the crosshair covers
function aimDir() {
  const p = G.player, cd = fwd(p.yaw, p.pitch, new THREE.Vector3());
  const co = camera.position.clone();
  const wt = world.ray(co, cd, 150), mh = rayMen(co, cd, wt, p);
  let target = co.clone().addScaledVector(cd, mh.who ? mh.t : wt);
  if (isTouch && P.set.assist && !(G.scoped)) { // gentle aim assist for thumbs
    let best = null, ba = 0.07;
    for (const t of G.men) { if (!t.alive || t.team === p.team) continue; const c = t.chest(new THREE.Vector3()); const a = c.clone().sub(co).normalize().angleTo(cd); if (a < ba && c.distanceTo(co) < p.w.range && lineOfSight(co, c)) { ba = a; best = c; } }
    if (best) target = best;
  }
  return target.sub(p.muzzleWorld(new THREE.Vector3())).normalize();
}
function updateCamera(dt) {
  const p = G.player; const cd = fwd(p.yaw, p.pitch);
  const fp = P.set.view === 'fp' && p.alive && !p.down && !(p.anim);
  if (p.anim) p.m.root.visible = true;
  const right = new THREE.Vector3(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
  let final;
  const inV = p.inVehicle && !p.anim ? p.inVehicle.v : null;
  if (inV) {
    const sp = inV.spec; let eye;
    const vfp = P.set.vview === 'fp';
    if (vfp) { const e = sp.fpEye; eye = inV.kind === 'jeep' && p.inVehicle.seat === 2 ? inV.local(new THREE.Vector3(0, 1.32, -1.0)) : inV.kind === 'tank' ? inV.local(new THREE.Vector3(0, 0.55, -0.15).add(new THREE.Vector3(0.25, 0.7, 0.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), inV.turretYaw))) : inV.local(new THREE.Vector3(p.inVehicle.seat === 1 ? -e[0] : e[0], e[1], e[2])); camState.pos.copy(eye); }
    else { const tgt = inV.pos.add(new THREE.Vector3(0, sp.tp[1] * 0.5, 0)), want = tgt.clone().addScaledVector(fwd(p.yaw, Math.min(p.pitch, 0.6) - 0.18), -sp.tp[0]); want.y += sp.tp[1] * 0.5; const dir = want.clone().sub(tgt), L = dir.length(); dir.divideScalar(L); const t = world.ray(tgt, dir, L); const fin = tgt.clone().addScaledVector(dir, Math.max(1, Math.min(L, t - 0.3))); camState.pos.lerp(fin, 1 - Math.exp(-dt * 14)); if (camState.pos.distanceTo(fin) > 8) camState.pos.copy(fin); }
    camera.position.copy(camState.pos);
    camera.lookAt(camera.position.clone().add(fwd(p.yaw, p.pitch)));
    const fov2 = vfp ? 72 : 68; if (Math.abs(camera.fov - fov2) > 0.1) { camera.fov += (fov2 - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix(); }
    if (G.shake > 0) { camera.position.add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(G.shake * 0.1)); G.shake = Math.max(0, G.shake - dt * 1.6); }
    inV.model.visible = !(fp && inV.kind !== 'jeep' ? false : false) || true;
    p.m.root.visible = !vfp && !p.hidden; vm.group.visible = false; if (passes.dof) passes.dof.enabled = false;
    $('tankSight').classList.toggle('hidden', !(vfp && inV.kind === 'tank'));
    return;
  }
  $('tankSight').classList.add('hidden');
  if (fp) { G.eyeH = (G.eyeH ?? 0.88) + ((G.prone ? 0.26 : G.crouch ? 0.58 : 0.88) - (G.eyeH ?? 0.88)) * Math.min(1, dt * 12); final = new THREE.Vector3(p.pos.x, p.pos.y + G.eyeH + p.m.body.position.y * 0.6, p.pos.z); camState.pos.copy(final); }
  else {
    const head = new THREE.Vector3(p.pos.x, p.pos.y + (G.prone ? 0.6 : G.crouch ? 1.0 : 1.3), p.pos.z);
    let back = G.scoped ? 0.2 : 3.4 - (G.adsK || 0) * 1.6, side = G.scoped ? 0.1 : 0.75 - (G.adsK || 0) * 0.15;
    if (!p.alive || p.down) { back = p.down ? 3 : 4.5; side = 0; }
    const want = head.clone().addScaledVector(right, side).addScaledVector(cd, -back);
    const dir = want.clone().sub(head); const L = dir.length(); dir.divideScalar(L);
    const t = world.ray(head, dir, L); final = head.clone().addScaledVector(dir, Math.max(0.25, Math.min(L, t - 0.2)));
    camState.pos.lerp(final, 1 - Math.exp(-dt * 25)); if (camState.pos.distanceTo(final) > 4) camState.pos.copy(final);
  }
  camera.position.copy(camState.pos);
  if (G.shake > 0) { camera.position.add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(G.shake * (fp ? 0.08 : 0.3))); G.shake = Math.max(0, G.shake - dt * 1.6); }
  const kickUp = fp ? vm.kick * 0.015 : 0;
  camera.lookAt(camera.position.clone().add(fwd(p.yaw, p.pitch + kickUp)));
  const fov = G.scoped ? 20 : (fp ? 74 : 66) - (G.adsK || 0) * (fp ? 22 : 14); if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
  p.m.root.visible = !fp && !(G.scoped && p.alive) && (p.alive || !!p.dying); if (p.m.rag) for (const q of p.m.rag.parts) q.o.visible = !fp;
  updateViewModel(dt, fp && !G.scoped);
  // depth of field focuses on whatever the crosshair is on
  if (passes.dof) { const ft = world.ray(camera.position, cd, 120); const f = passes.dof.uniforms.focus; f.value += (clamp(fp ? ft : Math.min(ft, 3.6), 1, 120) - f.value) * Math.min(1, dt * 6); passes.dof.uniforms.aperture.value = 0.0016; passes.dof.enabled = !G.scoped && !fp; }
}
// first-person arms + weapon: sway with look, bob with walk, kick when firing, dip when reloading
function updateViewModel(dt, show) {
  const p = G.player; vm.group.visible = show; if (!show) return;
  const key = p.cls + JSON.stringify(P.eq) + G.teamIds[0];
  if (vm.key !== key) {
    if (vm.mesh) vm.group.remove(vm.mesh);
    const V = buildViewGeometry(p.cls); Object.assign(vm, VMOFF[p.cls]); vm.mesh = new THREE.Mesh(V.geo, soldierMaterial(TEAMS[G.teamIds[p.team]].color, P.eq.finish, p.m.skin)); vm.muzzle = V.muzzle;
    const dotAt = { rifle: [-0.11, 0.053, 0.255], sniper: null, bazooka: [-0.11, 0.12, 0.38], flamer: null }[p.cls];
    if (dotAt) { const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPR.soft, color: 0xff2a1a, blending: THREE.AdditiveBlending, depthTest: false, transparent: true })); dot.scale.setScalar(0.007); dot.position.set(...dotAt); dot.renderOrder = 5; vm.mesh.add(dot); } vm.mesh.rotation.y = Math.PI; vm.group.add(vm.mesh); vm.key = key;
  }
  const moving = Math.hypot(IN.jx, IN.jy) > 0.15 || IN.keys.KeyW || IN.keys.KeyS || IN.keys.KeyA || IN.keys.KeyD;
  vm.bob += dt * (moving && p.onGround ? 9 : 2);
  let amp = moving && p.onGround ? 1 : 0.25;
  vm.swayX += (clamp(-IN.lastDX * 0.0009, -0.06, 0.06) - vm.swayX) * Math.min(1, dt * 8); vm.swayY += (clamp(IN.lastDY * 0.0009, -0.05, 0.05) - vm.swayY) * Math.min(1, dt * 8);
  vm.kick = Math.max(0, vm.kick - dt * 7); vm.melee = Math.max(0, (vm.melee || 0) - dt); const sw = vm.melee > 0 ? Math.sin((1 - vm.melee / 0.35) * Math.PI) : 0;
  const rl = p.reload > 0 ? Math.sin(Math.min(1, 1 - p.reload / p.w.reload) * Math.PI) : 0;
  const ak = G.adsK || 0, AD = VMADS[p.cls], bobK = 1 - ak * 0.85; amp *= bobK; vm.swayX *= 1 - ak * 0.6; vm.swayY *= 1 - ak * 0.6;
  vm.group.position.set(vm.ox + (AD.ox - vm.ox) * ak + Math.sin(vm.bob) * 0.012 * amp + vm.swayX, vm.oy + (AD.oy - vm.oy) * ak + Math.abs(Math.cos(vm.bob)) * 0.01 * amp + vm.swayY - rl * 0.18 - (p.onGround ? 0 : 0.02), vm.oz + (AD.oz - vm.oz) * ak + vm.kick * 0.06 * (1 - ak * 0.5));
  vm.group.rotation.set(vm.kick * 0.12 + rl * 0.7 - sw * 0.5 + 0.03, vm.swayX * 1.5 + sw * 0.9 + vm.oyaw * (1 - ak), -rl * 0.4 + Math.sin(vm.bob) * 0.01 * amp); vm.group.position.z -= sw * 0.25;
  // light the viewmodel like the world around the player
  vmHemi.color.copy(hemi.color); vmHemi.groundColor.copy(hemi.groundColor); vmHemi.intensity = hemi.intensity;
  vmSun.intensity = sun.intensity * 0.8; vmSun.position.copy(sun.position.clone().sub(sun.target.position).normalize().applyQuaternion(camera.quaternion.clone().invert()));
}
function placeMarker(s) {
  if (s.mark) s.mark.visible = false;
  const glow = G.player && s.team !== G.player.team && s.alive && (s.spotT || 0) > 0; const m = s.m.mat;
  if (glow) { s.spotT -= 1 / 60; const k = 0.55 + Math.sin(performance.now() / 120) * 0.25; m.emissive.setRGB(0.9 * k, 0.05, 0.03); }
  else if (s.wasSpot) m.emissive.copy(m.userData.baseEmissive || new THREE.Color(0));
  s.wasSpot = glow; return;
}
function poseMan(s) { if (s.m.rag || s.anim || s.inVehicle) { if (s.inVehicle && !s.anim) { const { v, seat } = s.inVehicle; s.m.aim.rotation.x = -s.pitch * 0.9; if (v.kind === 'jeep' && seat >= 1) s.m.root.rotation.y = seat === 2 ? v.mgYawA : (((s.yaw - v.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 0.6; } return; } s.m.root.position.copy(s.pos); s.m.root.rotation.y = s.yaw; if (s.alive) { s.m.aim.rotation.x = -s.pitch * 0.9; if (s.isPlayer && G.prone) { s.m.body.rotation.x = Math.PI / 2 - 0.05; s.m.body.position.set(0, 0.1, -0.45); s.m.legs[0].rotation.x = s.m.legs[1].rotation.x = 0.05; s.m.knees[0].rotation.x = s.m.knees[1].rotation.x = 0.05; s.m.aim.rotation.x = -s.pitch * 0.9 - Math.PI / 2 + 0.05; } else { s.m.body.rotation.x = 0; if (s.isPlayer) s.m.body.position.z = 0; if (s.isPlayer && G.crouch) { s.m.legs[0].rotation.x = -1.3; s.m.knees[0].rotation.x = 1.9; s.m.legs[1].rotation.x = 0.1; s.m.knees[1].rotation.x = 1.6; s.m.body.position.y = -0.2; } } } }

// ------------------------------------------------------------ HUD
let hitT = 0, toastT = 0;
function flashHit() { $('cross').classList.add('hit'); hitT = 0.12; }
function toast(t, dur = 1.6) { $('toast').textContent = t; toastT = dur; }
function feed(html) { const f = $('feed'); const d = document.createElement('div'); d.innerHTML = html; f.prepend(d); while (f.children.length > 4) f.lastChild.remove(); setTimeout(() => d.remove(), 6000); }
let scoreKey = '';
function drawScores() {
  const key = G.score.join(',') + G.player.team; if (key === scoreKey) return; scoreKey = key;
  $('scores').innerHTML = G.score.map((v, i) => `<div class="sc${i === G.player.team ? ' me' : ''}" style="background:${TEAMS[G.teamIds[i]].css}">${v}</div>`).join('');
}
function hudUpdate(dt) {
  const p = G.player;
  { const lk = updateLock(p, dt, false), on = !!lk && p.lockT > 0.05; $('lock').classList.toggle('hidden', !on); $('lockT').classList.toggle('hidden', !on); if (on) { const k = Math.min(1, p.lockT / 3); $('lock').style.transform = `scale(${1.6 - k * 0.9})`; $('lockT').textContent = k > 0.98 ? 'LOCKED' : 'LOCKING ' + Math.ceil(3 - p.lockT); if ((G.beepT = (G.beepT || 0) - dt) <= 0) { G.beepT = 0.5 - k * 0.35; AU.tick(camera.position); } } }
  if (p.alive && !p.inVehicle) { const cd = fwd(p.yaw, p.pitch), wt = world.ray(camera.position, cd, 80), mh = rayMen(camera.position, cd, wt, p); const c = $('cross'); c.classList.toggle('foe', !!(mh.who && mh.who.team !== p.team)); c.classList.toggle('friend', !!(mh.who && mh.who.team === p.team)); }
  if (hitT > 0 && (hitT -= dt) <= 0) $('cross').classList.remove('hit');
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').textContent = '';
  const hp = Math.max(0, p.hp / p.def.hp); $('hpfill').style.width = hp * 100 + '%'; $('hpfill').style.background = hp > 0.5 ? '#7fd24a' : hp > 0.25 ? '#f0c23a' : '#e2452f';
  $('ammo').textContent = p.reload > 0 ? 'Reloading…' : `${p.w.kind === 'flame' ? Math.ceil(p.ammo) + '% fuel' : p.ammo + ' / ' + p.w.mag}  ·  ${p.nades} nades`;
  const t = Math.max(0, G.time); $('clock').textContent = Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  const nv = p.alive && !p.down && !p.anim && !p.inVehicle ? nearVehicle(p) : null;
  BTN[8].classList.toggle('hidden', !(nv || (p.inVehicle && !p.anim))); BTN[8].textContent = p.inVehicle ? 'GET OUT' : nv && nv.flip ? 'FLIP' : nv ? 'GET IN' : '';
  if (!isTouch && (nv || p.inVehicle)) { $('toast').textContent = p.inVehicle ? '' : nv.flip ? 'E: flip it over' : `E: get in the ${nv.v.kind}`; toastT = 0.2; }
  const iv = p.inVehicle && p.inVehicle.v; $('vhp').classList.toggle('hidden', !iv); if (iv) { $('vhpfill').style.width = Math.max(0, iv.hp / iv.spec.hp * 100) + '%'; $('vhpname').textContent = iv.kind === 'jeep' ? ['Jeep · driving', 'Jeep · passenger', 'Jeep · minigun'][p.inVehicle.seat] : iv.kind === 'tank' ? 'Tank' + (iv.cool > 0 ? ' · loading' : ' · ready') : 'Plane · ' + (iv.cool2 > 0 ? 'bomb in ' + Math.ceil(iv.cool2) : 'bomb ready'); }
  for (const id of ['bJump']) $(id).textContent = p.inVehicle ? 'GET OUT' : 'JUMP';
  BTN[2].textContent = p.inVehicle ? (iv.kind === 'plane' ? 'BOMB' : '') : 'NADE'; BTN[2].classList.toggle('hidden', !!(p.inVehicle && iv.kind !== 'plane'));
  for (const b of [BTN[4], BTN[5], BTN[7]]) b.classList.toggle('hidden', !!p.inVehicle);
  if (p.inVehicle && p.inVehicle.v.kind === 'plane') BTN[2].classList.add('hidden');
  $('scope').classList.toggle('hidden', !(G.scoped && p.alive)); $('cross').style.transform = `scale(${1 + (G.bloom || 0) * 0.35 * (G.crouch ? 0.6 : 1)})`; BTN[9].classList.toggle('on', !!G.aimOn); BTN[9].classList.toggle('hidden', !!p.inVehicle || p.w.kind === 'flame'); BTN[0].textContent = G.aimOn && !p.inVehicle ? 'SHOOT' : p.inVehicle && p.inVehicle.v.kind === 'plane' ? 'BOMB' : 'FIRE'; BTN[7].classList.toggle('down', !!G.crouch); BTN[7].classList.toggle('prone', !!G.prone); BTN[7].textContent = G.prone ? 'PRONE' : 'CROUCH'; BTN[0].classList.toggle('hidden', false); $('cross').classList.toggle('hidden', !p.alive);
  $('dead').classList.toggle('hidden', p.alive); if (!p.alive) $('deadT').textContent = 'Back in the fight in ' + Math.ceil(p.respawn);
  BTN[3].classList.toggle('hidden', !p.w.scoped); BTN[2].style.opacity = p.nades ? '' : '0.15';
  drawScores();
}
// minimap: north-up; teammates always, enemies only when they fire or are close
const mini = $('mini'), mctx = mini.getContext('2d'); let miniBase = null;
function buildMiniBase() {
  const c = document.createElement('canvas'), S = 256; c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = { living: '#9c6a38', kitchen: '#cfc8b8', backyard: '#4f8a2e' }[world.mapId]; g.fillRect(0, 0, S, S);
  const k = S / world.size;
  const sorted = [...world.boxes].filter((b) => b.top < 40 || b.y0 === 0).sort((a, b) => a.top - b.top);
  for (const b of sorted) { if (b.minX < -world.half - 0.5 || b.maxX > world.half + 0.5 || b.minZ < -world.half - 0.5 || b.maxZ > world.half + 0.5) continue; const v = clamp(b.top / 14, 0, 1); g.fillStyle = b.top < 0.4 ? 'rgba(0,0,0,.12)' : `rgba(${40 + v * 60},${40 + v * 50},${40 + v * 40},${b.y0 > 1 ? 0.35 : 0.85})`; g.fillRect((b.minX + world.half) * k, (b.minZ + world.half) * k, (b.maxX - b.minX) * k, (b.maxZ - b.minZ) * k); }
  miniBase = c;
}
function drawMini() {
  const big = mini.classList.contains('big'); const S = big ? Math.min(innerHeight * 0.7, innerWidth * 0.6) : 112, dpr = Math.min(2, devicePixelRatio || 1);
  if (mini.width !== Math.round(S * dpr)) { mini.width = mini.height = Math.round(S * dpr); }
  const g = mctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S); g.globalAlpha = 0.88; g.drawImage(miniBase, 0, 0, S, S); g.globalAlpha = 1;
  const k = S / world.size, P0 = G.player;
  for (const s of G.men) {
    if (!s.alive) continue; const friend = s.team === P0.team;
    if (!friend && !(s.lastFired < 1.5 || s.pos.distanceTo(P0.pos) < 14)) continue;
    const x = (s.pos.x + world.half) * k, y = (s.pos.z + world.half) * k;
    if (s === P0) continue;
    g.fillStyle = TEAMS[G.teamIds[s.team]].css; g.strokeStyle = friend ? '#fff' : '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, big ? 5 : 3.2, 0, 7); g.fill(); g.stroke();
  }
  if (G.critter) { const cp = G.critter.mow ? G.critter.mow.root.position : G.critter.p, cx = (cp.x + world.half) * k, cy = (cp.z + world.half) * k; g.fillStyle = G.critter.kind === 'cat' ? '#d98b3a' : G.critter.kind === 'mower' ? '#c8352a' : '#e9b48e'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, (G.critter.kind === 'cat' ? 6 : 8) * (big ? 1.6 : 1), 0, 7); g.fill(); g.stroke(); }
  for (const v of G.vehicles || []) { const vp = v.pos, vx = (vp.x + world.half) * k, vy = (vp.z + world.half) * k, sz = (v.kind === 'tank' ? 4 : 3) * (big ? 1.6 : 1); g.save(); g.translate(vx, vy); g.rotate(-v.yaw); g.fillStyle = v.alive ? TEAMS[G.teamIds[v.team]].css : '#222'; g.strokeStyle = '#000'; g.lineWidth = 1; g.fillRect(-sz / 2, -sz * 0.8, sz, sz * 1.6); g.strokeRect(-sz / 2, -sz * 0.8, sz, sz * 1.6); g.restore(); }
  const x = (P0.pos.x + world.half) * k, y = (P0.pos.z + world.half) * k;
  g.save(); g.translate(x, y); g.rotate(-P0.yaw + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5; const r = big ? 9 : 6;
  g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.7, r * 0.8); g.lineTo(0, r * 0.35); g.lineTo(-r * 0.7, r * 0.8); g.closePath(); g.fill(); g.stroke(); g.restore();
}
// hold the minimap to open the big map
let miniHold = null;
mini.addEventListener('pointerdown', (e) => { e.stopPropagation(); miniHold = setTimeout(() => mini.classList.add('big'), 220); });
const miniUp = () => { clearTimeout(miniHold); mini.classList.remove('big'); };
mini.addEventListener('pointerup', miniUp); mini.addEventListener('pointercancel', miniUp); mini.addEventListener('pointerleave', miniUp);
addEventListener('keydown', (e) => { if (e.code === 'KeyM') mini.classList.add('big'); }); addEventListener('keyup', (e) => { if (e.code === 'KeyM') mini.classList.remove('big'); });
$('ammo').addEventListener('pointerdown', () => G && startReload(G.player));
$('pauseB').addEventListener('pointerdown', (e) => { e.stopPropagation(); pause(); });

// ------------------------------------------------------------ match flow
function loadWorld(mapId) {
  LEAKS.length = 0;
  for (const m of titleMen) scene.remove(m.root); titleMen = [];
  if (world) world.dispose();
  world = new World(scene, mapId, P.set.q); buildPhysicsWorld(world);
  scene.background = world.outdoor ? null : new THREE.Color(world.sky);
  scene.fog = world.outdoor ? new THREE.Fog(0xcfe3f2, 160, 700) : new THREE.Fog(world.sky, 110, 260);
  hemi.color.set(world.hemi[0]); hemi.groundColor.set(world.hemi[1]); hemi.intensity = world.hemi[2] * 1.45; sun.shadow.intensity = 0.7;
  sun.color.set(world.sunColor); sun.intensity = world.sunI;
  scene.environmentIntensity = world.outdoor ? 0.7 : 0.5;
  if (passes.bloom) passes.bloom.threshold = 1.05; renderer.toneMappingExposure = world.exposure || 1;
  aimShadow(new THREE.Vector3(0, 0, 0), world.half + 10);
}
// the sun's shadow box follows the action for crisp shadows
function aimShadow(c, r) {
  const d = world.sunDir; sun.target.position.copy(c); sun.position.copy(c).addScaledVector(d, 120);
  const sc = sun.shadow.camera; if (sc.right !== r) { Object.assign(sc, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 300 }); sc.updateProjectionMatrix(); }
  // snap to shadow texels so edges don't shimmer as you move
  const texel = (2 * r) / sun.shadow.mapSize.x; sun.target.position.x = Math.round(c.x / texel) * texel; sun.target.position.z = Math.round(c.z / texel) * texel;
  sun.position.copy(sun.target.position).addScaledVector(d, 120);
}
function startMatch() {
  const M = MODES[P.mode];
  loadWorld(P.map); clearMen();
  const others = [0, 1, 2, 3].filter((i) => i !== P.team).sort(() => Math.random() - 0.5);
  const teamIds = M.teams === 2 ? [P.team, others[0]] : [P.team, ...others];
  const diff = { easy: [3.2, 1.3, 0.3, 0.32, 1, 2.0, 0.4], normal: [2.2, 0.9, 0.55, 0.22, 1, 1.6, 0.55], hard: [1.3, 0.5, 1.0, 0.12, 1, 1.2, 0.62] }[P.set.diff];
  G = { teams: M.teams, teamIds, goal: M.goal, score: new Array(M.teams).fill(0), men: [], proj: [], time: 360, shake: 0, scoped: false, over: false, crouch: false, prone: false, nadeAim: false, recoil: 0, recoilYaw: 0, recoilBack: 0, bloom: 0,
    botSpread: diff[0], botReact: diff[1], botNade: diff[2], botWobble: diff[3], botDmg: diff[4], botRate: diff[5], botK: diff[6], elapsed: 0,
    ps: { kills: 0, deaths: 0, shots: 0, hits: 0, nadeKills: 0, rocketKills: 0, melts: 0, bestStreak: 0, classKills: {} } };
  const used = new Set();
  for (let t = 0; t < M.teams; t++) for (let i = 0; i < M.per; i++) {
    const isP = t === 0 && i === 0;
    const s = new Soldier(t, isP ? P.cls : CLASS_IDS[(Math.random() * 4) | 0], isP, isP ? P.name : botName(used), isP ? { ...P.eq, skin: P.skin } : randomCos());
    s.spawn(); G.men.push(s); if (isP) G.player = s;
  }
  spawnVehicles(); G.houseT = rnd(25, 45);
  buildMiniBase(); camState.pos.set(G.player.pos.x, G.player.pos.y + 3, G.player.pos.z - 3);
  $('feed').innerHTML = ''; scoreKey = ''; $('fps').classList.toggle('hidden', !P.set.fps); showScreen('play'); toast(`${MODES[P.mode].name}: first to ${G.goal} knockdowns`, 3);
  try { if (isTouch && !document.fullscreenElement) document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch (e) {}
}
function clearMen() { if (G) { for (const s of G.men) scene.remove(s.m.root); for (const q of G.proj) { scene.remove(q.mesh); if (q.body) removeBody(q.body); } for (const s of G.men) { if (s.m.rag) endRagdoll(s.m); if (s.mark) { scene.remove(s.mark); s.mark.material.dispose(); } } for (const v of G.vehicles || []) v.dispose(); G.vehicles = []; clearCritter(); } for (const p of FX.parts) p.sc.remove(p.obj); for (const t of FX.tracers) scene.remove(t.m); for (const d of FX.decals) scene.remove(d.m); for (const c of FX.casings) (c.sc || scene).remove(c.m); FX.parts = []; FX.tracers = []; FX.decals = []; FX.casings = []; vm.group.visible = false; }

function respawnClassRow() {
  $('deadCls').innerHTML = CLASS_IDS.map((c) => `<button class="card${c === P.cls ? ' sel' : ''}" data-cls="${c}">${CLASSES[c].name}</button>`).join('');
}
$('deadCls').addEventListener('click', (e) => { const b = e.target.closest('[data-cls]'); if (!b) return; P.cls = b.dataset.cls; save(); respawnClassRow(); AU.ui(); });

function endMatch() {
  if (G.over) return; G.over = true; IN.fire = false;
  const me = G.player, won = G.score[0] === Math.max(...G.score) && G.score.filter((v) => v === G.score[0]).length === 1;
  const st = P.stats, ps = G.ps;
  st.matches++; won ? st.wins++ : st.losses++; st.kills += ps.kills; st.deaths += ps.deaths; st.shots += ps.shots; st.hits += me.hits;
  st.headshots = (st.headshots || 0) + (ps.headshots || 0); st.nadeKills += ps.nadeKills; st.rocketKills += ps.rocketKills; st.melts += ps.melts; st.bestStreak = Math.max(st.bestStreak, ps.bestStreak); st.bestMatch = Math.max(st.bestMatch, ps.kills); st.time += G.elapsed;
  for (const [c, n] of Object.entries(ps.classKills)) st.classKills[c] = (st.classKills[c] || 0) + n;
  if (won) st.mapWins[P.map] = (st.mapWins[P.map] || 0) + 1;
  const earned = 15 + ps.kills * 4 + (won ? 40 : 0) + ps.bestStreak * 2; P.coins += earned; save();
  setTimeout(() => {
    mode = 'over'; if (document.pointerLockElement) document.exitPointerLock();
    const rows = G.men.slice().sort((a, b) => b.k - a.k || a.d - b.d).slice(0, 8);
    menu(won ? 'VICTORY' : 'DEFEAT', `
      <div class="row" style="gap:6px;margin-bottom:8px">${G.score.map((v, i) => `<div class="sc" style="background:${TEAMS[G.teamIds[i]].css};font-size:22px">${TEAMS[G.teamIds[i]].name}: ${v}</div>`).join('')}</div>
      <div class="split"><div><table class="st">
        <tr><td>Knockdowns</td><td>${ps.kills}</td></tr><tr><td>Knocked over</td><td>${ps.deaths}</td></tr>
        <tr><td>Accuracy</td><td>${ps.shots ? Math.round((me.hits / ps.shots) * 100) : 0}%</td></tr><tr><td>Best streak</td><td>${ps.bestStreak}</td></tr>
        <tr><td><b>Allowance earned</b></td><td><b>+${earned}</b></td></tr></table></div>
      <div><table class="st">${rows.map((s) => `<tr><td><b style="color:${TEAMS[G.teamIds[s.team]].css}">■</b> ${esc(s.name)}${s.isPlayer ? ' (you)' : ''}</td><td>${s.k} / ${s.d}</td></tr>`).join('')}</table></div></div>
      <div class="row" style="margin-top:12px"><button class="b go" data-act="again">Play again</button><button class="b" data-act="home">Main menu</button></div>`, false);
  }, 1400);
}

// ------------------------------------------------------------ screens and menus
function showScreen(s) {
  mode = s;
  $('title').classList.toggle('hidden', s !== 'title');
  $('hud').classList.toggle('hidden', !(s === 'play' || s === 'paused'));
  $('touch').classList.toggle('hidden', !(s === 'play' && isTouch));
  if (s !== 'play' && s !== 'paused') $('menu').classList.add('hidden');
  if (s === 'play') { $('menu').classList.add('hidden'); respawnClassRow(); }
  $('coinTag').textContent = P.coins + ' allowance';
}
function menu(title, html, closable = true) {
  const m = $('menu'); m.classList.remove('hidden');
  m.innerHTML = `<div class="box"><div class="head stencil">${title}</div>${closable ? '<button class="x" data-act="close" aria-label="Close">✕</button>' : ''}<div class="body">${html}</div></div>`;
}
function pause() {
  if (mode !== 'play') return; mode = 'paused'; IN.fire = false; if (document.pointerLockElement) document.exitPointerLock();
  $('touch').classList.add('hidden');
  menu('PAUSED', `<div class="row"><button class="b go" data-act="resume">Resume</button><button class="b" data-act="options">Options</button><button class="b" data-act="quit">Quit match</button></div><p style="font-size:14px;margin:12px 0 0">Quitting doesn't count toward your record.</p>`);
}
function playMenu() {
  const opt = (obj, key, cur) => Object.entries(obj).map(([id, o]) => `<button class="card${id === cur ? ' sel' : ''}" data-pick="${key}" data-v="${id}">${o.name}<small>${o.blurb}</small></button>`).join('');
  menu('DEPLOY', `
    <div class="lbl">Battlefield</div><div class="cards">${opt(MAPS, 'map', P.map)}</div>
    <div class="lbl">Mode</div><div class="cards">${opt(MODES, 'mode', P.mode)}</div>
    <div class="lbl">Your army</div><div class="row">${TEAMS.map((t, i) => `<button class="sw${i === P.team ? ' sel' : ''}" style="background:${t.css}" data-pick="team" data-v="${i}" aria-label="${t.name}"></button>`).join('')}<span style="margin-left:6px">${TEAMS[P.team].name}</span></div>
    <div class="lbl">Your piece</div><div class="cards">${opt(CLASSES, 'cls', P.cls)}</div>
    <div class="lbl">Enemy skill</div><div class="row">${['easy', 'normal', 'hard'].map((d) => `<button class="b${d === P.set.diff ? ' on' : ''}" data-pick="diff" data-v="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="b go stencil" data-act="start">DEPLOY</button></div>`);
}
function recordMenu() {
  const s = P.stats, acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0, kd = (s.kills / Math.max(1, s.deaths)).toFixed(2);
  const hrs = Math.floor(s.time / 3600), mins = Math.floor((s.time % 3600) / 60);
  menu('SERVICE RECORD', `<div class="split"><table class="st">
    <tr><td>Matches</td><td>${s.matches}</td></tr><tr><td>Wins / losses</td><td>${s.wins} / ${s.losses}</td></tr><tr><td>Win rate</td><td>${s.matches ? Math.round((s.wins / s.matches) * 100) : 0}%</td></tr>
    <tr><td>Knockdowns</td><td>${s.kills}</td></tr><tr><td>Knocked over</td><td>${s.deaths}</td></tr><tr><td>K/D</td><td>${kd}</td></tr>
    <tr><td>Accuracy</td><td>${acc}%</td></tr><tr><td>Time served</td><td>${hrs}h ${mins}m</td></tr></table>
    <table class="st"><tr><td>Best streak</td><td>${s.bestStreak}</td></tr><tr><td>Most in one match</td><td>${s.bestMatch}</td></tr>
    <tr><td>Headshots</td><td>${s.headshots || 0}</td></tr><tr><td>Shots per hit</td><td>${s.hits ? (s.shots / s.hits).toFixed(1) : '-'}</td></tr><tr><td>Grenade knockdowns</td><td>${s.nadeKills}</td></tr><tr><td>Bazooka blasts</td><td>${s.rocketKills}</td></tr><tr><td>Plastic melted</td><td>${s.melts}</td></tr>
    ${CLASS_IDS.map((c) => `<tr><td>As ${CLASSES[c].name}</td><td>${s.classKills[c] || 0}</td></tr>`).join('')}
    ${Object.keys(MAPS).map((m) => `<tr><td>Wins in the ${MAPS[m].name}</td><td>${s.mapWins[m] || 0}</td></tr>`).join('')}</table></div>`);
}
function optionsMenu(back) {
  menu('OPTIONS', `
    <div class="lbl">Look speed: <span id="sensV">${P.set.sens.toFixed(1)}</span></div><input type="range" min="0.3" max="2.5" step="0.1" value="${P.set.sens}" id="sens">
    <div class="lbl">Settings</div><div class="row">
      <button class="b${P.set.assist ? ' on' : ''}" data-tog="assist">Aim assist ${P.set.assist ? 'on' : 'off'}</button>
      <button class="b${P.set.sound ? ' on' : ''}" data-tog="sound">Sound ${P.set.sound ? 'on' : 'off'}</button>
      <button class="b${P.set.shadows ? ' on' : ''}" data-tog="shadows">Shadows ${P.set.shadows ? 'on' : 'off'}</button>
      <button class="b${P.set.fps ? ' on' : ''}" data-tog="fps">Show FPS ${P.set.fps ? 'on' : 'off'}</button></div>
    <div class="lbl">View</div><div class="row">${[['fp', 'First person'], ['tp', 'Over the shoulder']].map(([k, n]) => `<button class="b${P.set.view === k ? ' on' : ''}" data-view="${k}">${n}</button>`).join('')}</div>
    <div class="lbl">Graphics</div><div class="row">${[['low', 'Low (fastest)'], ['medium', 'Medium (default)'], ['high', 'High (strong PC)']].map(([k, n]) => `<button class="b${P.set.q === k ? ' on' : ''}" data-q="${k}">${n}</button>`).join('')}</div>
    <p style="font-size:14px;margin:12px 0 0">Phone: left thumb anywhere on the left moves; drag the right side (or the FIRE button) to aim. Hold the minimap for the big map.<br>Computer: WASD, mouse, click to fire, Space jump, F smack, G grenade, R reload, right-click scope, C view, M map, P pause.</p>
    ${back ? '<div class="row" style="margin-top:12px"><button class="b go" data-act="resume">Back to battle</button></div>' : ''}`);
  $('sens').addEventListener('input', (e) => { P.set.sens = +e.target.value; $('sensV').textContent = P.set.sens.toFixed(1); save(); });
}

// Barracks: a turntable of your own soldier with cosmetics
let prev = null;
function barracksMenu(slot = 'head') {
  const items = COSMETICS[slot];
  menu('BARRACKS', `<div class="split">
    <div><canvas id="preview"></canvas><div class="lbl">Callsign</div><input class="t" id="nameI" maxlength="16" value="${esc(P.name)}"></div>
    <div><div class="row">${COS_SLOTS.map(([k, n]) => `<button class="b${k === slot ? ' on' : ''}" data-slot="${k}">${n}</button>`).join('')}</div>
    <div class="lbl">${P.coins} allowance to spend</div>
    <div class="cards">${items.map((it) => { const own = P.owned[slot].includes(it.id), eq = P.eq[slot] === it.id;
      return `<button class="card${eq ? ' sel' : ''}${own ? '' : ' lock'}" data-cos="${it.id}" data-slot2="${slot}">${it.name}<small>${eq ? 'Equipped' : own ? 'Owned · tap to wear' : it.price + ' allowance'}</small></button>`; }).join('')}</div>
    <div class="lbl">Preview piece</div><div class="row">${CLASS_IDS.map((c) => `<button class="b${c === P.cls ? ' on' : ''}" data-pcls="${c}">${CLASSES[c].name}</button>`).join('')}</div></div></div>`);
  $('nameI').addEventListener('input', (e) => { P.name = e.target.value.trim().slice(0, 16) || 'Recruit'; save(); });
  startPreview();
}
function startPreview() {
  const cv = $('preview'); if (!cv) return;
  if (!prev) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(); sc.environment = scene.environment; sc.add(new THREE.HemisphereLight(0xffffff, 0x664422, 1.2)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(2, 4, 3); sc.add(d);
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 20); cam.position.set(0, 0.75, 2.6); cam.lookAt(0, 0.5, 0);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.7 })); floor.position.y = -0.025; sc.add(floor);
    prev = { r, sc, cam, man: null, key: '' };
  }
  const key = JSON.stringify([P.eq, P.cls, P.team]);
  if (prev.key !== key) { if (prev.man) prev.sc.remove(prev.man.root); prev.man = buildSoldier(TEAMS[P.team].color, P.cls, { ...P.eq, skin: P.skin }); prev.sc.add(prev.man.root); prev.key = key; }
  // move the renderer's canvas into the menu's slot
  const host = cv; host.replaceWith(prev.r.domElement); prev.r.domElement.id = 'preview';
}
function renderPreview(t) {
  if (!prev || !document.body.contains(prev.r.domElement)) return;
  const c = prev.r.domElement, w = c.clientWidth; if (!w) return;
  if (c.width !== Math.round(w * Math.min(2, devicePixelRatio))) { prev.r.setPixelRatio(Math.min(2, devicePixelRatio)); prev.r.setSize(w, w, false); }
  prev.man.root.rotation.y = t * 0.6; prev.r.render(prev.sc, prev.cam);
}

$('menu').addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t) return; AU.init(); AU.ui();
  const act = t.dataset.act;
  if (act === 'close') { if (mode === 'paused') resume(); else if (mode === 'over') goHome(); else $('menu').classList.add('hidden'); return; }
  if (act === 'start') { startMatch(); return; }
  if (act === 'resume') { resume(); return; }
  if (act === 'options') { optionsMenu(mode === 'paused'); return; }
  if (act === 'quit' || act === 'home') { goHome(); return; }
  if (act === 'again') { startMatch(); return; }
  if (t.dataset.pick) { const k = t.dataset.pick, v = t.dataset.v; if (k === 'team') P.team = +v; else if (k === 'diff') P.set.diff = v; else P[k] = v; save(); playMenu(); return; }
  if (t.dataset.tog) { const k = t.dataset.tog; P.set[k] = !P.set[k]; save(); if (k === 'fps') $('fps').classList.toggle('hidden', !P.set.fps); if (k === 'shadows') { renderer.shadowMap.enabled = P.set.shadows; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); } optionsMenu(mode === 'paused'); return; }
  if (t.dataset.view) { P.set.view = t.dataset.view; save(); optionsMenu(mode === 'paused'); return; }
  if (t.dataset.q) { P.set.q = t.dataset.q; save(); setupPost(); resize(); const m = world.mapId; if (!G) titleScene(); else toast('Grass and dust change next match', 2); optionsMenu(mode === 'paused'); return; }
  if (t.dataset.slot) { barracksMenu(t.dataset.slot); return; }
  if (t.dataset.pcls) { P.cls = t.dataset.pcls; save(); barracksMenu(document.querySelector('[data-slot].on')?.dataset.slot || 'head'); return; }
  if (t.dataset.cos) {
    const slot = t.dataset.slot2, id = t.dataset.cos, it = COSMETICS[slot].find((x) => x.id === id);
    if (!P.owned[slot].includes(id)) { if (P.coins < it.price) { t.querySelector('small').textContent = `Need ${it.price - P.coins} more`; return; } P.coins -= it.price; P.owned[slot].push(id); }
    P.eq[slot] = id; save(); barracksMenu(slot); $('coinTag').textContent = P.coins + ' allowance'; return;
  }
});
$('title').addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t) return; AU.init(); AU.ui();
  if (t.dataset.act === 'full') { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen?.(); else (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d)?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => toast('Full screen is blocked here - open the game file in your browser', 3)); return; }
  ({ play: playMenu, barracks: () => barracksMenu(), record: recordMenu, options: () => optionsMenu(false) })[t.dataset.act]?.();
});
function resume() { $('menu').classList.add('hidden'); showScreen('play'); }
function goHome() { clearMen(); G = null; titleScene(); showScreen('title'); }

// title backdrop: a squad set up on the living-room rug, camera slowly circling
function titleScene() {
  loadWorld('living'); aimShadow(new THREE.Vector3(0, 0, 0), 14);
  const spots = [[-2.2, -1.2, 0, 'rifle'], [-3.4, 0.4, 0, 'bazooka'], [-3, -2.6, 0, 'sniper'], [-4.6, -1.4, 0, 'flamer'], [-1.6, 1.4, 0, 'rifle'], [-5.2, 1.2, 0, 'rifle'],
    [2.4, 0.8, 1, 'rifle'], [3.6, -0.6, 1, 'bazooka'], [3.0, 2.4, 1, 'rifle'], [4.8, 1.0, 1, 'sniper'], [2.2, -2.2, 1, 'flamer'], [5.4, -1.8, 1, 'rifle']];
  for (const [x, z, t, c] of spots) { const m = buildSoldier(TEAMS[t ? 1 : P.team === 1 ? 0 : P.team].color, c, t ? randomCos() : { ...P.eq, skin: P.skin }); m.root.position.set(x, 0.12, z); m.root.rotation.y = t ? -Math.PI / 2 + rnd(-0.4, 0.4) : Math.PI / 2 + rnd(-0.4, 0.4); scene.add(m.root); titleMen.push(m); }
}

// ------------------------------------------------------------ main loop
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; tick(dt, now / 1000);
}
function tick(dt, t) {
  world.update(dt, t); passes.grade.uniforms.uTime.value = t;
  if (mode === 'cu') { vm.group.visible = false; renderFrame(dt); return; }
  if (mode === 'title' || (!G && mode !== 'play')) {
    const a = t * 0.05; camera.position.set(Math.sin(a) * 9, 1.1 + Math.sin(t * 0.2) * 0.25, Math.cos(a) * 9); camera.lookAt(0, 0.55, 0);
    if (camera.fov !== 46) { camera.fov = 46; camera.updateProjectionMatrix(); }
    if (passes.dof) { passes.dof.enabled = true; passes.dof.uniforms.focus.value = 9; passes.dof.uniforms.aperture.value = 0.004; }
    vm.group.visible = false; passes.grade.uniforms.uHurt.value = 0; updateFX(dt); dynRes(dt); renderFrame(dt); renderPreview(t); return;
  }
  if (mode === 'play' && G && !G.over) {
    G.time -= dt; G.elapsed += dt; if (G.time <= 0) endMatch();
    for (const s of G.men) {
      s.lastHurt += dt; s.lastFired += dt; if (s.cool > 0) s.cool -= dt; if (s.meleeCool > 0) s.meleeCool -= dt; if (s.protect > 0) s.protect -= dt;
      if (s.reload > 0 && (s.reload -= dt) <= 0) { s.reload = 0; s.ammo = s.w.mag; }
      if (s.alive) { if (s.lastHurt > 5 && s.hp < s.def.hp) s.hp = Math.min(s.def.hp, s.hp + 22 * dt); if (s.anim) updateAnim(s, dt); else if (s.inVehicle) { const sw = s.inVehicle.v.seatWorld(s.inVehicle.seat); s.pos.set(sw.x, sw.y - 0.35, sw.z); if (!s.isPlayer) botVehicle(s, dt); } else if (s.down) updateDown(s, dt); else if (!s.isPlayer) { if (!botVehicle(s, dt)) botThink(s, dt); } }
      else { updateDying(s, dt); if ((s.respawn -= dt) <= 0) { if (s.m.rag) { for (const p of s.m.rag.parts) p.o.visible = true; endRagdoll(s.m); } if (s.isPlayer && s.cls !== P.cls) { s.cls = P.cls; scene.remove(s.m.root); s.m = buildSoldier(TEAMS[G.teamIds[s.team]].color, s.cls, { ...P.eq, skin: P.skin }); scene.add(s.m.root); s.def = CLASSES[s.cls]; s.w = WEAPONS[s.def.weapon]; G.scoped = false; } s.spawn(); } }
    }
    updatePlayer(dt);
    updateVehicles(dt); botRideAlong(dt); updateCritter(dt);
    stepPhysics(dt);
    postPhysicsVehicles(dt);
    updateProj(dt);
  }
  if (G) {
    for (const s of G.men) { poseMan(s); placeMarker(s); }
    if (mode === 'play' || mode === 'paused' || mode === 'over') updateCamera(mode === 'play' ? dt : 0.0001);
    if (mode === 'play') { hudUpdate(dt); if ((G.miniT = (G.miniT || 0) + dt) > 0.066) { G.miniT = 0; drawMini(); } }
  }
  if (G) { aimShadow(G.player.pos, 34); const hp = G.player.alive ? G.player.hp / G.player.def.hp : 1; passes.grade.uniforms.uHurt.value += ((hp < 0.35 ? (0.35 - hp) * 2.2 : 0) - passes.grade.uniforms.uHurt.value) * Math.min(1, dt * 5); }
  updateFX(dt); updateLeaks(dt); dynRes(dt);
  renderFrame(dt);
}
initPhysics().then(() => { titleScene(); showScreen('title'); requestAnimationFrame(loop); });
window.__pf = { LEAKS, mower: () => startMower(), critter: (k) => startCritter(k), portrait(team, cls, head, skin) { for (const m of titleMen) m.root.visible = false; const m = buildSoldier(TEAMS[team].color, cls, { head, skin }); m.root.position.set(0, 0.12, 8); m.root.rotation.y = 0; scene.add(m.root); titleMen.push(m); return true; }, cam(x, y, z, tx, ty, tz) { mode = 'cu'; camera.fov = 40; camera.updateProjectionMatrix(); camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); }, renderer, DYN,  THREE, vm, IN, use: () => useVehicle(G.player), knockDown: (s, v) => knockDown(s, new THREE.Vector3(...v)), explode: (x, y, z, s) => explosion(new THREE.Vector3(x, y, z), s, 'nade'), PH,  closeup() { mode = 'cu'; camera.position.set(-6.2, 0.75, -1.2); camera.lookAt(-7.5, 0.5, -3); }, get G() { return G; }, startMatch, P, step(n) { for (let i = 0; i < n; i++) tick(0.033, i * 0.033); } };

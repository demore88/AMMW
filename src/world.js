// Army Men: Microplastic Warfare — the three household battlefields. 1 unit ≈ one army man's height (about 5 cm).
// Collision stays simple (boxes); everything you see is detailed separately.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as T from './tex.js';

const rnd = T.rnd;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const at = (m, p) => { m.position.copy(p); return m; };
// identical materials are shared so the props can be merged into a few draw calls
const MATS = new Map();
const mkey = (t, o) => t + JSON.stringify(o, (k, v) => (v && v.isTexture ? 'T' + v.uuid : v && v.isColor ? v.getHex() : v));
const std = (o) => { const k = mkey('s', o); if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial(o)); return MATS.get(k); };
let HIGH = false;
const phys = (o) => { if (HIGH) { const k = mkey('p', o); if (!MATS.has(k)) MATS.set(k, new THREE.MeshPhysicalMaterial(o)); return MATS.get(k); } const c = { ...o }; for (const k of ['clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'sheenColor', 'transmission']) delete c[k]; return std(c); };
const toyPlastic = (c) => phys({ color: c, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2 });
const metal = (c = 0xc8ccd2, r = 0.25) => std({ color: c, metalness: 1, roughness: r });
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

function letterTex(letter, col) { return T.label((g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 22; g.strokeRect(26, 26, w - 52, h - 52); g.fillStyle = '#fff'; g.font = '900 330px Nunito,Arial Black,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, w / 2, h / 2 + 18); }, 512, 512); }
function cerealTex() { return T.label((g, w, h) => { g.fillStyle = '#efc13a'; g.fillRect(0, 0, w, h); g.fillStyle = '#d3392b'; g.fillRect(0, 50, w, 150); g.fillStyle = '#fff'; g.font = '900 104px Nunito,Arial Black,sans-serif'; g.textAlign = 'center'; g.fillText('CRUNCH', w / 2, 160); g.font = '900 40px Nunito,sans-serif'; g.fillStyle = '#7a3b12'; g.fillText('HONEY OAT RINGS', w / 2, 250);
  const bowl = g.createLinearGradient(0, 330, 0, 470); bowl.addColorStop(0, '#fff'); bowl.addColorStop(1, '#9ab8d8'); g.fillStyle = bowl; g.beginPath(); g.ellipse(w / 2, 360, 170, 40, 0, 0, Math.PI); g.lineTo(w / 2 - 120, 470); g.lineTo(w / 2 + 120, 470); g.fill();
  for (let i = 0; i < 30; i++) { g.strokeStyle = '#c47a1e'; g.lineWidth = 13; g.beginPath(); g.arc(w / 2 + rnd(-150, 150), 340 + rnd(-30, 25), 16, 0, 7); g.stroke(); } }, 512, 512); }
function canTex(col, word) { return T.label((g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, h * 0.32, w, h * 0.36); g.fillStyle = col; g.font = '900 64px Nunito,Arial Black,sans-serif'; g.textAlign = 'center'; g.fillText(word, w * 0.25, h * 0.58); g.fillText(word, w * 0.75, h * 0.58); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8); }, 512, 256); }
function tvTex() { return T.label((g, w, h) => { const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#3a8fe0'); s.addColorStop(0.65, '#9fd4f5'); s.addColorStop(0.66, '#4fa83a'); s.addColorStop(1, '#2f7a25'); g.fillStyle = s; g.fillRect(0, 0, w, h); g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(w * 0.78, h * 0.22, 40, 0, 7); g.fill();
  for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(255,255,255,.9)'; const x = rnd(40, w - 120), y = rnd(30, h * 0.4); for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + k * 26, y + (k % 2) * -10, 24, 0, 7); g.fill(); } }
  g.fillStyle = '#2b6a22'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(rnd(0, w), h * 0.68, rnd(30, 70), Math.PI, 0); g.fill(); } }, 512, 288); }
function paintingTex(seed) { return T.label((g, w, h) => { const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, seed ? '#f2b36b' : '#7fb6e0'); sky.addColorStop(1, seed ? '#f6e2b5' : '#e4eef2'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
  for (let l = 0; l < 3; l++) { g.fillStyle = ['#5f7d55', '#45664a', '#2f4d38'][l]; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 16) g.lineTo(x, h * (0.45 + l * 0.15) + Math.sin(x * 0.02 + l * 2 + seed) * 30); g.lineTo(w, h); g.fill(); } }, 512, 384); }

export class World {
  constructor(scene, mapId, quality = 'medium') {
    this.scene = scene; this.boxes = []; this.group = new THREE.Group(); scene.add(this.group);
    MATS.clear(); this.mapId = mapId; this.q = quality; this.anim = []; this.lights = []; HIGH = quality === 'high';
    this.sunDir = V(0.5, 0.85, 0.35).normalize(); this.sunColor = 0xfff0d8; this.sunI = 2.6; this.hemi = [0xfdf6ea, 0x6b5a40, 0.75];
    ({ living: buildLiving, kitchen: buildKitchen, backyard: buildBackyard })[mapId](this);
    this.mergeStatic();
    this.buildNav();
  }
  // ---- building
  box(x, z, w, d, h, opt = {}) {
    const y0 = opt.y0 || 0;
    const b = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y0, top: y0 + h, solid: opt.solid !== false };
    if (b.solid) this.boxes.push(b);
    if (opt.mat) { const r = opt.round ? Math.min(opt.round, w / 2.05, h / 2.05, d / 2.05) : 0; const m = this.add(new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), opt.mat), x, y0 + h / 2, z); m.castShadow = opt.shadow !== false; b.mesh = m; }
    return b;
  }
  solid(x, z, w, d, h, y0 = 0) { return this.box(x, z, w, d, h, { y0 }); }
  add(obj, x = 0, y = 0, z = 0) { obj.position.set(x, y, z); obj.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow !== false && !o.userData.noShadow; o.receiveShadow = true; } }); this.group.add(obj); return obj; }
  mesh(geo, mat, x, y, z, rot) { const m = new THREE.Mesh(geo, mat); if (rot) m.rotation.set(...rot); return this.add(m, x, y, z); }
  floor(size, mat) {
    this.size = size; this.half = size / 2;
    const g = new THREE.PlaneGeometry(size * 1.6, size * 1.6); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = false; this.group.add(m);
  }
  walls(h, mat, trim = 0xf2ede2) {
    const s = this.half + 1, L = this.size + 4, tm = std({ color: trim, roughness: 0.5 });
    const D = this.doorway, segs = [[0, -s, L, 2], [0, s, L, 2], [s, 0, 2, L]];
    if (D) { const z0 = D.z - D.w / 2, z1 = D.z + D.w / 2, a = -s - 2, c = s + 2;
      segs.push([-s, (a + z0) / 2, 2, z0 - a], [-s, (z1 + c) / 2, 2, c - z1]);
      this.box(-s, D.z, 2, D.w, h - D.h, { y0: D.h }); this.mesh(new THREE.BoxGeometry(2, h - D.h, D.w), mat, -s, D.h + (h - D.h) / 2, D.z).castShadow = false;
      const fr = std({ color: trim, roughness: 0.45 }); for (const zz of [z0, z1]) this.mesh(new THREE.BoxGeometry(2.6, D.h, 1.2), fr, -s, D.h / 2, zz); this.mesh(new THREE.BoxGeometry(2.6, 1.4, D.w + 2.4), fr, -s, D.h, D.z);
      // the hallway beyond: floor, walls and a dim far end
      const hall = std({ color: 0x8a8070, roughness: 0.9 }), hw = D.w + 10;
      this.mesh(new THREE.BoxGeometry(40, 0.2, hw), std({ color: 0x7a5434, roughness: 0.6 }), -s - 21, -0.1, D.z).castShadow = false;
      for (const zz of [D.z - hw / 2, D.z + hw / 2]) this.mesh(new THREE.BoxGeometry(40, h, 1), hall, -s - 21, h / 2, zz).castShadow = false;
      this.mesh(new THREE.BoxGeometry(1, h, hw), std({ color: 0x5a5448, roughness: 0.9 }), -s - 41, h / 2, D.z).castShadow = false;
    } else segs.push([-s, 0, 2, L]);
    for (const [x, z, w, d] of segs) {
      const b = this.box(x, z, w, d, h, {}); const m = this.mesh(new THREE.BoxGeometry(w, h, d), mat, x, h / 2, z); m.castShadow = false;
      if (trim) { const bb = this.mesh(new RoundedBoxGeometry(w ? w - (w > 3 ? 0 : 0) : w, 2.2, d, 2, 0.3), tm, x, 1.1, z); bb.scale.set(w > 3 ? 1 : 1.25, 1, d > 3 ? 1 : 1.25); bb.castShadow = false; }
    }
  }
  window(x, y, z, w, h, axis, shaftDir) { // glowing window + god-ray shafts + dust
    const frame = std({ color: 0xf4f0e6, roughness: 0.5 }), glass = std({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 2.4, roughness: 0.2 });
    const grp = new THREE.Group(); const along = axis === 'x';
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass); grp.add(pane);
    for (const t of [-0.5, 0, 0.5]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.9, h + 0.9, 0.9), frame); v.position.x = t * w; grp.add(v); const hz = new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, 0.9, 0.9), frame); hz.position.y = t * h; grp.add(hz); }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 4, 0.8, 3), frame); sill.position.set(0, -h / 2 - 0.6, 1); grp.add(sill);
    grp.rotation.y = along ? 0 : Math.PI / 2 * (x > 0 ? -1 : 1); if (along && z > 0) grp.rotation.y = Math.PI;
    this.add(grp, x, y, z); grp.traverse((o) => { o.castShadow = false; });
    return;
    // light shafts: long additive planes leaning into the room
    const shaftTex = T.label((g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,240,200,.55)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); const sg = g.createLinearGradient(0, 0, W, 0); sg.addColorStop(0, 'rgba(0,0,0,1)'); sg.addColorStop(0.2, 'rgba(0,0,0,0)'); sg.addColorStop(0.8, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = sg; g.fillRect(0, 0, W, H); }, 64, 256);
    const sm = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, opacity: 0.45 });
    const len = 90;
    for (let i = 0; i < 5; i++) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w / 3.2, len), sm); pl.userData.noShadow = true; pl.castShadow = false; pl.receiveShadow = false;
      const off = (i / 4 - 0.5) * w * 0.85, start = along ? V(x + off, y, z) : V(x, y, z + off);
      const dir = shaftDir.clone().normalize(); pl.position.copy(start).addScaledVector(dir, len / 2);
      pl.quaternion.setFromUnitVectors(V(0, -1, 0), dir.clone().negate()); pl.rotateY(rnd(-0.4, 0.4) + (along ? 0 : Math.PI / 2));
      this.group.add(pl);
    }
    // dust floating in the sunlight
    const N = this.q === 'low' ? 0 : this.q === 'medium' ? 120 : 260, pos = new Float32Array(N * 3), dir = shaftDir.clone().normalize();
    for (let i = 0; i < N; i++) { const t = rnd(5, 60), off = rnd(-w / 2, w / 2); const p = (along ? V(x + off, y + rnd(-h / 2, h / 2), z) : V(x, y + rnd(-h / 2, h / 2), z + off)).addScaledVector(dir, t); pos.set([p.x, p.y, p.z], i * 3); }
    if (N) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, map: T.softSprite('rgba(255,245,215,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })); this.group.add(pts);
      this.anim.push((dt, t) => { const a = g.attributes.position.array; for (let i = 0; i < N; i++) { a[i * 3 + 1] += Math.sin(t * 0.5 + i) * dt * 0.15; a[i * 3] += Math.cos(t * 0.3 + i * 1.7) * dt * 0.12; } g.attributes.position.needsUpdate = true; }); }
  }
  // bake every still mesh into one draw call per material (hundreds of props -> a few dozen draws)
  mergeStatic() {
    this.group.updateMatrixWorld(true);
    const buckets = new Map(), victims = [];
    this.group.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.noShadow || Array.isArray(o.material) || o.material.transparent || o.material.blending !== THREE.NormalBlending) return;
      if (o.material.side === THREE.DoubleSide && !o.castShadow) return;
      const key = o.material.uuid + (o.castShadow ? 's' : 'n');
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
      buckets.get(key).geos.push(g); victims.push(o);
    });
    for (const o of victims) o.parent.remove(o);
    for (const b of buckets.values()) { const g = mergeGeometries(b.geos, false); if (!g) continue; g.computeBoundingSphere(); const m = new THREE.Mesh(g, b.mat); m.castShadow = b.cast; m.receiveShadow = true; m.matrixAutoUpdate = false; this.group.add(m); }
  }
  // ---- queries (shared by player, bots, bullets)
  groundAt(x, z, y, r = 0.22) {
    let g = 0;
    for (const b of this.boxes) if (b.top <= y + 0.55 && b.top > g && x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) g = b.top;
    return g;
  }
  blocked(x, z, y, r = 0.3) {
    const h = this.half - 0.3; if (x < -h || x > h || z < -h || z > h) return true;
    for (const b of this.boxes) {
      if (b.top <= y + 0.55 || b.y0 >= y + 0.95) continue;
      const cx = Math.max(b.minX, Math.min(x, b.maxX)), cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
    }
    return false;
  }
  ray(o, d, maxT) {
    let best = maxT; this.lastBox = null;
    for (const b of this.boxes) {
      let t0 = 0, t1 = best, ok = true;
      for (const [oo, dd, mn, mx] of [[o.x, d.x, b.minX, b.maxX], [o.y, d.y, b.y0, b.top], [o.z, d.z, b.minZ, b.maxZ]]) {
        if (Math.abs(dd) < 1e-9) { if (oo < mn || oo > mx) { ok = false; break; } continue; }
        let ta = (mn - oo) / dd, tb = (mx - oo) / dd; if (ta > tb) [ta, tb] = [tb, ta];
        if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best) { best = t0; this.lastBox = b; }
    }
    if (d.y < -1e-6) { const tg = -o.y / d.y; if (tg >= 0 && tg < best) { best = tg; this.lastBox = null; } }
    return best;
  }
  rayNormal(p) { // which face did we hit (for decals)
    let best = null, bd = 0.08;
    for (const b of this.boxes) { if (p.x < b.minX - bd || p.x > b.maxX + bd || p.z < b.minZ - bd || p.z > b.maxZ + bd || p.y < b.y0 - bd || p.y > b.top + bd) continue;
      for (const [d, n] of [[Math.abs(p.x - b.minX), V(-1, 0, 0)], [Math.abs(p.x - b.maxX), V(1, 0, 0)], [Math.abs(p.z - b.minZ), V(0, 0, -1)], [Math.abs(p.z - b.maxZ), V(0, 0, 1)], [Math.abs(p.y - b.top), V(0, 1, 0)], [Math.abs(p.y - b.y0), V(0, -1, 0)]]) if (d < bd) { bd = d; best = n; } }
    return best || V(0, 1, 0);
  }
  inBox(p) { for (const b of this.boxes) if (p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ && p.y > b.y0 && p.y < b.top) return b; return null; }
  update(dt, t) { for (const f of this.anim) f(dt, t); }
  // ---- floor-level navigation grid for the bots
  buildNav() {
    const N = this.size, half = this.half; this.N = N; this.nav = new Uint8Array(N * N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const x = -half + i + 0.5, z = -half + j + 0.5; this.nav[j * N + i] = this.blocked(x, z, this.groundAt(x, z, 0.0, 0.5), 0.55) ? 1 : 0; }
  }
  cell(x, z) { return [Math.max(0, Math.min(this.N - 1, Math.floor(x + this.half))), Math.max(0, Math.min(this.N - 1, Math.floor(z + this.half)))]; }
  path(ax, az, bx, bz) {
    const N = this.N, nav = this.nav; let [si, sj] = this.cell(ax, az), [ti, tj] = this.cell(bx, bz);
    if (nav[tj * N + ti]) { let found = false; for (let r = 1; r < 8 && !found; r++) for (let di = -r; di <= r && !found; di++) for (let dj = -r; dj <= r; dj++) { const i = ti + di, j = tj + dj; if (i >= 0 && j >= 0 && i < N && j < N && !nav[j * N + i]) { ti = i; tj = j; found = true; break; } } if (!found) return null; }
    const g = new Float32Array(N * N).fill(1e9), from = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
    const heap = []; const push = (n, f) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
    const s = sj * N + si, t = tj * N + ti; g[s] = 0; push(s, 0); let it = 0;
    while (heap.length && it++ < 9000) {
      const n = pop(); if (n === t) break; if (closed[n]) continue; closed[n] = 1; const i = n % N, j = (n / N) | 0;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) continue; const m = b * N + a; if (nav[m] || closed[m]) continue; if (di && dj && (nav[j * N + a] || nav[b * N + i])) continue; const ng = g[n] + (di && dj ? 1.414 : 1); if (ng < g[m]) { g[m] = ng; from[m] = n; push(m, ng + Math.hypot(a - ti, b - tj)); } }
    }
    if (from[t] < 0 && t !== s) return null;
    const pts = []; let n = t; while (n !== s && n >= 0) { pts.push(new THREE.Vector2(-this.half + (n % N) + 0.5, -this.half + ((n / N) | 0) + 0.5)); n = from[n]; }
    pts.reverse(); const out = []; for (let k = 0; k < pts.length; k++) if (k === pts.length - 1 || k % 3 === 2) out.push(pts[k]); return out;
  }
  randomOpen(minX, maxX, minZ, maxZ) { for (let k = 0; k < 200; k++) { const x = rnd(minX, maxX), z = rnd(minZ, maxZ); const [i, j] = this.cell(x, z); if (!this.nav[j * this.N + i]) return V(x, 0, z); } return V(0, 0, 0); }
  spawnZone(team, teams) {
    const h = this.half - 6;
    if (teams === 2) return team === 0 ? [-h, -h + 8, -16, 16] : [h - 8, h, -16, 16];
    const zx = team % 2 ? 1 : -1, zz = team < 2 ? -1 : 1, zh = this.spawnZ || h;
    return [zx < 0 ? -h : h - 9, zx < 0 ? -h + 9 : h, zz < 0 ? -zh : zh - 9, zz < 0 ? -zh + 9 : zh];
  }
  dispose() { this.scene.remove(this.group); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); if (this.sky) this.scene.remove(this.sky); }
}

function both(fn) { fn(1); fn(-1); }

// ------------------------------------------------------------------ shared props
function upholstered(w, x, z, W, D, seatH, backH, armH, col, back = 'n') {
  const f = T.fabric(col, 3), mat = phys({ ...f, color: 0xffffff, roughness: 0.92, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.4) });
  const dark = phys({ ...T.fabric(col, 3), color: 0xd8d8d8, roughness: 0.95, sheen: 0.4 });
  const leg = std({ color: 0x3b2716, roughness: 0.45 });
  const sx = back === 'n' || back === 's' ? 1 : 0; // seat runs along x?
  const bz = back === 'n' ? -1 : back === 's' ? 1 : 0, bx = back === 'w' ? -1 : back === 'e' ? 1 : 0;
  const len = sx ? W : D, dep = sx ? D : W;
  w.solid(x, z, W, D, seatH);
  w.mesh(new RoundedBoxGeometry(W, seatH * 0.55, D, 3, 1.2), dark, x, seatH * 0.36 + 1.2, z);
  const nC = Math.max(1, Math.round(len / 18));
  for (let i = 0; i < nC; i++) { const off = (i - (nC - 1) / 2) * (len - 6) / nC, cw = (len - 6) / nC - 0.6;
    const g = new RoundedBoxGeometry(sx ? cw : dep - 5, seatH * 0.38, sx ? dep - 5 : cw, 4, 1.6);
    w.mesh(g, mat, x + (sx ? off : bx * -1.5), seatH * 0.82, z + (sx ? bz * -1.5 : off));
    const bg = new RoundedBoxGeometry(sx ? cw : 4.5, backH - seatH - 1, sx ? 4.5 : cw, 4, 1.8); // back cushions
    w.mesh(bg, mat, x + (sx ? off : bx * (dep / 2 - 4.5)), (seatH + backH) / 2 + 1, z + (sx ? bz * (dep / 2 - 4.5) : off), [sx ? -bz * 0.12 : 0, 0, sx ? 0 : bx * 0.12]);
  }
  // back frame and rolled arms
  w.solid(x + bx * (dep / 2 - 1.5), z + bz * (dep / 2 - 1.5), sx ? W : 3, sx ? 3 : D, backH);
  w.mesh(new RoundedBoxGeometry(sx ? W : 3, backH, sx ? 3 : D, 3, 1.3), dark, x + bx * (dep / 2 - 1.5), backH / 2, z + bz * (dep / 2 - 1.5));
  for (const s of [-1, 1]) {
    const ax = x + (sx ? s * (W / 2 - 2) : 0), az = z + (sx ? 0 : s * (D / 2 - 2));
    w.solid(ax, az, sx ? 4 : W, sx ? D : 4, armH);
    w.mesh(new RoundedBoxGeometry(sx ? 4 : W, armH - 2, sx ? D : 4, 3, 1.5), mat, ax, (armH - 2) / 2 + 0.6, az);
    const roll = new THREE.CylinderGeometry(2.4, 2.4, sx ? D : W, 20); w.mesh(roll, mat, ax, armH - 1.4, az, sx ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2]);
    for (const t of [-1, 1]) w.mesh(new THREE.CylinderGeometry(0.7, 0.5, 1.3, 10), leg, ax + (sx ? 0 : t * (W / 2 - 2)), 0.65, az + (sx ? t * (D / 2 - 2) : 0));
  }
}
function pottedPlant(w, x, z, potH, leafCol = 0x2f6b2a, flower = null) {
  w.solid(x, z, potH * 1.15, potH * 1.15, potH);
  const pot = std({ color: 0xb5562f, roughness: 0.85 }), soil = std({ color: 0x3b2a1a, roughness: 1 });
  const r = potH * 0.58;
  w.mesh(lathe([[0, 0], [r * 0.72, 0], [r * 0.78, potH * 0.1], [r * 0.95, potH * 0.86], [r * 1.05, potH * 0.88], [r * 1.05, potH], [r * 0.95, potH], [r * 0.9, potH * 0.93], [0, potH * 0.93]]), pot, x, 0, z);
  w.mesh(new THREE.CircleGeometry(r * 0.9, 24), soil, x, potH * 0.93, z, [-Math.PI / 2, 0, 0]);
  const leaf = phys({ color: leafCol, roughness: 0.55, sheen: 0.4, side: THREE.DoubleSide });
  const lg = new THREE.SphereGeometry(1, 10, 6); lg.scale(0.35, 0.06, 1); lg.translate(0, 0, 1);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + rnd(-0.2, 0.2), s = potH * rnd(0.7, 1.15); const m = w.mesh(lg, leaf, x, potH + rnd(0.2, 1.5), z); m.scale.setScalar(s); m.rotation.set(-rnd(0.3, 0.9), a, 0); }
  if (flower) { const pm = phys({ color: flower, roughness: 0.5, sheen: 0.6, side: THREE.DoubleSide }), cm = std({ color: 0xf2c230, roughness: 0.7 }), stem = std({ color: 0x3f7a2a });
    for (let f = 0; f < 3; f++) { const fx = x + rnd(-r * 0.5, r * 0.5), fz = z + rnd(-r * 0.5, r * 0.5), fh = potH + potH * rnd(0.8, 1.3);
      w.mesh(new THREE.CylinderGeometry(0.12, 0.15, fh - potH, 6), stem, fx, (fh + potH) / 2, fz);
      const pg = new THREE.SphereGeometry(1, 8, 6); pg.scale(0.55, 0.12, 1.1); pg.translate(0, 0, 1);
      for (let i = 0; i < 7; i++) { const m = w.mesh(pg, pm, fx, fh, fz); m.rotation.set(-0.35, (i / 7) * Math.PI * 2, 0); m.scale.setScalar(potH * 0.28); }
      w.mesh(new THREE.SphereGeometry(potH * 0.13, 12, 8), cm, fx, fh + 0.1, fz); } }
}
function rock(w, x, z, W, D, H, col) {
  w.solid(x, z, W, D, H);
  const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position, sd = rnd(0, 100);
  for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); const n = 1 + 0.18 * Math.sin(v.x * 3 + sd) * Math.cos(v.z * 3.3 + sd) + 0.08 * Math.sin(v.y * 7 + sd); v.multiplyScalar(n); p.setXYZ(i, v.x, Math.max(v.y, -0.2), v.z); }
  g.computeVertexNormals(); const m = w.mesh(g, std({ color: col, roughness: 0.95, flatShading: false }), x, H * 0.18, z); m.scale.set(W * 0.56, H * 0.85, D * 0.56); m.rotation.y = rnd(0, 6);
}

// ------------------------------------------------------------------ LIVING ROOM
function buildLiving(w) {
  w.sky = 0xd8d2c4; w.sunDir = V(0.9, 0.55, 0.25).normalize(); w.sunI = 3.0; w.hemi = [0xfff4e2, 0x5a4630, 0.65];
  w.doorway = { z: 44, w: 16, h: 44 };
  w.floor(110, std({ ...T.woodFloor(4), roughness: 0.55 }));
  w.walls(62, std({ ...T.wallpaper('#dcd2b0', '#d3c79f', 5), roughness: 0.9 }));
  w.spawnZ = 30;
  w.window(56.1, 32, -6, 34, 26, 'z', V(-0.9, -0.55, -0.25));
  // pictures on the walls
  for (const [x, z, ry, s] of [[-30, -55.9, 0, 0], [-55.9, 18, Math.PI / 2, 1]]) { const fr = new THREE.Group(); const p = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), std({ map: paintingTex(s), roughness: 0.7 })); p.position.z = 0.4; fr.add(p); fr.add(new THREE.Mesh(new RoundedBoxGeometry(18, 14, 0.7, 2, 0.3), std({ color: 0x5b3a1e, roughness: 0.4 }))); fr.rotation.y = ry; w.add(fr, x, 38, z); }
  // rug with fringe
  const R = T.rug(); w.box(0, 0, 64, 42, 0.12, { mat: std({ ...R, roughness: 0.98 }), shadow: false });
  const fr = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.06, 1.6), std({ color: 0xeadcbc, roughness: 1 }), 2 * 110); let fi = 0; const mm = new THREE.Matrix4();
  for (const s of [-1, 1]) for (let i = 0; i < 110; i++) { mm.makeRotationY(rnd(-0.25, 0.25)); mm.setPosition(s * 32.8, 0.05, -20 + (i / 109) * 40); mm.multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)); fr.setMatrixAt(fi++, mm); }
  fr.receiveShadow = true; w.group.add(fr);
  // couch (north), armchairs in the corners
  upholstered(w, 0, -46, 64, 16, 9, 22, 14, '#8a4a38', 'n');
  for (const [x, c] of [[-14, '#e2c27a'], [16, '#3f6e7d']]) { const p = w.mesh(new RoundedBoxGeometry(9, 9, 3, 4, 2.2), phys({ ...T.fabric(c, 2), roughness: 0.9, sheen: 0.6 }), x, 16, -50); p.rotation.set(-0.25, rnd(-0.3, 0.3), rnd(-0.2, 0.2)); }
  upholstered(w, -46, -14, 14, 14, 8, 18, 12, '#355e6e', 'w');
  upholstered(w, 46, 18, 14, 14, 8, 18, 12, '#355e6e', 'e');
  // coffee table: a roof on four tapered legs
  const wood = std({ ...T.woodGrain('#6a4426', 1), roughness: 0.32 });
  w.box(0, 0, 30, 14, 1.0, { y0: 9, mat: wood, round: 0.35 });
  for (const s of [-1, 1]) { w.mesh(new THREE.BoxGeometry(27, 1.2, 0.5), wood, 0, 8.4, s * 6.2); w.mesh(new THREE.BoxGeometry(0.5, 1.2, 11), wood, s * 13.5, 8.4, 0); }
  for (const a of [-1, 1]) for (const b of [-1, 1]) { w.solid(a * 13.5, b * 5.5, 1.4, 1.4, 9); w.mesh(new THREE.CylinderGeometry(0.85, 0.55, 9, 4), wood, a * 13.5, 4.5, b * 5.5, [0, Math.PI / 4, 0]); }
  const mug = new THREE.Group(); const mm2 = phys({ color: 0xf3efe6, roughness: 0.15, clearcoat: 1 });
  mug.add(new THREE.Mesh(lathe([[0, 0], [1.4, 0], [1.6, 3.2], [1.5, 3.2], [1.35, 0.3], [0, 0.3]]), mm2)); const h = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.2, 8, 16), mm2); h.position.set(1.7, 1.7, 0); mug.add(h);
  const cof = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20), std({ color: 0x3a1f0e, roughness: 0.1 })); cof.rotation.x = -Math.PI / 2; cof.position.y = 2.7; mug.add(cof); w.add(mug, 6, 10, 2);
  w.mesh(new RoundedBoxGeometry(8, 0.5, 6, 2, 0.15), std({ color: 0x2c4a7a, roughness: 0.6 }), -6, 10.25, -1, [0, 0.2, 0]);
  // TV stand + TV glowing on the south wall
  const dark = std({ ...T.woodGrain('#3b2a1c', 1), roughness: 0.4 });
  w.box(0, 49, 44, 10, 12, { mat: dark, round: 0.4 });
  for (const s of [-1, 0, 1]) { w.mesh(new RoundedBoxGeometry(13, 9, 0.4, 2, 0.15), dark, s * 14.2, 6, 43.9); w.mesh(new THREE.CylinderGeometry(0.35, 0.35, 3, 8), metal(), s * 14.2, 8.5, 43.5, [0, 0, Math.PI / 2]); }
  const tv = new THREE.Group(); tv.add(new THREE.Mesh(new RoundedBoxGeometry(36, 21, 1.6, 2, 0.4), std({ color: 0x111111, roughness: 0.3 })));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(34, 19), std({ map: tvTex(), emissiveMap: tvTex(), emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.1 })); scr.position.z = -0.85; scr.rotation.y = Math.PI; tv.add(scr);
  w.add(tv, 0, 23.5, 50); w.solid(0, 50, 36, 2, 21, 12); w.mesh(new THREE.BoxGeometry(10, 1, 4), std({ color: 0x111111, roughness: 0.3 }), 0, 12.5, 50);
  // floor lamp in the corner with a warm glow
  const lampM = metal(0x2a2a2a, 0.35); w.mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.6, 24), lampM, -48, 0.3, -48); w.mesh(new THREE.CylinderGeometry(0.35, 0.35, 44, 10), lampM, -48, 22, -48);
  w.mesh(new THREE.CylinderGeometry(4, 7, 8, 24, 1, true), std({ color: 0xf6e8c8, emissive: 0xffd9a0, emissiveIntensity: 0.8, roughness: 0.9, side: THREE.DoubleSide }), -48, 46, -48); w.solid(-48, -48, 2, 2, 44);
  if (w.q === 'high') { const lamp = new THREE.PointLight(0xffc98a, 600, 60, 1.6); lamp.position.set(-48, 42, -48); w.group.add(lamp); }
  pottedPlant(w, -46, 30, 7); pottedPlant(w, 46, -30, 7);
  // mirrored toys and clutter for the two halves
  const blockCols = ['#d3392b', '#2c6fc9', '#e8b830', '#3f9b3a']; let L = 0;
  both((s) => {
    const letters = s > 0 ? 'ABC' : 'XYZ';
    for (const [x, z, y0] of [[20, 12, 0], [20, -12, 0], [31, -20, 0], [31, -20, 3]]) {
      const lt = letters[L % 3], c = blockCols[L++ % 4];
      const b = w.box(s * x, z, 3, 3, 3, { y0, mat: phys({ map: letterTex(lt, c), roughness: 0.4, clearcoat: 0.5 }), round: 0.3 }); b.mesh.rotation.y = rnd(-0.04, 0.04);
    }
    // book steps: a sniper's perch
    [[9, 6, 0x2b4c7e], [7, 5, 0x7e2b3d], [5, 4, 0x2f6b4a]].forEach(([bw, bd, c], k) => {
      const cover = std({ color: c, roughness: 0.6 }), pages = std({ color: 0xf1ead6, roughness: 0.9 });
      w.box(s * 14 + k * 0.3 * s, 24 - k * 0.3, bw, bd, 0.45, { y0: k * 0.45, mat: [pages, cover, cover, cover, pages, pages] });
    });
    // sneaker
    w.solid(s * 35, 6, 4.5, 10, 3);
    const shoe = new THREE.Group(); const up = phys({ color: s > 0 ? 0xf2f2f2 : 0x2c2c34, roughness: 0.7, sheen: 0.3 });
    shoe.add(at(new THREE.Mesh(new RoundedBoxGeometry(4.6, 1.1, 10.2, 3, 0.5), std({ color: 0xffffff, roughness: 0.6 })), V(0, 0.55, 0)));
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(2.0, 5, 6, 16), up); body.rotation.x = Math.PI / 2; body.scale.set(1.05, 1, 0.75); body.position.set(0, 2, 0.4); shoe.add(body);
    const heel = new THREE.Mesh(new RoundedBoxGeometry(4.2, 2.6, 3.4, 3, 1.2), up); heel.position.set(0, 2.2, -3.2); shoe.add(heel);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.25, 0.5, 4), std({ color: 0xd3392b, roughness: 0.5 })); stripe.position.set(0, 1.7, -0.8); stripe.rotation.x = 0.35; shoe.add(stripe);
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 6, 12, Math.PI), std({ color: 0xffffff })); l.position.set(0, 3.3 - i * 0.05, 1.8 - i * 0.9); l.rotation.x = -Math.PI / 2 - 0.3; shoe.add(l); }
    shoe.rotation.y = s > 0 ? 0.05 : Math.PI - 0.05; w.add(shoe, s * 35, 0, 6);
    // TV remote
    w.solid(s * 8, -20, 2.2, 6.5, 0.55); w.mesh(new RoundedBoxGeometry(2.2, 0.55, 6.5, 3, 0.25), std({ color: 0x1d1d1f, roughness: 0.35 }), s * 8, 0.28, -20);
    for (let i = 0; i < 9; i++) w.mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10), std({ color: i === 0 ? 0xd3392b : 0x666666, roughness: 0.5 }), s * 8 + ((i % 3) - 1) * 0.6, 0.6, -21.8 + Math.floor(i / 3) * 0.8);
    // snap bricks with studs
    for (const [x, z, c] of [[25, 26, 0xd3392b], [40, -34, 0x2c6fc9], [6, 32, 0xe8b830], [44, 4, 0x3f9b3a]]) {
      const tm = toyPlastic(c); w.box(s * x, z, 2, 4, 1.2, { mat: tm, round: 0.08 });
      for (let a = 0; a < 2; a++) for (let b = 0; b < 1; b++) w.mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16), tm, s * x, 1.35, z - 1 + a * 2);
    }
    // floor pillow and a fuzzy slipper
    w.solid(s * 22, -31, 10, 10, 3.2); const pil = w.mesh(new RoundedBoxGeometry(10, 3.2, 10, 5, 1.5), phys({ ...T.fabric('#d9c9a3', 2), roughness: 0.95, sheen: 0.7 }), s * 22, 1.6, -31); pil.rotation.y = rnd(-0.3, 0.3);
    w.solid(s * 41, 34, 4, 8, 1.6); w.mesh(new RoundedBoxGeometry(4, 1.6, 8, 4, 0.8), phys({ color: 0x9a6fb0, roughness: 1, sheen: 1, sheenColor: new THREE.Color(0xe8d0ff) }), s * 41, 0.8, 34);
    // crayon box with crayons poking out
    w.solid(s * 10, -8, 3, 1.6, 5);
    w.mesh(new THREE.BoxGeometry(3, 4, 1.6), std({ map: T.label((g, W, H) => { g.fillStyle = '#3f9b3a'; g.fillRect(0, 0, W, H); g.fillStyle = '#f2c230'; g.beginPath(); g.ellipse(W / 2, H * 0.55, W * 0.4, H * 0.18, 0, 0, 7); g.fill(); g.fillStyle = '#3f9b3a'; g.font = '900 40px Nunito,sans-serif'; g.textAlign = 'center'; g.fillText('COLOR', W / 2, H * 0.6); }, 256, 256), roughness: 0.7 }), s * 10, 2, -8);
    for (let i = 0; i < 4; i++) { const c = [0xd3392b, 0x2c6fc9, 0xe8b830, 0x8b3fb0][i]; const cm = std({ color: c, roughness: 0.75 }); w.mesh(new THREE.CylinderGeometry(0.32, 0.32, 2, 10), cm, s * 10 - 1.05 + i * 0.7, 4.6 + (i % 2) * 0.4, -8); w.mesh(new THREE.ConeGeometry(0.32, 0.7, 10), cm, s * 10 - 1.05 + i * 0.7, 5.95 + (i % 2) * 0.4, -8); }
  });
}

// ------------------------------------------------------------------ KITCHEN
function buildKitchen(w) {
  w.sky = 0xeef0ea; w.sunDir = V(-0.2, 0.6, 0.78).normalize(); w.sunI = 2.4; w.hemi = [0xf6fbff, 0x7a7466, 0.6]; w.exposure = 0.82;
  w.floor(100, std({ ...T.tiles(10), roughness: 0.6 }));
  const wallM = std({ ...T.wallpaper('#a9cbb7', '#a2c5b0', 5), roughness: 0.9 });
  w.walls(64, wallM);
  w.spawnZ = 30;
  // base cabinets with doors, granite top, backsplash, upper cabinets and a window over the sink
  const cab = std({ color: 0xece6d6, roughness: 0.55 }), knob = metal(0xb8b8b8, 0.2);
  const granite = std({ map: T.label((g, W, H) => { g.fillStyle = '#3a3a3c'; g.fillRect(0, 0, W, H); for (let i = 0; i < 9000; i++) { g.fillStyle = ['#585858', '#232323', '#8a8a86', '#4a4a4e'][(Math.random() * 4) | 0]; g.fillRect(rnd(0, W), rnd(0, H), rnd(1, 3), rnd(1, 3)); } }, 512, 128), roughness: 0.15 });
  w.box(0, -46, 70, 8, 30, { mat: cab }); w.box(0, -45.6, 72, 9.4, 1.6, { y0: 30, mat: granite, solid: false });
  w.mesh(new THREE.BoxGeometry(70, 1.5, 1), std({ color: 0x2a2a2a }), 0, 0.75, -41.8);
  for (let i = 0; i < 6; i++) { const x = -29 + i * 11.6; w.mesh(new RoundedBoxGeometry(10.6, 24, 0.6, 2, 0.25), cab, x, 15.5, -41.8); w.mesh(new RoundedBoxGeometry(8.4, 21.5, 0.3, 2, 0.15), std({ color: 0xe2dbc8, roughness: 0.6 }), x, 15.5, -41.4); w.mesh(new THREE.CylinderGeometry(0.25, 0.25, 4, 8), knob, x + (i % 2 ? -4 : 4), 22, -41, [0, 0, 0]); }
  w.mesh(new THREE.PlaneGeometry(72, 12), std({ map: (() => { const t = T.tiles(1).map; t.repeat.set(12, 2); return t; })(), roughness: 0.3, color: 0xdfe8ee }), 0, 37.6, -49.9);
  for (const s of [-1, 1]) { w.mesh(new RoundedBoxGeometry(22, 16, 8, 2, 0.4), cab, s * 24, 52, -46); for (const t of [-1, 1]) w.mesh(new THREE.CylinderGeometry(0.25, 0.25, 3, 8), knob, s * 24 + t * 1.6, 46, -41.8); }
  w.window(0, 51, -49.9, 22, 16, 'x', V(0.2, -0.6, 0.78));
  w.mesh(new THREE.BoxGeometry(18, 0.8, 9), metal(0xb0b4b8, 0.15), 0, 31.4, -45.6); w.mesh(lathe([[0, 0], [0.5, 0], [0.5, 9], [0.3, 9.4], [0, 9.4]], 12), metal(0xd0d4d8, 0.12), 0, 31.6, -48.5);
  const fau = w.mesh(new THREE.TorusGeometry(2.5, 0.45, 8, 16, Math.PI), metal(0xd0d4d8, 0.12), 0, 41, -46.5); fau.rotation.y = Math.PI / 2;
  // fridge (left) and oven (right)
  const fridge = phys({ color: 0xf6f6f4, roughness: 0.18, clearcoat: 1 });
  w.box(-42.5, -44, 15, 12, 62, { mat: fridge, round: 1.2 });
  w.mesh(new THREE.BoxGeometry(15.2, 0.3, 12.2), std({ color: 0x9a9a9a }), -42.5, 40, -44);
  for (const y of [20, 50]) w.mesh(new RoundedBoxGeometry(1, 14, 1.6, 2, 0.4), metal(0xbfc3c8, 0.2), -36.5, y, -37.6);
  for (const [x, y, c] of [[-46, 30, 0xd3392b], [-41, 33, 0x2c6fc9], [-44, 26, 0xe8b830], [-39, 28, 0x3f9b3a]]) w.mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 14), toyPlastic(c), x, y, -37.8, [Math.PI / 2, 0, 0]);
  w.mesh(new THREE.PlaneGeometry(5, 6.5), std({ map: T.label((g, W, H) => { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.lineWidth = 10; for (const [c, pts] of [['#d3392b', [[40, 200], [80, 90], [130, 200]]], ['#2c6fc9', [[150, 220], [200, 120], [230, 220]]]]) { g.strokeStyle = c; g.beginPath(); g.moveTo(...pts[0]); g.lineTo(...pts[1]); g.lineTo(...pts[2]); g.closePath(); g.stroke(); } g.fillStyle = '#e8b830'; g.beginPath(); g.arc(200, 60, 30, 0, 7); g.fill(); }, 256, 320) }), -43, 24, -37.85, [0, 0, 0.08]);
  const oven = std({ color: 0x2a2a2c, roughness: 0.35, metalness: 0.4 });
  w.box(42.5, -44, 15, 12, 30, { mat: oven });
  w.mesh(new THREE.PlaneGeometry(11, 9), std({ color: 0x080808, roughness: 0.05, metalness: 0.5 }), 42.5, 13, -37.95);
  w.mesh(new THREE.CylinderGeometry(0.45, 0.45, 12, 10), metal(0xc0c0c0, 0.15), 42.5, 20, -37, [0, 0, Math.PI / 2]);
  for (let i = 0; i < 4; i++) w.mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.8, 16), metal(0x999999, 0.3), 37.5 + i * 3.3, 26.5, -37.8, [Math.PI / 2, 0, 0]);
  // kitchen table on turned legs
  const tw = std({ ...T.woodGrain('#b98a52', 1), roughness: 0.35 });
  w.box(0, 0, 36, 22, 1.2, { y0: 24, mat: tw, round: 0.5 });
  const turned = lathe([[0, 0], [1.0, 0], [1.0, 2], [0.7, 3], [0.9, 5], [0.55, 7], [0.65, 15], [0.9, 17], [0.7, 19], [1.0, 21], [1.0, 24], [0, 24]], 16);
  for (const a of [-1, 1]) for (const b of [-1, 1]) { w.solid(a * 16, b * 9, 2, 2, 24); w.mesh(turned, tw, a * 16, 0, b * 9); }
  const chairLeg = lathe([[0, 0], [0.55, 0], [0.5, 4], [0.7, 6], [0.45, 10], [0.6, 14], [0, 14]], 12), cw = std({ ...T.woodGrain('#9a6b3a', 1), roughness: 0.4 });
  for (const [cx, cz, ry] of [[0, -17, 0], [0, 17, Math.PI], [-25, 0, Math.PI / 2], [25, 0, -Math.PI / 2]]) {
    w.box(cx, cz, 10, 10, 1, { y0: 14, mat: cw, round: 0.4 });
    for (const a of [-1, 1]) for (const b of [-1, 1]) { w.solid(cx + a * 4.3, cz + b * 4.3, 1.2, 1.2, 14); w.mesh(chairLeg, cw, cx + a * 4.3, 0, cz + b * 4.3); }
    const back = new THREE.Group(); for (let i = 0; i < 4; i++) { const sl = new THREE.Mesh(new RoundedBoxGeometry(1, 13, 0.7, 2, 0.3), cw); sl.position.set(-3.6 + i * 2.4, 6.5, 0); back.add(sl); } const tr = new THREE.Mesh(new RoundedBoxGeometry(10, 1.6, 0.9, 2, 0.4), cw); tr.position.y = 13.5; back.add(tr);
    back.rotation.y = ry; const off = V(0, 0, -4.6).applyAxisAngle(V(0, 1, 0), ry); w.add(back, cx + off.x, 15, cz + off.z);
  }
  w.box(0, 48, 80, 4, 12, { mat: std({ color: 0xd6cfbd, roughness: 0.7 }) });
  // mirrored clutter
  const metalTop = metal(0xc8ccd2, 0.2);
  both((s) => {
    for (const [x, z, W, D, H, ry] of [[17, 23, 7, 2.6, 10, 0], [32, -20, 10, 7, 2.6, 0]]) {
      w.solid(s * x, z, W, D, H); const lab = std({ map: cerealTex(), roughness: 0.6 }), side = std({ color: 0xefc13a, roughness: 0.6 });
      const lying = H < 3; const m = w.mesh(new THREE.BoxGeometry(lying ? 7 : W, lying ? 10 : H, lying ? 2.6 : D), [side, side, side, side, lab, lab], s * x, H / 2, z);
      if (lying) m.rotation.set(-Math.PI / 2, 0, Math.PI / 2 * s);
    }
    for (const [x, z, c, wd] of [[10, -24, '#c23a2b', 'SOUP'], [37, 14, '#2f7a3a', 'PEAS'], [24, 33, '#d68a1e', 'BEANS']]) {
      const cb = w.solid(s * x, z, 3.2, 3.2, 4.6); cb.kind = 'can'; cb.fill = { SOUP: 0xc2452b, PEAS: 0x6f9a2e, BEANS: 0x9a4a22 }[wd]; const cg = new THREE.CylinderGeometry(1.6, 1.6, 4.4, 28); w.mesh(cg, [std({ map: canTex(c, wd), roughness: 0.4 }), metalTop, metalTop], s * x, 2.3, z, [0, rnd(0, 6), 0]);
      for (const y of [0.05, 4.55]) w.mesh(new THREE.TorusGeometry(1.55, 0.1, 6, 28), metalTop, s * x, y, z, [Math.PI / 2, 0, 0]);
    }
    w.solid(s * 6, 30, 3.4, 2.2, 1.4); w.mesh(new RoundedBoxGeometry(3.4, 1.0, 2.2, 3, 0.3), phys({ color: 0xf0d43a, roughness: 1, sheen: 0.5 }), s * 6, 0.5, 30); w.mesh(new RoundedBoxGeometry(3.4, 0.35, 2.2, 2, 0.1), std({ color: 0x3f9b3a, roughness: 1 }), s * 6, 1.18, 30);
    w.solid(s * 38, -32, 7, 7, 1.4); w.mesh(lathe([[0, 0], [2.8, 0], [3.5, 1.4], [3.2, 1.45], [2.6, 0.3], [0, 0.3]], 32), toyPlastic(0xc2382c), s * 38, 0, -32);
    for (let i = 0; i < 16; i++) w.mesh(new THREE.SphereGeometry(0.4, 6, 4), std({ color: 0x8a5a2b, roughness: 0.9 }), s * 38 + rnd(-1.8, 1.8), 0.6, -32 + rnd(-1.8, 1.8));
    w.solid(s * 40, 38, 9, 9, 10);
    if (s > 0) { w.mesh(new THREE.CylinderGeometry(4.5, 4.2, 10, 32), metal(0xb4b8bc, 0.3), 40, 5, 38); w.mesh(lathe([[0, 0.8], [4.6, 0], [4.6, -0.3], [0, -0.3]], 32), metal(0xc4c8cc, 0.25), 40, 10.3, 38); w.mesh(new THREE.BoxGeometry(3, 0.4, 2), std({ color: 0x222222 }), 40, 0.4, 42.8); }
    else { w.mesh(lathe([[0, 0], [4, 0], [4.6, 9.6], [4.3, 10], [3.8, 0.5], [0, 0.5]], 32), toyPlastic(0x2c6fc9), -40, 0, 38); w.mesh(new THREE.TorusGeometry(4.3, 0.15, 6, 24, Math.PI), metal(0x999999, 0.3), -40, 10, 38, [0, 0, 0]); }
    w.solid(s * 14, -6, 5, 1.6, 0.5); const sp = new THREE.Group(); sp.add(new THREE.Mesh(new THREE.BoxGeometry(5, 0.25, 0.6), metal(0xd4d8dc, 0.1))); const bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), metal(0xd4d8dc, 0.1)); bowl.scale.set(1.3, 0.35, 0.85); bowl.position.x = 3.2; sp.add(bowl); w.add(sp, s * 14, 0.35, -6).rotation.y = s > 0 ? 0.2 : Math.PI + 0.2;
    w.solid(s * 30, 26, 1.6, 4, 2.2); const eg = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), phys({ color: 0xf6efe2, roughness: 0.55, sheen: 0.3 })); eg.scale.set(1.2, 1.1, 1.6); w.add(eg, s * 30, 1.1, 26);
  });
  const cheer = new THREE.TorusGeometry(0.42, 0.18, 8, 14), cm = std({ color: 0xd9a441, roughness: 0.85 });
  const ci = new THREE.InstancedMesh(cheer, cm, 90); const m4 = new THREE.Matrix4(); w.cheerios = { im: ci, pos: [], alive: [] };
  for (let i = 0; i < 90; i++) { const x = rnd(-30, 30), z = rnd(-20, 40); m4.makeRotationFromEuler(new THREE.Euler(Math.PI / 2 + rnd(-0.2, 0.2), 0, rnd(0, 6))); m4.setPosition(x, 0.18, z); ci.setMatrixAt(i, m4); w.cheerios.pos.push(V(x, 0.18, z)); w.cheerios.alive.push(true); } ci.castShadow = true; ci.receiveShadow = true; w.group.add(ci);
}

// ------------------------------------------------------------------ BACKYARD
function buildBackyard(w) {
  w.sky = 0xa8d4f2; w.sunDir = V(0.45, 0.8, 0.4).normalize(); w.sunI = 3.0; w.hemi = [0xcfe8ff, 0x4d6a2c, 0.7]; w.outdoor = true; w.exposure = 0.8;
  w.floor(120, std({ ...T.grassGround(7), roughness: 1 }));
  // picket fence: rails + instanced pointed pickets
  const s = w.half + 1, paint = std({ color: 0xf1ede2, roughness: 0.75 });
  for (const [x, z, W, D] of [[0, -s, 124, 2], [0, s, 124, 2], [-s, 0, 2, 124], [s, 0, 2, 124]]) w.solid(x, z, W, D, 40);
  const pg = new THREE.BoxGeometry(4.2, 34, 1); pg.translate(0, 17, 0); const tip = new THREE.ConeGeometry(3, 4, 4); tip.rotateY(Math.PI / 4); tip.scale(1, 1, 0.33); tip.translate(0, 36, 0);
  const pk = new THREE.InstancedMesh(pg, paint, 4 * 21), tk = new THREE.InstancedMesh(tip, paint, 4 * 21); let n = 0; const m4 = new THREE.Matrix4();
  for (let side = 0; side < 4; side++) for (let i = 0; i < 21; i++) { const t = -60 + i * 6, x = side < 2 ? t : (side === 2 ? -s : s), z = side < 2 ? (side ? s : -s) : t; m4.makeRotationY(side < 2 ? 0 : Math.PI / 2); m4.setPosition(x, 0, z); pk.setMatrixAt(n, m4); tk.setMatrixAt(n++, m4); }
  for (const o of [pk, tk]) { o.castShadow = true; o.receiveShadow = true; w.group.add(o); }
  for (const y of [8, 28]) for (const [x, z, W, D] of [[0, -s - 1, 124, 1.2], [0, s + 1, 124, 1.2], [-s - 1, 0, 1.2, 124], [s + 1, 0, 1.2, 124]]) w.mesh(new THREE.BoxGeometry(W, 2.5, D), paint, x, y, z);
  // sky, distant trees and a house wall beyond the fence
  const sky = new Sky(); sky.scale.setScalar(4000); const u = sky.material.uniforms; u.turbidity.value = 4; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.8; u.sunPosition.value.copy(w.sunDir).multiplyScalar(1000); w.scene.add(sky); w.sky3 = sky; w.skyObj = sky;
  const treeM = std({ color: 0x2f5a26, roughness: 1 }), trunk = std({ color: 0x4a3524, roughness: 1 });
  for (let i = 0; i < (w.q === 'high' ? 46 : 28); i++) { const a = (i / (w.q === 'high' ? 46 : 28)) * Math.PI * 2 + rnd(-0.05, 0.05), d = rnd(150, 230), x = Math.cos(a) * d, z = Math.sin(a) * d; if (z > 80) continue; const h = rnd(60, 130);
    const t = new THREE.Group(); t.add(at(new THREE.Mesh(new THREE.CylinderGeometry(3, 4, h * 0.5, 8), trunk), V(0, h * 0.25, 0)));
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(h * rnd(0.22, 0.32), 1), treeM); b.position.set(rnd(-h * 0.15, h * 0.15), h * rnd(0.55, 0.85), rnd(-h * 0.15, h * 0.15)); t.add(b); }
    w.add(t, x, 0, z); t.traverse((o) => { o.castShadow = false; }); }
  const sid = std({ map: (() => { const t = T.label((g, W, H) => { g.fillStyle = '#c9d6dc'; g.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 16) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, y + 13, W, 3); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, y, W, 2); } }, 256, 256); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 6); return t; })(), roughness: 0.8 });
  w.mesh(new THREE.BoxGeometry(260, 140, 4), sid, 0, 70, 100).castShadow = false;
  for (const x of [-60, 0, 60]) { w.mesh(new THREE.PlaneGeometry(30, 34), std({ color: 0x1e2a33, roughness: 0.05, metalness: 0.6 }), x, 60, 97.9, [0, Math.PI, 0]); w.mesh(new THREE.BoxGeometry(34, 38, 1), paint, x, 60, 98.5); }
  // sandbox with gaps in each side
  const plank = std({ ...T.woodGrain('#a5774a', 1), roughness: 0.8 });
  for (const sd of [-1, 1]) for (const k of [-1, 1]) { w.box(k * 9, sd * 15, 12, 1.4, 1.4, { mat: plank }); w.box(sd * 15, k * 9, 1.4, 12, 1.4, { mat: plank }); }
  for (const a of [-1, 1]) for (const b of [-1, 1]) w.box(a * 15, b * 15, 2, 2, 1.8, { mat: plank });
  w.box(0, 0, 28.6, 28.6, 0.3, { mat: std({ ...T.sand(3), roughness: 1 }), shadow: false });
  w.solid(5, 4, 6, 6, 4.8, 0.3); const pail = toyPlastic(0xd3392b); w.mesh(lathe([[0, 0], [2.3, 0], [3.1, 4.5], [2.95, 4.5], [2.2, 0.25], [0, 0.25]], 32), pail, 5, 0.3, 4); w.mesh(new THREE.TorusGeometry(3, 0.12, 6, 24, Math.PI), metal(0xdddddd, 0.3), 5, 4.8, 4, [0, 0.6, 0]);
  w.solid(-6, -5, 2, 9, 0.6, 0.3); const shov = new THREE.Group(); const sm = toyPlastic(0x2c6fc9); shov.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 6, 10).rotateX(Math.PI / 2), sm)); const blade = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.3, 3, 2, 0.1), sm); blade.position.z = 4; shov.add(blade); w.add(shov, -6, 0.65, -5);
  w.solid(-3, 7, 6, 6, 2.2, 0.3); const mound = w.mesh(new THREE.SphereGeometry(3.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std({ ...T.sand(1), roughness: 1 }), -3, 0.3, 7); mound.scale.y = 0.65;
  both((sd) => {
    for (const z of [-27, 27]) pottedPlant(w, sd * 26, z, 5.5, 0x3a7a2a, z < 0 ? 0xd3392b : 0xe8b830);
    // brick pile
    const brick = (x, z, W, D, H, y0) => { w.solid(x, z, W, D, H, y0); const bm = std({ color: [0xa2412e, 0x9a3b2a, 0xab4a34][(Math.random() * 3) | 0], roughness: 0.95 }); const m = w.mesh(new RoundedBoxGeometry(W - 0.1, H - 0.05, D - 0.1, 2, 0.15), bm, x, y0 + H / 2, z); m.rotation.y = rnd(-0.04, 0.04); };
    brick(sd * 36, -2, 4, 4, 1.3, 0); brick(sd * 36, 2, 4, 4, 1.3, 0); brick(sd * 36, 0, 4, 4, 1.3, 1.3); brick(sd * 39.5, 1, 2, 4, 1.3, 0);
    rock(w, sd * 18, -44, 6, 5, 2.6, 0x8a8a84); rock(w, sd * 46, -22, 5, 6, 2.8, 0x7d7b74); rock(w, sd * 20, 42, 4.5, 4, 2.2, 0x8e8a80);
    // watering can
    w.solid(sd * 12, 46, 9, 4, 6); const can = new THREE.Group(), cm = toyPlastic(0x3f9b3a);
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 5.5, 24), cm); cb.position.y = 2.75; can.add(cb);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 5.5, 10), cm); spout.position.set(3.6, 3.5, 0); spout.rotation.z = -0.9; can.add(spout);
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.4, 0.6, 14), cm); rose.position.set(5.7, 5.2, 0); rose.rotation.z = -0.9; can.add(rose);
    const hdl = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.3, 8, 20, Math.PI), cm); hdl.position.set(-0.5, 5.5, 0); can.add(hdl);
    can.rotation.y = sd > 0 ? 0 : Math.PI; w.add(can, sd * 12, 0, 46);
    // wooden toy crate
    w.solid(sd * 46, 42, 8, 6, 6); const crate = std({ ...T.woodGrain('#b48a58', 1), roughness: 0.8 });
    for (const y of [1, 3, 5]) for (const zz of [-1, 1]) w.mesh(new THREE.BoxGeometry(8, 1.4, 0.4), crate, sd * 46, y, 42 + zz * 2.8);
    for (const y of [1, 3, 5]) for (const xx of [-1, 1]) w.mesh(new THREE.BoxGeometry(0.4, 1.4, 6), crate, sd * 46 + xx * 3.8, y, 42);
    for (const a of [-1, 1]) for (const b of [-1, 1]) w.mesh(new THREE.BoxGeometry(0.9, 6, 0.9), crate, sd * 46 + a * 3.6, 3, 42 + b * 2.6);
    // twigs
    const bark = std({ color: 0x5a4230, roughness: 1 });
    w.solid(sd * 30, 14, 12, 1, 1); w.mesh(new THREE.CylinderGeometry(0.45, 0.55, 12, 8), bark, sd * 30, 0.5, 14, [0, 0, Math.PI / 2]);
    w.solid(sd * 8, -30, 1, 12, 1); w.mesh(new THREE.CylinderGeometry(0.45, 0.55, 12, 8), bark, sd * 8, 0.5, -30, [Math.PI / 2, 0, 0]);
    w.mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.4, 14), std({ color: 0x9a9a92, roughness: 1 }), sd * 50, 0.2, 0);
  });
  const hose = new THREE.Mesh(new THREE.TorusGeometry(7, 0.6, 10, 40), std({ color: 0x2f8f3a, roughness: 0.45 })); hose.rotation.x = Math.PI / 2; w.add(hose, -50, 0.6, -50);
  const hose2 = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.6, 10, 40), std({ color: 0x2f8f3a, roughness: 0.45 })); hose2.rotation.x = Math.PI / 2; w.add(hose2, -50, 1.7, -50);
  // dandelions + clover
  const stem = std({ color: 0x4f8a2a, roughness: 0.8 }), puffM = std({ color: 0xffffff, roughness: 1, emissive: 0x222222 }), yel = std({ color: 0xf2c230, roughness: 0.8 });
  for (let i = 0; i < 22; i++) { const x = rnd(-55, 55), z = rnd(-55, 55); if (Math.abs(x) < 17 && Math.abs(z) < 17) continue; const h = rnd(2.5, 4.5); w.mesh(new THREE.CylinderGeometry(0.08, 0.1, h, 5), stem, x, h / 2, z); w.mesh(new THREE.IcosahedronGeometry(i % 3 ? 0.55 : 0.9, 1), i % 3 ? yel : puffM, x, h, z); }
  // swaying grass blades (instanced, wind in the vertex shader)
  const count = { low: 0, medium: 9000, high: 26000 }[w.q] ?? 9000;
  if (count) {
    const bg = new THREE.PlaneGeometry(0.1, 1, 1, 4); bg.translate(0, 0.5, 0); const bp = bg.attributes.position; for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y * 0.9)); bp.setZ(i, y * y * 0.15); } bg.computeVertexNormals();
    const bm = std({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide });
    const uTime = { value: 0 };
    bm.onBeforeCompile = (sh) => { sh.uniforms.uTime = uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ip = instanceMatrix * vec4(0.,0.,0.,1.);
      float sway = sin(uTime * 1.6 + ip.x * 0.15 + ip.z * 0.1) * 0.5 + sin(uTime * 3.1 + ip.x * 0.7) * 0.15;
      transformed.x += sway * position.y * position.y * 0.35; transformed.z += sway * position.y * position.y * 0.18;`); };
    const im = new THREE.InstancedMesh(bg, bm, count); const col = new THREE.Color(); let c = 0;
    for (let i = 0; i < count * 3 && c < count; i++) {
      const x = rnd(-59, 59), z = rnd(-59, 59); if (Math.abs(x) < 15.5 && Math.abs(z) < 15.5) continue; if (w.groundAt(x, z, 0.3, 0.3) > 0.05 || w.blocked(x, z, 0, 0.25)) continue;
      const h = rnd(0.22, 0.6) * (Math.random() < 0.06 ? 2 : 1); m4.makeRotationY(rnd(0, Math.PI)); m4.scale(V(1, h, 1)); m4.setPosition(x, 0, z); im.setMatrixAt(c, m4);
      im.setColorAt(c++, col.setHSL(0.25 + rnd(-0.03, 0.04), rnd(0.5, 0.7), rnd(0.1, 0.2)));
    }
    im.count = c; im.castShadow = false; im.receiveShadow = true; w.group.add(im); w.grass = im;
    w.anim.push((dt, t) => { uTime.value = t; });
  }
}

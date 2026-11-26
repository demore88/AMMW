// Army Men: Microplastic Warfare — realistic soldiers: faces, camo uniforms in each army's colours, vests, gloves, boots.
// Everything on a soldier shares one texture atlas, so each moving piece is still a single draw call.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const SOLDIER_Q = { physical: false };
export const SKINS = ['#f2c9a8', '#e3b08a', '#c98f63', '#a46b44', '#7a4a2c', '#5a3520'];

// ---------------------------------------------------------------- plastic (still used for vehicles)
export function plasticMaterial(hex, finish) {
  const c = new THREE.Color(hex);
  const p = { color: c, roughness: 0.42, metalness: 0, emissive: c.clone().multiplyScalar(0.2), emissiveIntensity: 1 };
  if (finish === 'glossy') p.roughness = 0.2;
  return new THREE.MeshStandardMaterial(p);
}

// ---------------------------------------------------------------- the atlas
// regions are [u0, v0, u1, v1] (v measured from the bottom like three.js UVs)
const RG = {
  camo: [0, 0, 0.5, 1], skin: [0.5, 0.75, 0.75, 1], black: [0.75, 0.75, 1, 1], vest: [0.5, 0.5, 0.75, 0.75], metal: [0.75, 0.5, 1, 0.75],
  eye: [0.5, 0.375, 0.625, 0.5], iris: [0.625, 0.375, 0.75, 0.5], hair: [0.75, 0.375, 0.875, 0.5], lips: [0.875, 0.375, 1, 0.5],
  boot: [0.5, 0.25, 0.75, 0.375], wood: [0.75, 0.25, 1, 0.375], strap: [0.5, 0.125, 0.75, 0.25], lens: [0.75, 0.125, 1, 0.25],
};
const atlasCache = new Map();
function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }
function atlas(teamHex, skin) {
  const key = teamHex + skin; if (atlasCache.has(key)) return atlasCache.get(key);
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const R = (r) => [r[0] * S, (1 - r[3]) * S, (r[2] - r[0]) * S, (r[3] - r[1]) * S];
  const fill = (r, col) => { g.fillStyle = col; g.fillRect(...R(r)); };
  // digital camo built from the army's own colour
  const base = new THREE.Color(teamHex).lerp(new THREE.Color(0x8a8a80), 0.3), bh = '#' + base.getHexString(), tones = [shade(bh, 1.0), shade(bh, 0.7), shade(bh, 1.22), '#' + base.clone().lerp(new THREE.Color(0x6b5a40), 0.5).getHexString()];
  const [cx, cy, cw, ch] = R(RG.camo); g.fillStyle = tones[0]; g.fillRect(cx, cy, cw, ch);
  for (let k = 1; k < 4; k++) for (let i = 0; i < 260; i++) { const bx = cx + Math.random() * cw, by = cy + Math.random() * ch, n = 3 + ((Math.random() * 7) | 0); g.fillStyle = tones[k]; for (let j = 0; j < n; j++) g.fillRect(Math.floor((bx + (Math.random() - 0.5) * 14) / 3) * 3, Math.floor((by + (Math.random() - 0.5) * 14) / 3) * 3, 3, 3); }
  for (let i = 0; i < 2500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.05)'; g.fillRect(cx + Math.random() * cw, cy + Math.random() * ch, 1, 1); }
  // skin with a little warmth variation
  { const [x, y, w, h] = R(RG.skin), gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, skin); gr.addColorStop(1, shade(skin, 0.88)); g.fillStyle = gr; g.fillRect(x, y, w, h); }
  fill(RG.black, '#1d1b19');
  { const [x, y, w, h] = R(RG.vest); g.fillStyle = shade(bh, 0.62); g.fillRect(x, y, w, h); g.fillStyle = 'rgba(0,0,0,.28)'; for (let yy = y + 6; yy < y + h; yy += 12) g.fillRect(x, yy, w, 3); g.fillStyle = 'rgba(255,255,255,.06)'; for (let xx = x; xx < x + w; xx += 10) g.fillRect(xx, y, 2, h); }
  fill(RG.metal, '#2b2d30'); fill(RG.eye, '#f4f1ea'); fill(RG.iris, '#2a1a10'); fill(RG.hair, '#2a2018'); fill(RG.lips, shade(skin, 0.78)); fill(RG.boot, '#8b7355'); fill(RG.wood, '#6b4a2b'); fill(RG.strap, '#3a3a30'); fill(RG.lens, '#1a2a30');
  { const [x, y, w, h] = R(RG.boot); g.fillStyle = 'rgba(0,0,0,.25)'; for (let yy = y + 4; yy < y + h; yy += 8) g.fillRect(x, yy, w, 2); }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  // roughness (G) and metalness (B): fabric is matte, eyes wet, the gun is metal
  const m = document.createElement('canvas'); m.width = m.height = 64; const mg = m.getContext('2d'); const M = (r, rough, metal) => { mg.fillStyle = `rgb(0,${rough},${metal})`; mg.fillRect(r[0] * 64, (1 - r[3]) * 64, (r[2] - r[0]) * 64, (r[3] - r[1]) * 64); };
  M([0, 0, 1, 1], 225, 0); M(RG.skin, 160, 0); M(RG.metal, 110, 200); M(RG.eye, 40, 0); M(RG.iris, 40, 0); M(RG.lens, 30, 120); M(RG.black, 190, 0); M(RG.lips, 120, 0);
  const mr = new THREE.CanvasTexture(m);
  const out = { map, mr }; atlasCache.set(key, out); return out;
}
export function soldierMaterial(teamHex, finish, skin) {
  const c = new THREE.Color(teamHex);
  const p = { color: c, roughness: 0.4, metalness: 0, emissive: c.clone().multiplyScalar(0.24), emissiveIntensity: 1, side: THREE.DoubleSide };
  if (finish === 'glossy') p.roughness = 0.16;
  if (finish === 'faded') { p.color = c.clone().lerp(new THREE.Color(0xf4efe0), 0.38); p.roughness = 0.85; }
  if (finish === 'marbled') { p.roughness = 0.25; p.color = c.clone().lerp(new THREE.Color(0xffffff), 0.12); }
  if (finish === 'glow') { p.color = c.clone().lerp(new THREE.Color(0xd8ffb0), 0.35); p.emissive = c.clone().lerp(new THREE.Color(0xc8ff80), 0.55); p.emissiveIntensity = 0.9; }
  if (finish === 'chrome') { p.color = c.clone().lerp(new THREE.Color(0xffffff), 0.5); p.metalness = 1; p.roughness = 0.12; p.emissive = c.clone().multiplyScalar(0.08); }
  if (finish === 'gold') { p.color = new THREE.Color(0xe1b84a).lerp(c, 0.12); p.metalness = 1; p.roughness = 0.2; p.emissive = new THREE.Color(0x221800); }
  const m = new THREE.MeshStandardMaterial(p); m.userData.baseEmissive = p.emissive.clone(); return m;
}

// ---------------------------------------------------------------- geometry kit
class Kit {
  constructor() { this.list = []; }
  add(g, pos = V(0, 0, 0), rot = null, scl = null, rg = 'camo') {
    g = g.index ? g.toNonIndexed() : g.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const r = RG[rg], uv = g.attributes.uv, pad = 0.004;
    for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); const fu = u - Math.floor(u), fv = v - Math.floor(v); uv.setXY(i, r[0] + pad + (u === 1 ? 1 : fu) * (r[2] - r[0] - 2 * pad), r[1] + pad + (v === 1 ? 1 : fv) * (r[3] - r[1] - 2 * pad)); }
    const m = new THREE.Matrix4(), q = rot instanceof THREE.Quaternion ? rot : new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0])));
    m.compose(pos, q, scl || V(1, 1, 1)); g.applyMatrix4(m); this.list.push(g); return this;
  }
  capsule(a, b, r, rg = 'camo', seg = 10) {
    const d = b.clone().sub(a), L = d.length(); const g = new THREE.CapsuleGeometry(r, Math.max(0.001, L), 4, seg);
    return this.add(g, a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), null, rg);
  }
  merge() { const g = mergeGeometries(this.list, false); g.computeBoundingSphere(); return g; }
}
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1));
function elbow(S, H, a, b, pole) {
  const d0 = H.clone().sub(S); let d = d0.length(); d = Math.min(d, a + b - 0.002); const dir = d0.normalize();
  const along = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - along * along));
  const perp = pole.clone().sub(S); perp.sub(dir.clone().multiplyScalar(perp.dot(dir))).normalize();
  return { E: S.clone().addScaledVector(dir, along).addScaledVector(perp, h), H: S.clone().addScaledVector(dir, d) };
}
function hand(k, E, H) {
  const dir = H.clone().sub(E).normalize(), q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
  k.add(new THREE.SphereGeometry(0.028, 10, 8), H, q, V(1, 1.25, 0.8), 'black');                       // gloved fist
  k.add(new THREE.CylinderGeometry(0.031, 0.034, 0.022, 10), E.clone().lerp(H, 0.86), q, null, 'camo'); // cuff
}
function arm(k, S, Hd, pole, shoulder = true) {
  const { E, H } = elbow(S, Hd, 0.14, 0.135, pole);
  if (shoulder) k.add(new THREE.SphereGeometry(0.05, 12, 10), S, null, V(1, 0.9, 1), 'camo');
  k.capsule(shoulder ? S : E.clone().lerp(S, 0.35), E, 0.036); k.capsule(E, H.clone().lerp(E, 0.12), 0.031);
  k.add(rbox(0.05, 0.045, 0.04, 0.015), E, null, null, 'black');                                          // elbow pad
  k.add(rbox(0.045, 0.05, 0.02, 0.008), S.clone().lerp(E, 0.4).add(V(Math.sign(S.x) * 0.03, 0, 0)), null, null, 'vest'); // shoulder patch
  hand(k, E, H);
}
// weapons in aim space (origin between the shoulders, +Z forward)
function weapon(k, cls) {
  if (cls === 'bazooka') {
    const tube = new THREE.CylinderGeometry(0.05, 0.05, 0.82, 16, 1, true); tube.rotateX(Math.PI / 2); k.add(tube, V(0.13, 0.09, 0.1), null, null, 'vest');
    const flare = new THREE.CylinderGeometry(0.05, 0.075, 0.1, 16, 1, true); flare.rotateX(-Math.PI / 2); k.add(flare, V(0.13, 0.09, -0.36), null, null, 'metal');
    for (const z of [0.48, 0.05]) k.add(new THREE.TorusGeometry(0.053, 0.01, 6, 16), V(0.13, 0.09, z), null, null, 'metal');
    k.add(rbox(0.03, 0.1, 0.045, 0.01), V(0.13, 0.0, 0.16), [0.25, 0, 0], null, 'black'); k.add(rbox(0.028, 0.09, 0.04, 0.01), V(0.13, 0.01, 0.0), [0.15, 0, 0], null, 'black');
    k.add(new THREE.CylinderGeometry(0.026, 0.026, 0.1, 16, 1, true).rotateX(Math.PI / 2), V(0.08, 0.13, 0.2), null, null, 'metal'); k.add(rbox(0.02, 0.04, 0.05, 0.006), V(0.08, 0.1, 0.2), null, null, 'metal');
    return { muzzle: V(0.13, 0.09, 0.56), grips: [V(0.13, -0.01, 0.02), V(0.13, -0.02, 0.18)] };
  }
  if (cls === 'flamer') {
    const wand = new THREE.CylinderGeometry(0.024, 0.03, 0.5, 12); wand.rotateX(Math.PI / 2); k.add(wand, V(0.06, -0.1, 0.3), null, null, 'metal');
    k.add(new THREE.CylinderGeometry(0.042, 0.042, 0.07, 14).rotateX(Math.PI / 2), V(0.06, -0.1, 0.55), null, null, 'metal');
    k.add(rbox(0.03, 0.09, 0.045, 0.01), V(0.06, -0.15, 0.14), [0.3, 0, 0], null, 'black'); k.add(rbox(0.028, 0.08, 0.04, 0.01), V(0.06, -0.15, 0.34), [0.2, 0, 0], null, 'black');
    return { muzzle: V(0.06, -0.1, 0.6), grips: [V(0.06, -0.13, 0.14), V(0.06, -0.12, 0.34)] };
  }
  const long = cls === 'sniper', L = long ? 0.74 : 0.52;
  // a modern carbine / marksman rifle: stock, receiver, rail, magazine, handguard, barrel
  k.add(rbox(0.04, 0.07, 0.16, 0.012), V(0.08, -0.03, -0.06), [0.05, 0, 0], null, 'black');                    // stock
  k.add(rbox(0.045, 0.06, 0.2, 0.01), V(0.08, 0.0, 0.08), null, null, 'metal');                                   // receiver
  k.add(new THREE.BoxGeometry(0.03, 0.012, 0.3), V(0.08, 0.036, 0.13), null, null, 'black');                      // top rail
  k.add(rbox(0.05, 0.055, L * 0.42, 0.012), V(0.08, 0.0, 0.18 + L * 0.21), null, null, 'black');                  // handguard
  const barrel = new THREE.CylinderGeometry(0.011, 0.011, L * 0.45, 10); barrel.rotateX(Math.PI / 2); k.add(barrel, V(0.08, 0.005, 0.18 + L * 0.42 + L * 0.2), null, null, 'metal');
  k.add(new THREE.CylinderGeometry(0.017, 0.015, 0.05, 10).rotateX(Math.PI / 2), V(0.08, 0.005, 0.18 + L * 0.85), null, null, 'metal');
  k.add(rbox(0.032, 0.11, 0.05, 0.008), V(0.08, -0.085, 0.12), [0.25, 0, 0], null, 'metal');                     // magazine
  k.add(rbox(0.03, 0.07, 0.035, 0.008), V(0.08, -0.06, 0.02), [-0.3, 0, 0], null, 'black');                      // pistol grip
  if (long) { const sc = new THREE.CylinderGeometry(0.022, 0.022, 0.22, 14); sc.rotateX(Math.PI / 2); k.add(sc, V(0.08, 0.07, 0.12), null, null, 'black'); for (const z of [0.0, 0.24]) k.add(new THREE.CylinderGeometry(0.03, 0.024, 0.04, 14).rotateX(Math.PI / 2), V(0.08, 0.07, z), null, null, 'black'); k.add(new THREE.CircleGeometry(0.026, 14), V(0.08, 0.07, 0.262), null, null, 'lens'); for (const s of [-1, 1]) k.add(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5), V(0.08 + s * 0.03, -0.05, 0.45), [0.3, 0, s * 0.3], null, 'metal'); }
  else { const tube = new THREE.CylinderGeometry(0.02, 0.02, 0.055, 18, 1, true); tube.rotateX(Math.PI / 2); k.add(tube, V(0.08, 0.063, 0.1), null, null, 'black'); k.add(new THREE.TorusGeometry(0.02, 0.004, 5, 18), V(0.08, 0.063, 0.128), null, null, 'black'); k.add(rbox(0.016, 0.02, 0.04, 0.005), V(0.08, 0.045, 0.1), null, null, 'black'); }
  return { muzzle: V(0.08, 0.005, 0.2 + L * 0.9), grips: [V(0.08, -0.05, 0.03), V(0.08, -0.035, 0.18 + L * 0.25)] };
}
const POLE = { r: V(0.6, -0.7, 0.05), l: V(-0.55, -0.6, 0.2) };
const SH = { r: V(0.145, 0, 0), l: V(-0.145, 0, 0) };
// the soldier's right hand is on the -X side (he faces +Z), so mirror the weapon rig across
function mirrorX(g) {
  g.scale(-1, 1, 1); for (const k of ['position', 'normal', 'uv']) { const a = g.attributes[k], n = a.itemSize;
    for (let i = 0; i < a.count; i += 3) for (let c = 0; c < n; c++) { const t = a.array[(i + 1) * n + c]; a.array[(i + 1) * n + c] = a.array[(i + 2) * n + c]; a.array[(i + 2) * n + c] = t; } a.needsUpdate = true; }
  return g;
}
const GUN_OFF = V(0.03, -0.01, 0.13);
function placedWeapon(k, cls) { const wk = new Kit(); const w = weapon(wk, cls); const g = wk.merge(); g.translate(GUN_OFF.x, GUN_OFF.y, GUN_OFF.z); k.list.push(g); return { muzzle: w.muzzle.clone().add(GUN_OFF), grips: w.grips.map((v) => v.clone().add(GUN_OFF)) }; }
export function buildBackGeometry(cls) { const k = new Kit(); weapon(k, cls); const g = mirrorX(k.merge()); g.rotateX(-Math.PI / 2 + 0.15); g.rotateZ(0.7); g.translate(0, 0.2, -0.15); return g; }
export function buildFreeArms() { const k = new Kit(); arm(k, SH.r, V(0.11, -0.12, 0.25), V(0.6, -0.6, -0.1)); arm(k, SH.l, V(-0.11, -0.12, 0.25), V(-0.6, -0.6, -0.1)); return mirrorX(k.merge()); }
export function buildAimGeometry(cls) { const k = new Kit(); const w = placedWeapon(k, cls); arm(k, SH.r, w.grips[0], POLE.r); arm(k, SH.l, w.grips[1], POLE.l); return { geo: mirrorX(k.merge()), muzzle: w.muzzle.clone().setX(-w.muzzle.x) }; }
export function buildViewGeometry(cls) { const k = new Kit(); const w = placedWeapon(k, cls); arm(k, SH.r, w.grips[0], POLE.r, false); arm(k, SH.l, w.grips[1], POLE.l, false); return { geo: mirrorX(k.merge()), muzzle: w.muzzle.clone().setX(-w.muzzle.x) }; }

// ---------------------------------------------------------------- torso, head, headgear, gear
function headGeo(k, cos) {
  const H = V(0, 0.44, 0.005);                         // head centre (torso space)
  k.add(new THREE.CylinderGeometry(0.03, 0.036, 0.07, 12), V(0, 0.37, 0), null, null, 'skin');           // neck
  k.add(new THREE.SphereGeometry(0.062, 20, 16), H, null, V(0.9, 1.08, 1), 'skin');                        // skull
  k.add(new THREE.SphereGeometry(0.048, 16, 12), H.clone().add(V(0, -0.03, 0.018)), null, V(1, 0.85, 1), 'skin'); // jaw
  k.add(new THREE.SphereGeometry(0.02, 10, 8), H.clone().add(V(0, -0.058, 0.04)), null, V(1.1, 0.8, 0.9), 'skin'); // chin
  k.add(rbox(0.014, 0.032, 0.022, 0.006), H.clone().add(V(0, -0.002, 0.062)), [-0.28, 0, 0], null, 'skin');                       // nose bridge
  k.add(new THREE.SphereGeometry(0.009, 8, 6), H.clone().add(V(0, -0.017, 0.07)), null, V(1.6, 0.8, 1), 'skin');  // nose tip
  k.add(rbox(0.07, 0.012, 0.014, 0.005), H.clone().add(V(0, 0.022, 0.056)), null, null, 'skin');                 // brow ridge
  for (const s of [-1, 1]) {
    k.add(new THREE.SphereGeometry(0.0105, 12, 8), H.clone().add(V(s * 0.022, 0.012, 0.058)), null, V(1, 0.62, 0.5), 'eye');   // eyeball
    k.add(new THREE.SphereGeometry(0.0058, 10, 6), H.clone().add(V(s * 0.022, 0.012, 0.0635)), null, V(1, 1, 0.45), 'iris');      // iris
    k.add(rbox(0.028, 0.007, 0.012, 0.003), H.clone().add(V(s * 0.023, 0.028, 0.061)), [0, 0, -s * 0.12], null, 'hair');        // brow
    k.add(new THREE.SphereGeometry(0.015, 10, 8), H.clone().add(V(s * 0.058, 0.0, -0.005)), null, V(0.45, 1.1, 0.8), 'skin');   // ear
    k.add(new THREE.SphereGeometry(0.013, 8, 6), H.clone().add(V(s * 0.03, -0.016, 0.044)), null, V(1, 0.6, 0.5), 'skin');        // cheek
  }
  k.add(rbox(0.028, 0.006, 0.01, 0.003), H.clone().add(V(0, -0.036, 0.064)), null, null, 'lips');          // mouth
  k.add(new THREE.SphereGeometry(0.064, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), H.clone().add(V(0, 0.006, -0.004)), null, V(0.92, 1.05, 1.02), 'hair'); // short hair
  const head = cos.head || 'helmet';
  if (head === 'helmet' || head === 'tanker') {
    // a closed shell (outside, rim, inside) so it never shows through
    k.add(lathe([[0, 0.092], [0.045, 0.088], [0.072, 0.07], [0.084, 0.038], [0.087, 0.0], [0.084, -0.022], [0.078, -0.024], [0.077, 0.0], [0.074, 0.035], [0.062, 0.062], [0.04, 0.078], [0, 0.082]], 24), H.clone().add(V(0, 0.036, -0.008)), null, V(1.02, 0.92, 1.1), 'camo');
    k.add(rbox(0.035, 0.025, 0.018, 0.006), H.clone().add(V(0, 0.085, 0.08)), [0.5, 0, 0], null, 'black');   // night-vision mount
    for (const s of [-1, 1]) k.add(rbox(0.008, 0.07, 0.012, 0.003), H.clone().add(V(s * 0.06, -0.035, 0.015)), [0, 0, s * 0.15], null, 'strap');
    k.add(rbox(0.06, 0.008, 0.02, 0.003), H.clone().add(V(0, -0.068, 0.035)), null, null, 'strap');          // chin strap
    if (head === 'tanker') { k.add(new THREE.TorusGeometry(0.083, 0.008, 5, 22), H.clone().add(V(0, 0.04, 0)), [Math.PI / 2, 0, 0], V(1, 1.08, 1), 'strap'); for (const s of [-1, 1]) k.add(new THREE.CylinderGeometry(0.019, 0.019, 0.016, 12).rotateX(Math.PI / 2), H.clone().add(V(s * 0.026, 0.055, 0.075)), [-0.4, 0, 0], null, 'lens'); }
  } else if (head === 'cap') {
    k.add(lathe([[0, 0.06], [0.06, 0.055], [0.068, 0.02], [0.069, 0], [0.062, 0], [0, 0.01]], 18), H.clone().add(V(0, 0.03, 0)), null, null, 'camo');
    k.add(new THREE.CylinderGeometry(0.05, 0.05, 0.008, 16, 1, false, -Math.PI / 2, Math.PI), H.clone().add(V(0, 0.03, 0.045)), null, V(1, 1, 1.25), 'camo');
  } else if (head === 'beret') {
    k.add(new THREE.SphereGeometry(0.08, 16, 8), H.clone().add(V(0.02, 0.06, -0.01)), [0, 0, -0.28], V(1, 0.32, 1), 'vest');
  } else if (head === 'bandana') {
    k.add(new THREE.CylinderGeometry(0.066, 0.066, 0.032, 18), H.clone().add(V(0, 0.035, 0)), null, null, 'vest'); k.add(rbox(0.03, 0.06, 0.016, 0.006), H.clone().add(V(0.015, 0.01, -0.068)), [0.3, 0, 0.2], null, 'vest');
  } else if (head === 'boonie') {
    k.add(lathe([[0, 0.06], [0.062, 0.055], [0.07, 0.0], [0.13, -0.022], [0.132, -0.03], [0.068, -0.01], [0, 0.0]], 20), H.clone().add(V(0, 0.04, 0)), null, null, 'camo');
  }
}
function torsoGeo(cos, cls) {
  const k = new Kit();
  // uniform blouse: a lathe torso (hips -> chest -> shoulders), flattened front to back
  k.add(lathe([[0.0, -0.02], [0.118, -0.02], [0.124, 0.06], [0.12, 0.13], [0.132, 0.22], [0.138, 0.27], [0.12, 0.31], [0.07, 0.335], [0.0, 0.34]], 22), V(0, 0, 0), null, V(1, 1, 0.68), 'camo');
  k.add(new THREE.CylinderGeometry(0.124, 0.124, 0.035, 22), V(0, 0.02, 0), null, V(1, 1, 0.7), 'strap');              // belt
  k.add(rbox(0.04, 0.03, 0.012, 0.004), V(0, 0.02, 0.088), null, null, 'metal');                                      // buckle
  // plate carrier vest: front + back plates, shoulder straps, magazine pouches, radio
  k.add(rbox(0.2, 0.17, 0.035, 0.015), V(0, 0.2, 0.078), [-0.05, 0, 0], null, 'vest');
  k.add(rbox(0.2, 0.19, 0.035, 0.015), V(0, 0.2, -0.078), [0.04, 0, 0], null, 'vest');
  for (const s of [-1, 1]) { k.add(rbox(0.045, 0.02, 0.17, 0.006), V(s * 0.075, 0.3, 0), null, null, 'vest'); k.add(rbox(0.05, 0.13, 0.15, 0.015), V(s * 0.118, 0.2, 0), null, null, 'vest'); }
  for (let i = 0; i < 3; i++) k.add(rbox(0.05, 0.065, 0.03, 0.008), V(-0.055 + i * 0.055, 0.14, 0.104), null, null, 'vest');
  k.add(rbox(0.06, 0.035, 0.02, 0.006), V(0.05, 0.24, 0.1), null, null, 'vest');
  for (const s of [-1, 1]) k.add(rbox(0.05, 0.05, 0.04, 0.012), V(s * 0.1, 0.0, 0.065), null, null, 'vest');           // belt pouches
  k.add(rbox(0.06, 0.045, 0.012, 0.004), V(-0.055, 0.25, 0.098), null, null, 'black');                                 // name tape / flag patch
  headGeo(k, cos);
  const gear = cos.gear || 'none';
  if (gear === 'pack') { k.add(rbox(0.19, 0.22, 0.09, 0.03), V(0, 0.2, -0.14), null, null, 'vest'); k.add(rbox(0.14, 0.07, 0.04, 0.015), V(0, 0.12, -0.19), null, null, 'vest'); }
  if (gear === 'radio') { k.add(rbox(0.16, 0.22, 0.09, 0.02), V(0, 0.2, -0.14), null, null, 'black'); k.add(new THREE.CylinderGeometry(0.005, 0.008, 0.45, 5), V(0.06, 0.52, -0.15), null, null, 'black'); }
  if (gear === 'canteen') k.add(new THREE.CylinderGeometry(0.04, 0.04, 0.085, 14), V(0.12, -0.03, -0.06), null, V(1, 1, 0.6), 'black');
  if (gear === 'belt') { for (let i = 0; i < 6; i++) k.add(new THREE.CylinderGeometry(0.01, 0.01, 0.045, 6), V(-0.09 + i * 0.036, 0.1 + i * 0.04, 0.11), [0, 0, 0.75], null, 'metal'); k.add(new THREE.BoxGeometry(0.04, 0.36, 0.015), V(0, 0.17, 0.105), [0, 0, 0.75], null, 'strap'); }
  if (gear === 'roll') k.add(new THREE.CylinderGeometry(0.048, 0.048, 0.27, 14), V(0, 0.33, -0.1), [0, 0, Math.PI / 2], null, 'vest');
  if (cls === 'flamer') { for (const s of [-1, 1]) { k.add(new THREE.CylinderGeometry(0.052, 0.052, 0.26, 14), V(s * 0.058, 0.18, -0.14), null, null, 'metal'); k.add(new THREE.SphereGeometry(0.052, 12, 8), V(s * 0.058, 0.31, -0.14), null, V(1, 0.5, 1), 'metal'); }
    k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.058, 0.06, -0.15), V(-0.14, -0.05, -0.05), V(-0.16, 0.12, 0.1), V(-0.13, 0.27, 0.12)]), 16, 0.01, 6), V(0, 0, 0), null, null, 'black'); }
  return k.merge();
}
const legGeo = (() => { const k = new Kit(); k.capsule(V(0, 0, 0), V(0, -0.2, 0), 0.056); k.add(rbox(0.035, 0.07, 0.06, 0.012), V(0.05, -0.11, 0.0), null, null, 'camo'); return k.merge(); })(); // thigh + cargo pocket
const legGeoL = (() => { const k = new Kit(); k.capsule(V(0, 0, 0), V(0, -0.2, 0), 0.056); k.add(rbox(0.035, 0.07, 0.06, 0.012), V(-0.05, -0.11, 0.0), null, null, 'camo'); return k.merge(); })();
const shinGeo = (() => {
  const k = new Kit(); k.capsule(V(0, 0, 0), V(0, -0.16, 0), 0.047);
  k.add(rbox(0.07, 0.065, 0.04, 0.015), V(0, -0.005, 0.045), null, null, 'black');                // knee pad
  k.add(new THREE.CylinderGeometry(0.052, 0.05, 0.07, 14), V(0, -0.175, 0), null, null, 'boot');      // boot upper
  k.add(rbox(0.088, 0.045, 0.17, 0.02), V(0, -0.22, 0.028), null, null, 'boot');                    // boot foot
  k.add(rbox(0.094, 0.018, 0.18, 0.008), V(0, -0.245, 0.03), null, null, 'black');                  // sole
  for (let i = 0; i < 3; i++) k.add(new THREE.BoxGeometry(0.05, 0.006, 0.008), V(0, -0.15 - i * 0.02, 0.046 + i * 0.006), null, null, 'black'); // laces
  return k.merge();
})();
const cache = new Map();
function cached(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }

// Model faces +Z. Feet at y=0. About 1 unit tall.
export function buildSoldier(color, cls, cos = {}) {
  const skin = cos.skin || SKINS[(Math.random() * SKINS.length) | 0];
  const m = soldierMaterial(color, cos.finish, skin);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mesh = (g, parent) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const legs = [], knees = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.07, 0.47, 0); body.add(hip); mesh(s < 0 ? legGeo : legGeoL, hip);
    const knee = new THREE.Group(); knee.position.y = -0.2; hip.add(knee); mesh(shinGeo, knee);
    legs.push(hip); knees.push(knee);
  }
  const torso = new THREE.Group(); torso.position.y = 0.47; body.add(torso);
  mesh(cached('t' + cls + (cos.head || 'helmet') + (cos.gear || 'none'), () => torsoGeo(cos, cls)), torso);
  const aim = new THREE.Group(); aim.position.set(0, 0.29, 0); torso.add(aim);
  const A = cached('aim' + cls, () => buildAimGeometry(cls)); const aimMesh = mesh(A.geo, aim);
  const backGun = mesh(cached('back' + cls, () => buildBackGeometry(cls)), torso); backGun.visible = false;
  const freeArms = new THREE.Group(); freeArms.position.copy(aim.position); torso.add(freeArms); mesh(cached('free', buildFreeArms), freeArms); freeArms.visible = false;
  const s = { root, body, legs, knees, torso, aim, aimMesh, backGun, freeArms, muzzle: A.muzzle.clone(), mat: m, skin };
  pose(s, 0, false); return s;
}
// sling the weapon on the back (hands free for climbing) or bring it back to the shoulder
export function stow(s, on, reach = 0) { s.aimMesh.visible = !on; s.backGun.visible = on; s.freeArms.visible = on; s.freeArms.rotation.x = -reach; }
export function crouchPose(s, depth = 1) { s.legs[0].rotation.x = -1.2 * depth; s.knees[0].rotation.x = 1.9 * depth; s.legs[1].rotation.x = -0.4 * depth; s.knees[1].rotation.x = 1.5 * depth; s.body.position.y = -0.2 * depth; s.torso.rotation.x = 0.35 * depth; }
export function pose(s, t, moving, air = false) {
  s.body.position.y = 0;
  const [L, R] = s.legs, [KL, KR] = s.knees;
  if (air) { L.rotation.x = -0.6; KL.rotation.x = 0.9; R.rotation.x = 0.2; KR.rotation.x = 0.5; return; }
  if (!moving) { L.rotation.x = -0.12; KL.rotation.x = 0.12; R.rotation.x = 0.1; KR.rotation.x = 0.06; s.torso.rotation.x = 0.03; return; }
  const a = Math.sin(t), b = Math.sin(t + Math.PI);
  L.rotation.x = a * 0.6; R.rotation.x = b * 0.6;
  KL.rotation.x = Math.max(0, -Math.cos(t)) * 0.9 + 0.1; KR.rotation.x = Math.max(0, Math.cos(t)) * 0.9 + 0.1;
  s.torso.rotation.x = 0.08;
}

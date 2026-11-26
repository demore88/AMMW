// Army Men: Microplastic Warfare — the giants of the house: a wandering house cat and a kid who walks in on the war.
// Units: one army man is 1 tall, so the cat stands ~5 at the shoulder and the kid ~24.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function bakeInto(group, parts) { // parts: [geo, mat, pos, rot, scale]
  const by = new Map();
  for (const [geo, mat, pos, rot, scl] of parts) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().compose(pos || V(0, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]))), scl || V(1, 1, 1)));
    if (!by.has(mat)) by.set(mat, []); by.get(mat).push(g);
  }
  for (const [mat, gs] of by) { const m = new THREE.Mesh(mergeGeometries(gs), mat); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  return group;
}
function tabbyTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#d98b3a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(150,80,25,.75)'; const y = i * 19 + Math.random() * 6; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 5 + (x % 64 ? 4 : -4)); g.lineTo(256, y + 8); g.lineTo(0, y + 8); g.fill(); }
  for (let i = 0; i < 3000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,230,190,.08)' : 'rgba(90,40,10,.08)'; g.fillRect(Math.random() * 256, Math.random() * 256, 1, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ------------------------------------------------------------------ cat (faces +Z)
export function buildCat() {
  const fur = new THREE.MeshStandardMaterial({ map: tabbyTex(), roughness: 0.95 }), cream = new THREE.MeshStandardMaterial({ color: 0xf3e3c8, roughness: 0.95 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xe89a9a, roughness: 0.7 }), eye = new THREE.MeshStandardMaterial({ color: 0x9acb3a, emissive: 0x2a3a08, roughness: 0.1 }), pupil = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  bakeInto(body, [
    [new THREE.CapsuleGeometry(2.3, 5.5, 8, 18), fur, V(0, 5.6, 0), [Math.PI / 2, 0, 0], V(1, 1, 0.92)],
    [new THREE.SphereGeometry(2.1, 16, 12), cream, V(0, 4.6, 2.6), null, V(0.9, 0.8, 1)],                 // chest
  ]);
  const head = new THREE.Group(); head.position.set(0, 7.6, 5.0); body.add(head);
  bakeInto(head, [
    [new THREE.SphereGeometry(2.1, 18, 14), fur, V(0, 0, 0), null, V(1.08, 0.95, 1)],
    [new THREE.SphereGeometry(1.0, 12, 10), cream, V(0, -0.65, 1.55), null, V(1.3, 0.8, 0.9)],               // muzzle
    [new THREE.SphereGeometry(0.28, 8, 6), pink, V(0, -0.25, 2.25), null, V(1.2, 0.8, 0.8)],                 // nose
    ...[-1, 1].flatMap((s) => [
      [new THREE.ConeGeometry(0.85, 1.7, 4), fur, V(s * 1.15, 1.7, -0.1), [0, Math.PI / 4, s * 0.35]],       // ears
      [new THREE.ConeGeometry(0.5, 1.1, 4), pink, V(s * 1.12, 1.6, 0.12), [0, Math.PI / 4, s * 0.35]],
      [new THREE.SphereGeometry(0.42, 12, 10), eye, V(s * 0.75, 0.35, 1.72), null, V(1, 1, 0.6)],
      [new THREE.SphereGeometry(0.2, 8, 6), pupil, V(s * 0.75, 0.35, 1.95), null, V(0.5, 1.4, 0.5)],
      ...[0, 1, 2].map((k) => [new THREE.CylinderGeometry(0.02, 0.02, 2.4, 3), cream, V(s * 1.5, -0.6 + k * 0.18, 1.6), [0, 0, Math.PI / 2 + s * (0.08 - k * 0.08)]]),
    ]),
  ]);
  const legs = [];
  for (const [x, z] of [[1.2, 3.4], [-1.2, 3.4], [1.3, -3.2], [-1.3, -3.2]]) {
    const hip = new THREE.Group(); hip.position.set(x, 5.2, z); body.add(hip);
    bakeInto(hip, [[new THREE.CapsuleGeometry(0.75, 3.8, 6, 12), fur, V(0, -2.4, 0)], [new THREE.SphereGeometry(0.95, 12, 8), cream, V(0, -4.8, 0.35), null, V(1, 0.55, 1.3)]]);
    legs.push(hip);
  }
  const tail = new THREE.Group(); tail.position.set(0, 6.4, -4.6); body.add(tail);
  bakeInto(tail, [[new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 1.5, -2.2), V(0, 4, -3.2), V(0, 6.5, -2.4)]), 20, 0.55, 8), fur]]);
  return { root, body, head, legs, tail, paws: legs };
}

// ------------------------------------------------------------------ kid (faces +Z)
export function buildKid(o = {}) {
  const skin = new THREE.MeshStandardMaterial({ color: o.skin || 0xe9b48e, roughness: 0.7 }), shirt = new THREE.MeshStandardMaterial({ color: o.shirt || 0xd94b3b, roughness: 0.85 });
  const stripe = new THREE.MeshStandardMaterial({ color: o.stripe || 0xf4f0e6, roughness: 0.85 }), jeans = new THREE.MeshStandardMaterial({ color: o.pants || 0x3a5a8c, roughness: 0.9 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 }), sole = new THREE.MeshStandardMaterial({ color: 0x2c6fc9, roughness: 0.6 });
  const hair = new THREE.MeshStandardMaterial({ color: o.hair || 0x5a3a1e, roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 }), white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const torso = new THREE.Group(); torso.position.y = 11.5; body.add(torso);
  bakeInto(torso, [
    [new RoundedBoxGeometry(6.4, 7.4, 3.8, 4, 1.4), shirt, V(0, 3.8, 0)],
    ...[1.5, 3.6, 5.7].map((y) => [new THREE.BoxGeometry(6.5, 0.6, 3.9), stripe, V(0, y, 0)]),
    [new RoundedBoxGeometry(6.2, 1.8, 3.6, 3, 0.7), jeans, V(0, 0.4, 0)],
    [new THREE.CylinderGeometry(0.9, 1.0, 1.2, 12), skin, V(0, 7.9, 0)],
  ]);
  const head = new THREE.Group(); head.position.set(0, 10.6, 0.1); torso.add(head);
  bakeInto(head, [
    [new THREE.SphereGeometry(2.9, 22, 16), skin, V(0, 0, 0), null, V(1, 1.05, 1)],
    [new THREE.SphereGeometry(3.0, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, V(0, 0.35, -0.15), null, V(1.03, 1.0, 1.05)],
    ...[-1, 1].flatMap((s) => [[new THREE.SphereGeometry(0.42, 10, 8), white, V(s * 1.0, 0.3, 2.6), null, V(1, 1.1, 0.5)], [new THREE.SphereGeometry(0.24, 8, 6), dark, V(s * 1.0, 0.3, 2.78)], [new THREE.SphereGeometry(0.7, 10, 8), skin, V(s * 2.85, 0, 0), null, V(0.5, 1, 0.8)]]),
    [new THREE.SphereGeometry(0.45, 10, 8), skin, V(0, -0.45, 2.85)],
  ]);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), dark); mouth.position.set(0, -1.4, 2.6); mouth.scale.set(1, 0.25, 0.5); head.add(mouth);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 1.6, 11.5, 0); body.add(hip);
    bakeInto(hip, [[new THREE.CapsuleGeometry(1.25, 8.4, 6, 14), jeans, V(0, -5.2, 0)], [new RoundedBoxGeometry(2.6, 1.6, 4.4, 3, 0.7), shoe, V(0, -10.6, 0.7)], [new RoundedBoxGeometry(2.7, 0.5, 4.6, 2, 0.2), sole, V(0, -11.3, 0.7)]]);
    legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(s * 3.6, 18.4, 0); body.add(sh);
    bakeInto(sh, [[new THREE.CapsuleGeometry(0.95, 2.4, 6, 12), shirt, V(0, -1.4, 0)], [new THREE.CapsuleGeometry(0.8, 4, 6, 12), skin, V(0, -4.4, 0)], [new THREE.SphereGeometry(1.0, 10, 8), skin, V(0, -7, 0)]]);
    arms.push(sh);
  }
  return { root, body, torso, head, mouth, legs, arms };
}

// ------------------------------------------------------------------ Dad and his push mower (both face +Z)
export function buildDad() {
  const k = buildKid({ shirt: 0x3f6e4a, stripe: 0x2c4a32, pants: 0x6b5a44, hair: 0x6a6258, skin: 0xd9a47e });
  k.root.scale.setScalar(1.5);
  const cap = new THREE.Group(); bakeInto(cap, [[new THREE.SphereGeometry(3.05, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), new THREE.MeshStandardMaterial({ color: 0xc23a2b, roughness: 0.7 }), V(0, 0.7, -0.1)], [new THREE.CylinderGeometry(2.4, 2.4, 0.25, 18, 1, false, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0xc23a2b, roughness: 0.7 }), V(0, 1.2, 1.6), null, V(1, 1, 1.1)]]); k.head.add(cap);
  // arms reach forward to the handle
  k.arms[0].rotation.x = k.arms[1].rotation.x = -0.75;
  return k;
}
export function buildMower() {
  const red = new THREE.MeshStandardMaterial({ color: 0xc8352a, roughness: 0.35, metalness: 0.2 }), black = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 }), bag = new THREE.MeshStandardMaterial({ color: 0x3a3a34, roughness: 0.95 });
  const root = new THREE.Group(), wheels = [];
  bakeInto(root, [
    [new RoundedBoxGeometry(13, 3.4, 15, 4, 1.4), red, V(0, 3.4, 0)],
    [new THREE.CylinderGeometry(3.2, 3.6, 3.6, 20), black, V(0, 6.6, 1.5)], [new THREE.CylinderGeometry(2.4, 2.4, 1.2, 20), red, V(0, 8.8, 1.5)],
    [new RoundedBoxGeometry(2.2, 1.4, 4, 2, 0.5), black, V(7.4, 2.8, 2), [0, 0, -0.3]],                                      // side chute
    [new RoundedBoxGeometry(9, 7, 7, 3, 2), bag, V(0, 6, -10.5)],                                                            // grass bag
    ...[-1, 1].map((s) => [new THREE.CylinderGeometry(0.4, 0.4, 24, 8), steel, V(s * 4.6, 13.5, -13.5), [-0.9, 0, 0]]),        // handle bars
    [new THREE.CylinderGeometry(0.45, 0.45, 9.6, 8), black, V(0, 22.6, -21.4), [0, 0, Math.PI / 2]],
  ]);
  for (const [x, z] of [[6.6, 5.2], [-6.6, 5.2], [6.6, -5.2], [-6.6, -5.2]]) { const w = new THREE.Group(); w.position.set(x, 2.2, z); bakeInto(w, [[new THREE.CylinderGeometry(2.2, 2.2, 1.4, 20), black, V(0, 0, 0), [0, 0, Math.PI / 2]], [new THREE.CylinderGeometry(1.0, 1.0, 1.5, 12), steel, V(0, 0, 0), [0, 0, Math.PI / 2]]]); root.add(w); wheels.push(w); }
  return { root, wheels };
}

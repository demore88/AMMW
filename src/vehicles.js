// Army Men: Microplastic Warfare — toy jeeps, tanks and prop planes, driven by Rapier physics.
// Each vehicle faces +Z; its mesh origin is the physics body's centre.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { R, PH, DYN_GROUP } from './physics.js';
import { plasticMaterial } from './soldier.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// bake a group's still parts into one mesh per material (skipping parts that move on their own)
function bake(group, skip = []) {
  group.updateMatrixWorld(true); const inv = group.matrixWorld.clone().invert(), buckets = new Map(), victims = [];
  const walk = (o) => { for (const c of o.children) { if (skip.includes(c)) continue; if (c.isMesh) { const g0 = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone(); g0.applyMatrix4(inv.clone().multiply(c.matrixWorld)); for (const k of Object.keys(g0.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g0.deleteAttribute(k); if (!g0.attributes.uv) g0.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g0.attributes.position.count * 2), 2)); const k = c.material.uuid; if (!buckets.has(k)) buckets.set(k, { mat: c.material, geos: [] }); buckets.get(k).geos.push(g0); victims.push(c); } walk(c); } };
  walk(group); for (const v of victims) v.parent.remove(v);
  for (const b of buckets.values()) { const m = new THREE.Mesh(mergeGeometries(b.geos, false), b.mat); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  // empty helper groups left behind are harmless
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function add(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
const rubber = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.85 });
const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fc7e0, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.45, metalness: 0.2 });
const lamp = new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff0b0, emissiveIntensity: 1.5 });

function wheelMesh(r, w, mat) {
  const g = new THREE.Group();
  const tire = add(g, new THREE.CylinderGeometry(r, r, w, 22), rubber, 0, 0, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(g, new THREE.BoxGeometry(w * 1.02, r * 0.16, r * 0.22), rubber, 0, Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97, a); }
  add(g, new THREE.CylinderGeometry(r * 0.55, r * 0.55, w * 1.05, 16), mat, 0, 0, 0, 0, 0, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(r * 0.18, r * 0.18, w * 1.15, 8), mat, 0, 0, 0, 0, 0, Math.PI / 2);
  bake(g); return g;
}

// ------------------------------------------------------------------ models
// an original open-top military 4x4: square hood, horizontal-bar grille, round lamps, half doors, roll bar and a ring-mounted minigun
function jeepModel(mat) {
  const g = new THREE.Group(), dark = mat.clone(); dark.name = 'dark'; dark.color.multiplyScalar(0.55);
  const gun = new THREE.MeshStandardMaterial({ color: 0x2c2e31, metalness: 0.85, roughness: 0.35 }), canvas = new THREE.MeshStandardMaterial({ color: 0x3b3a30, roughness: 0.95 });
  add(g, new RoundedBoxGeometry(1.72, 0.42, 3.9, 3, 0.1), mat, 0, -0.02, 0);                       // tub
  add(g, new THREE.BoxGeometry(1.8, 0.12, 4.1), dark, 0, -0.22, 0);                               // frame rails / sill
  add(g, new RoundedBoxGeometry(1.66, 0.3, 1.35, 3, 0.06), mat, 0, 0.33, 1.25);                    // hood
  add(g, new THREE.BoxGeometry(0.5, 0.03, 1.1), dark, 0, 0.49, 1.25);                              // hood vent
  add(g, new RoundedBoxGeometry(1.74, 0.5, 0.1, 2, 0.03), dark, 0, 0.18, 1.96);                    // grille panel
  for (let i = 0; i < 5; i++) add(g, new THREE.BoxGeometry(1.0, 0.035, 0.05), gun, 0, 0.04 + i * 0.075, 2.02);   // horizontal grille bars
  for (const sx of [-1, 1]) { add(g, new THREE.CylinderGeometry(0.11, 0.11, 0.06, 18), gun, sx * 0.66, 0.28, 2.0, Math.PI / 2); add(g, new THREE.CylinderGeometry(0.085, 0.085, 0.02, 16), lamp, sx * 0.66, 0.28, 2.035, Math.PI / 2); }
  add(g, new RoundedBoxGeometry(1.9, 0.12, 0.14, 2, 0.04), gun, 0, -0.12, 2.06);                    // front bumper
  for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.06, 0.36, 0.06), gun, sx * 0.5, 0.08, 2.12); // bull bar uprights
  add(g, new THREE.BoxGeometry(1.1, 0.06, 0.06), gun, 0, 0.26, 2.12);
  for (const sx of [-1, 1]) for (const z of [1.3, -1.3]) add(g, new RoundedBoxGeometry(0.34, 0.1, 1.05, 2, 0.04), mat, sx * 0.98, 0.27, z);  // flared fenders
  // windshield frame (split screen) and cowl
  const ws = new THREE.Group(); ws.position.set(0, 0.48, 0.58); ws.rotation.x = -0.18; g.add(ws);
  for (const x of [-0.82, 0, 0.82]) add(ws, new THREE.BoxGeometry(0.06, 0.55, 0.06), dark, x, 0.27, 0);
  add(ws, new THREE.BoxGeometry(1.7, 0.06, 0.06), dark, 0, 0.55, 0); add(ws, new THREE.BoxGeometry(1.7, 0.05, 0.06), dark, 0, 0.0, 0);
  for (const x of [-0.41, 0.41]) add(ws, new THREE.BoxGeometry(0.76, 0.48, 0.02), glass, x, 0.27, 0);
  // seats, dash, steering wheel
  for (const sx of [-1, 1]) { add(g, new RoundedBoxGeometry(0.52, 0.12, 0.5, 2, 0.05), canvas, sx * 0.42, 0.22, 0.05); add(g, new RoundedBoxGeometry(0.52, 0.55, 0.12, 2, 0.05), canvas, sx * 0.42, 0.48, -0.22, -0.12); }
  add(g, new RoundedBoxGeometry(1.6, 0.18, 0.25, 2, 0.05), dark, 0, 0.4, 0.5);
  add(g, new THREE.TorusGeometry(0.15, 0.02, 6, 18), gun, 0.42, 0.55, 0.35, -0.9);
  // rear bed with jerry cans, spare wheel and tail lights
  add(g, new RoundedBoxGeometry(1.6, 0.06, 1.5, 2, 0.02), dark, 0, 0.2, -1.2);
  for (const sx of [-1, 1]) add(g, new RoundedBoxGeometry(0.12, 0.3, 0.22, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0x4a5a2a, roughness: 0.6 }), sx * 0.62, 0.38, -1.75);
  for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.1, 0.06, 0.03), new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0x801008 }), sx * 0.72, 0.1, -1.96);
  const spare = wheelMesh(0.42, 0.26, dark); spare.position.set(0, 0.32, -2.12); g.add(spare);
  add(g, new THREE.CylinderGeometry(0.01, 0.015, 1.4, 5), gun, -0.82, 1.0, -1.7);                    // whip antenna
  // roll bar with the gunner's ring
  for (const sx of [-1, 1]) { add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), gun, sx * 0.78, 0.65, -0.55); add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), gun, sx * 0.78, 0.65, -1.55, -0.0); add(g, new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), gun, sx * 0.78, 1.1, -1.05, Math.PI / 2); }
  add(g, new THREE.CylinderGeometry(0.035, 0.035, 1.6, 8), gun, 0, 1.1, -0.55, 0, 0, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.035, 0.035, 1.6, 8), gun, 0, 1.1, -1.55, 0, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.42, 0.04, 8, 28), gun, 0, 1.12, -1.05, Math.PI / 2);
  // half doors hinged at their front edge
  const doors = [];
  for (const sx of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(sx * 0.87, 0.18, 0.4); g.add(hinge);
    add(hinge, new RoundedBoxGeometry(0.06, 0.42, 0.8, 2, 0.02), mat, 0, 0, -0.42);
    add(hinge, new THREE.BoxGeometry(0.07, 0.04, 0.12), gun, sx * 0.02, 0.08, -0.7);
    add(hinge, new THREE.BoxGeometry(0.07, 0.3, 0.04), dark, sx * 0.01, 0.02, -0.06);
    doors.push(hinge);
  }
  // minigun on a pivot: yaw on the ring, pitch on the cradle, spinning barrels
  const mgYaw = new THREE.Group(); mgYaw.position.set(0, 1.14, -1.05); g.add(mgYaw);
  const mgPitch = new THREE.Group(); mgPitch.position.set(0, 0.22, 0.2); mgYaw.add(mgPitch);
  add(mgYaw, new THREE.CylinderGeometry(0.05, 0.06, 0.22, 10), gun, 0, 0.11, 0.2);
  add(mgPitch, new RoundedBoxGeometry(0.18, 0.16, 0.36, 2, 0.04), gun, 0, 0, 0);
  add(mgPitch, new RoundedBoxGeometry(0.2, 0.18, 0.2, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0x4a5a2a, roughness: 0.7 }), -0.2, -0.02, -0.04);   // ammo box
  for (const sx of [-1, 1]) add(mgPitch, new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6), gun, sx * 0.07, 0.02, -0.26, Math.PI / 2);   // spade grips
  const barrels = new THREE.Group(); barrels.position.set(0, 0, 0.2); mgPitch.add(barrels);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(barrels, new THREE.CylinderGeometry(0.014, 0.014, 0.6, 6), gun, Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.3, Math.PI / 2); }
  add(barrels, new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), gun, 0, 0, 0.5, Math.PI / 2); add(barrels, new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), gun, 0, 0, 0.12, Math.PI / 2);
  bake(barrels); bake(mgPitch, [barrels]); bake(mgYaw, [mgPitch]); for (const d of doors) bake(d); bake(g, [mgYaw, ...doors]);
  return { g, doors, mgYaw, mgPitch, barrels };
}
function tankModel(mat) {
  const g = new THREE.Group(), dark = mat.clone(); dark.name = 'dark'; dark.color.multiplyScalar(0.62);
  add(g, new RoundedBoxGeometry(2.0, 0.6, 4.3, 3, 0.14), mat, 0, 0.05, 0);                      // hull
  add(g, new RoundedBoxGeometry(1.9, 0.3, 1.0, 3, 0.12), mat, 0, 0.1, 2.15, -0.45);               // glacis
  for (const s of [-1, 1]) {                                                                        // tracks + road wheels
    add(g, new RoundedBoxGeometry(0.55, 0.75, 4.5, 4, 0.3), rubber, s * 1.15, -0.2, 0);
    for (let i = 0; i < 6; i++) add(g, new THREE.CylinderGeometry(0.27, 0.27, 0.58, 16), dark, s * 1.15, -0.28, -1.75 + i * 0.7, 0, 0, Math.PI / 2);
    add(g, new RoundedBoxGeometry(0.7, 0.08, 4.4, 2, 0.03), mat, s * 1.15, 0.2, 0);                // track guards
    for (let i = 0; i < 26; i++) add(g, new THREE.BoxGeometry(0.57, 0.05, 0.08), dark, s * 1.15, 0.19, -2.15 + i * 0.17);
  }
  const turret = new THREE.Group(); turret.position.set(0, 0.55, -0.15); g.add(turret);
  add(turret, new THREE.CylinderGeometry(0.8, 0.95, 0.5, 24), mat, 0, 0.0, 0);
  add(turret, new RoundedBoxGeometry(1.2, 0.45, 1.5, 3, 0.18), mat, 0, 0.02, 0.2);
  const hatch = new THREE.Group(); hatch.position.set(0, 0.25, -0.3); turret.add(hatch);
  const lid = new THREE.Group(); lid.position.set(0, 0.02, -0.32); hatch.add(lid);
  add(hatch, new THREE.CylinderGeometry(0.33, 0.33, 0.1, 18), dark, 0, 0, 0);
  add(lid, new THREE.CylinderGeometry(0.32, 0.32, 0.07, 18), mat, 0, 0.04, 0.32);
  add(lid, new THREE.BoxGeometry(0.1, 0.06, 0.2), dark, 0, 0.1, 0.36);
  const gun = new THREE.Group(); gun.position.set(0, 0.05, 0.85); turret.add(gun);
  add(gun, new THREE.CylinderGeometry(0.1, 0.12, 2.1, 14), mat, 0, 0, 1.0, Math.PI / 2);
  add(gun, new THREE.CylinderGeometry(0.15, 0.15, 0.3, 14), dark, 0, 0, 2.05, Math.PI / 2);
  add(gun, new RoundedBoxGeometry(0.5, 0.35, 0.35, 2, 0.08), mat, 0, 0, 0);
  add(turret, new THREE.CylinderGeometry(0.012, 0.012, 1.2, 4), dark, 0.45, 0.8, -0.5);
  for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12), lamp, s * 0.75, 0.32, 2.12, Math.PI / 2);
  add(g, new RoundedBoxGeometry(1.4, 0.25, 0.4, 2, 0.08), dark, 0, 0.42, -1.9);
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, metalness: 0.8, roughness: 0.4 });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) add(g, new RoundedBoxGeometry(0.06, 0.42, 0.82, 2, 0.02), mat, s * 1.46, 0.02, -1.66 + i * 0.83, 0, 0, s * 0.04);   // armour skirts
    add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.35, 10), steel, s * 0.55, 0.38, -2.2, Math.PI / 2);                                   // exhausts
    add(g, new THREE.TorusGeometry(0.16, 0.02, 5, 14), steel, s * 0.6, 0.38, -1.4, Math.PI / 2);                                         // tow cable coil
    for (let i = 0; i < 3; i++) add(turret, new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), steel, s * (0.55 + i * 0.07), 0.15, 0.55 - i * 0.05, Math.PI / 2 - 0.4, 0, s * 0.5);  // smoke launchers
  }
  add(turret, new RoundedBoxGeometry(1.1, 0.36, 0.55, 3, 0.1), mat, 0, 0.02, -0.75);                                                     // turret bustle
  add(turret, new RoundedBoxGeometry(1.0, 0.04, 0.5, 2, 0.02), dark, 0, 0.21, -0.75);
  add(turret, new THREE.CylinderGeometry(0.2, 0.22, 0.2, 16), mat, -0.4, 0.33, -0.25);                                                    // commander cupola
  add(turret, new THREE.CylinderGeometry(0.018, 0.018, 0.55, 8), steel, -0.4, 0.52, 0.0, Math.PI / 2);                                  // roof gun
  add(turret, new RoundedBoxGeometry(0.08, 0.1, 0.2, 2, 0.02), steel, -0.4, 0.5, -0.25);
  add(gun, new THREE.CylinderGeometry(0.13, 0.13, 0.4, 14), dark, 0, 0, 1.15, Math.PI / 2);                                               // fume extractor
  bake(lid); bake(hatch, [lid]); bake(gun); bake(turret, [gun, hatch]); bake(g, [turret]);
  return { g, turret, gun, lid };
}
function planeModel(mat) {
  const g = new THREE.Group(), dark = mat.clone(); dark.name = 'dark'; dark.color.multiplyScalar(0.7);
  const body = new THREE.LatheGeometry([[0, -1.7], [0.18, -1.6], [0.3, -0.8], [0.42, 0.2], [0.44, 0.9], [0.38, 1.35], [0.2, 1.55], [0, 1.6]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
  add(g, body, mat, 0, 0, 0, Math.PI / 2);
  add(g, new RoundedBoxGeometry(4.6, 0.09, 0.85, 2, 0.04), mat, 0, -0.12, 0.35);                    // wing
  add(g, new RoundedBoxGeometry(1.7, 0.06, 0.45, 2, 0.03), mat, 0, 0.05, -1.45);                    // tailplane
  add(g, new RoundedBoxGeometry(0.06, 0.6, 0.55, 2, 0.03), mat, 0, 0.32, -1.45);                    // fin
  const canopy = new THREE.Group(); canopy.position.set(0, 0.32, 0.25); g.add(canopy);
  add(canopy, new THREE.SphereGeometry(0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0, 0).scale.set(1, 0.8, 1.6);
  const prop = new THREE.Group(); prop.position.set(0, 0, 1.66); g.add(prop);
  add(prop, new THREE.SphereGeometry(0.12, 12, 8), dark, 0, 0, 0.02).scale.set(1, 1, 1.4);
  for (const a of [0, Math.PI]) add(prop, new RoundedBoxGeometry(0.11, 0.85, 0.03, 2, 0.015), dark, 0, 0, 0, 0, 0, a).position.set(Math.sin(a) * 0, Math.cos(a) * 0.42, 0);
  for (const s of [-1, 1]) { add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6), dark, s * 0.55, -0.35, 0.55); const w = wheelMesh(0.15, 0.08, dark); w.position.set(s * 0.55, -0.55, 0.55); g.add(w); add(g, new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), dark, s * 1.3, -0.12, 0.78, Math.PI / 2); }
  const tw = wheelMesh(0.08, 0.05, dark); tw.position.set(0, -0.3, -1.45); g.add(tw);
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.8, roughness: 0.4 }), white = new THREE.MeshStandardMaterial({ color: 0xf1eee4, roughness: 0.5 });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) add(g, new THREE.CylinderGeometry(0.03, 0.035, 0.08, 8), steel, s * 0.36, 0.05, 1.15 - i * 0.14, 0, 0, s * 1.3);   // exhaust stacks
  for (const z of [-0.25, 0.0, 0.25]) add(canopy, new THREE.TorusGeometry(0.26, 0.015, 5, 16, Math.PI), dark, 0, 0, z, 0, Math.PI / 2, 0);                          // canopy frame
  for (const s of [-1, 1]) { add(g, new THREE.CylinderGeometry(0.32, 0.32, 0.012, 24), white, s * 1.6, -0.065, 0.35); add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.014, 24), dark, s * 1.6, -0.06, 0.35); add(g, new RoundedBoxGeometry(0.07, 0.03, 0.85, 2, 0.01), white, s * 0.9, -0.07, 0.35); }   // wing markings
  add(g, new THREE.CylinderGeometry(0.44, 0.44, 0.08, 20, 1, true), white, 0, 0, -0.6, Math.PI / 2);                                                         // fuselage band
  add(g, new RoundedBoxGeometry(1.75, 0.07, 0.08, 2, 0.02), white, 0, 0.05, -1.25);                                                                          // tail stripe
  add(prop, new THREE.ConeGeometry(0.13, 0.25, 14), white, 0, 0, 0.14, Math.PI / 2);                                                                         // spinner
  bake(prop); bake(canopy); bake(g, [prop, canopy]);
  return { g, prop, canopy };
}

// ------------------------------------------------------------------ the vehicle
export const JS = 0.6; // the 4x4 is built big, then shrunk to army-man scale
const JW = [[0.98, 1.3], [-0.98, 1.3], [0.98, -1.25], [-0.98, -1.25]].map(([x, z]) => [x * JS, z * JS]);
const SPECS = {
  jeep:  { half: [0.92 * JS, 0.38 * JS, 2.0 * JS], hp: 280, mass: 1.2, seats: [{ x: 0.25, y: 0.05, z: 0.03, label: 'driver', door: 1 }, { x: -0.25, y: 0.05, z: 0.03, label: 'passenger', door: 0 }, { x: 0, y: 0.47, z: -0.75, label: 'gunner', stand: true }], tp: [5.2, 2.0], fpEye: [0.25, 0.82, 0.0] },
  tank:  { half: [1.4, 0.55, 2.25], hp: 900, mass: 6, seats: [{ x: 0, y: 0.4, z: -0.45, hidden: true, label: 'commander' }], tp: [9, 3.4], fpEye: [0, 1.25, 0.2] },
  plane: { half: [0.55, 0.42, 1.65], hp: 220, mass: 1.4, seats: [{ x: 0, y: 0.05, z: 0.15, label: 'pilot' }], tp: [6.5, 1.8], fpEye: [0, 0.55, 0.2] },
};
export class Vehicle {
  constructor(scene, kind, team, color, x, z, yaw) {
    this.kind = kind; this.team = team; this.spec = SPECS[kind]; this.hp = this.spec.hp; this.seats = this.spec.seats.map(() => null);
    this.pad = { x, z, yaw }; this.scene = scene; this.alive = true; this.cool = 0; this.cool2 = 0; this.t = 0; this.color = color;
    this.mat = plasticMaterial(color, 'standard');
    this.root = new THREE.Group(); scene.add(this.root);
    if (kind === 'jeep') { const j = jeepModel(this.mat); this.model = j.g; this.doors = j.doors; this.mgYaw = j.mgYaw; this.mgPitch = j.mgPitch; this.barrels = j.barrels; this.mgYawA = 0; this.mgPitchA = 0; this.spin = 0; this.model.scale.setScalar(JS); this.wheels = []; for (const [wx, wz] of JW) { const w = wheelMesh(0.45, 0.32, this.mat); w.scale.setScalar(JS); this.root.add(w); this.wheels.push({ m: w, x: wx, z: wz }); } }
    else if (kind === 'tank') { const t = tankModel(this.mat); this.model = t.g; this.turret = t.turret; this.gun = t.gun; this.lid = t.lid; this.turretYaw = 0; this.gunPitch = 0; }
    else { const p = planeModel(this.mat); this.model = p.g; this.prop = p.prop; this.canopy = p.canopy; this.air = 0; }
    this.root.add(this.model);
    this.makeBody(x, z, yaw);
  }
  makeBody(x, z, yaw) {
    const s = this.spec, w = PH.world, q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
    const y = this.kind === 'jeep' ? 0.6 : this.kind === 'tank' ? 0.85 : 0.7;
    this.body = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setLinearDamping(this.kind === 'plane' ? 0.05 : 0.15).setAngularDamping(this.kind === 'tank' ? 2.5 : 0.9).setCcdEnabled(true).setCanSleep(false));
    const vol = s.half[0] * s.half[1] * s.half[2] * 8;
    w.createCollider(R.ColliderDesc.cuboid(...s.half).setDensity(s.mass / vol * 3).setFriction(this.kind === 'tank' ? 0.9 : 0.5).setRestitution(0.1).setCollisionGroups(DYN_GROUP), this.body);
    if (this.kind === 'plane') w.createCollider(R.ColliderDesc.cuboid(2.3, 0.06, 0.42).setTranslation(0, -0.12, 0.35).setDensity(0.2).setCollisionGroups(DYN_GROUP), this.body);
    if (this.kind === 'plane') w.createCollider(R.ColliderDesc.ball(0.17).setTranslation(0, -0.56, 0.55).setFriction(0.3).setCollisionGroups(DYN_GROUP), this.body), w.createCollider(R.ColliderDesc.ball(0.1).setTranslation(0, -0.33, -1.45).setFriction(0.1).setCollisionGroups(DYN_GROUP), this.body);
    if (this.kind !== 'plane') {
      const vc = w.createVehicleController(this.body); vc.indexUpAxis = 1; vc.setIndexForwardAxis = 2; this.vc = vc;
      const pts = this.kind === 'jeep' ? JW : [[1.15, 1.6], [-1.15, 1.6], [1.15, 0], [-1.15, 0], [1.15, -1.6], [-1.15, -1.6]];
      const r = this.kind === 'jeep' ? 0.45 * JS : 0.32, rest = this.kind === 'jeep' ? 0.38 * JS : 0.3, cy = this.kind === 'jeep' ? -0.15 * JS : -0.05;
      for (const [px, pz] of pts) vc.addWheel({ x: px, y: cy, z: pz }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, rest, r);
      for (let i = 0; i < pts.length; i++) { vc.setWheelSuspensionStiffness(i, this.kind === 'jeep' ? 30 : 40); vc.setWheelFrictionSlip(i, this.kind === 'jeep' ? 2.4 : 3); vc.setWheelMaxSuspensionForce(i, 4000); vc.setWheelSuspensionCompression(i, 2.6); vc.setWheelSuspensionRelaxation(i, 3.4); }
      this.wheelR = r; this.wheelCy = cy; this.wheelRest = rest;
    }
  }
  get pos() { const t = this.body.translation(); return V(t.x, t.y, t.z); }
  get quat() { const r = this.body.rotation(); return new THREE.Quaternion(r.x, r.y, r.z, r.w); }
  get yaw() { const f = V(0, 0, 1).applyQuaternion(this.quat); return Math.atan2(f.x, f.z); }
  get upright() { return V(0, 1, 0).applyQuaternion(this.quat).y; }
  get speed() { const v = this.body.linvel(); return Math.hypot(v.x, v.y, v.z); }
  local(v) { return v.clone().applyQuaternion(this.quat).add(this.pos); }
  seatWorld(i) { const s = this.spec.seats[i]; return this.local(V(s.x, s.y, s.z)); }
  doorWorld(i) { const s = this.spec.seats[i]; let side = this.kind === 'tank' ? V(0, 0, -this.spec.half[2] - 0.9) : V(Math.sign(s.x || 1) * (this.spec.half[0] + 0.55), 0, s.z); if (this.kind === 'plane') side.set(this.spec.half[0] + 1.3, 0, 0.4); if (s.stand) side = V(0, 0, -this.spec.half[2] - 0.6); const w = this.local(side); w.y = 0; return w; }
  // minigun on the 4x4: aim toward a world yaw/pitch
  aimGun(yaw, pitch, dt) { const local = yaw - this.yaw; let dy = ((local - this.mgYawA + Math.PI * 3) % (Math.PI * 2)) - Math.PI; this.mgYawA += clamp(dy, -4 * dt, 4 * dt); this.mgPitchA += clamp(clamp(pitch, -0.35, 0.6) - this.mgPitchA, -3 * dt, 3 * dt); this.mgYaw.rotation.y = this.mgYawA; this.mgPitch.rotation.x = -this.mgPitchA; }
  gunMuzzle() { const q = this.quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-this.mgPitchA, this.mgYawA, 0, 'YXZ'))); const d = V(0, 0, 1).applyQuaternion(q); const p = this.local(V(0, 1.36 * JS, -1.05 * JS)).add(V(0, 0, 0.2 * JS).applyQuaternion(q)).addScaledVector(d, 0.75 * JS); return { p, d }; }
  freeSeat() { return this.seats.findIndex((x) => !x); }
  // input: {x, y} stick, aimYaw/aimPitch (world), fire, alt
  drive(dt, inp) {
    this.t += dt; this.cool -= dt; this.cool2 -= dt;
    const b = this.body; const q = this.quat;
    if (this.kind === 'jeep' || this.kind === 'tank') {
      const vc = this.vc, sp = vc.currentVehicleSpeed(), n = vc.numWheels();
      const top = this.kind === 'jeep' ? 14 : 8.5, F = this.kind === 'jeep' ? 6 : 22;
      let thr = inp ? inp.y : 0, steer = inp ? -inp.x : 0;
      const eng = thr >= 0 ? F * thr * Math.max(0, 1 - sp / top) : F * thr * Math.max(0, 1 + sp / (top * 0.5));
      const braking = inp && ((thr < -0.1 && sp > 1.5) || (thr > 0.1 && sp < -1.5));
      for (let i = 0; i < n; i++) {
        vc.setWheelEngineForce(i, braking ? 0 : eng); vc.setWheelBrake(i, braking ? 2.2 : !inp || Math.abs(thr) < 0.05 ? 0.35 : 0);
        if (this.kind === 'jeep' && i < 2) { const cur = vc.wheelSteering(i) || 0; const want = steer * clamp(0.55 - Math.abs(sp) * 0.012, 0.3, 0.55); vc.setWheelSteering(i, cur + (want - cur) * Math.min(1, dt * 8)); }
      }
      if (this.kind === 'tank') { // skid steer: turn on the spot
        const av = b.angvel(), up = V(0, 1, 0).applyQuaternion(q); const want = steer * 1.9 * (thr < -0.1 ? -1 : 1);
        const cur = av.x * up.x + av.y * up.y + av.z * up.z, d = (want - cur) * Math.min(1, dt * 10);
        if (this.upright > 0.5) b.setAngvel({ x: av.x + up.x * d, y: av.y + up.y * d, z: av.z + up.z * d }, true);
        // turret follows the aim
        if (inp) { const local = inp.aimYaw - this.yaw; let dy = ((local - this.turretYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; this.turretYaw += clamp(dy, -1.6 * dt, 1.6 * dt); this.gunPitch += clamp(clamp(inp.aimPitch, -0.12, 0.35) - this.gunPitch, -dt, dt); }
        this.turret.rotation.y = this.turretYaw; this.gun.rotation.x = -this.gunPitch;
      }
      vc.updateVehicle(dt);
      // a toppled car rights itself slowly if someone is in it and pushing
      if (inp && this.upright < 0.3 && this.speed < 1.5) this.flipT = (this.flipT || 0) + dt; else this.flipT = 0;
    } else this.fly(dt, inp);
  }
  fly(dt, inp) {
    const b = this.body, q = this.quat, fwd = V(0, 0, 1).applyQuaternion(q), v = b.linvel(), vel = V(v.x, v.y, v.z);
    const thr = inp ? clamp(0.6 + inp.y * 0.4, 0.2, 1) : 0; const target = inp ? thr * 24 : 0;
    this.air += ((inp ? target : 0) - this.air) * Math.min(1, dt * (inp ? 0.8 : 0.4));
    const airborne = this.pos.y > 1.2 || this.air > 10;
    this.prop.rotation.z += dt * (6 + this.air * 3);
    if (!inp) { b.setGravityScale(1, true); return; }
    // point the nose where the pilot is looking, banking into turns
    const aim = V(Math.sin(inp.aimYaw) * Math.cos(inp.aimPitch), Math.sin(inp.aimPitch), Math.cos(inp.aimYaw) * Math.cos(inp.aimPitch));
    if (!airborne) aim.y = Math.max(0.0, aim.y) * (this.air / 10);
    const yawErr = ((inp.aimYaw - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const bank = clamp(-yawErr * 1.4 - inp.x * 0.6, -1.1, 1.1) * (airborne ? 1 : 0);
    const look = new THREE.Matrix4().lookAt(V(0, 0, 0), aim.clone().negate(), V(0, 1, 0)); const qt = new THREE.Quaternion().setFromRotationMatrix(look);
    qt.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), bank));
    const dq = qt.clone().multiply(q.clone().invert()); if (dq.w < 0) { dq.x *= -1; dq.y *= -1; dq.z *= -1; dq.w *= -1; }
    const ang = 2 * Math.acos(clamp(dq.w, -1, 1)), s = Math.sqrt(1 - dq.w * dq.w) || 1; const rate = airborne ? 2.2 : 1.2;
    const av = ang > 1e-4 ? V(dq.x / s, dq.y / s, dq.z / s).multiplyScalar(Math.min(ang * rate, 2.6)) : V(0, 0, 0);
    b.setAngvel({ x: av.x, y: av.y, z: av.z }, true);
    // fly along the nose; too slow and gravity wins
    const lift = clamp((this.air - 8) / 8, 0, 1);
    const want = fwd.multiplyScalar(this.air); if (this.air > 9) want.y = Math.max(want.y, aim.y * this.air * 0.7); want.y += (vel.y - want.y) * (1 - lift);
    b.setGravityScale(1 - lift * 0.97, true); // wings carry the weight once fast enough
    const nv = vel.lerp(want, Math.min(1, dt * (airborne ? 4 : 6)));
    b.setLinvel({ x: nv.x, y: nv.y, z: nv.z }, true);
  }
  // simple ray vs this vehicle's box (for bullets)
  ray(o, d, maxT) {
    const qi = this.quat.invert(), lo = o.clone().sub(this.pos).applyQuaternion(qi), ld = d.clone().applyQuaternion(qi), h = this.spec.half;
    let t0 = 0, t1 = maxT;
    for (const [oo, dd, e] of [[lo.x, ld.x, h[0] * (this.kind === 'plane' ? 4 : 1)], [lo.y, ld.y, h[1] + (this.kind === 'tank' ? 0.5 : 0.3)], [lo.z, ld.z, h[2]]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < -e || oo > e) return Infinity; continue; }
      let a = (-e - oo) / dd, c = (e - oo) / dd; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return Infinity;
    }
    return t0;
  }
  // point inside (soldiers walking into the vehicle, getting run over)
  contains(p, pad = 0.3) { const l = p.clone().sub(this.pos).applyQuaternion(this.quat.invert()), h = this.spec.half; return Math.abs(l.x) < h[0] + pad && Math.abs(l.z) < h[2] + pad && l.y > -h[1] - 1.2 && l.y < h[1] + 0.6; }
  sync() {
    const t = this.body.translation(), r = this.body.rotation(); this.root.position.set(t.x, t.y, t.z); this.root.quaternion.set(r.x, r.y, r.z, r.w);
    if (this.barrels) { this.spin = Math.max(0, this.spin - 0.016 * 1.2); this.barrels.rotation.z += this.spin * 0.9; }
    if (this.vc && this.wheels) for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i], susp = this.vc.wheelSuspensionLength(i) ?? this.wheelRest;
      w.m.position.set(w.x, this.wheelCy - susp, w.z); w.m.rotation.set(this.vc.wheelRotation(i) || 0, this.vc.wheelSteering(i) || 0, 0, 'YXZ');
    }
  }
  flipUpright() { const y = this.yaw, q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), y); const p = this.pos; this.body.setTranslation({ x: p.x, y: p.y + 1.2, z: p.z }, true); this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true); this.body.setLinvel({ x: 0, y: 2, z: 0 }, true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true); }
  destroy() {
    this.alive = false; this.wreckT = 0;
    this.mat.color.multiplyScalar(0.25); this.mat.roughness = 0.9;
    const p = this.pos; this.body.applyImpulse({ x: (Math.random() - 0.5) * 6 * this.body.mass(), y: 9 * this.body.mass(), z: (Math.random() - 0.5) * 6 * this.body.mass() }, true);
    this.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * 4 * this.body.mass(), y: 0, z: (Math.random() - 0.5) * 4 * this.body.mass() }, true);
  }
  respawn() {
    if (this.vc) { PH.world.removeVehicleController(this.vc); this.vc = null; }
    PH.world.removeRigidBody(this.body); this.mat.dispose(); this.mat = plasticMaterial(this.color, 'standard');
    this.root.traverse((o) => { if (o.isMesh && o.material !== rubber && o.material !== glass && o.material !== lamp) { o.material = o.material.name === 'dark' ? o.material : this.mat; } });
    this.hp = this.spec.hp; this.alive = true; this.seats = this.seats.map(() => null); this.air = 0; if (this.lid) this.lid.rotation.x = 0; if (this.doors) for (const d of this.doors) d.rotation.y = 0;
    this.makeBody(this.pad.x, this.pad.z, this.pad.yaw);
  }
  dispose() { if (this.vc) try { PH.world.removeVehicleController(this.vc); } catch (e) {} this.scene.remove(this.root); }
}
// where each battlefield parks its vehicles: [kind, x, z, yaw]
export const PADS = {
  living: [['jeep', -36, 30, Math.PI / 2], ['jeep', 36, -26, -Math.PI / 2], ['tank', -30, -2, Math.PI / 2], ['tank', 30, 2, -Math.PI / 2], ['plane', -18, 38, Math.PI / 2], ['plane', 18, -25, -Math.PI / 2]],
  kitchen: [['jeep', -36, 0, Math.PI / 2], ['jeep', 36, 0, -Math.PI / 2], ['jeep', -10, 38, Math.PI / 2], ['jeep', 10, 38, -Math.PI / 2]],
  backyard: [['jeep', -44, 14, Math.PI / 2], ['jeep', 44, -14, -Math.PI / 2], ['tank', -40, -10, Math.PI / 2], ['tank', 40, 10, -Math.PI / 2], ['plane', -51, -32, 0], ['plane', 51, 32, Math.PI]],
};

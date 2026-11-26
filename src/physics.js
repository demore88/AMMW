// Army Men: Microplastic Warfare — Rapier physics: ragdolls, getting back up, bouncing grenades, tumbling wrecks.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export let R = null;
export const PH = { world: null, ready: false, acc: 0 };
const WORLD_GROUP = 0x0001ffff;           // statics: member of group 1, collide with all
const PART_GROUP = (0x0002 << 16) | 0x0005; // ragdoll parts: member 2, collide only with the world
export const DYN_GROUP = (0x0004 << 16) | 0x0007; // grenades/vehicles: member 4, collide with world, parts, dynamics

export async function initPhysics() { await RAPIER.init(); R = RAPIER; PH.ready = true; }

export function buildPhysicsWorld(world) {
  if (PH.world) PH.world.free();
  const w = new R.World({ x: 0, y: -22, z: 0 }); PH.world = w; PH.acc = 0;
  const ground = w.createRigidBody(R.RigidBodyDesc.fixed());
  w.createCollider(R.ColliderDesc.cuboid(world.half * 2, 1, world.half * 2).setTranslation(0, -1, 0).setFriction(0.9).setCollisionGroups(WORLD_GROUP), ground);
  for (const b of world.boxes) {
    const hx = (b.maxX - b.minX) / 2, hy = (b.top - b.y0) / 2, hz = (b.maxZ - b.minZ) / 2;
    w.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation((b.minX + b.maxX) / 2, (b.y0 + b.top) / 2, (b.minZ + b.maxZ) / 2).setFriction(0.8).setCollisionGroups(WORLD_GROUP), ground);
  }
  return w;
}
export function stepPhysics(dt) {
  if (!PH.world) return; PH.acc += Math.min(dt, 0.1); let n = 0;
  while (PH.acc >= 1 / 60 && n++ < 4) { PH.world.timestep = 1 / 60; PH.world.step(); PH.acc -= 1 / 60; }
}

// ------------------------------------------------------------------ ragdolls
// pieces: torso (with head), aim (arms + weapon), two thighs, two shins
const tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();
const SHAPES = {
  torso: { c: [0, 0.22, 0], make: () => R.ColliderDesc.capsule(0.15, 0.13) },
  aim:   { c: [0, -0.04, 0.16], make: () => R.ColliderDesc.cuboid(0.17, 0.07, 0.24) },
  thigh: { c: [0, -0.1, 0], make: () => R.ColliderDesc.capsule(0.06, 0.06) },
  shin:  { c: [0, -0.15, 0.02], make: () => R.ColliderDesc.capsule(0.08, 0.055) },
};
export function startRagdoll(m, push, spin = 3) {
  const w = PH.world; if (!w || m.rag) return;
  m.root.updateMatrixWorld(true);
  const parts = [
    { o: m.torso, k: 'torso' }, { o: m.aim, k: 'aim' },
    { o: m.legs[0], k: 'thigh' }, { o: m.legs[1], k: 'thigh' }, { o: m.knees[0], k: 'shin' }, { o: m.knees[1], k: 'shin' },
  ];
  const scene = m.root.parent;
  for (const p of parts) {
    p.parent = p.o.parent; p.local = { pos: p.o.position.clone(), quat: p.o.quaternion.clone() };
    p.o.matrixWorld.decompose(tmpP, tmpQ, tmpS);
    const c = new THREE.Vector3(...SHAPES[p.k].c); p.off = c;
    const centre = c.clone().applyQuaternion(tmpQ).add(tmpP);
    const body = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(centre.x, centre.y, centre.z).setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w }).setLinearDamping(0.4).setAngularDamping(1.2).setCcdEnabled(true));
    w.createCollider(SHAPES[p.k].make().setDensity(p.k === 'torso' ? 3 : 2).setFriction(0.9).setRestitution(0.15).setCollisionGroups(PART_GROUP), body);
    const v = push.clone().multiplyScalar(p.k === 'torso' || p.k === 'aim' ? 1 : 0.8).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6));
    body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    body.setAngvel({ x: (Math.random() - 0.5) * spin, y: (Math.random() - 0.5) * spin, z: (Math.random() - 0.5) * spin }, true);
    p.body = body; p.worldPos = tmpP.clone();
    scene.attach(p.o); // keep world transform, now driven by physics
  }
  const [torso, aim, tL, tR, sL, sR] = parts;
  const jointAt = (a, b, worldPoint, hinge) => {
    const la = toLocal(a.body, worldPoint), lb = toLocal(b.body, worldPoint);
    const data = hinge ? R.JointData.revolute(la, lb, hinge) : R.JointData.spherical(la, lb);
    const j = w.createImpulseJoint(data, a.body, b.body, true);
    if (hinge) { j.setLimits(-0.1, 2.3); }
    return j;
  };
  const wp = (o) => { o.updateMatrixWorld(true); return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld); };
  const hipL = wp(tL.o), hipR = wp(tR.o), kneeL = wp(sL.o), kneeR = wp(sR.o);
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(m.root.quaternion);
  const shoulder = wp(aim.o);
  parts.joints = [jointAt(torso, tL, hipL), jointAt(torso, tR, hipR), jointAt(tL, sL, kneeL, toLocalDir(tL.body, side)), jointAt(tR, sR, kneeR, toLocalDir(tR.body, side)), jointAt(torso, aim, shoulder)];
  m.rag = { parts, t: 0 };
}
function toLocal(body, p) { const t = body.translation(), r = body.rotation(); const q = new THREE.Quaternion(r.x, r.y, r.z, r.w).invert(); const v = p.clone().sub(new THREE.Vector3(t.x, t.y, t.z)).applyQuaternion(q); return { x: v.x, y: v.y, z: v.z }; }
function toLocalDir(body, d) { const r = body.rotation(); const v = d.clone().applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w).invert()).normalize(); return { x: v.x, y: v.y, z: v.z }; }
// copy physics onto the meshes
export function syncRagdoll(m) {
  if (!m.rag || m.rag.getup) return;
  for (const p of m.rag.parts) {
    const t = p.body.translation(), r = p.body.rotation();
    p.o.quaternion.set(r.x, r.y, r.z, r.w); p.o.position.set(t.x, t.y, t.z).sub(p.off.clone().applyQuaternion(p.o.quaternion));
  }
}
export function ragdollCentre(m) { const b = m.rag.parts[0].body; if (!b) return m.rag.parts[0].o.getWorldPosition(new THREE.Vector3()); const t = b.translation(); return new THREE.Vector3(t.x, t.y, t.z); }
export function ragdollSpeed(m) { let s = 0; for (const p of m.rag.parts) { if (!p.body) continue; const v = p.body.linvel(); s = Math.max(s, Math.hypot(v.x, v.y, v.z)); } return s; }
export function ragdollFaceUp(m) { if (!m.rag.parts[0].body) return true; const r = m.rag.parts[0].body.rotation(); const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)); return fwd.y > 0; }
export function nudgeRagdoll(m, v) { if (!m.rag) return; for (const p of m.rag.parts) if (p.body) p.body.applyImpulse({ x: v.x, y: v.y, z: v.z }, true); }
// free the bodies and put the pieces back in the soldier's own hierarchy
export function endRagdoll(m) {
  if (!m.rag) return; const w = PH.world;
  if (w) freeBodies(m.rag.parts);
  for (const p of m.rag.parts) { p.parent.add(p.o); p.o.position.copy(p.local.pos); p.o.quaternion.copy(p.local.quat); }
  m.rag = null;
}
// removing a body also removes its joints, so only bodies are removed, and only once
function freeBodies(parts) {
  for (const p of parts) if (p.body) { if (PH.world.bodies.contains(p.body.handle)) PH.world.removeRigidBody(p.body); p.body = null; }
  parts.joints = [];
}
// getting up: tween each piece from where it lies back into the stand pose
export function startGetUp(m, root) {
  const rag = m.rag; if (!rag) return;
  const faceUp = ragdollFaceUp(m);
  const from = rag.parts.map((p) => ({ pos: p.o.position.clone(), quat: p.o.quaternion.clone() }));
  freeBodies(rag.parts);
  // put pieces back in the hierarchy (stand pose) to learn their target world transforms
  const targets = rag.parts.map((p) => { p.parent.add(p.o); p.o.position.copy(p.local.pos); p.o.quaternion.copy(p.local.quat); return p; });
  root.updateMatrixWorld(true);
  const to = targets.map((p) => { p.o.matrixWorld.decompose(tmpP, tmpQ, tmpS); return { pos: tmpP.clone(), quat: tmpQ.clone() }; });
  const scene = root.parent; for (const p of rag.parts) scene.attach(p.o);
  rag.getup = { t: 0, from, to, faceUp };
}
// returns true once standing
export function updateGetUp(m, dt) {
  const g = m.rag?.getup; if (!g) return true;
  g.t += dt; const dur = 1.1, k = Math.min(1, g.t / dur);
  // push up off the ground: hips first, then the torso swings upright
  for (let i = 0; i < m.rag.parts.length; i++) {
    const p = m.rag.parts[i], kk = i < 2 ? smooth(clamp01((k - 0.25) / 0.75)) : smooth(clamp01(k / 0.7));
    p.o.position.lerpVectors(g.from[i].pos, g.to[i].pos, kk);
    if (i < 2) p.o.position.y += Math.sin(kk * Math.PI) * 0.12;
    p.o.quaternion.slerpQuaternions(g.from[i].quat, g.to[i].quat, kk);
  }
  if (k >= 1) { endRagdoll(m); return true; }
  return false;
}
const clamp01 = (v) => Math.max(0, Math.min(1, v)), smooth = (t) => t * t * (3 - 2 * t);

// ------------------------------------------------------------------ simple dynamic props (grenades etc.)
export function ballBody(p, v, r = 0.11) {
  const b = PH.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setLinvel(v.x, v.y, v.z).setCcdEnabled(true).setAngularDamping(0.6));
  PH.world.createCollider(R.ColliderDesc.ball(r).setRestitution(0.45).setFriction(0.7).setDensity(3).setCollisionGroups(DYN_GROUP), b);
  return b;
}
export function removeBody(b) { if (b && PH.world && PH.world.bodies.contains(b.handle)) PH.world.removeRigidBody(b); }

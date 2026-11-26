// Army Men: Microplastic Warfare — procedural textures: colour, normal and roughness maps drawn in code.
import * as THREE from 'three';

export const rnd = (a, b) => a + Math.random() * (b - a);
export function mkCanvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(c, rep = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; return t;
}
// a greyscale height canvas -> tangent-space normal map
export function normalFrom(hc, strength = 2, rep = 1) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = mkCanvas(w, h), g = out.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const L = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / L * 0.5 + 0.5) * 255; d[i + 1] = (dy / L * 0.5 + 0.5) * 255; d[i + 2] = (1 / L * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return tex(out, rep, false);
}
function blurCanvas(c, px) { const o = mkCanvas(c.width, c.height), g = o.getContext('2d'); g.filter = `blur(${px}px)`; g.drawImage(c, 0, 0); return o; }

// ---------- materials sets: {map, normalMap, roughnessMap?}
export function woodFloor(rep = 5) {
  const S = 1024, c = mkCanvas(S), g = c.getContext('2d'), hc = mkCanvas(S), hg = hc.getContext('2d');
  hg.fillStyle = '#888'; hg.fillRect(0, 0, S, S);
  const rows = 8, rh = S / rows, tones = ['#b07a45', '#a36d3a', '#bb8650', '#9a6533', '#ae7b48', '#c08e57'];
  for (let r = 0; r < rows; r++) {
    let x = -((r * 337) % 600);
    while (x < S) {
      const len = rnd(380, 720), col = tones[(Math.random() * tones.length) | 0];
      g.fillStyle = col; g.fillRect(x, r * rh, len, rh);
      for (let k = 0; k < 46; k++) { const yy = r * rh + rnd(4, rh - 4); g.strokeStyle = `rgba(${60 + rnd(0, 30)},${30 + rnd(0, 20)},10,${rnd(0.06, 0.2)})`; g.lineWidth = rnd(0.6, 2.2); g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + len * 0.3, yy + rnd(-5, 5), x + len * 0.7, yy + rnd(-5, 5), x + len, yy + rnd(-3, 3)); g.stroke(); }
      if (Math.random() < 0.5) { const kx = x + rnd(40, len - 40), ky = r * rh + rnd(20, rh - 20); const gr = g.createRadialGradient(kx, ky, 1, kx, ky, 16); gr.addColorStop(0, 'rgba(60,30,10,.6)'); gr.addColorStop(1, 'rgba(60,30,10,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(kx, ky, 22, 9, 0, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(40,20,8,.75)'; g.fillRect(x, r * rh, 3, rh); hg.fillStyle = '#222'; hg.fillRect(x, r * rh, 4, rh);
      x += len;
    }
    g.fillStyle = 'rgba(40,20,8,.8)'; g.fillRect(0, r * rh, S, 3); hg.fillStyle = '#222'; hg.fillRect(0, r * rh, S, 4);
  }
  // a varnish sheen variation
  const rc = mkCanvas(256), rg = rc.getContext('2d'); rg.fillStyle = '#6a6a6a'; rg.fillRect(0, 0, 256, 256); for (let i = 0; i < 400; i++) { rg.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},.05)`; rg.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'; rg.beginPath(); rg.arc(rnd(0, 256), rnd(0, 256), rnd(6, 30), 0, 7); rg.fill(); }
  return { map: tex(c, rep), normalMap: normalFrom(blurCanvas(hc, 1.2), 3, rep), roughnessMap: tex(rc, rep * 0.6, false) };
}
export function fabric(base, rep = 4, weave = '#000') {
  const S = 256, c = mkCanvas(S), g = c.getContext('2d'), hc = mkCanvas(S), hg = hc.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, S, S); hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 4) { const on = ((x >> 2) + (y >> 2)) % 2; hg.fillStyle = on ? '#b0b0b0' : '#505050'; hg.fillRect(x, y, 4, 4); g.fillStyle = on ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; g.fillRect(x, y, 4, 4); }
  for (let i = 0; i < 1500; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; g.fillRect(rnd(0, S), rnd(0, S), rnd(1, 3), rnd(1, 3)); }
  return { map: tex(c, rep), normalMap: normalFrom(hc, 1.4, rep) };
}
export function rug() {
  const S = 1024, c = mkCanvas(S), g = c.getContext('2d');
  g.fillStyle = '#7d2622'; g.fillRect(0, 0, S, S);
  const band = (inset, col, wdt) => { g.strokeStyle = col; g.lineWidth = wdt; g.strokeRect(inset, inset, S - inset * 2, S - inset * 2); };
  band(40, '#e3b96a', 26); band(80, '#1d3a58', 16); band(110, '#e3b96a', 5);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * S; for (const [x, y] of [[a, 60], [a, S - 60], [60, a], [S - 60, a]]) { g.fillStyle = '#1d3a58'; g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 12, y); g.lineTo(x, y + 12); g.lineTo(x - 12, y); g.fill(); } }
  g.save(); g.translate(S / 2, S / 2);
  for (let r = 0; r < 4; r++) { g.rotate(Math.PI / 2); g.fillStyle = '#e3b96a'; g.beginPath(); g.moveTo(0, -300); g.bezierCurveTo(90, -220, 90, -120, 0, -60); g.bezierCurveTo(-90, -120, -90, -220, 0, -300); g.fill(); g.fillStyle = '#1d3a58'; g.beginPath(); g.arc(0, -200, 34, 0, 7); g.fill(); }
  g.rotate(Math.PI / 4); g.fillStyle = '#1d3a58'; g.fillRect(-120, -120, 240, 240); g.fillStyle = '#e3b96a'; g.fillRect(-80, -80, 160, 160); g.fillStyle = '#7d2622'; g.fillRect(-46, -46, 92, 92);
  g.restore();
  for (let i = 0; i < 30000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)'; g.fillRect(rnd(0, S), rnd(0, S), 2, 2); }
  const hc = mkCanvas(256), hg = hc.getContext('2d'); hg.fillStyle = '#808080'; hg.fillRect(0, 0, 256, 256); for (let i = 0; i < 9000; i++) { hg.fillStyle = Math.random() < 0.5 ? '#fff' : '#000'; hg.globalAlpha = 0.25; hg.fillRect(rnd(0, 256), rnd(0, 256), 2, 2); }
  return { map: tex(c, 1), normalMap: normalFrom(blurCanvas(hc, 0.7), 1.6, 6) };
}
export function tiles(rep = 10) {
  const S = 512, c = mkCanvas(S), g = c.getContext('2d'), hc = mkCanvas(S), hg = hc.getContext('2d'), T = S / 2;
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const dark = (x + y) % 2; g.fillStyle = dark ? '#2e3440' : '#efe9dc'; g.fillRect(x * T, y * T, T, T);
    for (let i = 0; i < 300; i++) { g.fillStyle = dark ? 'rgba(255,255,255,.04)' : 'rgba(120,100,70,.05)'; g.beginPath(); g.arc(x * T + rnd(0, T), y * T + rnd(0, T), rnd(2, 14), 0, 7); g.fill(); } }
  hg.fillStyle = '#ccc'; hg.fillRect(0, 0, S, S); g.fillStyle = '#9d968a'; hg.fillStyle = '#333';
  for (let i = 0; i <= 2; i++) { g.fillRect(i * T - 5, 0, 10, S); g.fillRect(0, i * T - 5, S, 10); hg.fillRect(i * T - 6, 0, 12, S); hg.fillRect(0, i * T - 6, S, 12); }
  const rc = mkCanvas(S), rg = rc.getContext('2d'); rg.fillStyle = '#2a2a2a'; rg.fillRect(0, 0, S, S); rg.fillStyle = '#e0e0e0'; for (let i = 0; i <= 2; i++) { rg.fillRect(i * T - 6, 0, 12, S); rg.fillRect(0, i * T - 6, S, 12); }
  return { map: tex(c, rep), normalMap: normalFrom(blurCanvas(hc, 2), 2.5, rep), roughnessMap: tex(rc, rep, false) };
}
export function grassGround(rep = 6) {
  const S = 512, c = mkCanvas(S), g = c.getContext('2d'); g.fillStyle = '#4a7f2a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) { const x = rnd(0, S), y = rnd(0, S), r = rnd(30, 90), gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, Math.random() < 0.3 ? 'rgba(110,80,40,.35)' : 'rgba(90,140,50,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 14000; i++) { g.strokeStyle = ['#3e7322', '#5d9a35', '#6fae40', '#3a6b20', '#86b84f', '#2f5a18'][(Math.random() * 6) | 0]; const x = rnd(0, S), y = rnd(0, S); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-3, 3), y - rnd(3, 9)); g.stroke(); }
  const hc = mkCanvas(256), hg = hc.getContext('2d'); hg.fillStyle = '#808080'; hg.fillRect(0, 0, 256, 256); for (let i = 0; i < 6000; i++) { hg.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.3)'; hg.fillRect(rnd(0, 256), rnd(0, 256), 1.5, rnd(2, 5)); }
  return { map: tex(c, rep), normalMap: normalFrom(hc, 2, rep * 2) };
}
export function sand(rep = 3) {
  const S = 256, c = mkCanvas(S), g = c.getContext('2d'); g.fillStyle = '#dcc488'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { g.fillStyle = ['#cbb070', '#ead7a3', '#c2a564', '#f3e5bd'][(Math.random() * 4) | 0]; g.fillRect(rnd(0, S), rnd(0, S), rnd(1, 2.4), rnd(1, 2.4)); }
  const hc = mkCanvas(S), hg = hc.getContext('2d'); hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) { hg.strokeStyle = 'rgba(255,255,255,.25)'; hg.lineWidth = rnd(3, 8); hg.beginPath(); const y = rnd(0, S); hg.moveTo(0, y); hg.bezierCurveTo(80, y + rnd(-20, 20), 170, y + rnd(-20, 20), S, y); hg.stroke(); }
  for (let i = 0; i < 5000; i++) { hg.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.4)' : 'rgba(0,0,0,.4)'; hg.fillRect(rnd(0, S), rnd(0, S), 1.5, 1.5); }
  return { map: tex(c, rep), normalMap: normalFrom(blurCanvas(hc, 1), 2, rep) };
}
export function wallpaper(base, stripe, rep = 6) {
  const S = 256, c = mkCanvas(S), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, S, S);
  g.fillStyle = stripe; for (let x = 0; x < S; x += 64) g.fillRect(x + 20, 0, 24, S);
  g.fillStyle = 'rgba(255,255,255,.18)'; for (let y = 16; y < S; y += 64) for (let x = 0; x < S; x += 64) { g.beginPath(); g.moveTo(x + 32, y); g.lineTo(x + 40, y + 10); g.lineTo(x + 32, y + 20); g.lineTo(x + 24, y + 10); g.fill(); }
  for (let i = 0; i < 2000; i++) { g.fillStyle = 'rgba(0,0,0,.03)'; g.fillRect(rnd(0, S), rnd(0, S), 2, 2); }
  return { map: tex(c, rep) };
}
export function woodGrain(base = '#9a6a3a', rep = 1) {
  const S = 256, c = mkCanvas(S), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let k = 0; k < 70; k++) { const y = rnd(0, S); g.strokeStyle = `rgba(50,25,8,${rnd(0.08, 0.28)})`; g.lineWidth = rnd(0.6, 2.5); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + rnd(-8, 8), 170, y + rnd(-8, 8), S, y); g.stroke(); }
  return { map: tex(c, rep) };
}
export function label(draw, w = 512, h = 512) { const c = mkCanvas(w, h); draw(c.getContext('2d'), w, h); const t = tex(c, 1); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; }
export function softSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = mkCanvas(64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, inner); gr.addColorStop(0.4, inner.replace(/[\d.]+\)$/, '0.55)')); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function smokeSprite() {
  const c = mkCanvas(128), g = c.getContext('2d');
  for (let i = 0; i < 14; i++) { const x = 64 + rnd(-22, 22), y = 64 + rnd(-22, 22), r = rnd(18, 36), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function flashSprite() {
  const c = mkCanvas(128), g = c.getContext('2d'); g.translate(64, 64);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 40); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.35, 'rgba(255,200,90,.9)'); gr.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = gr; g.fillRect(-64, -64, 128, 128);
  g.fillStyle = 'rgba(255,230,150,.9)'; for (let i = 0; i < 7; i++) { g.rotate((Math.PI * 2) / 7 + rnd(-0.2, 0.2)); g.beginPath(); g.moveTo(-5, 0); g.lineTo(0, -rnd(40, 62)); g.lineTo(5, 0); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function scorchTex() {
  const c = mkCanvas(128), g = c.getContext('2d');
  for (let i = 0; i < 10; i++) { const x = 64 + rnd(-14, 14), y = 64 + rnd(-14, 14), r = rnd(30, 56), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(15,10,5,.55)'); gr.addColorStop(1, 'rgba(15,10,5,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

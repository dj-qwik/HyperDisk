'use strict';
/* =====================================================================================
   HYPER DISC — zero-g disc duels above a neon megacity.
   One page: renderer + post, procedural textures, the arena and city, podium stations,
   discs, runners, CPU brains, split-screen cameras, HUD, lobby, online rooms, main loop.
   ===================================================================================== */

/* ================= utilities ================= */
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const dampAng = (a, b, k, dt) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const store = {
  get(k, d) { try { const v = localStorage.getItem('hyperdisc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('hyperdisc.' + k, JSON.stringify(v)); } catch (e) {} }
};
const IS_TOUCH = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();

/* ================= constants ================= */
const PCOL = [0x19e6ff, 0xff2fa8, 0xffc21a, 0x7cff4f];
const PCSS = ['#19e6ff', '#ff2fa8', '#ffc21a', '#7cff4f'];
const PNAME = ['NOVA', 'VEX', 'KAIRO', 'JINX'];
const CPU_NAMES = ['RAZOR', 'HALCYON', 'GHOSTWIRE', 'MANTIS', 'SPECTRE', 'OKAMI', 'NULLSET', 'VANTA', 'ZERO-9', 'KESTREL', 'SABLE', 'ONYX'];
const SKILLS = [
  { name: 'ROOKIE', react: 0.62, turn: 2.6, noise: 0.12, block: 0.22, dodge: 0.25, bank: 0, power: 0.05, lead: 0.0, think: 0.75, spread: 0.07, gap: 4.2, settle: 1.0, maxOut: 1, minScore: -1.6 },
  { name: 'RUNNER', react: 0.4, turn: 4.0, noise: 0.065, block: 0.5, dodge: 0.45, bank: 0.1, power: 0.15, lead: 0.5, think: 0.5, spread: 0.04, gap: 3.3, settle: 0.8, maxOut: 1, minScore: -1.2 },
  { name: 'ELITE', react: 0.24, turn: 6.0, noise: 0.03, block: 0.75, dodge: 0.65, bank: 0.3, power: 0.3, lead: 0.85, think: 0.32, spread: 0.02, gap: 2.6, settle: 0.6, maxOut: 2, minScore: -0.9 },
  { name: 'NIGHTMARE', react: 0.14, turn: 9.0, noise: 0.012, block: 0.93, dodge: 0.85, bank: 0.45, power: 0.42, lead: 1.0, think: 0.2, spread: 0.008, gap: 2.1, settle: 0.5, maxOut: 2, minScore: -0.7 }
];
const ARENAS = [
  { id: 'rings', name: 'HALO RINGS', desc: 'One podium, three rings. Shatter the rings or knock them off the edge.', triad: false, lifts: false, wall: false },
  { id: 'triad', name: 'TRIAD', desc: 'Three podiums each. Hop between them when the floor goes.', triad: true, lifts: false, wall: false },
  { id: 'pistons', name: 'PISTONS', desc: 'Your podiums rise and fall. Time your hops.', triad: true, lifts: true, wall: false },
  { id: 'firewall', name: 'FIREWALL', desc: 'A spinning wall of blocks between you. Blast through it or bank over it.', triad: false, lifts: false, wall: true },
  { id: 'overdrive', name: 'OVERDRIVE', desc: 'Pistons and the firewall, all at once.', triad: true, lifts: true, wall: true },
  { id: 'random', name: 'RANDOM', desc: 'A different arena every match.' }
];
const QUALS = [
  { name: 'PERFORMANCE', pr: 1, shadow: 1024, samples: 0, bloomScale: 0.5, city: 0.55 },
  { name: 'HIGH', pr: 1.5, shadow: 2048, samples: 4, bloomScale: 1, city: 1 },
  { name: 'ULTRA', pr: 2, shadow: 4096, samples: 4, bloomScale: 1, city: 1.25 }
];

// arena geometry
const RA = 30;          // wall radius (disc bounce surface sits a little inside)
const R_BOUNCE = RA - 0.9;
const YC = 17;          // ceiling height (bounce plane)
const RS = 15;          // station distance from center
const HAND_Y = 1.38;    // throw height above feet
const CHEST_Y = 1.3;
const RB = 8.2;         // firewall ring radius

// disc tuning
const D_SPEED = 27, D_POWER = 38, D_RET = 33, D_MAXB = 3, D_MAXT = 4.6, D_R = 0.42, D_COOL = 0.3, D_CHARGE = 0.45;
// body tuning
const RUN = 4.7, GRAV = 24, HOP_V = 8.2, HOP_H = 4.3, KB_BASE = 7.6, KB_HEAT = 0.28, KB_POWER = 1.45, FRICT = 4.2;
const SHIELD_DRAIN = 46, SHIELD_REGEN = 15, SHIELD_MIN = 14, SHIELD_ARC = 1.3, SHIELD_R = 1.45;
const RING_FLASH = 1.2, RING_GONE = 7, RING_REFORM = 0.8;

/* ================= settings ================= */
const S = {
  arena: store.get('arena', 0), lives: store.get('lives', 3), cpus: store.get('cpus', 1), skill: store.get('skill', 1),
  guide: store.get('guide', true), quality: store.get('quality', IS_TOUCH ? 0 : 1), music: store.get('music', true)
};
if (!(S.quality in QUALS)) S.quality = 1;

/* ================= renderer & post ================= */
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputEncoding = THREE.LinearEncoding;    // the final pass tone maps and encodes
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.autoClear = true;
const MAXANI = Math.min(16, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 8);

const scene = new THREE.Scene();
const FOG_COL = new THREE.Color(0x0a0618);
scene.fog = new THREE.FogExp2(FOG_COL.getHex(), 0.0058);

let DW = 1, DH = 1, sceneRT = null, bloomPass = null, finalQuad = null, finalMat = null, pixelRatio = 1;
finalMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uExposure: { value: 0.95 }, uAberr: { value: 0.0025 }, uRes: { value: new THREE.Vector2(1, 1) },
    uViews: { value: [new THREE.Vector4(0, 0, 1, 1), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uFlash: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, uNV: { value: 1 }
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uExposure, uAberr; uniform vec2 uRes;
    uniform vec4 uViews[4]; uniform vec4 uFlash[4]; uniform int uNV; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }
    vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - 0.055, step(0.0031308, c)); }
    void main(){
      vec2 uv = vUv;
      // which split-screen view is this pixel in? vignette and hit flashes are per view
      vec4 vw = uViews[0]; vec4 fl = uFlash[0];
      for (int i = 1; i < 4; i++) { if (i < uNV) { vec4 r = uViews[i]; if (uv.x >= r.x && uv.y >= r.y && uv.x <= r.x + r.z && uv.y <= r.y + r.w) { vw = r; fl = uFlash[i]; } } }
      vec2 lv = (uv - vw.xy) / vw.zw - 0.5; float r2 = dot(lv, lv);
      vec2 off = lv * vw.zw * (uAberr + fl.w * 0.006) * (0.4 + r2 * 2.4);
      vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      col *= uExposure;
      // hue-preserving tone map so neon stays saturated instead of bleaching to white
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 keep = col * (aces(vec3(lum)).x / max(lum, 1e-4));
      col = mix(aces(col), clamp(keep, 0., 1.), 0.55);
      col = col * col * (3.0 - 2.0 * col) * 0.35 + col * 0.65;
      col *= mix(0.55, 1.0, smoothstep(0.62, 0.12, r2));
      col += fl.rgb * fl.w * smoothstep(0.08, 0.5, r2) * 0.55;
      col = toSRGB(col);
      float g = fract(sin(dot(uv * uRes + fract(uTime * 7.13) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      col += (g - 0.5) * 0.022;
      gl_FragColor = vec4(col, 1.);
    }`,
  depthTest: false, depthWrite: false
});
if (THREE.FullScreenQuad) finalQuad = new THREE.FullScreenQuad(finalMat);

function resize() {
  const q = QUALS[S.quality];
  pixelRatio = Math.min(window.devicePixelRatio || 1, q.pr);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  DW = Math.max(1, Math.floor(window.innerWidth * pixelRatio)); DH = Math.max(1, Math.floor(window.innerHeight * pixelRatio));
  if (sceneRT) sceneRT.dispose();
  sceneRT = new THREE.WebGLRenderTarget(DW, DH, { type: THREE.HalfFloatType, samples: q.samples, depthBuffer: true });
  const bw = Math.max(2, Math.floor(DW * q.bloomScale)), bh = Math.max(2, Math.floor(DH * q.bloomScale));
  if (THREE.UnrealBloomPass) {
    if (!bloomPass) bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(bw, bh), 0.62, 0.5, 1.05);
    else bloomPass.setSize(bw, bh);
  }
  finalMat.uniforms.uRes.value.set(DW, DH);
  if (sunLight) { sunLight.shadow.mapSize.set(q.shadow, q.shadow); if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; } }
  if (typeof layoutViews === 'function') layoutViews();
}

/* ================= procedural textures ================= */
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texOf(c, srgb, wrap) {
  const t = new THREE.CanvasTexture(c); t.anisotropy = MAXANI;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  if (wrap) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  return t;
}
// Sobel-ish normal map from a grayscale height canvas (wraps at the edges so tiling is seamless)
function normalFromHeight(hc, strength) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = cnv(w, h), octx = out.getContext('2d'), img = octx.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let nx = (H(x - 1, y) - H(x + 1, y)) * strength, ny = (H(x, y + 1) - H(x, y - 1)) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0); return out;
}
function noiseFill(ctx, w, h, rnd, amt, streak) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  let row = 0;
  for (let y = 0; y < h; y++) {
    row = streak ? (rnd() - 0.5) * amt * 0.8 : 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, n = (rnd() - 0.5) * amt + row;
      d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}
const FONT_D = "'Orbitron', 'Segoe UI', sans-serif";

// Podium ring tops: a strip mapped u = around the ring, v = across it (inner -> outer).
function makeRingTextures() {
  const W = 2048, Hh = 512, rnd = mulberry(77);
  const al = cnv(W, Hh), a = al.getContext('2d');           // albedo
  const hc = cnv(W, Hh), h = hc.getContext('2d');           // height
  const oc = cnv(W, Hh), o = oc.getContext('2d');           // rough (G) / metal (B)
  const ec = cnv(W, Hh), e = ec.getContext('2d');           // emissive mask
  const grd = a.createLinearGradient(0, 0, 0, Hh); grd.addColorStop(0, '#2b2f3c'); grd.addColorStop(0.5, '#1d2029'); grd.addColorStop(1, '#262a35');
  a.fillStyle = grd; a.fillRect(0, 0, W, Hh); noiseFill(a, W, Hh, rnd, 14, true);
  h.fillStyle = '#808080'; h.fillRect(0, 0, W, Hh);
  o.fillStyle = 'rgb(0,90,215)'; o.fillRect(0, 0, W, Hh);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, Hh);
  // canvas top = outer edge (v = 1). Raised lips at both edges, a recessed light channel in the middle.
  const band = (y0, y1, hv, col, rough) => { h.fillStyle = `rgb(${hv},${hv},${hv})`; h.fillRect(0, y0, W, y1 - y0); if (col) { a.fillStyle = col; a.fillRect(0, y0, W, y1 - y0); } if (rough != null) { o.fillStyle = `rgb(0,${rough},215)`; o.fillRect(0, y0, W, y1 - y0); } };
  band(0, 26, 205, '#363b4a', 70); band(26, 32, 40, '#0c0d12', 150); band(Hh - 26, Hh, 205, '#363b4a', 70); band(Hh - 32, Hh - 26, 40, '#0c0d12', 150);
  band(236, 276, 70, '#0e1016', 160); band(232, 236, 30, null); band(276, 280, 30, null);
  // segmented light strip in the channel
  for (let x = 0; x < W; x += 64) { e.fillStyle = '#fff'; e.fillRect(x + 6, 248, 44, 16); a.fillStyle = '#9aa6b8'; a.fillRect(x + 6, 248, 44, 16); }
  // panel seams and bolts
  for (let x = 0; x < W; x += 256) {
    h.fillStyle = '#202020'; h.fillRect(x, 32, 5, 200); h.fillRect(x, 280, 5, Hh - 312);
    a.fillStyle = '#0b0c10'; a.fillRect(x, 32, 5, 200); a.fillRect(x, 280, 5, Hh - 312);
    for (const by of [60, 200, 310, 450]) for (const bx of [x + 22, x + 234]) {
      h.fillStyle = '#d8d8d8'; h.beginPath(); h.arc(bx, by, 6, 0, TAU); h.fill(); h.fillStyle = '#606060'; h.fillRect(bx - 4, by - 1, 8, 2);
      a.fillStyle = '#4a5060'; a.beginPath(); a.arc(bx, by, 6, 0, TAU); a.fill();
    }
    // inward chevron markers that glow in the station colour
    e.fillStyle = '#fff'; a.fillStyle = '#7d8798';
    for (let k = 0; k < 3; k++) { const cx = x + 128, cy = 90 + k * 26; for (const ctx of [e, a]) { ctx.beginPath(); ctx.moveTo(cx - 18, cy); ctx.lineTo(cx, cy + 14); ctx.lineTo(cx + 18, cy); ctx.lineTo(cx + 18, cy + 6); ctx.lineTo(cx, cy + 20); ctx.lineTo(cx - 18, cy + 6); ctx.closePath(); ctx.fill(); } }
    // stencilled markings
    a.save(); a.globalAlpha = 0.55; a.fillStyle = '#aab4c6'; a.font = `700 22px ${FONT_D}`; a.fillText('GRAV-ANCHOR ' + (10 + (x / 256) * 7), x + 40, 344); a.font = `500 16px ${FONT_D}`;
    a.fillText('LOAD 4.2T  ▸  HD-' + String(1 + x / 256).padStart(2, '0'), x + 40, 372); a.restore();
    // hazard stripes near the outer lip
    a.save(); a.beginPath(); a.rect(x + 140, 36, 100, 18); a.clip(); a.fillStyle = '#9c7a12';
    for (let s = -20; s < 120; s += 16) { a.beginPath(); a.moveTo(x + 140 + s, 54); a.lineTo(x + 148 + s, 36); a.lineTo(x + 156 + s, 36); a.lineTo(x + 148 + s, 54); a.fill(); } a.restore();
  }
  // scuffs and wear
  for (let i = 0; i < 900; i++) { a.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '120,130,150'},${rnd() * 0.12})`; const x = rnd() * W, y = rnd() * Hh; a.fillRect(x, y, rnd() * 40 + 4, rnd() * 2 + 1); o.fillStyle = `rgba(0,${150 + rnd() * 80 | 0},215,0.4)`; o.fillRect(x, y, rnd() * 40 + 4, 2); }
  const map = texOf(al, true, true), nrm = texOf(normalFromHeight(hc, 5), false, true), orm = texOf(oc, false, true), em = texOf(ec, true, true);
  return { map, nrm, orm, em };
}

// Podium centre plates: a round emblem.
function makeCoreTextures() {
  const N = 1024, c = N / 2;
  const al = cnv(N, N), a = al.getContext('2d'), hc = cnv(N, N), h = hc.getContext('2d'), ec = cnv(N, N), e = ec.getContext('2d');
  a.fillStyle = '#20232d'; a.fillRect(0, 0, N, N); noiseFill(a, N, N, mulberry(5), 12, false);
  h.fillStyle = '#808080'; h.fillRect(0, 0, N, N); e.fillStyle = '#000'; e.fillRect(0, 0, N, N);
  const ring = (ctx, r, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(c, c, r, 0, TAU); ctx.stroke(); };
  ring(h, 500, 24, '#d0d0d0'); ring(h, 484, 6, '#303030'); ring(a, 500, 24, '#363b4a'); ring(a, 484, 6, '#0b0c10');
  ring(h, 330, 10, '#303030'); ring(a, 330, 10, '#0b0c10');
  ring(e, 300, 8, '#fff'); ring(a, 300, 8, '#9aa6b8');
  for (let i = 0; i < 24; i++) { const an = i / 24 * TAU; for (const ctx of [e, a]) { ctx.save(); ctx.translate(c, c); ctx.rotate(an); ctx.fillStyle = ctx === e ? '#fff' : '#7f8a9c'; ctx.fillRect(400, -6, 50, 12); ctx.restore(); } }
  // hex lattice inside the inner ring
  h.save(); a.save(); h.beginPath(); h.arc(c, c, 290, 0, TAU); h.clip(); a.beginPath(); a.arc(c, c, 290, 0, TAU); a.clip();
  const s = 34;
  for (let y = -s; y < N + s; y += s * 1.5) for (let x = -s; x < N + s; x += s * Math.sqrt(3)) {
    const ox = ((Math.round(y / (s * 1.5)) & 1) ? s * Math.sqrt(3) / 2 : 0);
    for (const ctx of [h, a]) { ctx.strokeStyle = ctx === h ? '#404040' : '#121319'; ctx.lineWidth = 3; ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = k / 6 * TAU + Math.PI / 6; ctx.lineTo(x + ox + Math.cos(an) * s * 0.92, y + Math.sin(an) * s * 0.92); } ctx.closePath(); ctx.stroke(); }
  }
  h.restore(); a.restore();
  // centre emblem: a stylised disc
  for (const ctx of [e, a]) { ctx.save(); ctx.translate(c, c); ctx.strokeStyle = ctx === e ? '#fff' : '#c0c8d8'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, 0, 120, 0.3, Math.PI - 0.3); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 120, Math.PI + 0.3, TAU - 0.3); ctx.stroke(); ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 60, 0, TAU); ctx.stroke(); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); ctx.restore(); }
  a.save(); a.fillStyle = 'rgba(170,180,200,.55)'; a.font = `700 26px ${FONT_D}`; a.textAlign = 'center'; a.fillText('HYPER  DISC  ARENA', c, c + 220); a.fillText('NEON DISTRICT 7', c, c - 200); a.restore();
  return { map: texOf(al, true), nrm: texOf(normalFromHeight(hc, 4), false), em: texOf(ec, true) };
}

// Tech panelling for walls, hulls and the shaft.
function makePanelTextures(seed, W, Hh, opts) {
  const rnd = mulberry(seed);
  const al = cnv(W, Hh), a = al.getContext('2d'), hc = cnv(W, Hh), h = hc.getContext('2d'), ec = cnv(W, Hh), e = ec.getContext('2d');
  a.fillStyle = opts.base || '#181b24'; a.fillRect(0, 0, W, Hh); noiseFill(a, W, Hh, rnd, 10, true);
  h.fillStyle = '#808080'; h.fillRect(0, 0, W, Hh); e.fillStyle = '#000'; e.fillRect(0, 0, W, Hh);
  // recursive panel subdivision
  const panel = (x, y, w, hh, depth) => {
    if (depth > 0 && (w > 120 || hh > 120) && rnd() < 0.8) {
      if (w > hh) { const s = Math.round(w * (0.3 + rnd() * 0.4)); panel(x, y, s, hh, depth - 1); panel(x + s, y, w - s, hh, depth - 1); }
      else { const s = Math.round(hh * (0.3 + rnd() * 0.4)); panel(x, y, w, s, depth - 1); panel(x, y + s, w, hh - s, depth - 1); }
      return;
    }
    const lv = 110 + rnd() * 50 | 0, tone = 22 + rnd() * 14 | 0;
    h.fillStyle = `rgb(${lv},${lv},${lv})`; h.fillRect(x + 4, y + 4, w - 8, hh - 8);
    a.fillStyle = `rgb(${tone},${tone + 3},${tone + 10})`; a.fillRect(x + 4, y + 4, w - 8, hh - 8);
    h.fillStyle = '#2a2a2a'; h.fillRect(x, y, w, 4); h.fillRect(x, y, 4, hh);
    a.fillStyle = '#07080c'; a.fillRect(x, y, w, 3); a.fillRect(x, y, 3, hh);
    const r = rnd();
    if (r < 0.22 && w > 60 && hh > 40) { // vent slats
      for (let k = y + 14; k < y + hh - 14; k += 10) { h.fillStyle = '#404040'; h.fillRect(x + 14, k, w - 28, 5); a.fillStyle = '#0a0b0f'; a.fillRect(x + 14, k, w - 28, 5); }
    } else if (r < 0.42 && w > 50) { // emissive light slot
      const sw = Math.min(w - 24, 160), sx = x + (w - sw) / 2, sy = y + hh / 2 - 4;
      e.fillStyle = '#fff'; e.fillRect(sx, sy, sw, 7); a.fillStyle = '#8894a8'; a.fillRect(sx, sy, sw, 7); h.fillStyle = '#505050'; h.fillRect(sx - 3, sy - 3, sw + 6, 13);
    } else if (r < 0.55 && w > 70 && hh > 40) { // stencil text
      a.save(); a.globalAlpha = 0.45; a.fillStyle = '#9aa4b6'; a.font = `700 ${Math.min(22, hh / 3) | 0}px ${FONT_D}`;
      a.fillText(['SECTOR', 'GRID', 'HV', 'NO STEP', 'CORE', 'VENT', 'ACCESS'][rnd() * 7 | 0] + ' ' + (rnd() * 90 + 10 | 0), x + 12, y + hh / 2 + 6); a.restore();
    } else if (r < 0.66) { // rivets
      for (const [bx, by] of [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + hh - 12], [x + w - 12, y + hh - 12]]) { h.fillStyle = '#d0d0d0'; h.beginPath(); h.arc(bx, by, 4, 0, TAU); h.fill(); }
    }
  };
  const cols = opts.cols || 4, rows = opts.rows || 2;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) panel(i * W / cols, j * Hh / rows, W / cols, Hh / rows, 4);
  for (let i = 0; i < 600; i++) { a.fillStyle = `rgba(0,0,0,${rnd() * 0.14})`; a.fillRect(rnd() * W, rnd() * Hh, rnd() * 3 + 1, rnd() * 50 + 6); }
  return { map: texOf(al, true, true), nrm: texOf(normalFromHeight(hc, 4), false, true), em: texOf(ec, true, true) };
}

// Fine armour normal map for the runners: panel lines and a woven undersuit pattern.
function makeArmorNormal() {
  const N = 1024, hc = cnv(N, N), h = hc.getContext('2d'), rnd = mulberry(9);
  h.fillStyle = '#909090'; h.fillRect(0, 0, N, N);
  for (let y = 0; y < N; y += 8) for (let x = 0; x < N; x += 8) { const v = ((x / 8 + y / 8) & 1) ? 150 : 110; h.fillStyle = `rgb(${v},${v},${v})`; h.fillRect(x, y, 8, 4); h.fillRect(x + ((y / 8) & 1 ? 4 : 0), y + 4, 4, 4); }
  for (let i = 0; i < 16; i++) { const y = rnd() * N | 0; h.fillStyle = '#303030'; h.fillRect(0, y, N, 3); }
  for (let i = 0; i < 16; i++) { const x = rnd() * N | 0; h.fillStyle = '#303030'; h.fillRect(x, 0, 3, N); }
  return texOf(normalFromHeight(hc, 2.5), false, true);
}

// Disc face: glowing spokes and rings (white; tinted by the material colour).
function makeDiscTexture() {
  const N = 512, c = N / 2, cv = cnv(N, N), x = cv.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
  x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.arc(c, c, 236, 0, TAU); x.stroke();
  x.lineWidth = 4; x.beginPath(); x.arc(c, c, 200, 0, TAU); x.stroke();
  x.globalAlpha = 0.6; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(c, c, 150, i * TAU / 3 + 0.2, i * TAU / 3 + 1.6); x.stroke(); }
  x.globalAlpha = 1; x.lineWidth = 6; x.beginPath(); x.arc(c, c, 70, 0, TAU); x.stroke();
  for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; x.beginPath(); x.moveTo(c + Math.cos(an) * 80, c + Math.sin(an) * 80); x.lineTo(c + Math.cos(an) * 190, c + Math.sin(an) * 190); x.lineWidth = 3; x.stroke(); }
  x.fillStyle = '#fff'; x.beginPath(); x.arc(c, c, 30, 0, TAU); x.fill();
  return texOf(cv, true);
}

// Firewall blocks: a bright frame with a scanline grid.
function makeBlockTexture() {
  const W = 256, Hh = 160, cv = cnv(W, Hh), x = cv.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, W, Hh);
  x.fillStyle = 'rgba(255,255,255,0.18)'; for (let y = 0; y < Hh; y += 6) x.fillRect(0, y, W, 2);
  x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(4, 4, W - 8, Hh - 8);
  x.lineWidth = 2; x.strokeRect(16, 16, W - 32, Hh - 32);
  x.fillStyle = '#fff'; x.font = `900 34px ${FONT_D}`; x.textAlign = 'center'; x.globalAlpha = 0.6; x.fillText('▲ FW ▲', W / 2, Hh / 2 + 12);
  return texOf(cv, true);
}

// Scrolling LED ticker around the top of the arena.
function makeTickerTexture() {
  const W = 4096, Hh = 128, cv = cnv(W, Hh), x = cv.getContext('2d');
  x.fillStyle = '#05040c'; x.fillRect(0, 0, W, Hh);
  const msg = ['HYPER DISC', 'SEASON 07', 'NEON DISTRICT ARENA', 'KEEP YOUR FEET', 'THREE DISCS · NO MERCY', 'ハイパー・ディスク', 'LIVE FROM SECTOR 9', 'BANK IT OFF THE CEILING'];
  x.font = `900 64px ${FONT_D}`; x.textBaseline = 'middle';
  let px = 30, i = 0; const cols = ['#19e6ff', '#ff2fa8', '#ffc21a', '#ffffff'];
  while (px < W - 200) { const t = msg[i % msg.length]; x.fillStyle = cols[i % cols.length]; x.fillText(t, px, Hh / 2 + 4); px += x.measureText(t).width + 50; x.fillStyle = '#ffffff'; x.fillText('◆', px, Hh / 2); px += 110; i++; }
  // LED dot mask
  x.globalCompositeOperation = 'destination-in'; const dot = cnv(8, 8), d = dot.getContext('2d'); d.fillStyle = '#fff'; d.beginPath(); d.arc(4, 4, 3.2, 0, TAU); d.fill();
  x.fillStyle = x.createPattern(dot, 'repeat'); x.fillRect(0, 0, W, Hh); x.globalCompositeOperation = 'source-over';
  return texOf(cv, true, true);
}

// Neon billboards for the skyline, all fictional brands.
const ADS = [
  { bg: ['#12001c', '#3b0050'], t1: 'KAIJU', t2: 'COLA', c1: '#ff2fa8', c2: '#ffd34d', jp: 'カイジュウ', s: 'TASTE THE MONSTER' },
  { bg: ['#001a24', '#003a48'], t1: 'SYNAPSE+', t2: '', c1: '#19e6ff', c2: '#ffffff', jp: 'シナプス', s: 'UPGRADE YOUR MIND' },
  { bg: ['#1c0a00', '#3a1600'], t1: 'VOLTAIC', t2: 'MOTORS', c1: '#ffc21a', c2: '#ff5a1f', jp: 'ボルテック', s: 'GRAVITY IS OPTIONAL' },
  { bg: ['#000a1a', '#0a1a3a'], t1: 'HYPER', t2: 'DISC', c1: '#7cff4f', c2: '#19e6ff', jp: 'ハイパー', s: 'LIVE TONIGHT · SECTOR 9' },
  { bg: ['#14001a', '#230032'], t1: 'NEO', t2: 'NOODLE', c1: '#ff7a2f', c2: '#ff2fa8', jp: 'ラーメン', s: '24H · FLOOR 88' },
  { bg: ['#00140e', '#003022'], t1: 'ZEN-9', t2: '', c1: '#4fffc8', c2: '#ffffff', jp: 'ゼン', s: 'SLEEP IS A SUBSCRIPTION' },
  { bg: ['#1a0010', '#40001f'], t1: 'MIRAI', t2: 'BANK', c1: '#ff3a5c', c2: '#ffd1dc', jp: 'ミライ', s: 'YOUR FUTURE · OUR TERMS' }
];
function makeAdTexture(ad, vertical) {
  const W = vertical ? 512 : 1024, Hh = vertical ? 1024 : 512, cv = cnv(W, Hh), x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, Hh); g.addColorStop(0, ad.bg[0]); g.addColorStop(1, ad.bg[1]); x.fillStyle = g; x.fillRect(0, 0, W, Hh);
  x.strokeStyle = ad.c1; x.lineWidth = 10; x.strokeRect(14, 14, W - 28, Hh - 28);
  x.globalAlpha = 0.25; x.strokeStyle = ad.c2; x.lineWidth = 2; for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(W * 0.78, Hh * 0.5, 30 + i * 22, 0, TAU); x.stroke(); } x.globalAlpha = 1;
  x.textBaseline = 'middle'; x.shadowColor = ad.c1; x.shadowBlur = 24;
  if (vertical) {
    x.fillStyle = ad.c1; x.font = `900 120px ${FONT_D}`; x.textAlign = 'center';
    const letters = (ad.t1 + ad.t2).replace(/[^A-Z0-9+\-]/g, '').slice(0, 7);
    for (let i = 0; i < letters.length; i++) x.fillText(letters[i], W / 2, 120 + i * 120);
  } else {
    x.fillStyle = ad.c1; x.font = `900 ${ad.t2 ? 130 : 150}px ${FONT_D}`; x.fillText(ad.t1, 60, ad.t2 ? 160 : 230);
    if (ad.t2) { x.fillStyle = ad.c2; x.shadowColor = ad.c2; x.fillText(ad.t2, 60, 300); }
    x.shadowBlur = 10; x.fillStyle = '#fff'; x.font = `700 40px ${FONT_D}`; x.fillText(ad.s, 64, 420);
    x.fillStyle = ad.c2; x.shadowColor = ad.c2; x.font = `700 70px sans-serif`; x.textAlign = 'right'; x.fillText(ad.jp, W - 50, 90);
  }
  // scanlines
  x.shadowBlur = 0; x.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < Hh; y += 4) x.fillRect(0, y, W, 2);
  return texOf(cv, true);
}

/* ================= materials ================= */
let RT = null, CT = null, WALLT = null, HULLT = null, ARMN = null, DISCT = null, BLOCKT = null, TICKT = null;
function buildTextures() {
  RT = makeRingTextures(); CT = makeCoreTextures();
  WALLT = makePanelTextures(31, 2048, 1024, { cols: 4, rows: 2, base: '#161922' });
  HULLT = makePanelTextures(57, 1024, 512, { cols: 4, rows: 1, base: '#1a1d26' });
  ARMN = makeArmorNormal(); DISCT = makeDiscTexture(); BLOCKT = makeBlockTexture(); TICKT = makeTickerTexture();
}
buildTextures();
function emissiveMat(color, intensity) { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }); return m; }
function glowMat(color, intensity, opacity) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, opacity: opacity == null ? 1 : opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}

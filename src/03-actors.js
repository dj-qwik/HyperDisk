/* ================= stations: floating podiums made of concentric rings ================= */
// A station belongs to one runner. Each has one podium (HALO RINGS) or three (TRIAD); each podium is a
// centre plate plus rings. A disc that strikes an opponent's ring makes it flash and then vanish for
// RING_GONE seconds. Anyone standing on it when it goes drops into the shaft.
const STATIONS = [];
const stationRoot = new THREE.Group(); scene.add(stationRoot);
let LAYOUT = ARENAS[0];

function annulusGeo(rIn, rOut, segs, rep) {
  const pos = [], uv = [], nor = [], idx = [], rows = 2;
  for (let j = 0; j <= rows; j++) {
    const r = lerp(rIn, rOut, j / rows);
    for (let i = 0; i <= segs; i++) { const a = i / segs * TAU; pos.push(Math.cos(a) * r, 0, -Math.sin(a) * r); nor.push(0, 1, 0); uv.push(i / segs * rep, j / rows); }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < segs; i++) { const a = j * (segs + 1) + i, b = a + 1, c = a + segs + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
const sideMat = new THREE.MeshStandardMaterial({ color: 0x1c1f29, metalness: 0.9, roughness: 0.3, normalMap: HULLT.nrm, side: THREE.DoubleSide });
const hullMatBase = new THREE.MeshStandardMaterial({ color: 0x1b1e28, metalness: 0.85, roughness: 0.34, map: HULLT.map, normalMap: HULLT.nrm, emissiveMap: HULLT.em });

function ringSideGeo(rIn, rOut) {
  const pts = rIn > 0.01
    ? [[rIn + 0.04, 0], [rIn, -0.05], [rIn, -0.22], [rIn + 0.12, -0.36], [rOut - 0.12, -0.36], [rOut, -0.22], [rOut, -0.05], [rOut - 0.04, 0]]
    : [[0.001, -0.36], [rOut - 0.12, -0.36], [rOut, -0.22], [rOut, -0.05], [rOut - 0.04, 0]];
  return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 96);
}

function buildPad(st, idx, lx, phase, rings, color) {
  const pad = { st, idx, lx, phase, x: 0, z: 0, baseY: 0, y: 0, rings: [], g: new THREE.Group(), R: rings[rings.length - 1][1] };
  const c = new THREE.Color(color);
  rings.forEach(([rIn, rOut], k) => {
    const ring = { rIn, rOut, state: 0, t: 0, g: new THREE.Group(), mats: [] };
    let top;
    if (rIn < 0.01) {
      const m = new THREE.MeshStandardMaterial({ map: CT.map, normalMap: CT.nrm, emissiveMap: CT.em, emissive: c.clone().multiplyScalar(0.85), metalness: 0.85, roughness: 0.3 });
      top = new THREE.Mesh(new THREE.CircleGeometry(rOut - 0.03, 72), m); top.rotation.x = -Math.PI / 2; ring.mats.push(m);
    } else {
      const m = new THREE.MeshStandardMaterial({ map: RT.map, normalMap: RT.nrm, roughnessMap: RT.orm, metalnessMap: RT.orm, emissiveMap: RT.em, emissive: c.clone().multiplyScalar(0.95), metalness: 1, roughness: 1 });
      const rep = Math.max(2, Math.round(TAU * rOut / 3.2));
      top = new THREE.Mesh(annulusGeo(rIn + 0.03, rOut - 0.03, 96, rep), m); ring.mats.push(m);
    }
    top.position.y = 0.001; top.receiveShadow = true;
    const side = new THREE.Mesh(ringSideGeo(rIn + 0.03, rOut - 0.03), sideMat); side.receiveShadow = true;
    const trimMat = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.6) }); ring.mats.push(trimMat); ring.trim = trimMat;
    const to = new THREE.Mesh(new THREE.TorusGeometry(rOut - 0.05, 0.035, 6, 128), trimMat); to.rotation.x = Math.PI / 2; to.position.y = 0.012;
    ring.g.add(top, side, to);
    if (rIn > 0.01) { const ti = new THREE.Mesh(new THREE.TorusGeometry(rIn + 0.05, 0.022, 6, 128), trimMat); ti.rotation.x = Math.PI / 2; ti.position.y = 0.012; ring.g.add(ti); }
    // hologram outline shown while the ring is gone
    const ghost = new THREE.Mesh(new THREE.TorusGeometry((rIn + rOut) / 2, (rOut - rIn) / 2 - 0.02, 2, 64), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.9), wireframe: true, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    ghost.rotation.x = Math.PI / 2; ghost.scale.z = 0.02; ghost.visible = false; ring.ghost = ghost;
    pad.g.add(ring.g, ghost); pad.rings.push(ring);
  });
  const R = pad.R;
  // glow plate under the ring seams
  const glow = new THREE.Mesh(new THREE.CircleGeometry(R - 0.05, 64), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.8) })); glow.rotation.x = -Math.PI / 2; glow.position.y = -0.2; pad.g.add(glow);
  // hull underneath
  const prof = [[R - 0.02, -0.38], [R * 0.97, -0.62], [R * 0.82, -0.9], [R * 0.55, -1.35], [R * 0.33, -1.95], [0.42, -2.45], [0.2, -2.7], [0.001, -2.75]];
  const hm = hullMatBase.clone(); hm.emissive = c.clone().multiplyScalar(1.0);
  hm.map = HULLT.map; hm.normalMap = HULLT.nrm; hm.emissiveMap = HULLT.em;
  const hull = new THREE.Mesh(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 72), hm); pad.g.add(hull);
  const band = new THREE.Mesh(new THREE.TorusGeometry(R * 0.86, 0.05, 6, 96), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(3) })); band.rotation.x = Math.PI / 2; band.position.y = -0.85; pad.g.add(band);
  // core and thrusters
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 12), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(4) })); core.position.y = -2.6; pad.g.add(core);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 2.6, 26, 32, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uC: { value: c }, uTime },
    vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uC; uniform float uTime; varying vec2 vUv; varying vec3 vN, vV; void main(){ float f = pow(abs(dot(normalize(vN),normalize(vV))),2.); float a = f*pow(vUv.y,2.2)*0.32*(0.8+0.2*sin(vUv.y*40.+uTime*9.)); gl_FragColor=vec4(uC*a,1.); }'
  }));
  beam.position.y = -2.7 - 13; pad.g.add(beam);
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * TAU + 0.5, nz = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.35, 16), sideMat);
    nz.position.set(Math.cos(a) * R * 0.6, -1.25, Math.sin(a) * R * 0.6); pad.g.add(nz);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 12, 1, true), glowMat(c, 2.2, 0.8)); fl.rotation.x = Math.PI; fl.position.set(nz.position.x, -1.85, nz.position.z); pad.g.add(fl);
    pad.flames = pad.flames || []; pad.flames.push(fl);
  }
  pad.g.traverse(o => { if (o.isMesh && o.material === sideMat) o.castShadow = false; });
  pad.light = null;
  return pad;
}

function stationLayout(n) {
  // P1 sits at +z looking at the centre; the rest spread evenly round the arena
  const out = [];
  for (let i = 0; i < n; i++) { const th = i / n * TAU; out.push({ x: Math.sin(th) * RS, z: Math.cos(th) * RS, yaw: th + Math.PI }); }
  return out;
}
function clearStations() {
  STATIONS.forEach(st => { stationRoot.remove(st.g); st.g.traverse(o => { if (o.geometry && o.geometry !== ringGeo) o.geometry.dispose(); }); });
  STATIONS.length = 0;
}
// Bulwarks: armoured barriers in front of each podium (the original's later stages). A runner's own
// discs pass through their own barrier; everyone else's bounce off it.
const BULWARKS = [];
const bulwarkGroup = new THREE.Group(); scene.add(bulwarkGroup);
function buildBulwarks(on) {
  BULWARKS.length = 0;
  while (bulwarkGroup.children.length) { const c = bulwarkGroup.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  if (!on) return;
  const hw = 2.4, top = 2.5;
  for (const st of STATIONS) {
    const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw), cx = st.x + fx * 4.6, cz = st.z + fz * 4.6;
    BULWARKS.push({ st: st.i, x: cx, z: cz, fx, fz, rx: -fz, rz: fx, hw, top });
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = st.yaw;
    const slab = new THREE.Mesh(rbox(hw * 2, top + 0.6, 0.5, 0.12), new THREE.MeshStandardMaterial({ color: 0x14161e, metalness: 0.85, roughness: 0.35, normalMap: HULLT.nrm, map: HULLT.map, emissiveMap: HULLT.em, emissive: new THREE.Color(st.color).multiplyScalar(0.9) }));
    slab.position.y = (top - 0.6) / 2; slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
    const c = new THREE.Color(st.color);
    for (const y of [-0.55, top]) { const e = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.06, 0.07, 0.56), emissiveMat(c, 3)); e.position.y = y; g.add(e); }
    for (const x of [-hw, hw]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, top + 0.62, 0.56), emissiveMat(c, 3)); e.position.set(x, (top - 0.6) / 2, 0); g.add(e); }
    const under = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 6, 1, true), glowMat(c, 1.6, 0.5)); under.rotation.x = Math.PI; under.position.y = -1.7; g.add(under);
    bulwarkGroup.add(g);
  }
}
const TRIAD_RINGS = [[0, 0.8], [0.85, 1.65], [1.7, 2.5]];   // bullseye: centre plate plus two breakable rings
function buildStations(n, arena, colors) {
  clearStations(); LAYOUT = arena;
  // two runners face off down a long court; three or four share a square one
  RS = n <= 2 ? 9 : 10;
  if (n <= 2) { BOX.hx = 10.5; BOX.hz = RS + 8.5; } else { BOX.hx = BOX.hz = RS + 8.5; }
  buildCourt();
  const lay = stationLayout(n);
  lay.forEach((L, i) => {
    const st = { i, x: L.x, z: L.z, yaw: L.yaw, pads: [], g: new THREE.Group(), color: colors[i] };
    const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);   // the station's "right" (perpendicular to its facing)
    const specs = arena.triad
      // a lazy triangle: the middle podium pushed forward toward the rivals, the two flank podiums held back
      ? [[-5.0, -1.2, 0.9, TRIAD_RINGS], [0, 1.6, 0, TRIAD_RINGS], [5.0, -1.2, -0.9, TRIAD_RINGS]]
      : [[0, 0, 0, [[0, 1.3], [1.35, 2.5], [2.55, 3.7]]]];
    const fx = Math.sin(L.yaw), fz = Math.cos(L.yaw);
    specs.forEach(([lx, lf, ph, rings], k) => {
      const pad = buildPad(st, k, lx, ph + i * 0.7, rings, colors[i]);
      pad.x = L.x + rx * lx + fx * lf; pad.z = L.z + rz * lx + fz * lf; pad.baseY = 0; pad.y = 0;
      pad.g.position.set(pad.x, 0, pad.z); pad.g.rotation.y = L.yaw;
      st.g.add(pad.g); st.pads.push(pad);
    });
    stationRoot.add(st.g); STATIONS.push(st);
  });
  WALLFW.setOn(!!arena.wall);
  buildBulwarks(!!arena.bulwark);
}
function padHeightAt(pad, t) { return pad.baseY + (LAYOUT.lifts ? Math.sin(t * 0.62 + pad.phase) * 2.3 : 0); }
function updateStations(t, dt) {
  for (const st of STATIONS) for (const pad of st.pads) {
    pad.y = padHeightAt(pad, t); pad.g.position.y = pad.y;
    for (const f of pad.flames) { f.scale.y = 0.85 + Math.random() * 0.3; }
    for (const r of pad.rings) {
      if (r.state === 1) {
        r.t += dt; const blink = Math.sin(r.t * (18 + r.t * 30)) > 0;
        r.trim.color.setRGB(blink ? 4 : 0.6, blink ? 4 : 0.6, blink ? 4 : 0.6);
        r.g.position.y = (Math.random() - 0.5) * 0.04;
        if (r.t >= RING_FLASH) { r.state = 2; r.t = 0; r.g.visible = false; r.ghost.visible = true; sparksRing(pad, r); SFX.ringGone(); }
      } else if (r.state === 2) {
        r.t += dt; r.ghost.material.opacity = 0.12 + 0.12 * Math.sin(r.t * 6);
        if (r.t >= RING_GONE) { r.state = 3; r.t = 0; r.g.visible = true; r.ghost.visible = false; }
      } else if (r.state === 3) {
        r.t += dt; const k = r.t / RING_REFORM; r.g.visible = Math.random() < 0.4 + k * 0.6;
        const s = 0.9 + 0.1 * k; r.g.scale.set(s, 1, s);
        if (r.t >= RING_REFORM) { r.state = 0; r.t = 0; r.g.visible = true; r.g.scale.set(1, 1, 1); r.trim.color.copy(new THREE.Color(st.color).multiplyScalar(2.6)); }
      }
    }
  }
}
function sparksRing(pad, r) {
  const n = 18;
  for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = (r.rIn + r.rOut) / 2; sparks(pad.x + Math.cos(a) * rr, pad.y, pad.z + Math.sin(a) * rr, pad.st.color, 3, 4, 0.7, 0.07); }
}
function ringBreak(stI, padI, ringI, silent) {
  const st = STATIONS[stI]; if (!st) return false;
  const pad = st.pads[padI]; if (!pad) return false; const r = pad.rings[ringI]; if (!r || r.state !== 0 || r.rIn < 0.01) return false;   // centre plates are armoured
  r.state = 1; r.t = 0; if (!silent) SFX.ringHit();
  return true;
}
function restoreStation(st) {
  for (const pad of st.pads) for (const r of pad.rings) { r.state = 0; r.t = 0; r.g.visible = true; r.ghost.visible = false; r.g.scale.set(1, 1, 1); r.g.position.y = 0; r.trim.color.copy(new THREE.Color(st.color).multiplyScalar(2.6)); }
}
// what's under a point? returns { pad, ring index, y } for solid footing, else null
function supportAt(x, z, tol) {
  tol = tol == null ? 0.12 : tol;
  for (const st of STATIONS) for (const pad of st.pads) {
    const d = Math.hypot(x - pad.x, z - pad.z); if (d > pad.R + tol) continue;
    for (let k = 0; k < pad.rings.length; k++) {
      const r = pad.rings[k]; if (r.state === 2) continue;
      if (d >= r.rIn - 0.06 && d <= r.rOut + (k === pad.rings.length - 1 ? tol : 0.06)) return { pad, ring: k, y: pad.y };
    }
  }
  return null;
}
function padUnder(x, z, extra) {
  for (const st of STATIONS) for (const pad of st.pads) { const d = Math.hypot(x - pad.x, z - pad.z); if (d <= pad.R + (extra || 0)) return pad; }
  return null;
}

/* ================= firewall: a spinning ring of energy blocks between the stations ================= */
const WALLFW = {
  on: false, rot: 0, cols: 20, rows: 2, rowY: [0.95, 2.6], half: 0.78, blocks: [], im: null, glass: null,
  init() {
    const n = this.cols * this.rows;
    const geo = new THREE.BoxGeometry(TAU * RB / this.cols - 0.22, this.half * 2 - 0.08, 0.55);
    const mat = new THREE.MeshBasicMaterial({ map: BLOCKT, color: new THREE.Color(0xff2200).multiplyScalar(1.25), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const gmat = new THREE.MeshStandardMaterial({ color: 0x220a04, metalness: 0.4, roughness: 0.1, transparent: true, opacity: 0.35 });
    this.im = new THREE.InstancedMesh(geo, mat, n); this.glass = new THREE.InstancedMesh(geo, gmat, n);
    this.im.frustumCulled = this.glass.frustumCulled = false; this.im.renderOrder = 3;
    for (let i = 0; i < n; i++) this.blocks.push({ c: i % this.cols, r: (i / this.cols) | 0, state: 0, t: 0 });
    scene.add(this.glass, this.im);
    // hub + ring rails that carry the blocks
    this.rails = new THREE.Group();
    for (const y of [0.1, 3.45]) { const t = new THREE.Mesh(new THREE.TorusGeometry(RB, 0.08, 8, 160), emissiveMat(0xff2a0a, 3)); t.rotation.x = Math.PI / 2; t.position.y = y; this.rails.add(t); }
    scene.add(this.rails);
    this.setOn(false);
  },
  setOn(on) { this.on = on; this.im.visible = this.glass.visible = this.rails.visible = on; this.blocks.forEach(b => { b.state = 0; b.t = 0; }); },
  update(t, dt) {
    if (!this.on) return;
    this.rot = t * 0.22;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      if (b.state === 1) { b.t += dt; if (b.t > 9) { b.state = 2; b.t = 0; } }
      else if (b.state === 2) { b.t += dt; if (b.t > 0.7) { b.state = 0; b.t = 0; } }
      const ac = this.rot + (b.c + 0.5) * TAU / this.cols;
      p.set(Math.cos(ac) * RB, this.rowY[b.r], Math.sin(ac) * RB); q.setFromAxisAngle(up, -ac - Math.PI / 2);
      const sc = b.state === 1 ? 0 : b.state === 2 ? (Math.random() < 0.5 + b.t ? 1 : 0.0) : 1;
      s.set(sc, sc, sc); m4.compose(p, q, s); this.im.setMatrixAt(i, m4); this.glass.setMatrixAt(i, m4);
    }
    this.im.instanceMatrix.needsUpdate = true; this.glass.instanceMatrix.needsUpdate = true;
  },
  // returns block index hit by a sphere at (x,y,z), or -1
  hit(x, y, z) {
    if (!this.on) return -1;
    const r = Math.hypot(x, z); if (Math.abs(r - RB) > 0.28 + D_R * 0.7) return -1;
    let la = (Math.atan2(z, x) - this.rot) % TAU; if (la < 0) la += TAU;
    const c = Math.floor(la / (TAU / this.cols)) % this.cols;
    for (let k = 0; k < this.rows; k++) if (Math.abs(y - this.rowY[k]) < this.half) { const i = k * this.cols + c; return this.blocks[i].state === 1 ? -1 : i; }
    return -1;
  },
  breakBlock(i) { const b = this.blocks[i]; if (!b || b.state === 1) return; b.state = 1; b.t = 0; },
  blockPos(i) { const b = this.blocks[i], ac = this.rot + (b.c + 0.5) * TAU / this.cols; return [Math.cos(ac) * RB, this.rowY[b.r], Math.sin(ac) * RB]; }
};
WALLFW.init();

/* ================= discs ================= */
const discGeo = {
  rim: new THREE.TorusGeometry(0.4, 0.07, 12, 56).rotateX(Math.PI / 2),
  face: new THREE.CylinderGeometry(0.35, 0.35, 0.05, 56),
  hub: new THREE.CylinderGeometry(0.1, 0.1, 0.11, 24),
  halo: new THREE.TorusGeometry(0.5, 0.018, 6, 56).rotateX(Math.PI / 2)
};
function makeDiscMesh(color, scale) {
  const c = new THREE.Color(color), g = new THREE.Group();
  const rimM = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(3.4) });
  const faceM = new THREE.MeshStandardMaterial({ color: 0x0b0c12, metalness: 0.9, roughness: 0.15, emissiveMap: DISCT, emissive: c.clone().multiplyScalar(2.2) });
  const hubM = new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(2) });
  const haloM = glowMat(c, 2, 0.6);
  g.add(new THREE.Mesh(discGeo.rim, rimM), new THREE.Mesh(discGeo.face, faceM), new THREE.Mesh(discGeo.hub, hubM), new THREE.Mesh(discGeo.halo, haloM));
  g.userData = { rimM, faceM, haloM, c };
  if (scale) g.scale.setScalar(scale);
  return g;
}
// ribbon trail: two crossed strips so it reads from any angle
class Trail {
  constructor(color, n, width) {
    this.n = n; this.w = width; this.pts = []; for (let i = 0; i < n; i++) this.pts.push(new THREE.Vector3());
    const pos = new Float32Array(n * 4 * 3), t = new Float32Array(n * 4), idx = [];
    for (let i = 0; i < n; i++) { t[i * 4] = t[i * 4 + 1] = t[i * 4 + 2] = t[i * 4 + 3] = i / (n - 1); }
    for (let i = 0; i < n - 1; i++) { for (const o of [0, 2]) { const a = i * 4 + o, b = a + 1, c = a + 4, d = a + 5; idx.push(a, c, b, b, c, d); } }
    this.geo = new THREE.BufferGeometry(); this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); this.geo.setAttribute('aT', new THREE.BufferAttribute(t, 1)); this.geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uC: { value: new THREE.Color(color) }, uA: { value: 1 } },
      vertexShader: 'attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying float vT; void main(){ float a = pow(1.-vT, 1.6)*uA; gl_FragColor = vec4((uC*1.3 + vec3(1.)*pow(1.-vT,8.)*0.25)*a*0.5, 1.); }'
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat); this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  reset(p) { for (const q of this.pts) q.copy(p); this.write(); }
  push(p) { const last = this.pts.pop(); last.copy(p); this.pts.unshift(last); this.write(); }
  write() {
    const a = this.geo.attributes.position.array, n = this.n;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i], w = this.w * (1 - i / n);
      a.set([p.x, p.y + w, p.z, p.x, p.y - w, p.z], i * 12);
      const q = this.pts[Math.min(i + 1, n - 1)], r = this.pts[Math.max(i - 1, 0)];
      let dx = r.x - q.x, dz = r.z - q.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      a.set([p.x - dz * w, p.y, p.z + dx * w, p.x + dz * w, p.y, p.z - dx * w], i * 12 + 6);
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  dispose() { scene.remove(this.mesh); this.geo.dispose(); this.mat.dispose(); }
}

/* ================= runners ================= */
const armorTint = c => new THREE.Color(0x15171f).lerp(new THREE.Color(c), 0.06);
const capsule = (r, l, cs) => (THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(r, l, 6, cs || 14) : new THREE.CylinderGeometry(r, r, l + r * 2, cs || 14));
const rbox = (w, h, d, r) => (THREE.RoundedBoxGeometry ? new THREE.RoundedBoxGeometry(w, h, d, 3, r || Math.min(w, h, d) * 0.3) : new THREE.BoxGeometry(w, h, d));

function makeRunner(color) {
  const c = new THREE.Color(color);
  const armor = new THREE.MeshPhysicalMaterial({ color: armorTint(color), metalness: 0.75, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, normalMap: ARMN, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.7 });
  const suit = new THREE.MeshStandardMaterial({ color: 0x0a0b11, metalness: 0.25, roughness: 0.62, normalMap: ARMN, normalScale: new THREE.Vector2(0.9, 0.9) });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x05060a, metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
  const glow = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.6) });
  const visorM = new THREE.MeshPhysicalMaterial({ color: 0x020203, metalness: 0.6, roughness: 0.08, clearcoat: 1, emissive: c.clone().multiplyScalar(1.5), emissiveIntensity: 1 });
  const M = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; if (parent) parent.add(m); return m; };
  const G = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(g); return g; };

  const root = new THREE.Group(), body = G(0, 0, 0, root), pelvis = G(0, 0.96, 0, body);
  M(rbox(0.3, 0.16, 0.2, 0.06), suit, 0, 0, 0, pelvis);
  const belt = M(new THREE.TorusGeometry(0.165, 0.025, 8, 32), glow, 0, 0.06, 0, pelvis); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.72, 1);
  M(rbox(0.12, 0.1, 0.05, 0.02), armor, 0, 0.04, 0.12, pelvis);
  const legs = [];
  for (const sd of [1, -1]) {
    const hip = G(0.1 * sd, -0.04, 0, pelvis);
    M(capsule(0.085, 0.28), suit, 0, -0.21, 0, hip);
    const tp = M(rbox(0.13, 0.26, 0.1, 0.04), armor, 0.01 * sd, -0.19, 0.045, hip); tp.rotation.x = -0.05;
    M(new THREE.BoxGeometry(0.012, 0.2, 0.02), glow, 0.07 * sd, -0.2, 0.0, hip);
    const knee = G(0, -0.45, 0, hip);
    const kp = M(new THREE.SphereGeometry(0.07, 16, 10), armor, 0, 0, 0.06, knee); kp.scale.set(1, 1.1, 0.8);
    M(new THREE.SphereGeometry(0.018, 8, 6), glow, 0, 0.01, 0.115, knee);
    M(capsule(0.07, 0.26), suit, 0, -0.2, 0, knee);
    M(rbox(0.11, 0.26, 0.09, 0.035), armor, 0, -0.2, 0.035, knee);
    M(new THREE.BoxGeometry(0.06, 0.012, 0.02), glow, 0, -0.29, 0.085, knee);
    const ankle = G(0, -0.42, 0, knee);
    M(rbox(0.13, 0.11, 0.27, 0.04), armor, 0, -0.03, 0.05, ankle);
    M(new THREE.BoxGeometry(0.135, 0.018, 0.25), glow, 0, -0.085, 0.05, ankle);
    legs.push({ hip, knee, ankle });
  }
  const spine = G(0, 0.06, 0, pelvis);
  M(capsule(0.12, 0.12), suit, 0, 0.12, 0, spine);
  const chest = G(0, 0.34, 0, spine);
  const rib = M(new THREE.SphereGeometry(0.2, 28, 18), suit, 0, 0, 0, chest); rib.scale.set(1.2, 1.05, 0.82);
  const plate = M(rbox(0.36, 0.26, 0.12, 0.05), armor, 0, 0.02, 0.08, chest); plate.rotation.x = -0.08;
  const bplate = M(rbox(0.34, 0.3, 0.1, 0.05), armor, 0, 0.0, -0.09, chest);
  // V chevron across the chest
  for (const sd of [1, -1]) { const v = M(new THREE.BoxGeometry(0.16, 0.016, 0.012), glow, 0.065 * sd, 0.02, 0.145, chest); v.rotation.z = 0.55 * sd; }
  M(new THREE.SphereGeometry(0.026, 12, 8), glow, 0, -0.03, 0.15, chest);
  // spine light and the back dock that carries spare discs
  M(new THREE.BoxGeometry(0.014, 0.22, 0.012), glow, 0, 0.0, -0.145, chest);
  const dock = G(0, 0.0, -0.17, chest);
  const dockRing = M(new THREE.TorusGeometry(0.17, 0.022, 8, 40), armor, 0, 0, 0, dock);
  const dockDiscs = [];
  for (let i = 0; i < 3; i++) { const d = makeDiscMesh(color, 0.36); d.userData.rimM.color.multiplyScalar(0.45); d.userData.haloM.opacity = 0.15; d.rotation.x = Math.PI / 2; d.position.set(0, 0, -0.035 - i * 0.032); dock.add(d); dockDiscs.push(d); }
  const collar = M(new THREE.TorusGeometry(0.1, 0.035, 10, 28), armor, 0, 0.19, 0, chest); collar.rotation.x = Math.PI / 2;
  const neck = G(0, 0.22, 0, chest);
  M(capsule(0.05, 0.06), suit, 0, 0.04, 0, neck);
  const head = G(0, 0.15, 0.01, neck);
  const helm = M(new THREE.SphereGeometry(0.15, 32, 22), glass, 0, 0, 0, head); helm.scale.set(0.98, 1.1, 1.06);
  const shell = M(new THREE.SphereGeometry(0.155, 32, 22, 0, TAU, 0, Math.PI * 0.55), armor, 0, 0.005, -0.012, head); shell.scale.set(1, 1.12, 1.08); shell.rotation.x = -0.35;
  const visor = M(new THREE.SphereGeometry(0.152, 32, 16, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.4, Math.PI * 0.2), visorM, 0, 0, 0.004, head); visor.scale.set(1, 1.1, 1.06);
  M(new THREE.BoxGeometry(0.02, 0.06, 0.2), armor, 0, 0.17, -0.02, head);
  M(new THREE.BoxGeometry(0.012, 0.012, 0.16), glow, 0, 0.205, -0.02, head);
  for (const sd of [1, -1]) { const ear = M(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 20), armor, 0.15 * sd, 0, -0.01, head); ear.rotation.z = Math.PI / 2; const er = M(new THREE.TorusGeometry(0.035, 0.008, 6, 20), glow, 0.178 * sd, 0, -0.01, head); er.rotation.y = Math.PI / 2; }
  const arms = [];
  for (const sd of [1, -1]) {
    const sh = G(0.25 * sd, 0.12, 0, chest);
    const pd = M(new THREE.SphereGeometry(0.105, 20, 12, 0, TAU, 0, Math.PI * 0.6), armor, 0.01 * sd, 0.02, 0, sh); pd.scale.set(1.05, 0.85, 1.05);
    M(new THREE.BoxGeometry(0.09, 0.012, 0.012), glow, 0.04 * sd, -0.01, 0.085, sh);
    M(capsule(0.055, 0.18), suit, 0, -0.14, 0, sh);
    const elbow = G(0, -0.29, 0, sh);
    M(new THREE.SphereGeometry(0.05, 12, 8), armor, 0, 0, 0, elbow);
    M(capsule(0.05, 0.16), suit, 0, -0.12, 0, elbow);
    const gaunt = M(new THREE.CylinderGeometry(0.07, 0.058, 0.17, 20), armor, 0, -0.13, 0, elbow);
    const gr = M(new THREE.TorusGeometry(0.066, 0.01, 6, 24), glow, 0, -0.07, 0, elbow); gr.rotation.x = Math.PI / 2;
    const hand = G(0, -0.27, 0, elbow);
    M(rbox(0.075, 0.09, 0.09, 0.025), suit, 0, -0.02, 0.005, hand);
    arms.push({ sh, elbow, hand });
  }
  // disc held in the throwing (right) hand while charging
  const handDisc = makeDiscMesh(color, 0.62); handDisc.position.set(0, -0.06, 0.06); handDisc.rotation.z = Math.PI / 2; handDisc.visible = false; arms[1].hand.add(handDisc);
  // deflector: a hex-lattice energy shell in front of the body
  const shieldMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC: { value: c.clone() }, uHit: { value: 0 }, uA: { value: 0 }, uTime },
    vertexShader: 'varying vec3 vN, vV, vP; void main(){ vP = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: `uniform vec3 uC; uniform float uHit, uA, uTime; varying vec3 vN, vV, vP;
      void main(){ float fr = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.2);
        vec2 uv = vec2(atan(vP.x, vP.z)*3.2, vP.y*3.2); vec2 r = vec2(1., 1.732); vec2 a = mod(uv, r)-r*0.5, b = mod(uv-r*0.5, r)-r*0.5; vec2 g = dot(a,a)<dot(b,b)?a:b;
        float e = smoothstep(0.08, 0., 0.5 - max(abs(g.x), dot(abs(g), normalize(r))));
        float scan = 0.5+0.5*sin(vP.y*20. - uTime*10.);
        vec3 col = uC * (0.03 + fr*0.9 + e*(0.35+uHit*2.5) + scan*0.04) + vec3(1.)*uHit*0.6*fr;
        gl_FragColor = vec4(col*uA*0.8, 1.); }`
  });
  const shield = new THREE.Mesh(new THREE.SphereGeometry(SHIELD_R * 0.86, 40, 20, Math.PI / 2 - SHIELD_ARC, SHIELD_ARC * 2, 0, Math.PI * 0.72), shieldMat);
  shield.position.y = SHIELD_Y; shield.visible = false; shield.renderOrder = 4; root.add(shield);
  const shieldCore = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.42, 0.5, 20, 1, true), glowMat(c, 2.2, 0.55)); shieldCore.position.set(0.06, 2.05, 0.12); shieldCore.visible = false; root.add(shieldCore);
  // player light: makes their podium glow in their colour

  root.traverse(o => { if (o.isMesh && o.material === glow) o.castShadow = false; });
  return { root, body, pelvis, spine, chest, head, neck, legs, arms, dockDiscs, handDisc, shield, shieldCore, shieldMat, glow, glowBase: c.clone().multiplyScalar(2.6), visorM, armor };
}

// pose a runner: everything eases toward a target pose built from the player's state
function poseRunner(p, dt) {
  const R = p.rig, st = p.anim, t = p.animT;
  const k = Math.min(1, dt * 14);
  const P = { lean: 0, twist: 0, hipBob: 0, armL: [0, 0, 0.12], armR: [0, 0, -0.12], elbL: -0.35, elbR: -0.35, legL: [0, 0], legR: [0, 0], head: 0, crouch: 0, roll: 0 };
  const sp = Math.hypot(p.vx, p.vz), moving = p.onGround && sp > 0.4 && p.mode === 'play';
  // local movement direction relative to facing, for strafing legs
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), fwd = (p.vx * fx + p.vz * fz), side = (p.vx * fz - p.vz * fx);
  if (moving) {
    const ph = p.stride, amp = clamp(sp / RUN, 0, 1) * 0.65;
    P.legL = [Math.sin(ph) * amp * Math.sign(fwd || 1), -Math.max(0, Math.cos(ph)) * amp * 1.2];
    P.legR = [-Math.sin(ph) * amp * Math.sign(fwd || 1), -Math.max(0, -Math.cos(ph)) * amp * 1.2];
    P.hipBob = Math.abs(Math.cos(ph)) * 0.035; P.lean = fwd / RUN * 0.12; P.roll = -side / RUN * 0.1;
    P.armL[0] = -Math.sin(ph) * amp * 0.5; P.armR[0] = Math.sin(ph) * amp * 0.5;
  } else {
    P.hipBob = Math.sin(t * 2.1) * 0.008; P.armL[2] = 0.14 + Math.sin(t * 2.1) * 0.02; P.armR[2] = -0.14 - Math.sin(t * 2.1) * 0.02;
    P.crouch = 0.05; P.legL = [0.08, -0.16]; P.legR = [-0.05, -0.12];
  }
  // throwing arm
  if (p.charge > 0 && !p.shieldOn) { P.armR = [-1.2, 0.3, -0.5]; P.elbR = -1.1; P.twist = -0.2; }
  if (p.throwT > 0) { const q = 1 - p.throwT / 0.28; P.armR = [lerp(-2.1, 0.9, q), lerp(0.4, -0.9, q), -0.3]; P.elbR = lerp(-1.4, -0.15, q); P.twist = lerp(-0.45, 0.5, q); }
  // shield: the throwing arm goes straight up holding a disc flat over the head; the dome forms from it
  if (p.shieldOn) { P.armR = [-3.05, 0, -0.12]; P.elbR = -0.05; P.armL = [-0.6, 0, 0.5]; P.elbL = -0.7; P.twist = 0; P.crouch = 0.1; P.head = 0.15; }
  if (!p.onGround && p.mode === 'play') { P.legL = [0.7, -1.2]; P.legR = [0.3, -0.7]; P.armL[2] = 0.6; P.armR[2] = -0.6; P.crouch = 0; }
  if (p.stun > 0) { P.lean = -0.45; P.armL = [-0.9, 0, 1.0]; P.armR = [-0.9, 0, -1.0]; P.head = -0.3; }
  if (p.teeter > 0) { const w = t * 16; P.lean = -0.35 + Math.sin(t * 5) * 0.12; P.armL = [-1.6 + Math.sin(w) * 1.3, 0, 1.3]; P.armR = [-1.6 - Math.sin(w) * 1.3, 0, -1.3]; P.legL = [0.4, -0.3]; P.head = -0.2; }
  if (p.mode === 'fall') { const w = t * 9; P.lean = -0.6; P.armL = [-2.4 + Math.sin(w) * 0.8, 0, 1.2]; P.armR = [-2.4 - Math.sin(w) * 0.8, 0, -1.2]; P.legL = [Math.sin(w) * 0.8, -0.9]; P.legR = [-Math.sin(w) * 0.8, -0.6]; P.head = -0.5; }
  if (p.mode === 'win') { const w = t * 4; P.armR = [-2.9, 0, -0.25]; P.elbR = -0.1; P.armL = [-0.3 + Math.sin(w) * 0.2, 0, 0.5]; P.twist = Math.sin(w * 0.5) * 0.3; P.hipBob = Math.abs(Math.sin(w)) * 0.06; P.head = 0.25; }
  if (p.mode === 'idle') { P.armR = [-0.2, 0, -0.2]; }

  const e = (o, prop, v) => { o[prop] = lerp(o[prop], v, k); };
  e(R.pelvis.position, 'y', 0.96 + P.hipBob - P.crouch);
  e(R.body.rotation, 'x', P.lean); e(R.body.rotation, 'z', P.roll);
  e(R.spine.rotation, 'y', P.twist);
  e(R.head.rotation, 'x', -P.head);
  const L = [[P.legL, R.legs[0]], [P.legR, R.legs[1]]];
  for (const [[h, kn], leg] of L) { e(leg.hip.rotation, 'x', -h - P.crouch * 1.4); e(leg.knee.rotation, 'x', -kn + P.crouch * 2.4); e(leg.ankle.rotation, 'x', -P.crouch * 1.0 + kn * 0.3); }
  const A = [[P.armL, P.elbL, R.arms[0]], [P.armR, P.elbR, R.arms[1]]];
  for (const [[ax, ay, az], el, arm] of A) { e(arm.sh.rotation, 'x', ax); e(arm.sh.rotation, 'y', ay); e(arm.sh.rotation, 'z', az); e(arm.elbow.rotation, 'x', el); }
  // spare discs on the back
  const inHand = (p.charge > 0 || p.shieldOn) && p.discsHome > 0;
  for (let i = 0; i < 3; i++) R.dockDiscs[i].visible = i < p.discsHome - (inHand ? 1 : 0);
  R.handDisc.visible = inHand;
  if (inHand) {
    R.handDisc.rotation.z = p.shieldOn ? 0 : Math.PI / 2; R.handDisc.position.set(0, p.shieldOn ? -0.14 : -0.06, p.shieldOn ? 0 : 0.06);
    R.handDisc.rotation.y += dt * (p.shieldOn ? 38 : 14); R.handDisc.scale.setScalar(p.shieldOn ? 1.0 + Math.sin(t * 30) * 0.04 : 1);
  }
  R.shieldCore.visible = p.shieldOn; if (p.shieldOn) R.shieldCore.material.opacity = 0.35 + Math.sin(t * 22) * 0.15;
  // deflector
  const sa = R.shieldMat.uniforms.uA; sa.value = damp(sa.value, p.shieldOn ? 1 : 0, 18, dt);
  R.shield.visible = sa.value > 0.02; R.shieldMat.uniforms.uHit.value = Math.max(0, R.shieldMat.uniforms.uHit.value - dt * 3);
  // hit flash on the glow lines
  const fl = Math.max(0, p.flash); R.glow.color.copy(R.glowBase).lerp(new THREE.Color(5, 5, 5), Math.min(1, fl * 3));
  R.visorM.emissiveIntensity = 1 + fl * 4;
  // invulnerability flicker
  const dz = p.derezAt != null ? uTime.value - p.derezAt : 99, derezing = p.mode === 'dead' && dz < 1.05;
  if (derezing) { R.glow.color.setRGB(0.5, 3.5, 0.9); const j = Math.random() < 0.25 ? 1 + Math.random() * 0.25 : 1; R.root.scale.set(j, 1 - dz * 0.35, j); }
  else R.root.scale.set(1, 1, 1);
  R.root.visible = derezing ? Math.random() > dz * 0.85 : p.mode !== 'dead' && p.mode !== 'out' && !(p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0);
}

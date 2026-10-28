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
    top.position.y = 0.006; top.receiveShadow = true;   // clear of the side lip beneath it
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
    fragmentShader: 'uniform vec3 uC; uniform float uTime; varying vec2 vUv; varying vec3 vN, vV; void main(){ float f = pow(abs(dot(normalize(vN),normalize(vV))),2.); float a = f*pow(clamp(vUv.y, 0., 1.),2.2)*0.32*(0.8+0.2*sin(vUv.y*40.+uTime*9.)); gl_FragColor=vec4(uC*a,1.); }'
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
    const slab = new THREE.Mesh(rbox(hw * 2 - 0.04, top + 0.52, 0.5, 0.12), new THREE.MeshStandardMaterial({ color: 0x14161e, metalness: 0.85, roughness: 0.35, normalMap: HULLT.nrm, map: HULLT.map, emissiveMap: HULLT.em, emissive: new THREE.Color(st.color).multiplyScalar(0.9) }));
    slab.position.y = (top - 0.6) / 2; slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
    const c = new THREE.Color(st.color);
    for (const y of [-0.55, top]) { const e = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.06, 0.07, 0.56), emissiveMat(c, 3)); e.position.y = y; g.add(e); }
    for (const x of [-hw, hw]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.09, top + 0.74, 0.6), emissiveMat(c, 3)); e.position.set(x, (top - 0.6) / 2, 0); g.add(e); }
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
    const ggeo = new THREE.BoxGeometry(TAU * RB / this.cols - 0.28, this.half * 2 - 0.14, 0.49);   // glass core just inside the glowing shell
    this.im = new THREE.InstancedMesh(geo, mat, n); this.glass = new THREE.InstancedMesh(ggeo, gmat, n);
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
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying float vT; void main(){ float a = pow(clamp(1.-vT, 0., 1.), 1.6)*uA; gl_FragColor = vec4((uC*1.3 + vec3(1.)*pow(clamp(1.-vT, 0., 1.),8.)*0.25)*a*0.5, 1.); }'
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

/* ---------------- runner: an athletic skinned body under sculpted armour ----------------
   One skeleton (pelvis, spine, chest, neck, head, hips/knees/ankles, shoulders/elbows/hands).
   The body is a single lofted mesh, sculpted cross-section by cross-section, skinned to that
   skeleton so knees, elbows, hips, waist and shoulders bend smoothly. Armour plates, gloves,
   boots and the helmet are rigid parts bound to one bone each, merged per material, so a whole
   runner is only a handful of draw calls. */
let SUITT = null;
function makeSuitTextures() {
  const W = 512, H = 512, rnd = mulberry(909);
  // height: fine twill weave, soft compression ribbing, panel seams with stitching
  const hc = cnv(W, H), h = hc.getContext('2d');
  h.fillStyle = '#808080'; h.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) { const o = ((x / 3 + y / 3) % 4) < 2 ? 18 : -14; h.fillStyle = `rgba(${o > 0 ? 255 : 0},${o > 0 ? 255 : 0},${o > 0 ? 255 : 0},${Math.abs(o) / 255})`; h.fillRect(x, y, 2, 2); }
  for (let y = 0; y < H; y += 24) { const g = h.createLinearGradient(0, y, 0, y + 24); g.addColorStop(0, 'rgba(0,0,0,.18)'); g.addColorStop(0.5, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); h.fillStyle = g; h.fillRect(0, y, W, 24); }
  noiseFill(h, W, H, rnd, 10, false);
  const seamsU = [0.0, 0.25, 0.5, 0.75], seamsV = [0.0, 0.5];
  h.fillStyle = 'rgba(0,0,0,.95)'; for (const u of seamsU) { h.fillRect(u * W - 2, 0, 4, H); h.fillRect((u * W + W - 2) % W, 0, 4, H); } for (const v of seamsV) h.fillRect(0, v * H - 2, W, 4);
  h.fillStyle = 'rgba(255,255,255,.55)'; for (const u of seamsU) for (let y = 4; y < H; y += 10) { h.fillRect(u * W + 5, y, 2, 5); h.fillRect((u * W - 7 + W) % W, y, 2, 5); }
  const nrm = texOf(normalFromHeight(hc, 4), false, true);
  // albedo: near-black technical fabric, slightly darker in the seams
  const ac = cnv(W, H), a = ac.getContext('2d');
  a.fillStyle = '#1b1d24'; a.fillRect(0, 0, W, H); noiseFill(a, W, H, rnd, 8, false);
  a.fillStyle = 'rgba(0,0,0,.6)'; for (const u of seamsU) a.fillRect(u * W - 3, 0, 6, H); for (const v of seamsV) a.fillRect(0, v * H - 3, W, 6);
  a.fillStyle = 'rgba(70,74,86,.35)'; for (let y = 0; y < H; y += 24) a.fillRect(0, y + 11, W, 2);
  // emissive: thin piping along the side seams, with small dashes
  const ec = cnv(W, H), e = ec.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H); e.fillStyle = '#fff';
  for (const u of [0.25, 0.75]) { e.fillRect(u * W + (u < 0.5 ? 9 : -11), 0, 2, H); for (let y = 0; y < H; y += 64) e.fillRect(u * W + (u < 0.5 ? 13 : -17), y + 20, 4, 18); }
  return { map: texOf(ac, true, true), nrm, em: texOf(ec, true, true) };
}

// bones: name, parent, local offset (rest pose: standing straight, arms hanging at the sides)
const RIG_BONES = [
  ['body', null, [0, 0, 0]], ['pelvis', 'body', [0, 0.96, 0]], ['spine', 'pelvis', [0, 0.06, 0]], ['chest', 'spine', [0, 0.34, 0]],
  ['neck', 'chest', [0, 0.22, 0]], ['head', 'neck', [0, 0.15, 0.01]],
  ['hipL', 'pelvis', [0.1, -0.04, 0]], ['kneeL', 'hipL', [0, -0.45, 0]], ['ankleL', 'kneeL', [0, -0.42, 0]],
  ['hipR', 'pelvis', [-0.1, -0.04, 0]], ['kneeR', 'hipR', [0, -0.45, 0]], ['ankleR', 'kneeR', [0, -0.42, 0]],
  ['shL', 'chest', [0.215, 0.12, 0]], ['elbowL', 'shL', [0, -0.29, 0]], ['handL', 'elbowL', [0, -0.27, 0]],
  ['shR', 'chest', [-0.215, 0.12, 0]], ['elbowR', 'shR', [0, -0.29, 0]], ['handR', 'elbowR', [0, -0.27, 0]]
];
const RIG_I = {}; RIG_BONES.forEach((b, i) => RIG_I[b[0]] = i);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Loft a vertical tube through horizontal cross-sections (superellipses with optional bumps),
// skinned by height. sec: { y, rx, rz, x, z }, wfn(y) -> [[bone, w], [bone, w]], bump(theta, y) -> radius multiplier
function loftTube(sec, segs, n, wfn, bump, capBottom) {
  const pos = [], nor = [], uv = [], si = [], sw = [], idx = [];
  let vacc = 0;
  for (let i = 0; i < sec.length; i++) {
    const S = sec[i]; if (i > 0) vacc += Math.abs(sec[i - 1].y - S.y) * 1.6;
    const w = wfn(S.y);
    for (let j = 0; j <= segs; j++) {
      const th = j / segs * TAU, sx = Math.sin(th), cz = -Math.cos(th);   // th = 0 at the back, PI at the front
      const ex = Math.sign(sx) * Math.pow(Math.abs(sx), 2 / n), ez = Math.sign(cz) * Math.pow(Math.abs(cz), 2 / n);
      const m = bump ? bump(th, S.y) : 1;
      pos.push((S.x || 0) + S.rx * ex * m, S.y, (S.z || 0) + S.rz * ez * m);
      uv.push(j / segs, vacc);
      si.push(w[0][0], w[1] ? w[1][0] : 0, 0, 0); sw.push(w[0][1], w[1] ? w[1][1] : 0, 0, 0);
    }
  }
  const R = segs + 1;
  for (let i = 0; i < sec.length - 1; i++) for (let j = 0; j < segs; j++) { const a = i * R + j, b = a + 1, c = a + R, d = c + 1; idx.push(a, c, b, b, c, d); }
  if (capBottom) {   // close the lowest ring with a fan
    const L = sec.length - 1, S = sec[L], ci = pos.length / 3, w = wfn(S.y);
    pos.push(S.x || 0, S.y - 0.01, S.z || 0); uv.push(0.5, vacc); si.push(w[0][0], w[1] ? w[1][0] : 0, 0, 0); sw.push(w[0][1], w[1] ? w[1][1] : 0, 0, 0);
    for (let j = 0; j < segs; j++) idx.push(L * R + j, ci, L * R + j + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  // make sure faces point outward, and weld the normals across the UV seam
  const P = g.attributes.position, N = g.attributes.normal;
  const mid = Math.floor(sec.length / 2) * R + Math.floor(segs / 2), cx = sec[Math.floor(sec.length / 2)].x || 0, cz0 = sec[Math.floor(sec.length / 2)].z || 0;
  if ((P.getX(mid) - cx) * N.getX(mid) + (P.getZ(mid) - cz0) * N.getZ(mid) < 0) { const I = g.index.array; for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; } g.computeVertexNormals(); }
  for (let i = 0; i < sec.length; i++) { const a = i * R, b = a + segs; const nx = N.getX(a) + N.getX(b), ny = N.getY(a) + N.getY(b), nz = N.getZ(a) + N.getZ(b), l = Math.hypot(nx, ny, nz) || 1; N.setXYZ(a, nx / l, ny / l, nz / l); N.setXYZ(b, nx / l, ny / l, nz / l); }
  return g;
}
// merge rigid parts (each on one bone) and skinned pieces into one skinned geometry
function mergeSkinned(list) {
  let n = 0; const gs = list.map(it => { const g = it.g.index ? it.g.toNonIndexed() : it.g.clone(); if (it.m) g.applyMatrix4(it.m); n += g.attributes.position.count; return [g, it]; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  let o = 0;
  for (const [g, it] of gs) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.attributes.skinIndex) { si.set(g.attributes.skinIndex.array, o * 4); sw.set(g.attributes.skinWeight.array, o * 4); }
    else for (let k = 0; k < c; k++) { si[(o + k) * 4] = it.bone; sw[(o + k) * 4] = 1; }
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); out.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return out;
}

function makeRunner(color) {
  if (!SUITT) SUITT = makeSuitTextures();
  const c = new THREE.Color(color);
  const armor = new THREE.MeshPhysicalMaterial({ color: armorTint(color), metalness: 0.75, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1, normalMap: ARMN, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.75, side: THREE.DoubleSide });
  const suit = new THREE.MeshStandardMaterial({ color: 0x8c8f99, map: SUITT.map, normalMap: SUITT.nrm, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.74, metalness: 0.08, envMapIntensity: 0.6, emissiveMap: SUITT.em, emissive: c.clone().multiplyScalar(0.9) });
  const glove = new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: 0.45, metalness: 0.35, normalMap: SUITT.nrm, normalScale: new THREE.Vector2(0.5, 0.5) });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x05060a, metalness: 0.2, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
  const glow = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.6) });
  const visorM = new THREE.MeshPhysicalMaterial({ color: 0x020203, metalness: 0.6, roughness: 0.08, clearcoat: 1, emissive: c.clone().multiplyScalar(1.5), emissiveIntensity: 1 });

  // skeleton in rest pose
  const root = new THREE.Group(), bones = [], B = {};
  for (const [name, par, off] of RIG_BONES) { const b = new THREE.Bone(); b.name = name; b.position.set(off[0], off[1], off[2]); (par ? B[par] : root).add(b); B[name] = b; bones.push(b); }
  root.updateMatrixWorld(true);
  const W = name => B[name].matrixWorld;   // rest world matrix of a bone
  const parts = { suit: [], armor: [], glow: [], glove: [], glass: [], visor: [] };
  // add a rigid part: geometry placed in the bone's local frame
  const add = (mat, bone, geo, x, y, z, rx, ry, rz, sx, sy, sz) => {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || sx || 1, sz || sx || 1));
    if (bone === 'head') local.premultiply(new THREE.Matrix4().makeScale(0.8, 0.8, 0.8));   // helmet sized to a real head
    parts[mat].push({ g: geo, m: W(bone).clone().multiply(local), bone: RIG_I[bone] });
  };
  // ---- the body ----
  const two = (a, b, y0, y1, y) => { const t = sstep(y0, y1, y); return [[a, 1 - t], [b, t]]; };
  const torsoW = y => y < 1.06 ? two(RIG_I.pelvis, RIG_I.spine, 0.99, 1.07, y) : y < 1.34 ? two(RIG_I.spine, RIG_I.chest, 1.26, 1.34, y) : two(RIG_I.chest, RIG_I.neck, 1.55, 1.61, y);
  const TORSO = [   // y, half-width, half-depth, centre z (top down)
    [1.75, .048, .05, .012], [1.68, .052, .054, .012], [1.61, .057, .057, .008], [1.575, .075, .066, 0], [1.545, .13, .088, -.008], [1.505, .172, .1, -.002],
    [1.46, .19, .118, .006], [1.40, .192, .13, .012], [1.33, .184, .132, .014], [1.26, .17, .122, .012], [1.19, .156, .113, .008], [1.12, .148, .108, .006],
    [1.06, .152, .11, .002], [1.0, .166, .118, -.004], [0.94, .176, .124, -.01], [0.88, .172, .12, -.01], [0.83, .15, .108, -.004], [0.80, .12, .09, 0]
  ].map(([y, rx, rz, z]) => ({ y, rx, rz, z }));
  // pecs, shoulder blades and glutes as gentle bulges on the cross-sections
  const torsoBump = (th, y) => {
    const front = Math.max(0, -Math.cos(th)), back = Math.max(0, Math.cos(th)), sideA = Math.abs(Math.sin(th));
    const pec = front * Math.exp(-Math.pow((y - 1.39) / 0.05, 2)) * (0.55 + 0.45 * Math.pow(Math.abs(Math.sin(th * 2)), 0.6)) * 0.07;
    const blade = back * Math.exp(-Math.pow((y - 1.4) / 0.06, 2)) * sideA * 0.06;
    const glute = back * Math.exp(-Math.pow((y - 0.9) / 0.05, 2)) * (0.5 + 0.5 * sideA) * 0.08;
    const lat = sideA * Math.exp(-Math.pow((y - 1.32) / 0.08, 2)) * 0.03;
    return 1 + pec + blade + glute + lat;
  };
  parts.suit.push({ g: loftTube(TORSO, 44, 2.6, torsoW, torsoBump, true) });
  for (const sd of [1, -1]) {
    const S = sd > 0 ? 'L' : 'R', x = 0.1 * sd;
    const LEG = [[1.0, .08, .092, 0], [0.93, .092, .102, -.004], [0.85, .089, .097, 0], [0.76, .081, .088, .004], [0.67, .071, .077, .008], [0.58, .061, .066, .01],
      [0.52, .055, .059, .012], [0.47, .053, .057, .012], [0.42, .052, .058, .002], [0.37, .056, .066, -.012], [0.31, .055, .064, -.012], [0.24, .048, .054, -.008],
      [0.17, .04, .045, -.003], [0.11, .035, .039, 0], [0.06, .034, .038, 0]].map(([y, rx, rz, z]) => ({ y, rx, rz, z, x: x - sd * (0.92 - Math.min(0.92, y)) * 0.015 }));
    const legW = y => y > 0.95 ? (t => [[RIG_I['hip' + S], 1 - 0.5 * t], [RIG_I.pelvis, 0.5 * t]])(sstep(0.95, 1.0, y)) : y > 0.3 ? two(RIG_I['knee' + S], RIG_I['hip' + S], 0.43, 0.51, y) : two(RIG_I['ankle' + S], RIG_I['knee' + S], 0.07, 0.11, y);
    // inner-thigh (adductor) and calf (gastrocnemius) shaping
    const legBump = (th, y) => { const inner = Math.max(0, -Math.sin(th) * sd), back = Math.max(0, Math.cos(th)); return 1 + inner * Math.exp(-Math.pow((y - 0.8) / 0.08, 2)) * 0.06 + back * Math.exp(-Math.pow((y - 0.35) / 0.06, 2)) * 0.1 + Math.max(0, -Math.cos(th)) * Math.exp(-Math.pow((y - 0.72) / 0.1, 2)) * 0.05; };
    parts.suit.push({ g: loftTube(LEG, 30, 2.2, legW, legBump, false) });
    const ax = 0.215 * sd;
    const ARM = [[1.53, .05, .055, 0], [1.48, .062, .066, 0], [1.42, .06, .062, 0], [1.35, .054, .058, .004], [1.28, .049, .053, .006], [1.22, .044, .048, .002],
      [1.19, .042, .046, 0], [1.15, .045, .049, .004], [1.09, .045, .047, .005], [1.03, .04, .042, .003], [0.97, .033, .035, 0], [0.935, .03, .032, 0]].map(([y, rx, rz, z]) => ({ y, rx, rz, z, x: ax }));
    const armW = y => y > 1.47 ? (t => [[RIG_I['sh' + S], 1 - 0.4 * t], [RIG_I.chest, 0.4 * t]])(sstep(1.47, 1.54, y)) : y > 1.05 ? two(RIG_I['elbow' + S], RIG_I['sh' + S], 1.16, 1.22, y) : two(RIG_I['hand' + S], RIG_I['elbow' + S], 0.93, 0.97, y);
    const armBump = (th, y) => 1 + Math.max(0, -Math.cos(th)) * Math.exp(-Math.pow((y - 1.32) / 0.05, 2)) * 0.1 + Math.max(0, Math.cos(th)) * Math.exp(-Math.pow((y - 1.36) / 0.07, 2)) * 0.06 + Math.exp(-Math.pow((y - 1.12) / 0.05, 2)) * 0.05;
    parts.suit.push({ g: loftTube(ARM, 24, 2.2, armW, armBump, false) });

    // ---- leg armour ----
    add('armor', 'hip' + S, new THREE.CylinderGeometry(0.104, 0.084, 0.27, 20, 1, true, -1.05, 2.1), 0.004 * sd, -0.2, 0.004, 0.04, 0, 0);
    add('armor', 'hip' + S, rbox(0.03, 0.16, 0.06, 0.012), 0.088 * sd, -0.16, -0.01, 0, 0, 0.06 * sd);
    add('glow', 'hip' + S, new THREE.BoxGeometry(0.01, 0.17, 0.01), 0.104 * sd, -0.16, -0.01, 0, 0, 0.06 * sd);
    add('armor', 'knee' + S, new THREE.SphereGeometry(0.056, 18, 12), 0, 0.005, 0.05, 0, 0, 0, 1, 1.15, 0.72);
    add('glow', 'knee' + S, new THREE.SphereGeometry(0.014, 8, 6), 0, 0.012, 0.091);
    add('armor', 'knee' + S, new THREE.CylinderGeometry(0.069, 0.05, 0.28, 18, 1, true, -0.95, 1.9), 0, -0.19, 0.008, -0.04, 0, 0);
    add('glow', 'knee' + S, new THREE.BoxGeometry(0.05, 0.01, 0.012), 0, -0.29, 0.06);
    // boots: shaped upper, sole, toe cap and heel
    add('armor', 'ankle' + S, new THREE.CylinderGeometry(0.046, 0.054, 0.13, 18), 0, 0.02, -0.002);
    add('armor', 'ankle' + S, rbox(0.105, 0.05, 0.255, 0.02), 0, -0.035, 0.048);
    add('armor', 'ankle' + S, new THREE.SphereGeometry(0.056, 18, 10, 0, TAU, 0, Math.PI / 2), 0, -0.035, 0.12, 0, 0, 0, 0.95, 0.75, 1.35);
    add('armor', 'ankle' + S, rbox(0.085, 0.06, 0.06, 0.02), 0, -0.03, -0.055);
    add('glow', 'ankle' + S, new THREE.BoxGeometry(0.108, 0.01, 0.24), 0, -0.058, 0.048);

    // ---- arms: pauldron, elbow cop, gauntlet ----
    add('armor', 'sh' + S, new THREE.SphereGeometry(0.08, 22, 12, 0, TAU, 0, Math.PI * 0.5), 0.01 * sd, 0.012, 0, 0, 0, -0.28 * sd, 1.05, 0.62, 1.05);
    add('armor', 'sh' + S, new THREE.SphereGeometry(0.072, 20, 10, 0, TAU, Math.PI * 0.32, Math.PI * 0.2), 0.012 * sd, -0.03, 0, 0, 0, -0.3 * sd, 1.0, 0.9, 1.0);
    add('glow', 'sh' + S, new THREE.BoxGeometry(0.008, 0.008, 0.1), 0.083 * sd, -0.022, 0, 0, 0, -0.3 * sd);
    add('armor', 'elbow' + S, new THREE.SphereGeometry(0.044, 14, 10), 0, 0.0, -0.028, 0, 0, 0, 1, 1.1, 0.8);
    add('armor', 'elbow' + S, new THREE.CylinderGeometry(0.056, 0.043, 0.16, 20, 1, true), 0, -0.135, 0.004);
    add('glow', 'elbow' + S, new THREE.TorusGeometry(0.055, 0.006, 6, 28), 0, -0.07, 0.004, Math.PI / 2, 0, 0);
    // gloves: palm, four curled fingers, thumb, knuckle guard (palm faces the body)
    add('glove', 'hand' + S, rbox(0.032, 0.082, 0.078, 0.012), 0, -0.05, 0.004);
    for (let f = 0; f < 4; f++) {
      const z = 0.03 - f * 0.02, len = [0.062, 0.07, 0.066, 0.054][f];
      add('glove', 'hand' + S, rbox(0.019, len * 0.55, 0.017, 0.007), -0.006 * sd, -0.1, z, 0, 0, -0.25 * sd);
      add('glove', 'hand' + S, rbox(0.017, len * 0.5, 0.016, 0.007), -0.017 * sd, -0.136, z, 0, 0, -0.65 * sd);
    }
    add('glove', 'hand' + S, rbox(0.02, 0.05, 0.02, 0.008), -0.016 * sd, -0.05, 0.045, -0.5, 0, -0.3 * sd);
    add('armor', 'hand' + S, rbox(0.012, 0.05, 0.07, 0.006), 0.02 * sd, -0.06, 0.004);
  }
  // ---- pelvis: belt, buckle, hip guards ----
  add('armor', 'pelvis', new THREE.TorusGeometry(0.174, 0.026, 10, 44), 0, 0.075, -0.004, Math.PI / 2, 0, 0, 1, 0.73, 1);
  add('glow', 'pelvis', new THREE.TorusGeometry(0.177, 0.006, 6, 44), 0, 0.075, -0.004, Math.PI / 2, 0, 0, 1, 0.74, 1);
  add('armor', 'pelvis', rbox(0.1, 0.07, 0.035, 0.012), 0, 0.068, 0.126);
  add('glow', 'pelvis', new THREE.BoxGeometry(0.05, 0.01, 0.01), 0, 0.068, 0.145);
  for (const sd of [1, -1]) add('armor', 'pelvis', new THREE.CylinderGeometry(0.183, 0.19, 0.085, 16, 1, true, sd > 0 ? 1.2 : Math.PI + 1.2, 0.75), 0, -0.005, -0.006, 0, 0, 0, 1, 1, 0.7);
  // ---- abdomen: three segmented plates ----
  for (let i = 0; i < 3; i++) add('armor', 'spine', new THREE.CylinderGeometry(0.16, 0.162, 0.05, 20, 1, true, -0.75, 1.5), 0, 0.06 + i * 0.062, 0.006, 0, 0, 0, 1, 1, 0.74 + i * 0.03);
  // ---- chest: sculpted breastplate, back plate, collar, chevron light, spine light, disc dock ----
  add('armor', 'chest', new THREE.SphereGeometry(0.205, 30, 16, Math.PI / 2 - 1.05, 2.1, 0.95, 1.05), 0, 0.005, 0.012, 0, 0, 0, 1.0, 1.0, 0.7);
  add('armor', 'chest', new THREE.SphereGeometry(0.2, 26, 14, Math.PI * 1.5 - 1.1, 2.2, 0.85, 1.25), 0, 0.0, -0.01, 0, 0, 0, 1.0, 1.0, 0.64);
  add('armor', 'chest', new THREE.TorusGeometry(0.088, 0.026, 10, 30), 0, 0.185, 0.0, Math.PI / 2, 0, 0, 1.1, 1.0, 1);
  for (const sd of [1, -1]) add('glow', 'chest', new THREE.BoxGeometry(0.13, 0.012, 0.012), 0.056 * sd, 0.03, 0.142, -0.12, 0, 0.5 * sd);
  add('glow', 'chest', new THREE.SphereGeometry(0.022, 12, 8), 0, -0.012, 0.142);
  add('glow', 'chest', new THREE.BoxGeometry(0.012, 0.2, 0.01), 0, 0.0, -0.132);
  add('armor', 'chest', new THREE.TorusGeometry(0.16, 0.02, 8, 40), 0, 0, -0.158);
  // ---- head: helmet shell, glass, visor, crest, ear pods ----
  add('glass', 'head', new THREE.SphereGeometry(0.146, 32, 22), 0, 0, 0, 0, 0, 0, 0.96, 1.1, 1.05);
  add('armor', 'head', new THREE.SphereGeometry(0.152, 32, 22, 0, TAU, 0, Math.PI * 0.55), 0, 0.005, -0.012, -0.35, 0, 0, 0.99, 1.12, 1.08);
  add('visor', 'head', new THREE.SphereGeometry(0.149, 32, 16, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.4, Math.PI * 0.2), 0, 0, 0.004, 0, 0, 0, 1, 1.1, 1.06);
  add('armor', 'head', rbox(0.022, 0.06, 0.2, 0.01), 0, 0.165, -0.02);
  add('glow', 'head', new THREE.BoxGeometry(0.01, 0.01, 0.16), 0, 0.2, -0.02);
  add('armor', 'head', new THREE.CylinderGeometry(0.05, 0.06, 0.07, 18, 1, true, 0.4, TAU - 0.8), 0, -0.1, -0.03);   // jaw guard
  for (const sd of [1, -1]) {
    add('armor', 'head', new THREE.CylinderGeometry(0.043, 0.048, 0.045, 20), 0.143 * sd, 0, -0.01, 0, 0, Math.PI / 2);
    add('glow', 'head', new THREE.TorusGeometry(0.033, 0.007, 6, 20), 0.168 * sd, 0, -0.01, 0, Math.PI / 2, 0);
  }

  // one skinned mesh per material, all sharing the skeleton
  const skeleton = new THREE.Skeleton(bones);
  const mats = { suit, armor, glow, glove, glass, visor: visorM };
  const meshes = [];
  for (const k in parts) {
    if (!parts[k].length) continue;
    const m = new THREE.SkinnedMesh(mergeSkinned(parts[k]), mats[k]);
    m.frustumCulled = false; m.castShadow = k !== 'glow'; m.receiveShadow = k === 'suit' || k === 'armor';
    root.add(m); m.bind(skeleton, new THREE.Matrix4()); meshes.push(m);
  }
  // spare discs on the back dock, and the disc held in the throwing (right) hand
  const dock = new THREE.Group(); dock.position.set(0, 0.0, -0.17); B.chest.add(dock);
  const dockDiscs = [];
  for (let i = 0; i < 3; i++) { const d = makeDiscMesh(color, 0.36); d.userData.rimM.color.multiplyScalar(0.45); d.userData.haloM.opacity = 0.15; d.rotation.x = Math.PI / 2; d.position.set(0, 0, -0.035 - i * 0.058); dock.add(d); dockDiscs.push(d); }
  const handDisc = makeDiscMesh(color, 0.62); handDisc.position.set(0, -0.08, 0.05); handDisc.rotation.z = Math.PI / 2; handDisc.visible = false; B.handR.add(handDisc);
  // deflector: a hex-lattice energy shell in front of the body
  const shieldMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC: { value: c.clone() }, uHit: { value: 0 }, uA: { value: 0 }, uTime },
    vertexShader: 'varying vec3 vN, vV, vP; void main(){ vP = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: `uniform vec3 uC; uniform float uHit, uA, uTime; varying vec3 vN, vV, vP;
      void main(){ float fr = pow(max(0., 1. - abs(dot(normalize(vN), normalize(vV)))), 2.2);
        vec2 uv = vec2(atan(vP.x, vP.z)*3.2, vP.y*3.2); vec2 r = vec2(1., 1.732); vec2 a = mod(uv, r)-r*0.5, b = mod(uv-r*0.5, r)-r*0.5; vec2 g = dot(a,a)<dot(b,b)?a:b;
        float e = smoothstep(0.08, 0., 0.5 - max(abs(g.x), dot(abs(g), normalize(r))));
        float scan = 0.5+0.5*sin(vP.y*20. - uTime*10.);
        vec3 col = uC * (0.03 + fr*0.9 + e*(0.35+uHit*2.5) + scan*0.04) + vec3(1.)*uHit*0.6*fr;
        gl_FragColor = vec4(col*uA*0.8, 1.); }`
  });
  const shield = new THREE.Mesh(new THREE.SphereGeometry(SHIELD_R * 0.86, 40, 20, Math.PI / 2 - SHIELD_ARC, SHIELD_ARC * 2, 0, Math.PI * 0.72), shieldMat);
  shield.position.y = SHIELD_Y; shield.visible = false; shield.renderOrder = 4; root.add(shield);
  const shieldCore = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.42, 0.5, 20, 1, true), glowMat(c, 2.2, 0.55)); shieldCore.position.set(0.06, 2.05, 0.12); shieldCore.visible = false; root.add(shieldCore);

  const legs = [{ hip: B.hipL, knee: B.kneeL, ankle: B.ankleL }, { hip: B.hipR, knee: B.kneeR, ankle: B.ankleR }];
  const arms = [{ sh: B.shL, elbow: B.elbowL, hand: B.handL }, { sh: B.shR, elbow: B.elbowR, hand: B.handR }];
  return { root, body: B.body, pelvis: B.pelvis, spine: B.spine, chest: B.chest, head: B.head, neck: B.neck, legs, arms, dockDiscs, handDisc, shield, shieldCore, shieldMat, glow, glowBase: c.clone().multiplyScalar(2.6), visorM, armor, suit, meshes };
}

// ---- pose a runner: build a target pose from the player's state, then ease every joint toward it ----
function poseRunner(p, dt) {
  const R = p.rig, t = p.animT;
  const k = 1 - Math.exp(-dt * 16), kSlow = 1 - Math.exp(-dt * 7);
  // P: pelvis/torso + per-limb targets. leg: h (hip pitch, + = forward), a (hip abduction, + = outward), kn (knee bend >= 0), an (ankle pitch)
  // arm: x (shoulder pitch, - = forward/up), y (twist), z (abduction, + = outward), e (elbow bend >= 0), w (wrist)
  const P = { lean: 0.03, roll: 0, twist: 0, pYaw: 0, pRoll: 0, pX: 0, bob: 0, crouch: 0.03, headX: 0, headY: 0, breathe: 0,
    L: [{ h: 0, a: 0.03, kn: 0.06, an: null }, { h: 0, a: 0.03, kn: 0.06, an: null }],
    A: [{ x: 0.05, y: 0, z: 0.1, e: 0.3, w: 0 }, { x: 0.05, y: 0, z: 0.1, e: 0.3, w: 0 }] };
  const sp = Math.hypot(p.vx, p.vz), moving = p.onGround && sp > 0.4 && p.mode === 'play';
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), fwd = (p.vx * fx + p.vz * fz), side = (p.vx * fz - p.vz * fx);
  P.breathe = Math.sin(t * 1.7) * 0.018;
  if (moving) {
    const ph = p.stride, amp = clamp(sp / RUN, 0, 1), dir = Math.abs(fwd) > Math.abs(side) * 0.6 ? Math.sign(fwd || 1) : 0, str = Math.abs(side) > Math.abs(fwd) * 0.6 ? Math.sign(side) : 0;
    for (let i = 0; i < 2; i++) {
      const q = ph + i * Math.PI, s = Math.sin(q), sw = Math.max(0, Math.sin(q + 1.9));   // sw: swing phase (foot off the ground)
      const L = P.L[i];
      L.h = (dir ? dir : 0.35) * 0.62 * amp * s + 0.1 * amp;
      L.kn = 0.12 + amp * (1.05 * sw + 0.18 * Math.max(0, -s));
      L.a = 0.04 + (str ? str * (i === 0 ? 1 : -1) * 0.22 * amp * Math.max(0, s) : 0);
      L.an = null;   // keep the foot level (solved below), plus a toe-off flick at the end of stance
      L.toe = 0.35 * amp * Math.max(0, -Math.sin(q - 0.6)) * (1 - sw);
      // arms swing opposite their leg, elbows bent like a sprinter's
      const A = P.A[1 - i];
      A.x = -(dir || 0.4) * 0.55 * amp * s; A.e = 0.55 + 0.75 * amp + 0.35 * amp * Math.max(0, -A.x); A.z = 0.12 + 0.05 * amp; A.y = 0.15 * (i ? 1 : -1) * amp;
    }
    P.bob = (Math.abs(Math.cos(ph)) - 0.6) * 0.045 * amp; P.lean = 0.04 + fwd / RUN * 0.16; P.roll = -side / RUN * 0.12;
    P.pYaw = 0.17 * amp * Math.sin(ph) * (dir || 0); P.twist = -P.pYaw * 1.6; P.pRoll = 0.05 * amp * Math.cos(ph);
    P.crouch = 0.05 * amp; P.headX = -P.lean * 0.6;
  } else {
    // idle: weight on one hip, slow breathing, head looking about
    const sway = Math.sin(t * 0.55);
    P.pX = sway * 0.012; P.pRoll = sway * 0.035; P.L[0].kn = 0.06 + Math.max(0, -sway) * 0.12; P.L[1].kn = 0.06 + Math.max(0, sway) * 0.12;
    P.L[0].a = 0.07; P.L[1].a = 0.07; P.headY = Math.sin(t * 0.37) * 0.22; P.headX = Math.sin(t * 0.29) * 0.06;
    P.A[0].z = 0.12 + P.breathe; P.A[1].z = 0.12 + P.breathe; P.A[0].e = 0.32; P.A[1].e = 0.32; P.crouch = 0.04;
  }
  // throwing: wind-up with the throwing arm cocked back, front foot planted, torso coiled; then a whip-through follow-up
  if (p.charge > 0 && !p.shieldOn) { const A = P.A[1]; A.x = -1.45; A.y = -0.3; A.z = 0.75; A.e = 1.5; A.w = -0.4; P.twist = -0.45; P.A[0].x = -0.7; P.A[0].e = 0.9; P.A[0].z = 0.35; P.L[0].h = 0.35; P.L[0].kn = 0.3; P.L[1].h = -0.25; P.L[1].kn = 0.25; P.crouch = 0.07; P.lean = 0.0; }
  if (p.throwT > 0) {
    const q = 1 - p.throwT / 0.28, A = P.A[1];
    A.x = lerp(-1.9, 0.4, q); A.y = lerp(-0.4, 0.9, q); A.z = lerp(0.8, 0.2, q); A.e = lerp(1.4, 0.15, q); A.w = lerp(-0.6, 0.5, q);
    P.twist = lerp(-0.5, 0.55, q); P.pYaw = lerp(-0.15, 0.2, q); P.lean = lerp(0, 0.22, q);
    P.A[0].x = lerp(-0.8, 0.3, q); P.A[0].e = lerp(1.0, 0.6, q); P.A[0].z = 0.3;
    P.L[0].h = 0.35; P.L[0].kn = lerp(0.3, 0.45, q); P.L[1].h = -0.3; P.L[1].kn = 0.3; P.crouch = 0.08;
  }
  // shield: throwing arm straight up holding the disc flat overhead, braced wide stance
  if (p.shieldOn) {
    P.A[1] = { x: -3.0, y: 0, z: 0.1, e: 0.08, w: 0 }; P.A[0] = { x: -0.7, y: 0.3, z: 0.55, e: 1.1, w: 0 };
    P.twist = 0; P.crouch = 0.12; P.headX = 0.18; P.L[0].a = 0.17; P.L[1].a = 0.17; P.L[0].kn = 0.3; P.L[1].kn = 0.3; P.L[0].h = 0.12; P.L[1].h = -0.05;
  }
  if (!p.onGround && p.mode === 'play') { P.L[0] = { h: 0.75, a: 0.08, kn: 1.25 }; P.L[1] = { h: 0.3, a: 0.06, kn: 0.7 }; P.A[0].z = 0.75; P.A[1].z = 0.75; P.A[0].e = 0.5; P.A[1].e = 0.5; P.crouch = 0; P.lean = 0.12; }
  if (p.stun > 0) { P.lean = -0.4; P.headX = -0.35; P.A[0] = { x: -0.9, y: 0, z: 1.0, e: 0.6, w: 0 }; P.A[1] = { x: -0.9, y: 0, z: 1.0, e: 0.6, w: 0 }; P.L[0].kn = 0.35; P.L[1].kn = 0.35; P.crouch = 0.1; }
  if (p.teeter > 0) {
    const w = t * 16; P.lean = -0.32 + Math.sin(t * 5) * 0.12; P.headX = -0.25;
    P.A[0] = { x: -1.6 + Math.sin(w) * 1.3, y: 0, z: 1.25, e: 0.2, w: 0 }; P.A[1] = { x: -1.6 - Math.sin(w) * 1.3, y: 0, z: 1.25, e: 0.2, w: 0 };
    P.L[0] = { h: 0.45, a: 0.1, kn: 0.35 }; P.L[1] = { h: -0.1, a: 0.05, kn: 0.25 };
  }
  if (p.mode === 'fall') {
    const w = t * 9; P.lean = -0.55; P.headX = -0.45;
    P.A[0] = { x: -2.3 + Math.sin(w) * 0.8, y: 0, z: 1.1, e: 0.4, w: 0 }; P.A[1] = { x: -2.3 - Math.sin(w) * 0.8, y: 0, z: 1.1, e: 0.4, w: 0 };
    P.L[0] = { h: 0.4 + Math.sin(w) * 0.7, a: 0.15, kn: 0.9 }; P.L[1] = { h: 0.4 - Math.sin(w) * 0.7, a: 0.12, kn: 0.6 };
  }
  if (p.mode === 'win') { const w = t * 4; P.A[1] = { x: -2.95, y: 0, z: 0.2, e: 0.15, w: 0 }; P.A[0] = { x: -0.3 + Math.sin(w) * 0.2, y: 0, z: 0.35, e: 0.9, w: 0 }; P.twist = Math.sin(w * 0.5) * 0.3; P.bob = Math.abs(Math.sin(w)) * 0.06; P.headX = 0.25; }
  if (p.mode === 'idle') { P.A[1].x = -0.15; P.A[1].e = 0.45; }

  // ---- apply ----
  const e = (o, prop, v, kk) => { o[prop] = lerp(o[prop], v, kk || k); };
  e(R.pelvis.position, 'y', 0.96 + P.bob - P.crouch); e(R.pelvis.position, 'x', P.pX, kSlow);
  e(R.body.rotation, 'x', P.lean); e(R.body.rotation, 'z', P.roll);
  e(R.pelvis.rotation, 'y', P.pYaw); e(R.pelvis.rotation, 'z', P.pRoll, kSlow);
  e(R.spine.rotation, 'y', P.twist * 0.45); e(R.chest.rotation, 'y', P.twist * 0.55); e(R.spine.rotation, 'z', -P.pRoll * 0.8, kSlow);
  e(R.chest.rotation, 'x', -P.breathe - P.lean * 0.15); e(R.spine.rotation, 'x', P.crouch * 0.8);
  e(R.neck.rotation, 'x', -P.headX * 0.4); e(R.head.rotation, 'x', -P.headX * 0.6); e(R.head.rotation, 'y', P.headY - P.twist * 0.5, kSlow);
  for (let i = 0; i < 2; i++) {
    const L = P.L[i], leg = R.legs[i], sd = i === 0 ? 1 : -1;
    const hx = -L.h - P.crouch * 1.6, kx = (L.kn || 0) + P.crouch * 2.8;
    e(leg.hip.rotation, 'x', hx); e(leg.hip.rotation, 'z', (L.a || 0) * sd - P.pRoll); e(leg.hip.rotation, 'y', -P.pYaw * 0.5);
    e(leg.knee.rotation, 'x', Math.max(0, kx));
    // keep the foot roughly level with the ground (body lean included), then add the toe-off
    const an = L.an != null ? L.an : -(hx + kx + R.body.rotation.x) * 0.9 + (L.toe || 0);
    e(leg.ankle.rotation, 'x', an); e(leg.ankle.rotation, 'z', -(L.a || 0) * sd * 0.8);
  }
  for (let i = 0; i < 2; i++) {
    const A = P.A[i], arm = R.arms[i], sd = i === 0 ? 1 : -1;
    e(arm.sh.rotation, 'x', A.x); e(arm.sh.rotation, 'y', A.y * sd); e(arm.sh.rotation, 'z', A.z * sd);
    e(arm.elbow.rotation, 'x', -Math.max(0, A.e)); e(arm.hand.rotation, 'x', -(A.w || 0) - 0.08);
  }
  // spare discs on the back
  const inHand = (p.charge > 0 || p.shieldOn) && p.discsHome > 0;
  for (let i = 0; i < 3; i++) R.dockDiscs[i].visible = i < p.discsHome - (inHand ? 1 : 0);
  R.handDisc.visible = inHand;
  if (inHand) {
    R.handDisc.rotation.z = p.shieldOn ? 0 : Math.PI / 2; R.handDisc.position.set(0, p.shieldOn ? -0.16 : -0.08, p.shieldOn ? 0 : 0.05);
    R.handDisc.rotation.y += dt * (p.shieldOn ? 38 : 14); R.handDisc.scale.setScalar(p.shieldOn ? 1.0 + Math.sin(t * 30) * 0.04 : 1);
  }
  R.shieldCore.visible = p.shieldOn; if (p.shieldOn) R.shieldCore.material.opacity = 0.35 + Math.sin(t * 22) * 0.15;
  const sa = R.shieldMat.uniforms.uA; sa.value = damp(sa.value, p.shieldOn ? 1 : 0, 18, dt);
  R.shield.visible = sa.value > 0.02; R.shieldMat.uniforms.uHit.value = Math.max(0, R.shieldMat.uniforms.uHit.value - dt * 3);
  // hit flash on the glow lines and suit piping
  const fl = Math.max(0, p.flash); R.glow.color.copy(R.glowBase).lerp(new THREE.Color(5, 5, 5), Math.min(1, fl * 3));
  R.visorM.emissiveIntensity = 1 + fl * 4; R.suit.emissiveIntensity = 1 + fl * 3;
  const dz = p.derezAt != null ? uTime.value - p.derezAt : 99, derezing = p.mode === 'dead' && dz < 1.05;
  if (derezing) { R.glow.color.setRGB(0.5, 3.5, 0.9); const j = Math.random() < 0.25 ? 1 + Math.random() * 0.25 : 1; R.root.scale.set(j, 1 - dz * 0.35, j); }
  else R.root.scale.set(1, 1, 1);
  R.root.visible = derezing ? Math.random() > dz * 0.85 : p.mode !== 'dead' && p.mode !== 'out' && !(p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0);
}

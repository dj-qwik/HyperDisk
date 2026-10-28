/* ================= aim guide: dotted flight path + reticle (only visible in the thrower's own view) ================= */
const GUIDE_N = 96;
const guideDotGeo = new THREE.SphereGeometry(0.06, 8, 6);
const reticleGeo = new THREE.RingGeometry(0.55, 0.68, 40);
const reticleInner = new THREE.RingGeometry(0.16, 0.22, 24);
function makeGuide(p) {
  const layer = 1 + p.slot, col = new THREE.Color(p.color);
  const dots = new THREE.InstancedMesh(guideDotGeo, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.6), transparent: true, opacity: 0.6, depthWrite: false }), GUIDE_N);
  dots.frustumCulled = false; dots.layers.set(layer); dots.count = 0;
  // the aim line: four glowing bars that run round the court at the aimed height (or across the ceiling)
  const lineMat = new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color(0x9ff4ff), 0.5).multiplyScalar(3.2), transparent: true, opacity: 0.95, depthWrite: false });
  const line = new THREE.Group(), bars = [];
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.09, 0.09), lineMat); m.frustumCulled = false; line.add(m); bars.push(m); }
  // crosshair: two arrowheads pointing at the aim spot, plus a ring
  const xm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3c8bff).multiplyScalar(3), side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false });
  const ret = new THREE.Group();
  const arrow = new THREE.Shape(); arrow.moveTo(0, 0); arrow.lineTo(-0.26, 0.42); arrow.lineTo(0, 0.3); arrow.lineTo(0.26, 0.42); arrow.closePath();
  const ag = new THREE.ShapeGeometry(arrow);
  const up = new THREE.Mesh(ag, xm); up.position.y = 0.12; const dn = new THREE.Mesh(ag, xm); dn.rotation.z = Math.PI; dn.position.y = -0.12;
  const ring = new THREE.Mesh(reticleGeo, xm); ring.scale.setScalar(0.62);
  ret.add(up, dn, ring);
  for (const o of [dots, line, ret]) o.traverse(c => c.layers.set(layer));
  ret.renderOrder = 10; ret.children.forEach(c => c.renderOrder = 10);
  scene.add(dots, line, ret);
  return { dots, line, bars, ret, mat: xm, lineMat, arrows: [up, dn], ring };
}
function disposeGuide(g) { if (!g) return; scene.remove(g.dots, g.line, g.ret); }
const _gp = new THREE.Vector3(), _gv = new THREE.Vector3(), _ge = {}, _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gs = new THREE.Vector3(), _ga = {};
function setLine(g, hx, hz, y) {
  const b = g.bars;
  b[0].scale.set(2 * hx, 1, 1); b[0].position.set(0, y, hz); b[0].rotation.y = 0;
  b[1].scale.set(2 * hx, 1, 1); b[1].position.set(0, y, -hz); b[1].rotation.y = 0;
  b[2].scale.set(2 * hz, 1, 1); b[2].position.set(hx, y, 0); b[2].rotation.y = Math.PI / 2;
  b[3].scale.set(2 * hz, 1, 1); b[3].position.set(-hx, y, 0); b[3].rotation.y = Math.PI / 2;
}
function updateGuide(p, dt) {
  const g = p.guide; if (!g) return;
  const show = p.mode === 'play' && (state === 'play' || state === 'count');
  g.dots.visible = false; g.ret.visible = show; g.line.visible = show; if (!show) return;
  const ap = aimPoint(p, p.aimYaw, p.aimElev, _ga);
  // the line: round the walls at the aimed height, or a rectangle across the ceiling through the crosshair
  if (!ap.ceil) setLine(g, BOX.hx - 0.06, BOX.hz - 0.06, ap.y);
  else { const inset = Math.min(BOX.hx - Math.abs(ap.x), BOX.hz - Math.abs(ap.z)); setLine(g, Math.max(0.3, BOX.hx - inset), Math.max(0.3, BOX.hz - inset), YC - 0.07); }
  // crosshair on the wall (or ceiling), facing out of it
  g.ret.position.set(ap.x + ap.nx * 0.05, ap.y + ap.ny * 0.05, ap.z + ap.nz * 0.05);
  g.ret.quaternion.setFromUnitVectors(_tmp2.set(0, 0, 1), _tmp.set(ap.nx, ap.ny, ap.nz));
  if (ap.ceil) g.ret.rotateZ(-p.aimYaw);
  // flight path preview (with banks), and a lock when it runs into a rival
  const tgt = aimTarget(p, p.aimYaw);
  handPos(p, _gp); _gv.set(ap.x - _gp.x, ap.y - _gp.y, ap.z - _gp.z).normalize().multiplyScalar(D_SPEED);
  let n = 0, dist = 0, lock = false, bounces = 0; const h = 1 / 60;
  for (let i = 0; i < 320; i++) {
    const px = _gp.x, py = _gp.y, pz = _gp.z;
    discEnvStep(_gp, _gv, h, p.slot, _ge);
    dist += Math.hypot(_gp.x - px, _gp.y - py, _gp.z - pz);
    let hitR = false; for (const o of players) if (o !== p && o.mode === 'play' && hitsBody(o, _gp.x, _gp.y, _gp.z, D_R * 0.8)) hitR = true;
    if (hitR) { lock = true; break; }
    if (_ge.kind === 'wall' || _ge.kind === 'ceil') { bounces++; if (bounces > 2) break; }
    if (_ge.kind === 'ring' || _ge.kind === 'block' || _ge.kind === 'bulwark' || _ge.kind === 'abyss') break;
  }
  const pulse = lock ? 1 + Math.sin(uTime.value * 18) * 0.12 : 1;
  g.arrows[0].position.y = 0.12 * pulse + (lock ? 0 : 0.05); g.arrows[1].position.y = -g.arrows[0].position.y;
  g.ret.scale.setScalar(ap.ceil ? 2.0 : 1.7);
  g.mat.color.copy(new THREE.Color(lock ? 0xffffff : 0x3c8bff).multiplyScalar(lock ? 3.2 : 3));
  g.ring.visible = lock;
}

/* ================= views: split-screen cameras + per-view HUD ================= */
let views = [];
const viewsEl = $('#views');
function makeView(p, kind) {
  const cam = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  cam.layers.enable(0); if (p) cam.layers.enable(1 + p.slot);
  const v = { p, kind, cam, x: 0, y: 0, w: 1, h: 1, el: null, pos: new THREE.Vector3(0, 12, 30), look: new THREE.Vector3(), flash: new THREE.Vector4(), tags: [], last: {} };
  const el = document.createElement('div'); el.className = 'view';
  if (p && kind === 'player') {
    el.style.setProperty('--c', p.css);
    el.innerHTML = `<div class="frame"></div><div class="tags"></div>
      <div class="who"><span class="n">${p.name}</span><span class="lives"></span></div>
      <div class="chg"></div><div class="msg"></div>
      <div class="bot">
        <div class="meter shield"><div class="t"><span>DEFLECTS</span><span class="dv">7</span></div><div class="bar"><div class="fill"></div></div></div>
        <div class="discs"><i></i><i></i><i></i></div>
        <div class="elev"><div class="eg"><b></b><u></u></div><i class="el">LEVEL</i></div>
        <div class="meter heat"><div class="t"><span>OVERLOAD</span><span class="hv">0%</span></div><div class="bar"><div class="fill"></div></div></div>
      </div>`;
  } else el.innerHTML = '<div class="frame"></div><div class="tags"></div>';
  viewsEl.appendChild(el); v.el = el;
  v.q = s => el.querySelector(s);
  if (p && kind === 'player') {
    v.hud = { lives: v.q('.lives'), shield: v.q('.shield .fill'), heat: v.q('.heat .fill'), hv: v.q('.hv'), dv: v.q('.dv'), discs: [...el.querySelectorAll('.discs i')], eg: v.q('.eg b'), el: v.q('.el'), msg: v.q('.msg'), chg: v.q('.chg') };
  }
  v.tagLayer = v.q('.tags');
  return v;
}
function clearViews() { views.forEach(v => v.el.remove()); views = []; }
function buildViews() {
  clearViews();
  const locals = players.filter(p => p.local && p.kind === 'human');
  if (state === 'lobby' || !locals.length) views.push(makeView(null, 'cine'));
  else { locals.forEach(p => views.push(makeView(p, 'player'))); if (locals.length === 3) views.push(makeView(null, 'cine')); }
  views.forEach(v => { v.tags = players.filter(o => !v.p || o !== v.p).map(o => { const t = document.createElement('div'); t.className = 'ntag'; t.style.setProperty('--c', o.css); t.innerHTML = `${o.name}<div class="l"></div>`; v.tagLayer.appendChild(t); return { o, el: t, l: t.querySelector('.l'), lv: -1 }; }); });
  layoutViews();
}
function layoutViews() {
  const W = window.innerWidth, H = window.innerHeight, n = views.length;
  const rects = n <= 1 ? [[0, 0, W, H]]
    : n === 2 ? (W >= H ? [[0, 0, W / 2, H], [W / 2, 0, W / 2, H]] : [[0, 0, W, H / 2], [0, H / 2, W, H / 2]])
      : [[0, 0, W / 2, H / 2], [W / 2, 0, W / 2, H / 2], [0, H / 2, W / 2, H / 2], [W / 2, H / 2, W / 2, H / 2]];
  views.forEach((v, i) => {
    const [x, y, w, h] = rects[i]; Object.assign(v, { x, y, w, h });
    Object.assign(v.el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    v.el.classList.toggle('solo', n === 1); v.el.classList.toggle('small', n > 2 || w < 700);
    v.cam.aspect = w / Math.max(1, h); v.cam.fov = v.cam.aspect < 1 ? 74 : n > 2 ? 64 : 60; v.cam.updateProjectionMatrix();
  });
}
function viewFlash(p, colorHex, amt) { for (const v of views) if (v.p === p) { const c = new THREE.Color(colorHex); v.flash.set(c.r, c.g, c.b, amt); } }
function popFor(p, text, big) {
  for (const v of views) if (v.p === p && v.kind === 'player') {
    const d = document.createElement('div'); d.className = 'pop'; d.textContent = text; if (big) d.style.fontSize = '30px';
    v.el.appendChild(d); setTimeout(() => d.remove(), 1150);
  }
}

// ---- camera rigs ----
const _cp = new THREE.Vector3(), _cl = new THREE.Vector3();
function shoulderCam(p, outPos, outLook, aimYaw) {
  const a = aimYaw == null ? p.aimYaw : aimYaw, fx = Math.sin(a), fz = Math.cos(a), rx = -Math.cos(a), rz = Math.sin(a);
  const e = p.aimElev == null ? ELEV_LEVEL : p.aimElev, hi = e > ELEV_WALL ? 1 : clamp((e - ELEV_LEVEL) / (ELEV_WALL - ELEV_LEVEL), -0.3, 1);
  const lift = hi > 0 ? hi * 0.6 : -hi * 0.4;
  outPos.set(p.x - fx * 4.9 + rx * 0.6, p.y + 2.75 + lift, p.z - fz * 4.9 + rz * 0.6);
  outLook.set(p.x + fx * 16 + rx * 0.25, p.y + 1.6 + (hi > 0 ? hi * 3.2 : hi * 4), p.z + fz * 16 + rz * 0.25);
}
function orbitCam(t, outPos, outLook, r, h, speed, phase, cx, cy, cz) {
  const a = t * speed + (phase || 0);
  outPos.set((cx || 0) + Math.cos(a) * r, (cy || 0) + h, (cz || 0) + Math.sin(a) * r); outLook.set(cx || 0, (cy || 0) + 1, cz || 0);
}
function updateView(v, dt) {
  const p = v.p; let k = 8;
  const t = uTime.value;
  if (state === 'lobby' || state === 'boot') {
    // slow cinematic drift around the demo duel
    const a = t * 0.06; _cp.set(Math.cos(a) * (BOX.hx - 1.2), 5.5 + Math.sin(t * 0.13) * 4, Math.sin(a) * (BOX.hz - 1.2)); _cl.set(Math.cos(a + 2.4) * 4, 1.5, Math.sin(a + 2.4) * 4); k = 2;
  } else if (state === 'intro' && p) {
    const q = clamp(phaseT / 3.2, 0, 1), e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
    const st = stationOf(p), a0 = Math.atan2(st.z, st.x) + 2.2, a1 = Math.atan2(st.z, st.x);
    shoulderCam(p, _tmp, _tmp2, st.yaw);
    const a = lerp(a0, a1, e), y = lerp(11, _tmp.y, e);
    // sweep round the inside of the court, settling behind the runner's shoulder
    _cp.set(lerp(Math.cos(a) * (BOX.hx - 1), _tmp.x, e), y, lerp(Math.sin(a) * (BOX.hz - 1), _tmp.z, e)); _cl.set(0, 0, 0).lerp(_tmp2, e); k = 30;
  } else if (!p) {
    // spectator / 4th quadrant: hunt the action
    const live = players.filter(o => o.mode === 'play'); const a = t * 0.09;
    let cx = 0, cz = 0; live.forEach(o => { cx += o.x / live.length; cz += o.z / live.length; });
    _cp.set(Math.cos(a) * (BOX.hx - 1.5), 10 + Math.sin(t * 0.2) * 3, Math.sin(a) * (BOX.hz - 1.5)); _cl.set(cx * 0.5, 0.5, cz * 0.5); k = 3;
  } else if (state === 'end' && winner) {
    orbitCam(t, _cp, _cl, 4.6, 1.9, 0.35, 0, winner.x, winner.y, winner.z); _cl.y = winner.y + 1.35;
    // keep the winner left of the results card
    const rx = -Math.cos(t * 0.35 + Math.PI / 2), rz = -Math.sin(t * 0.35 + Math.PI / 2); _cl.x -= rx * 1.4; _cl.z -= rz * 1.4; k = 4;
  } else if (p.mode === 'play' || p.mode === 'idle' || p.mode === 'win') { shoulderCam(p, _cp, _cl); k = 12; }
  else if (p.mode === 'fall') { _cp.copy(v.pos); _cl.set(p.x, p.y + 0.8, p.z); k = 6; }
  else if (p.mode === 'dead' && p.lives > 0) { const pad = homePad(p), st = stationOf(p); shoulderCam({ x: pad.x, y: pad.y, z: pad.z, lvl: 1 }, _cp, _cl, st.yaw); _cp.y += 1.5; k = 3; }
  else { // out: spectate from high up
    const a = t * 0.07 + p.slot * 1.6; _cp.set(Math.cos(a) * (BOX.hx - 1.5), 12, Math.sin(a) * (BOX.hz - 1.5)); _cl.set(0, 0, 0); k = 2.5;
  }
  if (window.__camOverride) { const o = window.__camOverride; _cp.set(o.pos[0], o.pos[1], o.pos[2]); _cl.set(o.look[0], o.look[1], o.look[2]); v.snap = true; }
  const f = 1 - Math.exp(-k * dt);
  if (v.snap) { v.pos.copy(_cp); v.look.copy(_cl); v.snap = false; } else { v.pos.lerp(_cp, f); v.look.lerp(_cl, Math.min(1, f * 1.2)); }
  // keep cameras inside the glass
  v.pos.x = clamp(v.pos.x, -BOX.hx + 0.4, BOX.hx - 0.4); v.pos.z = clamp(v.pos.z, -BOX.hz + 0.4, BOX.hz - 0.4); v.pos.y = Math.min(v.pos.y, YC - 0.6);
  v.cam.position.copy(v.pos);
  const sh = p ? p.shake : 0;
  if (sh > 0) v.cam.position.add(_tmp.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh));
  v.cam.lookAt(v.look);
  v.flash.w = Math.max(0, v.flash.w - dt * 2.4);
}

// ---- per-view HUD ----
const _pj = new THREE.Vector3();
function updateHud(v) {
  const p = v.p, L = v.last;
  if (p && v.hud) {
    const H = v.hud;
    if (L.lives !== p.lives) { L.lives = p.lives; H.lives.innerHTML = Array.from({ length: Math.max(S.lives, p.lives) }, (_, i) => `<i class="${i < p.lives ? '' : 'gone'}"></i>`).join(''); }
    if (L.sh !== p.defl) { L.sh = p.defl; H.shield.style.width = (p.defl / DEFLECTS * 100) + '%'; H.dv.textContent = p.defl; H.shield.style.opacity = p.defl > 0 ? 1 : 0.3; }
    const hv = Math.round(p.heat / 8 * 100); if (L.hv !== hv) { L.hv = hv; H.heat.style.width = hv + '%'; H.hv.textContent = Math.round(100 + p.heat * KB_HEAT * 100) + '%'; }
    const dh = p.discsHome - (p.charge > 0 ? 1 : 0); if (L.dh !== dh) { L.dh = dh; H.discs.forEach((e, i) => e.classList.toggle('out', i >= dh)); }
    // elevation gauge: where the aim line sits between the bottom of the walls and the ceiling
    const ev = Math.round(p.aimElev * 10); if (L.ev !== ev) { L.ev = ev; const ceil = p.aimElev > ELEV_WALL, y = ELEV_FLOOR + p.aimElev;
      H.eg.style.bottom = (ceil ? 100 : clamp(p.aimElev / ELEV_WALL * 100, 0, 100)) + '%'; H.eg.parentNode.classList.toggle('ceil', ceil);
      H.el.textContent = ceil ? 'CEILING' : Math.abs(y - 1.32) < 0.45 ? 'LEVEL' : y > 1.32 ? 'HIGH ' + y.toFixed(0) + 'm' : 'LOW'; }
    const cq = p.charge > 0 ? Math.min(1, p.charge / D_CHARGE) : 0; if (L.cq !== cq) { L.cq = cq; H.chg.style.opacity = cq > 0 ? 1 : 0; H.chg.style.setProperty('--p', cq); }
    let msg = '';
    if (p.mode === 'dead' && p.lives > 0) msg = `<div class="big">FLATLINED</div><div class="sm">REBOOTING IN ${Math.max(0, Math.ceil(2.2 - p.deadT))}</div>`;
    else if (p.mode === 'fall' && p.lives <= 0) msg = `<div class="big">ELIMINATED</div>`;
    else if (p.mode === 'out' && state === 'play') msg = `<div class="big" style="font-size:28px">ELIMINATED</div><div class="sm">SPECTATING</div>`;
    else if (state === 'end' && winner === p) msg = '';
    if (L.msg !== msg) { L.msg = msg; H.msg.innerHTML = msg; }
  }
  // name tags
  for (const t of v.tags) {
    const o = t.o, on = (o.mode === 'play' || o.mode === 'idle' || o.mode === 'fall' || o.mode === 'win') && state !== 'lobby';
    if (!on) { if (t.vis !== false) { t.el.style.display = 'none'; t.vis = false; } continue; }
    _pj.set(o.x, o.y + 2.25, o.z).project(v.cam);
    if (_pj.z > 1 || _pj.z < -1 || Math.abs(_pj.x) > 1.2 || Math.abs(_pj.y) > 1.2) { if (t.vis !== false) { t.el.style.display = 'none'; t.vis = false; } continue; }
    if (t.vis !== true) { t.el.style.display = ''; t.vis = true; }
    t.el.style.left = ((_pj.x * 0.5 + 0.5) * v.w).toFixed(1) + 'px'; t.el.style.top = ((-_pj.y * 0.5 + 0.5) * v.h).toFixed(1) + 'px';
    if (t.lv !== o.lives) { t.lv = o.lives; t.l.innerHTML = Array.from({ length: Math.max(S.lives, o.lives) }, (_, i) => `<i class="${i < o.lives ? '' : 'gone'}"></i>`).join(''); }
  }
}

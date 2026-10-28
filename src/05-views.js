/* ================= aim guide: dotted flight path + reticle (only visible in the thrower's own view) ================= */
const GUIDE_N = 46;
const guideDotGeo = new THREE.SphereGeometry(0.06, 8, 6);
const reticleGeo = new THREE.RingGeometry(0.55, 0.68, 40);
const reticleInner = new THREE.RingGeometry(0.16, 0.22, 24);
function makeGuide(p) {
  const layer = 1 + p.slot;
  const dots = new THREE.InstancedMesh(guideDotGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(2.2), transparent: true, opacity: 0.85, depthWrite: false }), GUIDE_N);
  dots.frustumCulled = false; dots.layers.set(layer); dots.count = 0;
  const ret = new THREE.Group();
  const a = new THREE.Mesh(reticleGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(3), side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false }));
  const b = new THREE.Mesh(reticleInner, a.material);
  const ticks = []; for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.32), a.material); const an = i / 4 * TAU; t.position.set(Math.cos(an) * 0.95, Math.sin(an) * 0.95, 0); t.rotation.z = an + Math.PI / 2; ret.add(t); ticks.push(t); }
  ret.add(a, b); ret.traverse(o => o.layers.set(layer)); ret.renderOrder = 10; a.renderOrder = b.renderOrder = 10;
  scene.add(dots, ret);
  return { dots, ret, mat: a.material, lock: false };
}
function disposeGuide(g) { if (!g) return; scene.remove(g.dots, g.ret); }
const _gp = new THREE.Vector3(), _gv = new THREE.Vector3(), _ge = {}, _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gs = new THREE.Vector3();
function updateGuide(p, dt) {
  const g = p.guide; if (!g) return;
  const show = p.mode === 'play' && (state === 'play' || state === 'count');
  g.dots.visible = show && S.guide; g.ret.visible = show; if (!show) return;
  const tgt = aimTarget(p, p.aimYaw), pitch = solvePitch(p, p.aimYaw, p.lvl, tgt);
  handPos(p, _gp); aimDir(p.aimYaw, pitch, _gv).multiplyScalar(D_SPEED);
  let n = 0, dist = 0, end = null, lock = false, bounces = 0; const h = 1 / 60;
  const maxDist = S.guide ? 36 : 6;
  for (let i = 0; i < 160 && n < GUIDE_N; i++) {
    const px = _gp.x, py = _gp.y, pz = _gp.z;
    discEnvStep(_gp, _gv, h, p.slot, _ge);
    dist += Math.hypot(_gp.x - px, _gp.y - py, _gp.z - pz);
    if (dist > 0.75) { dist = 0; if (S.guide) { _gs.setScalar(1 - n / GUIDE_N * 0.6); _gm.compose(_gp, _gq, _gs); g.dots.setMatrixAt(n++, _gm); } }
    if (tgt && tgt.mode === 'play' && hitsBody(tgt, _gp.x, _gp.y, _gp.z, D_R * 0.8)) { end = { x: _gp.x, y: _gp.y, z: _gp.z, nx: _gp.x - tgt.x, ny: 0, nz: _gp.z - tgt.z }; lock = true; break; }
    if (_ge.kind === 'wall' || _ge.kind === 'ceil') { bounces++; if (!end) end = { x: _gp.x, y: _gp.y, z: _gp.z, nx: _ge.nx, ny: _ge.ny, nz: _ge.nz }; if (p.lvl !== 2 || bounces > 1) break; }
    if (_ge.kind === 'ring' || _ge.kind === 'block' || _ge.kind === 'abyss') { end = { x: _gp.x, y: _gp.y, z: _gp.z, nx: _ge.nx || 0, ny: _ge.ny || 1, nz: _ge.nz || 0 }; break; }
    if (i * h * D_SPEED > maxDist && end) break;
  }
  g.dots.count = n; g.dots.instanceMatrix.needsUpdate = true;
  if (end) {
    g.ret.position.set(end.x, end.y, end.z);
    const nn = _tmp.set(end.nx, end.ny, end.nz); if (nn.lengthSq() < 1e-4) nn.set(0, 1, 0); nn.normalize();
    g.ret.quaternion.setFromUnitVectors(_tmp2.set(0, 0, 1), nn);
    const s = lock ? 0.9 + Math.sin(uTime.value * 18) * 0.1 : 1.1; g.ret.scale.setScalar(s);
    g.ret.rotation.z += 0; g.ret.children.forEach((c, i) => { if (i < 4) c.position.setLength(lock ? 0.75 : 0.95); });
    g.mat.color.copy(new THREE.Color(lock ? 0xffffff : p.color).multiplyScalar(lock ? 3 : 2.6));
  } else g.ret.visible = false;
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
        <div class="meter shield"><div class="t"><span>DEFLECTOR</span></div><div class="bar"><div class="fill"></div></div></div>
        <div class="discs"><i></i><i></i><i></i></div>
        <div class="elev"><i>HIGH</i><i>MID</i><i>LOW</i></div>
        <div class="meter heat"><div class="t"><span>OVERLOAD</span><span class="hv">0%</span></div><div class="bar"><div class="fill"></div></div></div>
      </div>`;
  } else el.innerHTML = '<div class="frame"></div><div class="tags"></div>';
  viewsEl.appendChild(el); v.el = el;
  v.q = s => el.querySelector(s);
  if (p && kind === 'player') {
    v.hud = { lives: v.q('.lives'), shield: v.q('.shield .fill'), heat: v.q('.heat .fill'), hv: v.q('.hv'), discs: [...el.querySelectorAll('.discs i')], elev: [...el.querySelectorAll('.elev i')], msg: v.q('.msg'), chg: v.q('.chg') };
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
  const lift = p.lvl === 2 ? 0.5 : p.lvl === 0 ? 0.25 : 0;
  outPos.set(p.x - fx * 4.9 + rx * 0.6, p.y + 2.75 + lift, p.z - fz * 4.9 + rz * 0.6);
  outLook.set(p.x + fx * 16 + rx * 0.25, p.y + 1.5 + (p.lvl === 2 ? 2.4 : p.lvl === 0 ? -1.2 : 0.2), p.z + fz * 16 + rz * 0.25);
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
    const a = t * 0.06; _cp.set(Math.cos(a) * 25, 5.5 + Math.sin(t * 0.13) * 4, Math.sin(a) * 25); _cl.set(Math.cos(a + 2.4) * 4, 1.5, Math.sin(a + 2.4) * 4); k = 2;
  } else if (state === 'intro' && p) {
    const q = clamp(phaseT / 3.2, 0, 1), e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
    const st = stationOf(p), a0 = Math.atan2(st.z, st.x) + 2.2, a1 = Math.atan2(st.z, st.x);
    shoulderCam(p, _tmp, _tmp2, st.yaw);
    const a = lerp(a0, a1, e), r = lerp(27, Math.hypot(_tmp.x, _tmp.z), e), y = lerp(11, _tmp.y, e);
    _cp.set(Math.cos(a) * r, y, Math.sin(a) * r); _cl.set(0, 0, 0).lerp(_tmp2, e); k = 30;
  } else if (!p) {
    // spectator / 4th quadrant: hunt the action
    const live = players.filter(o => o.mode === 'play'); const a = t * 0.09;
    let cx = 0, cz = 0; live.forEach(o => { cx += o.x / live.length; cz += o.z / live.length; });
    _cp.set(Math.cos(a) * 24, 10 + Math.sin(t * 0.2) * 3, Math.sin(a) * 24); _cl.set(cx * 0.5, 0.5, cz * 0.5); k = 3;
  } else if (state === 'end' && winner) {
    orbitCam(t, _cp, _cl, 4.6, 1.9, 0.35, 0, winner.x, winner.y, winner.z); _cl.y = winner.y + 1.35;
    // keep the winner left of the results card
    const rx = -Math.cos(t * 0.35 + Math.PI / 2), rz = -Math.sin(t * 0.35 + Math.PI / 2); _cl.x -= rx * 1.4; _cl.z -= rz * 1.4; k = 4;
  } else if (p.mode === 'play' || p.mode === 'idle' || p.mode === 'win') { shoulderCam(p, _cp, _cl); k = 12; }
  else if (p.mode === 'fall') { _cp.copy(v.pos); _cl.set(p.x, p.y + 0.8, p.z); k = 6; }
  else if (p.mode === 'dead' && p.lives > 0) { const pad = homePad(p), st = stationOf(p); shoulderCam({ x: pad.x, y: pad.y, z: pad.z, lvl: 1 }, _cp, _cl, st.yaw); _cp.y += 1.5; k = 3; }
  else { // out: spectate from high up
    const a = t * 0.07 + p.slot * 1.6; _cp.set(Math.cos(a) * 22, 12, Math.sin(a) * 22); _cl.set(0, 0, 0); k = 2.5;
  }
  if (window.__camOverride) { const o = window.__camOverride; _cp.set(o.pos[0], o.pos[1], o.pos[2]); _cl.set(o.look[0], o.look[1], o.look[2]); v.snap = true; }
  const f = 1 - Math.exp(-k * dt);
  if (v.snap) { v.pos.copy(_cp); v.look.copy(_cl); v.snap = false; } else { v.pos.lerp(_cp, f); v.look.lerp(_cl, Math.min(1, f * 1.2)); }
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
    const sw = Math.round(p.shieldE); if (L.sh !== sw) { L.sh = sw; H.shield.style.width = sw + '%'; H.shield.style.opacity = p.shieldCD > 0 ? 0.35 : 1; }
    const hv = Math.round(p.heat / 8 * 100); if (L.hv !== hv) { L.hv = hv; H.heat.style.width = hv + '%'; H.hv.textContent = Math.round(100 + p.heat * KB_HEAT * 100) + '%'; }
    const dh = p.discsHome - (p.charge > 0 ? 1 : 0); if (L.dh !== dh) { L.dh = dh; H.discs.forEach((e, i) => e.classList.toggle('out', i >= dh)); }
    if (L.lvl !== p.lvl) { L.lvl = p.lvl; H.elev.forEach((e, i) => e.classList.toggle('on', 2 - i === p.lvl)); }
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

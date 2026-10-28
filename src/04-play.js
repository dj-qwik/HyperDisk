/* ================= match state ================= */
let state = 'boot';            // boot | lobby | intro | count | play | end
let players = [];              // slot order; each player owns STATIONS[p.slot]
let matchT = 0, phaseT = 0, paused = false, winner = null, endT = 0, countN = 0;
const DISCS = [];              // every disc in the match (local and remote)
let evSeq = 0;

/* ================= input ================= */
const K = {}, KP = new Set();          // held keys, keys pressed this frame
const MOUSE = { locked: false, dx: 0, l: false, r: false, wheel: 0, lPressed: false };
let pads = [], padPrev = [], padEdges = [];
const btn = (gp, i) => { const b = gp && gp.buttons[i]; return !!(b && (b.pressed || b.value > 0.45)); };
const axis = (gp, i) => { const v = gp && gp.axes[i] || 0; return Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84; };
function pollPads() {
  let list = []; try { list = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { list = []; }
  pads = []; padEdges = [];
  for (let i = 0; i < (list ? list.length : 0); i++) {
    const gp = list[i]; pads[i] = gp; const prev = padPrev[i] || [], cur = [], edges = [];
    if (gp) {
      for (let b = 0; b < gp.buttons.length; b++) { cur[b] = btn(gp, b); if (cur[b] && !prev[b]) edges.push(b); }
      // right stick flicks act as virtual buttons 100 (up) and 101 (down)
      const ry = gp.axes[3] || 0; cur[100] = ry < -0.65; cur[101] = ry > 0.65;
      if (cur[100] && !prev[100]) edges.push(100); if (cur[101] && !prev[101]) edges.push(101);
    }
    padPrev[i] = cur; padEdges[i] = edges;
  }
}
const padHit = (i, b) => !!(padEdges[i] && padEdges[i].includes(b));
const KEYS = {
  kb1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], aimL: ['KeyQ'], aimR: ['KeyE'], lvlUp: ['KeyR'], lvlDn: ['KeyF'],
    fire: ['Space'], shield: ['ShiftLeft'], hop: ['KeyC'], recall: ['KeyX'] },
  kb2: { up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'], aimL: ['ArrowLeft'], aimR: ['ArrowRight'], lvlUp: ['ArrowUp'], lvlDn: ['ArrowDown'],
    fire: ['Slash', 'Enter', 'NumpadEnter', 'Numpad0', 'ControlRight'], shield: ['Period', 'ShiftRight'], hop: ['KeyU'], recall: ['KeyO'] }
};
const held = list => list.some(k => K[k]);
const hit = list => list.some(k => KP.has(k));
function readHuman(p, dt) {
  const i = { mx: 0, mz: 0, aim: 0, aimAbs: 0, lvl: 0, fire: false, shield: false, hop: false, recall: false, analog: false };
  const c = p.ctl;
  if (c.type === 'kb1' || c.type === 'kb2') {
    const m = KEYS[c.type];
    i.mx = (held(m.right) ? 1 : 0) - (held(m.left) ? 1 : 0); i.mz = (held(m.up) ? 1 : 0) - (held(m.down) ? 1 : 0);
    i.aim = (held(m.aimR) ? 1 : 0) - (held(m.aimL) ? 1 : 0);
    i.lvl = (hit(m.lvlUp) ? 1 : 0) - (hit(m.lvlDn) ? 1 : 0);
    i.fire = held(m.fire); i.shield = held(m.shield); i.hop = hit(m.hop); i.recall = hit(m.recall);
    if (c.type === 'kb1') {
      if (MOUSE.locked) { i.aimAbs = MOUSE.dx * 0.0026; i.fire = i.fire || MOUSE.l; i.shield = i.shield || MOUSE.r; }
      if (MOUSE.wheel) { i.lvl += MOUSE.wheel < 0 ? 1 : -1; }
    }
  } else if (c.type === 'pad') {
    const gp = pads[c.idx];
    if (gp) {
      i.mx = axis(gp, 0); i.mz = -axis(gp, 1);
      const rx = axis(gp, 2); i.aim = Math.sign(rx) * Math.pow(Math.abs(rx), 1.6); i.analog = true;
      i.lvl = (padHit(c.idx, 5) || padHit(c.idx, 12) || padHit(c.idx, 100) ? 1 : 0) - (padHit(c.idx, 4) || padHit(c.idx, 13) || padHit(c.idx, 101) ? 1 : 0);
      i.fire = btn(gp, 7); i.shield = btn(gp, 6) || btn(gp, 1); i.hop = padHit(c.idx, 0); i.recall = padHit(c.idx, 2) || padHit(c.idx, 3);
      // d-pad left/right fine aim
      i.aim += (btn(gp, 15) ? 0.5 : 0) - (btn(gp, 14) ? 0.5 : 0);
    }
  } else if (c.type === 'touch') {
    i.mx = TOUCH.mx; i.mz = TOUCH.mz; i.aimAbs = TOUCH.dx * 0.006; TOUCH.dx = 0; i.fire = TOUCH.fire; i.shield = TOUCH.shield;
    i.hop = TOUCH.hopP; i.lvl = TOUCH.lvlP; TOUCH.hopP = false; TOUCH.lvlP = 0; i.analog = true;
  }
  const l = Math.hypot(i.mx, i.mz); if (l > 1) { i.mx /= l; i.mz /= l; }
  return i;
}

/* ================= players ================= */
function makePlayer(slot, kind, ctl, name, color) {
  const p = {
    slot, kind, ctl, name, color: PCOL[slot], css: PCSS[slot], local: true, peer: null,
    rig: makeRunner(PCOL[slot]), x: 0, y: 0, z: 0, vx: 0, vz: 0, mvx: 0, mvz: 0, kbx: 0, kbz: 0, vy: 0, onGround: true, airT: 0,
    yaw: 0, aimYaw: 0, lvl: 1, mode: 'idle', lives: S.lives, heat: 0, stun: 0, invuln: 0, flash: 0,
    shieldE: 100, shieldOn: false, shieldCD: 0, charge: 0, fireWas: false, throwT: 0, cool: 0, discsHome: 3, discs: [],
    fallT: 0, deadT: 0, lastHitBy: -1, lastHitAt: -99, stride: 0, animT: Math.random() * 10,
    stats: { hits: 0, rings: 0, kos: 0, defl: 0, thrown: 0 }, bot: null, skill: S.skill,
    net: null, shake: 0, popQ: []
  };
  scene.add(p.rig.root);
  for (let k = 0; k < 3; k++) {
    const d = { id: slot * 10 + k, k, owner: p, state: 'home', pos: new THREE.Vector3(), vel: new THREE.Vector3(), bounces: 0, t: 0, power: false, deflected: false, immune: null, immuneT: 0,
      mesh: makeDiscMesh(PCOL[slot], 1), trail: new Trail(PCOL[slot], 22, 0.13), spin: Math.random() * 6, clashT: 0, seen: false, ghostT: 0 };
    d.mesh.visible = false; d.trail.mesh.visible = false; scene.add(d.mesh); p.discs.push(d); DISCS.push(d);
  }
  if (kind === 'cpu') p.bot = { think: 0, plan: null, target: null, tgtT: 0, threat: null, react: 0, shieldT: 0, dodge: null, wander: null, wanderT: 0, noise: 0, noiseV: 0, holdFire: 0, decided: new Set() };
  return p;
}
function disposePlayer(p) {
  scene.remove(p.rig.root);
  p.rig.root.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
  for (const d of p.discs) { scene.remove(d.mesh); d.trail.dispose(); const i = DISCS.indexOf(d); if (i >= 0) DISCS.splice(i, 1); }
}
function stationOf(p) { return STATIONS[p.slot]; }
function homePad(p) { const st = stationOf(p); return st.pads[st.pads.length === 3 ? 1 : 0]; }
function placeAtHome(p) {
  const pad = homePad(p), st = stationOf(p);
  p.x = pad.x; p.z = pad.z; p.y = pad.y; p.vy = 0; p.mvx = p.mvz = p.kbx = p.kbz = 0; p.onGround = true;
  p.yaw = p.aimYaw = st.yaw; p.lvl = 1;
}
function opponents(p) { return players.filter(o => o !== p && (o.mode === 'play' || o.mode === 'idle')); }
const handPos = (p, out) => out.set(p.x - Math.cos(p.yaw) * 0.26 + Math.sin(p.yaw) * 0.42, p.y + HAND_Y, p.z + Math.sin(p.yaw) * 0.26 + Math.cos(p.yaw) * 0.42);

/* ================= aiming ================= */
// The three elevations from the original cabinet. Each one solves for the opponent nearest the
// reticle, so MID always flies at chest height, LOW drops onto the rings just in front of them and
// HIGH banks off the ceiling to come down on top of them.
const LVL_NAMES = ['LOW', 'MID', 'HIGH'];
function aimTarget(p, yaw) {
  let best = null, bd = 0.95;
  for (const o of players) {
    if (o === p || (o.mode !== 'play' && o.mode !== 'idle')) continue;
    const dx = o.x - p.x, dz = o.z - p.z, a = Math.abs(angDiff(yaw, Math.atan2(dx, dz)));
    if (a < bd) { bd = a; best = o; }
  }
  return best;
}
const _hp = new THREE.Vector3();
function solvePitch(p, yaw, lvl, tgt) {
  handPos(p, _hp);
  let d = 2 * RS, ty = p.y + CHEST_Y, fy = p.y;
  if (tgt) { const dx = tgt.x - _hp.x, dz = tgt.z - _hp.z; d = Math.max(3, Math.hypot(dx, dz) * Math.abs(Math.cos(angDiff(yaw, Math.atan2(dx, dz))))); ty = tgt.y + CHEST_Y; fy = tgt.y; }
  if (lvl === 1) return Math.atan2(ty - _hp.y, d);
  if (lvl === 0) return Math.atan2(fy + 0.1 - _hp.y, Math.max(2, d - 1.0));
  const top = YC - 0.18; return Math.atan2((top - _hp.y) + (top - ty), d);
}
function aimDir(yaw, pitch, out) { const c = Math.cos(pitch); return out.set(Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c); }

/* ================= disc flight ================= */
// One step of disc flight against the arena (walls, ceiling, firewall, podium rings).
// Used by the live simulation, the aim guide and the CPU's shot planner, so they always agree.
const _n = new THREE.Vector3();
function discEnvStep(pos, vel, dt, ownerSlot, out) {
  out.kind = null;
  pos.x += vel.x * dt; pos.y += vel.y * dt; pos.z += vel.z * dt;
  const r = Math.hypot(pos.x, pos.z);
  if (r > R_BOUNCE) {
    const nx = pos.x / r, nz = pos.z / r, vn = vel.x * nx + vel.z * nz;
    if (vn > 0) { vel.x -= 2 * vn * nx; vel.z -= 2 * vn * nz; pos.x = nx * R_BOUNCE; pos.z = nz * R_BOUNCE; out.kind = 'wall'; out.nx = -nx; out.ny = 0; out.nz = -nz; return out; }
  }
  if (pos.y > YC - 0.18 && vel.y > 0) { vel.y = -vel.y; pos.y = YC - 0.18; out.kind = 'ceil'; out.nx = 0; out.ny = -1; out.nz = 0; return out; }
  if (pos.y < -9) { out.kind = 'abyss'; return out; }
  const bi = WALLFW.hit(pos.x, pos.y, pos.z);
  if (bi >= 0) {
    const nx = pos.x / (r || 1), nz = pos.z / (r || 1), vn = vel.x * nx + vel.z * nz; vel.x -= 2 * vn * nx; vel.z -= 2 * vn * nz;
    out.kind = 'block'; out.block = bi; out.nx = nx * -Math.sign(vn || 1); out.ny = 0; out.nz = nz * -Math.sign(vn || 1); return out;
  }
  for (const st of STATIONS) {
    if (st.i === ownerSlot) continue;
    for (const pad of st.pads) {
      const dx = pos.x - pad.x, dz = pos.z - pad.z, d = Math.hypot(dx, dz); if (d > pad.R + 0.15) continue;
      const top = pad.y, rel = pos.y - top;
      if (rel < D_R * 0.55 && rel > -0.5) {
        let ring = -1; for (let k = 0; k < pad.rings.length; k++) { const rr = pad.rings[k]; if (rr.state !== 2 && d >= rr.rIn - 0.08 && d <= rr.rOut + 0.12) { ring = k; break; } }
        if (ring < 0) continue;
        const fromAbove = rel > -0.12;
        vel.y = fromAbove ? Math.abs(vel.y) * 0.6 + 2 : -Math.abs(vel.y) - 1; pos.y = fromAbove ? top + D_R * 0.56 : top - 0.5;
        out.kind = 'ring'; out.st = st.i; out.pad = pad.idx; out.ring = ring; out.nx = 0; out.ny = fromAbove ? 1 : -1; out.nz = 0; return out;
      }
    }
  }
  return out;
}
// sphere vs runner capsule (feet+0.25 .. feet+1.8)
function hitsBody(o, x, y, z, rad) {
  const yy = clamp(y, o.y + 0.25, o.y + 1.8); const dx = x - o.x, dy = y - yy, dz = z - o.z;
  return dx * dx + dy * dy + dz * dz < (0.42 + rad) * (0.42 + rad);
}
function shieldFacing(o, x, z) { if (!o.shieldOn) return false; return Math.abs(angDiff(o.yaw, Math.atan2(x - o.x, z - o.z))) < SHIELD_ARC; }
function inShield(o, x, y, z) { const dx = x - o.x, dy = y - (o.y + 1.05), dz = z - o.z; return dx * dx + dy * dy + dz * dz < SHIELD_R * SHIELD_R; }

const _env = {}, _tmp = new THREE.Vector3(), _tmp2 = new THREE.Vector3();
function throwDisc(p, power) {
  const d = p.discs.find(x => x.state === 'home'); if (!d) return;
  const pitch = solvePitch(p, p.aimYaw, p.lvl, aimTarget(p, p.aimYaw));
  handPos(p, d.pos); aimDir(p.aimYaw, pitch, d.vel).multiplyScalar(power ? D_POWER : D_SPEED);
  d.state = 'fly'; d.t = 0; d.bounces = 0; d.power = power; d.deflected = false; d.immune = p; d.immuneT = 0.35; d.clashT = 0; d.ghostT = 0;
  d.mesh.visible = true; d.mesh.scale.setScalar(power ? 0.95 : 0.78); d.trail.reset(d.pos); d.trail.mesh.visible = true; d.trail.mat.uniforms.uA.value = power ? 1.5 : 1;
  p.discsHome--; p.throwT = 0.28; p.cool = D_COOL; p.stats.thrown++;
  SFX.throwDisc(power, p);
}
function recallDiscs(p) { let n = 0; for (const d of p.discs) if (d.state === 'fly') { d.state = 'ret'; d.t = 0; n++; } if (n) SFX.recall(p); }
function dockDisc(d) { d.state = 'home'; d.mesh.visible = false; d.trail.mesh.visible = false; d.owner.discsHome = Math.min(3, d.owner.discsHome + 1); }

function updateDisc(d, dt) {
  const p = d.owner;
  if (d.state === 'home') return;
  d.spin += dt * (d.power ? 34 : 24);
  if (!p.local) { remoteDiscStep(d, dt); return; }
  d.t += dt; d.immuneT -= dt; d.clashT -= dt;
  const steps = 2, h = dt / steps;
  for (let s = 0; s < steps && d.state !== 'home'; s++) {
    if (d.state === 'ret') {
      const ownerUp = p.mode === 'play' || p.mode === 'idle' || p.mode === 'win';
      if (ownerUp) handPos(p, _tmp); else { const pad = homePad(p); _tmp.set(pad.x, pad.y + 1, pad.z); }
      _tmp2.copy(_tmp).sub(d.pos); const dist = _tmp2.length();
      if (dist < 0.85 || d.t > 3.2) { dockDisc(d); if (ownerUp && dist < 0.85) SFX.catchDisc(p); return; }
      _tmp2.multiplyScalar(D_RET / dist);
      d.vel.lerp(_tmp2, 1 - Math.exp(-10 * h));
      d.pos.addScaledVector(d.vel, h);
    } else {
      discEnvStep(d.pos, d.vel, h, p.slot, _env);
      if (_env.kind) onDiscEnv(d, _env);
      if (d.state === 'fly' && (d.bounces > D_MAXB || d.t > D_MAXT)) { d.state = 'ret'; d.t = 0; }
    }
    if (d.state !== 'home') discVsBodies(d);
    if (d.state !== 'home') discVsDiscs(d);
  }
}
function onDiscEnv(d, e) {
  const c = d.owner.color, x = d.pos.x, y = d.pos.y, z = d.pos.z;
  if (e.kind === 'wall') { d.bounces++; wallFlash(x, y, z, c); sparks(x, y, z, c, 16, 7, 0.5); shockRing(x, y, z, e.nx, e.ny, e.nz, c, 2.2, 0.45); SFX.bounce(d.pos); }
  else if (e.kind === 'ceil') { d.bounces++; ceilFlash(x, z, c); sparks(x, y, z, c, 16, 7, 0.5); shockRing(x, y, z, 0, -1, 0, c, 2.6, 0.5); SFX.bounce(d.pos); }
  else if (e.kind === 'abyss') { d.state = 'ret'; d.t = 0; }
  else if (e.kind === 'block') {
    WALLFW.breakBlock(e.block); netEvent(['b', e.block]); d.state = 'ret'; d.t = 0;
    sparks(x, y, z, 0xff5a1f, 34, 9, 0.7, 0.08); shockRing(x, y, z, e.nx, e.ny, e.nz, 0xff5a1f, 2.4, 0.4); SFX.block(d.pos);
  } else if (e.kind === 'ring') {
    const ok = ringBreak(e.st, e.pad, e.ring);
    if (ok) { netEvent(['r', e.st, e.pad, e.ring]); d.owner.stats.rings++; popFor(d.owner, 'RING SHATTERED'); }
    else SFX.bounce(d.pos);
    sparks(x, y, z, STATIONS[e.st].color, 26, 7, 0.6, 0.07); shockRing(x, y, z, 0, 1, 0, STATIONS[e.st].color, 3, 0.45);
    d.state = 'ret'; d.t = 0;
  }
}
function discVsBodies(d) {
  for (const o of players) {
    if (o.mode !== 'play' || o.invuln > 0) continue;
    if (o === d.owner && !d.deflected) continue;
    if (o === d.immune && d.immuneT > 0) continue;
    // deflector first: it is bigger than the body
    if (o.shieldOn && inShield(o, d.pos.x, d.pos.y, d.pos.z) && shieldFacing(o, d.pos.x, d.pos.z)) {
      _n.set(d.pos.x - o.x, d.pos.y - (o.y + 1.05), d.pos.z - o.z).normalize();
      const vn = d.vel.dot(_n); if (vn < 0) d.vel.addScaledVector(_n, -2 * vn);
      d.vel.multiplyScalar(1.06); d.pos.copy(_n).multiplyScalar(SHIELD_R + 0.05).add(_tmp.set(o.x, o.y + 1.05, o.z));
      d.deflected = true; d.immune = o; d.immuneT = 0.4; d.state = 'fly'; d.bounces = Math.min(d.bounces, 1); d.t = Math.min(d.t, 1.5);
      if (o.local) shieldStruck(o, d.power); else netEvent(['d', o.slot, d.power ? 1 : 0]);
      sparks(d.pos.x, d.pos.y, d.pos.z, o.color, 26, 9, 0.5, 0.07); shockRing(d.pos.x, d.pos.y, d.pos.z, _n.x, _n.y, _n.z, o.color, 1.6, 0.35);
      SFX.deflect(d.pos); return;
    }
    if (hitsBody(o, d.pos.x, d.pos.y, d.pos.z, D_R * 0.8)) {
      const hl = Math.hypot(d.vel.x, d.vel.z) || 1, dx = d.vel.x / hl, dz = d.vel.z / hl;
      if (o.local) applyHit(o, dx, dz, d.power, d.owner.slot); else netEvent(['h', o.slot, +dx.toFixed(3), +dz.toFixed(3), d.power ? 1 : 0, d.owner.slot]);
      if (o !== d.owner) { d.owner.stats.hits++; popFor(d.owner, d.power ? 'POWER HIT' : 'DIRECT HIT'); }
      sparks(d.pos.x, d.pos.y, d.pos.z, d.owner.color, 40, 10, 0.7, 0.09); sparks(d.pos.x, d.pos.y, d.pos.z, 0xffffff, 12, 6, 0.4, 0.06);
      d.vel.set(-d.vel.x * 0.3, 5, -d.vel.z * 0.3); d.state = 'ret'; d.t = 0; d.immune = o; d.immuneT = 1;
      SFX.hit(d.pos, d.power); return;
    }
  }
}
function discVsDiscs(d) {
  if (d.clashT > 0) return;
  for (const e of DISCS) {
    if (e === d || e.state === 'home' || e.owner === d.owner) continue;
    const dx = d.pos.x - e.pos.x, dy = d.pos.y - e.pos.y, dz = d.pos.z - e.pos.z, dd = dx * dx + dy * dy + dz * dz;
    if (dd < 0.8 * 0.8) {
      const l = Math.sqrt(dd) || 1; _n.set(dx / l, dy / l, dz / l);
      const vn = d.vel.dot(_n); if (vn < 0) d.vel.addScaledVector(_n, -2 * vn);
      d.vel.y += 3; d.clashT = 0.25; d.state = 'ret'; d.t = 0;
      const mx = (d.pos.x + e.pos.x) / 2, my = (d.pos.y + e.pos.y) / 2, mz = (d.pos.z + e.pos.z) / 2;
      sparks(mx, my, mz, 0xffffff, 30, 11, 0.6, 0.08); sparks(mx, my, mz, d.owner.color, 14, 8, 0.5); shockRing(mx, my, mz, _n.x, _n.y, _n.z, 0xffffff, 2, 0.35);
      SFX.clash(_tmp.set(mx, my, mz)); return;
    }
  }
}
function updateDiscVisual(d, dt) {
  if (d.state === 'home') return;
  const v = d.vel, sp = v.length() || 1;
  _n.set(-v.x / sp * 0.22, 1, -v.z / sp * 0.22).normalize();
  d.mesh.position.copy(d.pos);
  d.mesh.quaternion.setFromUnitVectors(UP, _n);
  d.mesh.rotateY(d.spin);
  d.trail.push(d.pos);
  if (d.power && Math.random() < 0.6) sparks(d.pos.x, d.pos.y, d.pos.z, d.owner.color, 1, 1.5, 0.35, 0.05);
}
const UP = new THREE.Vector3(0, 1, 0);

/* ================= getting hit ================= */
function applyHit(o, dx, dz, power, bySlot) {
  if (o.mode !== 'play' || o.invuln > 0) return;
  const kb = KB_BASE * (1 + KB_HEAT * o.heat) * (power ? KB_POWER : 1);
  o.kbx += dx * kb; o.kbz += dz * kb; o.heat = Math.min(8, o.heat + (power ? 2 : 1));
  o.stun = 0.36; o.flash = 1; o.charge = 0; o.shieldOn = false; o.lastHitBy = bySlot; o.lastHitAt = matchT; o.shake = power ? 0.55 : 0.35;
  viewFlash(o, 0xff3050, power ? 1 : 0.7);
  SFX.hurt(o);
}
function shieldStruck(o, power) {
  o.shieldE -= power ? 38 : 12; o.rig.shieldMat.uniforms.uHit.value = 1; o.stats.defl++;
  popFor(o, power ? 'DEFLECTED!' : 'DEFLECT');
  if (o.shieldE <= 0) { o.shieldE = 0; o.shieldOn = false; o.shieldCD = 1.2; o.stun = 0.45; popFor(o, 'SHIELD BROKEN'); SFX.shieldBreak(o); }
}

/* ================= runner physics ================= */
function stepPlayer(p, inp, dt) {
  p.animT += dt; p.flash = Math.max(0, p.flash - dt * 2.5); p.shake = Math.max(0, p.shake - dt * 1.6);
  if (p.mode === 'idle' || p.mode === 'win') { p.vx = p.vz = 0; followPad(p); return; }
  if (p.mode === 'fall') {
    p.fallT += dt; p.vy -= GRAV * dt; p.y += p.vy * dt; p.x += p.kbx * dt; p.z += p.kbz * dt; p.kbx *= Math.exp(-0.6 * dt); p.kbz *= Math.exp(-0.6 * dt);
    p.yaw += dt * 2.2;
    if (p.fallT > 1.25) { shatter(p.x, p.y, p.z, p.color, p.kbx, p.kbz); SFX.shatter(p); p.mode = 'dead'; p.deadT = 0; }
    return;
  }
  if (p.mode === 'dead') {
    p.deadT += dt;
    if (p.deadT > 2.2) { if (p.lives > 0) respawn(p); else p.mode = 'out'; }
    return;
  }
  if (p.mode !== 'play') return;
  const live = state === 'play' || DEMO;
  p.stun = Math.max(0, p.stun - dt); p.invuln = Math.max(0, p.invuln - dt); p.cool = Math.max(0, p.cool - dt); p.throwT = Math.max(0, p.throwT - dt); p.shieldCD = Math.max(0, p.shieldCD - dt);
  const ctl = live && p.stun <= 0;

  // aim
  if (ctl || state === 'count') {
    if (inp.aimTo != null) p.aimYaw = dampAng(p.aimYaw, inp.aimTo, inp.turn || 6, dt);
    p.aimYaw += inp.aim * 2.5 * dt + inp.aimAbs;
    if (inp.analog && Math.abs(inp.aim) < 0.25) { // gentle aim assist for sticks and touch
      const t = aimTarget(p, p.aimYaw); if (t) { const a = Math.atan2(t.x - p.x, t.z - p.z), dd = angDiff(p.aimYaw, a); if (Math.abs(dd) < 0.22) p.aimYaw += dd * Math.min(1, dt * 2.2); }
    }
    if (inp.lvl) { const n = clamp(p.lvl + inp.lvl, 0, 2); if (n !== p.lvl) { p.lvl = n; SFX.tick(p); } }
  }
  p.yaw = dampAng(p.yaw, p.aimYaw, 14, dt);

  // shield
  const wantShield = ctl && inp.shield && p.shieldCD <= 0;
  if (wantShield && !p.shieldOn && p.shieldE >= SHIELD_MIN) { p.shieldOn = true; p.charge = 0; SFX.shieldOn(p); }
  if (p.shieldOn && (!wantShield || p.shieldE <= 0)) { p.shieldOn = false; if (p.shieldE <= 0) p.shieldCD = 0.8; }
  if (p.shieldOn) p.shieldE = Math.max(0, p.shieldE - SHIELD_DRAIN * dt); else p.shieldE = Math.min(100, p.shieldE + SHIELD_REGEN * dt);

  // throw: hold to charge a power disc, release to throw
  if (ctl && !p.shieldOn) {
    if (inp.fire && !p.fireWas) { if (p.discsHome > 0 && p.cool <= 0) { p.charge = 0.001; SFX.charge(p); } else if (p.discsHome <= 0) SFX.empty(p); }
    if (inp.fire && p.charge > 0) { const before = p.charge; p.charge += dt; if (before < D_CHARGE && p.charge >= D_CHARGE) SFX.charged(p); }
    if (!inp.fire && p.charge > 0) { throwDisc(p, p.charge >= D_CHARGE); p.charge = 0; }
  } else if (!inp.fire) p.charge = 0;
  p.fireWas = inp.fire;
  if (ctl && inp.recall) recallDiscs(p);

  // movement relative to the aim direction
  const fx = Math.sin(p.aimYaw), fz = Math.cos(p.aimYaw), rx = -Math.cos(p.aimYaw), rz = Math.sin(p.aimYaw);
  let wx = 0, wz = 0;
  if (ctl) { wx = (fx * inp.mz + rx * inp.mx) * RUN; wz = (fz * inp.mz + rz * inp.mx) * RUN; }
  const slow = p.shieldOn ? 0.55 : p.charge > 0 ? 0.75 : 1;
  const acc = p.onGround ? 16 : 3;
  p.mvx = damp(p.mvx, wx * slow, acc, dt); p.mvz = damp(p.mvz, wz * slow, acc, dt);
  p.kbx *= Math.exp(-FRICT * dt); p.kbz *= Math.exp(-FRICT * dt);

  if (p.onGround) {
    // hop
    if (ctl && inp.hop) { p.onGround = false; p.vy = HOP_V; p.airT = 0; p.mvx = wx ? wx / RUN * HOP_H : 0; p.mvz = wz ? wz / RUN * HOP_H : 0; SFX.hop(p); }
    else {
      // walking can't take you off the edge; knockback can
      let nx = p.x + p.mvx * dt, nz = p.z + p.mvz * dt;
      if (!supportAt(nx, nz, 0.02)) {
        if (supportAt(nx, p.z, 0.02)) nz = p.z; else if (supportAt(p.x, nz, 0.02)) nx = p.x; else { nx = p.x; nz = p.z; }
        if (nx === p.x) p.mvx = 0; if (nz === p.z) p.mvz = 0;
      }
      p.x = nx + p.kbx * dt; p.z = nz + p.kbz * dt;
      const sup = supportAt(p.x, p.z, 0.16);
      if (!sup) startFall(p); else { p.y = sup.y; p.padRef = sup.pad; }
    }
  }
  if (!p.onGround && p.mode === 'play') {
    p.airT += dt; p.vy -= GRAV * dt; const py = p.y;
    p.x += (p.mvx + p.kbx) * dt; p.z += (p.mvz + p.kbz) * dt; p.y += p.vy * dt;
    const sup = supportAt(p.x, p.z, 0.12);
    if (sup && p.vy <= 0 && p.y <= sup.y && py >= sup.y - 0.35) { p.y = sup.y; p.onGround = true; p.vy = 0; p.mvx *= 0.3; p.mvz *= 0.3; SFX.land(p); sparks(p.x, p.y + 0.05, p.z, p.color, 8, 2.5, 0.35, 0.05); }
    else if (p.y < -1.2 + Math.min(...stationOf(p).pads.map(q => q.y)) - 2) startFall(p, true);
  }
  p.vx = p.mvx + p.kbx; p.vz = p.mvz + p.kbz;
  if (p.onGround) p.stride += Math.hypot(p.mvx, p.mvz) * dt * 2.6;
}
function followPad(p) { if (!STATIONS.length) return; const sup = supportAt(p.x, p.z, 0.3); if (sup) p.y = sup.y; }
const FALLS = [];
function startFall(p, fromAir) {
  if (p.mode !== 'play') return;
  { const pad = padUnder(p.x, p.z, 0.3), kb = Math.hypot(p.kbx, p.kbz); let ring = null;
    if (pad) { const d = Math.hypot(p.x - pad.x, p.z - pad.z); ring = pad.rings.find(r => d >= r.rIn - 0.1 && d <= r.rOut + 0.1); }
    FALLS.push({ who: p.name, kind: p.kind, air: !!fromAir, kb: +kb.toFixed(1), mv: +Math.hypot(p.mvx, p.mvz).toFixed(1), stun: +p.stun.toFixed(2), d: pad ? +Math.hypot(p.x - pad.x, p.z - pad.z).toFixed(2) : -1, rs: pad ? pad.rings.map(r => r.state + ':' + r.t.toFixed(1)).join(' ') : '', goal: p.bot && p.bot.lastGoal, reason: fromAir ? 'air' : !pad ? (kb > 1 ? 'knocked-off' : 'edge') : ring && ring.state === 2 ? 'ring-gone' : 'gap', t: +matchT.toFixed(1) }); }
  p.mode = 'fall'; p.fallT = 0; p.onGround = false; p.vy = fromAir ? p.vy : 0.5; if (!DEMO) p.lives = Math.max(0, p.lives - 1);
  p.shieldOn = false; p.charge = 0;
  if (p.lastHitBy >= 0 && matchT - p.lastHitAt < 5) { const k = players[p.lastHitBy]; if (k && k !== p) { if (k.local) { k.stats.kos++; popFor(k, 'KNOCKOUT!'); } else netEvent(['k', k.slot]); } }
  for (const d of p.discs) if (d.state === 'fly') { d.state = 'ret'; d.t = 0; }
  SFX.fall(p);
  popFor(p, p.lives > 0 ? 'FLATLINED' : 'ELIMINATED', true);
}
function respawn(p) {
  restoreStation(stationOf(p)); placeAtHome(p);
  p.mode = 'play'; p.heat = 0; p.stun = 0; p.invuln = 1.8; p.shieldE = 100; p.shieldOn = false; p.charge = 0; p.lastHitBy = -1;
  for (const d of p.discs) if (d.state !== 'home') dockDisc(d);
  p.discsHome = 3;
  sparks(p.x, p.y + 1, p.z, p.color, 50, 6, 0.8, 0.08); shockRing(p.x, p.y + 0.05, p.z, 0, 1, 0, p.color, 4, 0.6); SFX.respawn(p);
}

/* ================= CPU brain ================= */
// Shot planner: flies a candidate disc through the same arena code the live discs use and keeps the
// one that passes closest to where the target will be.
const _sp = new THREE.Vector3(), _sv = new THREE.Vector3(), _se = {};
function simShot(p, yaw, lvl, tgt, power, lead) {
  const pitch = solvePitch(p, yaw, lvl, tgt);
  handPos(p, _sp); aimDir(yaw, pitch, _sv).multiplyScalar(power ? D_POWER : D_SPEED);
  let best = 99, ringHit = null, blocked = false, tt = 0;
  const h = 1 / 40, tvx = tgt.vx * lead, tvz = tgt.vz * lead;
  for (let i = 0; i < 100; i++) {
    tt += h; discEnvStep(_sp, _sv, h, p.slot, _se);
    if (_se.kind === 'block') { blocked = true; break; }
    if (_se.kind === 'abyss') break;
    if (_se.kind === 'ring') { if (_se.st === tgt.slot) ringHit = _se.ring; break; }
    const tx = tgt.x + tvx * tt, tz = tgt.z + tvz * tt, ty = clamp(_sp.y, tgt.y + 0.3, tgt.y + 1.7);
    const dd = Math.hypot(_sp.x - tx, _sp.y - ty, _sp.z - tz); if (dd < best) best = dd;
    if (best < 0.35) break;
  }
  return { miss: best, ringHit, blocked, time: tt };
}
function botInput(p, dt) {
  const sk = SKILLS[p.skill], B = p.bot;
  const inp = { mx: 0, mz: 0, aim: 0, aimAbs: 0, aimTo: null, turn: sk.turn, lvl: 0, fire: false, shield: false, hop: false, recall: false, analog: false };
  if (p.mode !== 'play' || (state !== 'play' && !DEMO)) return inp;
  const pad = p.padRef || homePad(p);
  B.noiseV += (Math.random() - 0.5) * dt * 4; B.noiseV *= Math.exp(-2 * dt); B.noise = clamp(B.noise + B.noiseV * dt, -1, 1);

  // --- defence: watch for discs that will reach me soon ---
  let threat = null, tmin = 0.9;
  for (const d of DISCS) {
    if (d.state === 'home' || (d.owner === p && !d.deflected)) continue;
    const rx = d.pos.x - p.x, ry = d.pos.y - (p.y + 1.0), rz = d.pos.z - p.z, vx = d.vel.x - p.vx, vy = d.vel.y, vz = d.vel.z - p.vz;
    const vv = vx * vx + vy * vy + vz * vz; if (vv < 1) continue;
    const t = -(rx * vx + ry * vy + rz * vz) / vv; if (t < 0 || t > tmin) continue;
    const mx = rx + vx * t, my = ry + vy * t, mz = rz + vz * t; if (mx * mx + my * my + mz * mz > 1.25 * 1.25) continue;
    threat = d; tmin = t;
  }
  if (threat) {
    if (B.threat !== threat) { B.threat = threat; B.react = 0; B.choice = null; }
    B.react += dt;
    if (B.react >= sk.react) {
      if (!B.choice) {
        const front = Math.abs(angDiff(p.yaw, Math.atan2(threat.pos.x - p.x, threat.pos.z - p.z))) < SHIELD_ARC * 0.9;
        const r = Math.random();
        B.choice = (front && p.shieldE > 26 && r < sk.block) ? 'shield' : (Math.random() < sk.dodge ? 'dodge' : 'none');
        if (B.choice === 'dodge') {
          const vx = threat.vel.x, vz = threat.vel.z, l = Math.hypot(vx, vz) || 1; let sx = -vz / l, sz = vx / l;
          if (!supportAt(p.x + sx * 1.2, p.z + sz * 1.2, 0)) { sx = -sx; sz = -sz; }
          B.dodge = { x: sx, z: sz, t: 0.45 }; B.hopDodge = p.onGround && threat.pos.y < p.y + 1.1 && Math.random() < 0.35 && supportAt(p.x + sx * 1.6, p.z + sz * 1.6, 0);
        }
        if (B.choice === 'shield') B.shieldT = 0.45;
      }
    }
  } else B.threat = null;
  if (B.shieldT > 0) { B.shieldT -= dt; inp.shield = true; }

  // --- footing: get away from flashing rings and the edge; hop over holes if there's no other way ---
  let goal = null;
  const sup = supportAt(p.x, p.z, 0.05);
  const q0 = sup ? sup.pad : null, curD = q0 ? Math.hypot(p.x - q0.x, p.z - q0.z) : 0;
  const myRing = q0 ? (q0.rings.find(r => curD >= r.rIn && curD <= r.rOut) || q0.rings[sup.ring]) : null;
  const dEdge = q0 ? q0.R - curD : 0;
  const padHealth = q => q.rings.reduce((s, r) => s + (r.state === 0 ? r.rOut - r.rIn : r.state === 1 ? -0.5 : 0), 0);
  const ringMid = r => (r.rIn < 0.01 ? 0 : (r.rIn + r.rOut) / 2);
  // on a triad, hop to a healthier podium when mine is falling apart
  const st = stationOf(p);
  if (st.pads.length > 1 && q0 && p.onGround && !(myRing && myRing.state === 1)) {
    const here = q0; let alt = null, h0 = padHealth(here);
    for (const q of st.pads) if (q !== here && Math.hypot(q.x - here.x, q.z - here.z) < 6.5 && padHealth(q) > h0 + 0.8 && Math.abs(q.y - here.y) < 1.1) alt = q;
    if (alt) {
      const ax = alt.x - p.x, az = alt.z - p.z, l = Math.hypot(ax, az);
      goal = { x: alt.x, z: alt.z }; B.safe = null; B.goPad = alt;
      const dirOk = Math.hypot(p.mvx, p.mvz) > RUN * 0.6 && (p.mvx * ax + p.mvz * az) / (Math.hypot(p.mvx, p.mvz) * l) > 0.92;
      const hopDist = 2 * HOP_V / GRAV * HOP_H, lx = p.x + ax / l * hopDist, lz = p.z + az / l * hopDist;
      if (dirOk && l < hopDist + 0.6 && Math.abs(alt.y - here.y) < 0.7 && supportAt(lx, lz, -0.2)) inp.hop = true;
    }
  }
  if (B.safe) { B.safe.t -= dt; const r = B.safe.ring; if (B.safe.t <= 0 || r.state !== 0 || Math.hypot(p.x - B.safe.x, p.z - B.safe.z) < 0.3) B.safe = null; }
  if (!goal && !B.safe && myRing && (myRing.state === 1 || dEdge < 0.9 + p.heat * 0.15)) {
    let best = null;
    for (const r of q0.rings) if (r.state === 0 && r !== myRing) { const mid = ringMid(r); const cost = Math.abs(mid - curD) + (mid > curD ? 0.8 : 0); if (!best || cost < best.cost) best = { r, mid, cost }; }
    if (!best && myRing.state === 0) best = { r: myRing, mid: ringMid(myRing) * 0.85, cost: 0 };
    if (best) { const a = Math.atan2(p.z - q0.z, p.x - q0.x); B.safe = { x: q0.x + Math.cos(a) * best.mid, z: q0.z + Math.sin(a) * best.mid, ring: best.r, t: 1.8, px: p.x, pz: p.z, stuck: 0 }; }
  }
  if (B.safe && !goal) {
    goal = B.safe;
    // no walkable path (a vanished ring in the way)? hop across
    const moved = Math.hypot(p.x - B.safe.px, p.z - B.safe.pz); B.safe.px = p.x; B.safe.pz = p.z;
    B.safe.stuck = moved < 0.01 ? B.safe.stuck + dt : 0;
    if (B.safe.stuck > 0.12 && p.onGround) {
      const gx = B.safe.x - p.x, gz = B.safe.z - p.z, gl = Math.hypot(gx, gz) || 1, hd = 2 * HOP_V / GRAV * HOP_H;
      const lx = p.x + gx / gl * Math.min(hd, gl + 0.4), lz = p.z + gz / gl * Math.min(hd, gl + 0.4);
      if (supportAt(lx, lz, -0.15)) { inp.hop = true; B.hopTo = { x: gx / gl, z: gz / gl, t: 0.75 }; }
    }
  }
  if (!goal) {
    B.wanderT -= dt;
    const bad = B.wander && (!B.wander.ring || B.wander.ring.state !== 0);
    if (B.wanderT <= 0 || !B.wander || bad) {
      const q = q0 || pad, solid = q.rings.filter(r => r.state === 0);
      if (solid.length) {
        const r = solid[Math.floor(Math.random() * Math.min(solid.length, 2))], a = Math.random() * TAU, rr = r.rIn < 0.01 ? Math.random() * r.rOut * 0.6 : lerp(r.rIn + 0.15, r.rOut - 0.15, Math.random());
        B.wander = { x: q.x + Math.cos(a) * rr, z: q.z + Math.sin(a) * rr, ring: r };
      } else B.wander = { x: p.x, z: p.z, ring: null };
      B.wanderT = 1.2 + Math.random() * 2.2;
    }
    goal = B.wander;
  }
  B.lastGoal = goal === B.wander ? 'wander' : 'safe'; let gx = goal.x - p.x, gz = goal.z - p.z; const gl = Math.hypot(gx, gz);
  let wx = gl > 0.2 ? gx / gl * Math.min(1, gl * 1.5) : 0, wz = gl > 0.2 ? gz / gl * Math.min(1, gl * 1.5) : 0;
  if (B.hopTo && B.hopTo.t > 0) { B.hopTo.t -= dt; wx = B.hopTo.x; wz = B.hopTo.z; }
  if (B.dodge && B.dodge.t > 0 && !B.safe) { B.dodge.t -= dt; wx = B.dodge.x; wz = B.dodge.z; if (B.hopDodge && p.onGround) { inp.hop = true; B.hopDodge = false; wx = wz = 0; } }
  // world move -> stick (relative to aim)
  const fx = Math.sin(p.aimYaw), fz = Math.cos(p.aimYaw), rx = -Math.cos(p.aimYaw), rz = Math.sin(p.aimYaw);
  inp.mz = wx * fx + wz * fz; inp.mx = wx * rx + wz * rz;

  // --- offence ---
  B.tgtT -= dt;
  const opp = players.filter(o => o !== p && o.mode === 'play');
  if (!opp.length) return inp;
  if (!B.target || B.target.mode !== 'play' || B.tgtT <= 0) {
    let best = null, bs = -1e9;
    for (const o of opp) { const s = -Math.abs(angDiff(p.aimYaw, Math.atan2(o.x - p.x, o.z - p.z))) * 1.2 - o.lives * 0.4 + o.heat * 0.15 + (o.kind === 'human' ? 0.6 : 0) + Math.random() * 0.8; if (s > bs) { bs = s; best = o; } }
    B.target = best; B.tgtT = 2.5 + Math.random() * 3; B.plan = null;
  }
  const T = B.target;
  B.think -= dt;
  if (B.think <= 0 || !B.plan) {
    B.think = sk.think * (0.7 + Math.random() * 0.6);
    const base = Math.atan2(T.x - p.x, T.z - p.z), cands = [];
    const tsup = supportAt(T.x, T.z, 0.05);
    const yaws = [0, 0.02, -0.02];
    if (Math.random() < sk.bank) for (const o of [0.22, -0.22, 0.38, -0.38, 0.55, -0.55]) yaws.push(o);
    for (const lvl of [1, 0, 2]) for (const yo of yaws) {
      const power = Math.random() < sk.power;
      const r = simShot(p, base + yo, lvl, T, power, sk.lead);
      if (r.blocked) continue;
      let score = -r.miss;
      if (lvl === 0) { score = r.ringHit != null ? 0.2 + (tsup && r.ringHit === tsup.ring ? 0.9 : 0) : -r.miss - 0.5; }
      if (lvl === 2) score -= 0.25;
      if (yo !== 0) score -= 0.1;
      score += (Math.random() - 0.5) * 0.6;
      cands.push({ yaw: base + yo, lvl, power, score });
    }
    cands.sort((a, b) => b.score - a.score);
    B.plan = cands[0] || { yaw: base, lvl: 2, power: false, score: -9 };
  }
  const plan = B.plan;
  inp.aimTo = plan.yaw + B.noise * sk.noise; p.lvl = plan.lvl;
  const err = Math.abs(angDiff(p.aimYaw, inp.aimTo));
  if (B.holdFire > 0) { B.holdFire -= dt; inp.fire = true; if (B.holdFire <= 0) inp.fire = false; }
  else if (p.discsHome > 0 && p.cool <= 0 && err < 0.03 + sk.spread && !inp.shield && plan.score > -2.5) {
    inp.fire = true; B.holdFire = plan.power ? D_CHARGE + 0.05 : 0.02; B.plan = null; B.think = Math.min(B.think, sk.think * 0.4);
  }
  if (p.discsHome === 0 && p.discs.every(d => d.state !== 'fly' || d.t > 1.8) && Math.random() < dt * 2) inp.recall = true;
  return inp;
}

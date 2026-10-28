/* ================= power-ups ================= */
// Random pickups that float over the runners' own podiums. Walk over one to take it: weapon power-ups
// load into your next few throws, ANCHOR runs on a timer, SHIELD CELL is instant. At most PU_MAX are out
// at once and each one lasts PU_LIFE seconds. Online, the host decides where they appear.
const PU_TYPES = {
  split:  { name: 'SPLIT DISC',  uses: 2, color: 0x1650ff, tip: 'Your next 2 discs split into three as they leave your podium.' },
  boom:   { name: 'EXPLOSIVE',   uses: 3, color: 0xff6a00, tip: 'Next 3 discs explode: 1.5× knockback, and a blocked one still shoves.' },
  oc:     { name: 'OVERCLOCK',   uses: 2, color: 0xffe600, tip: 'Next 2 discs burn through a shield and knock it offline.' },
  seek:   { name: 'SEEKER',      uses: 1, color: 0xff1414, tip: 'Next disc hunts the rival you face. It blinks: they can shield it.' },
  anchor: { name: 'ANCHOR',      time: ANCHOR_TIME, color: 0xa020ff, tip: 'For 10 s you take half the knockback and OVERLOAD.' },
  cell:   { name: 'SHIELD CELL', color: 0x00d5ff, tip: '+3 shield blocks.' }
};
const PU_KEYS = Object.keys(PU_TYPES);
const PU = { list: [], seq: 0, nextT: PU_FIRST, enabled: true, taken: new Set(), icons: {} };

// icon art, drawn once per type
function puIcon(type) {
  if (PU.icons[type]) return PU.icons[type];
  const N = 256, c = cnv(N, N), x = c.getContext('2d'), col = '#' + new THREE.Color(PU_TYPES[type].color).getHexString();
  x.translate(N / 2, N / 2);
  // hex badge
  x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; x.lineTo(Math.cos(a) * 112, Math.sin(a) * 112); } x.closePath();
  x.fillStyle = 'rgba(4,4,14,0.82)'; x.fill(); x.lineWidth = 12; x.strokeStyle = col; x.stroke();
  x.lineWidth = 3; x.strokeStyle = '#ffffff'; x.globalAlpha = 0.5; x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; x.lineTo(Math.cos(a) * 92, Math.sin(a) * 92); } x.closePath(); x.stroke(); x.globalAlpha = 1;
  x.fillStyle = '#ffffff'; x.strokeStyle = '#ffffff'; x.lineCap = 'round'; x.lineJoin = 'round';
  const arrow = (ang) => { x.save(); x.rotate(ang); x.lineWidth = 12; x.beginPath(); x.moveTo(0, 40); x.lineTo(0, -40); x.stroke(); x.beginPath(); x.moveTo(-20, -18); x.lineTo(0, -46); x.lineTo(20, -18); x.stroke(); x.restore(); };
  if (type === 'split') { arrow(-0.55); arrow(0); arrow(0.55); }
  else if (type === 'boom') { x.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 26 : 62, a = i / 16 * TAU; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); x.fillStyle = col; x.beginPath(); x.arc(0, 0, 18, 0, TAU); x.fill(); }
  else if (type === 'oc') { x.beginPath(); x.moveTo(14, -66); x.lineTo(-30, 8); x.lineTo(-2, 8); x.lineTo(-14, 66); x.lineTo(32, -10); x.lineTo(4, -10); x.closePath(); x.fill(); }
  else if (type === 'seek') { x.lineWidth = 10; x.beginPath(); x.arc(0, 0, 44, 0, TAU); x.stroke(); for (const a of [0, 1, 2, 3]) { x.save(); x.rotate(a * Math.PI / 2); x.beginPath(); x.moveTo(0, -66); x.lineTo(0, -30); x.stroke(); x.restore(); } x.beginPath(); x.arc(0, 0, 12, 0, TAU); x.fill(); }
  else if (type === 'anchor') { x.lineWidth = 12; x.beginPath(); x.moveTo(0, -52); x.lineTo(0, 48); x.stroke(); x.beginPath(); x.arc(0, -60, 12, 0, TAU); x.stroke(); x.beginPath(); x.moveTo(-26, -26); x.lineTo(26, -26); x.stroke(); x.beginPath(); x.arc(0, 8, 44, 0.25, Math.PI - 0.25); x.stroke(); }
  else if (type === 'cell') { x.beginPath(); x.moveTo(0, -62); x.lineTo(50, -40); x.lineTo(44, 18); x.lineTo(0, 62); x.lineTo(-44, 18); x.lineTo(-50, -40); x.closePath(); x.lineWidth = 11; x.stroke(); x.font = `900 64px ${FONT_D}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('+3', 0, 4); }
  const t = texOf(c, true); PU.icons[type] = t; return t;
}

function makePuMesh(type) {
  const g = new THREE.Group(), c = new THREE.Color(PU_TYPES[type].color);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: puIcon(type), color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, depthWrite: false }));
  icon.scale.set(1.0, 1.0, 1); icon.position.y = 0.95; icon.renderOrder = 6; g.add(icon);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(3.2), transparent: true }));
  ring.position.y = 0.95; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 6, 48), ring.material); ring2.position.y = 0.95; g.add(ring2);
  const pad = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 6), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.6), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.03; g.add(pad);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 2.4, 24, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uC: { value: c }, uA: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float a = (1.-vUv.y)*0.35*uA; gl_FragColor = vec4(uC*a, 1.); }'
  }));
  beam.position.y = 1.2; g.add(beam);
  g.userData = { icon, ring, ring2, pad, beam };
  scene.add(g); return g;
}
function disposePu(u) { if (!u.mesh) return; scene.remove(u.mesh); u.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); u.mesh = null; }
function clearPowerups() { PU.list.forEach(disposePu); PU.list = []; PU.taken.clear(); PU.nextT = PU_FIRST; }
function puPad(u) { const st = STATIONS[u.st]; return st && st.pads[u.pad]; }
function puWorld(u, out) { const pad = puPad(u); if (!pad) return null; return out.set(pad.x + u.ox, pad.y, pad.z + u.oz); }

// host / local: decide where the next one appears
function spawnPowerup() {
  const live = players.filter(p => p.mode === 'play'); if (!live.length || !STATIONS.length) return;
  const p = live[Math.floor(Math.random() * live.length)], st = stationOf(p);
  for (let tries = 0; tries < 12; tries++) {
    const pad = st.pads[Math.floor(Math.random() * st.pads.length)];
    const solid = pad.rings.filter(r => r.state === 0); if (!solid.length) continue;
    const r = solid[Math.floor(Math.random() * solid.length)], a = Math.random() * TAU;
    const rr = r.rIn < 0.01 ? Math.random() * r.rOut * 0.5 : lerp(r.rIn + 0.2, r.rOut - 0.2, Math.random());
    const ox = Math.cos(a) * rr, oz = Math.sin(a) * rr;
    if (Math.hypot(pad.x + ox - p.x, pad.z + oz - p.z) < 1.0) continue;               // not right under their feet
    if (PU.list.some(u => u.st === st.i && u.pad === pad.idx && Math.hypot(u.ox - ox, u.oz - oz) < 1.4)) continue;
    const type = PU_KEYS[Math.floor(Math.random() * PU_KEYS.length)];
    addPowerup({ id: ++PU.seq + PU_ID_BASE, type, st: st.i, pad: pad.idx, ox, oz, age: 0 });
    return;
  }
}
const PU_ID_BASE = Math.floor(Math.random() * 1e6) * 100;
function addPowerup(u) { u.mesh = makePuMesh(u.type); PU.list.push(u); SFX.puSpawn(); }
function removePowerup(id) { const i = PU.list.findIndex(u => u.id === id); if (i < 0) return; disposePu(PU.list[i]); PU.list.splice(i, 1); }

function grantPowerup(p, type) {
  const T = PU_TYPES[type];
  if (T.uses) p.weapon = { type, n: T.uses };
  else if (type === 'anchor') p.anchorT = T.time;
  else if (type === 'cell') p.defl = Math.min(DEFLECTS, p.defl + 3);
  p.stats.pu = (p.stats.pu || 0) + 1;
  popFor(p, T.name + (T.uses ? ' ×' + T.uses : ''), true);
  sparks(p.x, p.y + 1, p.z, T.color, 40, 5, 0.7, 0.08); shockRing(p.x, p.y + 0.05, p.z, 0, 1, 0, T.color, 2.6, 0.5);
  SFX.powerup(p);
}

const _pw = new THREE.Vector3();
function updatePowerups(dt) {
  const running = state === 'play' || DEMO, auth = !NET.room || NET.role === 'host';
  if (!PU.enabled) { if (PU.list.length) clearPowerups(); return; }
  if (running && auth) {
    PU.nextT -= dt;
    if (PU.nextT <= 0) { PU.nextT = rand(PU_GAP[0], PU_GAP[1]); if (PU.list.length < PU_MAX) spawnPowerup(); }
    for (const u of PU.list.slice()) { u.age += dt; if (u.age >= PU_LIFE) { sparksAt(u); removePowerup(u.id); } }
  } else if (running) for (const u of PU.list) u.age += dt;
  // pickups: any local runner walking through one
  if (running) for (const p of players) {
    if (!p.local || p.mode !== 'play') continue;
    for (const u of PU.list) {
      if (PU.taken.has(u.id) || !puWorld(u, _pw)) continue;
      if (Math.hypot(p.x - _pw.x, p.z - _pw.z) < 0.8 && Math.abs(p.y - _pw.y) < 0.8) {
        grantPowerup(p, u.type); PU.taken.add(u.id);
        if (auth) { removePowerup(u.id); break; } else { netEvent(['u', u.id]); disposePu(u); break; }
      }
    }
  }
  // visuals
  const t = uTime.value;
  for (const u of PU.list) {
    if (!u.mesh) continue; if (!puWorld(u, _pw)) { u.mesh.visible = false; continue; }
    const pad = puPad(u), ring = pad.rings.find(r => { const d = Math.hypot(u.ox, u.oz); return d >= r.rIn - 0.05 && d <= r.rOut + 0.05; });
    const late = PU_LIFE - u.age, blink = late < 4 ? Math.sin(t * (8 + (4 - late) * 5)) > 0 : true;
    u.mesh.visible = blink && !(ring && ring.state === 2) && !PU.taken.has(u.id);
    u.mesh.position.copy(_pw);
    const U = u.mesh.userData, bob = Math.sin(t * 2.6 + u.id) * 0.12, pop = Math.min(1, u.age * 3);
    U.icon.position.y = 0.95 + bob; U.ring.position.y = U.ring2.position.y = 0.95 + bob;
    U.icon.scale.setScalar(pop); U.ring.rotation.set(t * 1.7, t * 1.1, 0); U.ring2.rotation.set(-t * 1.3, 0, t * 2.1);
    U.pad.rotation.z = t * 0.8;
  }
}
function sparksAt(u) { if (puWorld(u, _pw)) sparks(_pw.x, _pw.y + 1, _pw.z, PU_TYPES[u.type].color, 16, 3, 0.5, 0.06); }

// guests: mirror the host's list
function syncPowerups(arr) {
  if (!Array.isArray(arr)) return;
  const seen = new Set();
  for (const e of arr) {
    if (!Array.isArray(e) || !PU_TYPES[e[1]]) continue; const id = num(e[0]); seen.add(id);
    let u = PU.list.find(x => x.id === id);
    if (!u) { if (PU.taken.has(id)) continue; addPowerup({ id, type: e[1], st: num(e[2]), pad: num(e[3]), ox: num(e[4]), oz: num(e[5]), age: num(e[6]) }); }
    else u.age = Math.max(u.age, num(e[6]));
  }
  for (const u of PU.list.slice()) if (!seen.has(u.id)) removePowerup(u.id);
}
const encPowerups = () => PU.list.map(u => [u.id, u.type, u.st, u.pad, r2(u.ox), r2(u.oz), r2(u.age)]);

// CPUs: is there one on my podium worth walking to?
function puGoalFor(p, sk) {
  if (!PU.enabled || !PU.list.length) return null;
  let best = null, bd = 1e9;
  for (const u of PU.list) {
    if (PU.taken.has(u.id) || u.st !== p.slot || !puWorld(u, _pw)) continue;
    const d = Math.hypot(_pw.x - p.x, _pw.z - p.z); if (d < bd) { bd = d; best = { x: _pw.x, z: _pw.z }; }
  }
  return best;
}

// HUD chip text for a runner's active power-ups
function puChip(p) {
  const out = [];
  if (p.weapon) out.push([PU_TYPES[p.weapon.type].name + ' ×' + p.weapon.n, PU_TYPES[p.weapon.type].color]);
  if (p.anchorT > 0) out.push(['ANCHOR ' + Math.ceil(p.anchorT) + 's', PU_TYPES.anchor.color]);
  return out;
}

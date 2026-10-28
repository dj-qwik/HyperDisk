/* ================= online ================= */
// One host runs the match clock, the phase, the CPU runners and the result. Every client simulates its
// own runner and its own discs and shares them as presence (absolute state ~22 times a second), so your
// own moves never wait on the network. Whoever owns a disc decides what it hits; hits, shattered rings,
// broken firewall blocks and deflects travel as short-lived events inside presence, de-duplicated by id.
const NET = {
  api: null, ready: false, room: null, role: null, code: '', myPeer: null, myId: Math.random().toString(36).slice(2, 7),
  guestOrder: [], unsub: [], lobbyRo: null, rid: 0, curRid: -1, peers: new Map(), out: [], seen: new Map(), lastSend: 0, hostPeer: null, hostSeenAt: 0, joinedAt: 0
};
const MODES = ['idle', 'play', 'fall', 'dead', 'out', 'win'];
const PHASES = ['intro', 'count', 'play', 'end'];

// Where online rooms come from: inside Claude, the artifact's room feature; anywhere else (our own
// server on Render), a WebSocket at /ws on the same site that speaks the same shape.
function makeWsRooms() {
  return {
    join(name) {
      return new Promise((resolve, reject) => {
        let ws;
        try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); }
        catch (e) { reject({ code: 'upstream_error' }); return; }
        const peers = new Map(), listeners = new Set();
        let myId = null, mine = {}, dirty = false, cached = null, done = false, ended = false;
        const snapshot = () => cached || (cached = [...peers.values()].map(p => ({
          peer: p.id, by: null, kind: 'viewer', guest: false, isMe: p.id === myId, sameTab: p.id === myId, presence: p.id === myId ? mine : p.presence, updatedAt: p.at
        })));
        const fire = (joined, left, updated) => { cached = null; const ch = { peers: snapshot(), joined, left, updated }; listeners.forEach(l => { try { l.h(ch); } catch (e) { console.error(e); } }); };
        const fail = () => { if (ended) return; ended = true; listeners.forEach(l => l.onErr && l.onErr({ code: 'upstream_error', message: 'Connection to the game server closed.' })); };
        const room = {
          name,
          peers: snapshot,
          onPeers(h, onErr) { const l = { h, onErr }; listeners.add(l); setTimeout(() => { if (listeners.has(l)) h({ peers: snapshot(), joined: snapshot(), left: [], updated: [] }); }, 0); return () => listeners.delete(l); },
          presence(patch) { for (const k in patch) { if (patch[k] === null) delete mine[k]; else mine[k] = patch[k]; } dirty = true; return Promise.resolve(); },
          connected: () => ws.readyState === 1,
          leave() { ended = true; clearInterval(timer); try { ws.close(); } catch (e) {} return Promise.resolve(); }
        };
        const timer = setInterval(() => { if (dirty && ws.readyState === 1) { dirty = false; ws.send(JSON.stringify({ t: 'p', presence: mine })); } }, 40);
        ws.onopen = () => ws.send(JSON.stringify({ t: 'join', room: name }));
        ws.onmessage = e => {
          let m; try { m = JSON.parse(e.data); } catch (err) { return; }
          if (m.t === 'welcome') {
            myId = m.id; peers.set(myId, { id: myId, presence: mine, at: Date.now() });
            (m.peers || []).forEach(p => peers.set(p.id, { id: p.id, presence: p.presence || {}, at: Date.now() }));
            done = true; resolve(room); fire(snapshot(), [], []);
          } else if (m.t === 'p') {
            const isNew = !peers.has(m.id);
            peers.set(m.id, { id: m.id, presence: m.presence || {}, at: Date.now() });
            cached = null; const me = snapshot().find(x => x.peer === m.id);
            fire(isNew ? [me] : [], [], isNew ? [] : [me]);
          } else if (m.t === 'leave') {
            const gone = snapshot().find(x => x.peer === m.id);
            if (peers.delete(m.id)) fire([], gone ? [gone] : [], []);
          } else if (m.t === 'full') { if (!done) reject({ code: 'limit_reached' }); }
        };
        ws.onclose = ws.onerror = () => { clearInterval(timer); if (!done) { done = true; reject({ code: 'upstream_error' }); } else fail(); };
      });
    }
  };
}
(async () => {
  try {
    if (window.claude && typeof window.claude.use === 'function') NET.api = await window.claude.use('room');
    else if (/^https?:$/.test(location.protocol)) NET.api = makeWsRooms();
  } catch (e) { NET.api = null; }
  NET.ready = true;
  if (state === 'lobby') renderLobby();
})();

const CODE_CH = 'abcdefghjkmnpqrstuvwxyz23456789';
const r2 = v => Math.round(v * 100) / 100;
const r3 = v => Math.round(v * 1000) / 1000;
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : (d || 0));

function netHost() { let c = ''; for (let i = 0; i < 4; i++) c += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; netEnter(c, 'host'); }
async function netEnter(code, role) {
  if (!NET.api) { toast("Online play needs the hosted site or the Claude app."); return; }
  code = (code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (code.length !== 4) { toast('Room codes are four characters.'); return; }
  try {
    const r = await NET.api.join('hyperdisc-' + code);
    Object.assign(NET, { room: r, role, code, curRid: -1, rid: 0, guestOrder: [], lobbyRo: null, peers: new Map(), out: [], seen: new Map(), hostPeer: null, hostSeenAt: performance.now(), joinedAt: performance.now(), myPeer: null });
    NET.unsub.push(r.onPeers(onNetPeers, () => netLeave('Lost the connection to the room.')));
    r.presence({ app: 'hyperdisc', role, s: null, g: null, ev: null }).catch(() => {});
    SFX.join(); toast(role === 'host' ? 'ROOM ' + code.toUpperCase() + ' OPEN' : 'JOINED ROOM ' + code.toUpperCase());
    if (state !== 'lobby') toLobby(); else renderLobby();
  } catch (e) {
    const c = e && e.code;
    toast(c === 'not_permitted' ? "Online rooms aren't available for your account here." : c === 'limit_reached' ? 'That room is full or too many rooms are open.' : "Couldn't reach the room. Try again in a moment.");
  }
}
function netLeave(msg) {
  NET.unsub.forEach(u => { try { u(); } catch (e) {} }); NET.unsub = [];
  const r = NET.room; NET.room = null; NET.role = null; NET.code = ''; NET.myPeer = null; NET.lobbyRo = null;
  if (r) r.leave().catch(() => {});
  if (msg) toast(msg);
  toLobby();
}
function hostLobbyRoster() {
  const ro = [[NET.myPeer || 'me', 'h', PNAME[0]]];
  NET.guestOrder.slice(0, 3).forEach((g, i) => ro.push([g, 'h', PNAME[i + 1]]));
  const names = CPU_NAMES.slice(); let cpus = Math.min(S.cpus, 4 - ro.length); if (ro.length + cpus < 2) cpus = 2 - ro.length;
  for (let i = 0; i < cpus; i++) ro.push(['', 'c', names[(i * 5 + NET.code.charCodeAt(0)) % names.length]]);
  return ro;
}
function onNetPeers(ch) {
  const now = performance.now();
  const me = ch.peers.find(p => p.isMe && p.sameTab); if (me) NET.myPeer = me.peer;
  const here = new Set();
  for (const p of ch.peers) {
    here.add(p.peer); if (p.sameTab) continue;
    const pr = p.presence || {}; if (pr.app !== 'hyperdisc') continue;
    const prev = NET.peers.get(p.peer);
    if (!prev || prev.pr !== pr) NET.peers.set(p.peer, { pr, at: now });
    if (pr.role === 'host') { NET.hostPeer = p.peer; NET.hostSeenAt = now; }
  }
  for (const k of [...NET.peers.keys()]) if (!here.has(k)) NET.peers.delete(k);
  if (NET.role === 'host') {
    const before = NET.guestOrder.join(',');
    NET.guestOrder = NET.guestOrder.filter(x => here.has(x) && NET.peers.has(x));
    for (const [peer, e] of NET.peers) if (e.pr.role === 'guest' && !NET.guestOrder.includes(peer)) NET.guestOrder.push(peer);
    if (state === 'lobby' && before !== NET.guestOrder.join(',')) { renderLobby(); SFX.join(); }
    // a guest dropped mid-match: their runner is out
    if (state !== 'lobby') for (const p of players) if (p.kind === 'human' && !p.local && p.peer && !here.has(p.peer) && p.mode !== 'out') { p.mode = 'out'; p.lives = 0; }
  } else if (NET.role === 'guest') {
    if (NET.hostPeer && !here.has(NET.hostPeer)) { netLeave('The host left the room.'); return; }
  }
}

// ---- outgoing ----
function netEvent(arr) { if (!NET.room) return; NET.out.push({ at: performance.now(), e: [NET.myId + (evSeq++).toString(36), ...arr] }); }
function encBody(p) {
  return [r2(p.x), r2(p.y), r2(p.z), r3(p.yaw), r3(p.aimYaw), r2(p.aimElev), MODES.indexOf(p.mode), p.lives, p.heat, p.shieldOn ? 1 : 0, p.charge > 0 ? (p.charge >= D_CHARGE ? 2 : 1) : 0, p.discsHome,
    r2(p.vx), r2(p.vz), p.onGround ? 1 : 0, Math.round(p.flash * 10), p.stun > 0 ? 1 : 0, p.defl, p.invuln > 0 ? 1 : 0, p.teeter > 0 ? 1 : 0];
}
function encDiscs(p) { return p.discs.map(d => d.state === 'home' ? 0 : [d.state === 'fly' ? 1 : 2, r2(d.pos.x), r2(d.pos.y), r2(d.pos.z), r2(d.vel.x), r2(d.vel.y), r2(d.vel.z), d.power ? 1 : 0]); }
const encStats = p => [p.stats.hits, p.stats.rings, p.stats.kos, p.stats.defl];
function netTick() {
  if (!NET.room) return;
  const now = performance.now();
  if (now - NET.lastSend < 45) return; NET.lastSend = now;
  NET.out = NET.out.filter(o => now - o.at < 1600);
  const ev = NET.out.map(o => o.e);
  const pres = { app: 'hyperdisc', role: NET.role, ev };
  const me = players.find(p => p.local && p.kind === 'human');
  pres.s = (state !== 'lobby' && me) ? { r: NET.curRid, sl: me.slot, b: encBody(me), d: encDiscs(me), st: encStats(me) } : null;
  if (NET.role === 'host') {
    if (state === 'lobby') pres.g = { lob: { ro: hostLobbyRoster(), ar: S.arena, lv: S.lives, sk: S.skill, cpus: S.cpus } };
    else pres.g = { m: { rid: NET.curRid, cfg: lastCfg, ph: PHASES.indexOf(state), pt: r2(phaseT), t: r2(matchT), w: winner ? winner.slot : -1,
      bots: players.filter(p => p.kind === 'cpu').map(p => [p.slot, encBody(p), encDiscs(p), encStats(p)]) } };
  } else pres.g = null;
  NET.room.presence(pres).catch(() => {});
}
function netStartMatch() {
  if (NET.role !== 'host') return;
  NET.curRid = ++NET.rid + Math.floor(Math.random() * 1000) * 100;
  const ro = hostLobbyRoster().map(r => r.slice());
  ro[0][0] = NET.myPeer;
  const ar = ARENAS[S.arena].id === 'random' ? Math.floor(Math.random() * (ARENAS.length - 1)) : S.arena;
  startMatch({ ro, ar, lv: S.lives, sk: S.skill, rid: NET.curRid });
  NET.lastSend = 0; netTick();
}

// ---- incoming ----
function netRecv(dt) {
  if (!NET.room) return;
  const now = performance.now();
  // host presence drives guests' lobby view and the match phase
  if (NET.role === 'guest' && NET.hostPeer) {
    const h = NET.peers.get(NET.hostPeer), g = h && h.pr.g;
    if (g && g.lob && state === 'lobby') {
      const k = JSON.stringify(g.lob);
      if (k !== NET.lobKey) { NET.lobKey = k; NET.lobbyRo = g.lob.ro; S.arena = num(g.lob.ar, 0) % ARENAS.length; S.lives = num(g.lob.lv, 3); S.skill = num(g.lob.sk, 1); S.cpus = num(g.lob.cpus, 1); renderLobby(); }
    }
    if (g && g.m && g.m.cfg) {
      const m = g.m;
      const inRoster = m.cfg.ro.some(r => r[0] === NET.myPeer);
      if (m.rid !== NET.curRid && inRoster && m.ph < 3) { NET.curRid = m.rid; startMatch(m.cfg); }
      if (m.rid === NET.curRid && state !== 'lobby') {
        const age = (now - h.at) / 1000, ph = PHASES[m.ph];
        const ht = m.t + (ph === 'play' ? age : 0); if (Math.abs(matchT - ht) > 0.25) matchT = ht; else matchT = lerp(matchT, ht, 0.1);
        if (ph === 'count' && state === 'intro') { toCount(); phaseT = m.pt + age; }
        if (ph === 'play' && (state === 'intro' || state === 'count')) { if (state === 'intro') toCount(); toPlay(); }
        if (ph === 'end' && state !== 'end') endMatch(m.w);
        for (const b of m.bots || []) { const p = players[b[0]]; if (p && !p.local) applyRemote(p, b[1], b[2], b[3], h.at); }
      }
    }
    if (performance.now() - NET.hostSeenAt > 9000 && performance.now() - NET.joinedAt > 9000) { netLeave('Lost the host.'); return; }
  }
  // every peer's own runner, plus events
  for (const [peer, e] of NET.peers) {
    const pr = e.pr;
    if (pr.s && pr.s.r === NET.curRid && state !== 'lobby') { const p = players[pr.s.sl]; if (p && !p.local && p.peer === peer) applyRemote(p, pr.s.b, pr.s.d, pr.s.st, e.at); }
    if (Array.isArray(pr.ev)) for (const ev of pr.ev) {
      if (!Array.isArray(ev) || typeof ev[0] !== 'string' || NET.seen.has(ev[0])) continue;
      NET.seen.set(ev[0], now); if (state === 'lobby') continue; applyEvent(ev);
    }
  }
  if (NET.seen.size > 400) for (const [k, t] of NET.seen) if (now - t > 6000) NET.seen.delete(k);
}
function applyEvent(ev) {
  const k = ev[1];
  if (k === 'h') { const p = players[ev[2]]; if (p && p.local) applyHit(p, num(ev[3]), num(ev[4]), !!ev[5], num(ev[6], -1), clamp(num(ev[7], 1), 0, 2)); }
  else if (k === 'd') { const p = players[ev[2]]; if (p && p.local) shieldStruck(p, !!ev[3]); else if (p) p.rig.shieldMat.uniforms.uHit.value = 1; }
  else if (k === 'r') { ringBreak(num(ev[2]), num(ev[3]), num(ev[4])); }
  else if (k === 'b') { WALLFW.breakBlock(num(ev[2])); }
  else if (k === 'k') { const p = players[ev[2]]; if (p && p.local) { p.stats.kos++; p.defl = DEFLECTS; popFor(p, 'KNOCKOUT! DEFLECTOR FULL'); } }
}
function applyRemote(p, b, d, st, at) {
  if (!Array.isArray(b) || b.length < 15) return;
  const n = p.net || (p.net = { x: p.x, y: p.y, z: p.z, at: 0, fl: 0 });
  if (n.at === at && n.b === b) return;
  n.b = b; n.at = at; n.x = num(b[0]); n.y = num(b[1]); n.z = num(b[2]); n.yaw = num(b[3]); n.aim = num(b[4]); n.vx = num(b[12]); n.vz = num(b[13]);
  p.aimElev = num(b[5], ELEV_LEVEL); p.lives = num(b[7]); p.heat = num(b[8]); p.shieldOn = !!b[9]; p.charge = b[10] === 2 ? D_CHARGE : b[10] === 1 ? 0.1 : 0; p.discsHome = num(b[11]);
  p.onGround = !!b[14]; if (num(b[15]) > n.fl) p.flash = 1; n.fl = num(b[15]); p.stun = b[16] ? 0.2 : 0; p.defl = num(b[17], DEFLECTS); p.shieldE = p.defl / DEFLECTS * 100; p.teeter = b[19] ? 0.3 : 0; p.invuln = b[18] ? 0.5 : 0;
  const mode = MODES[num(b[6])] || 'play';
  if (mode !== p.mode) {
    if (mode === 'fall' && p.mode === 'play') { SFX.fall(p); p.fallT = 0; }
    if (mode === 'dead' && p.mode === 'fall') { shatter(p.x, p.y, p.z, p.color, n.vx, n.vz); SFX.shatter(p); }
    if (mode === 'play' && (p.mode === 'dead' || p.mode === 'fall')) { restoreStation(stationOf(p)); p.x = n.x; p.y = n.y; p.z = n.z; sparks(p.x, p.y + 1, p.z, p.color, 50, 6, 0.8, 0.08); shockRing(p.x, p.y + 0.05, p.z, 0, 1, 0, p.color, 4, 0.6); SFX.respawn(p); }
    if (!(state === 'end' && p === winner)) p.mode = mode;
  }
  if (Array.isArray(st)) { p.stats.hits = num(st[0]); p.stats.rings = num(st[1]); p.stats.kos = Math.max(p.stats.kos, num(st[2])); p.stats.defl = num(st[3]); }
  if (Array.isArray(d)) d.forEach((v, i) => { const dc = p.discs[i]; if (dc) dc.net = { v, at }; });
}
function remoteBodyStep(p, dt) {
  const n = p.net; if (!n) return;
  const age = Math.min(0.15, (performance.now() - n.at) / 1000);
  const tx = n.x + n.vx * age, tz = n.z + n.vz * age;
  if (Math.hypot(tx - p.x, tz - p.z) > 4 || Math.abs(n.y - p.y) > 4) { p.x = tx; p.z = tz; p.y = n.y; }
  else { p.x = damp(p.x, tx, 16, dt); p.z = damp(p.z, tz, 16, dt); p.y = damp(p.y, n.y, 16, dt); }
  p.yaw = dampAng(p.yaw, n.yaw, 16, dt); p.aimYaw = dampAng(p.aimYaw, n.aim, 16, dt);
  p.vx = n.vx; p.vz = n.vz; p.animT += dt; p.flash = Math.max(0, p.flash - dt * 2.5);
  if (p.onGround) p.stride += Math.hypot(p.vx, p.vz) * dt * 2.6;
  if (p.throwT > 0) p.throwT -= dt;
}
const _ov = new THREE.Vector3();
function remoteDiscStep(d, dt) {
  const n = d.net; if (!n) return;
  const v = n.v;
  if (!Array.isArray(v)) { if (d.state !== 'home') { d.state = 'home'; d.mesh.visible = false; d.trail.mesh.visible = false; } return; }
  const age = Math.min(0.15, (performance.now() - n.at) / 1000);
  const tx = v[1] + v[4] * age, ty = v[2] + v[5] * age, tz = v[3] + v[6] * age;
  if (d.state === 'home') { d.state = v[0] === 1 ? 'fly' : 'ret'; d.pos.set(tx, ty, tz); d.vel.set(v[4], v[5], v[6]); d.mesh.visible = true; d.trail.reset(d.pos); d.trail.mesh.visible = true; d.power = !!v[7]; d.mesh.scale.setScalar(d.power ? 0.95 : 0.78); d.owner.throwT = 0.28; SFX.throwDisc(d.power, d.owner); return; }
  d.state = v[0] === 1 ? 'fly' : 'ret';
  _ov.copy(d.vel); d.vel.set(v[4], v[5], v[6]);
  // a sharp change of direction means it bounced off something: show it here too
  if (_ov.lengthSq() > 4 && _ov.dot(d.vel) < _ov.lengthSq() * 0.2 && d.ghostT <= 0) { sparks(d.pos.x, d.pos.y, d.pos.z, d.owner.color, 14, 7, 0.45); SFX.bounce(d.pos); d.ghostT = 0.15; if (Math.abs(d.pos.x) > BOX.hx - 1.2 || Math.abs(d.pos.z) > BOX.hz - 1.2) wallFlash(d.pos.x, d.pos.y, d.pos.z, d.owner.color); if (d.pos.y > YC - 1) ceilFlash(d.pos.x, d.pos.z, d.owner.color); }
  d.ghostT -= dt;
  d.pos.addScaledVector(d.vel, dt);
  const ex = tx - d.pos.x, ey = ty - d.pos.y, ez = tz - d.pos.z;
  if (ex * ex + ey * ey + ez * ez > 9) d.pos.set(tx, ty, tz); else { const f = 1 - Math.exp(-18 * dt); d.pos.x += ex * f; d.pos.y += ey * f; d.pos.z += ez * f; }
}

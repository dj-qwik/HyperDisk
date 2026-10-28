/* ================= remappable controls + debug menu ================= */
// Keyboard schemes (KEYS.kb1 / kb2) and the controller map (PADMAP) live in 04-play; here they are
// loaded from and saved to local storage, and edited in the CONTROLS screen. Rebinding is done in the
// game loop (ctlInput), so keys and controller buttons are captured the same way.
const BIND_DEF = JSON.parse(JSON.stringify({ kb1: KEYS.kb1, kb2: KEYS.kb2, pad: PADMAP, opt: CTRL }));
(function loadBinds() {
  const sv = store.get('binds', null); if (!sv) return;
  for (const s of ['kb1', 'kb2', 'pad']) if (sv[s]) for (const a in sv[s]) if (a in (s === 'pad' ? PADMAP : KEYS[s]) && Array.isArray(sv[s][a])) (s === 'pad' ? PADMAP : KEYS[s])[a] = sv[s][a].slice(0, 3);
  if (sv.opt) Object.assign(CTRL, sv.opt);
})();
function saveBinds() { store.set('binds', { kb1: KEYS.kb1, kb2: KEYS.kb2, pad: PADMAP, opt: CTRL }); }

const KB_ACTIONS = [['up', 'MOVE FORWARD'], ['down', 'MOVE BACK'], ['left', 'MOVE LEFT'], ['right', 'MOVE RIGHT'], ['aimL', 'AIM LEFT'], ['aimR', 'AIM RIGHT'],
  ['lvlUp', 'AIM HIGHER'], ['lvlDn', 'AIM LOWER'], ['level', 'LEVEL THE AIM'], ['fire', 'THROW · HOLD TO SHIELD'], ['shield', 'SHIELD'], ['recall', 'RECALL DISCS']];
const PAD_ACTIONS = [['fire', 'THROW · HOLD TO SHIELD'], ['shield', 'SHIELD'], ['lvlUp', 'AIM HIGHER'], ['lvlDn', 'AIM LOWER'], ['level', 'LEVEL THE AIM'], ['aimL', 'FINE AIM LEFT'], ['aimR', 'FINE AIM RIGHT'], ['recall', 'RECALL DISCS']];
const PAD_NAMES = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'VIEW', 9: 'MENU', 10: 'L-STICK', 11: 'R-STICK', 12: 'D-PAD ▲', 13: 'D-PAD ▼', 14: 'D-PAD ◀', 15: 'D-PAD ▶', 16: 'HOME', 100: 'R-STICK ▲', 101: 'R-STICK ▼' };
function keyName(c) {
  if (!c) return '—';
  const sp = { Space: 'SPACE', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
    AltLeft: 'L-ALT', AltRight: 'R-ALT', Enter: 'ENTER', NumpadEnter: 'NUM ENTER', Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Tab: 'TAB', CapsLock: 'CAPS', Backspace: 'BKSP' };
  if (sp[c]) return sp[c];
  if (c.startsWith('Key')) return c.slice(3); if (c.startsWith('Digit')) return c.slice(5); if (c.startsWith('Numpad')) return 'NUM ' + c.slice(6);
  return c.toUpperCase();
}
const CTLUI = { tab: 'kb1', listen: null, focus: 0 };   // listen: { scheme, action, slot }
function ctlOpen(on) {
  show('#controls', on); CTLUI.listen = null; CTLUI.focus = 0;
  if (on) { renderControls(); SFX.tick(); }
}
function renderControls() {
  document.querySelectorAll('#ctlTabs button').forEach(b => b.classList.toggle('on', b.dataset.s === CTLUI.tab));
  const s = CTLUI.tab, isPad = s === 'pad', acts = isPad ? PAD_ACTIONS : KB_ACTIONS, map = isPad ? PADMAP : KEYS[s];
  const L = CTLUI.listen;
  let h = '<table class="ctl"><tr><th>ACTION</th><th>PRIMARY</th><th>ALTERNATE</th></tr>';
  for (const [a, label] of acts) {
    h += `<tr><td>${label}</td>`;
    for (let k = 0; k < 2; k++) {
      const v = (map[a] || [])[k], wait = L && L.scheme === s && L.action === a && L.slot === k;
      h += `<td><button class="cbtn${wait ? ' wait' : ''}" data-a="${a}" data-k="${k}">${wait ? (isPad ? 'PRESS A BUTTON…' : 'PRESS A KEY…') : v == null ? '—' : isPad ? (PAD_NAMES[v] || 'BTN ' + v) : keyName(v)}</button></td>`;
    }
    h += '</tr>';
  }
  h += '</table>';
  if (isPad) {
    h += `<div class="ctlopts">
      <div class="optrow"><span>STICKS</span><button class="cbtn" data-opt="swap">${CTRL.swap ? 'AIM LEFT · MOVE RIGHT' : 'MOVE LEFT · AIM RIGHT'}</button></div>
      <div class="optrow"><span>AIM HEIGHT ON RIGHT STICK</span><button class="cbtn" data-opt="invY">${CTRL.invY ? 'INVERTED' : 'NORMAL'}</button></div>`;
  } else h += '<div class="ctlopts">';
  h += `<div class="optrow"><span>AIM SPEED</span><button class="cbtn sm" data-opt="sens-">−</button><b class="sensv">${Math.round(CTRL.sens * 100)}%</b><button class="cbtn sm" data-opt="sens+">+</button></div>
    <div class="optrow"><span></span><button class="cbtn mag" data-opt="reset">RESET ${isPad ? 'CONTROLLER' : s === 'kb1' ? 'KEYBOARD 1' : 'KEYBOARD 2'} TO DEFAULTS</button></div></div>`;
  $('#ctlBody').innerHTML = h;
  const f = ctlFocusables(); f.forEach((b, i) => b.classList.toggle('focus', i === CTLUI.focus && CTLUI.padNav));
}
function ctlFocusables() { return [...document.querySelectorAll('#ctlBody .cbtn')]; }
function ctlClick(b) {
  if (b.dataset.opt) {
    const o = b.dataset.opt;
    if (o === 'swap') CTRL.swap = !CTRL.swap;
    if (o === 'invY') CTRL.invY = !CTRL.invY;
    if (o === 'sens-') CTRL.sens = Math.max(0.4, +(CTRL.sens - 0.1).toFixed(2));
    if (o === 'sens+') CTRL.sens = Math.min(2.5, +(CTRL.sens + 0.1).toFixed(2));
    if (o === 'reset') {
      const s = CTLUI.tab, src = JSON.parse(JSON.stringify(BIND_DEF[s]));
      const dst = s === 'pad' ? PADMAP : KEYS[s]; for (const a in dst) delete dst[a]; Object.assign(dst, src);
      if (s === 'pad') { CTRL.swap = BIND_DEF.opt.swap; CTRL.invY = BIND_DEF.opt.invY; }
      toast('DEFAULTS RESTORED', 1400);
    }
    saveBinds(); SFX.tick(); renderControls(); return;
  }
  CTLUI.listen = { scheme: CTLUI.tab, action: b.dataset.a, slot: +b.dataset.k, t: uTime.value }; SFX.tick(); renderControls();
}
function ctlAssign(v) {
  const L = CTLUI.listen, isPad = L.scheme === 'pad', map = isPad ? PADMAP : KEYS[L.scheme];
  // a key or button can only do one thing in a scheme: take it off anything else first
  if (v != null) for (const a in map) map[a] = map[a].filter(x => x !== v);
  const list = (map[L.action] || []).slice();
  if (v == null) list.splice(L.slot, 1); else { while (list.length < L.slot) list.push(list[list.length - 1]); list[Math.min(L.slot, list.length)] = v; }
  map[L.action] = list.filter((x, i, a) => x != null && a.indexOf(x) === i);
  CTLUI.listen = null; saveBinds(); SFX.tick(); renderControls();
}
// called from handleSystemInput every frame; returns true when it ate the input
function ctlInput() {
  if ($('#controls').hidden) return false;
  const L = CTLUI.listen;
  if (L) {
    if (uTime.value - L.t < 0.12) return true;    // ignore the press that started the rebind
    if (L.scheme === 'pad') {
      if (KP.has('Escape')) { CTLUI.listen = null; renderControls(); return true; }
      if (KP.has('Delete') || KP.has('Backspace')) { ctlAssign(null); return true; }
      for (let i = 0; i < padEdges.length; i++) if (padEdges[i] && padEdges[i].length) { ctlAssign(padEdges[i][0]); return true; }
    } else {
      for (const c of KP) {
        if (c === 'Escape') { CTLUI.listen = null; renderControls(); return true; }
        if (c === 'Delete' || c === 'Backspace') { ctlAssign(null); return true; }
        if (c === 'Backquote' || c === 'F2') continue;
        ctlAssign(c); return true;
      }
    }
    return true;
  }
  // controller navigation of the screen: d-pad / left stick to move, A to pick, LB/RB to switch tab, B to close
  const f = ctlFocusables(), anyPad = padEdges.some(e => e && e.length);
  if (anyPad) CTLUI.padNav = true;
  if (KP.has('Escape') || anyPadHit(1) >= 0 || anyPadHit(9) >= 0) { ctlOpen(false); return true; }
  const tabs = ['kb1', 'kb2', 'pad'];
  const tabStep = d => { CTLUI.tab = tabs[(tabs.indexOf(CTLUI.tab) + d + 3) % 3]; CTLUI.focus = 0; renderControls(); SFX.tick(); };
  if (anyPadHit(5) >= 0) tabStep(1); if (anyPadHit(4) >= 0) tabStep(-1);
  const mv = (anyPadHit(13) >= 0 ? 1 : 0) - (anyPadHit(12) >= 0 ? 1 : 0), side = (anyPadHit(15) >= 0 ? 1 : 0) - (anyPadHit(14) >= 0 ? 1 : 0);
  if (mv || side) { CTLUI.focus = clamp(CTLUI.focus + mv * 2 + side, 0, f.length - 1); renderControls(); }
  if (anyPadHit(0) >= 0 && f[CTLUI.focus]) ctlClick(f[CTLUI.focus]);
  return true;
}

/* ---------------- debug menu (F2, or Debug in the pause menu) ---------------- */
const DEBUG = { on: false, god: false, cpuFreeze: false, cpuHold: false, ts: 1, hud: true, fps: 60, _acc: 0, _n: 0, allowed: false };
// The debug menu is a developer tool: it only exists on a device that has been unlocked by opening the
// game once with ?dev in the address (?dev=off locks it again). It is always off in online matches,
// so nobody can use it to cheat a room.
(function () {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('dev')) store.set('dev', q.get('dev') !== 'off');
    DEBUG.allowed = !!store.get('dev', false) || q.has('test');
  } catch (e) {}
})();
function dbgMe() { return players.find(p => p.local && p.kind === 'human') || players[0]; }
function dbgRivals() { const me = dbgMe(); return players.filter(p => p !== me); }
function dbgOpen(on) {
  if (!DEBUG.allowed) return;
  if (NET.room && on !== false) { toast('DEBUG IS OFF IN ONLINE MATCHES', 1600); return; }
  DEBUG.on = on == null ? !DEBUG.on : on; show('#debug', DEBUG.on);
  if (DEBUG.on) renderDebug();
}
function renderDebug() {
  const tg = (k, l) => `<button class="dbtn${DEBUG[k] ? ' on' : ''}" data-tg="${k}">${l}</button>`;
  const act = (k, l) => `<button class="dbtn" data-act="${k}">${l}</button>`;
  $('#dbgBody').innerHTML = `
    <div class="dsec">TOGGLES</div>
    <div class="dgrid">${tg('god', 'GOD MODE')}${tg('cpuFreeze', 'FREEZE CPUs')}${tg('cpuHold', 'CPUs HOLD FIRE')}${tg('hud', 'LIVE READOUT')}</div>
    <div class="dsec">GAME SPEED</div>
    <div class="dgrid">${[0.25, 0.5, 1, 2].map(v => `<button class="dbtn${DEBUG.ts === v ? ' on' : ''}" data-ts="${v}">${v}×</button>`).join('')}</div>
    <div class="dsec">GIVE ME A POWER-UP</div>
    <div class="dgrid">${PU_KEYS.map(k => `<button class="dbtn" data-pu="${k}" style="--pc:#${new THREE.Color(PU_TYPES[k].color).getHexString()}">${PU_TYPES[k].name}</button>`).join('')}${act('puSpawn', 'SPAWN PICKUP')}</div>
    <div class="dsec">ME</div>
    <div class="dgrid">${act('meFall', 'KNOCK ME OFF')}${act('meRing', 'BREAK MY RINGS')}${act('meHeat', 'MAX MY OVERLOAD')}${act('meHeal', 'HEAL + RESTORE')}${act('meLife', '+1 LIFE')}${act('meHit', 'HIT ME (CHEST)')}</div>
    <div class="dsec">RIVALS</div>
    <div class="dgrid">${act('rvFall', 'KNOCK THEM OFF')}${act('rvRing', 'BREAK THEIR RINGS')}${act('rvHeat', 'MAX THEIR OVERLOAD')}${act('rvHit', 'HIT THEM (HEAD)')}${act('rvLife', 'THEM TO LAST LIFE')}</div>
    <div class="dsec">MATCH</div>
    <div class="dgrid">${act('win', 'WIN THE MATCH')}${act('restart', 'RESTART MATCH')}${act('nextArena', 'NEXT ARENA')}${act('lobby', 'QUIT TO LOBBY')}</div>
    <div class="dread" id="dbgRead"></div>`;
}
function dbgAct(k) {
  const me = dbgMe(), rv = dbgRivals(), live = state === 'play' || state === 'count';
  const need = () => { if (!live || !me) { toast('START A MATCH FIRST', 1400); return false; } return true; };
  const hit = (o, zone) => { if (o && o.mode === 'play') { const a = Math.atan2(o.x, o.z) + Math.PI; applyHit(o, -Math.sin(a), -Math.cos(a), false, me === o ? (rv[0] ? rv[0].slot : -1) : me.slot, zone, 1, false); } };
  const breakAll = p => { const st = stationOf(p); st.pads.forEach((pad, pi) => pad.rings.forEach((r, ri) => ringBreak(st.i, pi, ri))); };
  switch (k) {
    case 'puSpawn': if (need()) { PU.enabled = true; spawnPowerup(); } break;
    case 'meFall': if (need() && me.mode === 'play') { const g = DEBUG.god; DEBUG.god = false; me.kbx = 2; me.kbz = 0; startFall(me); DEBUG.god = g; } break;
    case 'meRing': if (need()) breakAll(me); break;
    case 'meHeat': if (need()) me.heat = 8; break;
    case 'meHeal': if (need()) { me.heat = 0; me.shieldE = 100; me.defl = DEFLECTS; restoreStation(stationOf(me)); } break;
    case 'meLife': if (need()) me.lives++; break;
    case 'meHit': if (need()) { const g = DEBUG.god; DEBUG.god = false; me.invuln = 0; hit(me, 1); DEBUG.god = g; } break;
    case 'rvFall': if (need()) rv.forEach(o => { if (o.mode === 'play') { o.kbx = 2; startFall(o); } }); break;
    case 'rvRing': if (need()) rv.forEach(breakAll); break;
    case 'rvHeat': if (need()) rv.forEach(o => o.heat = 8); break;
    case 'rvHit': if (need()) rv.forEach(o => { o.invuln = 0; hit(o, 0); }); break;
    case 'rvLife': if (need()) rv.forEach(o => o.lives = Math.min(o.lives, 1)); break;
    case 'win': if (need()) rv.forEach(o => { o.lives = 0; if (o.mode === 'play') startFall(o); else if (o.mode !== 'fall') o.mode = 'out'; }); break;
    case 'restart': if (state !== 'lobby') rematch(); else toast('START A MATCH FIRST', 1400); break;
    case 'nextArena': { const cur = state !== 'lobby' && lastCfg ? lastCfg.ar : S.arena; S.arena = (cur + 1) % (ARENAS.length - 1); toast(ARENAS[S.arena].name, 1400); if (state !== 'lobby' && lastCfg) { lastCfg.ar = S.arena; rematch(); } else renderLobby(); break; }
    case 'lobby': if (state !== 'lobby') quitToLobby(); break;
  }
  SFX.tick();
}
function debugTick(dt) {
  if (NET.room && (DEBUG.on || DEBUG.god || DEBUG.cpuFreeze || DEBUG.cpuHold || DEBUG.ts !== 1)) { DEBUG.god = DEBUG.cpuFreeze = DEBUG.cpuHold = false; DEBUG.ts = 1; if (DEBUG.on) dbgOpen(false); }
  if (!DEBUG.on) return;
  DEBUG._acc += dt; DEBUG._n++;
  if (DEBUG._acc < 0.25) return;
  DEBUG.fps = Math.round(DEBUG._n / DEBUG._acc); DEBUG._acc = 0; DEBUG._n = 0;
  const el = $('#dbgRead'); if (!el) return;
  if (!DEBUG.hud) { el.innerHTML = ''; return; }
  const row = p => { const st = STATIONS[p.slot]; const rs = st ? st.pads.map(pd => pd.rings.map(r => '■▒░·'[r.state]).join('')).join(' ') : '';
    return `<div><b style="color:${p.css}">${p.name}</b> ${p.kind === 'cpu' ? 'CPU' : ''} · ${p.mode.toUpperCase()} · lives ${p.lives} · overload ${Math.round(p.heat / 8 * 100)}% · discs ${p.discsHome} · shield ${p.defl} · ${p.weapon ? p.weapon.type + '×' + p.weapon.n : '—'} · pads ${rs}</div>`; };
  el.innerHTML = `<div>FPS ${DEBUG.fps} · ${state.toUpperCase()} · t ${matchT.toFixed(1)}s · arena ${LAYOUT && LAYOUT.id || S.arena} · discs in flight ${DISCS.filter(d => d.state !== 'home').length} · pickups ${PU.list.length}</div>` + players.map(row).join('');
}

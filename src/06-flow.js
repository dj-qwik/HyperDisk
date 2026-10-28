/* ================= HUD helpers ================= */
let toastT = null;
function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hide'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hide'), ms || 2600); }
const show = (sel, on) => { const e = $(sel); if (e) e.hidden = !on; };

/* ================= lobby ================= */
let DEMO = false;
const LOBBY = { mode: 'local', humans: [] };      // humans: { ctl: {type, idx}, how }
const CTL_LABEL = { kb1: 'KEYS 1 + MOUSE', kb2: 'KEYS 2', pad: 'CONTROLLER', touch: 'TOUCH', any: 'THIS DEVICE' };
function lobbyHas(type, idx) { return LOBBY.humans.some(h => h.ctl.type === type && (idx == null || h.ctl.idx === idx)); }
function lobbyJoin(type, idx) {
  if (LOBBY.mode !== 'local' || lobbyHas(type, idx) || LOBBY.humans.length >= 4) return;
  LOBBY.humans.push({ ctl: { type, idx } });
  if (LOBBY.humans.length + S.cpus > 4) S.cpus = Math.max(0, 4 - LOBBY.humans.length);
  SFX.join(); renderLobby();
}
function lobbyLeave(i) { if (i < 0 || i >= LOBBY.humans.length) return; LOBBY.humans.splice(i, 1); SFX.leave(); renderLobby(); }
function localRoster() {
  const hum = LOBBY.humans.slice(0, 4);
  let cpus = Math.min(S.cpus, 4 - hum.length);
  if (hum.length + cpus < 2) cpus = 2 - hum.length;
  const names = shuffle(CPU_NAMES.slice());
  return [...hum.map((h, i) => ({ kind: 'human', ctl: h.ctl, name: PNAME[i], peer: '' })), ...Array.from({ length: cpus }, (_, i) => ({ kind: 'cpu', ctl: null, name: names[i], peer: '' }))];
}
function slotCard(i, entry, how) {
  const c = entry ? PCSS[i] : 'var(--faint)';
  if (!entry) {
    const joinHow = LOBBY.mode === 'online' ? 'WAITING FOR A RUNNER' : IS_TOUCH ? 'TAP TO JOIN' : nextJoinHint();
    return `<div class="slot empty live" data-slot="${i}" style="--c:${c}"><div class="pn">P${i + 1}</div><div class="nm">OPEN</div><div class="how pulse">${joinHow}</div></div>`;
  }
  const x = entry.removable != null ? `<button class="x live" data-rm="${entry.removable}" title="Remove">×</button>` : '';
  return `<div class="slot on" style="--c:${c}"><div class="pn">P${i + 1}${entry.kind === 'cpu' ? ' · CPU' : ''}</div><div class="nm">${entry.name}</div><div class="how">${how}</div>${x}</div>`;
}
function nextJoinHint() {
  const opts = [];
  if (!lobbyHas('kb1')) opts.push('SPACE / CLICK'); if (!lobbyHas('kb2')) opts.push('/ KEY');
  opts.push('A ON A CONTROLLER');
  return 'PRESS ' + opts.join(' · ');
}
function renderLobby() {
  if (state !== 'lobby') return;
  const online = LOBBY.mode === 'online';
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === LOBBY.mode));
  show('#onlineBox', online); if (online) renderOnlineBox();
  let html = '';
  if (online && NET.room) {
    const ro = NET.role === 'host' ? hostLobbyRoster() : (NET.lobbyRo || []);
    for (let i = 0; i < 4; i++) {
      const r = ro[i];
      if (r) html += slotCard(i, { kind: r[1] === 'c' ? 'cpu' : 'human', name: r[2] }, r[1] === 'c' ? SKILLS[S.skill].name : (r[0] === NET.myPeer ? 'YOU' : 'ONLINE'));
      else html += slotCard(i, null);
    }
  } else if (online) {
    for (let i = 0; i < 4; i++) html += slotCard(i, null);
  } else {
    const ro = localRoster(), humans = LOBBY.humans.length;
    for (let i = 0; i < 4; i++) {
      const r = ro[i];
      if (r && r.kind === 'human') html += slotCard(i, { kind: 'human', name: r.name, removable: i }, CTL_LABEL[r.ctl.type] + (r.ctl.type === 'pad' ? ' ' + (r.ctl.idx + 1) : ''));
      else if (r && humans > 0) html += slotCard(i, { kind: 'cpu', name: r.name }, SKILLS[S.skill].name);
      else html += slotCard(i, null);
    }
  }
  $('#slots').innerHTML = html;
  const ar = ARENAS[S.arena];
  $('#vArena').textContent = ar.name; $('#arenaDesc').textContent = ar.desc;
  $('#vLives').textContent = S.lives; $('#vCpus').textContent = S.cpus; $('#vSkill').textContent = SKILLS[S.skill].name;
  $('#vQuality').textContent = QUALS[S.quality].name;
  const canStart = online ? (NET.room && NET.role === 'host') : true;
  const st = $('#start'); st.disabled = !canStart;
  $('#startSub').textContent = online ? (NET.room ? (NET.role === 'host' ? 'PRESS ENTER OR START' : 'WAITING FOR HOST') : 'HOST OR JOIN A ROOM') : (LOBBY.humans.length ? 'PRESS ENTER OR START' : 'OR WATCH CPUS FIGHT');
  $('#tip').innerHTML = '<b>PRO TIP</b>' + TIPS[(Math.floor(uTime.value / 8)) % TIPS.length];
}
const TIPS = [
  'The light blue line on the walls is your throwing height. The crosshair on it is exactly where your disc goes.',
  'Put the crosshair on a side wall to bank a disc round a deflector or a barrier.',
  'Raise the aim line past the top of the walls and it runs across the ceiling: bank off it to drop discs on them from above.',
  'Lower the line and your disc smashes the rings at their feet. Stand on a flashing ring and you are going down.',
  'Every hit raises OVERLOAD. The higher it is, the further the next hit sends you.',
  'Knocked to the edge? Push back toward your podium to save yourself.',
  'You get 7 deflects a life. Knock a rival out to refill them.',
  'Your disc can smash theirs out of the air, and you get it straight back.',
  'To jump to another platform, hold toward it at the edge for half a second. Nobody can hit you mid-leap.'
];
function renderOnlineBox() {
  const box = $('#onlineBox');
  if (!NET.room) {
    box.innerHTML = `<div class="label">ONLINE ROOM</div>
      <div class="row"><button class="btn live" id="bHost">HOST GAME</button><span class="small">or</span>
        <input id="codeIn" class="live" maxlength="4" placeholder="CODE" autocomplete="off"><button class="btn mag live" id="bJoin">JOIN</button></div>
      <div class="small">${NET.api ? 'Host makes a 4-letter code. Up to 4 runners per room.' : 'Online play needs the hosted site or the Claude app.'}</div>`;
    $('#bHost').onclick = () => netHost(); $('#bJoin').onclick = () => netEnter($('#codeIn').value, 'guest');
    $('#codeIn').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') netEnter($('#codeIn').value, 'guest'); };
  } else {
    const n = NET.role === 'host' ? 1 + NET.guestOrder.length : (NET.lobbyRo || []).filter(r => r[1] === 'h').length;
    box.innerHTML = `<div class="label">${NET.role === 'host' ? 'YOU ARE HOSTING' : 'JOINED ROOM'}</div>
      <div class="row"><span class="code">${NET.code.toUpperCase()}</span><span class="small">${n} runner${n === 1 ? '' : 's'} connected</span></div>
      <div class="row"><span class="small" style="flex:1">${NET.role === 'host' ? 'Share the code. CPU RIVALS fill the empty podiums.' : 'Waiting for the host to start.'}</span><button class="btn mag live" id="bLeave">LEAVE</button></div>`;
    $('#bLeave').onclick = () => netLeave();
  }
}
function changeOpt(o, d) {
  if (NET.room && NET.role === 'guest') return;
  if (o === 'arena') S.arena = (S.arena + d + ARENAS.length) % ARENAS.length;
  if (o === 'lives') S.lives = clamp(S.lives + d * 2, 1, 9);
  if (o === 'cpus') S.cpus = clamp(S.cpus + d, 0, LOBBY.mode === 'local' ? 4 - Math.max(0, LOBBY.humans.length) : 3);
  if (o === 'skill') S.skill = clamp(S.skill + d, 0, SKILLS.length - 1);
  if (o === 'guide') S.guide = !S.guide;
  if (o === 'quality') { S.quality = clamp(S.quality + d, 0, QUALS.length - 1); resize(); toast('GRAPHICS: ' + QUALS[S.quality].name + (S.quality !== store.get('quality', -1) ? ' · city density applies on reload' : '')); }
  for (const k of ['arena', 'lives', 'cpus', 'skill', 'guide', 'quality']) store.set(k, S[k]);
  SFX.tick(); renderLobby();
  if (o === 'arena' && state === 'lobby') startDemo();
}

/* ================= match flow ================= */
function teardownPlayers() {
  players.forEach(p => { disposePlayer(p); disposeGuide(p.guide); });
  players = []; DISCS.length = 0;
}
function startDemo() {
  teardownPlayers(); DEMO = true;
  const ar = ARENAS[S.arena].id === 'random' ? ARENAS[1] : ARENAS[S.arena];
  players = [makePlayer(0, 'cpu', null, 'DEMO-A'), makePlayer(1, 'cpu', null, 'DEMO-B')];
  players.forEach(p => { p.skill = 2; p.lives = 99; });
  buildStations(2, ar, players.map(p => p.color));
  players.forEach(p => { placeAtHome(p); p.mode = 'play'; });
  matchT = 0;
}
function toLobby() {
  state = 'lobby'; paused = false; winner = null;
  show('#lobby', true); show('#banner', false); show('#count', false); show('#intro', false); show('#pause', false); show('#results', false);
  show('#touch', false);
  if (document.pointerLockElement) document.exitPointerLock();
  startDemo(); buildViews();
  MUSIC.setMode('menu');
  renderLobby();
}
// cfg: { ro: [[peer, 'h'|'c', name]], ar, lv, sk, rid }
let lastCfg = null;
function startMatch(cfg) {
  lastCfg = cfg; teardownPlayers(); DEMO = false;
  const arena = ARENAS[cfg.ar];
  const online = !!NET.room;
  players = cfg.ro.map((r, i) => {
    const human = r[1] === 'h';
    let ctl = null;
    if (human) ctl = online ? { type: 'any' } : (cfg.ctls && cfg.ctls[i]) || { type: 'any' };
    const p = makePlayer(i, human ? 'human' : 'cpu', ctl, r[2]);
    p.peer = r[0] || null;
    p.local = online ? (human ? r[0] === NET.myPeer : NET.role === 'host') : true;
    if (human && !p.local) p.kind = 'human';
    p.lives = cfg.lv; p.skill = cfg.sk;
    return p;
  });
  buildStations(players.length, arena, players.map(p => p.color));
  players.forEach(p => { placeAtHome(p); p.mode = 'idle'; if (p.local && p.kind === 'human') p.guide = makeGuide(p); });
  state = 'intro'; phaseT = 0; matchT = 0; winner = null; endT = 0; paused = false;
  show('#lobby', false); show('#results', false); show('#pause', false);
  $('#bannerText').textContent = `${arena.name} · ${players.length === 2 ? 'DUEL' : 'FREE-FOR-ALL'} · ${cfg.lv} ${cfg.lv === 1 ? 'LIFE' : 'LIVES'}`; show('#banner', true);
  $('#introA').textContent = arena.name; $('#introB').textContent = players.length === 2 ? 'ONE ON ONE · LAST RUNNER STANDING' : players.length + '-WAY BRAWL · LAST RUNNER STANDING';
  $('#introVs').innerHTML = players.map(p => `<span style="color:${p.css}">${p.name}</span>`).join('<span style="color:#fff;opacity:.6">VS</span>');
  show('#intro', true);
  buildViews(); views.forEach(v => v.snap = true);
  show('#touch', IS_TOUCH && players.some(p => p.local && p.kind === 'human' && (p.ctl.type === 'touch' || p.ctl.type === 'any')));
  MUSIC.setMode('match'); SFX.whoosh();
}
function toCount() {
  if (state !== 'intro') return;
  state = 'count'; phaseT = 0; countN = -1; show('#intro', false);
  players.forEach(p => { if (p.mode === 'idle') p.mode = 'play'; });
}
function toPlay() {
  if (state === 'play') return;
  state = 'play'; phaseT = 0;
  const c = $('#count'); c.textContent = players.length === 2 ? 'DUEL!' : 'BRAWL!'; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); show('#count', true);
  setTimeout(() => { if (state === 'play') show('#count', false); }, 800);
  SFX.go();
}
function inGame(p) { return p.mode === 'play' || p.mode === 'idle' || p.lives > 0; }
function checkEnd() {
  if (players.some(p => p.mode === 'fall')) return;
  const left = players.filter(inGame);
  if (left.length <= 1) endMatch(left[0] ? left[0].slot : -1);
}
function endMatch(winSlot) {
  if (state === 'end') return;
  state = 'end'; endT = 0; winner = players[winSlot] || null;
  if (winner) { winner.mode = 'win'; winner.shieldOn = false; winner.charge = 0; }
  players.forEach(p => { if (p.guide) { p.guide.dots.visible = false; p.guide.ret.visible = false; } });
  show('#count', false);
  if (winner) { const c = $('#count'); c.textContent = winner.name + ' WINS'; c.style.color = winner.css; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); show('#count', true); setTimeout(() => { show('#count', false); c.style.color = ''; }, 1500); }
  SFX.win();
}
function showResults() {
  const w = winner;
  $('#winName').textContent = w ? w.name : 'DRAW'; $('#winName').style.color = w ? w.css : '#fff';
  $('#winSub').textContent = w ? (w.kind === 'cpu' ? 'The machine takes it.' : 'Last runner standing.') : 'Nobody kept their feet.';
  const rows = players.slice().sort((a, b) => (b === w) - (a === w) || b.lives - a.lives || b.stats.hits - a.stats.hits);
  $('#statTable').innerHTML = '<tr><th>RUNNER</th><th>HITS</th><th>RINGS</th><th>KOs</th><th>BLOCKS</th></tr>' +
    rows.map(p => `<tr><td style="color:${p.css}">${p.name}</td><td>${p.stats.hits}</td><td>${p.stats.rings}</td><td>${p.stats.kos}</td><td>${p.stats.defl}</td></tr>`).join('');
  const guest = NET.room && NET.role === 'guest';
  $('#bAgain').hidden = guest; $('#bLobby').textContent = guest ? 'LEAVE · B' : 'LOBBY · B';
  show('#results', true);
  if (document.pointerLockElement) document.exitPointerLock();
}
function rematch() {
  if (NET.room) { if (NET.role === 'host') netStartMatch(); return; }
  if (lastCfg) { const c = Object.assign({}, lastCfg); if (ARENAS[S.arena].id === 'random') c.ar = Math.floor(Math.random() * (ARENAS.length - 1)); startMatch(c); }
}
function startLocal() {
  if (state !== 'lobby') return;
  if (LOBBY.mode === 'online') { if (NET.room && NET.role === 'host') netStartMatch(); return; }
  const ro = localRoster();
  const ar = ARENAS[S.arena].id === 'random' ? Math.floor(Math.random() * (ARENAS.length - 1)) : S.arena;
  startMatch({ ro: ro.map(r => ['', r.kind === 'human' ? 'h' : 'c', r.name]), ctls: ro.map(r => r.ctl), ar, lv: S.lives, sk: S.skill });
}
function setPaused(on) {
  if (state === 'lobby' || state === 'boot') return;
  if (NET.room) { show('#pause', on); paused = false; if (on) $('#pause .small').textContent = 'Online matches keep running. Quit leaves the room.'; return; }
  paused = on; show('#pause', on); $('#pause .small').textContent = 'Press Start, Esc or P to resume.';
  if (on && document.pointerLockElement) document.exitPointerLock();
  MUSIC.duck(on);
}
function quitToLobby() { if (NET.room) netLeave(); else toLobby(); }

function updateFlow(dt) {
  phaseT += dt;
  if (state === 'play' || state === 'count' || state === 'intro') matchT += state === 'play' ? dt : 0;
  const guest = NET.room && NET.role === 'guest';     // guests follow the host's phase changes
  if (state === 'intro' && phaseT >= 3.2 && !guest) toCount();
  else if (state === 'count') { countTick(); if (phaseT >= 3 && !guest) toPlay(); }
  else if (state === 'play' && !guest) checkEnd();
  else if (state === 'end') { endT += dt; if (endT > 1.7 && $('#results').hidden) showResults(); }
}
function countTick() {
  const n = 3 - Math.floor(phaseT);
  if (n !== countN && n > 0) { countN = n; const c = $('#count'); c.textContent = n; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); show('#count', true); SFX.beep(); }
}

/* ================= how to play ================= */
let howPage = 0;
function showHow(on) { show('#howto', on); if (on) { setHowPage(0); SFX.tick(); } }
function setHowPage(i) {
  const pages = document.querySelectorAll('.howpage'); howPage = (i + pages.length) % pages.length;
  pages.forEach((e, k) => e.hidden = k !== howPage);
  document.querySelectorAll('#howTabs button').forEach((b, k) => b.classList.toggle('on', k === howPage));
  $('#howNext').textContent = howPage === pages.length - 1 ? 'DONE' : 'NEXT ›';
}

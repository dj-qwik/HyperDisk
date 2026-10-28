/* ================= DOM + device input ================= */
function isTyping(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); }
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Tab', 'Backquote', 'Period', 'Quote']);
window.addEventListener('keydown', e => {
  audioInit();
  if (isTyping(e)) return;
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  K[e.code] = true; if (!e.repeat) KP.add(e.code);
});
window.addEventListener('keyup', e => { K[e.code] = false; });
window.addEventListener('blur', () => { for (const k in K) K[k] = false; MOUSE.l = MOUSE.r = false; });
canvas.addEventListener('mousedown', e => {
  audioInit();
  if (state === 'lobby') return;
  const kbm = players.some(p => p.local && p.kind === 'human' && (p.ctl.type === 'kb1' || p.ctl.type === 'any'));
  if (!kbm || paused) return;
  if (!document.pointerLockElement && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) {} return; }
  if (e.button === 0) MOUSE.l = true; if (e.button === 2) MOUSE.r = true;
});
window.addEventListener('mouseup', e => { if (e.button === 0) MOUSE.l = false; if (e.button === 2) MOUSE.r = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => { MOUSE.locked = document.pointerLockElement === canvas; if (!MOUSE.locked) { MOUSE.l = MOUSE.r = false; } });
window.addEventListener('mousemove', e => { if (MOUSE.locked) MOUSE.dx += e.movementX || 0; });
window.addEventListener('wheel', e => { if (MOUSE.locked || state === 'play') MOUSE.wheel += Math.sign(e.deltaY); }, { passive: true });
window.addEventListener('resize', () => resize());
document.addEventListener('fullscreenchange', () => setTimeout(resize, 60));

function toggleFull() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) { toast('Fullscreen isn\'t available here.'); return; }
  try {
    const r = req.call(el, { navigationUI: 'hide' });
    if (r && r.then) r.then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => toast('Press ` or the ⛶ button for fullscreen.'));
  } catch (e) { toast('Press ` or the ⛶ button for fullscreen.'); }
}
$('#bFull').onclick = () => { audioInit(); toggleFull(); };
$('#bMusic').onclick = () => { audioInit(); MUSIC.setOn(!MUSIC.on); };
$('#bMusic').classList.toggle('off', !S.music);
$('#start').onclick = () => { audioInit(); if (state === 'lobby') startLocal(); };
$('#bResume').onclick = () => setPaused(false);
$('#bQuit').onclick = () => { setPaused(false); quitToLobby(); };
$('#bAgain').onclick = () => rematch();
$('#bLobby').onclick = () => quitToLobby();
document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => {
  audioInit(); const m = b.dataset.m; if (m === LOBBY.mode) return;
  if (m === 'local' && NET.room) netLeave();
  LOBBY.mode = m; SFX.tick(); renderLobby();
});
document.querySelectorAll('.pick button').forEach(b => b.onclick = () => { audioInit(); changeOpt(b.dataset.o, +b.dataset.d); });
$('#slots').addEventListener('click', e => {
  audioInit();
  const rm = e.target.closest('[data-rm]'); if (rm) { lobbyLeave(+rm.dataset.rm); return; }
  const s = e.target.closest('.slot.empty'); if (s && LOBBY.mode === 'local') { if (IS_TOUCH && !lobbyHas('touch')) lobbyJoin('touch'); else if (!lobbyHas('kb1')) lobbyJoin('kb1'); else if (!lobbyHas('kb2')) lobbyJoin('kb2'); }
});

/* ================= touch controls ================= */
const TOUCH = { mx: 0, mz: 0, dx: 0, fire: false, shield: false, hopP: false, lvlP: 0 };
{
  const box = $('#touch');
  box.innerHTML = `<div class="stick" hidden><i></i></div>
    <button class="tb big" data-b="fire" style="right:26px;bottom:34px">THROW</button>
    <button class="tb" data-b="shield" style="right:130px;bottom:22px">BLOCK</button>
    <button class="tb" data-b="hop" style="right:42px;bottom:140px">HOP</button>
    <button class="tb" data-b="up" style="right:140px;bottom:112px;width:50px;height:50px">▲</button>
    <button class="tb" data-b="dn" style="right:196px;bottom:80px;width:50px;height:50px">▼</button>`;
  const stick = box.querySelector('.stick'), knob = stick.querySelector('i');
  let stickId = null, sx = 0, sy = 0, lookId = null, lx = 0;
  box.addEventListener('pointerdown', e => {
    audioInit();
    const b = e.target.closest('[data-b]');
    if (b) {
      const k = b.dataset.b; b.classList.add('on');
      if (k === 'fire') TOUCH.fire = true; if (k === 'shield') TOUCH.shield = true; if (k === 'hop') TOUCH.hopP = true; if (k === 'up') TOUCH.lvlP = 1; if (k === 'dn') TOUCH.lvlP = -1;
      b.setPointerCapture(e.pointerId); b._pid = e.pointerId; return;
    }
    if (e.clientX < window.innerWidth * 0.45 && stickId == null) { stickId = e.pointerId; sx = e.clientX; sy = e.clientY; stick.hidden = false; stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; box.setPointerCapture(e.pointerId); }
    else if (lookId == null) { lookId = e.pointerId; lx = e.clientX; box.setPointerCapture(e.pointerId); }
  });
  box.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) { let dx = e.clientX - sx, dy = e.clientY - sy; const l = Math.hypot(dx, dy), m = 50; if (l > m) { dx *= m / l; dy *= m / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; TOUCH.mx = dx / m; TOUCH.mz = -dy / m; }
    else if (e.pointerId === lookId) { TOUCH.dx += e.clientX - lx; lx = e.clientX; }
  });
  const end = e => {
    if (e.pointerId === stickId) { stickId = null; stick.hidden = true; knob.style.transform = ''; TOUCH.mx = TOUCH.mz = 0; }
    if (e.pointerId === lookId) lookId = null;
    box.querySelectorAll('[data-b]').forEach(b => { if (b._pid === e.pointerId) { b.classList.remove('on'); b._pid = null; if (b.dataset.b === 'fire') TOUCH.fire = false; if (b.dataset.b === 'shield') TOUCH.shield = false; } });
  };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
}

// the "any" controller (online, or a lone player): keyboard 1 + mouse + every pad + touch, merged
const _readHumanBase = readHuman;
readHuman = function (p, dt) {
  if (!p.ctl || p.ctl.type !== 'any') return _readHumanBase(p, dt);
  const parts = [_readHumanBase({ ctl: { type: 'kb1' } }, dt), _readHumanBase({ ctl: { type: 'kb2' } }, dt), IS_TOUCH ? _readHumanBase({ ctl: { type: 'touch' } }, dt) : null];
  for (let i = 0; i < pads.length; i++) if (pads[i]) parts.push(_readHumanBase({ ctl: { type: 'pad', idx: i } }, dt));
  const o = { mx: 0, mz: 0, aim: 0, aimAbs: 0, lvl: 0, fire: false, shield: false, hop: false, recall: false, analog: false };
  for (const q of parts) {
    if (!q) continue;
    if (Math.abs(q.mx) + Math.abs(q.mz) > Math.abs(o.mx) + Math.abs(o.mz)) { o.mx = q.mx; o.mz = q.mz; }
    if (Math.abs(q.aim) > Math.abs(o.aim)) { o.aim = q.aim; o.analog = q.analog; }
    o.aimAbs += q.aimAbs; o.lvl += q.lvl; o.fire = o.fire || q.fire; o.shield = o.shield || q.shield; o.hop = o.hop || q.hop; o.recall = o.recall || q.recall;
  }
  o.lvl = clamp(o.lvl, -1, 1);
  return o;
};

/* ================= menu & system input (keyboard + every controller) ================= */
function anyPadHit(b) { for (let i = 0; i < padEdges.length; i++) if (padHit(i, b)) return i; return -1; }
function handleSystemInput() {
  if (KP.has('Backquote')) toggleFull();
  if (KP.has('KeyM') && !(state === 'lobby' && document.activeElement && document.activeElement.id === 'codeIn')) MUSIC.setOn(!MUSIC.on);
  const back = anyPadHit(8); if (back >= 0) toggleFull();
  if (state === 'lobby') {
    if (LOBBY.mode === 'local') {
      if (KP.has('Space')) lobbyJoin('kb1');
      if (KP.has('Slash')) lobbyJoin('kb2');
      for (let i = 0; i < padEdges.length; i++) {
        if (padHit(i, 0)) lobbyJoin('pad', i);
        if (padHit(i, 1)) { const k = LOBBY.humans.findIndex(h => h.ctl.type === 'pad' && h.ctl.idx === i); if (k >= 0) lobbyLeave(k); }
      }
      if (KP.has('Backspace')) { for (let k = LOBBY.humans.length - 1; k >= 0; k--) if (LOBBY.humans[k].ctl.type !== 'pad') { lobbyLeave(k); break; } }
    }
    if (KP.has('Enter') || KP.has('NumpadEnter') || anyPadHit(9) >= 0) startLocal();
    if (anyPadHit(5) >= 0) changeOpt('arena', 1); if (anyPadHit(4) >= 0) changeOpt('arena', -1);
    if (anyPadHit(15) >= 0) changeOpt('cpus', 1); if (anyPadHit(14) >= 0) changeOpt('cpus', -1);
    if (anyPadHit(12) >= 0) changeOpt('lives', 1); if (anyPadHit(13) >= 0) changeOpt('lives', -1);
    if (anyPadHit(3) >= 0) changeOpt('skill', 1);
    return;
  }
  if (!$('#results').hidden) {
    if (KP.has('Enter') || anyPadHit(0) >= 0) rematch();
    else if (KP.has('Escape') || KP.has('Backspace') || anyPadHit(1) >= 0) quitToLobby();
    return;
  }
  if (KP.has('Escape') || KP.has('KeyP') || anyPadHit(9) >= 0) { if (!(KP.has('Escape') && MOUSE.locked)) setPaused($('#pause').hidden); }
  if (!$('#pause').hidden) { if (anyPadHit(0) >= 0) setPaused(false); else if (anyPadHit(1) >= 0 && paused) { setPaused(false); quitToLobby(); } }
}

/* ================= render ================= */
function render(dt) {
  renderer.shadowMap.needsUpdate = true;
  const W = window.innerWidth, H = window.innerHeight;
  const postOK = sceneRT && bloomPass && finalQuad;
  for (let i = 0; i < views.length; i++) {
    const v = views[i];
    const x = Math.round(v.x * pixelRatio), w = Math.round(v.w * pixelRatio), h = Math.round(v.h * pixelRatio), y = DH - Math.round((v.y + v.h) * pixelRatio);
    FX.sparks.mat.uniforms.uPR.value = pixelRatio * v.h / 720; CITY.dust.uniforms.uPR.value = pixelRatio * v.h / 720;
    if (postOK) { sceneRT.viewport.set(x, y, w, h); sceneRT.scissor.set(x, y, w, h); sceneRT.scissorTest = true; renderer.setRenderTarget(sceneRT); }
    else { renderer.setRenderTarget(null); renderer.setScissorTest(true); renderer.setViewport(v.x, H - v.y - v.h, v.w, v.h); renderer.setScissor(v.x, H - v.y - v.h, v.w, v.h); }
    renderer.render(scene, v.cam);
    if (i === 0) renderer.shadowMap.needsUpdate = false;
  }
  if (!postOK) { renderer.setScissorTest(false); return; }
  sceneRT.scissorTest = false; sceneRT.viewport.set(0, 0, DW, DH); sceneRT.scissor.set(0, 0, DW, DH);
  bloomPass.render(renderer, null, sceneRT, dt, false);
  const U = finalMat.uniforms; U.tDiffuse.value = sceneRT.texture; U.uNV.value = views.length;
  views.forEach((v, i) => { U.uViews.value[i].set(v.x / W, (H - v.y - v.h) / H, v.w / W, v.h / H); U.uFlash.value[i].copy(v.flash); });
  renderer.setRenderTarget(null); finalQuad.render(renderer);
}

/* ================= main loop ================= */
let lastNow = 0, booted = false;
const TEST = /[?&]test\b/.test(location.search || '');
function tick(dt, doRender) {
  pollPads(); handleSystemInput();
  uTime.value += dt; finalMat.uniforms.uTime.value = uTime.value;
  const sdt = paused ? 0 : dt;
  if (sdt > 0) {
    netRecv(sdt);
    updateFlow(sdt);
    const T = DEMO ? uTime.value : matchT;
    updateStations(T, sdt); WALLFW.update(T, sdt);
    for (const p of players) {
      if (p.local) { const inp = p.kind === 'cpu' ? botInput(p, sdt) : readHuman(p, sdt); stepPlayer(p, inp, sdt); }
      else remoteBodyStep(p, sdt);
    }
    for (const d of DISCS) updateDisc(d, sdt);
    for (const d of DISCS) updateDiscVisual(d, sdt);
    for (const p of players) { poseRunner(p, sdt); p.rig.root.position.set(p.x, p.y, p.z); p.rig.root.rotation.y = p.yaw; if (p.guide) updateGuide(p, sdt); }
    updateSparks(sdt); updateRings(sdt); updateShards(sdt);
    for (const f of anim) f(uTime.value, sdt);
    if (state === 'lobby' && Math.floor(uTime.value / 8) !== Math.floor((uTime.value - sdt) / 8)) renderLobby();
  }
  for (const v of views) { updateView(v, dt); if (doRender) updateHud(v); }
  netTick();
  if (doRender) render(dt);
  KP.clear(); MOUSE.dx = 0; MOUSE.wheel = 0;
  if (!booted && doRender) { booted = true; setTimeout(() => $('#boot').classList.add('gone'), 200); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000 || 0.016)); lastNow = now;
  tick(dt, true);
}

// debug/test hook
window.__hd = { step(n, dt, r) { for (let i = 0; i < n; i++) tick(dt || 1 / 60, r !== false && i === n - 1); return state; }, press(c) { K[c] = true; KP.add(c); }, release(c) { K[c] = false; }, get state() { return state; }, get players() { return players; }, get matchT() { return matchT; }, get views() { return views; }, STATIONS, DISCS, WALLFW, S, FALLS, startLocal, lobbyJoin, toLobby, startMatch, changeOpt, applyHit, throwDisc, LOBBY, NET, netHost, netEnter, netStartMatch };

resize();
toLobby();
if (TEST) tick(1 / 60, true); else requestAnimationFrame(frame);

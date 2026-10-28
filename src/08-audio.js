/* ================= audio: synthesized effects ================= */
let AC = null, MASTER = null, SFXBUS = null, MUSBUS = null, VERB = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => {}); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; return; }
  MASTER = AC.createGain(); MASTER.gain.value = 0.9;
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  MASTER.connect(comp); comp.connect(AC.destination);
  SFXBUS = AC.createGain(); SFXBUS.gain.value = 0.75; SFXBUS.connect(MASTER);
  MUSBUS = AC.createGain(); MUSBUS.gain.value = S.music ? 0.5 : 0; MUSBUS.connect(MASTER);
  // a big dark hall reverb from a decaying noise impulse
  VERB = AC.createConvolver(); const len = AC.sampleRate * 2.6, ir = AC.createBuffer(2, len, AC.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  VERB.buffer = ir; const vg = AC.createGain(); vg.gain.value = 0.28; VERB.connect(vg); vg.connect(MASTER);
  MUSIC.boot();
}
let NOISE = null;
function noiseBuf() { if (NOISE) return NOISE; const len = AC.sampleRate; NOISE = AC.createBuffer(1, len, AC.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return NOISE; }
// play a tone; f0 -> f1 sweep, shaped gain, optional filter and reverb send
function tone(o) {
  if (!AC) return; const t = AC.currentTime + (o.delay || 0);
  const osc = AC.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f0, t);
  if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + (o.sweep || o.dur));
  if (o.detune) osc.detune.value = o.detune;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.att || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  let node = osc; if (o.lp) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 1; osc.connect(f); node = f; }
  node.connect(g);
  if (o.pan != null && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = o.pan; g.connect(p); p.connect(o.bus || SFXBUS); } else g.connect(o.bus || SFXBUS);
  if (o.verb) { const s = AC.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(VERB); }
  osc.start(t); osc.stop(t + o.dur + 0.05);
}
function noise(o) {
  if (!AC) return; const t = AC.currentTime + (o.delay || 0);
  const src = AC.createBufferSource(); src.buffer = noiseBuf(); src.loop = true;
  const f = AC.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f0 || 1000, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur); f.Q.value = o.q || 1;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.att || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f); f.connect(g); g.connect(o.bus || SFXBUS); if (o.verb) { const s = AC.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(VERB); }
  src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.05);
}
// how loud/where is a world position, relative to the closest local view
function spatial(pos) {
  if (!pos || !views.length) return { v: 1, pan: 0 };
  let best = null, bd = 1e9; for (const v of views) { const d = v.cam.position.distanceTo(pos); if (d < bd) { bd = d; best = v; } }
  const c = best.cam; _tmp.copy(pos).sub(c.position); const right = _tmp2.set(1, 0, 0).applyQuaternion(c.quaternion);
  return { v: clamp(1.4 - bd / 40, 0.18, 1), pan: clamp(_tmp.normalize().dot(right), -0.8, 0.8) * (views.length > 1 ? 0.4 : 1) };
}
const SFX = {
  tick() { tone({ f0: 1600, f1: 1200, dur: 0.05, vol: 0.05, type: 'square', lp: 4000 }); },
  join() { tone({ f0: 440, f1: 880, dur: 0.16, vol: 0.12, type: 'sawtooth', lp: 2400 }); tone({ f0: 660, f1: 1320, dur: 0.2, vol: 0.08, type: 'square', lp: 3000, delay: 0.06 }); },
  leave() { tone({ f0: 660, f1: 220, dur: 0.2, vol: 0.1, type: 'sawtooth', lp: 1800 }); },
  whoosh() { noise({ f0: 300, f1: 3000, dur: 1.2, vol: 0.12, q: 0.8, verb: 0.4 }); tone({ f0: 55, f1: 110, dur: 1.4, vol: 0.2, type: 'sawtooth', lp: 400 }); },
  beep() { tone({ f0: 880, dur: 0.18, vol: 0.14, type: 'square', lp: 3000, verb: 0.3 }); },
  go() { [523, 659, 784, 1046].forEach((f, i) => tone({ f0: f, dur: 0.6, vol: 0.09, type: 'sawtooth', lp: 3500, verb: 0.4, delay: i * 0.012 })); noise({ f0: 2000, f1: 500, dur: 0.5, vol: 0.12, verb: 0.3 }); },
  win() { [392, 523, 659, 784, 1046].forEach((f, i) => tone({ f0: f, dur: 0.9, vol: 0.07, type: 'sawtooth', lp: 3000, verb: 0.5, delay: i * 0.09 })); },
  throwDisc(power, p) { const s = spatial(p && _tmp.set(p.x, p.y + 1.4, p.z).clone()); noise({ f0: 900, f1: 4500, dur: 0.22, vol: 0.22 * s.v, q: 1.4 }); tone({ f0: power ? 220 : 330, f1: power ? 1400 : 1100, dur: 0.24, vol: (power ? 0.16 : 0.1) * s.v, type: 'sawtooth', lp: 2600, pan: s.pan }); if (power) tone({ f0: 55, f1: 40, dur: 0.4, vol: 0.25 * s.v, type: 'sine' }); },
  charge(p) { tone({ f0: 200, f1: 600, sweep: D_CHARGE, dur: D_CHARGE + 0.05, vol: 0.05, type: 'sawtooth', lp: 1500 }); },
  charged(p) { tone({ f0: 1200, dur: 0.12, vol: 0.08, type: 'square', lp: 5000 }); tone({ f0: 1800, dur: 0.12, vol: 0.06, type: 'square', lp: 5000, delay: 0.05 }); },
  empty() { tone({ f0: 160, dur: 0.07, vol: 0.08, type: 'square', lp: 900 }); },
  bounce(pos) { const s = spatial(pos); tone({ f0: 1900 + Math.random() * 500, f1: 700, dur: 0.18, vol: 0.12 * s.v, type: 'triangle', verb: 0.35, pan: s.pan }); noise({ f0: 4000, dur: 0.06, vol: 0.12 * s.v, q: 2 }); },
  block(pos) { const s = spatial(pos); noise({ f0: 1200, f1: 200, dur: 0.35, vol: 0.28 * s.v, q: 0.7, verb: 0.3 }); tone({ f0: 300, f1: 60, dur: 0.3, vol: 0.18 * s.v, type: 'square', lp: 900 }); },
  ringHit() { tone({ f0: 1400, f1: 300, dur: 0.25, vol: 0.12, type: 'square', lp: 3000 }); noise({ f0: 2600, dur: 0.12, vol: 0.15, q: 3 }); },
  ringGone() { for (let i = 0; i < 5; i++) tone({ f0: 900 - i * 140, dur: 0.07, vol: 0.08, type: 'square', lp: 2500, delay: i * 0.045 }); noise({ f0: 800, f1: 120, dur: 0.5, vol: 0.18, verb: 0.4 }); },
  hit(pos, power) { const s = spatial(pos); tone({ f0: 140, f1: 45, dur: 0.35, vol: 0.4 * s.v, type: 'sine' }); noise({ f0: 1800, f1: 300, dur: 0.25, vol: 0.3 * s.v, q: 0.9, verb: 0.3 }); tone({ f0: 900, f1: 200, dur: 0.15, vol: 0.12 * s.v, type: 'sawtooth', lp: 2000, pan: s.pan }); if (power) tone({ f0: 70, f1: 30, dur: 0.6, vol: 0.35, type: 'sawtooth', lp: 300 }); },
  hurt(p) { tone({ f0: 300, f1: 120, dur: 0.18, vol: 0.06, type: 'square', lp: 1200 }); },
  deflect(pos) { const s = spatial(pos); tone({ f0: 2400, f1: 3600, dur: 0.22, vol: 0.12 * s.v, type: 'sine', verb: 0.4, pan: s.pan }); tone({ f0: 1200, f1: 1800, dur: 0.22, vol: 0.1 * s.v, type: 'triangle', verb: 0.3 }); noise({ f0: 5000, dur: 0.08, vol: 0.12 * s.v, q: 2 }); },
  clash(pos) { const s = spatial(pos); tone({ f0: 2200, f1: 900, dur: 0.3, vol: 0.14 * s.v, type: 'square', lp: 4000, verb: 0.4 }); tone({ f0: 3100, f1: 1300, dur: 0.3, vol: 0.1 * s.v, type: 'square', lp: 4000 }); noise({ f0: 3000, dur: 0.15, vol: 0.2 * s.v, q: 1.5 }); },
  shieldOn() { tone({ f0: 300, f1: 900, dur: 0.15, vol: 0.06, type: 'sawtooth', lp: 1600 }); },
  shieldBreak() { noise({ f0: 3000, f1: 400, dur: 0.5, vol: 0.3, q: 0.8, verb: 0.4 }); tone({ f0: 800, f1: 90, dur: 0.5, vol: 0.15, type: 'sawtooth', lp: 2000 }); },
  hop() { tone({ f0: 300, f1: 700, dur: 0.12, vol: 0.05, type: 'sine' }); noise({ f0: 600, dur: 0.1, vol: 0.06 }); },
  land() { noise({ f0: 300, dur: 0.08, vol: 0.07 }); tone({ f0: 90, f1: 60, dur: 0.1, vol: 0.1 }); },
  recall() { tone({ f0: 1200, f1: 400, dur: 0.25, vol: 0.06, type: 'sawtooth', lp: 2000 }); },
  catchDisc() { tone({ f0: 2000, dur: 0.05, vol: 0.05, type: 'square', lp: 5000 }); tone({ f0: 120, dur: 0.06, vol: 0.12 }); },
  fall() { tone({ f0: 900, f1: 60, dur: 1.3, vol: 0.14, type: 'sawtooth', lp: 1600, verb: 0.5 }); noise({ f0: 1500, f1: 200, dur: 1.2, vol: 0.12, verb: 0.4 }); },
  shatter() { noise({ f0: 2500, f1: 300, dur: 0.9, vol: 0.32, q: 0.6, verb: 0.6 }); tone({ f0: 80, f1: 30, dur: 0.9, vol: 0.35, type: 'sine' }); for (let i = 0; i < 6; i++) tone({ f0: 1200 + Math.random() * 2000, dur: 0.05, vol: 0.05, type: 'square', delay: Math.random() * 0.3 }); },
  powerup() { [523, 784, 1046, 1568].forEach((f, i) => tone({ f0: f, dur: 0.18, vol: 0.08, type: 'square', lp: 5000, delay: i * 0.05, verb: 0.3 })); },
  puSpawn() { tone({ f0: 1200, f1: 2400, dur: 0.25, vol: 0.05, type: 'sine', verb: 0.5 }); tone({ f0: 1800, f1: 3600, dur: 0.25, vol: 0.03, type: 'sine', delay: 0.08, verb: 0.5 }); },
  split(pos) { const s = spatial(pos); [700, 900, 1100].forEach((f, i) => tone({ f0: f, f1: f * 1.6, dur: 0.12, vol: 0.07 * s.v, type: 'sawtooth', lp: 3000, delay: i * 0.02 })); },
  explode(pos) { const s = spatial(pos); noise({ f0: 900, f1: 80, dur: 0.7, vol: 0.45 * s.v, q: 0.5, verb: 0.5 }); tone({ f0: 90, f1: 28, dur: 0.6, vol: 0.5 * s.v, type: 'sine' }); },
  seekLock() { for (let i = 0; i < 3; i++) tone({ f0: 1760, dur: 0.07, vol: 0.09, type: 'square', lp: 6000, delay: i * 0.1 }); },
  seekBeep(pos) { const s = spatial(pos); tone({ f0: 2200, dur: 0.04, vol: 0.05 * s.v, type: 'square', lp: 6000, pan: s.pan }); },
  respawn() { [330, 494, 659, 988].forEach((f, i) => tone({ f0: f, dur: 0.25, vol: 0.06, type: 'triangle', delay: i * 0.05, verb: 0.3 })); }
};

/* ================= music ================= */
// Soundtrack slots: drop mp3s in /music and list them here (THEME loops in menus, TRACKS shuffle in matches).
// Until then a built-in darksynth sequencer plays: a slow pad in menus, a driving 4/4 in matches.
const THEME = { file: 'hyper_disc.mp3', name: 'Hyper Disc' };
const TRACKS = [
  { file: 'heads_up.mp3', name: 'Heads Up' },
  { file: 'life_on_the_grid.mp3', name: 'Life on the Grid' },
  { file: 'showdown.mp3', name: 'Showdown' },
  { file: 'synergies.mp3', name: 'Synergies' }
];
const MUSIC = {
  mode: 'menu', on: S.music, step: 0, next: 0, timer: null, bar: 0, audio: null, ducked: false,
  boot() { if (this.timer) return; this.next = AC.currentTime + 0.1; this.timer = setInterval(() => this.schedule(), 60); this.apply(); if (THEME || TRACKS.length) this.playFile(); },
  setOn(on) { this.on = on; S.music = on; store.set('music', on); this.apply(); $('#bMusic').classList.toggle('off', !on); },
  duck(on) { this.ducked = on; this.apply(); },
  apply() { if (!AC) return; const v = this.on ? (this.ducked ? 0.15 : 0.5) : 0; MUSBUS.gain.setTargetAtTime(v, AC.currentTime, 0.3); },
  setMode(m) { if (this.mode === m) return; this.mode = m; this.step = 0; this.bar = 0; if (THEME || TRACKS.length) this.playFile(); },
  // match tracks come from a shuffled deck, so none repeats until every one has played
  deck: [], lastName: null,
  nextTrack() { if (!this.deck.length) { this.deck = shuffle(TRACKS.slice()); if (this.deck.length > 1 && this.deck[0].name === this.lastName) this.deck.push(this.deck.shift()); } return this.deck.shift(); },
  // songs stream through the same music bus as the synth, so mute, pause-duck and volume all apply; tracks crossfade
  cur: null,
  playFile() {
    if (!AC) return;
    const src = this.mode === 'menu' ? THEME : this.nextTrack(); if (!src) return;
    if (this.cur && this.cur.src === src && this.mode === 'menu') return;
    const now = AC.currentTime, old = this.cur;
    if (old) { old.g.gain.cancelScheduledValues(now); old.g.gain.setValueAtTime(old.g.gain.value, now); old.g.gain.linearRampToValueAtTime(0, now + 1.4); setTimeout(() => { try { old.el.pause(); old.node.disconnect(); } catch (e) {} }, 1600); }
    try {
      const el = new Audio('music/' + src.file); el.loop = this.mode === 'menu'; el.preload = 'auto';
      const node = AC.createMediaElementSource(el), g = AC.createGain(); g.gain.value = 0; node.connect(g); g.connect(MUSBUS);
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.85, now + (old ? 1.2 : 0.4));
      const entry = { el, node, g, src }; this.cur = entry; this.lastName = src.name;
      el.addEventListener('ended', () => { if (this.cur === entry) this.playFile(); });
      el.play().catch(() => {});
      if (this.mode === 'match' && this.on) toast('♪ ' + src.name);
    } catch (e) {}
  },
  schedule() {
    if (!AC || THEME || TRACKS.length) return;
    const spb = 60 / (this.mode === 'menu' ? 84 : 118) / 4;
    while (this.next < AC.currentTime + 0.25) { this.play16(this.step, this.next, spb); this.next += spb; this.step = (this.step + 1) % 16; if (this.step === 0) this.bar = (this.bar + 1) % 8; }
  },
  // A minor: Am - F - C - G, with the bass riding sixteenths
  play16(s, t, spb) {
    const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], ch = prog[Math.floor(this.bar / 2) % 4], root = ch[0] - 24;
    const hz = n => 440 * Math.pow(2, (n - 69) / 12);
    const v = (o) => Object.assign({ bus: MUSBUS }, o);
    if (this.mode === 'menu') {
      if (s === 0 && this.bar % 2 === 0) ch.forEach((n, i) => { tone(v({ f0: hz(n), dur: spb * 32, vol: 0.05, type: 'sawtooth', lp: 900 + 300 * Math.sin(this.bar), att: 1.2, detune: (i - 1) * 7, verb: 0.6, delay: t - AC.currentTime })); tone(v({ f0: hz(n + 12), dur: spb * 32, vol: 0.02, type: 'triangle', att: 1.6, delay: t - AC.currentTime, verb: 0.6 })); });
      if (s % 4 === 0) { const arp = [0, 7, 12, 15][(s / 4 + this.bar) % 4]; tone(v({ f0: hz(ch[0] + arp + 12), dur: spb * 3, vol: 0.03, type: 'square', lp: 2200, verb: 0.7, delay: t - AC.currentTime })); }
      if (s === 0) tone(v({ f0: hz(root), dur: spb * 15, vol: 0.09, type: 'sine', att: 0.2, delay: t - AC.currentTime }));
      return;
    }
    const d = t - AC.currentTime;
    if (s % 4 === 0) { tone(v({ f0: 150, f1: 42, sweep: 0.12, dur: 0.32, vol: 0.5, type: 'sine', delay: d })); }
    if (s === 4 || s === 12) { noise(v({ f0: 1800, dur: 0.18, vol: 0.22, q: 0.7, delay: d, verb: 0.25 })); tone(v({ f0: 220, f1: 140, dur: 0.12, vol: 0.12, type: 'triangle', delay: d })); }
    noise(v({ f0: 9000, ft: 'highpass', dur: s % 2 ? 0.03 : 0.05, vol: s % 4 === 2 ? 0.07 : 0.035, delay: d }));
    const bn = [0, 0, 12, 0, 0, 12, 0, 7][s % 8]; tone(v({ f0: hz(root + bn), dur: spb * 0.9, vol: 0.12, type: 'sawtooth', lp: 500 + 400 * ((s % 8) / 8), q: 6, delay: d }));
    if (s === 0 && this.bar % 2 === 0) ch.forEach((n, i) => tone(v({ f0: hz(n), dur: spb * 30, vol: 0.028, type: 'sawtooth', lp: 1400, att: 0.4, detune: (i - 1) * 9, verb: 0.5, delay: d })));
    if (this.bar % 4 >= 2 && s % 2 === 0) { const arp = [0, 3, 7, 12, 7, 3, 12, 15][(s / 2) % 8]; tone(v({ f0: hz(ch[0] + 12 + arp), dur: spb * 1.4, vol: 0.035, type: 'square', lp: 3000, verb: 0.4, delay: d })); }
  }
};

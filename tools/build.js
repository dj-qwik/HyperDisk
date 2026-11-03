// Builds public/index.html (the whole game in one page) from src/page.html and the src/*.js parts.
//   node tools/build.js
// The game code runs once the display fonts have loaded (or after 2.5 s), so the canvas-drawn
// signage and podium markings use the right typeface.
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'src');
const page = fs.readFileSync(path.join(src, 'page.html'), 'utf8');
const parts = fs.readdirSync(src).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
let code = parts.map(f => `/* ---------- ${f} ---------- */\n` + fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
code = code.replace(/^'use strict';\n/m, '');
const wrapped = `(function () {
  function fail(msg) { var b = document.getElementById('boot'); if (b) { b.classList.remove('gone'); b.innerHTML = '<div style="max-width:560px;padding:20px;text-align:center;line-height:1.9">HYPER DISC COULDN\\'T START<br><span style="color:#8b9cc4;letter-spacing:.08em;font-size:12px;font-family:Rajdhani,sans-serif">' + msg + '</span></div>'; } }
  function boot() {
    'use strict';
    if (!window.THREE) { fail('The 3D engine did not load. Check your connection and reload.'); return; }
    try {
//__GAME__
    } catch (e) { console.error(e); fail(String(e && e.message || e)); }
  }
  var done = false; function go() { if (done) return; done = true; boot(); }
  try {
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('900 40px Orbitron'), document.fonts.load('700 20px Orbitron'), document.fonts.load('600 16px Rajdhani')]).then(go, go);
      setTimeout(go, 2500);
    } else go();
  } catch (e) { go(); }
})();`;
const out = page.replace('/*__SCRIPT__*/', () => wrapped.replace('//__GAME__', () => code));
fs.writeFileSync(path.join(root, 'public', 'index.html'), out);
// optional: the same page as a Claude artifact body (the artifact host supplies doctype/head/body)
const ai = process.argv.indexOf('--artifact');
if (ai > 0 && process.argv[ai + 1]) {
  let a = out.replace(/<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '').replace(/<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*/i, '')
    .replace(/<\/head>\s*<body>\s*/i, '\n').replace(/<\/body>\s*<\/html>\s*$/i, '\n');
  fs.writeFileSync(process.argv[ai + 1], a); console.log('wrote artifact page', process.argv[ai + 1]);
}
// optional: an itch.io upload. node tools/build.js --itch [game-server-host]
// writes dist/itch/ (index.html at the root + music/) and zips it to dist/hyperdisc-itch.zip.
// Online play connects to the Render server, since itch.io only hosts the static files.
const ii = process.argv.indexOf('--itch');
if (ii > 0) {
  const host = (process.argv[ii + 1] && !process.argv[ii + 1].startsWith('--') ? process.argv[ii + 1] : 'hyperdisc.onrender.com').replace(/^(https?|wss?):\/\//, '').replace(/\/.*$/, '');
  const dir = path.join(root, 'dist', 'itch');
  fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true }); fs.mkdirSync(path.join(dir, 'music'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), out.replace('<head>', () => `<head>\n<script>window.HD_SERVER = 'wss://${host}/ws';</script>`));
  for (const f of fs.readdirSync(path.join(root, 'public', 'music'))) fs.copyFileSync(path.join(root, 'public', 'music', f), path.join(dir, 'music', f));
  require('child_process').execSync('zip -qr ../hyperdisc-itch.zip .', { cwd: dir });
  console.log('wrote dist/hyperdisc-itch.zip (online play via wss://' + host + '/ws)');
}
console.log('built public/index.html', (out.length / 1024).toFixed(0) + ' KB from', parts.length, 'parts');

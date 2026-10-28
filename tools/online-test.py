"""Two browser tabs in test mode (frames stepped by hand, real time passing for the network):
one hosts a room, the other joins with the code; play and check that each sees the other."""
import json, os, sys, time
from playwright.sync_api import sync_playwright
THREE = os.environ.get('THREE_DIR')
OUT = os.environ.get('OUT', 'online')
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3999/?test'
def route(r):
    u = r.request.url
    if THREE and 'cdn.jsdelivr.net/npm/three@0.147.0/' in u:
        p = os.path.join(THREE, u.split('three@0.147.0/')[1])
        return r.fulfill(path=p, content_type='application/javascript') if os.path.exists(p) else r.abort()

    return r.continue_()
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pages = []
    for name in ['host', 'guest']:
        ctx = b.new_context(viewport={'width': 640, 'height': 400})
        pg = ctx.new_page(); pg.route('**/*', route)
        logs = []; pg.on('console', lambda m, logs=logs: logs.append(m.text)); pg.on('pageerror', lambda e, logs=logs: logs.append('PAGEERROR ' + str(e)))
        pg.goto(URL, timeout=120000); pages.append((name, pg, logs))
    host, guest = pages[0][1], pages[1][1]
    time.sleep(3)
    def run(seconds, extra=None):
        t0 = time.time(); n = 0
        while time.time() - t0 < seconds:
            if extra: extra(n)
            host.evaluate("__hd.step(3, 1/60, false)"); guest.evaluate("__hd.step(3, 1/60, false)"); n += 1
        return n
    host.evaluate("document.querySelector('#modeSeg button[data-m=online]').click(); __hd.netHost()")
    run(1.5)
    code = host.evaluate("__hd.NET.code"); print('room code', code)
    guest.evaluate(f"document.querySelector('#modeSeg button[data-m=online]').click(); __hd.netEnter('{code}', 'guest')")
    run(2.5)
    print('host lobby slots:', host.evaluate("[...document.querySelectorAll('#slots .slot .nm')].map(e=>e.textContent)"))
    print('guest lobby slots:', guest.evaluate("[...document.querySelectorAll('#slots .slot .nm')].map(e=>e.textContent)"))
    host.evaluate("__hd.S.cpus = 0; __hd.netStartMatch()")
    run(1.5)
    for nm, pg, _ in pages: print(nm, pg.evaluate("[__hd.state, __hd.players.map(p => [p.name, p.kind, p.local, p.mode])]"))
    n = run(7.5)
    print('ticks', n)
    for nm, pg, _ in pages: print(nm, 'after intro', pg.evaluate("[__hd.state, +__hd.matchT.toFixed(1), __hd.players.map(p => [p.name, p.local, p.mode, +p.x.toFixed(1), +p.z.toFixed(1)])]"))
    # guest walks right then throws
    guest.evaluate("__hd.press('KeyD')"); run(1.5); guest.evaluate("__hd.release('KeyD')")
    guest.evaluate("__hd.press('Space'); __hd.step(3, 1/60, false); __hd.release('Space')"); run(0.6)
    print('guest view of VEX (self):', guest.evaluate("(()=>{const p=__hd.players[1]; return [p.x.toFixed(2), p.z.toFixed(2), p.stats.thrown, p.discs.map(d=>d.state)]})()"))
    print('host view of VEX:', host.evaluate("(()=>{const p=__hd.players[1]; return [p.x.toFixed(2), p.z.toFixed(2), p.discs.map(d=>d.state)]})()"))
    host.evaluate("__hd.press('KeyA')"); run(1.0); host.evaluate("__hd.release('KeyA')"); run(0.5)
    print('NOVA host/guest:', host.evaluate("[__hd.players[0].x.toFixed(2), __hd.players[0].z.toFixed(2)]"), guest.evaluate("[__hd.players[0].x.toFixed(2), __hd.players[0].z.toFixed(2)]"))
    # guest throws a MID disc straight at the host until something lands
    for k in range(6):
        guest.evaluate("__hd.press('Space'); __hd.step(3, 1/60, false); __hd.release('Space')"); run(1.4)
    print('after volley host:', host.evaluate("[__hd.players[0].heat, __hd.players[0].lives, __hd.players[0].mode, __hd.players[1].discs.map(d=>d.state)]"), 'guest:', guest.evaluate("[__hd.players[1].stats, __hd.players[0].heat]"))
    host.evaluate("__hd.press('KeyF'); __hd.step(1); __hd.release('KeyF')")
    for k in range(4):
        host.evaluate("__hd.press('Space'); __hd.step(3, 1/60, false); __hd.release('Space')"); run(1.4)
    run(2)
    for nm, pg, _ in pages:
        print(nm, 'later', pg.evaluate("[__hd.state, +__hd.matchT.toFixed(1), __hd.players.map(p => [p.name, p.mode, p.lives, p.stats.hits, p.stats.rings])]"))
        print(nm, 'rings', pg.evaluate("__hd.STATIONS.map(s => s.pads.map(q => q.rings.map(r => r.state).join('')).join('|'))"))
    for nm, pg, _ in pages: pg.evaluate("__hd.step(1)"); pg.screenshot(path=f'{OUT}-{nm}.png')
    for nm, _, logs in pages:
        errs = [l for l in logs if 'PAGEERROR' in l or 'rror' in l]
        print(nm, 'errors:', errs[:8])
    b.close()

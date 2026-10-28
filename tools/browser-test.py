"""Open the game in headless Chromium (SwiftShader WebGL), run a JS script of steps, take screenshots.
usage: python3 shot.py <url> <outprefix> <steps.json>
steps: [{"wait": ms} | {"js": "..."} | {"shot": "name"} | {"key": "Space"} | {"down":"KeyW"} | {"up":"KeyW"}]
cdn.jsdelivr.net three.js requests are served from a local r147 checkout.
"""
import sys, json, os, time
from playwright.sync_api import sync_playwright
THREE = os.environ.get('THREE_DIR')  # optional local three.js r147 checkout for offline machines
url, out, steps = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
W = int(os.environ.get('W', 1280)); H = int(os.environ.get('H', 720))
def route(r):
    u = r.request.url
    if THREE and 'cdn.jsdelivr.net/npm/three@0.147.0/' in u:
        rel = u.split('three@0.147.0/')[1]
        p = os.path.join(THREE, rel)
        if os.path.exists(p): return r.fulfill(path=p, content_type='application/javascript')
        print('MISSING', rel); return r.abort()

    return r.continue_()
with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'))
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.route('**/*', route)
    pg.goto(url)
    for s in steps:
        if 'wait' in s: pg.wait_for_timeout(s['wait'])
        if 'js' in s:
            try: v = pg.evaluate(s['js']); print('js ->', (json.dumps(v) if os.environ.get('FULL') else json.dumps(v)[:2000]) if v is not None else None)
            except Exception as e: print('js error', e)
        if 'key' in s: pg.keyboard.press(s['key'])
        if 'down' in s: pg.keyboard.down(s['down'])
        if 'up' in s: pg.keyboard.up(s['up'])
        if 'shot' in s:
            t = time.time(); pg.screenshot(path=f"{out}-{s["shot"]}.png", timeout=90000); print('shot', s['shot'], f'{time.time()-t:.1f}s')
    print('\n'.join(logs[-40:]))
    b.close()

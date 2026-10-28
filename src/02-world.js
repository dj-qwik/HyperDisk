/* ================= world: sky, megacity, arena shell, lights ================= */
const world = new THREE.Group(); scene.add(world);
const anim = [];   // per-frame callbacks for ambient world animation: f(t, dt)
const uTime = { value: 0 };

// ---- sky dome: polluted magenta horizon fading to deep night, stars and drifting smog ----
{
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform float uTime; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
      float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        vec3 d = normalize(vD); float y = d.y;
        vec3 zen = vec3(0.002,0.003,0.014), mid = vec3(0.006,0.01,0.06), hor = vec3(0.34,0.01,0.03), low = vec3(0.07,0.0,0.015);
        vec3 c = mix(mid, zen, smoothstep(0.05, 0.75, y));
        c = mix(hor, c, smoothstep(-0.02, 0.22, y));
        c = mix(low, c, smoothstep(-0.25, -0.02, y));
        // city glow bleeding into the horizon, warmer on one side
        c += vec3(0.30,0.0,0.03) * exp(-abs(y)*9.) * (0.6 + 0.4*sin(atan(d.z,d.x)*2.+1.));
        c += vec3(0.0,0.04,0.30) * exp(-abs(y-0.02)*14.) * (0.5+0.5*sin(atan(d.z,d.x)*3.-0.7));
        c += vec3(0.16,0.0,0.30) * exp(-abs(y-0.08)*10.) * (0.5+0.5*sin(atan(d.z,d.x)*1.5+2.2));
        c += vec3(0.22,0.08,0.0) * exp(-abs(y+0.01)*22.) * smoothstep(0.3, 1., sin(atan(d.z,d.x)*2.-1.4));
        // smog layers
        float s = n3(d*4. + vec3(uTime*0.01,0.,0.)) * 0.6 + n3(d*9. - vec3(0.,0.,uTime*0.02)) * 0.4;
        c += vec3(0.12,0.0,0.02) * smoothstep(0.45, 0.85, s) * smoothstep(0.55, 0.05, y) * smoothstep(-0.05, 0.08, y);
        // stars above the smog
        vec3 sp = d*420.; float st = h(floor(sp)); st = pow(st, 60.) * smoothstep(0.15, 0.5, y);
        c += vec3(0.9,0.95,1.) * st * (0.6 + 0.4*sin(uTime*3. + h(floor(sp))*60.));
        gl_FragColor = vec4(c, 1.);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), m); sky.frustumCulled = false; sky.renderOrder = -10; world.add(sky);
}

// ---- megacity: stepped and round towers with real facades (floors, mullions, lit offices, blinds,
// reflective dark glass, vertical neon signs), rooftop plant, antennas and aviation beacons,
// skybridges and elevated ring highways streaming with traffic ----
const CITY = {};
const HIGHWAYS = [[60, 3], [96, 24], [150, -4]];   // [radius, deck height]
const geoMerge = (parts) => {
  // parts: [{ g, m (Matrix4), c: [r,g,b] }] -> one non-indexed geometry with position, normal, color
  let n = 0; const gs = parts.map(p => { const g = (p.g.index ? p.g.toNonIndexed() : p.g.clone()); g.applyMatrix4(p.m || new THREE.Matrix4()); n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  gs.forEach((g, i) => { const c = parts[i].c || [1, 1, 1], k = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); for (let j = 0; j < k; j++) col.set(c, (o + j) * 3); o += k; });
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (gs.every(g => g.attributes.uv)) { const uv = new Float32Array(n * 2); let q = 0; gs.forEach(g => { uv.set(g.attributes.uv.array, q * 2); q += g.attributes.uv.count; }); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
  return out;
};
const MX = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy || 1, sz || 1));
{
  const q = QUALS[S.quality], count = Math.round(400 * q.city), rnd = mulberry(1234);
  const mat = new THREE.ShaderMaterial({
    extensions: { derivatives: true },
    uniforms: { uTime, uFog: { value: new THREE.Color(0x05040f) }, uFogD: { value: 0.0068 } },
    vertexShader: `
      attribute float aSeed; attribute vec3 aNeon; attribute vec2 aKind;
      varying vec3 vWP, vN, vLN, vNeon, vLocal, vScale; varying float vSeed; varying vec2 vKind;
      void main(){
        vLN = normal; vKind = aKind;
        mat4 m = modelMatrix * instanceMatrix; vec4 wp = m * vec4(position, 1.); vWP = wp.xyz;
        vN = normalize(mat3(m) * normal); vSeed = aSeed; vNeon = aNeon; vLocal = position;
        vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime, uFogD; uniform vec3 uFog;
      varying vec3 vWP, vN, vLN, vNeon, vLocal, vScale; varying float vSeed; varying vec2 vKind;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      vec3 winCol(float r){
        if (r < 0.50) return vec3(1.0, 0.64, 0.34);
        if (r < 0.78) return vec3(0.78, 0.86, 1.0);
        if (r < 0.88) return vec3(0.82, 1.0, 0.86);
        if (r < 0.93) return vec3(0.2, 0.8, 1.0);
        if (r < 0.97) return vec3(1.0, 0.25, 0.7);
        return vec3(1.0, 0.18, 0.1);
      }
      vec3 signCol(float s){ float k = fract(s * 11.7);
        return k < 0.25 ? vec3(1.0,0.08,0.18) : k < 0.45 ? vec3(0.1,0.45,1.0) : k < 0.6 ? vec3(1.0,0.5,0.05) : k < 0.75 ? vec3(0.0,1.0,0.8) : k < 0.88 ? vec3(0.8,0.1,1.0) : vec3(1.0,0.9,0.8); }
      void main(){
        float seed = floor(vSeed * 4096. + 0.5) / 4096.;
        vec3 n = normalize(vLN), wn = normalize(vN), V = normalize(cameraPosition - vWP);
        float fres = pow(max(0., 1. - abs(dot(wn, V))), 3.);
        bool cyl = vKind.y > 0.5; float style = floor(vKind.x + 0.5);
        vec3 col;
        bool side = abs(n.y) < 0.5;
        // facade coordinates and every screen-space derivative are computed outside the branch:
        // derivatives taken inside non-uniform control flow are undefined on some GPUs (and flicker)
        bool xf = abs(n.x) > abs(n.z);
        float faceW = cyl ? 3.14159 * vScale.x : (xf ? vScale.z : vScale.x);
        float u = cyl ? (atan(vLocal.z, vLocal.x) + 3.14159) * 0.5 * vScale.x : (xf ? vLocal.z * vScale.z : vLocal.x * vScale.x) + faceW * 0.5;
        float faceId = cyl ? 0. : (n.x + n.z * 3.);
        float wy = vWP.y + 200.;
        float floorH = 3.3 + fract(seed * 13.) * 0.9;
        float bay = style < 0.5 ? 1.5 : style < 1.5 ? 2.2 : style < 2.5 ? 3.2 : 1.1;
        vec2 g = vec2(u / bay, wy / floorH), id = floor(g), f = fract(g);
        vec2 fw = fwidth(g); float lod = smoothstep(0.22, 0.6, max(fw.x, fw.y));
        float fromTop = (0.5 - vLocal.y) * vScale.y, fwT = fwidth(fromTop) + 1e-4;
        float edge = cyl ? 99. : (xf ? (0.5 - abs(vLocal.z)) * vScale.z : (0.5 - abs(vLocal.x)) * vScale.x), fwE = fwidth(edge) + 1e-4;
        float fw9 = fwidth(u / 9.) + 1e-4;
        if (side) {
          vec4 bx = style < 0.5 ? vec4(0.06, 0.94, 0.16, 0.95) : style < 1.5 ? vec4(0.22, 0.78, 0.3, 0.8) : style < 2.5 ? vec4(0.0, 1.0, 0.38, 0.8) : vec4(0.25, 0.75, 0.42, 0.62);
          float aa = 0.04;
          float occ = 0.16 + 0.42 * fract(seed * 7.3);
          vec3 glass = mix(vec3(0.006, 0.008, 0.02), vec3(0.06, 0.03, 0.1), fres) + vec3(0.012, 0.004, 0.02) * smoothstep(-100., 60., vWP.y);
          vec3 frame = vec3(0.014, 0.015, 0.026) + vec3(0.04, 0.012, 0.06) * fres;
          frame *= 0.8 + 0.4 * h21(vec2(floor(u / 6.), floor(wy / 12.)) + seed);   // panel variation
          if (style > 2.5) frame += vec3(0.01) * step(0.92, fract(u / 4.)) ;
          float area = (bx.y - bx.x) * (bx.w - bx.z) * (style > 2.5 ? 0.45 : 1.);
          vec3 avg = frame * (1. - area) + area * (glass * (1. - occ) + vec3(0.8, 0.72, 0.6) * 0.55 * 0.62 * (occ + 0.05));
          col = avg;
          if (lod < 0.98) {   // far-away facades skip the per-window work entirely
          float win = smoothstep(bx.x, bx.x + aa, f.x) * smoothstep(bx.y, bx.y - aa, f.x) * smoothstep(bx.z, bx.z + aa, f.y) * smoothstep(bx.w, bx.w - aa, f.y);
          if (style > 2.5) win *= step(0.55, h21(vec2(floor(id.x / 3.), id.y) + seed * 9.));
          vec2 key = id + vec2(seed * 173., faceId * 31.);
          float office = step(h21(vec2(id.y, seed * 91. + faceId)), 0.09);
          float r = h21(key);
          float lit = max(step(r, occ), office);
          float grp = h21(vec2(floor(id.x / 4.), id.y) + seed * 3.);
          vec3 wc = winCol(fract(grp * 0.8 + h21(key * 1.3) * 0.2));
          float bright = 0.3 + 0.7 * h21(key * 2.1);
          float blinds = h21(key * 3.3) < 0.3 ? mix(0.65 + 0.35 * step(0.4, fract(f.y * 10.)), 0.86, smoothstep(0.25, 0.6, fw.y * 10.)) : 1.;
          float interior = mix(0.7, 1.15, smoothstep(bx.z, bx.w, f.y)) * blinds;
          float flick = h21(key * 7.7) > 0.995 ? step(0.3, fract(sin(uTime * 13. + r * 90.) * 3.)) : 1.;
          vec3 litC = wc * bright * interior * 0.55 * flick;
          float slab = smoothstep(0.035, 0.0, abs(f.y - 0.02)) * (style < 0.5 ? 1. : 0.);
          vec3 detailed = mix(frame, mix(glass, litC, lit), win) + vec3(0.02, 0.025, 0.04) * slab;
          col = mix(detailed, avg, lod);
          }
          // megablock: thin vertical light strips
          if (style > 2.5) { col += vec3(0.5, 0.7, 1.0) * 0.5 * smoothstep(0.03 + fw9, 0.0, abs(fract(u / 9.) - 0.5)) * min(1., 0.03 / fw9) * step(0.5, fract(seed * 17.)); }
          // neon accents
          col += vNeon * 2.2 * smoothstep(0.3 - fwT, 0.3 + fwT, fromTop) * (1. - smoothstep(0.55 - fwT, 0.55 + fwT, fromTop));
          col += vNeon * 0.05 * exp(-fromTop / 3.) * step(0.5, fract(seed * 23.)) * step(20., vScale.y);        // crown wash (towers only, not bridges)
          col += vNeon * 1.5 * step(fract(seed * 3.1), 0.22) * (1. - smoothstep(0.12 - fwE, 0.12 + fwE, edge)) * min(1., 0.12 / fwE);
          // vertical signboard near one corner, with blocky glyphs
          if (!cyl && fract(seed * 5.7) < 0.32 && fract(faceId * 0.37 + seed * 2.) < 0.5) {
            float sw = 2.4 + fract(seed * 4.1) * 1.4, sl = 12. + fract(seed * 9.1) * 22., s0 = 3. + fract(seed * 6.3) * 10.;
            vec2 sp = vec2(u - 0.8, fromTop - s0);
            if (sp.x > 0. && sp.x < sw && sp.y > 0. && sp.y < sl) {
              vec3 sc = signCol(seed + faceId * 0.13);
              vec2 gc = vec2(sp.x / sw, sp.y / sw), gid = floor(gc), gf = fract(gc);
              vec2 ig = (gf - 0.12) / 0.76; float inG = step(0., ig.x) * step(ig.x, 1.) * step(0., ig.y) * step(ig.y, 1.);
              vec2 px = floor(clamp(ig, 0., 0.999) * 5.);
              float on = step(0.48, h21(vec2(min(px.x, 4. - px.x) + gid.y * 5.3, px.y + seed * 40. + gid.y * 1.7)));
              on = max(on, step(0.7, h21(px + gid * 3.1 + seed)) * step(1.5, px.y) * step(px.y, 2.5));
              float border = 1. - step(0.12, sp.x) * step(sp.x, sw - 0.12) * step(0.12, sp.y) * step(sp.y, sl - 0.12);
              float fl = (fract(seed * 31.) < 0.25 && sin(uTime * 9. + seed * 40.) > 0.85) ? 0.15 : 1.;
              float glyph = on * inG;
              col = mix(vec3(0.008, 0.008, 0.014) + sc * 0.06, sc * 2.3 * fl, mix(glyph, 1., border * 0.8));
              col = mix(col, (vec3(0.02) + sc * 0.08 + sc * 0.6 * 0.3) * fl, lod * 0.85);
            }
          }
        } else {
          // rooftops: dark plating with a faint service grid
          vec2 rp = vec2(vLocal.x * vScale.x, vLocal.z * vScale.z);
          float gl = step(0.94, fract(rp.x / 3.)) + step(0.94, fract(rp.y / 3.));
          col = vec3(0.012, 0.013, 0.02) + vec3(0.012, 0.014, 0.02) * min(gl, 1.) + vNeon * 0.02;
        }
        // street-level haze glow rising from below
        col += vec3(0.16, 0.03, 0.08) * exp(-(vWP.y + 110.) / 28.) * 0.35;
        float d = length(vWP - cameraPosition);
        float fog = 1. - exp(-uFogD * uFogD * d * d);
        fog = clamp(fog + smoothstep(0., -90., vWP.y) * 0.45, 0., 1.);
        gl_FragColor = vec4(mix(col, uFog, fog), 1.);
      }`
  });
  const boxes = [], cyls = [];   // { m, seed, neon, kind }
  const neonCols = [[0.08, 0.35, 1.6], [1.6, 0.03, 0.1], [0.08, 0.35, 1.6], [1.6, 0.03, 0.1], [1.0, 0.95, 1.2], [1.6, 0.6, 0.0], [0.75, 0.05, 1.6], [0.0, 1.3, 1.0]];
  const P = new THREE.Vector3(), Q = new THREE.Quaternion(), Sv = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), M = new THREE.Matrix4();
  const roofs = [], props = [], masts = [], beacons = [];
  CITY.spots = [];
  const towers = [];
  for (let i = 0; i < count; i++) {
    let r, a, w, d, top, tries = 0;
    do {   // keep towers out of the elevated highways
      r = 66 + Math.pow(rnd(), 1.3) * 150; a = rnd() * TAU;
      w = 6 + rnd() * 10 + (r > 110 ? rnd() * 10 : 0); d = 6 + rnd() * 10; top = -14 + Math.pow(rnd(), 1.7) * 95 + (r > 100 ? rnd() * 40 : 0);
      tries++;
    } while (tries < 16 && (HIGHWAYS.some(([R, y]) => Math.abs(r - R) < 8 + Math.max(w, d) * 0.72 && top > y - 3) ||
      towers.some(t => Math.hypot(Math.cos(a) * r - t.x, Math.sin(a) * r - t.z) < (Math.max(w, d) + Math.max(t.w, t.d)) * 0.5)));
    const bottom = -110, rot = -a + (rnd() - 0.5) * 0.3, seed = rnd();
    const style = rnd() * 4 | 0, round = rnd() < 0.13;
    const nc = rnd() < 0.55 ? neonCols[rnd() * neonCols.length | 0] : [0, 0, 0];
    Q.setFromAxisAngle(UP, rot);
    const tiers = top > 25 ? 1 + (rnd() * 3 | 0) : 1;
    let y0 = bottom, cw = w, cd = d, ox = 0, oz = 0;
    for (let k = 0; k < tiers; k++) {
      const last = k === tiers - 1, yTop = last ? top : y0 + (top - y0) * (0.45 + rnd() * 0.25);
      const off = new THREE.Vector3(ox, 0, oz).applyQuaternion(Q);
      P.set(Math.cos(a) * r + off.x, (y0 + yTop) / 2, Math.sin(a) * r + off.z);
      const isCyl = round && k === tiers - 1 && tiers > 1 || (round && tiers === 1);
      Sv.set(isCyl ? Math.min(cw, cd) : cw, yTop - y0, isCyl ? Math.min(cw, cd) : cd);
      M.compose(P, Q, Sv);
      (isCyl ? cyls : boxes).push({ m: M.clone(), seed, neon: last ? nc : [0, 0, 0], kind: [style, isCyl ? 1 : 0] });
      if (k === 0) towers.push({ a, r, top: yTop, w: cw, d: cd, x: P.x, z: P.z });
      if (last) roofs.push({ x: P.x, z: P.z, y: yTop, w: Sv.x, d: Sv.z, q: Q.clone(), cyl: isCyl });
      // a setback ledge between tiers
      if (!last) { const lm = new THREE.Matrix4().compose(new THREE.Vector3(P.x, yTop + 0.24, P.z), Q, new THREE.Vector3(cw + 0.6, 0.6, cd + 0.6)); props.push(lm); }
      y0 = yTop; ox += (rnd() - 0.5) * cw * 0.14; oz += (rnd() - 0.5) * cd * 0.14; cw *= 0.6 + rnd() * 0.2; cd *= 0.6 + rnd() * 0.2;
    }
    if (r < 140 && top > 0 && i % 3 === 0) CITY.spots.push({ a, r, top: towers[towers.length - 1].top, w, d, rot });
  }
  // rooftop plant, antenna masts and blinking aviation beacons
  for (const rf of roofs) {
    const lx = rf.w * 0.5, lz = rf.d * 0.5;
    const nP = rf.cyl ? 1 : 1 + (rnd() * 4 | 0);
    for (let j = 0; j < nP; j++) {
      const bw = 1.2 + rnd() * Math.min(4, rf.w * 0.35), bd = 1.2 + rnd() * Math.min(4, rf.d * 0.35), bh = 0.8 + rnd() * 2.6;
      const off = new THREE.Vector3((rnd() - 0.5) * (rf.w - bw) * 0.8, 0, (rnd() - 0.5) * (rf.d - bd) * 0.8).applyQuaternion(rf.q);
      const sink = 0.04 + rnd() * 0.2; props.push(new THREE.Matrix4().compose(new THREE.Vector3(rf.x + off.x, rf.y + bh / 2 - sink, rf.z + off.z), rf.q, new THREE.Vector3(bw + rnd() * 0.17, bh + rnd() * 0.23, bd + rnd() * 0.19)));
    }
    if (rnd() < 0.55) {
      const mh = 4 + rnd() * (rf.y > 40 ? 22 : 10), off = new THREE.Vector3((rnd() - 0.5) * lx, 0, (rnd() - 0.5) * lz).applyQuaternion(rf.q);
      const mx = rf.x + off.x, mz = rf.z + off.z;
      masts.push(new THREE.Matrix4().compose(new THREE.Vector3(mx, rf.y + mh / 2 - 0.12, mz), rf.q, new THREE.Vector3(0.22, mh, 0.22)));
      masts.push(new THREE.Matrix4().compose(new THREE.Vector3(mx, rf.y + mh * 0.35, mz), rf.q, new THREE.Vector3(0.9, 0.12, 0.9)));
      beacons.push([mx, rf.y + mh + 0.15, mz, rnd()]);
      if (mh > 12) beacons.push([mx, rf.y + mh * 0.55, mz, rnd()]);
    }
    if (rf.y > 20 && !rf.cyl) for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const o = new THREE.Vector3(sx * lx * 0.95, 0, sz * lz * 0.95).applyQuaternion(rf.q); beacons.push([rf.x + o.x, rf.y + 0.2, rf.z + o.z, rnd()]); }
  }
  // skybridges between neighbouring towers
  const near = towers.filter(t => t.r < 150 && t.top > -6).sort((p, q2) => p.a - q2.a);
  for (let i = 0; i < near.length; i++) {
    const A = near[i], B = near[(i + 1) % near.length], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz);
    if (L > 34 || L < 10 || rnd() < 0.35) continue;
    const y = Math.min(A.top, B.top) - 4 - rnd() * Math.max(2, Math.min(A.top, B.top) + 14) * 0.6;
    if (y < -20) continue;
    if (HIGHWAYS.some(([R, hy]) => Math.abs((A.r + B.r) / 2 - R) < 10 && Math.abs(y - hy) < 4)) continue;
    Q.setFromAxisAngle(UP, -Math.atan2(dz, dx)); P.set((A.x + B.x) / 2, y, (A.z + B.z) / 2); Sv.set(L, 2.6 + rnd() * 1.6, 3 + rnd() * 2);
    boxes.push({ m: new THREE.Matrix4().compose(P, Q, Sv), seed: rnd(), neon: rnd() < 0.5 ? neonCols[rnd() * neonCols.length | 0] : [0, 0, 0], kind: [2, 0] });
  }
  const mkInst = (geo, list) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length), seeds = new Float32Array(list.length), neon = new Float32Array(list.length * 3), kind = new Float32Array(list.length * 2);
    list.forEach((t, i) => { im.setMatrixAt(i, t.m); seeds[i] = t.seed; neon.set(t.neon, i * 3); kind.set(t.kind, i * 2); });
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1)); geo.setAttribute('aNeon', new THREE.InstancedBufferAttribute(neon, 3)); geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(kind, 2));
    im.frustumCulled = false; world.add(im); return im;
  };
  CITY.mesh = mkInst(new THREE.BoxGeometry(1, 1, 1), boxes);
  CITY.round = mkInst(new THREE.CylinderGeometry(0.5, 0.5, 1, 40, 1), cyls);
  const plantMat = new THREE.MeshStandardMaterial({ color: 0x1a1c24, metalness: 0.6, roughness: 0.6, envMapIntensity: 0.5 });
  const plant = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), plantMat, props.length); props.forEach((m, i) => plant.setMatrixAt(i, m)); plant.frustumCulled = false; world.add(plant);
  const mast = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2a2d36, metalness: 0.8, roughness: 0.4 }), masts.length); masts.forEach((m, i) => mast.setMatrixAt(i, m)); mast.frustumCulled = false; world.add(mast);
  // aviation beacons: slow red blinks, each with its own phase
  const bgeo = new THREE.OctahedronGeometry(0.4, 0), ph = new Float32Array(beacons.length);
  const bim = new THREE.InstancedMesh(bgeo, new THREE.ShaderMaterial({
    uniforms: { uTime }, fog: false,
    vertexShader: 'attribute float aPh; uniform float uTime; varying float vB; void main(){ float c = fract(uTime * 0.45 + aPh); vB = 0.12 + 3.2 * smoothstep(0.0, 0.04, c) * smoothstep(0.22, 0.12, c); vec4 mv = modelViewMatrix * instanceMatrix * vec4(position * (0.7 + vB * 0.25), 1.); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vB; void main(){ gl_FragColor = vec4(vec3(1.0, 0.08, 0.04) * vB, 1.); }'
  }), beacons.length);
  beacons.forEach((b, i) => { bim.setMatrixAt(i, new THREE.Matrix4().makeTranslation(b[0], b[1], b[2])); ph[i] = b[3]; });
  bgeo.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1)); bim.frustumCulled = false; world.add(bim);
  CITY.towers = towers;
}

// ---- elevated ring highways: concrete decks on pylons, with headlight and taillight streams ----
{
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x17181f, metalness: 0.35, roughness: 0.75, envMapIntensity: 0.4, normalMap: HULLT.nrm });
  const pyl = [];
  const streamMat = (R) => new THREE.ShaderMaterial({
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime, uR: { value: R } },
    vertexShader: 'varying vec2 vL; varying float vD; void main(){ vL = position.xy; vec4 mv = modelViewMatrix * vec4(position, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uTime, uR; varying vec2 vL; varying float vD;
      float h(float x){ return fract(sin(x * 91.7) * 43758.5453); }
      void main(){
        float rr = length(vL), ang = atan(vL.y, vL.x);
        float across = (rr - (uR - 5.6)) / 11.2;
        float lane = floor(across * 4.), lp = fract(across * 4.);
        float dir = lane < 2. ? 1. : -1.;
        float s = ang * uR;
        float cellL = 16. + h(lane) * 10.;
        float qv = s / cellL - dir * uTime * (22. + lane * 3.) / cellL + h(lane + 3.);
        float cell = floor(qv), f = fract(qv);
        float on = step(0.42, h(cell + lane * 13.1));
        float car = smoothstep(0., 0.04, f) * smoothstep(0.32, 0.02, f);
        float head = dir > 0. ? smoothstep(0.32, 0.27, f) * step(0.24, f) : smoothstep(0.0, 0.05, f) * step(f, 0.07);
        float laneM = smoothstep(0.18, 0.4, lp) * smoothstep(0.82, 0.6, lp);
        vec3 c = (dir > 0. ? vec3(1.0, 0.92, 0.8) : vec3(1.0, 0.06, 0.04)) * (car * 0.5 + head * 2.4) * on * laneM;
        // marker lights along both barriers
        float edge = step(across, 0.025) + step(0.975, across);
        c += vec3(1.0, 0.55, 0.1) * edge * step(0.8, fract(s / 4.)) * 1.6;
        c += vec3(0.05, 0.08, 0.15) * laneM * 0.15;
        gl_FragColor = vec4(c * clamp(1.3 - vD / 260., 0.25, 1.), 1.);
      }`
  });
  for (const [R, y] of HIGHWAYS) {
    const prof = [[R - 6.3, y + 0.9], [R - 6.0, y + 0.9], [R - 6.0, y], [R + 6.0, y], [R + 6.0, y + 0.9], [R + 6.3, y + 0.9], [R + 6.3, y - 0.5], [R + 4.5, y - 1.6], [R - 4.5, y - 1.6], [R - 6.3, y - 0.5], [R - 6.3, y + 0.9]].map(p => new THREE.Vector2(p[0], p[1]));
    const deck = new THREE.Mesh(new THREE.LatheGeometry(prof, 240), deckMat); deck.receiveShadow = false; world.add(deck);
    const st = new THREE.Mesh(new THREE.RingGeometry(R - 5.6, R + 5.6, 300, 1), streamMat(R)); st.rotation.x = -Math.PI / 2; st.position.y = y + 0.18; st.renderOrder = 3; world.add(st);
    const n = Math.round(TAU * R / 26);
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * TAU, h = y - 1.68 + 110;
      pyl.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * R, y - 1.68 - h / 2, Math.sin(a) * R), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a), new THREE.Vector3(2.2, h, 3.6)));
      pyl.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * R, y - 2.62, Math.sin(a) * R), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a), new THREE.Vector3(10, 1.6, 2.6)));
    }
  }
  const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), deckMat, pyl.length); pyl.forEach((m, i) => pm.setMatrixAt(i, m)); pm.frustumCulled = false; world.add(pm);
}

// ---- billboards hung on the nearer towers ----
const BILLBOARDS = [];
function buildBillboards() {
  BILLBOARDS.forEach(b => { world.remove(b); b.material.map.dispose(); });
  BILLBOARDS.length = 0;
  const rnd = mulberry(99), spots = CITY.spots.slice(0, 16);
  spots.forEach((sp, i) => {
    const ad = ADS[i % ADS.length], vertical = i % 3 === 2;
    const w = vertical ? 4 + rnd() * 2 : 10 + rnd() * 6, h = vertical ? w * 2 : w / 2;
    const m = new THREE.MeshBasicMaterial({ map: makeAdTexture(ad, vertical), color: new THREE.Color(1.5, 1.5, 1.5), side: THREE.DoubleSide, fog: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    const rr = sp.r - Math.hypot(sp.w, sp.d) / 2 - 0.8, y = Math.min(sp.top - h / 2 - 2, 4 + rnd() * 34);
    mesh.position.set(Math.cos(sp.a) * rr, y, Math.sin(sp.a) * rr);
    mesh.lookAt(0, y, 0);
    mesh.userData.flick = rnd() < 0.15 ? rnd() * 10 : -1;
    world.add(mesh); BILLBOARDS.push(mesh);
  });
}
buildBillboards();
anim.push((t) => {
  for (const b of BILLBOARDS) if (b.userData.flick >= 0) { const f = Math.sin(t * 17 + b.userData.flick) > 0.92 || Math.sin(t * 0.7 + b.userData.flick) > 0.97; b.material.color.setScalar(f ? 0.25 : 1.5); }
});

// ---- the giant spinning hologram over the skyline ----
const HOLO = new THREE.Group();
{
  const mk = (r, t, c, o) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 160), glowMat(c, 1.6, o));
  const a = mk(22, 0.45, 0x1650ff, 0.9), b = mk(17, 0.25, 0xff1414, 0.9), c = mk(9, 0.7, 0xffffff, 0.6);
  const dash = new THREE.Mesh(new THREE.TorusGeometry(19.5, 0.16, 6, 200, Math.PI * 1.5), glowMat(0x1650ff, 2, 0.8));
  HOLO.add(a, b, c, dash);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 26, 120, 40, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform float uTime; varying vec2 vUv; void main(){ float a = pow(clamp(vUv.y, 0., 1.),2.)*0.18*(0.7+0.3*sin(vUv.y*80.-uTime*6.)); gl_FragColor=vec4(vec3(0.1,0.3,1.)*a,1.); }'
  }));
  beam.position.y = -70; HOLO.add(beam);
  HOLO.position.set(-60, 92, -230); HOLO.rotation.x = 0.3; world.add(HOLO);
  anim.push((t) => { a.rotation.y = t * 0.4; b.rotation.x = t * 0.55; c.rotation.y = -t * 0.8; dash.rotation.z = t * 0.9; dash.rotation.y = t * 0.2; });
}

// ---- searchlights sweeping the smog ----
{
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime }, vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ float f = pow(min(1., abs(dot(normalize(vN), normalize(vV)))), 2.5); float a = f * pow(clamp(vUv.y, 0., 1.), 1.6) * 0.16; gl_FragColor = vec4(vec3(0.75,0.85,1.) * a, 1.); }'
  });
  const geo = new THREE.CylinderGeometry(0.4, 9, 260, 24, 1, true); geo.translate(0, -130, 0);
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(), cone = new THREE.Mesh(geo, mat); g.add(cone);
    const a = i / 6 * TAU + 0.4, r = 95 + (i % 2) * 35; g.position.set(Math.cos(a) * r, -30, Math.sin(a) * r); world.add(g);
    const ph = i * 1.7; anim.push(t => { g.rotation.set(Math.PI + Math.sin(t * 0.21 + ph) * 0.45, 0, Math.cos(t * 0.17 + ph * 1.3) * 0.45); });
  }
}

// ---- traffic: modelled hover vehicles (cars, cabs, haulers, patrol craft, bikes) flying in convoys
// on ring lanes round the arena and straight skyways between the towers, trailing light ----
{
  const qty = QUALS[S.quality].city, rnd = mulberry(4);
  const rb = (w, h, d, r) => (THREE.RoundedBoxGeometry ? new THREE.RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d));
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r1, r2, h, s) => new THREE.CylinderGeometry(r1, r2, h, s || 12);
  const PAINT = 1, GLASS = [0.05, 0.06, 0.08], DARK = [0.16, 0.16, 0.18], CHROME = [0.55, 0.56, 0.6];
  const WHITE = [3.2, 3.1, 2.9], RED = [3.0, 0.08, 0.06], AMBER = [3.0, 1.3, 0.1];
  const pods = (xs, zs, r, len, y) => { const out = []; for (const x of xs) for (const z of zs) { out.push({ g: cyl(r, r * 0.85, len, 14), m: MX(x, y, z, Math.PI / 2), c: DARK }); out.push({ g: cyl(r * 0.6, r * 0.6, 0.06, 12), m: MX(x, y - r * 0.2, z), c: CHROME }); } return out; };
  const TYPES = {
    car: {
      body: [{ g: rb(1.9, 0.55, 4.4, 0.22), m: MX(0, 0, 0) }, { g: rb(1.75, 0.38, 1.3, 0.16), m: MX(0, -0.04, 2.2, 0.22) },
        { g: rb(1.45, 0.52, 2.1, 0.24), m: MX(0, 0.42, -0.25), c: GLASS }, { g: box(0.16, 0.26, 3.5), m: MX(0.98, -0.2, 0), c: DARK }, { g: box(0.16, 0.26, 3.5), m: MX(-0.98, -0.2, 0), c: DARK },
        { g: box(1.8, 0.06, 0.45), m: MX(0, 0.4, -2.05, -0.15) }, { g: box(0.08, 0.24, 0.3), m: MX(0.7, 0.3, -2.05) }, { g: box(0.08, 0.24, 0.3), m: MX(-0.7, 0.3, -2.05) },
        ...pods([1.12, -1.12], [1.35, -1.45], 0.3, 1.0, -0.08)],
      lights: [{ g: box(0.55, 0.07, 0.06), m: MX(0.55, 0.06, 2.88), c: WHITE }, { g: box(0.55, 0.07, 0.06), m: MX(-0.55, 0.06, 2.88), c: WHITE }, { g: box(1.75, 0.07, 0.06), m: MX(0, 0.14, -2.22), c: RED }],
      accent: [{ g: box(0.03, 0.04, 3.4), m: MX(0.965, 0.06, 0) }, { g: box(0.03, 0.04, 3.4), m: MX(-0.965, 0.06, 0) }, { g: cyl(0.2, 0.2, 0.02, 10), m: MX(1.12, -0.42, 1.35) }, { g: cyl(0.2, 0.2, 0.02, 10), m: MX(-1.12, -0.42, 1.35) }, { g: cyl(0.2, 0.2, 0.02, 10), m: MX(1.12, -0.42, -1.45) }, { g: cyl(0.2, 0.2, 0.02, 10), m: MX(-1.12, -0.42, -1.45) }],
      half: 2.3, width: 1.8, paints: [[0.05, 0.05, 0.06], [0.75, 0.76, 0.8], [0.35, 0.02, 0.03], [0.04, 0.08, 0.22], [0.22, 0.23, 0.26], [0.02, 0.02, 0.02]], neon: [[0.2, 0.6, 2.6], [2.6, 0.1, 0.3], [0.0, 2.2, 1.8], [1.6, 0.2, 2.6], [2.6, 1.0, 0.1]]
    },
    cab: null, patrol: null,
    hauler: {
      body: [{ g: rb(2.3, 1.5, 2.3, 0.3), m: MX(0, 0.3, 3.3) }, { g: rb(1.9, 0.55, 1.0, 0.15), m: MX(0, 0.62, 4.25, 0.5), c: GLASS }, { g: box(2.5, 2.2, 6.4), m: MX(0, 0.55, -1.2), c: [0.55, 0.55, 0.55] },
        ...[-3.8, -2.6, -1.4, -0.2, 1.0].map(z => ({ g: box(2.62, 2.3, 0.14), m: MX(0, 0.55, z), c: [0.3, 0.3, 0.32] })), { g: box(1.4, 0.4, 7.8), m: MX(0, -0.75, 0.2), c: DARK },
        ...pods([1.35, -1.35], [3.0, 0.4, -3.4], 0.42, 1.4, -0.65)],
      lights: [{ g: box(0.6, 0.12, 0.06), m: MX(0.6, -0.05, 4.47), c: WHITE }, { g: box(0.6, 0.12, 0.06), m: MX(-0.6, -0.05, 4.47), c: WHITE },
        ...[-4.2, -2.0, 0.2, 1.8].flatMap(z => [{ g: box(0.06, 0.1, 0.16), m: MX(1.32, 1.6, z), c: AMBER }, { g: box(0.06, 0.1, 0.16), m: MX(-1.32, 1.6, z), c: AMBER }]),
        { g: box(0.4, 0.3, 0.06), m: MX(0.9, 0.2, -4.42), c: RED }, { g: box(0.4, 0.3, 0.06), m: MX(-0.9, 0.2, -4.42), c: RED }],
      accent: [{ g: box(2.0, 0.06, 0.06), m: MX(0, 1.07, 4.47) }, { g: cyl(0.3, 0.3, 0.02, 10), m: MX(1.35, -1.1, 3.0) }, { g: cyl(0.3, 0.3, 0.02, 10), m: MX(-1.35, -1.1, 3.0) }, { g: cyl(0.3, 0.3, 0.02, 10), m: MX(1.35, -1.1, -3.4) }, { g: cyl(0.3, 0.3, 0.02, 10), m: MX(-1.35, -1.1, -3.4) }],
      half: 4.5, width: 2.4, paints: [[0.5, 0.2, 0.04], [0.3, 0.31, 0.34], [0.08, 0.12, 0.1], [0.45, 0.42, 0.36]], neon: [[2.6, 1.0, 0.1], [0.2, 0.6, 2.6]]
    },
    bike: {
      body: [{ g: rb(0.62, 0.5, 2.5, 0.2), m: MX(0, 0, 0) }, { g: rb(0.5, 0.3, 0.9, 0.12), m: MX(0, 0.32, 0.55, -0.3), c: GLASS }, { g: rb(0.42, 0.55, 0.5, 0.15), m: MX(0, 0.5, -0.35), c: DARK }, { g: rb(0.3, 0.3, 0.3, 0.12), m: MX(0, 0.92, -0.2), c: DARK },
        { g: cyl(0.34, 0.3, 0.5, 14), m: MX(0, -0.15, 1.15, Math.PI / 2), c: DARK }, { g: cyl(0.38, 0.32, 0.6, 14), m: MX(0, -0.12, -1.1, Math.PI / 2), c: DARK }],
      lights: [{ g: box(0.22, 0.07, 0.05), m: MX(0, 0.1, 1.27), c: WHITE }, { g: box(0.4, 0.06, 0.05), m: MX(0, 0.12, -1.27), c: RED }],
      accent: [{ g: box(0.03, 0.04, 1.9), m: MX(0.315, 0.0, 0) }, { g: box(0.03, 0.04, 1.9), m: MX(-0.315, 0.0, 0) }, { g: cyl(0.3, 0.3, 0.02, 10), m: MX(0, -0.42, 1.15) }, { g: cyl(0.3, 0.3, 0.02, 10), m: MX(0, -0.42, -1.1) }],
      half: 1.3, width: 0.6, paints: [[0.04, 0.04, 0.05], [0.5, 0.02, 0.03], [0.7, 0.7, 0.72]], neon: [[0.0, 2.2, 1.8], [2.6, 0.1, 0.3], [1.6, 0.2, 2.6]]
    }
  };
  TYPES.cab = Object.assign({}, TYPES.car, { accent: [...TYPES.car.accent, { g: box(0.7, 0.22, 0.32), m: MX(0, 0.83, -0.3) }], paints: [[0.85, 0.55, 0.02]], neon: [[2.8, 1.8, 0.2], [0.2, 2.2, 2.6]] });
  TYPES.patrol = Object.assign({}, TYPES.car, { accent: [...TYPES.car.accent, { g: box(0.42, 0.1, 0.25), m: MX(0.25, 0.76, -0.3) }, { g: box(0.42, 0.1, 0.25), m: MX(-0.25, 0.76, -0.3) }], paints: [[0.03, 0.03, 0.04], [0.7, 0.72, 0.76]], neon: [[2.6, 0.1, 0.1]] });
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.75, roughness: 0.3, envMapIntensity: 1.4 });
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const accMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const trailMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv; varying float vA; void main(){ vUv = uv; vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.); vA = clamp(1.2 - (-mv.z) / 240., 0.15, 1.); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec2 vUv; varying float vA; void main(){ float x = abs(vUv.x - 0.5) * 2.; float a = pow(clamp(1. - vUv.y, 0., 1.), 3.) * (exp(-pow((x - 0.8) * 9., 2.)) + 0.25 * exp(-x * x * 6.)) * 0.22 * vA; gl_FragColor = vec4(vec3(1.0, 0.07, 0.05) * a, 1.); }'
  });
  // lanes: ring lanes in altitude bands round the arena, and straight skyways between towers
  const lanes = [], cars = [];
  const typePick = () => { const k = rnd(); return k < 0.42 ? 'car' : k < 0.56 ? 'cab' : k < 0.74 ? 'hauler' : k < 0.8 ? 'patrol' : 'bike'; };
  const nRing = Math.round(6 * qty), nLine = Math.round(4 * qty);   // kept light for frame rate
  for (let i = 0; i < nRing; i++) {
    const inner = i < nRing * 0.45;
    let r = inner ? 37 + rnd() * 14 : 70 + rnd() * 120, y = inner ? -10 + rnd() * 30 : -12 + rnd() * 70;
    const hw = HIGHWAYS.find(([R, hy]) => Math.abs(r - R) < 9 && Math.abs(y - hy) < 5); if (hw) y = hw[1] + 8 + rnd() * 6;
    const dir = rnd() < 0.5 ? 1 : -1, speed = 14 + rnd() * 14;
    const L = { kind: 'ring', r, y, dir, w: dir * speed / r, a0: rnd() * TAU }; lanes.push(L);
    const n = 3 + (rnd() * 6 | 0); let gap = 0;
    for (let j = 0; j < n; j++) { gap += (12 + rnd() * 22) / r; cars.push({ L, off: -gap * dir, type: typePick(), bob: rnd() * 10, dy: (rnd() - 0.5) * 1.2, dr: (rnd() - 0.5) * 3 }); }
  }
  for (let i = 0; i < nLine; i++) {
    const a = rnd() * TAU, d = 48 + rnd() * 110, dir = rnd() < 0.5 ? 1 : -1;
    const L = { kind: 'line', nx: Math.cos(a), nz: Math.sin(a), d, y: -6 + rnd() * 65, v: dir * (16 + rnd() * 16), len: 260, s0: rnd() * 520 }; lanes.push(L);
    const n = 3 + (rnd() * 5 | 0); let gap = 0;
    for (let j = 0; j < n; j++) { gap += 12 + rnd() * 24; cars.push({ L, off: -gap * Math.sign(L.v), type: typePick(), bob: rnd() * 10, dy: (rnd() - 0.5) * 1.5, dr: (rnd() - 0.5) * 3 }); }
  }
  // build one instanced set per vehicle type
  const SETS = {};
  for (const [name, T] of Object.entries(TYPES)) {
    const list = cars.filter(c => c.type === name); if (!list.length) continue;
    const body = new THREE.InstancedMesh(geoMerge(T.body.map(p => ({ g: p.g, m: p.m, c: p.c || [1, 1, 1] }))), bodyMat, list.length);
    const lights = new THREE.InstancedMesh(geoMerge(T.lights), lightMat, list.length);
    const acc = new THREE.InstancedMesh(geoMerge(T.accent.map(p => ({ g: p.g, m: p.m, c: [1, 1, 1] }))), accMat, list.length);
    const tg = geoMerge([{ g: new THREE.PlaneGeometry(T.width, 7), m: MX(0, 0.12, -T.half - 3.5, -Math.PI / 2) }]);
    // planes lose their uvs in the merge, so rebuild them: v runs 0 at the car to 1 at the tail end
    { const pos = tg.attributes.position, uv = new Float32Array(pos.count * 2); for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i), x = pos.getX(i), yy = pos.getY(i) - 0.1; uv[i * 2] = 0.5 + (Math.abs(x) > 0.01 ? x / T.width : yy / 0.5); uv[i * 2 + 1] = (-T.half - z) / 7; } tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
    const trail = new THREE.InstancedMesh(tg, trailMat, list.length);
    list.forEach((c, i) => {
      c.set = name; c.i = i;
      body.setColorAt(i, new THREE.Color(...T.paints[rnd() * T.paints.length | 0]));
      c.neon = new THREE.Color(...T.neon[rnd() * T.neon.length | 0]); acc.setColorAt(i, c.neon);
    });
    [body, lights, acc, trail].forEach(m => { m.frustumCulled = false; world.add(m); });
    SETS[name] = { body, lights, acc, trail, list };
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), red = new THREE.Color(3, 0.05, 0.05), blue = new THREE.Color(0.1, 0.3, 3.2);
  anim.push((t) => {
    for (const name in SETS) {
      const S2 = SETS[name];
      for (const c of S2.list) {
        const L = c.L; let x, z, yaw, roll = 0, y = L.y + c.dy + Math.sin(t * 0.6 + c.bob) * 0.35;
        if (L.kind === 'ring') {
          const a = L.a0 + L.w * t + c.off, r = L.r + c.dr; x = Math.cos(a) * r; z = Math.sin(a) * r;
          const vx = -Math.sin(a) * L.dir, vz = Math.cos(a) * L.dir; yaw = Math.atan2(vx, vz); roll = -0.12 * L.dir;
        } else {
          const s = ((L.s0 + L.v * t + c.off) % (2 * L.len) + 2 * L.len) % (2 * L.len) - L.len;
          const tx = -L.nz, tz = L.nx; x = L.nx * L.d + tx * s + L.nx * c.dr; z = L.nz * L.d + tz * s + L.nz * c.dr;
          yaw = Math.atan2(tx * Math.sign(L.v), tz * Math.sign(L.v));
        }
        e.set(Math.sin(t * 0.9 + c.bob) * 0.03, yaw, roll, 'YXZ'); q4.setFromEuler(e); p.set(x, y, z); m4.compose(p, q4, s1);
        S2.body.setMatrixAt(c.i, m4); S2.lights.setMatrixAt(c.i, m4); S2.acc.setMatrixAt(c.i, m4); S2.trail.setMatrixAt(c.i, m4);
        if (name === 'patrol') S2.acc.setColorAt(c.i, Math.sin(t * 14 + c.bob * 3) > 0 ? red : blue);
      }
      S2.body.instanceMatrix.needsUpdate = S2.lights.instanceMatrix.needsUpdate = S2.acc.instanceMatrix.needsUpdate = S2.trail.instanceMatrix.needsUpdate = true;
      if (name === 'patrol') S2.acc.instanceColor.needsUpdate = true;
    }
  });
  CITY.traffic = SETS;
}

// ---- rain outside the arena walls ----
{
  const n = Math.round(5000 * QUALS[S.quality].city), pos = new Float32Array(n * 6), end = new Float32Array(n * 2), rnd = mulberry(8);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, r = 32 + Math.pow(rnd(), 0.7) * 70, x = Math.cos(a) * r, z = Math.sin(a) * r, y = rnd() * 140;
    pos.set([x, y, z, x, y, z], i * 6); end[i * 2] = 0; end[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime },
    vertexShader: 'attribute float aEnd; uniform float uTime; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y - uTime*48., 140.) - 60. + aEnd*1.6; p.x += aEnd*0.18; vA = 1.-aEnd; vec4 mv = modelViewMatrix*vec4(p,1.); vA *= clamp(1. - (-mv.z)/150., 0., 1.); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(0.55,0.65,0.9)*vA*0.55, 1.); }'
  });
  const rain = new THREE.LineSegments(g, m); rain.frustumCulled = false; world.add(rain);
}

/* ================= the arena shell ================= */
const ARENA = new THREE.Group(); scene.add(ARENA);
const metalDark = new THREE.MeshStandardMaterial({ color: 0x1a1d27, metalness: 0.85, roughness: 0.32, map: WALLT.map, normalMap: WALLT.nrm, emissiveMap: WALLT.em, emissive: new THREE.Color(0x1650ff).multiplyScalar(0.9) });

// ---- THE SHAFT under the court: a huge mechanical well, all steel, pipes, hoses, girders and gantries
// dropping away into haze, lit by work lamps rather than neon ----
const SHAFT = { R: RA + 0.6, top: -2.4, bottom: -54, grid: -46 };   // grid: the laser floor that de-rezzes fallen runners
{
  const R = SHAFT.R, H = SHAFT.top - SHAFT.bottom, rnd = mulberry(4242);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), Sc = new THREE.Vector3(1, 1, 1), UPV = new THREE.Vector3(0, 1, 0);
  const onWall = (a, r, y) => P.set(Math.cos(a) * r, y, Math.sin(a) * r);
  const facing = a => Q.setFromAxisAngle(UPV, Math.PI / 2 - a);      // local +z points at the wall, local x runs along it
  const inst = (geo, mat, mats, cast) => { const m = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((x, i) => m.setMatrixAt(i, x)); m.castShadow = !!cast; m.receiveShadow = true; ARENA.add(m); return m; };
  const tex = (t, rx, ry) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; };
  // materials
  const wallM = new THREE.MeshStandardMaterial({ color: 0x2b2f37, metalness: 0.75, roughness: 0.5, map: tex(WALLT.map, 16, 9), normalMap: tex(WALLT.nrm, 16, 9), emissiveMap: tex(WALLT.em, 16, 9), emissive: new THREE.Color(0xffb27a).multiplyScalar(0.22), side: THREE.BackSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2e323a, metalness: 0.8, roughness: 0.55, envMapIntensity: 0.3, normalMap: ARMN, normalScale: new THREE.Vector2(0.4, 0.4) });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x181a1f, metalness: 0.8, roughness: 0.6, envMapIntensity: 0.3, normalMap: HULLT.nrm });
  const pipeSteel = new THREE.MeshStandardMaterial({ color: 0x3a3e46, metalness: 0.85, roughness: 0.42, envMapIntensity: 0.4 });
  const pipeCopper = new THREE.MeshStandardMaterial({ color: 0x5a3420, metalness: 0.85, roughness: 0.45, envMapIntensity: 0.4 });
  const pipeHazard = new THREE.MeshStandardMaterial({ color: 0x5a4612, metalness: 0.4, roughness: 0.6, envMapIntensity: 0.35 });
  const pipeRust = new THREE.MeshStandardMaterial({ color: 0x3a1a12, metalness: 0.5, roughness: 0.7, envMapIntensity: 0.3 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x101114, metalness: 0.1, roughness: 0.75 });
  const grate = new THREE.MeshStandardMaterial({ color: 0x22252b, metalness: 0.8, roughness: 0.6, envMapIntensity: 0.3, normalMap: tex(HULLT.nrm, 6, 1) });

  // the wall itself
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 128, 1, true), wallM); wall.position.y = (SHAFT.top + SHAFT.bottom) / 2; wall.receiveShadow = true; ARENA.add(wall);

  // girder rings (I-beam section) every 10 m, studded with bolts (merged into one mesh)
  const girderGeos = [];
  const ringYs = []; for (let y = -6; y > SHAFT.grid + 2; y -= 10) ringYs.push(y);
  const bolts = [];
  for (const y of ringYs) {
    const prof = [[R, 0.55], [R - 1.5, 0.55], [R - 1.5, 0.38], [R - 0.95, 0.38], [R - 0.95, -0.38], [R - 1.5, -0.38], [R - 1.5, -0.55], [R, -0.55]].map(q => new THREE.Vector2(q[0], q[1] + y));
    girderGeos.push({ g: new THREE.LatheGeometry(prof, 96) });
    for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; for (const dy of [0.58]) { facing(a); onWall(a, R - 1.25, y + dy); M4.compose(P, Q, Sc); bolts.push(M4.clone()); } }
  }
  { const gm = new THREE.Mesh(geoMerge(girderGeos), steel); gm.receiveShadow = true; ARENA.add(gm); }
  inst(new THREE.BoxGeometry(0.1, 0.06, 0.1), darkSteel, bolts);

  // vertical columns and X-bracing between the girders
  const cols = 20, colM = [], braceM = [];
  for (let i = 0; i < cols; i++) {
    const a = i / cols * TAU; facing(a); onWall(a, R - 0.5, (SHAFT.top - 0.35 + SHAFT.bottom) / 2); Sc.set(1, 1, 1); M4.compose(P, Q, Sc); colM.push(M4.clone());
    const a2 = (i + 1) / cols * TAU, am = (a + a2) / 2, chord = 2 * (R - 0.35) * Math.sin(Math.PI / cols);
    for (let k = 0; k < ringYs.length - 1; k++) {
      if (rnd() < 0.25) continue;
      const y0 = ringYs[k] - 0.6, y1 = ringYs[k + 1] + 0.6, len = Math.hypot(chord, y0 - y1), tilt = Math.atan2(y0 - y1, chord);
      for (const sgn of [1, -1]) { E.set(0, Math.PI / 2 - am, sgn * tilt, 'YXZ'); Q.setFromEuler(E); onWall(am, R - 0.3 - (sgn < 0 ? 0.17 : 0), (y0 + y1) / 2); Sc.set(len, 1, 1); M4.compose(P, Q, Sc); braceM.push(M4.clone()); }
    }
  }
  Sc.set(1, 1, 1);
  inst(new THREE.BoxGeometry(0.9, H - 0.35, 0.8), darkSteel, colM);
  inst(new THREE.BoxGeometry(1, 0.22, 0.14), steel, braceM);

  // ---- everything on the walls is laid out bay by bay (the bays are the gaps between the 20 columns),
  // so it reads as engineered plant rather than clutter ----
  const bayA = i => (i + 0.5) / cols * TAU, alongWall = (a, off, d) => a + off / d;
  const RISERS = [1, 4, 8, 11, 14, 18], TRAYS = [2, 6, 12, 16];
  // pipe risers: neat bundles of four matching pipes running the full depth, flanged at the same heights
  const pipeSets = { steel: [], copper: [] }, flanges = [], straps = [], standoffs = [];
  RISERS.forEach((bay, k) => {
    const a = bayA(bay), kind = k === 1 || k === 4 ? 'copper' : 'steel', r0 = 0.2, d = R - 1.45, n = 4, sp = 0.62;
    const ytop = SHAFT.top - 0.4, ybot = SHAFT.bottom, len = ytop - ybot;
    for (let j = 0; j < n; j++) {
      const aa = alongWall(a, (j - (n - 1) / 2) * sp, d);
      onWall(aa, d, (ytop + ybot) / 2); Q.identity(); Sc.set(r0, len, r0); M4.compose(P, Q, Sc); pipeSets[kind].push(M4.clone());
      for (const y of ringYs) { onWall(aa, d, y - 5); E.set(Math.PI / 2, 0, 0); Q.setFromEuler(E); Sc.setScalar(r0 * 1.3); M4.compose(P, Q, Sc); flanges.push(M4.clone()); }
    }
    // a clamp strap across the bundle under every girder, stood off from the wall
    for (const y of ringYs) {
      facing(a); onWall(a, d, y - 2.9); Sc.set(n * sp + 0.3, 0.16, 0.5); M4.compose(P, Q, Sc); straps.push(M4.clone());
      for (const off of [-(n * sp) / 2, (n * sp) / 2]) { const aa = alongWall(a, off, d); facing(aa); onWall(aa, (d + 0.26 + R - 0.95) / 2, y - 2.9); Sc.set(0.1, 0.1, R - 0.95 - d - 0.26); M4.compose(P, Q, Sc); standoffs.push(M4.clone()); }
    }
  });
  Sc.set(1, 1, 1);
  const pipeGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1);
  inst(pipeGeo, pipeSteel, pipeSets.steel); inst(pipeGeo, pipeCopper, pipeSets.copper);
  inst(new THREE.TorusGeometry(1, 0.28, 6, 18), steel, flanges);
  inst(new THREE.BoxGeometry(1, 1, 1), darkSteel, straps); inst(new THREE.BoxGeometry(1, 1, 1), darkSteel, standoffs);
  // cable trays: flat channels with straight cable runs, clipped at each girder
  const trays = [], cables = [], clips = [];
  TRAYS.forEach(bay => {
    const a = bayA(bay), d = R - 1.05, ytop = SHAFT.top - 0.4, ybot = SHAFT.grid - 1, len = ytop - ybot;
    facing(a); onWall(a, d + 0.05, (ytop + ybot) / 2); Sc.set(1.0, len - 0.06, 0.1); M4.compose(P, Q, Sc); trays.push(M4.clone());
    for (const s2 of [-0.48, 0.48]) { const aa = alongWall(a, s2, d); facing(aa); onWall(aa, d - 0.1, (ytop + ybot) / 2); Sc.set(0.05, len + 0.06, 0.25); M4.compose(P, Q, Sc); trays.push(M4.clone()); }
    for (let j = 0; j < 6; j++) { const aa = alongWall(a, -0.35 + j * 0.14, d); facing(aa); onWall(aa, d - 0.1, (ytop + ybot) / 2); Sc.set(0.09, len - 0.14, 0.09); M4.compose(P, Q, Sc); cables.push(M4.clone()); }
    for (const y of ringYs) { facing(a); onWall(a, d - 0.2, y - 3.2); Sc.set(1.1, 0.12, 0.08); M4.compose(P, Q, Sc); clips.push(M4.clone()); }
  });
  Sc.set(1, 1, 1);
  inst(new THREE.BoxGeometry(1, 1, 1), grate, trays); inst(new THREE.BoxGeometry(1, 1, 1), rubber, cables); inst(new THREE.BoxGeometry(1, 1, 1), steel, clips);

  // gantries: grated walkways spanning the shaft, with handrails and truss underneath
  const gantries = [[-14, 0.4], [-31, 1.9]];
  for (const [y, ang] of gantries) {
    const g = new THREE.Group(), len = 2 * (R - 1.2);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 1.6), grate); deck.receiveShadow = true; g.add(deck);
    for (const z of [-0.78, 0.78]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), steel); rail.position.set(0, 1.05, z); g.add(rail);
      const mid = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.04), steel); mid.position.set(0, 0.55, z); g.add(mid);
      const chord = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.12), darkSteel); chord.position.set(0, -0.9, z * 0.7); g.add(chord);
    }
    const posts = [], diag = [];
    for (let x = -len / 2 + 0.6; x < len / 2; x += 1.6) {
      for (const z of [-0.74, 0.74]) { M4.makeTranslation(x, 0.55, z); posts.push(M4.clone()); }
      for (const z of [-0.55, 0.55]) { E.set(0, 0, ((x / 1.6 | 0) % 2 ? 1 : -1) * 0.9); Q.setFromEuler(E); P.set(x + 0.8, -0.45, z); Sc.set(1, 1, 1); M4.compose(P, Q, Sc); diag.push(M4.clone()); }
    }
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), steel, posts.length); posts.forEach((m, i) => pm.setMatrixAt(i, m)); g.add(pm);
    const dm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 1.15, 0.05), darkSteel, diag.length); diag.forEach((m, i) => dm.setMatrixAt(i, m)); g.add(dm);
    // a work lamp hanging under the middle of each gantry
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.3, 12), darkSteel); lamp.position.set(len * 0.15, -1.2, 0); g.add(lamp);
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd8a8).multiplyScalar(2.2) })); bulb.rotation.x = Math.PI / 2; bulb.position.set(len * 0.15, -1.39, 0); g.add(bulb);
    g.position.y = y; g.rotation.y = ang; ARENA.add(g);
  }
  // junction boxes: tidy banks of matching cabinets in the remaining bays, each with a row of status lights
  const boxes = [], leds = [], ledCols = [], valves = [];
  const ledPalette = [new THREE.Color(0xffa020).multiplyScalar(2.2), new THREE.Color(0x30ff60).multiplyScalar(1.6), new THREE.Color(0xff2a10).multiplyScalar(2), new THREE.Color(0xffffff).multiplyScalar(1.4)];
  for (let bay = 0; bay < cols; bay++) {
    if (RISERS.includes(bay) || TRAYS.includes(bay)) continue;
    const a = bayA(bay);
    ringYs.forEach((ry, k) => {
      if ((bay + k) % 2) return;                          // alternate levels so the walls breathe
      const n = 2 + ((bay * 7 + k) % 2), w = 0.9, h = 1.3, dpt = 0.4, gap = 0.18, y = ry - 4.6;
      for (let j = 0; j < n; j++) {
        const off = (j - (n - 1) / 2) * (w + gap), aa = alongWall(a, off, R - 1);
        facing(aa); onWall(aa, R - 0.95 - dpt / 2, y); Sc.set(w, h, dpt); M4.compose(P, Q, Sc); boxes.push(M4.clone());
        for (let l = 0; l < 3; l++) { const la = alongWall(aa, (l - 1) * 0.13, R - 1); facing(la); onWall(la, R - 0.97 - dpt, y + h * 0.32); Sc.set(1, 1, 1); M4.compose(P, Q, Sc); leds.push(M4.clone()); ledCols.push(ledPalette[(bay + j + l + k) % 7 === 0 ? 2 : (l === 0 ? 1 : 0)]); }
        if (j === 0 && k % 2 === 0) { facing(aa); onWall(aa, R - 1.0 - dpt, y - h * 0.18); M4.compose(P, Q, Sc.set(1, 1, 1)); valves.push(M4.clone()); }
      }
    });
  }
  Sc.set(1, 1, 1);
  inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2a2e35, metalness: 0.6, roughness: 0.6, envMapIntensity: 0.35, normalMap: ARMN, normalScale: new THREE.Vector2(0.3, 0.3) }), boxes);
  const ledMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), leds.length);
  leds.forEach((m, i) => { ledMesh.setMatrixAt(i, m); ledMesh.setColorAt(i, ledCols[i]); }); ARENA.add(ledMesh);
  inst(new THREE.TorusGeometry(0.16, 0.035, 6, 14), new THREE.MeshStandardMaterial({ color: 0x7a1a12, metalness: 0.4, roughness: 0.5 }), valves);
  // slowly blinking amber warning beacons on the girders
  const beacons = [], beaconCols = [];
  ringYs.forEach((y, k) => { for (let i = 0; i < 6; i++) { const a = (i + k * 0.37) / 6 * TAU; facing(a); onWall(a, R - 1.55, y - 0.65); M4.compose(P, Q, Sc); beacons.push(M4.clone()); beaconCols.push(new THREE.Color(0)); } });
  const beaconMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 6, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }), beacons.length);
  beacons.forEach((m, i) => { beaconMesh.setMatrixAt(i, m); beaconMesh.setColorAt(i, beaconCols[i]); }); ARENA.add(beaconMesh);
  const bc = new THREE.Color();
  anim.push((t) => { for (let i = 0; i < beacons.length; i++) { const on = Math.sin(t * 2.2 + i * 1.7) > 0.55; beaconMesh.setColorAt(i, on ? bc.setRGB(2.6, 1.2, 0.1) : bc.setRGB(0.25, 0.1, 0.0)); } beaconMesh.instanceColor.needsUpdate = true; });

  // flood lamps on the top girder, throwing soft cones down the shaft
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ float f = pow(min(1., abs(dot(normalize(vN), normalize(vV)))), 2.); float a = f * pow(clamp(vUv.y, 0., 1.), 2.2) * 0.07; gl_FragColor = vec4(vec3(1.0,0.86,0.68)*a, 1.); }'
  });
  const coneGeo = new THREE.CylinderGeometry(0.2, 5, 34, 20, 1, true); coneGeo.translate(0, -17, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) / 8 * TAU, g = new THREE.Group(); onWall(a, R - 2.1, -7.2); g.position.copy(P);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.5, 14), darkSteel); g.add(housing);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.36, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2bf).multiplyScalar(2.4) })); lens.rotation.x = Math.PI / 2; lens.position.y = -0.29; g.add(lens);
    const cone = new THREE.Mesh(coneGeo, coneMat); g.add(cone);
    g.rotation.z = Math.cos(a) * 0.22; g.rotation.x = -Math.sin(a) * 0.22; ARENA.add(g);
  }

  // haze layers so the shaft fades away into the depths, with a dim furnace glow far below
  const hazeMat = d => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime, uD: { value: d } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float uTime, uD; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.; float w = n(p * 6. + uTime * 0.03 + uD) * 0.6 + n(p * 13. - uTime * 0.05) * 0.4;
        float a = (0.025 + 0.035 * w) * smoothstep(1., 0.7, r) * uD; gl_FragColor = vec4(vec3(0.55, 0.6, 0.7) * a, 1.); }`
  });
  [[-21, 0.5], [-33, 0.8]].forEach(([y, d]) => { const m = new THREE.Mesh(new THREE.CircleGeometry(R - 0.2, 64), hazeMat(d)); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 1; ARENA.add(m); });

  // angled armour skirts under each girder: chamfered plates sloping in from the wall, like a bulkhead frame
  const skirtGeos = [];
  for (const y of ringYs) {
    const prof = [[R - 0.05, -0.55], [R - 1.5, -0.55], [R - 2.6, -1.9], [R - 2.6, -2.15], [R - 2.45, -2.15], [R - 1.2, -0.9], [R - 0.05, -0.9]].map(q => new THREE.Vector2(q[0], q[1] + y));
    for (let k = 0; k < 8; k++) skirtGeos.push({ g: new THREE.LatheGeometry(prof, 8, k / 8 * TAU + 0.05, TAU / 8 - 0.1) });
  }
  { const sm = new THREE.Mesh(geoMerge(skirtGeos), darkSteel); sm.receiveShadow = true; ARENA.add(sm); }
  // hundreds of small amber indicator lights: rows on the skirts and girders, columns of dots down the uprights
  const dots = [], dotCols = [];
  const amber = () => new THREE.Color(0xffb020).multiplyScalar(1.4 + rnd() * 1.6);
  for (const y of ringYs) {
    for (let i = 0; i < 180; i++) { const a = i / 180 * TAU; if ((i % 22) > 18 || rnd() < 0.18) continue;
      for (const [rr, dy] of [[R - 1.9, -1.0], [R - 2.3, -1.49]]) { onWall(a, rr, y + dy); M4.makeTranslation(P.x, P.y, P.z); dots.push(M4.clone()); dotCols.push(amber()); } }
  }
  for (let i = 0; i < cols; i++) {
    const a = i / cols * TAU;
    for (let y = SHAFT.top - 1.2; y > SHAFT.grid; y -= 1.1) { if (rnd() < 0.3) continue;
      for (const s of [-0.28, 0.28]) { const aa = a + s / (R - 0.95); onWall(aa, R - 0.97, y); M4.makeTranslation(P.x, P.y, P.z); dots.push(M4.clone()); dotCols.push(amber()); } }
  }
  const dotMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), dots.length);
  dots.forEach((m, i) => { dotMesh.setMatrixAt(i, m); dotMesh.setColorAt(i, dotCols[i]); }); ARENA.add(dotMesh);

  // ---- the laser grid: crackling green beams strung across the shaft floor ----
  const gridMat = (cell, rot, bright, speed) => new THREE.ShaderMaterial({
    extensions: { derivatives: true }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime, uCell: { value: cell }, uRot: { value: rot }, uB: { value: bright }, uSp: { value: speed } },
    vertexShader: 'varying vec2 vP; void main(){ vec4 w = modelMatrix*vec4(position,1.); vP = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float uTime, uCell, uRot, uB, uSp; varying vec2 vP;
      float h1(float x){ return fract(sin(x*127.1)*43758.5453); }
      float n1(float x){ float i=floor(x), f=fract(x); f=f*f*(3.-2.*f); return mix(h1(i), h1(i+1.), f); }
      float beam(float across, float along, float idx){
        float d = abs(fract(across/uCell + 0.5) - 0.5) * uCell;
        float id = floor(across/uCell + 0.5) + idx * 17.;
        float flick = step(0.04, h1(id + floor(uTime*8.)*0.37));                        // the odd line drops out briefly
        float crack = 0.55 + 0.9 * n1(along*2.3 + uTime*uSp*9. + id*3.1) * n1(along*7. - uTime*uSp*17. + id);
        float pulse = pow(max(0., 1. - abs(fract(along*0.045 - uTime*uSp*0.6 + h1(id)) - 0.5)*14.), 3.) * 2.5;  // energy running down the beam
        float wob = (n1(along*3. + uTime*6. + id) - 0.5) * 0.008;
        d = abs(d + wob);
        // anti-aliased core: never thinner than about a pixel, and dimmer in proportion when it would be
        float px = max(fwidth(across), 1e-4), w = max(0.018, px * 0.8);
        return flick * (exp(-pow(d / w, 2.)) * (0.018 / w) * (crack + pulse) * 1.3 + exp(-d*7.) * 0.16 * crack);
      }
      void main(){
        vec2 p = mat2(cos(uRot), -sin(uRot), sin(uRot), cos(uRot)) * vP;
        float g = beam(p.x, p.y, 0.) + beam(p.y, p.x, 1.);
        float r = length(vP) / ${(SHAFT.R).toFixed(1)};
        float node = 0.; { vec2 q = abs(fract(p/uCell + 0.5) - 0.5) * uCell; node = exp(-length(q)*14.) * (0.85 + 0.3*h1(floor(uTime*3.) + floor(p.x/uCell)*7. + floor(p.y/uCell))); }
        g = (g + node * 1.5) * smoothstep(1.0, 0.94, r) * uB;
        gl_FragColor = vec4(vec3(0.18, 1.0, 0.32) * g * 2.2 + vec3(0.6,1.,0.7) * max(0., g - 1.6) * 0.5, 1.);
      }`
  });
  [[0, 1.6, 0, 0.9, 1], [0.55, 2.3, Math.PI / 4, 0.45, -0.8]].forEach(([dy, cell, rot, b, sp]) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(R - 0.1, 96), gridMat(cell, rot, b, sp)); m.rotation.x = -Math.PI / 2; m.position.y = SHAFT.grid + dy; m.renderOrder = 2; ARENA.add(m);
  });
  // emitter heads round the wall where the beams are anchored
  const emit = [];
  for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; facing(a); onWall(a, R - 0.4, SHAFT.grid); Sc.set(1, 1, 1); M4.compose(P, Q, Sc); emit.push(M4.clone()); }
  inst(new THREE.BoxGeometry(0.5, 0.35, 0.6), darkSteel, emit);
  const emG = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.12, 0.72), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x30ff60).multiplyScalar(2.6) }), emit.length);
  emit.forEach((m, i) => emG.setMatrixAt(i, m)); ARENA.add(emG);
  // jagged electric arcs that crackle between grid nodes
  const ARCS = 14, SEG = 9, apos = new Float32Array(ARCS * SEG * 2 * 3), agl = new THREE.BufferGeometry();
  agl.setAttribute('position', new THREE.BufferAttribute(apos, 3));
  const arcs = new THREE.LineSegments(agl, new THREE.LineBasicMaterial({ color: new THREE.Color(0x7dff9a).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  arcs.frustumCulled = false; ARENA.add(arcs);
  let arcT = 0;
  anim.push((t, dt) => {
    arcT -= dt; if (arcT > 0) return; arcT = 0.05 + Math.random() * 0.07;
    let o = 0;
    for (let k = 0; k < ARCS; k++) {
      const live = Math.random() < 0.4, cell = 1.6;
      const x0 = Math.round((Math.random() - 0.5) * 30 / cell) * cell, z0 = Math.round((Math.random() - 0.5) * 30 / cell) * cell;
      const dir = Math.random() * TAU, len = 0.8 + Math.random() * 2.2, x1 = x0 + Math.cos(dir) * len, z1 = z0 + Math.sin(dir) * len;
      let px = x0, py = SHAFT.grid, pz = z0;
      for (let s = 1; s <= SEG; s++) {
        const f = s / SEG, j = s === SEG ? 0 : 0.28;
        const nx = x0 + (x1 - x0) * f + (Math.random() - 0.5) * j, ny = SHAFT.grid + Math.sin(f * Math.PI) * len * 0.25 + (Math.random() - 0.5) * j, nz = z0 + (z1 - z0) * f + (Math.random() - 0.5) * j;
        if (live) { apos.set([px, py, pz, nx, ny, nz], o); } else apos.fill(0, o, o + 6);
        o += 6; px = nx; py = ny; pz = nz;
      }
    }
    agl.attributes.position.needsUpdate = true;
  });
  // dark machinery floor far beneath the beams
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshStandardMaterial({ color: 0x0c0d10, metalness: 0.8, roughness: 0.5, normalMap: tex(HULLT.nrm, 8, 8) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = SHAFT.bottom + 0.5; ARENA.add(floor);
}

// ledge just below the stations: a heavy steel lip at the top of the shaft
{
  const prof = [[RA + 0.6, -2.4], [RA - 1.8, -2.4], [RA - 2.2, -2.9], [RA - 2.2, -3.6], [RA - 1.4, -4.4], [RA + 0.6, -4.6]].map(p => new THREE.Vector2(p[0], p[1]));
  const m = new THREE.MeshStandardMaterial({ color: 0x2c3038, metalness: 0.85, roughness: 0.38, normalMap: HULLT.nrm });
  const ledge = new THREE.Mesh(new THREE.LatheGeometry(prof, 160), m); ARENA.add(ledge);
}

// ribs: tall structural fins holding the energy membrane
const RIBS = 48;
{
  const h = 16.4, geo = THREE.RoundedBoxGeometry ? new THREE.RoundedBoxGeometry(0.7, h, 1.3, 2, 0.12) : new THREE.BoxGeometry(0.7, h, 1.3);
  const mat = new THREE.MeshStandardMaterial({ color: 0x20242f, metalness: 0.9, roughness: 0.28, normalMap: ARMN });
  const ribs = new THREE.InstancedMesh(geo, mat, RIBS);
  const sg = new THREE.BoxGeometry(0.1, h - 1.2, 0.06), strips = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0xffffff }), RIBS * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < RIBS; i++) {
    const a = i / RIBS * TAU; q.setFromAxisAngle(up, -a + Math.PI / 2);
    p.set(Math.cos(a) * (RA + 0.1), -2.4 + h / 2, Math.sin(a) * (RA + 0.1)); m4.compose(p, q, one); ribs.setMatrixAt(i, m4);
    for (const side of [-1, 1]) {
      const k = i * 2 + (side > 0 ? 1 : 0), off = 0.28 * side, ta = a + Math.PI / 2;
      p.set(Math.cos(a) * (RA - 0.58) + Math.cos(ta) * off, -2.4 + h / 2, Math.sin(a) * (RA - 0.58) + Math.sin(ta) * off);
      m4.compose(p, q, one); strips.setMatrixAt(k, m4);
      const c = i % 4 === 0 ? new THREE.Color(0xff1414).multiplyScalar(3.2) : new THREE.Color(0x1650ff).multiplyScalar(i % 2 ? 1.2 : 2.4);
      strips.setColorAt(k, c);
    }
  }
  ribs.castShadow = false; ribs.receiveShadow = true; ARENA.add(ribs, strips);
}

// energy membrane between the ribs; lights up in hexes wherever a disc strikes it
const WALL_HITS = []; for (let i = 0; i < 10; i++) WALL_HITS.push(new THREE.Vector4(0, -999, 0, -99));
const WALL_HIT_COL = []; for (let i = 0; i < 10; i++) WALL_HIT_COL.push(new THREE.Vector3(0, 1, 1));
let wallHitIdx = 0;
const membraneMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uTime, uHits: { value: WALL_HITS }, uHitCol: { value: WALL_HIT_COL }, uAxis: { value: 0 }, uTint: { value: new THREE.Color(0x1650ff) } },
  vertexShader: 'varying vec3 vWP; varying vec2 vUv; void main(){ vUv=uv; vec4 w = modelMatrix*vec4(position,1.); vWP = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: `
    uniform float uTime, uAxis; uniform vec3 uTint; uniform vec4 uHits[10]; uniform vec3 uHitCol[10]; varying vec3 vWP; varying vec2 vUv;
    vec4 hexCoords(vec2 uv){ vec2 r = vec2(1., 1.7320508); vec2 h = r*0.5; vec2 a = mod(uv, r)-h; vec2 b = mod(uv-h, r)-h; vec2 gv = dot(a,a) < dot(b,b) ? a : b; float x = atan(gv.x, gv.y); float y = 0.5 - max(abs(gv.x), dot(abs(gv), normalize(r))); return vec4(gv, y, 0.); }
    void main(){
      float u = uAxis > 0.5 ? vWP.x : vWP.z; vec2 p = vec2(u, vWP.y) / 1.25;
      vec4 hx = hexCoords(p);
      float edge = smoothstep(0.06, 0.0, hx.z);
      float yy = (vWP.y + 2.4) / ${(YC + 2.4).toFixed(1)};
      vec3 base = mix(uTint, vec3(0.32,0.04,0.9), yy * 0.5);
      float scan = smoothstep(0.08, 0., abs(fract(yy*1.5 - uTime*0.12) - 0.5) - 0.42);
      // the original arena's horizontal wall lines
      float lines = smoothstep(0.06, 0.0, abs(fract((vWP.y + 2.4) / 1.9) - 0.5) - 0.44);
      float a = edge * (0.012 + 0.03*scan) + lines * 0.055 + 0.002 + scan * 0.004;
      vec3 col = base * a;
      // strike ripples
      for (int i = 0; i < 10; i++) {
        vec4 hh = uHits[i]; float age = uTime - hh.w; if (age < 0. || age > 1.6) continue;
        float d = distance(vWP, hh.xyz);
        float wave = smoothstep(1.2, 0., abs(d - age * 9.)) * (1. - age/1.6);
        float core = exp(-d*0.9) * exp(-age*3.5) * 3.;
        col += uHitCol[i] * (edge * (wave * 2.2 + core) + core * 0.25 + wave * 0.12);
      }
      float fadeEnds = smoothstep(0., 0.04, yy) * smoothstep(1., 0.96, yy);
      gl_FragColor = vec4(col * fadeEnds, 1.);
    }`
});
// the court: four glass walls with neon frames, rebuilt to fit the number of runners
const COURT = { g: null };
function buildCourt() {
  if (COURT.g) { ARENA.remove(COURT.g); COURT.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== membraneMat) o.material.dispose(); }); }
  const g = new THREE.Group(), hx = BOX.hx, hz = BOX.hz, H = YC + 2.4, yMid = -2.4 + H / 2;
  const wall = (w, x, z, ry, axis, tint) => {
    const m = membraneMat.clone(); m.uniforms = Object.assign({}, membraneMat.uniforms, { uAxis: { value: axis }, uTint: { value: new THREE.Color(tint) } });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, H, 1, 1), m); mesh.position.set(x, yMid, z); mesh.rotation.y = ry; mesh.renderOrder = 2; g.add(mesh);
  };
  // all four walls and the roof share one deep purple, so red and blue belong to the runners
  wall(2 * hz, hx, 0, -Math.PI / 2, 0, 0x5a12ff); wall(2 * hz, -hx, 0, Math.PI / 2, 0, 0x5a12ff);
  wall(2 * hx, 0, hz, Math.PI, 1, 0x5a12ff); wall(2 * hx, 0, -hz, 0, 1, 0x5a12ff);
  // frame beams along every edge of the box
  const beam = (len, x, y, z, axis, color, k, th) => { const s = [th || 0.14, th || 0.14, th || 0.14]; s[axis] = len; const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), emissiveMat(color, k)); m.position.set(x, y, z); g.add(m); };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(H + 0.04, sx * hx, yMid, sz * hz, 1, 0x5a12ff, 3, 0.17);
  for (const y of [-2.4, YC]) for (const s of [-1, 1]) { beam(2 * hx, 0, y, s * hz, 0, 0x5a12ff, 2.6); beam(2 * hz, s * hx, y, 0, 2, 0x5a12ff, 2.6, 0.155); }
  ARENA.add(g); COURT.g = g;
  for (const l of RIMS) l.position.set(l.userData.sx * (hx - 1.5), 7, l.userData.sz * (hz - 1.5));
  buildCeiling();
}
function wallFlash(x, y, z, colorHex) {
  const v = WALL_HITS[wallHitIdx]; v.set(x, y, z, uTime.value);
  const c = new THREE.Color(colorHex); WALL_HIT_COL[wallHitIdx].set(c.r, c.g, c.b);
  wallHitIdx = (wallHitIdx + 1) % WALL_HITS.length;
}

// upper band and LED ticker
{
  const band = new THREE.Mesh(new THREE.CylinderGeometry(RA - 0.2, RA - 0.2, 3.4, 128, 1, true), (() => {
    const m = metalDark.clone(); m.side = THREE.BackSide; m.map = WALLT.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(16, 0.5);
    m.normalMap = WALLT.nrm.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set(16, 0.5); m.emissiveMap = null; m.emissive = new THREE.Color(0); return m;
  })());
  band.position.y = YC - 1.7; ARENA.add(band);
  const tick = new THREE.Mesh(new THREE.CylinderGeometry(RA - 0.9, RA - 0.9, 1.5, 128, 1, true), new THREE.MeshBasicMaterial({ map: TICKT, side: THREE.BackSide, color: new THREE.Color(1.8, 1.8, 1.8) }));
  TICKT.repeat.set(-3, 1); tick.position.y = YC - 2.3; ARENA.add(tick);
  anim.push((t) => { TICKT.offset.x = (t * 0.018) % 1; });
  for (const y of [YC - 3.15, YC - 1.45]) { const r = new THREE.Mesh(new THREE.TorusGeometry(RA - 0.95, 0.05, 6, 200), emissiveMat(0x1650ff, 3)); r.rotation.x = Math.PI / 2; r.position.y = y; ARENA.add(r); }
}

// ceiling: smoked-glass hex plates with light seams over the court, open oculus in the middle
const CEIL = { plates: [], seams: null, pm: null, pulses: [] };
function buildCeiling() {
  if (CEIL.pm) { ARENA.remove(CEIL.pm, CEIL.seams); CEIL.pm.dispose && CEIL.pm.dispose(); CEIL.seams.dispose && CEIL.seams.dispose(); }
  const s = 1.55, plates = [], rOcc = 7.5;
  for (let q = -30; q <= 30; q++) for (let r = -30; r <= 30; r++) {
    const x = s * Math.sqrt(3) * (q + r / 2), z = s * 1.5 * r, d = Math.hypot(x, z);
    if (Math.abs(x) < BOX.hx - s * 1.05 && Math.abs(z) < BOX.hz - s * 1.05 && d > rOcc + 0.8) plates.push([x, z, d]);
  }
  const plateGeo = new THREE.CylinderGeometry(s * 0.97, s * 0.97, 0.22, 6);   // pointy along z, matching the axial grid
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x0a0b12, metalness: 0.9, roughness: 0.22, transparent: true, opacity: 0.94 });
  const seamGeo = new THREE.RingGeometry(s * 0.955, s * 1.0, 6, 1); seamGeo.rotateX(Math.PI / 2); seamGeo.rotateY(Math.PI / 6);
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const pm = new THREE.InstancedMesh(plateGeo, plateMat, plates.length), sm = new THREE.InstancedMesh(seamGeo, seamMat, plates.length);
  const m4 = new THREE.Matrix4(); const col = new THREE.Color();
  plates.forEach(([x, z], i) => { m4.makeTranslation(x, YC + 0.12, z); pm.setMatrixAt(i, m4); m4.makeTranslation(x, YC - 0.02, z); sm.setMatrixAt(i, m4); sm.setColorAt(i, col.setRGB(0.1, 0.4, 0.6)); });
  ARENA.add(pm, sm);
  CEIL.plates = plates; CEIL.seams = sm; CEIL.pm = pm;
}
{
  const rOcc = 7.5;
  const occ = new THREE.Mesh(new THREE.TorusGeometry(rOcc + 0.4, 0.22, 10, 120), emissiveMat(0x5a12ff, 3.5)); occ.rotation.x = Math.PI / 2; occ.position.y = YC; ARENA.add(occ);
  const occ2 = new THREE.Mesh(new THREE.TorusGeometry(rOcc + 1.1, 0.06, 6, 120), emissiveMat(0xb46bff, 3)); occ2.rotation.x = Math.PI / 2; occ2.position.y = YC - 0.1; ARENA.add(occ2);
  // hanging emblem under the oculus
  const emb = new THREE.Group(); emb.position.y = YC + 2;
  const e1 = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.12, 8, 120), emissiveMat(0x5a12ff, 3)); e1.rotation.x = Math.PI / 2;
  const e2 = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.07, 8, 120, Math.PI * 1.6), emissiveMat(0xb46bff, 3));
  const e3 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.07, 8, 120, Math.PI * 1.2), emissiveMat(0xffffff, 2.5));
  emb.add(e1, e2, e3); ARENA.add(emb);
  anim.push((t) => { e2.rotation.x = t * 0.6; e2.rotation.y = t * 0.3; e3.rotation.y = -t * 0.9; e3.rotation.z = t * 0.4; emb.rotation.y = t * 0.15; });
  // light shaft falling through the oculus
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime },
    vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform float uTime; varying vec2 vUv; varying vec3 vN, vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 3.); float a = f * smoothstep(0.,0.6,vUv.y) * 0.022 * (0.85+0.15*sin(vUv.y*30.+uTime)); gl_FragColor = vec4(vec3(0.55,0.15,1.)*a,1.); }'
  });
  const ls = new THREE.Mesh(new THREE.CylinderGeometry(rOcc, rOcc + 3, 40, 48, 1, true), shaftMat); ls.position.y = YC - 20; ARENA.add(ls);
}
function ceilFlash(x, z, colorHex) { CEIL.pulses.push({ x, z, t: uTime.value, c: new THREE.Color(colorHex) }); if (CEIL.pulses.length > 6) CEIL.pulses.shift(); }
{
  const col = new THREE.Color(), base = new THREE.Color();
  let acc = 0;
  anim.push((t, dt) => {
    acc += dt; if (acc < 1 / 30) return; acc = 0;
    const { plates, seams, pulses } = CEIL;
    for (let i = 0; i < plates.length; i++) {
      const [x, z, d] = plates[i];
      const wave = 0.5 + 0.5 * Math.sin(d * 0.35 - t * 1.4);
      base.setRGB(0.08 + 0.42 * wave * wave, 0.01 + 0.04 * wave * wave, 0.2 + 0.85 * wave * wave);
      col.copy(base);
      for (const p of pulses) { const age = t - p.t; if (age < 0 || age > 1.4) continue; const dd = Math.hypot(x - p.x, z - p.z); const w = Math.max(0, 1 - Math.abs(dd - age * 14) / 2.2) * (1 - age / 1.4) * 5; if (w > 0) col.r += p.c.r * w, col.g += p.c.g * w, col.b += p.c.b * w; }
      seams.setColorAt(i, col);
    }
    seams.instanceColor.needsUpdate = true;
  });
}

// floating dust motes catching the light
{
  const n = 700, pos = new Float32Array(n * 3), rnd = mulberry(21);
  for (let i = 0; i < n; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * (RA - 2); pos.set([Math.cos(a) * r, rnd() * 30 - 12, Math.sin(a) * r], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime, uPR: { value: 1 } },
    vertexShader: 'uniform float uTime, uPR; varying float vA; void main(){ vec3 p = position; p.y += sin(uTime*0.3 + p.x)*0.6; p.x += sin(uTime*0.2+p.z)*0.5; vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = uPR*60./-mv.z; vA = clamp(1.-(-mv.z)/40.,0.,1.); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.,d)*vA*0.25; gl_FragColor = vec4(vec3(0.4,0.55,1.)*a,1.); }'
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; ARENA.add(pts); CITY.dust = m;
}

/* ================= lights ================= */
const hemi = new THREE.HemisphereLight(0x2a3cc0, 0x3a0408, 0.24); scene.add(hemi);
const sunLight = new THREE.SpotLight(0xd8e6ff, 1.25, 70, 0.95, 0.6, 1.2);
sunLight.position.set(0, YC + 4, 0); sunLight.target.position.set(0, -2, 0); sunLight.castShadow = true;
sunLight.shadow.mapSize.set(QUALS[S.quality].shadow, QUALS[S.quality].shadow); sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.03; sunLight.shadow.radius = 3;
sunLight.shadow.camera.near = 4; sunLight.shadow.camera.far = 40;
scene.add(sunLight, sunLight.target);
const RIMS = [];
// two rim lights on opposite corners (every point light costs on every lit pixel, so they're kept few)
[[0x1650ff, 1, 1], [0xff1414, -1, -1]].forEach(([c, sx, sz]) => {
  const l = new THREE.PointLight(c, 1.7, 60, 1.5); l.userData.sx = sx; l.userData.sz = sz; l.position.set(sx * 18, 7, sz * 18); scene.add(l); RIMS.push(l);
});
// warm work light down the shaft (no coloured neon in there)
const under = new THREE.PointLight(0xffd2a0, 1.6, 70, 1.3); under.position.set(0, -16, 0); scene.add(under);


// image-based lighting: a small neon "studio" so metal and glass pick up cyan/magenta reflections
{
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ color: 0x07060f, side: THREE.BackSide })));
  const strip = (c, i, x, y, z, w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i) })); m.position.set(x, y, z); env.add(m); };
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; strip(i % 2 ? 0xff1414 : 0x1650ff, 1.5, Math.cos(a) * 30, 2, Math.sin(a) * 30, 1.5, 22, 1.5); }
  strip(0xffffff, 0.55, 0, 34, 0, 26, 1, 26); strip(0x1424ff, 1, 0, -30, 0, 40, 1, 40);
  strip(0xff1a0a, 1.4, 25, -8, 0, 4, 2, 40);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.02).texture; pm.dispose();
}

/* ================= effects: sparks, ripples, shockwaves, shards ================= */
const FX = { sparks: null, rings: [], shards: null };
{
  // sparks: one big Points buffer with per-particle colour and life
  const N = 2400, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, uniforms: { uPR: { value: 1 } },
    vertexShader: 'attribute float aSize; uniform float uPR; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = aSize*uPR*300./max(-mv.z,0.5); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vC; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(vC*a*a*2.,1.); }'
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
  FX.sparks = { pts, pos, col, size, vel: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), base: new Float32Array(N * 3), n: N, i: 0, mat: m };
}
function sparks(x, y, z, colorHex, count, speed, life, sz) {
  const S2 = FX.sparks, c = new THREE.Color(colorHex);
  for (let k = 0; k < count; k++) {
    const i = S2.i; S2.i = (S2.i + 1) % S2.n;
    const u = Math.random() * 2 - 1, a = Math.random() * TAU, r = Math.sqrt(1 - u * u), sp = speed * (0.3 + Math.random() * 0.9);
    S2.pos[i * 3] = x; S2.pos[i * 3 + 1] = y; S2.pos[i * 3 + 2] = z;
    S2.vel[i * 3] = r * Math.cos(a) * sp; S2.vel[i * 3 + 1] = u * sp + speed * 0.2; S2.vel[i * 3 + 2] = r * Math.sin(a) * sp;
    S2.life[i] = S2.max[i] = life * (0.5 + Math.random() * 0.8);
    const w = Math.random() < 0.25 ? 1 : 0; S2.base[i * 3] = lerp(c.r, 1, w); S2.base[i * 3 + 1] = lerp(c.g, 1, w); S2.base[i * 3 + 2] = lerp(c.b, 1, w);
    S2.size[i] = (sz || 0.06) * (0.6 + Math.random() * 0.8);
  }
}
function updateSparks(dt) {
  const S2 = FX.sparks;
  for (let i = 0; i < S2.n; i++) {
    if (S2.life[i] <= 0) { if (S2.size[i] !== 0) { S2.size[i] = 0; S2.col[i * 3] = S2.col[i * 3 + 1] = S2.col[i * 3 + 2] = 0; } continue; }
    S2.life[i] -= dt; const k = Math.max(0, S2.life[i] / S2.max[i]);
    S2.vel[i * 3 + 1] -= 9 * dt; const dr = Math.exp(-2.2 * dt); S2.vel[i * 3] *= dr; S2.vel[i * 3 + 1] *= dr; S2.vel[i * 3 + 2] *= dr;
    S2.pos[i * 3] += S2.vel[i * 3] * dt; S2.pos[i * 3 + 1] += S2.vel[i * 3 + 1] * dt; S2.pos[i * 3 + 2] += S2.vel[i * 3 + 2] * dt;
    S2.col[i * 3] = S2.base[i * 3] * k * 2; S2.col[i * 3 + 1] = S2.base[i * 3 + 1] * k * 2; S2.col[i * 3 + 2] = S2.base[i * 3 + 2] * k * 2;
  }
  const g = S2.pts.geometry; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
}
// expanding shockwave rings (oriented to a surface normal)
const ringGeo = new THREE.RingGeometry(0.82, 1, 64);
function shockRing(x, y, z, nx, ny, nz, colorHex, size, life) {
  const m = new THREE.Mesh(ringGeo, glowMat(colorHex, 3, 1)); m.position.set(x, y, z);
  const n = new THREE.Vector3(nx, ny, nz).normalize(); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  m.material.side = THREE.DoubleSide; scene.add(m); FX.rings.push({ m, t: 0, life: life || 0.45, size: size || 2 });
}
function updateRings(dt) {
  for (let i = FX.rings.length - 1; i >= 0; i--) {
    const r = FX.rings[i]; r.t += dt; const k = r.t / r.life;
    if (k >= 1) { scene.remove(r.m); r.m.material.dispose(); FX.rings.splice(i, 1); continue; }
    const s = 0.2 + r.size * (1 - Math.pow(1 - k, 3)); r.m.scale.set(s, s, s); r.m.material.opacity = (1 - k) * (1 - k);
  }
}
// voxel shards for a flatlined runner
{
  const N = 900, geo = new THREE.BoxGeometry(0.09, 0.09, 0.09), mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; im.count = N; scene.add(im);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < N; i++) { im.setMatrixAt(i, zero); im.setColorAt(i, new THREE.Color(0)); }
  FX.shards = { im, n: N, i: 0, p: new Float32Array(N * 3), v: new Float32Array(N * 3), life: new Float32Array(N), g: new Float32Array(N), c: [], rot: new Float32Array(N), zero };
}
function shatter(x, y, z, colorHex, vx, vz) {
  const S3 = FX.shards, c = new THREE.Color(colorHex);
  for (let k = 0; k < 260; k++) {
    const i = S3.i; S3.i = (S3.i + 1) % S3.n;
    S3.p[i * 3] = x + rand(-0.35, 0.35); S3.p[i * 3 + 1] = y + rand(0, 1.9); S3.p[i * 3 + 2] = z + rand(-0.35, 0.35);
    S3.v[i * 3] = rand(-3, 3) + vx * 0.4; S3.v[i * 3 + 1] = rand(-1, 4); S3.v[i * 3 + 2] = rand(-3, 3) + vz * 0.4;
    S3.life[i] = rand(0.8, 1.8); S3.rot[i] = rand(0, 10); S3.g[i] = 6;
    const w = Math.random() < 0.3; S3.im.setColorAt(i, w ? new THREE.Color(3, 3, 3) : c.clone().multiplyScalar(2.6));
  }
  S3.im.instanceColor.needsUpdate = true;
}
// de-rez: a runner who hits the laser grid dissolves from the feet up into drifting voxels
const DEREZ = [];
function derez(p) {
  p.y = Math.max(p.y, SHAFT.grid); p.derezAt = uTime.value;
  DEREZ.push({ x: p.x, y: p.y, z: p.z, c: new THREE.Color(p.color), t: 0, acc: 0 });
  shockRing(p.x, p.y + 0.05, p.z, 0, 1, 0, 0x30ff60, 6, 0.8); sparks(p.x, p.y + 0.3, p.z, 0x40ff70, 90, 9, 0.9, 0.07);
}
function updateDerez(dt) {
  const S3 = FX.shards, G = new THREE.Color(0x30ff60);
  for (let k = DEREZ.length - 1; k >= 0; k--) {
    const d = DEREZ[k]; d.t += dt; if (d.t > 1.5) { DEREZ.splice(k, 1); continue; }
    if (d.t > 1.05) continue;
    d.acc += dt * 340; const band = d.t / 1.05 * 1.95;
    while (d.acc >= 1) {
      d.acc -= 1; const i = S3.i; S3.i = (S3.i + 1) % S3.n;
      const a = Math.random() * TAU, r = Math.random() * 0.32;
      S3.p[i * 3] = d.x + Math.cos(a) * r; S3.p[i * 3 + 1] = d.y + band + rand(-0.12, 0.12); S3.p[i * 3 + 2] = d.z + Math.sin(a) * r;
      S3.v[i * 3] = Math.cos(a) * rand(0.2, 1.4); S3.v[i * 3 + 1] = rand(0.4, 2.6); S3.v[i * 3 + 2] = Math.sin(a) * rand(0.2, 1.4);
      S3.life[i] = rand(0.45, 1.25); S3.rot[i] = rand(0, 10); S3.g[i] = -1.6;
      const w = Math.random(); S3.im.setColorAt(i, w < 0.45 ? G.clone().multiplyScalar(rand(1.6, 3.2)) : w < 0.85 ? d.c.clone().multiplyScalar(2.6) : new THREE.Color(3, 3, 3));
    }
    S3.im.instanceColor.needsUpdate = true;
  }
}
{
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  var updateShards = function (dt) {
    const S3 = FX.shards; let any = false;
    for (let i = 0; i < S3.n; i++) {
      if (S3.life[i] <= 0) continue; any = true;
      S3.life[i] -= dt;
      if (S3.life[i] <= 0) { S3.im.setMatrixAt(i, S3.zero); continue; }
      S3.v[i * 3 + 1] -= S3.g[i] * dt;
      S3.p[i * 3] += S3.v[i * 3] * dt; S3.p[i * 3 + 1] += S3.v[i * 3 + 1] * dt; S3.p[i * 3 + 2] += S3.v[i * 3 + 2] * dt;
      S3.rot[i] += dt * 6; e.set(S3.rot[i], S3.rot[i] * 0.7, 0); q.setFromEuler(e);
      const sc = Math.min(1, S3.life[i] * 1.5); s.set(sc, sc, sc); p.set(S3.p[i * 3], S3.p[i * 3 + 1], S3.p[i * 3 + 2]);
      m4.compose(p, q, s); S3.im.setMatrixAt(i, m4);
    }
    if (any) S3.im.instanceMatrix.needsUpdate = true;
  };
}

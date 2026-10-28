// Z-fighting scanner: paste into the page (or run via tools/browser-test.py with FULL=1) after a match has started.
// Lists pairs of parallel, overlapping triangles from different meshes/instances that sit closer than 2 cm.
// Hidden faces (inside buildings, below the pit floor) also show up, so judge each hit by whether it can be seen.
(() => {
  const H = __hd, scene = H.scene; scene.updateMatrixWorld(true);
  const TH = 0.02;                               // flag surfaces closer than 2 cm
  const tris = [];                               // [ax,ay,az,bx,by,bz,cx,cy,cz, nx,ny,nz, d, objId, inst, frontOnly]
  const objs = [];
  const label = o => { const parts = []; let q = o; for (let i = 0; i < 4 && q; i++) { parts.push((q.name || q.type) + (q.geometry ? ':' + q.geometry.type : '')); q = q.parent; } return parts.join(' < '); };
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], m = new THREE.Matrix4(), mi = new THREE.Matrix4();
  scene.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh) return;
    let vis = true, q = o; while (q) { if (!q.visible) vis = false; q = q.parent; } if (!vis) return;
    const g = o.geometry, P = g.attributes.position; if (!P) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mat.wireframe) return;
    const id = objs.length; objs.push({ label: label(o), mat: mat.type + (mat.color ? '#' + mat.color.getHexString() : '') + (mat.transparent ? ' transp' : '') + (mat.blending === 2 ? ' additive' : '') + (mat.side === 2 ? ' double' : mat.side === 1 ? ' back' : ''), side: mat.side });
    const idx = g.index ? g.index.array : null, n = idx ? idx.length : P.count;
    const count = o.isInstancedMesh ? o.count : 1;
    if (n / 3 * count > 400000) return;
    for (let k = 0; k < count; k++) {
      m.copy(o.matrixWorld); if (o.isInstancedMesh) { o.getMatrixAt(k, mi); m.multiply(mi); }
      if (Math.abs(m.determinant()) < 1e-9) continue;
      for (let t = 0; t + 2 < n; t += 3) {
        for (let j = 0; j < 3; j++) { const i = idx ? idx[t + j] : t + j; v[j].fromBufferAttribute(P, i).applyMatrix4(m); }
        const e1x = v[1].x - v[0].x, e1y = v[1].y - v[0].y, e1z = v[1].z - v[0].z, e2x = v[2].x - v[0].x, e2y = v[2].y - v[0].y, e2z = v[2].z - v[0].z;
        let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const A = Math.hypot(nx, ny, nz); if (A < 1e-6) continue;
        nx /= A; ny /= A; nz /= A;
        tris.push([v[0].x, v[0].y, v[0].z, v[1].x, v[1].y, v[1].z, v[2].x, v[2].y, v[2].z, nx, ny, nz, nx * v[0].x + ny * v[0].y + nz * v[0].z, id, k]);
      }
    }
  });
  // bucket by plane: canonical normal (sign-flipped so the largest component is positive) + offset
  const buckets = new Map(), Q = 0.03, DQ = 0.05;
  const keyOf = (nx, ny, nz, d) => { const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz); const s = (ax >= ay && ax >= az ? nx : ay >= az ? ny : nz) < 0 ? -1 : 1; return [Math.round(nx * s / Q), Math.round(ny * s / Q), Math.round(nz * s / Q), d * s, s]; };
  tris.forEach((t, i) => { const [a, b, c, dd, s] = keyOf(t[9], t[10], t[11], t[12]); const di = Math.round(dd / DQ); const key = a + ',' + b + ',' + c + ',' + di; t.push(s, dd); let L = buckets.get(key); if (!L) buckets.set(key, L = []); L.push(i); });
  // 2-D triangle overlap after projecting onto the dominant plane
  const proj = (t, ax) => ax === 0 ? [[t[1], t[2]], [t[4], t[5]], [t[7], t[8]]] : ax === 1 ? [[t[0], t[2]], [t[3], t[5]], [t[6], t[8]]] : [[t[0], t[1]], [t[3], t[4]], [t[6], t[7]]];
  const sepAxis = (A, B) => { for (const T of [A, B]) for (let i = 0; i < 3; i++) { const p = T[i], q = T[(i + 1) % 3], nx = q[1] - p[1], ny = p[0] - q[0]; let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const r of A) { const d = r[0] * nx + r[1] * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); } for (const r of B) { const d = r[0] * nx + r[1] * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); } const tol = 1e-3 * Math.hypot(nx, ny); if (a1 <= b0 + tol || b1 <= a0 + tol) return true; } return false; };
  const hits = new Map();
  const seen = new Set();
  for (const [key, L] of buckets) {
    const [a, b, c, di] = key.split(',').map(Number);
    const cand = [];
    for (const dd of [-1, 0, 1]) { const L2 = buckets.get(a + ',' + b + ',' + c + ',' + (di + dd)); if (L2) cand.push(...L2); }
    if (L.length * cand.length > 4e6) continue;
    for (const i of L) for (const j of cand) {
      if (j <= i) continue; const A = tris[i], B = tris[j];
      if (A[13] === B[13] && A[14] === B[14]) continue;            // same object instance
      if (Math.abs(A[16] - B[16]) > TH * 3) continue;
      const nd = A[9] * B[9] + A[10] * B[10] + A[11] * B[11]; if (Math.abs(nd) < 0.9995) continue;    // truly parallel
      // real separation: distance of B's corners from A's plane
      const dA = A[9] * A[0] + A[10] * A[1] + A[11] * A[2]; let gap = 0;
      for (let q = 0; q < 9; q += 3) gap = Math.max(gap, Math.abs(A[9] * B[q] + A[10] * B[q + 1] + A[11] * B[q + 2] - dA));
      if (gap > TH) continue;
      const same = A[15] === B[15];                                 // facing the same way
      const sa = objs[A[13]].side, sb = objs[B[13]].side;
      if (!same && sa === 0 && sb === 0) continue;                  // back-to-back single-sided faces never show together
      const ax = Math.abs(A[9]) >= Math.abs(A[10]) && Math.abs(A[9]) >= Math.abs(A[11]) ? 0 : Math.abs(A[10]) >= Math.abs(A[11]) ? 1 : 2;
      if (sepAxis(proj(A, ax), proj(B, ax))) continue;
      const pk = Math.min(A[13], B[13]) + '|' + Math.max(A[13], B[13]);
      let h = hits.get(pk); if (!h) hits.set(pk, h = { a: objs[A[13]], b: objs[B[13]], n: 0, gap: 1, at: [A[0].toFixed(1), A[1].toFixed(1), A[2].toFixed(1)], sameInst: A[13] === B[13] });
      h.n++; h.gap = Math.min(h.gap, gap);
    }
  }
  const out = [...hits.values()].sort((p, q) => q.n - p.n).map(h => `${h.n} tri pairs, gap ${(h.gap * 100).toFixed(1)}cm at (${h.at}) :: ${h.a.label} [${h.a.mat}]  <->  ${h.sameInst ? '(other instance) ' : ''}${h.b.label} [${h.b.mat}]`);
  return { tris: tris.length, objects: objs.length, pairs: out.length, list: out.slice(0, 200) };
})()

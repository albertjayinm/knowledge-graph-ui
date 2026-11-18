/**
 * 3D force-directed layout with two phases:
 *  - layout: d3-style charge / link / gravity forces with alpha cooling
 *  - kinetic: once settled, nodes spring back to their rest ("home") positions,
 *    which gives the elastic, jelly-like response to cursor forces and impulses.
 */
const BARNES_HUT_MIN_NODES = 400;

export class ForceLayout {
  readonly n: number;
  readonly pos: Float32Array;
  readonly vel: Float32Array;
  readonly home: Float32Array;

  alpha = 1;
  alphaTarget = 0;
  settled = false;

  private readonly alphaMin = 0.001;
  private readonly alphaDecay = 1 - Math.pow(0.001, 1 / 300);
  private readonly charge = -70;
  private readonly linkDistance = 32;
  private readonly gravity = 0.015;
  private readonly velocityDecay = 0.6;
  private readonly springK = 0.025;
  private readonly springDamping = 0.86;
  private readonly coupling = 0.012;

  private readonly src: Int32Array;
  private readonly tgt: Int32Array;
  private readonly strength: Float32Array;
  private readonly bias: Float32Array;
  private pinned = -1;
  private readonly pinPos = new Float32Array(3);
  private readonly octree = new Octree();

  constructor(n: number, links: Array<[number, number]>, seed = 7) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.home = new Float32Array(n * 3);

    const m = links.length;
    this.src = new Int32Array(m);
    this.tgt = new Int32Array(m);
    this.strength = new Float32Array(m);
    this.bias = new Float32Array(m);

    const deg = new Int32Array(n);
    for (const [s, t] of links) {
      deg[s]++;
      deg[t]++;
    }
    links.forEach(([s, t], k) => {
      this.src[k] = s;
      this.tgt[k] = t;
      this.strength[k] = 1 / Math.max(1, Math.min(deg[s], deg[t]));
      this.bias[k] = deg[s] / (deg[s] + deg[t]);
    });

    const rand = mulberry32(seed);
    const r = 14 * Math.cbrt(Math.max(n, 1));
    for (let i = 0; i < n; i++) {
      let x: number, y: number, z: number;
      do {
        x = rand() * 2 - 1;
        y = rand() * 2 - 1;
        z = rand() * 2 - 1;
      } while (x * x + y * y + z * z > 1);
      this.pos[i * 3] = x * r;
      this.pos[i * 3 + 1] = y * r;
      this.pos[i * 3 + 2] = z * r;
    }
    this.home.set(this.pos);
  }

  reheat(alpha = 0.3): void {
    this.alpha = Math.max(this.alpha, alpha);
    this.settled = false;
  }

  pin(i: number, x: number, y: number, z: number): void {
    this.pinned = i;
    this.pinPos[0] = x;
    this.pinPos[1] = y;
    this.pinPos[2] = z;
  }

  unpin(): void {
    this.pinned = -1;
  }

  impulse(i: number, x: number, y: number, z: number): void {
    const o = i * 3;
    this.vel[o] += x;
    this.vel[o + 1] += y;
    this.vel[o + 2] += z;
  }

  step(): void {
    if (this.settled) this.kineticStep();
    else this.layoutStep();

    if (this.pinned >= 0) {
      const o = this.pinned * 3;
      this.pos.set(this.pinPos, o);
      this.vel[o] = this.vel[o + 1] = this.vel[o + 2] = 0;
    }
  }

  private layoutStep(): void {
    const { n, pos: p, vel: v } = this;
    this.alpha += (this.alphaTarget - this.alpha) * this.alphaDecay;
    const a = this.alpha;

    for (let k = 0; k < this.src.length; k++) {
      const s = this.src[k] * 3;
      const t = this.tgt[k] * 3;
      let dx = p[t] + v[t] - p[s] - v[s];
      let dy = p[t + 1] + v[t + 1] - p[s + 1] - v[s + 1];
      let dz = p[t + 2] + v[t + 2] - p[s + 2] - v[s + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      const l = ((len - this.linkDistance) / len) * a * this.strength[k];
      dx *= l;
      dy *= l;
      dz *= l;
      const b = this.bias[k];
      v[t] -= dx * b;
      v[t + 1] -= dy * b;
      v[t + 2] -= dz * b;
      v[s] += dx * (1 - b);
      v[s + 1] += dy * (1 - b);
      v[s + 2] += dz * (1 - b);
    }

    const c = this.charge * a;
    if (n > BARNES_HUT_MIN_NODES) this.octree.applyCharge(p, v, n, c);
    else this.pairwiseCharge(p, v, n, c);

    const g = this.gravity * a;
    for (let i = 0; i < n * 3; i++) {
      v[i] = (v[i] - p[i] * g) * this.velocityDecay;
      p[i] += v[i];
    }

    if (this.alpha < this.alphaMin && this.alphaTarget === 0) {
      this.settled = true;
      this.home.set(p);
    }
  }

  private pairwiseCharge(p: Float32Array, v: Float32Array, n: number, c: number): void {
    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      for (let j = i + 1; j < n; j++) {
        const jx = j * 3;
        let dx = p[jx] - p[ix];
        let dy = p[jx + 1] - p[ix + 1];
        let dz = p[jx + 2] - p[ix + 2];
        let d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1e-6) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          dz = Math.random() - 0.5;
          d2 = dx * dx + dy * dy + dz * dz;
        }
        const w = c / Math.max(d2, 4);
        v[ix] += dx * w;
        v[ix + 1] += dy * w;
        v[ix + 2] += dz * w;
        v[jx] -= dx * w;
        v[jx + 1] -= dy * w;
        v[jx + 2] -= dz * w;
      }
    }
  }

  private kineticStep(): void {
    const { n, pos: p, vel: v, home: h } = this;

    // Shape-preserving coupling: neighbours follow a displaced node like a mesh of springs.
    const cp = this.coupling;
    for (let k = 0; k < this.src.length; k++) {
      const s = this.src[k] * 3;
      const t = this.tgt[k] * 3;
      for (let d = 0; d < 3; d++) {
        const delta = (p[t + d] - p[s + d] - (h[t + d] - h[s + d])) * cp;
        v[s + d] += delta;
        v[t + d] -= delta;
      }
    }

    for (let i = 0; i < n * 3; i++) {
      v[i] = (v[i] + (h[i] - p[i]) * this.springK) * this.springDamping;
      p[i] += v[i];
    }
  }
}

const EMPTY = -1;
const INTERNAL = -2;
const BUCKET = -3;
const MAX_DEPTH = 24;
const THETA2 = 0.81;

/** Barnes-Hut octree in flat typed arrays: distant clusters repel as one body, making charge O(n log n). */
class Octree {
  private cap = 0;
  private count = 0;
  private child = new Int32Array(0);
  private body = new Int32Array(0);
  private mass = new Float32Array(0);
  private com = new Float32Array(0);
  private center = new Float32Array(0);
  private half = new Float32Array(0);
  private stack = new Int32Array(0);

  applyCharge(p: Float32Array, v: Float32Array, n: number, c: number): void {
    this.build(p, n);
    const { child, body, mass, com, half, stack } = this;
    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      const px = p[ix], py = p[ix + 1], pz = p[ix + 2];
      let fx = 0, fy = 0, fz = 0;
      let top = 0;
      stack[top++] = 0;
      while (top > 0) {
        const cell = stack[--top];
        const m = mass[cell];
        if (m === 0 || body[cell] === i) continue;
        let dx = com[cell * 3] / m - px;
        let dy = com[cell * 3 + 1] / m - py;
        let dz = com[cell * 3 + 2] / m - pz;
        let d2 = dx * dx + dy * dy + dz * dz;
        const w2 = 4 * half[cell] * half[cell];
        if (body[cell] !== INTERNAL || w2 < THETA2 * d2) {
          if (d2 < 1e-6) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            dz = Math.random() - 0.5;
            d2 = dx * dx + dy * dy + dz * dz;
          }
          const w = (c * m) / Math.max(d2, 4);
          fx += dx * w;
          fy += dy * w;
          fz += dz * w;
        } else {
          for (let k = 0; k < 8; k++) {
            const ch = child[cell * 8 + k];
            if (ch >= 0) stack[top++] = ch;
          }
        }
      }
      v[ix] += fx;
      v[ix + 1] += fy;
      v[ix + 2] += fz;
    }
  }

  private build(p: Float32Array, n: number): void {
    this.ensure(n * 4 + 64);
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < n * 3; i += 3) {
      minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]);
      minY = Math.min(minY, p[i + 1]); maxY = Math.max(maxY, p[i + 1]);
      minZ = Math.min(minZ, p[i + 2]); maxZ = Math.max(maxZ, p[i + 2]);
    }
    const h = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1) / 2 + 1;
    this.count = 0;
    this.newCell((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2, h);
    for (let i = 0; i < n; i++) this.insert(p, i);
  }

  private insert(p: Float32Array, i: number): void {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    let cell = 0;
    for (let depth = 0; ; depth++) {
      const wasEmpty = this.mass[cell] === 0;
      this.addMass(cell, x, y, z);
      const b = this.body[cell];
      if (wasEmpty) {
        this.body[cell] = i;
        return;
      }
      if (b === BUCKET) return;
      if (b >= 0) {
        if (depth >= MAX_DEPTH) {
          this.body[cell] = BUCKET;
          return;
        }
        this.body[cell] = INTERNAL;
        const bc = this.childFor(cell, p[b * 3], p[b * 3 + 1], p[b * 3 + 2]);
        this.body[bc] = b;
        this.addMass(bc, p[b * 3], p[b * 3 + 1], p[b * 3 + 2]);
      }
      cell = this.childFor(cell, x, y, z);
    }
  }

  private childFor(cell: number, x: number, y: number, z: number): number {
    const cx = this.center[cell * 3], cy = this.center[cell * 3 + 1], cz = this.center[cell * 3 + 2];
    const oct = (x >= cx ? 1 : 0) | (y >= cy ? 2 : 0) | (z >= cz ? 4 : 0);
    const slot = cell * 8 + oct;
    let ch = this.child[slot];
    if (ch < 0) {
      const h = this.half[cell] / 2;
      ch = this.newCell(cx + (oct & 1 ? h : -h), cy + (oct & 2 ? h : -h), cz + (oct & 4 ? h : -h), h);
      this.child[slot] = ch;
    }
    return ch;
  }

  private addMass(cell: number, x: number, y: number, z: number): void {
    this.mass[cell] += 1;
    this.com[cell * 3] += x;
    this.com[cell * 3 + 1] += y;
    this.com[cell * 3 + 2] += z;
  }

  private newCell(x: number, y: number, z: number, h: number): number {
    if (this.count >= this.cap) this.ensure(this.cap * 2);
    const c = this.count++;
    this.child.fill(-1, c * 8, c * 8 + 8);
    this.body[c] = EMPTY;
    this.mass[c] = 0;
    this.com[c * 3] = this.com[c * 3 + 1] = this.com[c * 3 + 2] = 0;
    this.center[c * 3] = x;
    this.center[c * 3 + 1] = y;
    this.center[c * 3 + 2] = z;
    this.half[c] = h;
    return c;
  }

  private ensure(cap: number): void {
    if (cap <= this.cap) return;
    const grow = <T extends Int32Array | Float32Array>(a: T, size: number): T => {
      const next = new (a.constructor as new (len: number) => T)(size);
      next.set(a);
      return next;
    };
    this.child = grow(this.child, cap * 8);
    this.body = grow(this.body, cap);
    this.mass = grow(this.mass, cap);
    this.com = grow(this.com, cap * 3);
    this.center = grow(this.center, cap * 3);
    this.half = grow(this.half, cap);
    this.stack = grow(this.stack, cap * 8);
    this.cap = cap;
  }
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 3D force-directed layout with two phases:
 *  - layout: d3-style charge / link / gravity forces with alpha cooling
 *  - kinetic: once settled, nodes spring back to their rest ("home") positions,
 *    which gives the elastic, jelly-like response to cursor forces and impulses.
 */
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

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ForceLayout } from './ForceLayout';
import { colorForGroup, getGroups } from './themes';
import type { GraphData, GraphNode, Theme } from './types';

export interface GraphEngineCallbacks {
  onHover?: (node: GraphNode | null) => void;
  onSelect?: (node: GraphNode | null) => void;
}

const PARTICLES_PER_LINK = 2;
const TOP_LABELS = 14;
const NODE_DIM = 0.12;
const LINK_DIM = 0.06;
const LINK_FOCUS = 2.4;
const CURSOR_RADIUS_PX = 120;
const STEP = 1 / 60;

const POINT_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(-mv.z, 0.001);
  vColor = aColor;
  vAlpha = aAlpha;
}`;

const POINT_FRAG = /* glsl */ `
uniform float uSoftness;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  gl_FragColor = vec4(vColor, pow(1.0 - d, uSoftness) * vAlpha);
  #include <colorspace_fragment>
}`;

const LINE_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const LINE_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(vColor, vAlpha);
  #include <colorspace_fragment>
}`;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

function dynamicAttr(array: Float32Array, size: number): THREE.BufferAttribute {
  return new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage);
}

interface CameraTween {
  fromPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPos: THREE.Vector3;
  toTarget: THREE.Vector3;
  start: number;
  duration: number;
}

export class GraphEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly labelLayer: HTMLDivElement;
  private readonly graphGroup = new THREE.Group();
  private readonly envGroup = new THREE.Group();
  private readonly camLight = new THREE.DirectionalLight(0xffffff, 1);
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private theme: Theme;
  private readonly cb: GraphEngineCallbacks;

  private raf = 0;
  private time = 0;
  private lastTs = performance.now();
  private stepAcc = 0;
  private width = 1;
  private height = 1;
  private pointScale = 1;

  // Graph state
  private nodes: GraphNode[] = [];
  private idToIndex = new Map<string, number>();
  private linkIdx = new Int32Array(0);
  private neighbors: number[][] = [];
  private groupOf: string[] = [];
  private layout: ForceLayout | null = null;
  private vpos = new Float32Array(0);
  private radius = new Float32Array(0);
  private colors: THREE.Color[] = [];
  private scaleCur = new Float32Array(0);
  private scaleTarget = new Float32Array(0);
  private emphCur = new Float32Array(0);
  private emphTarget = new Float32Array(0);
  private linkEmphCur = new Float32Array(0);
  private linkEmphTarget = new Float32Array(0);
  private focusMask = new Uint8Array(0);
  private particlePhase = new Float32Array(0);
  private labelAlpha = new Float32Array(0);
  private labelShown = new Uint8Array(0);
  private labelEls: HTMLDivElement[] = [];
  private topNodes = new Set<number>();
  private needsFit = false;
  private pendingFocus = -1;
  manualClock = false;

  // Visuals
  private nodeMesh: THREE.InstancedMesh | null = null;
  private halo: THREE.Points | null = null;
  private lines: THREE.LineSegments | null = null;
  private particles: THREE.Points | null = null;
  private selRing: THREE.Group | null = null;
  private stars: THREE.Points | null = null;
  private grid: THREE.GridHelper | null = null;
  private ripples: { mesh: THREE.Mesh; life: number; idx: number }[] = [];
  private readonly rippleGeo = new THREE.RingGeometry(0.92, 1, 64);
  private fogColor = new THREE.Color();

  // Interaction
  private hovered = -1;
  private selected = -1;
  private groupHighlight: string | null = null;
  private readonly pointer = {
    x: 0, y: 0, vx: 0, vy: 0, ndc: new THREE.Vector2(),
    inside: false, down: false, moved: false, downX: 0, downY: 0,
  };
  private dragIndex = -1;
  private dragging = false;
  private readonly dragPlane = new THREE.Plane();
  private orbiting = false;
  private lastInteraction = 0;
  private impulses: { at: number; idx: number; x: number; y: number; z: number }[] = [];
  private tween: CameraTween | null = null;
  private starTilt = new THREE.Vector2();

  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly mat = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly scl = new THREE.Vector3();
  private readonly col = new THREE.Color();

  constructor(container: HTMLElement, theme: Theme, cb: GraphEngineCallbacks = {}) {
    this.container = container;
    this.theme = theme;
    this.cb = cb;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'kg-canvas';
    container.appendChild(this.renderer.domElement);

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'kg-labels';
    container.appendChild(this.labelLayer);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 9000);
    this.camera.position.set(0, 80, 600);
    this.camLight.position.set(0.4, 0.6, 1);
    this.camera.add(this.camLight);
    this.scene.add(this.camera, this.graphGroup, this.envGroup);

    // Registered before OrbitControls so node presses can disable orbiting first.
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointerleave', this.onPointerLeave);

    this.controls = new OrbitControls(this.camera, el);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.7;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 4000;
    this.controls.zoomToCursor = true;
    this.controls.addEventListener('start', () => {
      this.orbiting = true;
      this.tween = null;
      this.lastInteraction = this.time;
    });
    this.controls.addEventListener('end', () => {
      this.orbiting = false;
      this.lastInteraction = this.time;
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.applyEnvironment();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------------------------------------------------------------- public API

  setData(data: GraphData): void {
    this.nodes = data.nodes;
    this.idToIndex = new Map(this.nodes.map((n, i) => [n.id, i]));
    const n = this.nodes.length;

    const pairs: Array<[number, number]> = [];
    for (const l of data.links) {
      const s = this.idToIndex.get(l.source);
      const t = this.idToIndex.get(l.target);
      if (s === undefined || t === undefined || s === t) continue;
      pairs.push([s, t]);
    }
    const m = pairs.length;
    this.linkIdx = new Int32Array(m * 2);
    this.neighbors = Array.from({ length: n }, () => []);
    pairs.forEach(([s, t], k) => {
      this.linkIdx[k * 2] = s;
      this.linkIdx[k * 2 + 1] = t;
      this.neighbors[s].push(t);
      this.neighbors[t].push(s);
    });

    this.groupOf = this.nodes.map((nd) => nd.group ?? 'default');
    this.radius = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const size = this.nodes[i].size;
      this.radius[i] =
        typeof size === 'number' && size > 0 ? size : Math.min(10, 2.6 + 1.6 * Math.sqrt(this.neighbors[i].length));
    }
    this.topNodes = new Set(
      [...Array(n).keys()].sort((a, b) => this.neighbors[b].length - this.neighbors[a].length).slice(0, TOP_LABELS),
    );

    this.layout = new ForceLayout(n, pairs);
    this.vpos = new Float32Array(this.layout.pos);
    this.scaleCur = new Float32Array(n).fill(0.01);
    this.scaleTarget = new Float32Array(n).fill(1);
    this.emphCur = new Float32Array(n).fill(1);
    this.emphTarget = new Float32Array(n).fill(1);
    this.linkEmphCur = new Float32Array(m).fill(0);
    this.linkEmphTarget = new Float32Array(m).fill(1);
    this.focusMask = new Uint8Array(n);
    this.particlePhase = new Float32Array(m * PARTICLES_PER_LINK).map(() => Math.random());
    this.labelAlpha = new Float32Array(n);
    this.labelShown = new Uint8Array(n);

    this.labelLayer.replaceChildren();
    this.labelEls = this.nodes.map((nd) => {
      const el = document.createElement('div');
      el.className = 'kg-label';
      el.textContent = nd.label ?? nd.id;
      el.style.display = 'none';
      this.labelLayer.appendChild(el);
      return el;
    });

    this.hovered = -1;
    this.selected = -1;
    this.groupHighlight = null;
    this.impulses = [];
    this.clearRipples();
    this.buildVisuals();
    this.refreshFocus();

    const est = 14 * Math.cbrt(Math.max(n, 1)) * 2.4 + 40;
    this.tween = null;
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(est * 0.4, est * 0.5, est * 3.2);
    this.needsFit = true;
  }

  setTheme(theme: Theme): void {
    if (theme.id === this.theme.id) return;
    this.theme = theme;
    this.applyEnvironment();
    this.buildVisuals();
  }

  focusNode(id: string): void {
    const idx = this.idToIndex.get(id);
    if (idx === undefined) return;
    this.needsFit = false;
    this.pendingFocus = -1;
    this.select(idx, true);
  }

  /** Focuses once the initial layout has cooled, instead of the default fit-to-view. */
  focusNodeWhenSettled(id: string): void {
    const idx = this.idToIndex.get(id);
    if (idx !== undefined) this.pendingFocus = idx;
  }

  clearSelection(): void {
    this.select(-1, false);
  }

  highlightGroup(group: string | null): void {
    this.groupHighlight = group;
    this.refreshFocus();
  }

  reheat(): void {
    if (!this.layout) return;
    const p = this.layout.pos;
    for (let i = 0; i < this.nodes.length; i++) {
      const s = 2.5 + Math.random() * 2;
      this.layout.impulse(i, (Math.random() - 0.5) * s * 2, (Math.random() - 0.5) * s * 2, (Math.random() - 0.5) * s * 2);
      this.layout.impulse(i, p[i * 3] * 0.02, p[i * 3 + 1] * 0.02, p[i * 3 + 2] * 0.02);
    }
    this.layout.reheat(0.5);
  }

  fitView(duration = 1200): void {
    const n = this.nodes.length;
    if (!n) return;
    const c = new THREE.Vector3();
    for (let i = 0; i < n; i++) c.x += this.vpos[i * 3], c.y += this.vpos[i * 3 + 1], c.z += this.vpos[i * 3 + 2];
    c.divideScalar(n);
    const dists: number[] = [];
    for (let i = 0; i < n; i++) {
      dists.push(this.v1.set(this.vpos[i * 3], this.vpos[i * 3 + 1], this.vpos[i * 3 + 2]).distanceTo(c));
    }
    dists.sort((a, b) => a - b);
    const r = Math.max(30, dists[Math.floor((n - 1) * 0.98)] + 10);
    const vFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const hFov = Math.atan(Math.tan(vFov) * this.camera.aspect);
    const dist = (r / Math.sin(Math.min(vFov, hFov))) * 1.02;
    const dir = this.v2.copy(this.camera.position).sub(this.controls.target).normalize();
    this.flyTo(c, c.clone().addScaledVector(dir, dist), duration);
    if (this.grid) this.grid.position.y = c.y - r * 1.15;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.disposeObject(this.graphGroup);
    this.disposeObject(this.envGroup);
    this.rippleGeo.dispose();
    this.renderer.dispose();
    el.remove();
    this.labelLayer.remove();
  }

  // ---------------------------------------------------------------- scene building

  private applyEnvironment(): void {
    const t = this.theme;
    this.disposeObject(this.envGroup);
    this.stars = null;
    this.grid = null;

    this.fogColor.set(t.fog.color);
    this.scene.fog = new THREE.FogExp2(this.fogColor, t.fog.density);
    this.camLight.intensity = t.lights.key;
    this.envGroup.add(new THREE.HemisphereLight(t.lights.sky, t.lights.ground, t.lights.ambient * 2));
    this.envGroup.add(new THREE.AmbientLight(0xffffff, t.lights.ambient));

    if (t.stars.enabled) {
      const count = 2200;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = 1800 + Math.random() * 2400;
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        pos.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: t.stars.color, size: 1.6, sizeAttenuation: false, transparent: true,
        opacity: 0.75, depthWrite: false, fog: false,
      });
      this.stars = new THREE.Points(geo, mat);
      this.envGroup.add(this.stars);
    }

    if (t.grid.enabled) {
      const grid = new THREE.GridHelper(4000, 80, t.grid.color, t.grid.color);
      const mats = Array.isArray(grid.material) ? grid.material : [grid.material];
      for (const m of mats) {
        m.transparent = true;
        m.opacity = t.grid.opacity;
        m.depthWrite = false;
      }
      grid.position.y = -220;
      this.grid = grid;
      this.envGroup.add(grid);
    }
  }

  private buildVisuals(): void {
    this.disposeObject(this.graphGroup);
    this.clearRipples();
    this.nodeMesh = this.halo = this.lines = this.particles = this.selRing = null;

    const t = this.theme;
    const n = this.nodes.length;
    const m = this.linkIdx.length / 2;
    if (!n) return;

    const groups = getGroups(this.nodes);
    this.colors = this.nodes.map((nd) =>
      nd.color ? new THREE.Color(nd.color) : colorForGroup(t, groups.indexOf(nd.group ?? 'default')),
    );
    const blending = t.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending;

    // Nodes
    const geo =
      t.node.shape === 'icosahedron'
        ? new THREE.IcosahedronGeometry(1, 0)
        : t.node.shape === 'octahedron'
          ? new THREE.OctahedronGeometry(1, 0)
          : new THREE.SphereGeometry(1, 32, 20);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: t.node.roughness, metalness: t.node.metalness, flatShading: t.node.flatShading,
    });
    const emissive = t.node.emissive;
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance += vColor.rgb * ${emissive.toFixed(3)};\n#endif`,
      );
    };
    mat.customProgramCacheKey = () => `kg-node-${emissive}`;
    this.nodeMesh = new THREE.InstancedMesh(geo, mat, n);
    this.nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < n; i++) this.nodeMesh.setColorAt(i, this.colors[i]);
    this.nodeMesh.frustumCulled = false;
    this.graphGroup.add(this.nodeMesh);

    // Links
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', dynamicAttr(new Float32Array(m * 6), 3));
    lgeo.setAttribute('aColor', dynamicAttr(new Float32Array(m * 6), 3));
    lgeo.setAttribute('aAlpha', dynamicAttr(new Float32Array(m * 2), 1));
    this.lines = new THREE.LineSegments(
      lgeo,
      new THREE.ShaderMaterial({
        vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true, depthWrite: false, blending,
      }),
    );
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 1;
    this.graphGroup.add(this.lines);

    if (t.halo.enabled) {
      this.halo = this.makePoints(n, 2.4, blending);
      this.halo.renderOrder = 2;
      this.graphGroup.add(this.halo);
    }
    if (t.particles.enabled && m > 0) {
      this.particles = this.makePoints(m * PARTICLES_PER_LINK, 1.4, blending);
      this.particles.renderOrder = 3;
      this.graphGroup.add(this.particles);
    }

    // Selection ring: a thin full ring plus a rotating arc
    const ringMat = new THREE.MeshBasicMaterial({
      color: t.ui.accent, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide,
    });
    const ring = new THREE.Group();
    ring.add(new THREE.Mesh(new THREE.RingGeometry(1.45, 1.52, 96), ringMat));
    const arc = new THREE.Mesh(new THREE.RingGeometry(1.68, 1.8, 96, 1, 0, Math.PI * 1.25), ringMat);
    arc.name = 'arc';
    ring.add(arc);
    ring.visible = false;
    ring.renderOrder = 4;
    this.selRing = ring;
    this.graphGroup.add(ring);
  }

  private makePoints(count: number, softness: number, blending: THREE.Blending): THREE.Points {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', dynamicAttr(new Float32Array(count * 3), 3));
    geo.setAttribute('aColor', dynamicAttr(new Float32Array(count * 3), 3));
    geo.setAttribute('aSize', dynamicAttr(new Float32Array(count), 1));
    geo.setAttribute('aAlpha', dynamicAttr(new Float32Array(count), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: this.pointScale }, uSoftness: { value: softness } },
      vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, transparent: true, depthWrite: false, blending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  private disposeObject(root: THREE.Object3D): void {
    for (const child of [...root.children]) {
      child.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      root.remove(child);
    }
  }

  private clearRipples(): void {
    for (const r of this.ripples) {
      (r.mesh.material as THREE.Material).dispose();
      r.mesh.removeFromParent();
    }
    this.ripples = [];
  }

  private resize(): void {
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.pointScale =
      (this.height * 0.5 * this.renderer.getPixelRatio()) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    for (const p of [this.halo, this.particles]) {
      if (p) (p.material as THREE.ShaderMaterial).uniforms.uScale.value = this.pointScale;
    }
  }

  // ---------------------------------------------------------------- selection & focus

  private select(idx: number, fly: boolean): void {
    this.selected = idx;
    this.refreshFocus();
    if (idx >= 0) {
      this.spawnRipple(idx);
      this.shockwave(idx);
      this.scaleCur[idx] *= 0.55;
      if (fly) this.flyToNode(idx);
    }
    this.cb.onSelect?.(idx >= 0 ? this.nodes[idx] : null);
  }

  private setHover(idx: number): void {
    if (idx === this.hovered) return;
    this.hovered = idx;
    this.renderer.domElement.style.cursor = idx >= 0 ? 'pointer' : '';
    this.refreshFocus();
    this.cb.onHover?.(idx >= 0 ? this.nodes[idx] : null);
  }

  private refreshFocus(): void {
    const n = this.nodes.length;
    const focus = this.hovered >= 0 ? this.hovered : this.selected;
    const mask = this.focusMask;
    mask.fill(0);

    if (focus >= 0) {
      mask[focus] = 2;
      for (const j of this.neighbors[focus]) mask[j] = Math.max(mask[j], 1);
    } else if (this.groupHighlight !== null) {
      for (let i = 0; i < n; i++) if (this.groupOf[i] === this.groupHighlight) mask[i] = 1;
    }
    const active = focus >= 0 || this.groupHighlight !== null;

    for (let i = 0; i < n; i++) {
      this.emphTarget[i] = !active || mask[i] ? 1 : NODE_DIM;
      let s = active ? (mask[i] ? 1.12 : 0.88) : 1;
      if (i === this.selected) {
        s = 1.35;
        this.emphTarget[i] = Math.max(this.emphTarget[i], 0.7);
      }
      if (i === this.hovered) s = 1.55;
      this.scaleTarget[i] = s;
    }

    const m = this.linkIdx.length / 2;
    for (let k = 0; k < m; k++) {
      const s = this.linkIdx[k * 2];
      const t = this.linkIdx[k * 2 + 1];
      if (focus >= 0) this.linkEmphTarget[k] = s === focus || t === focus ? LINK_FOCUS : LINK_DIM;
      else if (this.groupHighlight !== null) this.linkEmphTarget[k] = mask[s] && mask[t] ? LINK_FOCUS * 0.7 : LINK_DIM;
      else this.linkEmphTarget[k] = 1;
    }
  }

  private flyToNode(idx: number): void {
    const p = new THREE.Vector3(this.vpos[idx * 3], this.vpos[idx * 3 + 1], this.vpos[idx * 3 + 2]);
    let reach = 0;
    for (const j of this.neighbors[idx]) {
      reach = Math.max(reach, this.v1.set(this.vpos[j * 3], this.vpos[j * 3 + 1], this.vpos[j * 3 + 2]).distanceTo(p));
    }
    const dist = THREE.MathUtils.clamp(reach * 2.6, 70, 700);
    const dir = this.v2.copy(this.camera.position).sub(this.controls.target).normalize();
    this.flyTo(p, p.clone().addScaledVector(dir, dist), 1300);
  }

  private flyTo(target: THREE.Vector3, position: THREE.Vector3, duration: number): void {
    this.tween = {
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPos: position.clone(),
      toTarget: target.clone(),
      start: this.time,
      duration: duration / 1000,
    };
  }

  private spawnRipple(idx: number): void {
    const t = this.theme;
    const mat = new THREE.MeshBasicMaterial({
      color: this.colors[idx], transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide,
      blending: t.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(this.rippleGeo, mat);
    mesh.renderOrder = 5;
    this.graphGroup.add(mesh);
    this.ripples.push({ mesh, life: 0, idx });
  }

  /** Pushes nodes outward in a wave that travels hop-by-hop through the graph. */
  private shockwave(origin: number): void {
    const hops = new Int32Array(this.nodes.length).fill(-1);
    hops[origin] = 0;
    const queue = [origin];
    const ox = this.vpos[origin * 3], oy = this.vpos[origin * 3 + 1], oz = this.vpos[origin * 3 + 2];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      if (hops[i] >= 5) continue;
      for (const j of this.neighbors[i]) {
        if (hops[j] >= 0) continue;
        hops[j] = hops[i] + 1;
        queue.push(j);
        let dx = this.vpos[j * 3] - ox, dy = this.vpos[j * 3 + 1] - oy, dz = this.vpos[j * 3 + 2] - oz;
        const len = Math.hypot(dx, dy, dz) || 1;
        const mag = 2.6 / hops[j];
        dx = (dx / len) * mag;
        dy = (dy / len) * mag;
        dz = (dz / len) * mag;
        this.impulses.push({ at: this.time + hops[j] * 0.075, idx: j, x: dx, y: dy, z: dz });
      }
    }
  }

  // ---------------------------------------------------------------- pointer

  private updatePointer(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
    this.pointer.ndc.set((this.pointer.x / rect.width) * 2 - 1, -(this.pointer.y / rect.height) * 2 + 1);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.updatePointer(e);
    this.lastInteraction = this.time;
    const p = this.pointer;
    p.down = true;
    p.moved = false;
    p.downX = e.clientX;
    p.downY = e.clientY;
    if (e.button !== 0) return;
    const idx = this.pick();
    if (idx < 0) return;
    this.dragIndex = idx;
    this.controls.enabled = false;
    this.camera.getWorldDirection(this.v1);
    this.dragPlane.setFromNormalAndCoplanarPoint(
      this.v1,
      this.v2.set(this.vpos[idx * 3], this.vpos[idx * 3 + 1], this.vpos[idx * 3 + 2]),
    );
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const p = this.pointer;
    const px = p.x, py = p.y;
    this.updatePointer(e);
    if (p.inside) {
      p.vx += p.x - px;
      p.vy += p.y - py;
    }
    p.inside = true;
    this.lastInteraction = this.time;
    if (p.down && Math.hypot(e.clientX - p.downX, e.clientY - p.downY) > 4) p.moved = true;

    if (this.dragIndex >= 0 && p.moved && this.layout) {
      if (!this.dragging) {
        this.dragging = true;
        this.layout.alphaTarget = 0.12;
        this.layout.reheat(0.15);
        this.renderer.domElement.style.cursor = 'grabbing';
      }
      this.raycaster.setFromCamera(p.ndc, this.camera);
      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.v1)) {
        this.layout.pin(this.dragIndex, this.v1.x, this.v1.y, this.v1.z);
      }
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    const p = this.pointer;
    if (!p.down) return;
    p.down = false;
    if (this.dragIndex >= 0) {
      const idx = this.dragIndex;
      this.dragIndex = -1;
      this.controls.enabled = true;
      if (this.renderer.domElement.hasPointerCapture(e.pointerId)) {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      }
      if (this.dragging) {
        this.dragging = false;
        this.layout?.unpin();
        if (this.layout) this.layout.alphaTarget = 0;
        this.renderer.domElement.style.cursor = this.hovered >= 0 ? 'pointer' : '';
      } else {
        this.select(idx, true);
      }
    } else if (!p.moved && e.button === 0 && this.selected >= 0) {
      this.select(-1, false);
    }
  };

  private onPointerLeave = (): void => {
    if (this.dragIndex >= 0) return;
    this.pointer.inside = false;
    this.setHover(-1);
  };

  /** Screen-space picking: forgiving for small nodes and robust to moving geometry. */
  private pick(): number {
    const n = this.nodes.length;
    const f = (this.height * 0.5) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const inv = this.camera.matrixWorldInverse;
    let best = -1;
    let bestDepth = Infinity;
    for (let i = 0; i < n; i++) {
      const v = this.v1.set(this.vpos[i * 3], this.vpos[i * 3 + 1], this.vpos[i * 3 + 2]).applyMatrix4(inv);
      const depth = -v.z;
      if (depth < 1) continue;
      const sx = (v.x * f) / depth + this.width / 2;
      const sy = this.height / 2 - (v.y * f) / depth;
      const pr = (this.radius[i] * this.scaleCur[i] * f) / depth;
      const d = Math.hypot(sx - this.pointer.x, sy - this.pointer.y);
      if (d <= Math.max(pr, 5) + 3 && depth < bestDepth) {
        best = i;
        bestDepth = depth;
      }
    }
    return best;
  }

  /** Cursor acts as a soft force field: nodes part around it and get dragged along its wake. */
  private applyCursorField(): void {
    const p = this.pointer;
    const mvx = p.vx, mvy = p.vy;
    p.vx *= 0.75;
    p.vy *= 0.75;
    if (!p.inside || this.orbiting || this.dragIndex >= 0 || !this.layout) return;

    this.raycaster.setFromCamera(p.ndc, this.camera);
    const { origin: o, direction: d } = this.raycaster.ray;
    const pxPerDepth = (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / this.height;
    this.right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(this.camera.matrixWorld, 1);
    const wx = this.right.x * mvx - this.up.x * mvy;
    const wy = this.right.y * mvx - this.up.y * mvy;
    const wz = this.right.z * mvx - this.up.z * mvy;

    for (let i = 0; i < this.nodes.length; i++) {
      if (i === this.hovered) continue;
      const px = this.vpos[i * 3], py = this.vpos[i * 3 + 1], pz = this.vpos[i * 3 + 2];
      const t = (px - o.x) * d.x + (py - o.y) * d.y + (pz - o.z) * d.z;
      if (t <= 0) continue;
      const ox = px - (o.x + d.x * t), oy = py - (o.y + d.y * t), oz = pz - (o.z + d.z * t);
      const dist = Math.hypot(ox, oy, oz);
      const wpp = t * pxPerDepth;
      const R = CURSOR_RADIUS_PX * wpp;
      if (dist >= R) continue;
      const f = (1 - dist / R) ** 2;
      const push = (0.8 * wpp * f) / Math.max(dist, 1e-3);
      const wake = 0.07 * wpp * f;
      this.layout.impulse(i, ox * push + wx * wake, oy * push + wy * wake, oz * push + wz * wake);
    }
  }

  // ---------------------------------------------------------------- frame loop

  private frame = (ts: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(Math.max((ts - this.lastTs) / 1000, 0), 0.05);
    this.lastTs = ts;
    if (!this.manualClock) this.tick(dt);
  };

  /** Advances the animation by exact 1/30 s frames; used with `manualClock` for frame-perfect recordings. */
  advance(frames = 1): void {
    for (let i = 0; i < frames; i++) this.tick(1 / 30);
  }

  private tick(dt: number): void {
    this.time += dt;
    if (this.layout && this.nodes.length) this.simulate(dt);
    this.updateCamera(dt);
    this.updateVisuals(dt);
    this.renderer.render(this.scene, this.camera);
    this.updateLabels(dt);
  }

  private simulate(dt: number): void {
    const layout = this.layout!;
    if (this.pointer.inside && !this.orbiting && this.dragIndex < 0) this.setHover(this.pick());
    this.applyCursorField();

    if (this.impulses.length) {
      const due = this.impulses.filter((im) => im.at <= this.time);
      if (due.length) {
        for (const im of due) layout.impulse(im.idx, im.x, im.y, im.z);
        this.impulses = this.impulses.filter((im) => im.at > this.time);
      }
    }

    this.stepAcc += dt;
    let steps = 0;
    while (this.stepAcc >= STEP && steps < 3) {
      layout.step();
      this.stepAcc -= STEP;
      steps++;
    }
    if (steps === 3) this.stepAcc = 0;

    // Gentle idle drift so the graph always feels alive.
    const p = layout.pos;
    const tm = this.time;
    for (let i = 0; i < this.nodes.length; i++) {
      const o = i * 3;
      this.vpos[o] = p[o] + 0.7 * Math.sin(tm * 0.6 + i * 1.7);
      this.vpos[o + 1] = p[o + 1] + 0.7 * Math.cos(tm * 0.5 + i * 2.3);
      this.vpos[o + 2] = p[o + 2] + 0.7 * Math.sin(tm * 0.45 + i * 0.9);
    }

    if (this.needsFit && layout.alpha < 0.05) {
      this.needsFit = false;
      if (this.pendingFocus >= 0) this.select(this.pendingFocus, true);
      else this.fitView(1800);
      this.pendingFocus = -1;
    }
  }

  private updateCamera(dt: number): void {
    const tw = this.tween;
    if (tw) {
      const k = Math.min(1, (this.time - tw.start) / tw.duration);
      const e = easeInOutCubic(k);
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, e);
      this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e);
      if (k >= 1) this.tween = null;
    }
    const idle = this.time - this.lastInteraction > 5 && this.selected < 0 && !tw;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = damp(this.controls.autoRotateSpeed, idle ? 0.35 : 0, 2, dt);
    this.controls.update(dt);

    // Keep depth cueing consistent regardless of graph size / zoom level.
    const fog = this.scene.fog as THREE.FogExp2 | null;
    if (fog) {
      const camDist = this.camera.position.distanceTo(this.controls.target);
      fog.density = (this.theme.fog.density * 350) / Math.max(350, camDist);
    }

    if (this.stars) {
      this.starTilt.x = damp(this.starTilt.x, this.pointer.ndc.y * 0.04, 2, dt);
      this.starTilt.y = damp(this.starTilt.y, -this.pointer.ndc.x * 0.04, 2, dt);
      this.stars.rotation.set(this.starTilt.x, this.time * 0.004 + this.starTilt.y, 0);
    }
  }

  private updateVisuals(dt: number): void {
    const n = this.nodes.length;
    if (!n || !this.nodeMesh) return;
    const t = this.theme;
    const k = 1 - Math.exp(-dt * 9);
    const rotate = t.node.shape !== 'sphere';

    const haloGeo = this.halo?.geometry;
    const hPos = haloGeo?.getAttribute('position').array as Float32Array | undefined;
    const hCol = haloGeo?.getAttribute('aColor').array as Float32Array | undefined;
    const hSize = haloGeo?.getAttribute('aSize').array as Float32Array | undefined;
    const hAlpha = haloGeo?.getAttribute('aAlpha').array as Float32Array | undefined;

    for (let i = 0; i < n; i++) {
      this.scaleCur[i] += (this.scaleTarget[i] - this.scaleCur[i]) * k;
      this.emphCur[i] += (this.emphTarget[i] - this.emphCur[i]) * k;
      let r = this.radius[i] * this.scaleCur[i];
      if (i === this.selected) r *= 1 + 0.05 * Math.sin(this.time * 4);
      const o = i * 3;
      const x = this.vpos[o], y = this.vpos[o + 1], z = this.vpos[o + 2];

      if (rotate) this.quat.setFromEuler(this.euler.set(this.time * 0.3 + i, this.time * 0.4 + i * 0.7, 0));
      else this.quat.identity();
      this.mat.compose(this.v1.set(x, y, z), this.quat, this.scl.setScalar(r));
      this.nodeMesh.setMatrixAt(i, this.mat);

      const e = this.emphCur[i];
      this.col.copy(this.fogColor).lerp(this.colors[i], 0.1 + 0.9 * e);
      this.nodeMesh.setColorAt(i, this.col);

      if (hPos && hCol && hSize && hAlpha) {
        hPos[o] = x;
        hPos[o + 1] = y;
        hPos[o + 2] = z;
        hCol[o] = this.colors[i].r;
        hCol[o + 1] = this.colors[i].g;
        hCol[o + 2] = this.colors[i].b;
        hSize[i] = r * t.halo.size;
        hAlpha[i] = t.halo.opacity * e * e * (i === this.hovered ? 1.5 : 1);
      }
    }
    this.nodeMesh.instanceMatrix.needsUpdate = true;
    if (this.nodeMesh.instanceColor) this.nodeMesh.instanceColor.needsUpdate = true;
    if (haloGeo) for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) haloGeo.getAttribute(a).needsUpdate = true;

    this.updateLinks(dt, k);
    this.updateRings(dt);
  }

  private updateLinks(dt: number, k: number): void {
    if (!this.lines) return;
    const t = this.theme;
    const m = this.linkIdx.length / 2;
    const lgeo = this.lines.geometry;
    const lPos = lgeo.getAttribute('position').array as Float32Array;
    const lCol = lgeo.getAttribute('aColor').array as Float32Array;
    const lAlpha = lgeo.getAttribute('aAlpha').array as Float32Array;
    const fixed = t.link.color ? this.col.set(t.link.color).clone() : null;

    const pgeo = this.particles?.geometry;
    const pPos = pgeo?.getAttribute('position').array as Float32Array | undefined;
    const pCol = pgeo?.getAttribute('aColor').array as Float32Array | undefined;
    const pSize = pgeo?.getAttribute('aSize').array as Float32Array | undefined;
    const pAlpha = pgeo?.getAttribute('aAlpha').array as Float32Array | undefined;
    const pFixed = t.particles.color ? new THREE.Color(t.particles.color) : null;

    for (let l = 0; l < m; l++) {
      const s = this.linkIdx[l * 2], e = this.linkIdx[l * 2 + 1];
      const so = s * 3, eo = e * 3, lo = l * 6;
      this.linkEmphCur[l] += (this.linkEmphTarget[l] - this.linkEmphCur[l]) * k;
      const le = this.linkEmphCur[l];

      lPos[lo] = this.vpos[so];
      lPos[lo + 1] = this.vpos[so + 1];
      lPos[lo + 2] = this.vpos[so + 2];
      lPos[lo + 3] = this.vpos[eo];
      lPos[lo + 4] = this.vpos[eo + 1];
      lPos[lo + 5] = this.vpos[eo + 2];
      const cs = fixed ?? this.colors[s];
      const ce = fixed ?? this.colors[e];
      lCol[lo] = cs.r; lCol[lo + 1] = cs.g; lCol[lo + 2] = cs.b;
      lCol[lo + 3] = ce.r; lCol[lo + 4] = ce.g; lCol[lo + 5] = ce.b;
      const a = Math.min(1, t.link.opacity * le);
      lAlpha[l * 2] = a;
      lAlpha[l * 2 + 1] = a;

      if (pPos && pCol && pSize && pAlpha) {
        const dx = this.vpos[eo] - this.vpos[so];
        const dy = this.vpos[eo + 1] - this.vpos[so + 1];
        const dz = this.vpos[eo + 2] - this.vpos[so + 2];
        const len = Math.hypot(dx, dy, dz) || 1;
        const speed = (22 * (0.6 + 0.5 * Math.min(le, LINK_FOCUS))) / len;
        for (let q = 0; q < PARTICLES_PER_LINK; q++) {
          const pi = l * PARTICLES_PER_LINK + q;
          let ph = this.particlePhase[pi] + dt * speed;
          if (ph > 1) ph -= 1;
          this.particlePhase[pi] = ph;
          const po = pi * 3;
          pPos[po] = this.vpos[so] + dx * ph;
          pPos[po + 1] = this.vpos[so + 1] + dy * ph;
          pPos[po + 2] = this.vpos[so + 2] + dz * ph;
          if (pFixed) {
            pCol[po] = pFixed.r; pCol[po + 1] = pFixed.g; pCol[po + 2] = pFixed.b;
          } else {
            pCol[po] = cs.r + (ce.r - cs.r) * ph;
            pCol[po + 1] = cs.g + (ce.g - cs.g) * ph;
            pCol[po + 2] = cs.b + (ce.b - cs.b) * ph;
          }
          pSize[pi] = t.particles.size * (0.7 + 0.3 * le);
          pAlpha[pi] = t.particles.opacity * Math.sin(Math.PI * ph) * Math.min(1, 0.3 * le * le);
        }
      }
    }
    for (const a of ['position', 'aColor', 'aAlpha']) lgeo.getAttribute(a).needsUpdate = true;
    if (pgeo) for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) pgeo.getAttribute(a).needsUpdate = true;
  }

  private updateRings(dt: number): void {
    const cq = this.camera.quaternion;
    if (this.selRing) {
      const i = this.selected;
      this.selRing.visible = i >= 0;
      if (i >= 0) {
        this.selRing.position.set(this.vpos[i * 3], this.vpos[i * 3 + 1], this.vpos[i * 3 + 2]);
        this.selRing.quaternion.copy(cq);
        this.selRing.scale.setScalar(this.radius[i] * this.scaleCur[i] * (1 + 0.04 * Math.sin(this.time * 3)));
        const arc = this.selRing.getObjectByName('arc');
        if (arc) arc.rotation.z = -this.time * 1.4;
      }
    }

    this.ripples = this.ripples.filter((r) => {
      r.life += dt / 1.1;
      const mat = r.mesh.material as THREE.MeshBasicMaterial;
      if (r.life >= 1) {
        mat.dispose();
        r.mesh.removeFromParent();
        return false;
      }
      const i = r.idx;
      r.mesh.position.set(this.vpos[i * 3], this.vpos[i * 3 + 1], this.vpos[i * 3 + 2]);
      r.mesh.quaternion.copy(cq);
      const ease = 1 - Math.pow(1 - r.life, 3);
      r.mesh.scale.setScalar(this.radius[i] * (1.3 + ease * 9));
      mat.opacity = 0.85 * (1 - r.life) ** 2;
      return true;
    });
  }

  private updateLabels(dt: number): void {
    const n = this.nodes.length;
    const focus = this.hovered >= 0 ? this.hovered : this.selected;
    const grouped = this.groupHighlight !== null;
    const k = 1 - Math.exp(-dt * 10);
    this.up.setFromMatrixColumn(this.camera.matrixWorld, 1);
    const f = (this.height * 0.5) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const inv = this.camera.matrixWorldInverse;

    for (let i = 0; i < n; i++) {
      let target: number;
      if (focus >= 0) target = this.focusMask[i] ? 1 : 0;
      else if (grouped) target = this.focusMask[i] ? 1 : 0;
      else {
        // Labels fade in as you zoom closer, like Obsidian's graph view.
        const depth = -this.v2.set(this.vpos[i * 3], this.vpos[i * 3 + 1], this.vpos[i * 3 + 2]).applyMatrix4(inv).z;
        const px = depth > 0 ? (this.radius[i] * f) / depth : 0;
        const zoomAlpha = THREE.MathUtils.clamp((px - 6) / 6, 0, 0.9);
        target = Math.max(this.topNodes.has(i) ? 0.85 : 0, zoomAlpha);
      }
      if (i === this.selected) target = 1;

      this.labelAlpha[i] += (target - this.labelAlpha[i]) * k;
      const el = this.labelEls[i];
      const a = this.labelAlpha[i];
      if (a < 0.02) {
        if (this.labelShown[i]) {
          el.style.display = 'none';
          this.labelShown[i] = 0;
        }
        continue;
      }
      const r = this.radius[i] * this.scaleCur[i] * 1.35;
      const v = this.v1
        .set(this.vpos[i * 3], this.vpos[i * 3 + 1], this.vpos[i * 3 + 2])
        .addScaledVector(this.up, r)
        .project(this.camera);
      if (v.z > 1 || v.z < -1) {
        if (this.labelShown[i]) {
          el.style.display = 'none';
          this.labelShown[i] = 0;
        }
        continue;
      }
      if (!this.labelShown[i]) {
        el.style.display = '';
        this.labelShown[i] = 1;
      }
      const x = ((v.x + 1) / 2) * this.width;
      const y = ((1 - v.y) / 2) * this.height;
      el.style.opacity = a.toFixed(3);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      el.style.zIndex = String(Math.round((1 - v.z) * 100000));
      el.classList.toggle('kg-label--focus', i === focus);
    }
  }
}

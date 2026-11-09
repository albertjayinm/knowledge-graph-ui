export interface GraphNode {
  id: string;
  label?: string;
  group?: string;
  description?: string;
  /** Overrides the degree-based radius. */
  size?: number;
  /** Overrides the group colour (any CSS colour). */
  color?: string;
  [key: string]: unknown;
}

export interface GraphLink {
  source: string;
  target: string;
  label?: string;
  [key: string]: unknown;
}

export interface GraphData {
  title?: string;
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  ui: {
    background: string;
    panel: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    labelBg: string;
    labelText: string;
  };
  fog: { color: string; density: number };
  palette: string[];
  blending: 'additive' | 'normal';
  node: {
    shape: 'sphere' | 'icosahedron' | 'octahedron';
    roughness: number;
    metalness: number;
    emissive: number;
    flatShading: boolean;
  };
  halo: { enabled: boolean; size: number; opacity: number };
  link: { color: string | null; opacity: number };
  particles: { enabled: boolean; size: number; opacity: number; color: string | null };
  lights: { ambient: number; key: number; sky: string; ground: string };
  stars: { enabled: boolean; color: string };
  grid: { enabled: boolean; color: string; opacity: number };
}

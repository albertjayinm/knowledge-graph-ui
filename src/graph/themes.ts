import * as THREE from 'three';
import type { GraphNode, Theme } from './types';

export const THEMES: Theme[] = [
  {
    id: 'nebula',
    name: 'Nebula',
    dark: true,
    ui: {
      background:
        'radial-gradient(1200px 800px at 70% 20%, #1b1440 0%, transparent 60%), radial-gradient(900px 700px at 15% 85%, #0b2a3d 0%, transparent 60%), #05060f',
      panel: 'rgba(14, 16, 34, 0.62)',
      border: 'rgba(160, 170, 255, 0.14)',
      text: '#eef0ff',
      muted: '#9aa0c8',
      accent: '#8b7bff',
      labelBg: 'rgba(10, 12, 28, 0.55)',
      labelText: '#f2f3ff',
    },
    fog: { color: '#070816', density: 0.0011 },
    palette: ['#8b7bff', '#00d4ff', '#ff5fa2', '#ffb84d', '#3dffa8', '#ff7a59', '#c3f35c', '#5c8bff'],
    blending: 'additive',
    node: { shape: 'sphere', roughness: 0.35, metalness: 0.1, emissive: 0.55, flatShading: false },
    halo: { enabled: true, size: 4.2, opacity: 0.5 },
    link: { color: null, opacity: 0.32 },
    particles: { enabled: true, size: 2.6, opacity: 0.9, color: null },
    lights: { ambient: 0.35, key: 1.6, sky: '#a9b4ff', ground: '#120a24' },
    stars: { enabled: true, color: '#c9d1ff' },
    grid: { enabled: false, color: '#000000', opacity: 0 },
  },
  {
    id: 'neon',
    name: 'Neon Grid',
    dark: true,
    ui: {
      background:
        'radial-gradient(1000px 600px at 50% 110%, #3a0a4a 0%, transparent 65%), linear-gradient(180deg, #06020f 0%, #0d0420 100%)',
      panel: 'rgba(16, 6, 30, 0.66)',
      border: 'rgba(255, 60, 220, 0.22)',
      text: '#fbefff',
      muted: '#b591c9',
      accent: '#ff3cdc',
      labelBg: 'rgba(20, 4, 34, 0.6)',
      labelText: '#ffe9ff',
    },
    fog: { color: '#0b0319', density: 0.0016 },
    palette: ['#ff3cdc', '#00f0ff', '#b6ff3c', '#ffe03c', '#8a5bff', '#ff6b3c', '#3cffb4', '#ff3c7a'],
    blending: 'additive',
    node: { shape: 'icosahedron', roughness: 0.35, metalness: 0.15, emissive: 0.85, flatShading: true },
    halo: { enabled: true, size: 5.2, opacity: 0.6 },
    link: { color: null, opacity: 0.45 },
    particles: { enabled: true, size: 3, opacity: 1, color: '#ffffff' },
    lights: { ambient: 0.25, key: 2.2, sky: '#ff9cf2', ground: '#0a0420' },
    stars: { enabled: false, color: '#ffffff' },
    grid: { enabled: true, color: '#ff3cdc', opacity: 0.28 },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    dark: true,
    ui: {
      background: 'radial-gradient(1200px 900px at 50% 45%, #232323 0%, #1a1a1a 70%)',
      panel: 'rgba(38, 38, 38, 0.82)',
      border: 'rgba(255, 255, 255, 0.08)',
      text: '#dcddde',
      muted: '#8e8e8e',
      accent: '#a88bfa',
      labelBg: 'rgba(0, 0, 0, 0)',
      labelText: '#c8c8c8',
    },
    fog: { color: '#1c1c1c', density: 0.0012 },
    palette: ['#a88bfa', '#7f7f7f', '#5fb3b3', '#e0a35c', '#d47a9a', '#8fbf6a', '#6c9ee0', '#c9c06a'],
    blending: 'additive',
    node: { shape: 'sphere', roughness: 0.9, metalness: 0, emissive: 0.75, flatShading: false },
    halo: { enabled: true, size: 2.6, opacity: 0.18 },
    link: { color: '#6b6b6b', opacity: 0.45 },
    particles: { enabled: false, size: 0, opacity: 0, color: null },
    lights: { ambient: 0.6, key: 0.6, sky: '#ffffff', ground: '#1a1a1a' },
    stars: { enabled: false, color: '#000000' },
    grid: { enabled: false, color: '#000000', opacity: 0 },
  },
  {
    id: 'paper',
    name: 'Paper (Flexoki)',
    dark: false,
    ui: {
      background: 'radial-gradient(1200px 900px at 50% 40%, #fffcf0 0%, #f2f0e5 100%)',
      panel: 'rgba(255, 252, 240, 0.8)',
      border: 'rgba(16, 15, 15, 0.12)',
      text: '#100f0f',
      muted: '#6f6e69',
      accent: '#bc5215',
      labelBg: 'rgba(255, 252, 240, 0.88)',
      labelText: '#100f0f',
    },
    fog: { color: '#f2f0e5', density: 0.0009 },
    // Flexoki accent colours (Steph Ango's ink-on-paper scheme)
    palette: ['#bc5215', '#205ea6', '#66800b', '#5e409d', '#ad8301', '#24837b', '#a02f6f', '#af3029'],
    blending: 'normal',
    node: { shape: 'sphere', roughness: 0.75, metalness: 0, emissive: 0.08, flatShading: false },
    halo: { enabled: false, size: 0, opacity: 0 },
    link: { color: '#403e3c', opacity: 0.34 },
    particles: { enabled: true, size: 2.2, opacity: 0.75, color: '#403e3c' },
    lights: { ambient: 0.9, key: 1.5, sky: '#ffffff', ground: '#d8d0c0' },
    stars: { enabled: false, color: '#000000' },
    grid: { enabled: false, color: '#000000', opacity: 0 },
  },
];

export function getGroups(nodes: GraphNode[]): string[] {
  const seen = new Set<string>();
  for (const n of nodes) seen.add(n.group ?? 'default');
  return [...seen];
}

export function colorForGroup(theme: Theme, groupIndex: number): THREE.Color {
  return new THREE.Color(theme.palette[groupIndex % theme.palette.length]);
}

export function cssColorForGroup(theme: Theme, groupIndex: number): string {
  return theme.palette[groupIndex % theme.palette.length];
}

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import { KnowledgeGraph, type KnowledgeGraphHandle } from './components/KnowledgeGraph';
import { SAMPLES, parseGraphJson } from './data/samples';
import { THEMES, cssColorForGroup, getGroups } from './graph/themes';
import type { GraphData, GraphNode } from './graph/types';

interface Relation {
  node: GraphNode;
  label?: string;
  outgoing: boolean;
}

const RESERVED = new Set(['id', 'label', 'group', 'description', 'size', 'color', 'name', 'type']);

export default function App() {
  const [sampleId, setSampleId] = useState(SAMPLES[0].id);
  const [custom, setCustom] = useState<GraphData | null>(null);
  const [themeId, setThemeId] = useState(THEMES[0].id);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const graph = useRef<KnowledgeGraphHandle>(null);

  const data = sampleId === 'custom' && custom ? custom : SAMPLES.find((s) => s.id === sampleId)!.data;
  const theme = THEMES.find((t) => t.id === themeId)!;

  useEffect(() => {
    setSelected(null);
    setHovered(null);
    setQuery('');
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') graph.current?.clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const groups = useMemo(() => {
    const order = getGroups(data.nodes);
    const counts = new Map<string, number>();
    for (const n of data.nodes) counts.set(n.group ?? 'default', (counts.get(n.group ?? 'default') ?? 0) + 1);
    return order.map((g, i) => ({ name: g, count: counts.get(g) ?? 0, index: i }));
  }, [data]);

  const relations = useMemo(() => {
    const byId = new Map(data.nodes.map((n) => [n.id, n]));
    const map = new Map<string, Relation[]>();
    const add = (id: string, r: Relation) => map.set(id, [...(map.get(id) ?? []), r]);
    for (const l of data.links) {
      const s = byId.get(l.source);
      const t = byId.get(l.target);
      if (!s || !t || s === t) continue;
      add(s.id, { node: t, label: l.label, outgoing: true });
      add(t.id, { node: s, label: l.label, outgoing: false });
    }
    return map;
  }, [data]);

  const groupColor = (g: string | undefined) => {
    const idx = groups.findIndex((x) => x.name === (g ?? 'default'));
    return cssColorForGroup(theme, Math.max(0, idx));
  };

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return data.nodes.filter((n) => (n.label ?? n.id).toLowerCase().includes(q)).slice(0, 8);
  }, [query, data]);

  const focus = (id: string) => {
    graph.current?.focusNode(id);
    setQuery('');
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseGraphJson(await file.text());
      setCustom(parsed);
      setSampleId('custom');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read file.');
    }
  };

  const vars = {
    '--bg': theme.ui.background,
    '--panel': theme.ui.panel,
    '--border': theme.ui.border,
    '--text': theme.ui.text,
    '--muted': theme.ui.muted,
    '--accent': theme.ui.accent,
    '--label-bg': theme.ui.labelBg,
    '--label-text': theme.ui.labelText,
  } as CSSProperties;

  const selRelations = selected ? (relations.get(selected.id) ?? []) : [];
  const meta = selected
    ? Object.entries(selected).filter(
        ([k, v]) => !RESERVED.has(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'),
      )
    : [];

  return (
    <div className="app" style={vars}>
      <KnowledgeGraph ref={graph} data={data} theme={theme} onSelect={setSelected} onHover={setHovered} />

      <header className="topbar">
        <div className="brand panel">
          <div className="brand-mark" />
          <div>
            <div className="brand-title">{data.title ?? 'Knowledge Graph'}</div>
            <div className="brand-sub">
              {data.nodes.length} nodes · {data.links.length} links
            </div>
          </div>
        </div>

        <div className="search panel">
          <svg viewBox="0 0 24 24" className="icon" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            placeholder="Search nodes…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && suggestions[0]) focus(suggestions[0].id);
            }}
          />
          {suggestions.length > 0 && (
            <ul className="suggestions panel">
              {suggestions.map((n) => (
                <li key={n.id}>
                  <button onClick={() => focus(n.id)}>
                    <span className="dot" style={{ background: n.color ?? groupColor(n.group) }} />
                    {n.label ?? n.id}
                    <span className="muted">{n.group}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="actions panel">
          <button onClick={() => graph.current?.fitView()} title="Fit graph to view">Fit</button>
          <button onClick={() => graph.current?.reheat()} title="Shake the layout">Shake</button>
          <label className="file-btn" title="Load a { nodes, links } JSON file">
            Load JSON
            <input type="file" accept="application/json,.json" onChange={onFile} hidden />
          </label>
        </div>
      </header>

      <aside className="legend panel">
        <div className="section-title">Groups</div>
        {groups.map((g) => (
          <div
            key={g.name}
            className="legend-item"
            onMouseEnter={() => graph.current?.highlightGroup(g.name)}
            onMouseLeave={() => graph.current?.highlightGroup(null)}
          >
            <span className="dot" style={{ background: cssColorForGroup(theme, g.index) }} />
            <span>{g.name}</span>
            <span className="muted">{g.count}</span>
          </div>
        ))}
      </aside>

      <aside className="samples panel">
        <div className="section-title">Sample data</div>
        <div className="segmented">
          {SAMPLES.map((s) => (
            <button key={s.id} className={s.id === sampleId ? 'active' : ''} onClick={() => setSampleId(s.id)}>
              {s.name}
            </button>
          ))}
          {custom && (
            <button className={sampleId === 'custom' ? 'active' : ''} onClick={() => setSampleId('custom')}>
              Custom
            </button>
          )}
        </div>
        <div className="section-title">Visual style</div>
        <div className="segmented">
          {THEMES.map((t) => (
            <button key={t.id} className={t.id === themeId ? 'active' : ''} onClick={() => setThemeId(t.id)}>
              <span className="swatch" style={{ background: t.palette[0] }} />
              {t.name}
            </button>
          ))}
        </div>
      </aside>

      {selected && (
        <aside className="details panel" key={selected.id}>
          <button className="close" onClick={() => graph.current?.clearSelection()} aria-label="Close">
            ×
          </button>
          <span className="chip" style={{ '--chip': selected.color ?? groupColor(selected.group) } as CSSProperties}>
            {selected.group ?? 'default'}
          </span>
          <h2>{selected.label ?? selected.id}</h2>
          {selected.description && <p className="description">{selected.description}</p>}
          {meta.length > 0 && (
            <dl className="meta">
              {meta.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="section-title">Connections · {selRelations.length}</div>
          <ul className="relations">
            {selRelations.map((r, i) => (
              <li key={`${r.node.id}-${i}`}>
                <button onClick={() => focus(r.node.id)}>
                  <span className="dot" style={{ background: r.node.color ?? groupColor(r.node.group) }} />
                  <span className="rel-label">
                    {r.outgoing ? '→' : '←'} {r.label ?? 'related'}
                  </span>
                  <span className="rel-node">{r.node.label ?? r.node.id}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {hovered && hovered.id !== selected?.id && (
        <div className="hovercard panel">
          <span className="dot" style={{ background: hovered.color ?? groupColor(hovered.group) }} />
          <strong>{hovered.label ?? hovered.id}</strong>
          <span className="muted">
            {hovered.group} · {relations.get(hovered.id)?.length ?? 0} connections
          </span>
        </div>
      )}

      <footer className="hint">
        Drag to orbit · Scroll to zoom · Right-drag to pan · Click a node to focus · Drag a node to pull it · Esc to reset
      </footer>

      {error && (
        <div className="toast panel" role="alert" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </div>
  );
}

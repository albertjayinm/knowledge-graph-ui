import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { GraphEngine } from '../graph/GraphEngine';
import type { GraphData, GraphNode, Theme } from '../graph/types';

export interface KnowledgeGraphHandle {
  focusNode(id: string): void;
  clearSelection(): void;
  fitView(): void;
  reheat(): void;
  highlightGroup(group: string | null): void;
}

interface Props {
  data: GraphData;
  theme: Theme;
  onSelect?: (node: GraphNode | null) => void;
  onHover?: (node: GraphNode | null) => void;
}

export const KnowledgeGraph = forwardRef<KnowledgeGraphHandle, Props>(function KnowledgeGraph(
  { data, theme, onSelect, onHover },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GraphEngine | null>(null);
  const callbacks = useRef({ onSelect, onHover });
  callbacks.current = { onSelect, onHover };
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const engine = new GraphEngine(containerRef.current!, themeRef.current, {
      onSelect: (n) => callbacks.current.onSelect?.(n),
      onHover: (n) => callbacks.current.onHover?.(n),
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setData(data);
  }, [data]);

  useEffect(() => {
    engineRef.current?.setTheme(theme);
  }, [theme]);

  useImperativeHandle(ref, () => ({
    focusNode: (id) => engineRef.current?.focusNode(id),
    clearSelection: () => engineRef.current?.clearSelection(),
    fitView: () => engineRef.current?.fitView(),
    reheat: () => engineRef.current?.reheat(),
    highlightGroup: (g) => engineRef.current?.highlightGroup(g),
  }));

  return <div ref={containerRef} className="kg-root" />;
});

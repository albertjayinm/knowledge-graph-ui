#!/usr/bin/env node
// Validates a graph JSON file for knowledge-graph-ui. Usage: node validate-graph.mjs <file.json>
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate-graph.mjs <file.json>');
  process.exit(2);
}

const errors = [];
const warnings = [];
let data;
try {
  data = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`✗ Cannot read/parse ${file}: ${e.message}`);
  process.exit(1);
}

const nodes = data?.nodes;
const links = data?.links ?? data?.edges ?? [];
if (!Array.isArray(nodes)) errors.push('Root must have a "nodes" array.');
if (!Array.isArray(links)) errors.push('"links" (or "edges") must be an array.');

if (!errors.length) {
  if (nodes.length === 0) errors.push('"nodes" is empty.');
  if (nodes.length > 2000) errors.push(`${nodes.length} nodes exceeds the 2000-node limit.`);
  else if (nodes.length > 600) warnings.push(`${nodes.length} nodes: layout will be slow; consider filtering.`);

  const ids = new Set();
  const groups = new Set();
  nodes.forEach((n, i) => {
    if (typeof n !== 'object' || n === null) return errors.push(`nodes[${i}] is not an object.`);
    if (n.id === undefined) return errors.push(`nodes[${i}] is missing "id".`);
    const id = String(n.id);
    if (ids.has(id)) errors.push(`Duplicate node id "${id}".`);
    ids.add(id);
    if (!n.label && !n.name) warnings.push(`Node "${id}" has no label; the id will be shown.`);
    groups.add(String(n.group ?? n.type ?? 'default'));
  });
  if (groups.size > 8) warnings.push(`${groups.size} groups: colours repeat after 8. Consider merging groups.`);

  const ref = (v) => (typeof v === 'object' && v !== null ? String(v.id) : String(v));
  let dangling = 0;
  let selfLoops = 0;
  links.forEach((l, i) => {
    if (typeof l !== 'object' || l === null) return errors.push(`links[${i}] is not an object.`);
    const s = ref(l.source ?? l.from);
    const t = ref(l.target ?? l.to);
    if (!ids.has(s) || !ids.has(t)) dangling++;
    else if (s === t) selfLoops++;
  });
  if (dangling) warnings.push(`${dangling} link(s) reference unknown node ids and will be dropped.`);
  if (selfLoops) warnings.push(`${selfLoops} self-loop link(s) will be ignored.`);

  const connected = new Set();
  links.forEach((l) => {
    connected.add(ref(l?.source ?? l?.from));
    connected.add(ref(l?.target ?? l?.to));
  });
  const isolated = [...ids].filter((id) => !connected.has(id)).length;
  if (isolated) warnings.push(`${isolated} isolated node(s) with no links.`);

  if (!errors.length) {
    console.log(`✓ ${nodes.length} nodes, ${links.length} links, ${groups.size} groups`);
  }
}

warnings.forEach((w) => console.log(`! ${w}`));
errors.forEach((e) => console.error(`✗ ${e}`));
process.exit(errors.length ? 1 : 0);

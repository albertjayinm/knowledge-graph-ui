---
name: knowledge-graph-ui
description: 'Visualize any knowledge graph as an interactive 3D view in the browser (React + Three.js). Use when asked to visualize, map, explore or show relationships as a graph: knowledge graphs, ontologies, entity/relationship data, Obsidian/Markdown note links, codebase module or dependency graphs, architecture maps, people/org networks, concept maps. Converts data to { nodes, links } JSON, validates it, and opens it in the knowledge-graph-ui viewer.'
argument-hint: 'What to visualize, e.g. "the import graph of src/" or "path/to/graph.json"'
---

# Knowledge Graph UI

Renders a `{ nodes, links }` JSON file as an animated 3D force-directed graph with hover highlighting, click-to-focus, search, a group legend and a details panel.

App repo: https://github.com/albertjayinm/knowledge-graph-ui

## Procedure

### 1. Locate or install the viewer
- If the current workspace *is* `knowledge-graph-ui`, use it.
- Otherwise look for an existing clone (e.g. `~/Documents/Projects/knowledge-graph-ui`). If none exists, run `git clone https://github.com/albertjayinm/knowledge-graph-ui.git` in a location the user agrees to.
- Run `npm install` in the app folder if `node_modules` is missing. If `npm` is not on PATH, check for a conda env named `kg-node` and prefix commands with `conda run --no-capture-output -n kg-node`.

### 2. Build the graph JSON
Collect the entities and relationships from the user's request (read files, parse code, query data). Then write JSON in this shape. The app's `public/graphs/example.json` is a full example:

```json
{
  "title": "Optional title shown in the header",
  "nodes": [
    { "id": "auth", "label": "Auth Service", "group": "Service", "description": "Issues JWTs.", "owner": "team-a" }
  ],
  "links": [
    { "source": "api", "target": "auth", "label": "calls" }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `node.id` | yes | Unique string. |
| `node.label` | recommended | Display text (`name` also works). |
| `node.group` | recommended | Category that sets the colour and legend entry (`type` also works). Use 8 groups or fewer. |
| `node.description` | optional | Shown in the details panel. |
| `node.size` | optional | Radius override; it defaults to a size based on the number of connections. |
| `node.color` | optional | CSS colour override. |
| other node fields | optional | Strings, numbers and booleans are listed in the details panel as metadata. |
| `link.source` / `link.target` | yes | Node ids (`from`/`to` and `edges` also work). |
| `link.label` | recommended | Relation verb, shown in the details panel ("calls", "depends on"). |

Guidelines:
- Keep ids stable and readable (file paths, slugs) so `?focus=` works.
- Keep it under about 600 nodes for smooth motion (hard limit 2000). For larger sources, aggregate (e.g. folders instead of files) or filter to the relevant subgraph.
- Make link direction meaningful: source → target reads as "source *label* target".
- Avoid duplicate links and self-loops.

### 3. Validate
```bash
node ./.github/skills/knowledge-graph-ui/scripts/validate-graph.mjs <file.json>
```
Fix every `✗` error. Review the `!` warnings and fix any that matter, such as dangling links or too many groups.

### 4. Serve and open
1. Save the file to `public/graphs/<name>.json` inside the app folder.
2. Start the dev server in the background: `npx vite --port 5180` (reuse it if it is already running).
3. Open `http://localhost:5180/?src=/graphs/<name>.json` in the browser.

URL parameters:

| Param | Values | Effect |
|---|---|---|
| `src` | relative or http(s) URL to JSON | Graph to load. |
| `theme` | `nebula`, `neon`, `obsidian`, `paper` | Visual style. |
| `focus` | node id | Flies to and selects that node after the layout settles. |
| `sample` | `ai`, `vault`, `space`, `synthetic` | Built-in demo data (ignored when `src` is set). |

Example: `http://localhost:5180/?src=/graphs/deps.json&theme=obsidian&focus=src/index.ts`

### 5. Report
Tell the user the URL and a one-line summary: node count, link count, groups, and any warnings. Point out the hubs (the most-connected nodes) when that's useful.

## Choosing a theme
- `obsidian`: calm and minimal, best for notes and docs.
- `paper`: light background, good for screenshots and print.
- `nebula`: the default, a vivid look for showcases.
- `neon`: high energy, good for demos.

## Example sources
- **Markdown/Obsidian vault**: one node per note (group = top-level folder) and one link per `[[wikilink]]` or Markdown link.
- **Code imports**: one node per module (group = package or folder) and one link per import (label `imports`).
- **package.json dependencies**: one node per package (group = `direct`/`transitive`) and one link per dependency.
- **Database schema**: one node per table and one link per foreign key (label = column name).

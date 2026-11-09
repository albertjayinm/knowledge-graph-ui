import { mulberry32 } from '../graph/ForceLayout';
import type { GraphData, GraphLink, GraphNode } from '../graph/types';

type N = [id: string, label: string, group: string, description: string];
type L = [source: string, target: string, label: string];

const build = (title: string, nodes: N[], links: L[]): GraphData => ({
  title,
  nodes: nodes.map(([id, label, group, description]) => ({ id, label, group, description })),
  links: links.map(([source, target, label]) => ({ source, target, label })),
});

export const aiGraph = build(
  'AI Research Landscape',
  [
    ['ai', 'Artificial Intelligence', 'Field', 'The study of building systems that perform tasks requiring human-like intelligence.'],
    ['ml', 'Machine Learning', 'Field', 'Algorithms that improve automatically through experience and data.'],
    ['dl', 'Deep Learning', 'Field', 'Machine learning with many-layered neural networks.'],
    ['nlp', 'Natural Language Processing', 'Field', 'Enabling computers to understand and generate human language.'],
    ['cv', 'Computer Vision', 'Field', 'Extracting meaning from images and video.'],
    ['rl', 'Reinforcement Learning', 'Field', 'Learning to act through trial, error and reward.'],
    ['nn', 'Neural Network', 'Concept', 'Layers of weighted connections loosely inspired by biological neurons.'],
    ['embedding', 'Embeddings', 'Concept', 'Dense vector representations that capture semantic similarity.'],
    ['attention', 'Attention', 'Concept', 'A mechanism that lets models weigh the relevance of different inputs.'],
    ['overfitting', 'Overfitting', 'Concept', 'When a model memorises training data and fails to generalise.'],
    ['backprop', 'Backpropagation', 'Technique', 'Efficient computation of gradients through a network via the chain rule.'],
    ['gd', 'Gradient Descent', 'Technique', 'Iteratively adjusting parameters in the direction that lowers loss.'],
    ['cnn', 'Convolutional Net', 'Technique', 'Networks using shared convolutional filters, ideal for images.'],
    ['rnn', 'Recurrent Net', 'Technique', 'Networks with loops that process sequences step by step.'],
    ['lstm', 'LSTM', 'Technique', 'A recurrent unit with gates that preserve long-range information.'],
    ['transformer', 'Transformer', 'Technique', 'An architecture built entirely on self-attention.'],
    ['gan', 'GAN', 'Technique', 'Two networks — generator and discriminator — trained adversarially.'],
    ['diffusion', 'Diffusion Models', 'Technique', 'Generative models that learn to reverse a gradual noising process.'],
    ['rlhf', 'RLHF', 'Technique', 'Reinforcement learning from human feedback, used to align language models.'],
    ['dropout', 'Dropout', 'Technique', 'Randomly disabling units during training to reduce overfitting.'],
    ['qlearning', 'Q-Learning', 'Technique', 'A model-free RL algorithm that learns action values.'],
    ['tokenization', 'Tokenization', 'Technique', 'Splitting text into units a model can process.'],
    ['alexnet', 'AlexNet', 'Model', 'The 2012 CNN that sparked the deep learning boom on ImageNet.'],
    ['resnet', 'ResNet', 'Model', 'Residual connections enabling networks hundreds of layers deep.'],
    ['bert', 'BERT', 'Model', 'Bidirectional transformer encoder pre-trained with masked language modelling.'],
    ['gpt', 'GPT', 'Model', 'Generative pre-trained transformer decoder for text generation.'],
    ['vit', 'Vision Transformer', 'Model', 'Applies transformers directly to image patches.'],
    ['clip', 'CLIP', 'Model', 'Jointly embeds images and text via contrastive learning.'],
    ['sd', 'Stable Diffusion', 'Model', 'Open latent diffusion model for text-to-image generation.'],
    ['alphago', 'AlphaGo', 'Model', 'First program to defeat a world champion at Go.'],
    ['imagenet', 'ImageNet', 'Dataset', 'Large labelled image dataset that became the vision benchmark.'],
    ['hinton', 'Geoffrey Hinton', 'Person', 'Pioneer of backpropagation and deep learning; Turing Award 2018.'],
    ['lecun', 'Yann LeCun', 'Person', 'Pioneer of convolutional networks; Turing Award 2018.'],
    ['bengio', 'Yoshua Bengio', 'Person', 'Pioneer of neural language models; Turing Award 2018.'],
    ['goodfellow', 'Ian Goodfellow', 'Person', 'Inventor of generative adversarial networks.'],
    ['vaswani', 'Ashish Vaswani', 'Person', 'Lead author of "Attention Is All You Need".'],
    ['hochreiter', 'Sepp Hochreiter', 'Person', 'Co-inventor of the LSTM.'],
    ['sutton', 'Richard Sutton', 'Person', 'Founding figure of modern reinforcement learning.'],
    ['google', 'Google', 'Organization', 'Technology company and major AI research lab.'],
    ['deepmind', 'DeepMind', 'Organization', 'AI research lab known for AlphaGo and AlphaFold.'],
    ['openai', 'OpenAI', 'Organization', 'AI research company behind the GPT series.'],
    ['meta', 'Meta AI', 'Organization', 'Meta’s AI research division.'],
  ],
  [
    ['ml', 'ai', 'subfield of'], ['dl', 'ml', 'subfield of'], ['nlp', 'ai', 'subfield of'], ['cv', 'ai', 'subfield of'],
    ['rl', 'ml', 'subfield of'], ['dl', 'nn', 'built on'], ['nn', 'backprop', 'trained with'], ['backprop', 'gd', 'enables'],
    ['cnn', 'nn', 'type of'], ['rnn', 'nn', 'type of'], ['lstm', 'rnn', 'variant of'], ['transformer', 'attention', 'built on'],
    ['transformer', 'nn', 'type of'], ['attention', 'rnn', 'introduced for'], ['cnn', 'cv', 'used in'], ['transformer', 'nlp', 'dominates'],
    ['gan', 'dl', 'part of'], ['diffusion', 'dl', 'part of'], ['dropout', 'overfitting', 'reduces'], ['dropout', 'nn', 'regularises'],
    ['qlearning', 'rl', 'algorithm in'], ['rlhf', 'rl', 'uses'], ['rlhf', 'gpt', 'aligns'], ['tokenization', 'nlp', 'step in'],
    ['embedding', 'nlp', 'used in'], ['embedding', 'tokenization', 'follows'], ['alexnet', 'cnn', 'is a'], ['alexnet', 'imagenet', 'won'],
    ['resnet', 'cnn', 'is a'], ['resnet', 'imagenet', 'won'], ['bert', 'transformer', 'is a'], ['gpt', 'transformer', 'is a'],
    ['vit', 'transformer', 'is a'], ['vit', 'cv', 'used in'], ['clip', 'vit', 'uses'], ['clip', 'embedding', 'produces'],
    ['sd', 'diffusion', 'is a'], ['sd', 'clip', 'conditions on'], ['alphago', 'rl', 'trained with'], ['alphago', 'cnn', 'uses'],
    ['imagenet', 'cv', 'benchmark for'], ['hinton', 'backprop', 'popularised'], ['hinton', 'alexnet', 'co-authored'],
    ['hinton', 'dropout', 'introduced'], ['lecun', 'cnn', 'pioneered'], ['bengio', 'embedding', 'pioneered'],
    ['bengio', 'attention', 'co-introduced'], ['goodfellow', 'gan', 'invented'], ['vaswani', 'transformer', 'introduced'],
    ['hochreiter', 'lstm', 'co-invented'], ['sutton', 'rl', 'founded'], ['sutton', 'qlearning', 'related work'],
    ['hinton', 'google', 'worked at'], ['lecun', 'meta', 'chief scientist'], ['vaswani', 'google', 'worked at'],
    ['goodfellow', 'google', 'worked at'], ['goodfellow', 'openai', 'worked at'], ['deepmind', 'google', 'part of'],
    ['deepmind', 'alphago', 'created'], ['openai', 'gpt', 'created'], ['openai', 'clip', 'created'], ['google', 'bert', 'created'],
    ['google', 'vit', 'created'], ['openai', 'rlhf', 'scaled'], ['hinton', 'lecun', 'collaborated'], ['lecun', 'bengio', 'collaborated'],
    ['bengio', 'hinton', 'collaborated'],
  ],
);

export const spaceGraph = build(
  'Solar System',
  [
    ['sun', 'The Sun', 'Star', 'A G-type main-sequence star holding 99.86% of the Solar System’s mass.'],
    ['mercury', 'Mercury', 'Planet', 'The smallest planet and closest to the Sun.'],
    ['venus', 'Venus', 'Planet', 'Earth’s twin in size, with a runaway greenhouse atmosphere.'],
    ['earth', 'Earth', 'Planet', 'The only known world harbouring life.'],
    ['mars', 'Mars', 'Planet', 'The red planet, with the tallest volcano in the Solar System.'],
    ['jupiter', 'Jupiter', 'Planet', 'Gas giant more than twice as massive as all other planets combined.'],
    ['saturn', 'Saturn', 'Planet', 'Gas giant famed for its spectacular ring system.'],
    ['uranus', 'Uranus', 'Planet', 'Ice giant rotating on its side.'],
    ['neptune', 'Neptune', 'Planet', 'The windiest planet, discovered through mathematics.'],
    ['pluto', 'Pluto', 'Dwarf Planet', 'Kuiper Belt dwarf planet with a heart-shaped nitrogen glacier.'],
    ['ceres', 'Ceres', 'Dwarf Planet', 'Largest object in the asteroid belt.'],
    ['moon', 'The Moon', 'Moon', 'Earth’s only natural satellite.'],
    ['phobos', 'Phobos', 'Moon', 'Mars’ larger moon, slowly spiralling inward.'],
    ['deimos', 'Deimos', 'Moon', 'Mars’ smaller, outer moon.'],
    ['io', 'Io', 'Moon', 'The most volcanically active body known.'],
    ['europa', 'Europa', 'Moon', 'Icy moon hiding a global subsurface ocean.'],
    ['ganymede', 'Ganymede', 'Moon', 'The largest moon in the Solar System.'],
    ['callisto', 'Callisto', 'Moon', 'Heavily cratered, ancient icy surface.'],
    ['titan', 'Titan', 'Moon', 'Moon with a thick atmosphere and methane lakes.'],
    ['enceladus', 'Enceladus', 'Moon', 'Small moon venting water plumes from its south pole.'],
    ['triton', 'Triton', 'Moon', 'Neptune’s retrograde moon, likely a captured Kuiper Belt object.'],
    ['asteroids', 'Asteroid Belt', 'Region', 'Rocky debris orbiting between Mars and Jupiter.'],
    ['kuiper', 'Kuiper Belt', 'Region', 'Icy bodies beyond Neptune’s orbit.'],
    ['apollo11', 'Apollo 11', 'Mission', 'First crewed lunar landing, July 1969.'],
    ['voyager1', 'Voyager 1', 'Mission', 'The most distant human-made object, now in interstellar space.'],
    ['voyager2', 'Voyager 2', 'Mission', 'The only spacecraft to visit all four giant planets.'],
    ['cassini', 'Cassini–Huygens', 'Mission', 'Orbited Saturn for 13 years and landed a probe on Titan.'],
    ['juno', 'Juno', 'Mission', 'Polar orbiter studying Jupiter’s interior and magnetosphere.'],
    ['perseverance', 'Perseverance', 'Mission', 'Rover searching for signs of ancient life on Mars.'],
    ['newhorizons', 'New Horizons', 'Mission', 'First spacecraft to fly past Pluto.'],
    ['jwst', 'James Webb Telescope', 'Mission', 'Infrared space observatory at the Sun–Earth L2 point.'],
    ['galileo', 'Galileo Galilei', 'Scientist', 'Discovered Jupiter’s four large moons in 1610.'],
    ['copernicus', 'Nicolaus Copernicus', 'Scientist', 'Proposed the heliocentric model.'],
    ['kepler', 'Johannes Kepler', 'Scientist', 'Formulated the laws of planetary motion.'],
    ['newton', 'Isaac Newton', 'Scientist', 'Unified celestial and terrestrial mechanics with gravitation.'],
    ['sagan', 'Carl Sagan', 'Scientist', 'Planetary scientist and science communicator.'],
    ['helio', 'Heliocentrism', 'Concept', 'The model placing the Sun at the centre.'],
    ['gravity', 'Gravitation', 'Concept', 'The force that binds the Solar System together.'],
  ],
  [
    ['mercury', 'sun', 'orbits'], ['venus', 'sun', 'orbits'], ['earth', 'sun', 'orbits'], ['mars', 'sun', 'orbits'],
    ['jupiter', 'sun', 'orbits'], ['saturn', 'sun', 'orbits'], ['uranus', 'sun', 'orbits'], ['neptune', 'sun', 'orbits'],
    ['asteroids', 'sun', 'orbits'], ['kuiper', 'sun', 'orbits'], ['pluto', 'kuiper', 'resides in'], ['ceres', 'asteroids', 'resides in'],
    ['moon', 'earth', 'orbits'], ['phobos', 'mars', 'orbits'], ['deimos', 'mars', 'orbits'], ['io', 'jupiter', 'orbits'],
    ['europa', 'jupiter', 'orbits'], ['ganymede', 'jupiter', 'orbits'], ['callisto', 'jupiter', 'orbits'], ['titan', 'saturn', 'orbits'],
    ['enceladus', 'saturn', 'orbits'], ['triton', 'neptune', 'orbits'], ['triton', 'kuiper', 'likely origin'],
    ['apollo11', 'moon', 'landed on'], ['voyager1', 'jupiter', 'flew by'], ['voyager1', 'saturn', 'flew by'],
    ['voyager2', 'jupiter', 'flew by'], ['voyager2', 'saturn', 'flew by'], ['voyager2', 'uranus', 'flew by'],
    ['voyager2', 'neptune', 'flew by'], ['cassini', 'saturn', 'orbited'], ['cassini', 'titan', 'landed probe on'],
    ['cassini', 'enceladus', 'sampled plumes of'], ['juno', 'jupiter', 'orbits'], ['perseverance', 'mars', 'explores'],
    ['newhorizons', 'pluto', 'flew by'], ['newhorizons', 'kuiper', 'explores'], ['jwst', 'sun', 'orbits L2 of'],
    ['jwst', 'earth', 'launched from'], ['galileo', 'io', 'discovered'], ['galileo', 'europa', 'discovered'],
    ['galileo', 'ganymede', 'discovered'], ['galileo', 'callisto', 'discovered'], ['galileo', 'helio', 'championed'],
    ['copernicus', 'helio', 'proposed'], ['kepler', 'helio', 'refined'], ['kepler', 'mars', 'studied orbit of'],
    ['newton', 'gravity', 'formulated'], ['newton', 'kepler', 'explained laws of'], ['gravity', 'sun', 'binds system around'],
    ['sagan', 'voyager1', 'Golden Record'], ['sagan', 'venus', 'studied'], ['sagan', 'mars', 'studied'], ['europa', 'enceladus', 'ocean worlds'],
  ],
);

export const vaultGraph = build(
  'Second Brain Vault',
  [
    ['home', 'Home', 'Map of Content', 'Entry point of the vault, linking every major area.'],
    ['moc-projects', 'Projects MOC', 'Map of Content', 'Index of active and archived projects.'],
    ['moc-ideas', 'Ideas MOC', 'Map of Content', 'Index of evergreen ideas and open questions.'],
    ['moc-people', 'People MOC', 'Map of Content', 'Everyone the vault references.'],
    ['moc-reading', 'Reading MOC', 'Map of Content', 'Books, articles and clippings in progress.'],
    ['claude', 'CLAUDE.md', 'Map of Content', 'Folder map an AI assistant reads to find where you left off.'],
    ['d-1', '2026-11-03', 'Daily', 'Kick-off for the knowledge graph UI project.'],
    ['d-2', '2026-11-04', 'Daily', 'Sketched interaction ideas: magnetic cursor, ripples.'],
    ['d-3', '2026-11-05', 'Daily', 'Read about force-directed layouts.'],
    ['d-4', '2026-11-06', 'Daily', 'Meeting with Mara about the dashboard.'],
    ['d-5', '2026-11-07', 'Daily', 'Year review prep using the 40 questions.'],
    ['d-6', '2026-11-08', 'Daily', 'Tried the Flexoki palette in the editor.'],
    ['d-7', '2026-11-09', 'Daily', 'Reviewed graph UI samples.'],
    ['p-graph', 'Knowledge Graph UI', 'Project', '3D React + Three.js front end for any knowledge graph.'],
    ['p-dashboard', 'Family Dashboard', 'Project', 'Shared calendar and chores board.'],
    ['p-game', 'Avatar Odyssey 3D', 'Project', 'Browser game with companions and habitats.'],
    ['p-review', 'Year in Review 2026', 'Project', 'Annual reflection driven by a question list.'],
    ['i-linking', 'Linking beats filing', 'Idea', 'Connections between notes matter more than folder structure.'],
    ['i-evergreen', 'Evergreen notes', 'Idea', 'Notes written to evolve and accumulate over time.'],
    ['i-atomic', 'Atomic notes', 'Idea', 'One idea per note makes linking precise.'],
    ['i-forcegraph', 'Force-directed layouts', 'Idea', 'Physics simulation reveals clusters naturally.'],
    ['i-kinetic', 'Kinetic UI', 'Idea', 'Interfaces that respond with physical, springy motion.'],
    ['i-filesoverapps', 'File over app', 'Idea', 'Plain files outlive the apps that create them.'],
    ['i-canvas', 'Spatial thinking', 'Idea', 'Laying notes out on a canvas to see relationships.'],
    ['i-colors', 'Calm colour systems', 'Idea', 'Low-contrast ink-on-paper palettes reduce fatigue.'],
    ['pe-steph', 'Steph Ango', 'Person', 'Obsidian CEO; author of the vault template, Minimal and Flexoki.'],
    ['pe-mara', 'Mara', 'Person', 'Collaborator on the family dashboard.'],
    ['pe-andy', 'Andy Matuschak', 'Person', 'Writer on evergreen notes and tools for thought.'],
    ['pe-niklas', 'Niklas Luhmann', 'Person', 'Sociologist famous for his Zettelkasten.'],
    ['c-vault', 'Kepano vault template', 'Clipping', 'Starter vault showing Daily, Clippings and Templates layout.'],
    ['c-jsoncanvas', 'JSON Canvas spec', 'Clipping', 'Open format behind .canvas files.'],
    ['c-flexoki', 'Flexoki', 'Clipping', 'Ink-on-paper colour scheme for writing and code.'],
    ['c-minimal', 'Minimal theme', 'Clipping', 'Clean starting point for the Obsidian interface.'],
    ['c-40q', '40 Questions', 'Clipping', 'Questions for reviewing a year or a decade.'],
    ['c-d3', 'd3-force docs', 'Clipping', 'Reference for velocity-Verlet force simulation.'],
    ['c-zettel', 'Zettelkasten method', 'Clipping', 'Overview of slip-box note taking.'],
    ['t-daily', 'Daily template', 'Template', 'Template for daily notes.'],
    ['t-project', 'Project template', 'Template', 'Template for project notes.'],
    ['t-person', 'Person template', 'Template', 'Template for people notes.'],
  ],
  [
    ['home', 'moc-projects', 'links to'], ['home', 'moc-ideas', 'links to'], ['home', 'moc-people', 'links to'],
    ['home', 'moc-reading', 'links to'], ['claude', 'home', 'indexes'], ['claude', 'p-graph', 'points at'],
    ['moc-projects', 'p-graph', 'lists'], ['moc-projects', 'p-dashboard', 'lists'], ['moc-projects', 'p-game', 'lists'],
    ['moc-projects', 'p-review', 'lists'], ['moc-ideas', 'i-linking', 'lists'], ['moc-ideas', 'i-evergreen', 'lists'],
    ['moc-ideas', 'i-atomic', 'lists'], ['moc-ideas', 'i-forcegraph', 'lists'], ['moc-ideas', 'i-kinetic', 'lists'],
    ['moc-ideas', 'i-filesoverapps', 'lists'], ['moc-ideas', 'i-canvas', 'lists'], ['moc-ideas', 'i-colors', 'lists'],
    ['moc-people', 'pe-steph', 'lists'], ['moc-people', 'pe-mara', 'lists'], ['moc-people', 'pe-andy', 'lists'],
    ['moc-people', 'pe-niklas', 'lists'], ['moc-reading', 'c-vault', 'lists'], ['moc-reading', 'c-jsoncanvas', 'lists'],
    ['moc-reading', 'c-flexoki', 'lists'], ['moc-reading', 'c-minimal', 'lists'], ['moc-reading', 'c-40q', 'lists'],
    ['moc-reading', 'c-d3', 'lists'], ['moc-reading', 'c-zettel', 'lists'],
    ['d-1', 'p-graph', 'mentions'], ['d-2', 'i-kinetic', 'mentions'], ['d-2', 'p-graph', 'mentions'],
    ['d-3', 'i-forcegraph', 'mentions'], ['d-3', 'c-d3', 'mentions'], ['d-4', 'pe-mara', 'mentions'],
    ['d-4', 'p-dashboard', 'mentions'], ['d-5', 'p-review', 'mentions'], ['d-5', 'c-40q', 'mentions'],
    ['d-6', 'c-flexoki', 'mentions'], ['d-6', 'i-colors', 'mentions'], ['d-7', 'p-graph', 'mentions'],
    ['d-1', 'd-2', 'next'], ['d-2', 'd-3', 'next'], ['d-3', 'd-4', 'next'], ['d-4', 'd-5', 'next'],
    ['d-5', 'd-6', 'next'], ['d-6', 'd-7', 'next'],
    ['p-graph', 'i-forcegraph', 'uses'], ['p-graph', 'i-kinetic', 'uses'], ['p-graph', 'c-jsoncanvas', 'could import'],
    ['p-review', 'c-40q', 'uses'], ['p-dashboard', 'pe-mara', 'with'],
    ['i-linking', 'i-atomic', 'requires'], ['i-evergreen', 'pe-andy', 'coined by'], ['i-atomic', 'c-zettel', 'from'],
    ['c-zettel', 'pe-niklas', 'by'], ['i-filesoverapps', 'pe-steph', 'by'], ['c-vault', 'pe-steph', 'by'],
    ['c-flexoki', 'pe-steph', 'by'], ['c-minimal', 'pe-steph', 'by'], ['c-40q', 'pe-steph', 'by'],
    ['c-flexoki', 'i-colors', 'example of'], ['c-jsoncanvas', 'i-canvas', 'enables'], ['i-linking', 'i-evergreen', 'supports'],
    ['c-vault', 't-daily', 'includes'], ['c-vault', 't-project', 'includes'], ['c-vault', 't-person', 'includes'],
    ['t-daily', 'd-7', 'created'], ['t-project', 'p-graph', 'created'], ['t-person', 'pe-mara', 'created'],
  ],
);

function makeSynthetic(count: number): GraphData {
  const rand = mulberry32(42);
  const groups = ['Signals', 'Systems', 'Materials', 'Biology', 'Markets', 'Culture', 'Energy', 'Language'];
  const syl = ['ka', 'lo', 'mi', 'ra', 'ven', 'tor', 'sel', 'qua', 'ani', 'dor', 'eth', 'ix', 'na', 'pol', 'ser', 'tha', 'um', 'zel', 'cor', 'vi'];
  const word = () => {
    const parts = 2 + (rand() < 0.4 ? 1 : 0);
    let w = '';
    for (let i = 0; i < parts; i++) w += syl[Math.floor(rand() * syl.length)];
    return w[0].toUpperCase() + w.slice(1);
  };

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const endpoints: string[][] = groups.map(() => []);
  const all: string[] = [];
  const pick = (arr: string[]) => arr[Math.floor(rand() * arr.length)];
  const connect = (a: string, b: string, ga: number, gb: number) => {
    links.push({ source: a, target: b, label: 'relates to' });
    endpoints[ga].push(a);
    endpoints[gb].push(b);
    all.push(a, b);
  };

  groups.forEach((g, gi) => {
    const id = `hub-${gi}`;
    nodes.push({ id, label: `${g} Hub`, group: g, description: `Central concept of the ${g} cluster.` });
    endpoints[gi].push(id);
    all.push(id);
    if (gi > 0) connect(id, `hub-${gi - 1}`, gi, gi - 1);
  });
  connect('hub-0', `hub-${groups.length - 1}`, 0, groups.length - 1);

  const groupIdx = new Map<string, number>(nodes.map((n, i) => [n.id, i]));
  for (let i = groups.length; i < count; i++) {
    const gi = Math.floor(rand() * groups.length);
    const id = `n-${i}`;
    nodes.push({ id, label: word(), group: groups[gi], description: `Synthetic entity in the ${groups[gi]} cluster.` });
    groupIdx.set(id, gi);
    const target = pick(endpoints[gi]);
    connect(id, target, gi, groupIdx.get(target) ?? gi);
    if (rand() < 0.3) {
      const other = pick(all);
      if (other !== id) connect(id, other, gi, groupIdx.get(other) ?? gi);
    }
  }
  return { title: `Synthetic Network · ${count} nodes`, nodes, links };
}

export const syntheticGraph = makeSynthetic(320);

export const SAMPLES: { id: string; name: string; data: GraphData }[] = [
  { id: 'ai', name: 'AI Research', data: aiGraph },
  { id: 'vault', name: 'Vault', data: vaultGraph },
  { id: 'space', name: 'Solar System', data: spaceGraph },
  { id: 'synthetic', name: 'Synthetic 320', data: syntheticGraph },
];

/** Parses user-supplied JSON into GraphData. Accepts `links` or `edges`, and `name` as a label alias. */
export function parseGraphJson(text: string): GraphData {
  const raw: unknown = JSON.parse(text);
  if (typeof raw !== 'object' || raw === null) throw new Error('JSON root must be an object.');
  const obj = raw as Record<string, unknown>;
  const nodesRaw = obj.nodes;
  const linksRaw = obj.links ?? obj.edges ?? [];
  if (!Array.isArray(nodesRaw)) throw new Error('Expected a "nodes" array.');
  if (!Array.isArray(linksRaw)) throw new Error('"links" / "edges" must be an array.');
  if (nodesRaw.length > 2000) throw new Error('Graphs over 2000 nodes are not supported in this preview.');

  const nodes: GraphNode[] = nodesRaw.map((n, i) => {
    if (typeof n !== 'object' || n === null) throw new Error(`Node ${i} is not an object.`);
    const r = n as Record<string, unknown>;
    const id = String(r.id ?? i);
    const label = typeof r.label === 'string' ? r.label : typeof r.name === 'string' ? r.name : id;
    const group = r.group !== undefined ? String(r.group) : r.type !== undefined ? String(r.type) : undefined;
    return { ...r, id, label, group };
  });
  const ids = new Set(nodes.map((n) => n.id));
  const ref = (v: unknown) => (typeof v === 'object' && v !== null ? String((v as { id?: unknown }).id) : String(v));
  const links: GraphLink[] = [];
  for (const l of linksRaw) {
    if (typeof l !== 'object' || l === null) continue;
    const r = l as Record<string, unknown>;
    const source = ref(r.source ?? r.from);
    const target = ref(r.target ?? r.to);
    if (!ids.has(source) || !ids.has(target)) continue;
    const label = typeof r.label === 'string' ? r.label : typeof r.type === 'string' ? r.type : undefined;
    links.push({ ...r, source, target, label });
  }
  return { title: typeof obj.title === 'string' ? obj.title : 'Custom Graph', nodes, links };
}

// Records the README GIFs/MP4 and screenshots from a running dev server.
// Usage: npm run dev (port 5180) in one terminal, then `npm run media`.
// Env: BASE_URL (default http://localhost:5180/), CHROME_PATH, FFMPEG (default "ffmpeg").
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const BASE = process.env.BASE_URL ?? 'http://localhost:5180/';
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const SHOTS = join(ROOT, 'docs/screenshots');
const MEDIA = join(ROOT, 'docs/media');
const FRAMES = join(tmpdir(), 'kg-frames');
const only = process.argv[2]; // optional: "shots" or "clips"

function chromePath() {
  const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  // An x64 Node on Apple Silicon would launch Chrome under Rosetta without GPU (about 1 fps).
  const armMac =
    process.platform === 'darwin' && spawnSync('sysctl', ['-n', 'hw.optional.arm64']).stdout?.toString().trim() === '1';
  if (!armMac || process.arch === 'arm64') return chrome;
  const wrapper = join(tmpdir(), 'kg-chrome-arm64.sh');
  writeFileSync(wrapper, `#!/bin/sh\nexec arch -arm64 "${chrome}" "$@"\n`);
  chmodSync(wrapper, 0o755);
  return wrapper;
}

const browser = await chromium.launch({
  executablePath: chromePath(),
  headless: true,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));

const advance = (n = 1) => page.evaluate((k) => window.__kgAdvance(k), n);
const open = async (query, frames = 0) => {
  await page.goto(`${BASE}${query}&capture=1`);
  await page.waitForFunction(() => typeof window.__kgAdvance === 'function');
  await page.waitForFunction(() => !document.querySelector('.brand-title')?.textContent?.startsWith('Loading'));
  await page.mouse.move(1439, 899);
  if (frames) await advance(frames);
};
const nodePos = (label) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll('.kg-label')].find((e) => e.textContent === t && e.style.display !== 'none');
    const m = el && /translate3d\(([\d.-]+)px, ([\d.-]+)px/.exec(el.style.transform);
    return m ? { x: +m[1], y: +m[2] + 16 } : null;
  }, label);

// ---------------------------------------------------------------- screenshots

async function screenshots() {
  mkdirSync(SHOTS, { recursive: true });
  const shot = async (name) => {
    await advance(1);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  };

  await open('?sample=ai&theme=nebula', 300);
  await shot('hero-nebula');
  const p = await nodePos('Deep Learning');
  if (p) {
    await page.mouse.move(p.x, p.y);
    await advance(20);
    await shot('hover');
  }

  await open('?sample=ai&theme=nebula&focus=transformer', 200);
  await page.waitForSelector('.details h2');
  await advance(60);
  await shot('focus');

  await open('?sample=ai&theme=nebula', 300);
  await page.hover('.legend-item:has-text("Person")');
  await advance(20);
  await shot('group-highlight');

  await page.mouse.move(1439, 899);
  await page.fill('.search input', 'di');
  await advance(20);
  await shot('search');

  await open('?sample=synthetic&theme=neon', 360);
  await shot('theme-neon');
  await open('?sample=vault&theme=obsidian', 300);
  await shot('theme-obsidian');
  await open('?sample=space&theme=paper', 300);
  await shot('theme-paper');

  await open('?src=/graphs/example.json&theme=obsidian&focus=api', 200);
  await page.waitForSelector('.details h2');
  await advance(60);
  await shot('load-by-url');
}

// ---------------------------------------------------------------- clips

let dir = '';
let frame = 0;
let cursor = { x: 1300, y: 820 };
const clip = (name) => {
  dir = join(FRAMES, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  frame = 0;
};
const record = async (frames) => {
  for (let i = 0; i < frames; i++) {
    await advance(1);
    await page.screenshot({ path: join(dir, `f${String(frame++).padStart(4, '0')}.png`) });
  }
};
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const moveTo = async (x, y, frames) => {
  const from = { ...cursor };
  for (let i = 1; i <= frames; i++) {
    const k = ease(i / frames);
    cursor = { x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k };
    await page.mouse.move(cursor.x, cursor.y);
    await record(1);
  }
};
const click = async (hold = 3) => {
  await page.mouse.down();
  await record(hold);
  await page.mouse.up();
};
const addCursor = (dark = true) =>
  page.evaluate((onDark) => {
    const c = document.createElement('div');
    const ring = onDark ? 'rgba(255,255,255,0.95)' : 'rgba(20,21,43,0.9)';
    Object.assign(c.style, {
      position: 'fixed', left: '0', top: '0', width: '26px', height: '26px', margin: '-13px 0 0 -13px',
      borderRadius: '50%', border: `2px solid ${ring}`, background: onDark ? 'rgba(255,255,255,0.18)' : 'rgba(20,21,43,0.12)',
      boxShadow: '0 0 14px rgba(255,255,255,0.5), 0 0 0 1px rgba(0,0,0,0.3)', pointerEvents: 'none', zIndex: '99999',
    });
    document.body.appendChild(c);
    const set = (e, s) => (c.style.transform = `translate(${e.clientX}px, ${e.clientY}px) scale(${s})`);
    window.addEventListener('pointermove', (e) => set(e, e.buttons ? 0.75 : 1), true);
    window.addEventListener('pointerdown', (e) => set(e, 0.75), true);
    window.addEventListener('pointerup', (e) => set(e, 1), true);
  }, dark);

async function clips() {
  clip('intro');
  await open('?sample=ai&theme=nebula');
  await record(255);

  clip('interact');
  await open('?sample=ai&theme=nebula', 240);
  await addCursor();
  cursor = { x: 1250, y: 760 };
  await page.mouse.move(cursor.x, cursor.y);
  await record(6);
  for (const [x, y, f] of [[900, 380, 22], [560, 520, 22], [760, 460, 18]]) await moveTo(x, y, f);
  let p = await nodePos('Transformer');
  if (p) {
    await moveTo(p.x, p.y, 20);
    await record(18);
    await click();
    await record(48);
  }
  const rel = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.relations button')].find((e) => e.textContent.includes('GPT'));
    const r = b?.getBoundingClientRect();
    return r ? { x: r.left + r.width * 0.7, y: r.top + r.height / 2 } : null;
  });
  if (rel) {
    await moveTo(rel.x, rel.y, 26);
    await record(8);
    await click();
    await record(50);
  }
  await page.keyboard.press('Escape');
  await page.keyboard.press('f');
  await moveTo(700, 450, 20);
  await record(40);
  p = await nodePos('Deep Learning');
  if (p) {
    await moveTo(p.x, p.y, 18);
    await record(8);
    await page.mouse.down();
    await record(3);
    await moveTo(p.x + 230, p.y - 150, 26);
    await record(10);
    await page.mouse.up();
    await record(40);
  }

  clip('themes');
  await open('?sample=vault&theme=nebula', 260);
  await addCursor();
  cursor = { x: 1100, y: 700 };
  await page.mouse.move(cursor.x, cursor.y);
  for (const name of ['Obsidian', 'Neon Grid', 'Paper (Flexoki)', 'Nebula']) {
    const b = await page.locator('.samples .segmented button', { hasText: name }).boundingBox();
    await moveTo(b.x + b.width / 2, b.y + b.height / 2, 16);
    await click(2);
    await record(44);
  }
}

function encode() {
  mkdirSync(MEDIA, { recursive: true });
  const ff = (...args) => execFileSync(FFMPEG, ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
  const names = ['intro', 'interact', 'themes'];
  for (const c of names) {
    const input = ['-framerate', '30', '-i', join(FRAMES, c, 'f%04d.png')];
    ff(...input, '-vf',
      'fps=20,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
      '-loop', '0', join(MEDIA, `${c}.gif`));
    ff(...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', join(FRAMES, `${c}.mp4`));
  }
  const list = join(FRAMES, 'list.txt');
  writeFileSync(list, names.map((c) => `file '${join(FRAMES, `${c}.mp4`)}'`).join('\n'));
  ff('-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', join(MEDIA, 'demo.mp4'));
}

if (only !== 'clips') await screenshots();
if (only !== 'shots') await clips();
await browser.close();
if (only !== 'shots') encode();
console.log('done');

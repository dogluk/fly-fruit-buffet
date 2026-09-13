import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: '4175' }, stdio: ['ignore', 'pipe', 'inherit'] });
const fps = 30, seconds = 28;
let browser, encoder;
try {
  await once(server.stdout, 'data');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://127.0.0.1:4175/?offline=1');
  await page.waitForFunction(() => window.buffet?.ready);
  await page.selectOption('#speed', '12');
  encoder = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps),
    '-i', 'pipe:0', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', root + 'artifacts/poop-buffet-preview.mp4'], { stdio: ['pipe', 'ignore', 'inherit'] });
  const encoded = once(encoder, 'close');
  for (let frame = 0; frame < fps * seconds; frame++) {
    const png = await page.evaluate(({ advance }) => {
      if (advance) window.buffet.advance(.4);
      else window.buffet.render();
      return window.buffet.snapshot();
    }, { advance: frame >= fps && frame < 26 * fps });
    if (!encoder.stdin.write(Buffer.from(png.split(',')[1], 'base64'))) await once(encoder.stdin, 'drain');
    if (frame % (fps * 4) === 0) console.log(`Rendered ${frame / fps}s / ${seconds}s`);
  }
  encoder.stdin.end();
  const [code] = await encoded;
  if (code !== 0) throw new Error(`ffmpeg exited ${code}`);
  const result = await page.evaluate(() => window.buffet.simulation.export());
  await writeFile(root + 'artifacts/preview-run.json', JSON.stringify(result, null, 2));
  console.log('Saved artifacts/poop-buffet-preview.mp4 (28s, 1440×810, 30fps) and preview-run.json');
} finally {
  if (encoder && encoder.exitCode === null) encoder.kill();
  if (browser) await browser.close();
  server.kill();
}

// Screenshot a URL with headless Chrome (mobile viewport by default).
// Usage: node screenshot.mjs <url> [label] [--w=WIDTH] [--h=HEIGHT]
// Saves to ./temporary screenshots/screenshot-N[-label].png (auto-incremented).
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DIR = 'temporary screenshots';

const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--')) || 'http://localhost:3000';
const label = args.filter(a => !a.startsWith('--'))[1] || '';
const getFlag = (k, d) => { const f = args.find(a => a.startsWith(`--${k}=`)); return f ? Number(f.split('=')[1]) : d; };
const W = getFlag('w', 500);   // narrow/mobile (headless Chrome clamps viewport to ~500 min); pass --w=1440 for desktop
const H = getFlag('h', 3200);  // tall enough to capture a full mobile homepage

if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
const nums = readdirSync(DIR).map(f => (f.match(/^screenshot-(\d+)/) || [])[1]).filter(Boolean).map(Number);
const n = (nums.length ? Math.max(...nums) : 0) + 1;
const out = join(DIR, `screenshot-${n}${label ? '-' + label : ''}.png`);

execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--window-size=${W},${H}`, '--force-device-scale-factor=2',
  '--virtual-time-budget=4000', '--default-background-color=00000000',
  `--screenshot=${out}`, url
], { stdio: 'ignore' });

console.log(out);

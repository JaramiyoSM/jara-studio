import fs from 'node:fs/promises';
import path from 'node:path';
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8')),
  seen = new Set(),
  notices = [];
async function visit(name) {
  if (seen.has(name)) return;
  seen.add(name);
  const folder = path.join('node_modules', name);
  let metadata;
  try {
    metadata = JSON.parse(await fs.readFile(path.join(folder, 'package.json'), 'utf8'));
  } catch {
    return;
  }
  const files = (await fs.readdir(folder)).filter((name) => /^licen[cs]e(?:\.|-|$)/i.test(name));
  let body = '';
  for (const file of files) body += '\n' + (await fs.readFile(path.join(folder, file), 'utf8'));
  notices.push(
    `\n==== ${name} ${metadata.version} ====\n${body || 'License: ' + metadata.license}`,
  );
  for (const dependency of Object.keys(metadata.dependencies || {})) await visit(dependency);
}
for (const name of Object.keys(pkg.dependencies)) await visit(name);
const assetNotices = await fs.readFile('public/fonts/OFL-NOTICES.txt', 'utf8');
const own = `Jara Studio · Jaramiyo\nApplication source: MIT. See LICENSE.\n\nAssets have independent licenses. The anatomical human and shirt/jeans are graphical CC0 MakeHuman data, not MakeHuman program source. Five bundled models are practice/interchange GLB assets, not compiled GTA resources. See public/samples/samplecredits.json and the original licenses alongside each sample. Fonts use SIL OFL1.1. Brand illustration belongs to Jaramiyo and is not relicensed as a third-party model.\n\nThe DDS/RSC7 codec is the Jaramiyo MIT texture engine: https://github.com/JaramiyoSM/jara-texture-engine\nElectron runtime notices are included beside the packaged executable in LICENSES.chromium.html and LICENSE.electron.txt.\n\n`;
await fs.writeFile('THIRD_PARTY_NOTICES.txt', own + assetNotices + notices.join('\n'));
console.log(`Prepared ${seen.size} runtime dependency notices.`);

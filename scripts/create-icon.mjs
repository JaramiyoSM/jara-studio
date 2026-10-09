import fs from 'node:fs/promises';
import { chromium } from 'playwright';
await fs.mkdir('build', { recursive: true });
const svg = await fs.readFile('public/logo.svg', 'utf8'),
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage();
  const pngs = [];
  for (const size of [32, 48, 64, 128, 256]) {
    const data = await page.evaluate(
      async ({ svg, size }) => {
        const image = new Image();
        image.src = 'data:image/svg+xml;base64,' + btoa(svg);
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(image, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      },
      { svg, size },
    );
    pngs.push({ size, bytes: Buffer.from(data, 'base64') });
  }
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, bytes }, index) => {
    const p = 6 + index * 16;
    header[p] = header[p + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, p + 4);
    header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(bytes.length, p + 8);
    header.writeUInt32LE(offset, p + 12);
    offset += bytes.length;
  });
  await fs.writeFile('build/icon.ico', Buffer.concat([header, ...pngs.map((item) => item.bytes)]));
  await fs.writeFile('build/icon.png', pngs.at(-1).bytes);
  console.log('Windows application icon rendered.');
} finally {
  await browser.close();
}

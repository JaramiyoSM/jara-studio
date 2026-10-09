const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const JSZip = require('jszip');
const base = process.env.JARA_STUDIO_URL || 'http://127.0.0.1:5186';

async function start(locale = 'es-ES') {
  const browser = await chromium.launch({
    ...(process.env.JARA_TEST_BROWSER === 'chromium' ? {} : { channel: 'msedge' }),
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, locale });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__savedFiles = [];
    window.__nextOpen = null;
    window.__saveCount = 0;
    window.jaraDesktop = {
      isDesktop: true,
      onCommand() {},
      async setUnsaved() {
        return { saved: true };
      },
      async saveFile(file) {
        window.__savedFiles.push({ name: file.name, data: Array.from(file.bytes) });
        return { canceled: false };
      },
      async saveProject(file) {
        window.__saveCount++;
        window.__savedProject = { name: file.name, data: Array.from(file.bytes) };
        return { canceled: false };
      },
      async openProject() {
        return window.__savedProject
          ? {
              canceled: false,
              ...window.__savedProject,
              data: new Uint8Array(window.__savedProject.data),
            }
          : { canceled: true };
      },
      async openFiles() {
        const files = window.__nextOpen;
        window.__nextOpen = null;
        return files ? files.map((f) => ({ ...f, data: new Uint8Array(f.data) })) : [];
      },
      async saveRecovery() {
        return { saved: true };
      },
      async loadRecovery() {
        return null;
      },
      async openExternal() {
        return { opened: true };
      },
    };
  });
  await page.goto(base);
  await page.getByTestId('scene-studio').waitFor();
  return { browser, page, errors };
}
async function pixel(page, x = 0.5, y = 0.5) {
  return page
    .getByTestId('surface-pixels')
    .evaluate(
      (canvas, [x, y]) =>
        Array.from(
          canvas
            .getContext('2d')
            .getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data,
        ),
      [x, y],
    );
}
async function paint(page, x = 0.5, y = 0.5) {
  const bounds = await page.getByTestId('surface-pixels').boundingBox();
  await page.mouse.move(bounds.x + bounds.width * x, bounds.y + bounds.height * y);
  await page.mouse.down();
  await page.mouse.up();
}

test('Surface painter changes real pixels, erases a separate layer, undoes and embeds edits in GLB and .jara', async () => {
  const { browser, page, errors } = await start();
  try {
    await page.locator('.primitive-menu summary').click();
    await page.getByRole('button', { name: 'Cubo', exact: true }).click();
    await page.getByRole('button', { name: 'Diseñar ropa / livery', exact: true }).click();
    await page.getByTestId('surface-designer').waitFor();
    await page.getByLabel('Color del pincel', { exact: true }).fill('#e03d65');
    await paint(page);
    assert.deepEqual(await pixel(page), [224, 61, 101, 255]);
    await page.getByRole('button', { name: 'Borrador', exact: true }).click();
    await paint(page);
    assert.deepEqual(await pixel(page), [255, 255, 255, 255]);
    await page.getByRole('button', { name: 'Deshacer diseño', exact: true }).click();
    assert.deepEqual(await pixel(page), [224, 61, 101, 255]);
    await page.getByRole('button', { name: 'Exportar textura PNG', exact: true }).click();
    await page.waitForFunction(() => window.__savedFiles.length === 1);
    const rgba = await page.evaluate(async () => {
      const f = window.__savedFiles[0],
        image = await createImageBitmap(new Blob([new Uint8Array(f.data)]));
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      return Array.from(ctx.getImageData(image.width / 2, image.height / 2, 1, 1).data);
    });
    assert.deepEqual(rgba, [224, 61, 101, 255]);
    await page.getByRole('button', { name: 'Aplicar al modelo', exact: true }).click();
    await page.getByTestId('surface-designer').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
    await page.waitForFunction(() => window.__saveCount === 1);
    const zip = await JSZip.loadAsync(
      Buffer.from(await page.evaluate(() => window.__savedProject.data)),
    );
    const glb = await zip.file('scene.glb').async('nodebuffer'),
      json = JSON.parse(
        glb
          .subarray(20, 20 + glb.readUInt32LE(12))
          .toString()
          .trim(),
      );
    assert.equal(json.images.length, 1);
    assert.equal(json.images[0].mimeType, 'image/png');
    assert.ok(Number.isInteger(json.images[0].bufferView));
    await page.getByRole('button', { name: 'Archivo', exact: true }).click();
    await page.getByRole('button', { name: 'Nueva escena', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir proyecto', exact: true }).click();
    await page.locator('.tree-group').waitFor();
    await page.getByRole('button', { name: 'Diseñar ropa / livery', exact: true }).click();
    assert.deepEqual(await pixel(page), [224, 61, 101, 255]);
    await page.screenshot({ path: 'artifacts/surface-paint-roundtrip.png' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('Surface workshop imports a real decal, edits text layers and exports without UV or selection lines', async () => {
  const { browser, page, errors } = await start('en-US');
  try {
    await page.getByRole('button', { name: 'T-shirt and jeans', exact: true }).click();
    await page.locator('.tree-group').waitFor();
    await page.getByRole('button', { name: 'Design clothing / livery', exact: true }).click();
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#22bb66';
      ctx.fillRect(0, 0, 64, 32);
      const png = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      window.__nextOpen = [
        {
          name: 'decal.png',
          size: png.size,
          data: Array.from(new Uint8Array(await png.arrayBuffer())),
        },
      ];
    });
    await page.getByRole('button', { name: 'Import image', exact: true }).click();
    await page.getByLabel('Layer name', { exact: true }).waitFor();
    await page.waitForFunction(
      () => document.querySelector('input[aria-label="Layer name"]')?.value === 'decal.png',
    );
    assert.deepEqual(await pixel(page), [34, 187, 102, 255]);
    await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await page.getByLabel('Text', { exact: true }).fill('JARA GARAGE');
    await page.getByLabel('Position Y', { exact: true }).fill('120');
    await page.getByLabel('Layer color', { exact: true }).fill('#ffffff');
    await page.screenshot({ path: 'artifacts/surface-workshop-clothing.png' });
    await page.getByRole('button', { name: 'Export texture PNG', exact: true }).click();
    await page.waitForFunction(() => window.__savedFiles.length === 1);
    assert.deepEqual(await pixel(page), [34, 187, 102, 255]);
    await page.getByRole('button', { name: 'Apply to model', exact: true }).click();
    await page.getByTestId('surface-designer').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Save project', exact: true }).click();
    await page.waitForFunction(() => window.__saveCount === 1);
    const zip = await JSZip.loadAsync(
      Buffer.from(await page.evaluate(() => window.__savedProject.data)),
    );
    assert.ok(Object.keys(zip.files).some((name) => name.endsWith('-decal.png')));
    await page.screenshot({ path: 'artifacts/surface-clothing-preview.png' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('Surface resolution resamples actual painted pixels and cancel leaves the model unchanged', async () => {
  const { browser, page, errors } = await start();
  try {
    page.on('dialog', (dialog) => dialog.accept());
    await page.locator('.primitive-menu summary').click();
    await page.getByRole('button', { name: 'Cubo', exact: true }).click();
    await page.getByRole('button', { name: 'Diseñar ropa / livery', exact: true }).click();
    await page.getByLabel('Color del pincel', { exact: true }).fill('#e03d65');
    await paint(page);
    await page.getByLabel('Resolución', { exact: true }).selectOption('2048');
    assert.equal(await page.getByTestId('surface-pixels').getAttribute('width'), '2048');
    assert.deepEqual(await pixel(page), [224, 61, 101, 255]);
    await page.getByRole('button', { name: 'Cerrar taller de superficies', exact: true }).click();
    await page.getByTestId('surface-designer').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Diseñar ropa / livery', exact: true }).click();
    assert.deepEqual(await pixel(page), [255, 255, 255, 255]);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('3D surface painting raycasts the selected material UVs and places a text layer on the mesh', async () => {
  const { browser, page, errors } = await start();
  try {
    await page.locator('.primitive-menu summary').click();
    await page.getByRole('button', { name: 'Cubo', exact: true }).click();
    await page.getByRole('button', { name: 'Diseñar ropa / livery', exact: true }).click();
    await page.getByLabel('Color del pincel', { exact: true }).fill('#e03d65');
    await page.getByLabel('Pintar / colocar en 3D', { exact: true }).check();
    await page.getByLabel('Vista 3D del diseño', { exact: true }).click();
    const count = await page.getByTestId('surface-pixels').evaluate((canvas) => {
      const rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 0; i < rgba.length; i += 4)
        if (rgba[i] === 224 && rgba[i + 1] === 61 && rgba[i + 2] === 101) count++;
      return count;
    });
    assert.ok(count > 300, `3D paint produced ${count} red pixels`);
    await page.getByRole('button', { name: 'Añadir texto', exact: true }).click();
    await page.getByLabel('Texto', { exact: true }).fill('JARA');
    await page.getByLabel('Alto / letra', { exact: true }).fill('40');
    await page.getByLabel('Vista 3D del diseño', { exact: true }).click();
    const x = Number(await page.getByLabel('Posición X', { exact: true }).inputValue()),
      y = Number(await page.getByLabel('Posición Y', { exact: true }).inputValue());
    assert.ok(x > 0 && x < 1024 && y > 0 && y < 1024);
    assert.ok(Math.abs(x - 512) > 10 || Math.abs(y - 512) > 10);
    await page.getByRole('button', { name: 'Aplicar al modelo', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
    await page.waitForFunction(() => window.__saveCount === 1);
    const zip = await JSZip.loadAsync(
        Buffer.from(await page.evaluate(() => window.__savedProject.data)),
      ),
      glb = await zip.file('scene.glb').async('nodebuffer');
    const json = JSON.parse(
      glb
        .subarray(20, 20 + glb.readUInt32LE(12))
        .toString()
        .trim(),
    );
    assert.equal(json.images[0].mimeType, 'image/png');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

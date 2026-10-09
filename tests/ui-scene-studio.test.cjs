const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
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
    window.__unsaved = {};
    window.__saveCount = 0;
    window.jaraDesktop = {
      isDesktop: true,
      onCommand() {},
      async setUnsaved(module, dirty) {
        window.__unsaved[module] = dirty;
        return { saved: true };
      },
      async saveFile(file) {
        window.__savedFiles.push({ name: file.name, data: Array.from(file.bytes) });
        return { canceled: false, name: file.name };
      },
      async saveProject(file) {
        window.__saveCount++;
        window.__savedProject = { name: file.name, data: Array.from(file.bytes) };
        return { canceled: false, name: file.name };
      },
      async openProject() {
        return window.__savedProject
          ? {
              canceled: false,
              name: window.__savedProject.name,
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
  try {
    await page.goto(base);
    await page.getByTestId('scene-studio').waitFor();
    return { browser, page, errors };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
test('Scene workspace edits transforms, history and multiple real objects', async () => {
  const { browser, page, errors } = await start();
  try {
    await page.locator('.primitive-menu summary').click();
    await page.getByRole('button', { name: 'Cubo', exact: true }).click();
    await page.getByLabel('Posición · m X').fill('2.25');
    await page.getByLabel('Posición · m X').press('Enter');
    assert.equal(await page.getByLabel('Posición · m X').inputValue(), '2.25');
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    assert.equal(await page.getByLabel('Posición · m X').inputValue(), '0');
    await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
    assert.equal(await page.getByLabel('Posición · m X').inputValue(), '2.25');
    await page.getByRole('button', { name: 'Duplicar', exact: true }).click();
    assert.equal(await page.locator('.tree-group').count(), 2);
    await page.getByLabel('Ocultar box copy').click();
    await page.getByLabel('Mostrar box copy').waitFor();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    assert.equal(await page.locator('.tree-group').count(), 1);
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    assert.equal(await page.locator('.tree-group').count(), 2);
    await page.getByLabel('Camera view').selectOption('top');
    await page.getByLabel('Camera view').selectOption('perspective');
    await page.screenshot({ path: 'artifacts/scene-transform-proof.png' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
test('Textured sample saves and reloads as a complete .jara project, including hidden objects', async () => {
  const { browser, page, errors } = await start();
  try {
    await page.getByRole('button', { name: 'Camiseta y vaqueros', exact: true }).click();
    await page.locator('.tree-group').waitFor();
    await page.getByLabel('Posición · m X').fill('1.5');
    await page.getByLabel('Posición · m X').press('Enter');
    await page.getByRole('button', { name: 'Duplicar', exact: true }).click();
    await page.getByLabel('Ocultar Camiseta y vaqueros copy').click();
    await page.getByLabel('Nombre del proyecto').fill('Wardrobe test');
    await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
    await page.waitForFunction(() => window.__savedProject?.data?.length > 10000);
    await page.getByRole('button', { name: 'Archivo', exact: true }).click();
    await page.getByRole('button', { name: 'Nueva escena', exact: true }).click();
    await page.locator('.tree-group').first().waitFor({ state: 'detached' });
    assert.equal(await page.locator('.tree-group').count(), 0);
    await page.getByRole('button', { name: 'Abrir proyecto', exact: true }).click();
    await page.locator('.tree-group').first().waitFor();
    assert.equal(await page.locator('.tree-group').count(), 2);
    await page.locator('.tree-name').first().click();
    assert.equal(await page.getByLabel('Posición · m X').inputValue(), '1.5');
    await page.getByLabel('Mostrar Camiseta y vaqueros copy').waitFor();
    assert.ok(
      await page
        .locator('.inspector-panel')
        .innerText()
        .then((s) => s.includes('1024')),
    );
    await page.locator('.export-block').getByRole('button', { name: 'GLB', exact: true }).click();
    await page.waitForFunction(() =>
      window.__savedFiles.some((f) => f.name === 'Wardrobe test.glb'),
    );
    const files = await page.evaluate(() => window.__savedFiles);
    const glb = Buffer.from(files.find((f) => f.name === 'Wardrobe test.glb').data);
    assert.equal(glb.readUInt32LE(0), 0x46546c67);
    let offset = 12,
      json;
    while (offset < glb.length) {
      const n = glb.readUInt32LE(offset),
        kind = glb.readUInt32LE(offset + 4);
      offset += 8;
      if (kind === 0x4e4f534a)
        json = JSON.parse(
          glb
            .subarray(offset, offset + n)
            .toString()
            .trim(),
        );
      offset += n;
    }
    assert.ok(json.images.length >= 2);
    assert.ok(json.images.every((image) => image.bufferView !== undefined && !image.uri));
    await page.screenshot({ path: 'artifacts/scene-clothing-roundtrip.png' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
test('Rigged human exposes usable animation playback and skeleton inspection', async () => {
  const { browser, page, errors } = await start();
  try {
    await page.getByRole('button', { name: 'Humano articulado', exact: true }).click();
    await page.locator('.tree-group').waitFor();
    const options = await page.getByLabel('Animation clip').locator('option').count();
    assert.ok(options >= 4);
    await page.getByLabel('Animation clip').selectOption('2');
    await page.getByLabel('Esqueleto', { exact: true }).check();
    await page.getByRole('button', { name: 'Play animation', exact: true }).click();
    await page.waitForTimeout(500);
    const time = Number(await page.getByLabel('Tiempo', { exact: true }).inputValue());
    assert.ok(time > 0);
    await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
    await page.getByLabel('Tiempo', { exact: true }).fill('1.1');
    assert.equal(Number(await page.getByLabel('Tiempo', { exact: true }).inputValue()), 1.1);
    await page.getByLabel('Animation clip').selectOption('');
    await page.screenshot({ path: 'artifacts/scene-human-rig.png' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
test('Locale respects the preferred supported browser language and categories preserve scene', async () => {
  const { browser, page, errors } = await start('en-US');
  try {
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.locator('.primitive-menu summary').click();
    await page.getByRole('button', { name: 'Box', exact: true }).click();
    await page.getByRole('button', { name: 'Clothing', exact: true }).click();
    assert.equal(await page.locator('.tree-group').count(), 1);
    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    assert.equal(await page.locator('.tree-group').count(), 1);
    await page.getByRole('button', { name: 'Workflow guide', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.ok((await page.getByRole('dialog').innerText()).includes('does not compile YDR/YDD'));
    await page.getByRole('button', { name: 'Back to studio', exact: true }).click();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
test('OBJ with MTL and a local texture imports without network dependencies and exports embedded GLB', async () => {
  const { browser, page, errors } = await start();
  try {
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#a8c7b1';
      ctx.fillRect(0, 0, 32, 32);
      const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const encode = (value) => Array.from(new TextEncoder().encode(value));
      window.__nextOpen = [
        {
          name: 'quad.obj',
          data: encode(
            'mtllib surface.mtl\no Panel\nv -1 0 0\nv 1 0 0\nv 1 2 0\nv -1 2 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nusemtl Fabric\nf 1/1 2/2 3/3 4/4',
          ),
          size: 160,
        },
        {
          name: 'surface.mtl',
          data: encode('newmtl Fabric\nKd 1 1 1\nmap_Kd cloth.png'),
          size: 45,
        },
        {
          name: 'cloth.png',
          data: Array.from(new Uint8Array(await png.arrayBuffer())),
          size: png.size,
        },
      ];
    });
    await page.getByRole('button', { name: 'Importar GLB / OBJ / FBX', exact: true }).click();
    await page.locator('.tree-group').waitFor();
    assert.ok((await page.locator('.inspector-panel').innerText()).includes('32 × 32'));
    await page.locator('.export-block').getByRole('button', { name: 'GLB', exact: true }).click();
    await page.waitForFunction(() => window.__savedFiles.some((f) => f.name === 'Untitled.glb'));
    const data = await page.evaluate(() => window.__savedFiles[0].data);
    const bytes = Buffer.from(data);
    const json = JSON.parse(
      bytes
        .subarray(20, 20 + bytes.readUInt32LE(12))
        .toString()
        .trim(),
    );
    assert.equal(json.images.length, 1);
    assert.equal(json.images[0].bufferView !== undefined, true);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
test('Animated copies retain distinct exported skeleton targets across project roundtrip', async () => {
  const { browser, page, errors } = await start();
  try {
    await page.getByRole('button', { name: 'Humano articulado', exact: true }).click();
    await page.locator('.tree-group').waitFor();
    await page.getByRole('button', { name: 'Duplicar', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
    await page.waitForFunction(() => window.__savedProject?.data?.length > 10000);
    await page.getByRole('button', { name: 'Archivo', exact: true }).click();
    await page.getByRole('button', { name: 'Nueva escena', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir proyecto', exact: true }).click();
    await page.locator('.tree-group').first().waitFor();
    assert.equal(await page.locator('.tree-group').count(), 2);
    await page.locator('.tree-name').nth(1).click();
    assert.equal(await page.getByLabel('Animation clip').locator('option').count(), 4);
    await page.locator('.export-block').getByRole('button', { name: 'GLB', exact: true }).click();
    await page.waitForFunction(() => window.__savedFiles.length > 0);
    const bytes = Buffer.from(await page.evaluate(() => window.__savedFiles[0].data));
    const json = JSON.parse(
      bytes
        .subarray(20, 20 + bytes.readUInt32LE(12))
        .toString()
        .trim(),
    );
    assert.equal(json.animations.length, 6);
    const first = new Set(json.animations[0].channels.map((c) => c.target.node));
    const second = new Set(json.animations[3].channels.map((c) => c.target.node));
    assert.ok([...first].every((n) => !second.has(n)));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
test('Unavailable WebGL 2 shows a recoverable graphics message without crashing the application', async () => {
  const browser = await chromium.launch({
    ...(process.env.JARA_TEST_BROWSER === 'chromium' ? {} : { channel: 'msedge' }),
    headless: true,
  });
  try {
    const page = await browser.newPage({ locale: 'es-ES' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null;
        return getContext.call(this, type, ...args);
      };
    });
    await page.goto(base);
    await page.getByRole('alert').waitFor();
    assert.ok((await page.getByRole('alert').innerText()).includes('WebGL 2'));
    await page.getByRole('button', { name: 'Ver documentación', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Utilidades', exact: true }).click();
    await page.getByRole('alert').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
test('Shortcut save commits focused transform and name edits and tracks pending changes', async () => {
  const { browser, page, errors } = await start();
  try {
    await page.locator('.primitive-menu summary').click();
    await page.getByRole('button', { name: 'Cubo', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
    await page.waitForFunction(() => window.__saveCount === 1 && window.__unsaved.scene === false);
    await page.getByLabel('Posición · m X').fill('12');
    await page.waitForFunction(() => window.__unsaved.scene === true);
    await page.getByLabel('Posición · m X').press('Control+s');
    await page.waitForFunction(() => window.__saveCount === 2 && window.__unsaved.scene === false);
    const JSZip = require('jszip');
    let zip = await JSZip.loadAsync(
      Buffer.from(await page.evaluate(() => window.__savedProject.data)),
    );
    let manifest = JSON.parse(await zip.file('project.json').async('string'));
    assert.equal(manifest.objects[0].transform[0], 12);
    await page.getByLabel('Object name', { exact: true }).fill('Edited prop');
    await page.waitForFunction(() => window.__unsaved.scene === true);
    await page.getByLabel('Object name', { exact: true }).press('Control+s');
    await page.waitForFunction(() => window.__saveCount === 3 && window.__unsaved.scene === false);
    zip = await JSZip.loadAsync(Buffer.from(await page.evaluate(() => window.__savedProject.data)));
    manifest = JSON.parse(await zip.file('project.json').async('string'));
    assert.equal(manifest.objects[0].name, 'Edited prop');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
test('A failed model in a multi-file import leaves the existing scene and original archive unchanged', async () => {
  const { browser, page, errors } = await start();
  try {
    await page.locator('.primitive-menu summary').click();
    await page.getByRole('button', { name: 'Cubo', exact: true }).click();
    await page.evaluate(() => {
      const data = Array.from(
        new TextEncoder().encode('o Triangle\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'),
      );
      window.__nextOpen = [
        { name: 'valid.obj', data, size: data.length },
        { name: 'broken.glb', data: Array(20).fill(0), size: 20 },
      ];
    });
    await page.getByRole('button', { name: 'Importar GLB / OBJ / FBX', exact: true }).click();
    await page.waitForFunction(() => window.__nextOpen === null);
    await page.getByRole('button', { name: 'Guardar proyecto', exact: true }).click();
    await page.waitForFunction(() => window.__saveCount === 1);
    assert.equal(await page.locator('.tree-group').count(), 1);
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(
      Buffer.from(await page.evaluate(() => window.__savedProject.data)),
    );
    const manifest = JSON.parse(await zip.file('project.json').async('string'));
    assert.equal(manifest.objects[0].name, 'box');
    assert.equal(Object.keys(zip.files).filter((name) => name.startsWith('sources/')).length, 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
test('Invalid transform edits reset the visible value before saving and object names normalize consistently', async () => {
  const { browser, page, errors } = await start();
  try {
    await page.locator('.primitive-menu summary').click();
    await page.getByRole('button', { name: 'Cubo', exact: true }).click();
    const JSZip = require('jszip');
    for (const [index, value] of ['0', '', '10000001'].entries()) {
      await page.getByLabel('Escala X', { exact: true }).fill(value);
      await page.getByLabel('Escala X', { exact: true }).press('Control+s');
      await page.waitForFunction(
        (expected) => window.__saveCount === expected && window.__unsaved.scene === false,
        index + 1,
      );
      assert.equal(await page.getByLabel('Escala X', { exact: true }).inputValue(), '1');
      const zip = await JSZip.loadAsync(
        Buffer.from(await page.evaluate(() => window.__savedProject.data)),
      );
      const manifest = JSON.parse(await zip.file('project.json').async('string'));
      assert.equal(manifest.objects[0].transform[6], 1);
    }
    await page.getByLabel('Object name', { exact: true }).fill('bad/name?');
    await page.getByLabel('Object name', { exact: true }).press('Control+s');
    await page.waitForFunction(() => window.__saveCount === 4 && window.__unsaved.scene === false);
    assert.equal(await page.getByLabel('Object name', { exact: true }).inputValue(), 'bad_name_');
    const zip = await JSZip.loadAsync(
      Buffer.from(await page.evaluate(() => window.__savedProject.data)),
    );
    const manifest = JSON.parse(await zip.file('project.json').async('string'));
    assert.equal(manifest.objects[0].name, 'bad_name_');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const JSZip = require('jszip');
const base = process.env.JARA_STUDIO_URL || 'http://127.0.0.1:5186';
async function start(locale = 'es-ES') {
  const browser = await chromium.launch({
      ...(process.env.JARA_TEST_BROWSER === 'chromium' ? {} : { channel: 'msedge' }),
      headless: true,
      args: ['--enable-unsafe-swiftshader'],
    }),
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale }),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.__savedFiles = [];
    window.__openQueue = [];
    window.jaraDesktop = {
      isDesktop: true,
      onCommand() {},
      async openFiles() {
        return (window.__openQueue.shift() || []).map((file) => ({
          ...file,
          data: new Uint8Array(file.data),
        }));
      },
      async saveFile(file) {
        window.__savedFiles.push({ name: file.name, data: Array.from(file.bytes) });
        return { canceled: false, name: file.name };
      },
      async saveProject() {
        return { canceled: true };
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
  await page
    .getByRole('button', {
      name: locale.startsWith('en') ? 'Utilities' : 'Utilidades',
      exact: true,
    })
    .click();
  await page.getByRole('tab', { name: /Handling/ }).waitFor();
  return { browser, page, errors };
}
const queue = async (page, files) =>
  page.evaluate(
    (files) => window.__openQueue.push(files.map((file) => ({ ...file, size: file.data.length }))),
    files,
  );
async function saved(page, name) {
  await page.waitForFunction(
    (name) => window.__savedFiles.some((file) => file.name === name),
    name,
  );
  return Buffer.from(
    await page.evaluate(
      (name) => window.__savedFiles.filter((file) => file.name === name).at(-1).data,
      name,
    ),
  );
}
test('Handling workflow edits a multi-car XML, retains unknown fields, and survives tool and scene navigation', async () => {
  const { browser, page, errors } = await start();
  try {
    const xml =
      '<?xml version="1.0"?><CHandlingDataMgr><HandlingData><Item type="CHandlingData"><handlingName>CAR_A</handlingName><fMass value="1200"/><fSteeringLock value="30"/><custom preserved="yes"/></Item><Item type="CHandlingData"><handlingName>CAR_B</handlingName><fMass value="1800"/><fSteeringLock value="40"/></Item></HandlingData></CHandlingDataMgr>';
    await queue(page, [{ name: 'handling.meta', data: Array.from(Buffer.from(xml)) }]);
    await page.getByRole('button', { name: 'Importar XML', exact: true }).click();
    await page.getByRole('button', { name: 'CAR_A handling.meta', exact: true }).waitFor();
    await page
      .locator('.tb-field-grid label')
      .filter({ hasText: 'Masa' })
      .locator('input')
      .fill('1450');
    await page.getByRole('button', { name: 'Aplicar cambios', exact: true }).click();
    await page.getByRole('button', { name: 'XML del archivo activo', exact: true }).click();
    assert.equal((await saved(page, 'handling.meta')).toString(), xml.replace('1200', '1450'));
    await page.getByRole('tab', { name: /Texturas/ }).click();
    await page.getByRole('tab', { name: /Handling/ }).click();
    assert.equal(
      await page
        .locator('.tb-field-grid label')
        .filter({ hasText: 'Masa' })
        .locator('input')
        .inputValue(),
      '1450',
    );
    await page.getByRole('button', { name: 'Escena', exact: true }).click();
    await page.getByRole('button', { name: 'Utilidades', exact: true }).click();
    assert.equal(
      await page
        .locator('.tb-field-grid label')
        .filter({ hasText: 'Masa' })
        .locator('input')
        .inputValue(),
      '1450',
    );
    await page.getByRole('button', { name: 'ZIP de todos los archivos', exact: true }).click();
    const zip = await JSZip.loadAsync(await saved(page, 'jara_handling.zip'));
    assert.ok(zip.file('jara_handling/fxmanifest.lua'));
    assert.match(
      await zip.file('jara_handling/data/handling_1.meta').async('string'),
      /<custom preserved="yes"/,
    );
    await page.getByRole('checkbox', { name: 'Seleccionar CAR_A', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Seleccionar CAR_B', exact: true }).check();
    await page.getByRole('button', { name: 'Drift', exact: true }).click();
    assert.equal(
      await page
        .locator('.tb-field-grid label')
        .filter({ hasText: 'Giro' })
        .locator('input')
        .inputValue(),
      '55',
    );
    await page.getByRole('button', { name: 'CAR_B handling.meta', exact: true }).click();
    assert.equal(
      await page
        .locator('.tb-field-grid label')
        .filter({ hasText: 'Giro' })
        .locator('input')
        .inputValue(),
      '55',
    );
    await fs.mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/toolbox-handling.png' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
test('Texture worker displays real alpha and mip levels; YTD export retains unselected DDS data', async () => {
  const codec = await import('../renderer/lib/texture-codec.js'),
    a = new Uint8Array(8 * 8 * 4),
    b = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < a.length; i += 4) {
    a.set([30, 90, 200, 100], i);
    b.set([70, 180, 100, 255], i);
  }
  const first = codec.encodeDDS(a, 8, 8, { format: 'RGBA8' }),
    second = codec.encodeDDS(b, 8, 8, { format: 'BC3' }),
    { browser, page, errors } = await start();
  try {
    await page.getByRole('tab', { name: /Texturas/ }).click();
    await queue(page, [
      { name: 'first.dds', data: Array.from(first) },
      { name: 'second.dds', data: Array.from(second) },
    ]);
    await page.getByRole('button', { name: 'Abrir texturas', exact: true }).click();
    await page.locator('.tb-textures-layout .tb-list-item').nth(1).waitFor();
    await page.getByRole('button', { name: 'A', exact: true }).click();
    await page.waitForFunction(() => {
      const c = document.querySelector('.tb-texture-canvas canvas');
      return c?.width === 8 && c.getContext('2d').getImageData(0, 0, 1, 1).data[0] === 100;
    });
    await page.getByRole('button', { name: /^Mip 1/ }).click();
    await page.waitForFunction(
      () => document.querySelector('.tb-texture-canvas canvas')?.width === 4,
    );
    await page.getByRole('button', { name: 'Ninguna', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Seleccionar first', exact: true }).check();
    await page.getByLabel('Formato', { exact: true }).selectOption('BC1');
    await page.getByRole('button', { name: 'Recodificar 1', exact: true }).click();
    await page
      .getByRole('button', { name: 'Recodificar 1', exact: true })
      .waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('.tb-progress'));
    assert.equal(
      await page.locator('.tb-error').count(),
      0,
      await page.locator('.tb-error').allTextContents(),
    );
    await page.getByRole('button', { name: 'YTD completo de la mesa', exact: true }).click();
    const bytes = await saved(page, 'jara_textures.ytd'),
      entries = await codec.inspectTextureFile(new File([bytes], 'roundtrip.ytd'));
    assert.equal(entries.length, 2);
    assert.equal(entries.find((entry) => entry.name === 'first').codec, 'DXT1');
    assert.deepEqual(
      Buffer.from(entries.find((entry) => entry.name === 'second')._encoded),
      Buffer.from(codec.decodeDDS(second).allLevels),
    );
    await page.getByRole('button', { name: 'RGB', exact: true }).click();
    await page.screenshot({ path: 'artifacts/toolbox-textures.png' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
test('Map editor exports a real six-vertex zone, XY postals, PNG and GPS resource independently of zoom', async () => {
  const { browser, page, errors } = await start();
  try {
    await page.getByRole('tab', { name: /Map Studio/ }).click();
    await page.getByRole('button', { name: 'Probar una zona', exact: true }).click();
    await page.locator('.tb-map-viewport polygon').waitFor();
    assert.equal(
      (await page.locator('.tb-map-viewport polygon').getAttribute('points')).split(' ').length,
      6,
    );
    await page.getByRole('button', { name: 'Zonas JSON', exact: true }).click();
    const source = JSON.parse((await saved(page, 'jara-map-zones.json')).toString());
    assert.equal(source.layers.length, 2);
    assert.equal(source.layers[0].points.length, 6);
    await page.getByRole('button', { name: 'Postals JSON', exact: true }).click();
    const postals = JSON.parse((await saved(page, 'postals.json')).toString());
    assert.deepEqual(postals, [{ code: '3030', x: 2860, y: 116 }]);
    await page.getByRole('button', { name: 'Recurso /jaragps', exact: true }).click();
    const zip = await JSZip.loadAsync(await saved(page, 'jara_postals.zip'));
    assert.match(await zip.file('jara_postals/client.lua').async('string'), /SetNewWaypoint/);
    await page.getByRole('button', { name: 'Mapa PNG completo', exact: true }).click();
    const png = await saved(page, 'jara-map.png');
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 2048);
    await page.screenshot({ path: 'artifacts/toolbox-map.png' });
    const beforePoints = await page.locator('.tb-map-viewport polygon').getAttribute('points');
    const vertex = page.locator('.tb-map-viewport svg>circle').first(),
      box = await vertex.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10, { steps: 5 });
    await page.mouse.up();
    assert.notEqual(
      await page.locator('.tb-map-viewport polygon').getAttribute('points'),
      beforePoints,
    );
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    assert.equal(
      await page.locator('.tb-map-viewport polygon').getAttribute('points'),
      beforePoints,
    );
    await page.getByRole('button', { name: 'Bloquear Ruta Jara', exact: true }).click();
    assert.equal(await page.locator('.tb-map-viewport svg>circle').count(), 0);
    await page.getByRole('button', { name: 'Desbloquear Ruta Jara', exact: true }).click();
    await page.getByRole('button', { name: 'Dibujar zona', exact: true }).click();
    const canvas = await page
      .getByRole('img', { name: 'Lienzo de mapa editable', exact: true })
      .boundingBox();
    for (const p of [
      [80, 80],
      [140, 80],
      [110, 140],
    ])
      await page.mouse.click(canvas.x + p[0], canvas.y + p[1]);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.tb-map-viewport polygon').count(), 2);
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    assert.equal(await page.locator('.tb-map-viewport polygon').count(), 1);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
test('Native resource workflow validates files and generates only matching manifest declarations in English', async () => {
  const { browser, page, errors } = await start('en-US');
  try {
    await page.getByRole('tab', { name: /Resources/ }).click();
    const native = Buffer.alloc(32);
    native.write('RSC7');
    native.writeUInt32LE(13, 4);
    await queue(page, [{ name: 'example.ytd', data: Array.from(native) }]);
    await page.getByRole('button', { name: 'Add files', exact: true }).click();
    await page.getByText('stream/example.ytd', { exact: true }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'Create resource ZIP', exact: true }).isEnabled(),
      false,
    );
    await page
      .getByRole('checkbox', {
        name: 'I have reviewed file dependencies and permissions.',
        exact: true,
      })
      .check();
    await page.getByRole('button', { name: 'Create resource ZIP', exact: true }).click();
    const zip = await JSZip.loadAsync(await saved(page, 'jara_resource.zip'));
    assert.deepEqual(
      await zip.file('jara_resource/stream/example.ytd').async('nodebuffer'),
      native,
    );
    assert.equal(
      (await zip.file('jara_resource/fxmanifest.lua').async('string')).includes('data_file'),
      false,
    );
    await page.screenshot({ path: 'artifacts/toolbox-resource.png' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('Livery workflow requires the target dictionary, checks real entries and exports dependencies with exact original bytes', async () => {
  const { browser, page, errors } = await start('en-US');
  try {
    const codec = await import('../renderer/lib/texture-codec.js');
    const rgba = new Uint8Array(16 * 16 * 4).fill(240);
    const blob = await codec.buildYtdFromDDS([
      { name: 'jara_sign_1', dds: codec.encodeDDS(rgba, 16, 16, { format: 'BC3' }) },
    ]);
    const data = Buffer.from(await blob.arrayBuffer());
    await page.getByRole('tab', { name: /Resources/ }).click();
    await page.getByRole('button', { name: 'Vehicle livery / texture', exact: true }).click();
    await queue(page, [{ name: 'jara_car.ytd', data: Array.from(data) }]);
    await page.getByRole('button', { name: 'Add files', exact: true }).click();
    await page.getByText('Missing files', { exact: true }).waitFor();
    await page
      .getByRole('checkbox', {
        name: 'I have reviewed file dependencies and permissions.',
        exact: true,
      })
      .check();
    assert.equal(
      await page.getByRole('button', { name: 'Create resource ZIP', exact: true }).isEnabled(),
      false,
    );
    await page.getByLabel('Target dictionary (without .ytd)', { exact: true }).fill('jara_car');
    await page.getByRole('button', { name: 'Check YTD', exact: true }).click();
    await page.getByText('1 textures', { exact: false }).waitFor();
    await page.locator('.rp-dictionaries details summary').click();
    await page.getByText('jara_sign_1', { exact: true }).waitFor();
    await page.getByText('Dependencies and build', { exact: true }).click();
    await page.getByLabel('External resources', { exact: true }).fill('jara_vehicle');
    await page.getByLabel('Minimum build (optional)', { exact: true }).fill('3095');
    await page.getByRole('button', { name: 'Save report', exact: true }).click();
    const report = JSON.parse((await saved(page, 'jara_resource-validation.json')).toString());
    assert.equal(report.dictionaries[0].textures[0].name, 'jara_sign_1');
    assert.equal(report.runtimeTested, false);
    await page
      .getByRole('checkbox', {
        name: 'I have reviewed file dependencies and permissions.',
        exact: true,
      })
      .check();
    await page.getByRole('button', { name: 'Create resource ZIP', exact: true }).click();
    const zip = await JSZip.loadAsync(await saved(page, 'jara_resource.zip'));
    assert.deepEqual(await zip.file('jara_resource/stream/jara_car.ytd').async('nodebuffer'), data);
    assert.match(await zip.file('jara_resource/fxmanifest.lua').async('string'), /jara_vehicle/);
    assert.match(await zip.file('jara_resource/fxmanifest.lua').async('string'), /gameBuild:3095/);
    await page.screenshot({ path: 'artifacts/toolbox-resource-livery.png' });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('Failed internal YTD inspection blocks export while retaining local files and report access in Spanish', async () => {
  const { browser, page, errors } = await start();
  try {
    await page.getByRole('tab', { name: /Recursos/ }).click();
    const data = Buffer.alloc(32);
    data.write('RSC7');
    data.writeUInt32LE(13, 4);
    await queue(page, [{ name: 'bad.ytd', data: Array.from(data) }]);
    await page.getByRole('button', { name: 'Añadir archivos', exact: true }).click();
    await page.getByRole('button', { name: 'Comprobar YTD', exact: true }).click();
    await page.getByText('Diccionario inválido', { exact: true }).waitFor();
    await page
      .getByRole('checkbox', {
        name: 'He revisado las dependencias y los permisos de estos archivos.',
        exact: true,
      })
      .check();
    assert.equal(
      await page.getByRole('button', { name: 'Crear recurso ZIP', exact: true }).isEnabled(),
      false,
    );
    await page.getByRole('button', { name: 'Guardar informe', exact: true }).click();
    const report = JSON.parse((await saved(page, 'jara_resource-validation.json')).toString());
    assert.ok(report.dictionaries[0].error);
    await page.getByRole('tab', { name: /Handling/ }).click();
    await page.getByRole('tab', { name: /Recursos/ }).click();
    assert.equal(await page.getByText('stream/bad.ytd', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Diccionario inválido', { exact: true }).count(), 1);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

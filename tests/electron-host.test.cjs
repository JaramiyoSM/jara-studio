const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require('playwright');
const JSZip = require('jszip');

test(
  'Native host isolates the renderer and round-trips real project/export files',
  {
    skip: process.env.JARA_NATIVE_TESTS !== '1' || process.platform !== 'win32',
    timeout: 120000,
  },
  async () => {
    const directory = path.resolve('artifacts/native-host');
    await fs.mkdir(directory, { recursive: true });
    const application = await _electron.launch({
      executablePath: require('electron'),
      args: [
        '.',
        '--lang=es-ES',
        '--user-data-dir=' + path.join(directory, 'profile'),
        ...(process.env.CI ? ['--enable-unsafe-swiftshader'] : []),
      ],
      cwd: process.cwd(),
      timeout: 30000,
    });
    try {
      await application.evaluate(({ app, dialog }, directory) => {
        app.setPath('userData', directory);
        global.__savePath = null;
        global.__openPaths = [];
        global.__saveCount = 0;
        dialog.showSaveDialog = async () => {
          global.__saveCount++;
          return global.__savePath
            ? { canceled: false, filePath: global.__savePath }
            : { canceled: true };
        };
        dialog.showOpenDialog = async () => ({
          canceled: !global.__openPaths.length,
          filePaths: global.__openPaths,
        });
      }, directory);
      const page = await application.firstWindow();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.getByTestId('scene-studio').waitFor();
      assert.equal(page.url(), 'jara://studio/index.html');
      const security = await page.evaluate(async () => ({
        require: typeof window.require,
        process: typeof window.process,
        desktop: window.jaraDesktop.isDesktop,
        version: await window.jaraDesktop.getVersion(),
        missing: (await fetch('jara://studio/missing-file.txt')).status,
        traversal: (await fetch('jara://studio/%2e%2e%2felectron%2fmain.cjs')).status,
      }));
      assert.deepEqual(security, {
        require: 'undefined',
        process: 'undefined',
        desktop: true,
        version: '0.1.0',
        missing: 404,
        traversal: 404,
      });
      const preferences = await application.evaluate(({ BrowserWindow }) => {
        const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
        return {
          sandbox: p.sandbox,
          isolated: p.contextIsolation,
          node: p.nodeIntegration,
          security: p.webSecurity,
        };
      });
      assert.deepEqual(preferences, { sandbox: true, isolated: true, node: false, security: true });
      assert.equal(
        await page.evaluate(async () => {
          try {
            await fetch('https://example.com/');
            return false;
          } catch {
            return true;
          }
        }),
        true,
      );
      assert.equal(
        await page.evaluate(async () => {
          try {
            await window.jaraDesktop.openExternal('file:///C:/Windows/notepad.exe');
            return false;
          } catch {
            return true;
          }
        }),
        true,
      );

      await application.evaluate(
        (_electron, filenames) => (global.__openPaths = filenames),
        [path.resolve('public/samples/clothing.glb')],
      );
      await page
        .locator('.objects-panel')
        .getByRole('button', { name: /Importar GLB|Import GLB/ })
        .click();
      await page.locator('.tree-group').first().waitFor();
      await page.getByLabel(/Nombre del proyecto|Project name/).fill('Native wardrobe');
      const projectPath = path.join(directory, 'Native wardrobe.jara');
      await application.evaluate(
        (_electron, filename) => (global.__savePath = filename),
        projectPath,
      );
      await page
        .locator('.header-actions')
        .getByRole('button', { name: /Guardar proyecto|Save project/, exact: true })
        .click();
      await page.waitForFunction(() =>
        /Proyecto guardado|Project saved/.test(document.body.innerText),
      );
      const archive = await fs.readFile(projectPath);
      const { readProjectArchive } = await import('../renderer/lib/scene-project.js');
      const decoded = await readProjectArchive(new Uint8Array(archive));
      assert.equal(decoded.manifest.name, 'Native wardrobe');
      assert.equal(decoded.manifest.objects.length, 1);
      assert.ok(decoded.scene.length > 100000);
      assert.equal(decoded.sources.length, 1);
      const zip = await JSZip.loadAsync(archive);
      assert.ok(zip.file('scene.glb'));

      await page.locator('.header-menu-button').click();
      await page.getByRole('button', { name: /Nueva escena|New scene/, exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.tree-group').length === 0);
      assert.equal(await page.locator('.tree-group').count(), 0);
      await application.evaluate(
        (_electron, filename) => (global.__openPaths = [filename]),
        projectPath,
      );
      await page
        .locator('.header-actions')
        .getByRole('button', { name: /Abrir proyecto|Open project/, exact: true })
        .click();
      await page.locator('.tree-group').first().waitFor();
      assert.equal(await page.locator('.tree-group').count(), 1);

      const exportPath = path.join(directory, 'Native wardrobe.glb');
      await application.evaluate(
        (_electron, filename) => (global.__savePath = filename),
        exportPath,
      );
      await page.locator('.export-block').getByRole('button', { name: 'GLB', exact: true }).click();
      await page.waitForFunction(() =>
        /Archivo exportado|File exported/.test(document.body.innerText),
      );
      const glb = await fs.readFile(exportPath);
      assert.equal(glb.readUInt32LE(0), 0x46546c67);
      assert.equal(glb.readUInt32LE(8), glb.length);
      const manifest = JSON.parse(
        glb
          .subarray(20, 20 + glb.readUInt32LE(12))
          .toString()
          .trim(),
      );
      assert.ok(manifest.images.length >= 2);
      assert.ok(manifest.images.every((image) => image.bufferView !== undefined));

      await page.evaluate(async (bytes) => {
        await window.jaraDesktop.saveRecovery(new Uint8Array(bytes));
        const result = await window.jaraDesktop.loadRecovery();
        if (result.data.length !== bytes.length) throw Error('Recovery mismatch');
      }, Array.from(archive));
      assert.deepEqual(await fs.readFile(path.join(directory, 'recovery.jara')), archive);
      await page.evaluate(() => window.jaraDesktop.clearRecovery());
      assert.equal(await page.evaluate(() => window.jaraDesktop.loadRecovery()), null);
      await page.evaluate(async () => {
        try {
          await window.jaraDesktop.saveProject({
            name: 'bad.jara',
            bytes: new Uint8Array([1, 2, 3]),
          });
        } catch {
          return;
        }
        throw Error('Invalid archive was accepted');
      });

      await application.evaluate(({ Menu }) =>
        Menu.getApplicationMenu().items[2].submenu.items[0].click(),
      );
      await page.getByRole('dialog').waitFor();
      await page
        .getByRole('button', { name: /Volver al estudio|Back to studio/, exact: true })
        .click();
      await page.evaluate(() => window.jaraDesktop.setUnsaved('handling', true));
      await application.evaluate(({ dialog, BrowserWindow }) => {
        dialog.showMessageBox = async () => ({ response: 0 });
        BrowserWindow.getAllWindows()[0].close();
      });
      assert.equal(
        await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
        1,
      );
      assert.equal(await page.locator('.tree-group').count(), 1);
      await page.evaluate(() => window.jaraDesktop.setUnsaved('handling', false));
      await page.screenshot({ path: path.join(directory, 'native-scene.png') });
      assert.deepEqual(errors, []);
    } finally {
      await application.close();
    }
  },
);

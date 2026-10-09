import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  validateResourceFiles,
  resourceManifest,
  packResource,
} from '../renderer/lib/toolbox-resource.js';
const enc = new TextEncoder();
function native(name, version = 13) {
  const data = new Uint8Array(32);
  data.set(enc.encode('RSC7'));
  new DataView(data.buffer).setUint32(4, version, true);
  return { name, data };
}
test('Resource manifest declares present metadata and YTYP without inventing model data files', () => {
  const files = [
      native('custom_prop.ydr', 165),
      native('custom_prop.ytd'),
      native('custom_pack.ytyp', 2),
      {
        name: 'handling.meta',
        data: enc.encode('<CHandlingDataMgr><HandlingData/></CHandlingDataMgr>'),
      },
    ],
    report = validateResourceFiles(files),
    manifest = resourceManifest(report);
  assert.match(manifest, /DLC_ITYP_REQUEST.*stream\/custom_pack.ytyp/);
  assert.match(manifest, /HANDLING_FILE.*data\/handling.meta/);
  assert.match(manifest, /this_is_a_map 'yes'/);
  assert.ok(!manifest.includes('VEHICLE_METADATA_FILE'));
  assert.ok(!manifest.includes('custom_prop.ydr'));
  assert.equal(report.files.length, 4);
});
test('Resource pack retains native bytes and warns about external model dependencies', async () => {
  const files = [
      native('demo.yft', 162),
      {
        name: 'vehicles.meta',
        data: enc.encode(
          '<CVehicleModelInfo__InitDataList><InitDatas><Item><modelName>demo</modelName><txdName>basegame</txdName></Item></InitDatas></CVehicleModelInfo__InitDataList>',
        ),
      },
    ],
    { bytes, report } = await packResource(files, 'jara_demo'),
    zip = await JSZip.loadAsync(bytes);
  assert.deepEqual(await zip.file('jara_demo/stream/demo.yft').async('uint8array'), files[0].data);
  assert.equal(report.warnings.length, 1);
  assert.match(report.warnings[0], /basegame/);
  assert.match(await zip.file('jara_demo/fxmanifest.lua').async('string'), /VEHICLE_METADATA_FILE/);
  assert.ok(zip.file('jara_demo/validation.json'));
});
test('Resource validation rejects traversal, collisions, escrow, GLB and mismatched metadata', async () => {
  for (const files of [
    [native('../evil.ydr')],
    [native('Foo.ytd'), native('foo.ytd')],
    [native('con.ytd')],
    [{ name: 'encrypted.ydr', data: enc.encode('FXAP'.padEnd(32, 'x')) }],
    [{ name: 'preview.glb', data: enc.encode('glTF') }],
    [{ name: 'vehicles.meta', data: enc.encode('<WrongRoot/>') }],
    [native('enhanced.ytd', 25)],
  ])
    assert.throws(() => validateResourceFiles(files));
  await assert.rejects(() => packResource([native('safe.ytd')], '../bad'));
});
test('Clothing caret names and native YMT metadata retain exact stream paths without invented declarations', async () => {
  const shirt = native('mp_m_freemode_01_mypack^jbib_diff_000_a_uni.ytd'),
    metadata = native('mp_m_freemode_01_mypack.ymt', 2),
    { bytes, report } = await packResource([shirt, metadata], 'jara_clothes'),
    zip = await JSZip.loadAsync(bytes);
  assert.equal(report.files[0].path, `stream/${shirt.name}`);
  assert.equal(report.files[1].path, `stream/${metadata.name}`);
  assert.deepEqual(
    await zip.file(`jara_clothes/stream/${shirt.name}`).async('uint8array'),
    shirt.data,
  );
  assert.deepEqual(
    await zip.file(`jara_clothes/stream/${metadata.name}`).async('uint8array'),
    metadata.data,
  );
  assert.equal(resourceManifest(report).includes('data_file'), false);
  for (const bad of [
    '..^/escape.ymt',
    'pack\\clothes^diff.ytd',
    "pack^';evil.ytd",
    'NUL.ymt',
    'pack^\u0000.ymt',
  ])
    assert.throws(() => validateResourceFiles([native(bad)]), /Unsafe file name/);
  assert.throws(
    () =>
      validateResourceFiles([
        { name: 'fake.ymt', data: enc.encode('not a valid native resource') },
      ]),
    /RSC7/,
  );
});

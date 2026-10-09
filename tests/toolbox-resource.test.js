import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  validateResourceFiles,
  resourceManifest,
  packResource,
  inspectResourceDictionaries,
  resourceWorkflowSteps,
  resourceReportText,
} from '../renderer/lib/toolbox-resource.js';
import {
  buildYtdFromDDS,
  encodeDDS,
  inspectTextureDictionary,
} from '../renderer/lib/texture-codec.js';
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

test('Vehicle references check file type and resolve handling IDs without silently treating a texture as a model', () => {
  const xml =
    '<CVehicleModelInfo__InitDataList><InitDatas><Item><modelName>jara_car</modelName><txdName>jara_car</txdName><handlingId>JARA_CAR</handlingId></Item></InitDatas></CVehicleModelInfo__InitDataList>';
  const files = [
    native('jara_car.ytd'),
    { name: 'vehicles.meta', data: enc.encode(xml) },
    {
      name: 'handling.meta',
      data: enc.encode(
        '<CHandlingDataMgr><HandlingData><Item><handlingName>JARA_CAR</handlingName></Item></HandlingData></CHandlingDataMgr>',
      ),
    },
  ];
  const report = validateResourceFiles(files, { profile: 'vehicle' });
  assert.equal(report.readiness, 'needs-files');
  assert.equal(report.references.find((item) => item.kind === 'model').present, false);
  assert.equal(report.references.find((item) => item.kind === 'texture').present, true);
  assert.equal(report.references.find((item) => item.kind === 'handling').present, true);
  assert.ok(report.issues.some((item) => item.code === 'missing-vehicle-model'));
  const duplicate = {
    name: 'handling.meta',
    data: enc.encode(
      '<CHandlingDataMgr><HandlingData><Item><handlingName>SAME</handlingName></Item><Item><handlingName>same</handlingName></Item></HandlingData></CHandlingDataMgr>',
    ),
  };
  assert.equal(validateResourceFiles([duplicate]).readiness, 'needs-files');
});

test('Named workflows refuse incomplete packs and preserve explicit dependencies and game-build constraints', async () => {
  const files = [native('my_prop.ydr', 165)];
  await assert.rejects(
    () => packResource(files, 'jara_prop', { profile: 'prop' }),
    /missing required files/,
  );
  files.push(native('my_props.ytyp', 2));
  const { bytes, report } = await packResource(files, 'jara_prop', {
    profile: 'prop',
    dependencies: ['jara_assets'],
    gameBuild: 3095,
    locale: 'en',
  });
  const zip = await JSZip.loadAsync(bytes),
    manifest = await zip.file('jara_prop/fxmanifest.lua').async('string');
  assert.match(manifest, /files \{\n  'stream\/my_props.ytyp',/);
  assert.match(manifest, /data_file 'DLC_ITYP_REQUEST' 'stream\/my_props.ytyp'/);
  assert.match(manifest, /'jara_assets'/);
  assert.match(manifest, /'\/gameBuild:3095'/);
  assert.equal(report.options.profile, 'prop');
  assert.match(await zip.file('jara_prop/README.txt').async('string'), /Copy the ZIP folder/);
  assert.equal(
    JSON.parse(await zip.file('jara_prop/validation.json').async('string')).runtimeTested,
    false,
  );
  await assert.rejects(
    () => packResource(files, 'jara_prop', { dependencies: ['jara_prop'] }),
    /depend on itself/,
  );
  for (const options of [
    { dependencies: ["safe';os.execute('bad')"] },
    { gameBuild: 3095.5 },
    { target: '../target' },
    { profile: 'invented' },
  ])
    assert.throws(() => validateResourceFiles(files, options));
});

test('Raw map/archetype XML and ShopPedApparel collections receive correct declarations without altering XML', async () => {
  const mapXML = '<?xml version="1.0"?><CMapData><name>jara_place</name><entities/></CMapData>';
  const archetypeXML =
    '<CMapTypes><archetypes><Item type="CBaseArchetypeDef"><name>jara_prop</name><assetType>ASSET_TYPE_DRAWABLE</assetType><assetName>jara_prop</assetName><textureDictionary>jara_prop</textureDictionary></Item></archetypes></CMapTypes>';
  const shopXML =
    '<ShopPedApparel><pedName>mp_m_freemode_01</pedName><dlcName>jara</dlcName><fullDlcName>mp_m_freemode_01_jara</fullDlcName><pedComponents/></ShopPedApparel>';
  const files = [
    native('jara_prop.ydr', 165),
    native('jara_prop.ytd'),
    { name: 'jara_place.ymap', data: enc.encode(mapXML) },
    { name: 'jara_props.ytyp', data: enc.encode(archetypeXML) },
  ];
  const { bytes, report } = await packResource(files, 'jara_map', { profile: 'map' });
  const zip = await JSZip.loadAsync(bytes);
  assert.equal(await zip.file('jara_map/stream/jara_place.ymap').async('string'), mapXML);
  assert.equal(await zip.file('jara_map/stream/jara_props.ytyp').async('string'), archetypeXML);
  assert.equal(
    report.references.every((ref) => ref.present),
    true,
  );
  assert.equal(
    report.files.find((file) => file.extension === 'ytyp').validation,
    'Raw XML root and syntax',
  );
  assert.throws(
    () => validateResourceFiles([{ name: 'bad.ymap', data: enc.encode('<CMapTypes/>') }]),
    /expected CMapData/,
  );
  const clothing = [
    native('mp_m_freemode_01_jara^jbib_000_u.ydd', 165),
    native('mp_m_freemode_01_jara^jbib_diff_000_a_uni.ytd'),
    native('mp_m_freemode_01_jara.ymt', 2),
    { name: 'mp_m_freemode_01_jara_shop.meta', data: enc.encode(shopXML) },
  ];
  const packed = await packResource(clothing, 'jara_clothes', { profile: 'clothing' }),
    archive = await JSZip.loadAsync(packed.bytes);
  assert.equal(packed.report.readiness, 'ready-to-test');
  assert.match(
    await archive.file('jara_clothes/fxmanifest.lua').async('string'),
    /SHOP_PED_APPAREL_META_FILE.*mp_m_freemode_01_jara_shop.meta/,
  );
  assert.equal(
    await archive.file('jara_clothes/data/mp_m_freemode_01_jara_shop.meta').async('string'),
    shopXML,
  );
});

test('Livery inspection reads real texture entries, retains the whole dictionary, and rejects failed or stale inspections', async () => {
  const pixels = new Uint8Array(8 * 8 * 4).fill(255),
    blob = await buildYtdFromDDS([
      { name: 'jara_sign_1', dds: encodeDDS(pixels, 8, 8, { format: 'BC3', mipmaps: true }) },
      { name: 'body_d', dds: encodeDDS(pixels, 8, 8, { format: 'BC1', mipmaps: false }) },
    ]);
  const files = [{ name: 'jara_car.ytd', data: new Uint8Array(await blob.arrayBuffer()) }];
  const dictionaries = await inspectResourceDictionaries(files, inspectTextureDictionary);
  assert.equal(dictionaries.length, 1);
  assert.equal(dictionaries[0].error, null);
  assert.deepEqual(dictionaries[0].textures.map((item) => item.name).sort(), [
    'body_d',
    'jara_sign_1',
  ]);
  assert.equal(dictionaries[0].textures.find((item) => item.name === 'jara_sign_1').levels, 2);
  assert.equal(
    dictionaries[0].textures.some((item) => Object.hasOwn(item, '_encoded')),
    false,
  );
  assert.ok(dictionaries[0].warnings.some((warning) => warning.includes('no mip chain')));
  const { bytes, report } = await packResource(files, 'jara_livery', {
    profile: 'livery',
    target: 'jara_car',
    dictionaryInspection: dictionaries,
  });
  const zip = await JSZip.loadAsync(bytes);
  assert.deepEqual(
    await zip.file('jara_livery/stream/jara_car.ytd').async('uint8array'),
    files[0].data,
  );
  assert.equal(report.dictionaries[0].textures.length, 2);
  await assert.rejects(
    () => packResource(files, 'jara_livery', { profile: 'livery', target: 'wrong_car' }),
    /missing required files/,
  );
  await assert.rejects(
    () =>
      packResource(files, 'jara_livery', {
        dictionaryInspection: [{ ...dictionaries[0], bytes: 1 }],
      }),
    /outdated/,
  );
  const bad = [native('invalid.ytd')],
    failed = await inspectResourceDictionaries(bad, inspectTextureDictionary);
  assert.ok(failed[0].error);
  await assert.rejects(
    () => packResource(bad, 'jara_livery', { dictionaryInspection: failed }),
    /failed inspection/,
  );
});

test('Workflow guidance and reports explain external compilation and installation in both languages', () => {
  const report = validateResourceFiles([native('model.ytd')]);
  assert.ok(resourceWorkflowSteps('clothing', 'es').some((text) => text.includes('componente 11')));
  assert.ok(resourceWorkflowSteps('weapon', 'en').some((text) => text.includes('WEAPON_')));
  assert.match(resourceReportText(report, 'jara_resource', 'es'), /ensure jara_resource/);
  assert.match(resourceReportText(report, 'jara_resource', 'en'), /No source files were compiled/);
});

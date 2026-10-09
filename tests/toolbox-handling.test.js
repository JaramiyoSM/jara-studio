import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  inspectHandling,
  editHandling,
  handlingPreset,
  handlingExample,
  packHandling,
} from '../renderer/lib/toolbox-handling.js';
import { parseXML, decodeXML } from '../renderer/lib/toolbox-xml.js';
const multi = `<?xml version="1.0"?><CHandlingDataMgr><!-- preserve -->\n<HandlingData><Item type="CHandlingData"><handlingName>CAR_A</handlingName><fMass value='1200'/><fDriveBiasFront value="0.5"/><fSteeringLock value="30"/><unknown keep="a &gt; b"/><SubHandlingData><Item type="CBoatHandlingData"><fMass value="999"/></Item></SubHandlingData></Item><Item type="CHandlingData"><handlingName>CAR_B</handlingName><fMass value="1800"/><fSteeringLock value="40"/></Item></HandlingData></CHandlingDataMgr>`;
test('Handling edits one vehicle while preserving unknown fields, quote style and subhandling', () => {
  assert.equal(inspectHandling(multi).length, 2);
  const out = editHandling(multi, 0, { fMass: 1325 });
  assert.equal(out, multi.replace("fMass value='1200'", "fMass value='1325'"));
  assert.equal(inspectHandling(out)[1].fields.fMass.value, 1800);
  assert.match(out, /fMass value="999"/);
});
test('Handling presets only edit existing fields and enforce numeric limits', () => {
  const out = handlingPreset(multi, 1, 'drift');
  assert.equal(inspectHandling(out)[1].fields.fSteeringLock.value, 55);
  assert.ok(!out.includes('fTractionCurveMax'));
  assert.throws(() => editHandling(multi, 0, { fMass: 0 }), /Out-of-range/);
  assert.throws(() => editHandling(multi, 0, { fDriveBiasFront: '' }), /Out-of-range/);
  assert.throws(() => editHandling(multi, 0, { foo: 10 }), /not present/);
  assert.equal(inspectHandling(handlingExample()).length, 1);
});
test('Handling pack contains exact edited XML and declares every metadata file', async () => {
  const xml = editHandling(multi, 1, { fMass: 1900 }),
    data = await packHandling([{ xml }], 'jara_cars'),
    zip = await JSZip.loadAsync(data);
  assert.equal(await zip.file('jara_cars/data/handling_1.meta').async('string'), xml);
  assert.match(
    await zip.file('jara_cars/fxmanifest.lua').async('string'),
    /data_file 'HANDLING_FILE' 'data\/handling_1.meta'/,
  );
  assert.equal(Object.keys(zip.files).filter((n) => n.endsWith('.meta')).length, 1);
  await assert.rejects(
    () => packHandling([{ xml: multi }, { xml: multi }]),
    /Duplicate handlingName/,
  );
  await assert.rejects(() => packHandling([{ xml }], '../escape'), /resource name/);
});
test('Bounded XML parser rejects entities, duplicate attributes, malformed nesting and multiple roots', () => {
  for (const bad of [
    '<!DOCTYPE x><x/>',
    '<x a="1" a="2"/>',
    '<x><y></x>',
    '<x/><y/>',
    '<x>&unknown;</x>',
    '<x a="<"/>',
    '<x attr=no/>',
    '<x>broken < text</x>',
  ])
    assert.throws(() => parseXML(bad), undefined, bad);
  assert.equal(parseXML('<x a="a &gt; b"/>').attrs.a, 'a > b');
  assert.equal(parseXML('<x a="a > b"/>').attrs.a, 'a > b');
  assert.equal(decodeXML('A&amp;B&#x1f680;'), 'A&B🚀');
});

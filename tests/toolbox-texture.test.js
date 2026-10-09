import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeDDS,
  decodeDDS,
  buildYtdFromDDS,
  inspectTextureFile,
  createYtd,
  optimizeTexture,
} from '../renderer/lib/texture-codec.js';
import { mipDDS, mipTable, channelPixels } from '../renderer/lib/toolbox-textures.js';
test('Mip inspection decodes the actual level payload, including RGB and alpha channels', () => {
  const pixels = new Uint8Array(16 * 16 * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([20, 150, 240, i % 8 ? 255 : 100], i);
  const parsed = decodeDDS(encodeDDS(pixels, 16, 16, { format: 'RGBA8' })),
    texture = { ...parsed, _encoded: parsed.allLevels },
    table = mipTable(texture);
  assert.deepEqual(
    table.map((m) => [m.width, m.height]),
    [
      [16, 16],
      [8, 8],
      [4, 4],
      [2, 2],
      [1, 1],
    ],
  );
  const mip = decodeDDS(mipDDS(texture, 2));
  assert.equal(mip.width, 4);
  assert.equal(mip.rgba[0], 20);
  assert.equal(mip.rgba[1], 150);
  assert.equal(mip.rgba[2], 240);
  assert.equal(mip.rgba[3], 178);
  assert.deepEqual(
    [...channelPixels(new Uint8Array([20, 150, 240, 100]), 'A')],
    [100, 100, 100, 255],
  );
  assert.throws(() => mipDDS(texture, 99), /unavailable/);
});
test('Selective YTD optimization preserves the exact unselected texture bytes and metadata', async () => {
  const a = new Uint8Array(8 * 8 * 4).fill(220),
    b = new Uint8Array(8 * 8 * 4).fill(130),
    blob = await buildYtdFromDDS([
      { name: 'first', dds: encodeDDS(a, 8, 8, { format: 'BC3' }) },
      { name: 'second', dds: encodeDDS(b, 8, 8, { format: 'BC3' }) },
    ]),
    file = new File([blob], 'source.ytd'),
    entries = await inspectTextureFile(file),
    untouched = entries.find((t) => t.name === 'second'),
    edited = await optimizeTexture(
      entries.find((t) => t.name === 'first'),
      { maxSize: 4, format: 'BC1' },
    ),
    saved = await createYtd(entries.map((item) => (item.name === 'first' ? edited : item))),
    roundtrip = await inspectTextureFile(new File([saved], 'roundtrip.ytd'));
  assert.equal(roundtrip.find((t) => t.name === 'first').width, 4);
  assert.equal(roundtrip.find((t) => t.name === 'first').codec, 'DXT1');
  const preserved = roundtrip.find((t) => t.name === 'second');
  assert.deepEqual(preserved._encoded, untouched._encoded);
  const structureA = preserved._struct.slice(),
    structureB = untouched._struct.slice();
  for (const offset of [0x28, 0x70]) {
    structureA.fill(0, offset, offset + 8);
    structureB.fill(0, offset, offset + 8);
  }
  assert.deepEqual(structureA, structureB);
  assert.equal(preserved.levels, untouched.levels);
});

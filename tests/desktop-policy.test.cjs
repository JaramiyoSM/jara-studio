const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path');
const {
  safeName,
  assetPath,
  trustedFrame,
  allowedExternal,
  checkedBytes,
  kinds,
} = require('../electron/policy.cjs');
test('file broker bounds bytes and prevents unsafe save names', () => {
  assert.equal(safeName('car.glb'), 'car.glb');
  for (const name of ['../secret', 'CON.exe', 'a\0file', 'a/b', '..'])
    assert.equal(safeName(name), 'jara-export.bin');
  assert.throws(() => checkedBytes('text'));
  assert.throws(() => checkedBytes(new Uint8Array(0)));
  assert.throws(() => checkedBytes(new Uint8Array(11), 10));
  assert.equal(checkedBytes(new Uint8Array([1, 2])).length, 2);
});
test('local protocol rejects origin confusion and encoded traversal', () => {
  const root = path.resolve('dist');
  assert.equal(
    assetPath(root, 'jara://studio/assets/logo.svg'),
    path.join(root, 'assets/logo.svg'),
  );
  for (const url of [
    'https://studio/a',
    'jara://evil/a',
    'jara://studio/%2e%2e%2fsecret',
    'jara://studio/%5c..%5csecret',
    'jara://studio/%00secret',
  ])
    assert.throws(() => assetPath(root, url));
  assert.equal(trustedFrame('jara://studio/index.html'), true);
  assert.equal(trustedFrame('jara://studio/index.html.evil'), false);
  assert.equal(trustedFrame('https://studio/index.html'), false);
  assert.equal(trustedFrame('jara://studio@evil/index.html'), false);
});
test('external links allow only documented HTTPS destinations', () => {
  assert.equal(allowedExternal('https://github.com/JaramiyoSM/jara-studio'), true);
  for (const url of [
    'file:///c:/windows/system32/cmd.exe',
    'javascript:alert(1)',
    'https://github.com.evil.test/',
    'https://user:secret@github.com/',
    'http://jaramiyo.com',
  ])
    assert.equal(allowedExternal(url), false);
});
test('community links and map/animation file filters remain usable without widening access', () => {
  assert.equal(allowedExternal('https://discord.gg/TvDYptEDAj'), true);
  assert.equal(allowedExternal('https://discord.gg/unknown-server'), false);
  assert.ok(kinds.native.includes('ymap'));
  assert.ok(kinds.native.includes('ycd'));
});

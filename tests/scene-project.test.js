import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import * as THREE from 'three';
import {
  parseSceneManifest,
  createProjectArchive,
  readProjectArchive,
  inspectEmbeddedScene,
  validateTransform,
  validateOriginalSources,
  MAX_ORIGINAL_BYTES,
} from '../renderer/lib/scene-project.js';
import {
  createPrimitive,
  duplicateObject,
  transformOf,
  applyTransform,
  sceneStats,
  uvPaths,
  scopeAnimationBindings,
  validateSceneAddition,
} from '../renderer/lib/scene-engine.js';

function glb(json = { asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0 }) {
  let text = new TextEncoder().encode(JSON.stringify(json));
  const padded = new Uint8Array(Math.ceil(text.length / 4) * 4);
  padded.fill(32);
  padded.set(text);
  const bytes = new Uint8Array(20 + padded.length),
    view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.length, true);
  view.setUint32(12, padded.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(padded, 20);
  return bytes;
}
const manifest = {
  format: 'jara-studio',
  version: 1,
  name: 'Test scene',
  mode: 'props',
  objects: [
    {
      id: 'box-1',
      name: 'Box',
      visible: false,
      locked: true,
      transform: [1, 2, 3, 0, 0, 0, 1, 1, 1],
      source: 'fixture.obj',
    },
  ],
  camera: { position: [4, 2, 4], target: [0, 0, 0] },
};

test('Jara project archives preserve editable scene, sources and visibility metadata', async () => {
  const bytes = await createProjectArchive({
    manifest,
    scene: glb(),
    sources: [{ name: 'fixture.obj', data: new TextEncoder().encode('v 1 2 3') }],
  });
  const restored = await readProjectArchive(bytes);
  assert.deepEqual(restored.manifest.objects, manifest.objects);
  assert.equal(restored.manifest.mode, 'props');
  assert.equal(new TextDecoder().decode(restored.sources[0].data), 'v 1 2 3');
  assert.equal(restored.sources[0].name, 'fixture.obj');
});
test('Project validation rejects duplicate identities, invalid transforms and external scene URIs', () => {
  assert.throws(
    () => parseSceneManifest({ ...manifest, objects: [manifest.objects[0], manifest.objects[0]] }),
    /identifier/,
  );
  assert.throws(() => validateTransform([0, 0, 0, 0, 0, 0, 1, 0, 1]), /zero/);
  assert.throws(
    () =>
      inspectEmbeddedScene(
        glb({
          asset: { version: '2.0' },
          images: [{ uri: 'https://example.invalid/texture.png' }],
        }),
      ),
    /external/,
  );
  assert.throws(
    () =>
      inspectEmbeddedScene(
        glb({ asset: { version: '2.0' }, buffers: [{ uri: 'file:///private.bin' }] }),
      ),
    /external/,
  );
  assert.doesNotThrow(() =>
    inspectEmbeddedScene(
      glb({ asset: { version: '2.0' }, images: [{ uri: 'data:image/png;base64,AAA=' }] }),
    ),
  );
});
test('Archive preflight rejects traversal and missing manifests before parsing scene', async () => {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(manifest));
  zip.file('scene.glb', glb());
  zip.file('/invalid-path.txt', 'x');
  await assert.rejects(
    readProjectArchive(await zip.generateAsync({ type: 'uint8array' })),
    /Invalid project archive/,
  );
  const incomplete = new JSZip();
  incomplete.file('scene.glb', glb());
  await assert.rejects(
    readProjectArchive(await incomplete.generateAsync({ type: 'uint8array' })),
    /Incomplete|Invalid/,
  );
});
test('Object duplication isolates mesh geometry and materials while retaining transforms', () => {
  const object = createPrimitive('box');
  applyTransform(object, [2, 3, 4, 0, 0.5, 0, 2, 2, 2]);
  const copy = duplicateObject(object);
  assert.notEqual(copy.userData.jaraId, object.userData.jaraId);
  assert.notEqual(copy.children[0].geometry, object.children[0].geometry);
  assert.notEqual(copy.children[0].material, object.children[0].material);
  assert.equal(copy.position.x, 2.3);
  assert.deepEqual(transformOf(copy).slice(1), transformOf(object).slice(1));
  const group = new THREE.Group();
  group.add(object, copy);
  assert.deepEqual(sceneStats(group), {
    objects: 2,
    meshes: 2,
    triangles: 24,
    bones: 0,
    materials: 2,
  });
});
test('UV guides use the active texture coordinate channel', () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  g.setAttribute('uv1', new THREE.Float32BufferAttribute([0.5, 0.5, 0.75, 0.5, 0.5, 0.75], 2));
  assert.deepEqual(uvPaths(g, 100)[0], [
    [0, 100],
    [100, 100],
    [0, 0],
  ]);
  assert.deepEqual(uvPaths(g, 100, 1)[0], [
    [50, 50],
    [75, 50],
    [50, 25],
  ]);
});
test('Animated object duplication retargets tracks to distinct internal nodes', () => {
  const model = new THREE.Group();
  model.name = 'Body';
  const bone = new THREE.Bone();
  bone.name = 'Hand';
  model.add(bone);
  model.animations = [
    new THREE.AnimationClip('Wave', 1, [
      new THREE.VectorKeyframeTrack('Hand.position', [0, 1], [0, 0, 0, 1, 0, 0]),
    ]),
  ];
  scopeAnimationBindings(model, 'first-scope');
  const firstTarget = model.animations[0].tracks[0].name;
  const copy = duplicateObject(model);
  assert.notEqual(copy.animations[0].tracks[0].name, firstTarget);
  assert.equal(model.animations[0].tracks[0].name, firstTarget);
  assert.equal(copy.children[0].userData.displayName, 'Hand');
});
test('Scene budget rejects excessive object and aggregate geometry counts', () => {
  const content = new THREE.Group();
  for (let i = 0; i < 500; i++) content.add(new THREE.Group());
  assert.throws(() => validateSceneAddition(content, createPrimitive('box')), /500 objects/);
  content.clear();
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  mesh.geometry.setAttribute('position', { count: 10_000_001 });
  content.add(mesh);
  assert.throws(() => validateSceneAddition(content, createPrimitive('box')), /10 million/);
});
test('Archive safety rejects raw traversal and dishonest expanded sizes', async () => {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(manifest));
  zip.file('scene.glb', glb());
  zip.file('../escape.txt', 'bad');
  await assert.rejects(readProjectArchive(await zip.generateAsync({ type: 'uint8array' })), /path/);
  const valid = await createProjectArchive({
    manifest,
    scene: glb(),
    sources: [{ name: 'long.txt', data: new Uint8Array(10000).fill(97) }],
  });
  const corrupted = valid.slice();
  const view = new DataView(corrupted.buffer);
  for (let offset = 0; offset < corrupted.length - 46; offset++)
    if (view.getUint32(offset, true) === 0x02014b50) {
      const n = view.getUint16(offset + 28, true),
        name = new TextDecoder().decode(corrupted.subarray(offset + 46, offset + 46 + n));
      if (name === 'sources/0-long.txt') {
        view.setUint32(offset + 24, 1, true);
        break;
      }
    }
  await assert.rejects(readProjectArchive(corrupted), /decompression budget/);
});
test('Original file budgets use actual byte lengths and reject cumulative size or file counts', () => {
  const large = new Uint8Array(MAX_ORIGINAL_BYTES - 1);
  assert.equal(
    validateOriginalSources(
      [{ name: 'base.glb', data: large, size: 0 }],
      [{ name: 'one.bin', data: new Uint8Array(1), size: 10_000_000 }],
    ).bytes,
    MAX_ORIGINAL_BYTES,
  );
  assert.throws(
    () =>
      validateOriginalSources(
        [{ name: 'base.glb', data: large, size: 0 }],
        [{ name: 'two.bin', data: new Uint8Array(2), size: 0 }],
      ),
    /128 MB/,
  );
  const files = Array.from({ length: 500 }, (_, index) => ({
    name: `${index}.bin`,
    data: new Uint8Array(0),
  }));
  assert.equal(validateOriginalSources(files).files, 500);
  assert.throws(
    () => validateOriginalSources(files, [{ name: 'overflow.bin', data: new Uint8Array(0) }]),
    /500 original files/,
  );
  assert.throws(
    () => validateOriginalSources([{ name: 'invalid.bin', data: { byteLength: 1 } }]),
    /Invalid original file data/,
  );
});

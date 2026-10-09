import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  surfaceUVPaths,
  replaceMeshMaterial,
  boundedSurfaceHistory,
} from '../renderer/lib/surface-design.js';

test('Surface UV guide respects glTF orientation, texture transform and material groups', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(Array(18).fill(0), 3));
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0.25, 0.25, 0.75, 0.25, 0.25, 0.75], 2),
  );
  geometry.addGroup(0, 3, 0);
  geometry.addGroup(3, 3, 1);
  const texture = new THREE.Texture();
  texture.flipY = false;
  const first = new THREE.MeshStandardMaterial({ map: texture }),
    second = new THREE.MeshStandardMaterial({ map: texture });
  const mesh = new THREE.Mesh(geometry, [first, second]);
  assert.deepEqual(surfaceUVPaths(mesh, first, 0, 512), [
    [
      [0, 0],
      [512, 0],
      [0, 512],
    ],
  ]);
  assert.deepEqual(surfaceUVPaths(mesh, second, 1, 512), [
    [
      [128, 128],
      [384, 128],
      [128, 384],
    ],
  ]);
  texture.flipY = true;
  assert.deepEqual(surfaceUVPaths(mesh, first, 0, 512), [
    [
      [0, 512],
      [512, 512],
      [0, 0],
    ],
  ]);
  texture.offset.set(0.25, 0);
  texture.repeat.set(0.5, 0.5);
  assert.deepEqual(surfaceUVPaths(mesh, first, 0, 512), [
    [
      [128, 512],
      [384, 512],
      [128, 256],
    ],
  ]);
});

test('Surface material replacement isolates the selected slot and preserves other mesh slots', () => {
  const first = new THREE.MeshStandardMaterial(),
    second = new THREE.MeshStandardMaterial(),
    next = first.clone();
  const slots = [first, second],
    a = new THREE.Mesh(new THREE.BoxGeometry(), slots),
    b = new THREE.Mesh(a.geometry, slots);
  replaceMeshMaterial(a, 0, next);
  assert.equal(a.material[0], next);
  assert.equal(a.material[1], second);
  assert.equal(b.material[0], first);
  assert.notEqual(a.material, slots);
});

test('Surface history respects its pixel memory budget while sharing unchanged layers', () => {
  const fixed = { width: 512, height: 512 },
    first = { layers: [{ canvas: fixed }] };
  let history = boundedSurfaceHistory([], first, 3 * 512 * 512 * 4);
  history = boundedSurfaceHistory(
    history,
    { layers: [{ canvas: fixed }, { canvas: { width: 512, height: 512 } }] },
    3 * 512 * 512 * 4,
  );
  assert.equal(history.length, 2);
  history = boundedSurfaceHistory(
    history,
    { layers: [{ canvas: { width: 1024, height: 1024 } }] },
    3 * 512 * 512 * 4,
  );
  assert.equal(history.length, 1);
});

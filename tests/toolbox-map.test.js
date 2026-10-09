import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  ROAD_BOUNDS,
  mapWorldPoint,
  mapPostals,
  exportMapJSON,
  importMapJSON,
  packPostals,
} from '../renderer/lib/toolbox-map.js';
const layers = [
  {
    id: 'zone',
    type: 'polygon',
    name: 'Vinewood',
    points: [
      [100, 100],
      [200, 100],
      [150, 200],
    ],
    color: '#eda8bf',
    opacity: 0.3,
  },
  {
    id: 'postal',
    type: 'label',
    name: '3030',
    points: [[500, 500]],
    color: '#ffffff',
    opacity: 1,
    postal: true,
    size: 12,
  },
];
test('Map coordinates use actual world bounds and invert image Y correctly', () => {
  assert.deepEqual(mapWorldPoint([0, 0], ROAD_BOUNDS), { x: -5000, y: 8000 });
  assert.deepEqual(mapWorldPoint([1000, 1000], ROAD_BOUNDS), { x: 7000, y: -4000 });
  assert.deepEqual(mapPostals(layers, ROAD_BOUNDS), [{ code: '3030', x: 1000, y: 2000 }]);
  assert.throws(() => mapPostals(layers, null), /Verified/);
  assert.throws(() => mapWorldPoint([500, 500], {}), /Verified/);
});
test('Map JSON roundtrip preserves normalized editable vertices and rejects unsafe input', () => {
  assert.deepEqual(importMapJSON(exportMapJSON(layers, ROAD_BOUNDS)), layers);
  assert.throws(
    () =>
      importMapJSON(
        JSON.stringify({
          schema: 1,
          coordinateSpace: 'normalized-1000',
          layers: [
            {
              ...layers[0],
              points: [
                [0, 0],
                [-1, 30],
                [40, 50],
              ],
            },
          ],
        }),
      ),
    /Points/,
  );
  assert.throws(
    () => mapPostals([...layers, { ...layers[1], id: 'duplicate' }], ROAD_BOUNDS),
    /unique/,
  );
  assert.throws(
    () => mapPostals([{ ...layers[1], name: "');os.execute('x" }], ROAD_BOUNDS),
    /unique/,
  );
});
test('Map GPS resource contains client waypoint command and actual XY JSON', async () => {
  const zip = await JSZip.loadAsync(await packPostals(layers, ROAD_BOUNDS));
  assert.deepEqual(JSON.parse(await zip.file('jara_postals/postals.json').async('string')), [
    { code: '3030', x: 1000, y: 2000 },
  ]);
  const lua = await zip.file('jara_postals/client.lua').async('string');
  assert.match(lua, /RegisterCommand\('jaragps'/);
  assert.match(lua, /SetNewWaypoint/);
  assert.ok(!lua.includes('server_script'));
  assert.match(
    await zip.file('jara_postals/fxmanifest.lua').async('string'),
    /client_script 'client.lua'/,
  );
});

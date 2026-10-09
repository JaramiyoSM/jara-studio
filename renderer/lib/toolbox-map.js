import JSZip from 'jszip';
export const ROAD_BOUNDS = Object.freeze({ minX: -5000, maxX: 7000, minY: -4000, maxY: 8000 });
export function validateMapZones(zones) {
  if (!Array.isArray(zones) || zones.length > 500) throw Error('Maximum 500 layers.');
  const ids = new Set();
  return zones.map((zone) => {
    if (
      typeof zone?.id !== 'string' ||
      zone.id.length > 100 ||
      ids.has(zone.id) ||
      !['polygon', 'label'].includes(zone.type)
    )
      throw Error('Invalid or duplicate map layer.');
    ids.add(zone.id);
    const points = zone.points;
    if (
      !Array.isArray(points) ||
      points.length < (zone.type === 'polygon' ? 3 : 1) ||
      points.length > 5000 ||
      (zone.type === 'label' && points.length !== 1) ||
      points.some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          p.some((n) => !Number.isFinite(n) || n < 0 || n > 1000),
      )
    )
      throw Error('Points must be inside the normalized 0–1000 map.');
    if (
      !/^#[\da-f]{6}$/i.test(zone.color) ||
      !Number.isFinite(zone.opacity) ||
      zone.opacity < 0 ||
      zone.opacity > 1 ||
      typeof zone.name !== 'string' ||
      zone.name.length > 100 ||
      (zone.type === 'label' &&
        zone.size !== undefined &&
        (!Number.isFinite(zone.size) || zone.size < 3 || zone.size > 60))
    )
      throw Error('Invalid map style.');
    return zone;
  });
}
export function mapWorldPoint(point, bounds) {
  if (
    !bounds ||
    !['minX', 'maxX', 'minY', 'maxY'].every((key) => Number.isFinite(bounds[key])) ||
    bounds.minX >= bounds.maxX ||
    bounds.minY >= bounds.maxY ||
    !Array.isArray(point) ||
    point.length !== 2 ||
    point.some((n) => !Number.isFinite(n) || n < 0 || n > 1000)
  )
    throw Error('Verified world bounds and normalized points are required.');
  return {
    x: Math.round((bounds.minX + (point[0] / 1000) * (bounds.maxX - bounds.minX)) * 100) / 100,
    y: Math.round((bounds.maxY - (point[1] / 1000) * (bounds.maxY - bounds.minY)) * 100) / 100,
  };
}
export function mapPostals(zones, bounds) {
  validateMapZones(zones);
  const names = new Set(),
    labels = zones.filter((zone) => zone.type === 'label' && zone.postal);
  if (labels.length > 300) throw Error('Maximum 300 postals.');
  return labels.map((zone) => {
    const code = zone.name.trim();
    if (!/^[A-Za-z0-9_-]{1,16}$/.test(code) || names.has(code.toLowerCase()))
      throw Error('Postal codes must be unique: 1–16 letters, digits, hyphens or underscores.');
    names.add(code.toLowerCase());
    return { code, ...mapWorldPoint(zone.points[0], bounds) };
  });
}
export function exportMapJSON(zones, bounds) {
  validateMapZones(zones);
  return JSON.stringify(
    {
      schema: 1,
      generator: 'Jara Studio',
      coordinateSpace: 'normalized-1000',
      worldBounds: bounds || null,
      layers: zones.map((zone) => ({
        ...zone,
        worldPoints: bounds ? zone.points.map((point) => mapWorldPoint(point, bounds)) : undefined,
      })),
    },
    null,
    2,
  );
}
export function importMapJSON(text) {
  if (typeof text !== 'string' || text.length > 2 * 1048576) throw Error('Map JSON exceeds 2 MB.');
  const source = JSON.parse(text);
  if (source.schema !== 1 || source.coordinateSpace !== 'normalized-1000')
    throw Error('Unsupported map schema.');
  validateMapZones(source.layers);
  return source.layers.map(({ worldPoints, ...zone }) => zone);
}
export async function packPostals(zones, bounds) {
  const postals = mapPostals(zones, bounds);
  if (!postals.length) throw Error('Add at least one postal label.');
  const zip = new JSZip();
  zip.file(
    'jara_postals/fxmanifest.lua',
    "fx_version 'cerulean'\ngame 'gta5'\nfiles {'postals.json'}\nclient_script 'client.lua'\n",
  );
  zip.file('jara_postals/postals.json', JSON.stringify(postals, null, 2));
  zip.file(
    'jara_postals/client.lua',
    `local postals = json.decode(LoadResourceFile(GetCurrentResourceName(), 'postals.json') or '[]')\nlocal index = {}\nfor _, postal in ipairs(postals) do index[string.lower(tostring(postal.code))] = postal end\nRegisterCommand('jaragps', function(_, args)\n  local postal = index[string.lower(args[1] or '')]\n  if postal then\n    SetNewWaypoint(postal.x + 0.0, postal.y + 0.0)\n    TriggerEvent('chat:addMessage', {args = {'Jara GPS', 'Waypoint: ' .. postal.code}})\n  else\n    TriggerEvent('chat:addMessage', {args = {'Jara GPS', 'Usage: /jaragps CODE'}})\n  end\nend, false)\n`,
  );
  zip.file(
    'jara_postals/README.txt',
    'Jara Studio — postal GPS\n\nPlace jara_postals in your resources and add ensure jara_postals in server.cfg.\nUse /jaragps CODE to set a local waypoint.\nCoordinates are derived from the map world bounds; verify each location in FiveM.\nThis is postal logic only, not a native radar texture replacement.\n',
  );
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

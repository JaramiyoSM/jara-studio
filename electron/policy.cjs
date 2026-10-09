const path = require('node:path');
const MAX_FILE = 128 * 1024 * 1024,
  MAX_TOTAL = 256 * 1024 * 1024,
  MAX_EXPORT = 512 * 1024 * 1024;
const kinds = {
  model: ['glb', 'gltf', 'obj', 'mtl', 'fbx', 'stl', 'png', 'jpg', 'jpeg', 'webp'],
  texture: ['png', 'jpg', 'jpeg', 'webp', 'dds', 'ytd'],
  native: [
    'ydr',
    'ydd',
    'yft',
    'ymt',
    'ytyp',
    'ymap',
    'ycd',
    'ytd',
    'ybn',
    'meta',
    'xml',
    'lua',
    'json',
    'png',
    'dds',
  ],
  any: [
    'glb',
    'gltf',
    'obj',
    'mtl',
    'fbx',
    'stl',
    'png',
    'jpg',
    'jpeg',
    'webp',
    'dds',
    'ytd',
    'ydr',
    'ydd',
    'yft',
    'ymt',
    'ytyp',
    'ymap',
    'ycd',
    'ybn',
    'meta',
    'xml',
    'lua',
    'json',
  ],
};
function safeName(input, fallback = 'jara-export.bin') {
  if (
    typeof input !== 'string' ||
    input.length > 140 ||
    /[\x00-\x1f<>:"/\\|?*]/.test(input) ||
    input === '.' ||
    input === '..' ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(input)
  )
    return fallback;
  return input;
}
function checkedBytes(value, max = MAX_TOTAL) {
  if (!(value instanceof Uint8Array) || !value.length || value.byteLength > max)
    throw Error('Invalid file size or payload.');
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}
function assetPath(root, url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'jara:' || parsed.hostname !== 'studio')
    throw Error('Unknown application origin.');
  const relative = decodeURIComponent(parsed.pathname);
  if (relative.includes('\0') || relative.includes('\\')) throw Error('Invalid path.');
  const resolved = path.resolve(root, '.' + relative),
    allowed = path.resolve(root) + path.sep;
  if (!resolved.startsWith(allowed)) throw Error('Path outside application.');
  return resolved;
}
function trustedFrame(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'jara:' &&
      parsed.hostname === 'studio' &&
      parsed.pathname === '/index.html' &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}
function allowedExternal(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      ([
        'jaramiyo.com',
        'jara-tools.vercel.app',
        'github.com',
        'docs.sollumz.org',
        'docs.fivem.net',
        'www.electronjs.org',
      ].includes(parsed.hostname) ||
        (parsed.hostname === 'discord.gg' && parsed.pathname === '/TvDYptEDAj'))
    );
  } catch {
    return false;
  }
}
module.exports = {
  MAX_FILE,
  MAX_TOTAL,
  MAX_EXPORT,
  kinds,
  safeName,
  checkedBytes,
  assetPath,
  trustedFrame,
  allowedExternal,
};

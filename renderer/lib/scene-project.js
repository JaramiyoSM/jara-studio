import JSZip from 'jszip';
import { Unzip, UnzipInflate } from 'fflate';

export const PROJECT_VERSION = 1;
export const MAX_PROJECT_BYTES = 256 * 1024 * 1024;
export const MAX_IMPORT_BYTES = 96 * 1024 * 1024;
export const MAX_ORIGINAL_BYTES = 128 * 1024 * 1024;
export const MAX_ORIGINAL_FILES = 500;
export const MODEL_EXTENSIONS = ['glb', 'gltf', 'obj', 'fbx', 'stl'];

export function extension(name) {
  return String(name).split('.').pop().toLowerCase();
}
export function safeName(name) {
  return String(name || 'Untitled')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .slice(0, 120);
}
export function validateOriginalSources(existing, incoming = []) {
  if (!Array.isArray(existing) || !Array.isArray(incoming))
    throw new Error('Invalid original files');
  if (existing.length + incoming.length > MAX_ORIGINAL_FILES)
    throw new Error('A project supports up to 500 original files.');
  let total = 0;
  for (const file of [...existing, ...incoming]) {
    if (!(file?.data instanceof Uint8Array)) throw new Error('Invalid original file data');
    total += file.data.byteLength;
    if (total > MAX_ORIGINAL_BYTES)
      throw new Error('Original files exceed 128 MB. Save this project and start a new scene.');
  }
  return { files: existing.length + incoming.length, bytes: total };
}
export function validateTransform(values) {
  if (
    !Array.isArray(values) ||
    values.length !== 9 ||
    values.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e7)
  )
    throw new Error('Invalid object transform');
  if (values.slice(6).some((v) => Math.abs(v) < 0.000001)) throw new Error('Scale cannot be zero');
  return values;
}
export function inspectEmbeddedScene(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 20 || bytes.length > MAX_PROJECT_BYTES)
    throw new Error('Invalid GLB scene');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  )
    throw new Error('Invalid GLB header');
  let offset = 12,
    json = null;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error('Invalid GLB chunk');
    const length = view.getUint32(offset, true),
      type = view.getUint32(offset + 4, true);
    offset += 8;
    if (length % 4 !== 0 || offset + length > bytes.length) throw new Error('Invalid GLB chunk');
    if (type === 0x4e4f534a) {
      if (json || length > 24 * 1024 * 1024) throw new Error('Invalid GLB manifest');
      json = JSON.parse(new TextDecoder().decode(bytes.subarray(offset, offset + length)).trim());
    }
    offset += length;
  }
  if (!json || json.asset?.version !== '2.0') throw new Error('Invalid GLB manifest');
  for (const entry of [...(json.images || []), ...(json.buffers || [])])
    if (entry.uri && !entry.uri.startsWith('data:'))
      throw new Error(
        'Projects must embed all images and buffers; external file URLs are not allowed',
      );
  return json;
}
export function parseSceneManifest(value) {
  if (
    !value ||
    value.format !== 'jara-studio' ||
    value.version !== PROJECT_VERSION ||
    !Array.isArray(value.objects) ||
    value.objects.length > 500
  )
    throw new Error('Unsupported Jara Studio project');
  const ids = new Set();
  const objects = value.objects.map((o) => {
    if (!o || typeof o.id !== 'string' || o.id.length > 100 || ids.has(o.id))
      throw new Error('Invalid object identifier');
    ids.add(o.id);
    return {
      id: o.id,
      name: safeName(o.name),
      visible: o.visible !== false,
      locked: o.locked === true,
      transform: validateTransform(o.transform),
      source: typeof o.source === 'string' ? safeName(o.source) : null,
    };
  });
  return {
    format: 'jara-studio',
    version: 1,
    name: safeName(value.name),
    objects,
    mode: ['scene', 'props', 'peds', 'vehicles', 'weapons', 'clothing'].includes(value.mode)
      ? value.mode
      : 'scene',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt.slice(0, 40) : '',
    camera:
      value.camera &&
      Array.isArray(value.camera.position) &&
      value.camera.position.length === 3 &&
      value.camera.position.every(Number.isFinite)
        ? {
            position: value.camera.position,
            target:
              Array.isArray(value.camera.target) &&
              value.camera.target.length === 3 &&
              value.camera.target.every(Number.isFinite)
                ? value.camera.target
                : [0, 0, 0],
          }
        : null,
  };
}
export async function createProjectArchive({ manifest, scene, sources = [] }) {
  validateOriginalSources(sources);
  const checked = parseSceneManifest(manifest);
  if (
    !(scene instanceof Uint8Array) ||
    scene.byteLength > MAX_PROJECT_BYTES ||
    scene.byteLength < 20
  )
    throw new Error('Invalid scene data');
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(checked, null, 2));
  zip.file('scene.glb', scene);
  let total = scene.byteLength;
  sources.forEach((source, index) => {
    if (!(source.data instanceof Uint8Array)) throw new Error('Invalid source data');
    total += source.data.byteLength;
    if (total > MAX_PROJECT_BYTES) throw new Error('Project exceeds 256 MB');
    zip.file(`sources/${index}-${safeName(source.name)}`, source.data);
  });
  zip.file(
    'README.txt',
    'Jara Studio project\nOpen this .jara file from File > Open project. scene.glb contains geometry, materials and embedded textures. Source files are retained for reference. This project is a portable editing format, not a compiled GTA resource.\n',
  );
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 3 },
  });
}
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let c = value;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function checkedPath(name) {
  return (
    name.length > 0 &&
    name.length <= 256 &&
    !name.startsWith('/') &&
    !name.includes('\\') &&
    !name.split('/').some((part) => part === '..' || part === '.') &&
    !/^[a-z]:/i.test(name) &&
    !/[\x00-\x1f]/.test(name)
  );
}
export function inspectProjectZIP(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 22 || bytes.length > MAX_PROJECT_BYTES)
    throw new Error('Invalid project archive');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  if (end < 0 || view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0)
    throw new Error('Invalid project archive');
  const count = view.getUint16(end + 10, true),
    directorySize = view.getUint32(end + 12, true),
    start = view.getUint32(end + 16, true);
  if (
    count < 2 ||
    count > 600 ||
    count !== view.getUint16(end + 8, true) ||
    start + directorySize !== end
  )
    throw new Error('Invalid project archive');
  const entries = new Map();
  let offset = start,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('Invalid ZIP directory');
    const flags = view.getUint16(offset + 8, true),
      compression = view.getUint16(offset + 10, true),
      crc = view.getUint32(offset + 16, true),
      compressed = view.getUint32(offset + 20, true),
      size = view.getUint32(offset + 24, true),
      nameLength = view.getUint16(offset + 28, true),
      extraLength = view.getUint16(offset + 30, true),
      commentLength = view.getUint16(offset + 32, true),
      localOffset = view.getUint32(offset + 42, true);
    if (
      flags & 1 ||
      ![0, 8].includes(compression) ||
      size === 0xffffffff ||
      compressed === 0xffffffff ||
      offset + 46 + nameLength + extraLength + commentLength > end
    )
      throw new Error('Unsupported ZIP entry');
    const rawName = bytes.subarray(offset + 46, offset + 46 + nameLength);
    if (!(flags & 0x800) && rawName.some((v) => v >= 128))
      throw new Error('Unsupported ZIP filename encoding');
    const name = new TextDecoder('utf-8', { fatal: true }).decode(rawName);
    if (!checkedPath(name) || entries.has(name))
      throw new Error('Invalid project archive path or duplicate entry');
    if (
      localOffset + 30 > start ||
      view.getUint32(localOffset, true) !== 0x04034b50 ||
      view.getUint16(localOffset + 8, true) !== compression
    )
      throw new Error('Invalid ZIP local header');
    const localNameLength = view.getUint16(localOffset + 26, true),
      localExtraLength = view.getUint16(localOffset + 28, true),
      localName = new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength),
      );
    if (
      localName !== name ||
      localOffset + 30 + localNameLength + localExtraLength + compressed > start
    )
      throw new Error('Inconsistent ZIP entry');
    total += size;
    if (
      total > MAX_PROJECT_BYTES ||
      size > MAX_PROJECT_BYTES ||
      size > Math.max(1, compressed) * 1024 + 1024
    )
      throw new Error('Project exceeds its decompression budget');
    entries.set(name, { size, crc, compressed });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end) throw new Error('Invalid ZIP directory');
  return entries;
}
function extractBounded(bytes, entries) {
  const result = new Map(),
    running = [],
    seen = new Set();
  let total = 0;
  const stream = new Unzip((file) => {
    if (!entries.has(file.name) || seen.has(file.name) || !checkedPath(file.name))
      throw new Error('Invalid project archive');
    seen.add(file.name);
    running.push(file);
    let size = 0,
      crc = 0xffffffff;
    const chunks = [];
    file.ondata = (error, data, final) => {
      if (error) throw error;
      size += data.length;
      total += data.length;
      if (total > MAX_PROJECT_BYTES || size > entries.get(file.name).size)
        throw new Error('Project exceeds its decompression budget');
      if (file.name === 'project.json' && size > 1024 * 1024)
        throw new Error('Project manifest exceeds 1 MB');
      for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
      if (data.length) chunks.push(data);
      if (final) {
        const expected = entries.get(file.name);
        if (size !== expected.size || (crc ^ 0xffffffff) >>> 0 !== expected.crc)
          throw new Error('Corrupt project archive');
        if (!file.name.endsWith('/')) {
          const joined = new Uint8Array(size);
          let position = 0;
          for (const chunk of chunks) {
            joined.set(chunk, position);
            position += chunk.length;
          }
          result.set(file.name, joined);
        }
      }
    };
    file.start();
  });
  stream.register(UnzipInflate);
  try {
    for (let offset = 0; offset < bytes.length; offset += 16384)
      stream.push(
        bytes.subarray(offset, Math.min(bytes.length, offset + 16384)),
        offset + 16384 >= bytes.length,
      );
  } catch (error) {
    running.forEach((file) => file.terminate());
    throw error;
  }
  if (
    seen.size !== entries.size ||
    result.size !== [...entries.keys()].filter((name) => !name.endsWith('/')).length
  )
    throw new Error('Incomplete project archive');
  return result;
}
export async function readProjectArchive(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_PROJECT_BYTES)
    throw new Error('Project exceeds 256 MB');
  const entries = inspectProjectZIP(bytes);
  if (!entries.has('project.json') || !entries.has('scene.glb'))
    throw new Error('Incomplete project archive');
  const files = extractBounded(bytes, entries);
  const manifest = parseSceneManifest(
    JSON.parse(new TextDecoder().decode(files.get('project.json'))),
  );
  const scene = files.get('scene.glb');
  inspectEmbeddedScene(scene);
  const sources = [];
  for (const [name, data] of files)
    if (name.startsWith('sources/'))
      sources.push({ name: name.replace(/^sources\/\d+-/, ''), data });
  validateOriginalSources(sources);
  return { manifest, scene, sources };
}

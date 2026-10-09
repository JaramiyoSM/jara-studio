import JSZip from 'jszip';
import { parseXML, child, nodeText } from './toolbox-xml.js';
const NATIVE = new Set(['ydr', 'ytd', 'yft', 'ydd', 'ytyp', 'ymap', 'ybn', 'ycd', 'ymt']);
const META = {
  'handling.meta': ['HANDLING_FILE', 'CHandlingDataMgr'],
  'vehicles.meta': ['VEHICLE_METADATA_FILE', 'CVehicleModelInfo__InitDataList'],
  'carcols.meta': ['CARCOLS_FILE', 'CVehicleModelInfoVarGlobal'],
  'carvariations.meta': ['VEHICLE_VARIATION_FILE', 'CVehicleModelInfoVariation'],
  'vehiclelayouts.meta': ['VEHICLE_LAYOUTS_FILE', 'CVehicleMetadataMgr'],
  'weapons.meta': ['WEAPONINFO_FILE_PATCH', 'CWeaponInfoBlob'],
  'weaponarchetypes.meta': ['WEAPON_METADATA_FILE', 'CWeaponModelInfo__InitDataList'],
  'peds.meta': ['PED_METADATA_FILE', 'CPedModelInfo__InitDataList'],
};
export const RESOURCE_EXTENSIONS = Object.freeze([...NATIVE, 'meta']);
function fileBytes(file) {
  const value = file.data;
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw Error('Missing file bytes.');
}
export function validateResourceFiles(files) {
  if (!Array.isArray(files) || !files.length || files.length > 512)
    throw Error('Choose 1–512 native resource files.');
  const names = new Set(),
    report = [],
    warnings = [];
  let total = 0;
  for (const file of files) {
    const name = String(file.name || '');
    if (
      !/^[\w .()^\-]{1,180}$/.test(name) ||
      name.startsWith('.') ||
      /[ .]$/.test(name) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
    )
      throw Error(`Unsafe file name: ${name}.`);
    const key = name.toLowerCase();
    if (names.has(key)) throw Error(`Duplicate file name: ${name}.`);
    names.add(key);
    const ext = key.split('.').at(-1),
      bytes = fileBytes(file);
    total += bytes.byteLength;
    if (!bytes.byteLength || bytes.byteLength > 128 * 1024 * 1024 || total > 512 * 1024 * 1024)
      throw Error('Resource limit: 128 MB/file and 512 MB/package.');
    if (NATIVE.has(ext)) {
      const magic = new TextDecoder().decode(bytes.subarray(0, 4));
      if (magic === 'FXAP') throw Error(`${name}: escrow-encrypted files cannot be verified.`);
      if (magic !== 'RSC7' || bytes.byteLength < 17)
        throw Error(`${name}: a complete Legacy RSC7 header is required.`);
      const version = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
        4,
        true,
      );
      if (ext === 'ytd' && version !== 13)
        throw Error(`${name}: only YTD RSC7 version 13 is supported.`);
      report.push({
        name,
        extension: ext,
        bytes: bytes.byteLength,
        path: `stream/${name}`,
        version,
        type: ext === 'ytyp' ? 'DLC_ITYP_REQUEST' : null,
        validation: 'RSC7 header',
      });
    } else if (ext === 'meta') {
      const spec = META[key];
      if (!spec)
        throw Error(`${name}: unsupported metadata name. Use a recognized GTA .meta name.`);
      let xml;
      try {
        xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        throw Error(`${name}: XML must be UTF-8.`);
      }
      const tree = parseXML(xml.replace(/^\uFEFF/, ''));
      if (tree.name !== spec[1]) throw Error(`${name}: expected ${spec[1]} root.`);
      report.push({
        name,
        extension: ext,
        bytes: bytes.byteLength,
        path: `data/${name}`,
        type: spec[0],
        validation: 'XML root and syntax',
      });
      if (key === 'vehicles.meta') {
        const infos = child(tree, 'InitDatas');
        for (const item of infos?.children || []) {
          const model = nodeText(child(item, 'modelName'), xml),
            txd = nodeText(child(item, 'txdName'), xml);
          if (model) warnings.push({ kind: 'model', value: model, for: name });
          if (txd) warnings.push({ kind: 'texture', value: txd, for: name });
        }
      }
    } else
      throw Error(
        `${name}: only native GTA resources and supported .meta files can be packaged. Import GLB in the scene editor and compile externally first.`,
      );
  }
  const nativeNames = new Set(
    report
      .filter((item) => item.path.startsWith('stream/'))
      .map((item) => item.name.toLowerCase().replace(/\.[^.]+$/, '')),
  );
  const unresolved = warnings
    .filter((item) => !nativeNames.has(item.value.toLowerCase()))
    .map(
      (item) =>
        `${item.for}: ${item.kind} “${item.value}” is not in this package. It may be a base-game dependency.`,
    );
  if (!report.some((item) => NATIVE.has(item.extension)))
    unresolved.push(
      'No native model or texture files included. Metadata will need existing game models.',
    );
  return {
    files: report,
    totalBytes: total,
    warnings: [...new Set(unresolved)],
    note: 'Header and metadata checks do not validate meshes, bone rigs or FiveM runtime compatibility.',
  };
}
export function resourceManifest(report) {
  const metadata = report.files.filter((item) => item.path.startsWith('data/')),
    itypes = report.files.filter((item) => item.type === 'DLC_ITYP_REQUEST');
  return `fx_version 'cerulean'\ngame 'gta5'\n${report.files.some((item) => ['ymap', 'ytyp'].includes(item.extension)) ? "this_is_a_map 'yes'\n" : ''}\n${metadata.length ? `files {\n${metadata.map((item) => `  '${item.path}',`).join('\n')}\n}\n` : ''}${[...metadata, ...itypes].map((item) => `data_file '${item.type}' '${item.path}'`).join('\n')}\n`;
}
export async function packResource(files, name) {
  const id = String(name || 'jara_resource').toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(id))
    throw Error('Resource name: 3–64 lowercase letters, digits or underscores.');
  const report = validateResourceFiles(files),
    zip = new JSZip();
  for (let i = 0; i < files.length; i++)
    zip.file(`${id}/${report.files[i].path}`, fileBytes(files[i]));
  zip.file(`${id}/fxmanifest.lua`, resourceManifest(report));
  zip.file(
    `${id}/validation.json`,
    JSON.stringify({ ...report, generator: 'Jara Studio', schema: 1 }, null, 2),
  );
  zip.file(
    `${id}/README.txt`,
    `Jara Studio — native resource package\n\nCopy ${id} to your server resources and add ensure ${id} in server.cfg.\n\n${report.note}\n\n${report.warnings.join('\n')}\n\nNo files were compiled or modified. Confirm you hold redistribution rights for each included file and test your resource in FiveM.\n`,
  );
  return {
    bytes: await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }),
    report,
  };
}

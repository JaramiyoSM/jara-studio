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
  'gtxd.meta': ['GTXD_PARENTING_DATA', 'CMapParentTxds'],
};
const TITLES = {
  generic: ['Paquete libre', 'General package'],
  vehicle: ['Vehículo add-on', 'Add-on vehicle'],
  livery: ['Livery / textura de vehículo', 'Vehicle livery / texture'],
  clothing: ['Ropa · colección add-on', 'Clothing · add-on collection'],
  'clothing-replace': ['Ropa · reemplazo', 'Clothing · replacement'],
  prop: ['Prop / objeto add-on', 'Add-on prop / object'],
  ped: ['Ped add-on', 'Add-on ped'],
  weapon: ['Arma add-on', 'Add-on weapon'],
  map: ['Mapa / colocación', 'Map / placement'],
};
export const RESOURCE_PROFILES = Object.freeze(
  Object.entries(TITLES).map(([id, [es, en]]) => Object.freeze({ id, es, en })),
);
export const RESOURCE_EXTENSIONS = Object.freeze([...NATIVE, 'meta']);
const decoder = new TextDecoder('utf-8', { fatal: true });
const RESOURCE_NAME = /^[a-z][a-z0-9_]{2,63}$/;
const MODEL_NAME = /^[a-z0-9][a-z0-9_]{0,79}$/i;

function fileBytes(file) {
  const value = file.data;
  if (value instanceof Uint8Array) return value;
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw Error('Missing file bytes.');
}
function xmlSource(bytes, name) {
  try {
    return decoder.decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    throw Error(`${name}: XML must be UTF-8.`);
  }
}
function descendants(node, name) {
  const result = [];
  const visit = (current) => {
    if (current.name === name) result.push(current);
    for (const item of current.children) visit(item);
  };
  visit(node);
  return result;
}
function optionValues(options = {}) {
  const profile = options.profile || 'generic';
  if (!Object.hasOwn(TITLES, profile)) throw Error('Unknown resource workflow.');
  const target = String(options.target || '').trim();
  if (target && !MODEL_NAME.test(target))
    throw Error('Target name: use letters, digits or underscores, without an extension.');
  const dependencies = [...new Set(options.dependencies || [])];
  if (dependencies.length > 32 || dependencies.some((name) => !RESOURCE_NAME.test(name)))
    throw Error('Dependencies: 3–64 lowercase letters, digits or underscores; maximum 32.');
  const gameBuild =
    options.gameBuild === '' || options.gameBuild == null ? null : Number(options.gameBuild);
  if (gameBuild !== null && (!Number.isInteger(gameBuild) || gameBuild < 1604 || gameBuild > 99999))
    throw Error('Game build must be a whole number between 1604 and 99999.');
  return { profile, target, dependencies, gameBuild };
}
const issue = (code, es, en, severity = 'review', file = null) => ({
  code,
  severity,
  es,
  en,
  file,
});
const check = (id, es, en, present, required = true) => ({ id, es, en, present, required });

function workflowChecks(files, options, issues) {
  const has = (ext) => files.some((file) => file.extension === ext);
  const hasName = (name) => files.some((file) => file.name.toLowerCase() === name);
  const checks = [];
  const need = (id, es, en, present, required = true) => {
    checks.push(check(id, es, en, present, required));
    if (!present)
      issues.push(
        issue(
          `missing-${id}`,
          `${required ? 'Falta' : 'Revisar'}: ${es}.`,
          `${required ? 'Missing' : 'Review'}: ${en}.`,
          required ? 'missing' : 'review',
        ),
      );
  };
  switch (options.profile) {
    case 'vehicle':
      need('vehicle-model', 'Modelo de vehículo YFT', 'Vehicle YFT model', has('yft'));
      need(
        'vehicle-meta',
        'vehicles.meta del vehículo',
        'Vehicle vehicles.meta',
        hasName('vehicles.meta'),
      );
      need(
        'vehicle-textures',
        'Diccionario YTD propio o heredado',
        'Own or inherited YTD dictionary',
        has('ytd'),
        false,
      );
      need(
        'vehicle-handling',
        'handling.meta propio o handling base revisado',
        'Own handling.meta or reviewed base handling',
        hasName('handling.meta'),
        false,
      );
      need(
        'vehicle-hi',
        'YFT de alta resolución cuando lo use el modelo',
        'High-resolution YFT when used by the model',
        files.some((file) => /_hi\.yft$/i.test(file.name)),
        false,
      );
      break;
    case 'livery':
      need(
        'livery-dictionary',
        'YTD del vehículo que recibe la livery',
        'YTD of the vehicle receiving the livery',
        has('ytd'),
      );
      need(
        'livery-target',
        'Nombre exacto del diccionario de destino',
        'Exact target dictionary name',
        Boolean(options.target),
      );
      if (
        options.target &&
        has('ytd') &&
        !files.some((file) => file.name.toLowerCase() === `${options.target.toLowerCase()}.ytd`)
      )
        issues.push(
          issue(
            'livery-name',
            `El recurso no contiene ${options.target}.ytd. Conserva el nombre del diccionario que usa el material del vehículo.`,
            `The resource does not contain ${options.target}.ytd. Preserve the dictionary name used by the vehicle material.`,
            'missing',
          ),
        );
      break;
    case 'clothing':
      need('clothing-model', 'Drawables de ropa YDD', 'Clothing YDD drawables', has('ydd'));
      need(
        'clothing-textures',
        'Texturas YTD de la colección',
        'Collection YTD textures',
        has('ytd'),
      );
      need(
        'clothing-variation',
        'YMT de variaciones de la colección',
        'Collection variation YMT',
        has('ymt'),
      );
      need(
        'clothing-shop',
        'Metadatos ShopPedApparel de la colección',
        'Collection ShopPedApparel metadata',
        files.some((file) => file.type === 'SHOP_PED_APPAREL_META_FILE'),
      );
      if (files.some((file) => ['ydd', 'ytd'].includes(file.extension) && !file.name.includes('^')))
        issues.push(
          issue(
            'clothing-prefix',
            'Algunos YDD/YTD no tienen prefijo de colección con ^. Comprueba los nombres exportados y evita renombrar binarios a ciegas.',
            'Some YDD/YTD files have no collection prefix with ^. Check exported names and avoid blindly renaming binaries.',
          ),
        );
      break;
    case 'clothing-replace':
      need(
        'clothing-model',
        'YDD de la pieza que se reemplaza',
        'YDD of the replaced component',
        has('ydd'),
      );
      need(
        'clothing-textures',
        'YTD de esa pieza o textura',
        'YTD of that component or texture',
        has('ytd'),
      );
      break;
    case 'prop':
      need('prop-model', 'Drawable YDR del objeto', 'Object YDR drawable', has('ydr'));
      need(
        'prop-archetype',
        'YTYP que registra el archetype',
        'YTYP registering the archetype',
        has('ytyp'),
      );
      need(
        'prop-collision',
        'Colisión YBN si el objeto requiere colisión separada',
        'YBN when the object needs separate collision',
        has('ybn'),
        false,
      );
      break;
    case 'ped':
      need('ped-drawables', 'Drawables YDD del ped', 'Ped YDD drawables', has('ydd'));
      need(
        'ped-fragment',
        'Fragmento/esqueleto YFT del ped',
        'Ped YFT fragment/skeleton',
        has('yft'),
      );
      need('ped-variation', 'YMT de variaciones', 'Variation YMT', has('ymt'));
      need('ped-meta', 'peds.meta compatible', 'Compatible peds.meta', hasName('peds.meta'));
      need(
        'ped-textures',
        'Diccionario YTD del ped o base revisada',
        'Ped YTD dictionary or reviewed base',
        has('ytd'),
        false,
      );
      break;
    case 'weapon':
      need('weapon-model', 'Drawable YDR del arma', 'Weapon YDR drawable', has('ydr'));
      need(
        'weapon-info',
        'weapons.meta compatible',
        'Compatible weapons.meta',
        hasName('weapons.meta'),
      );
      need(
        'weapon-archetype',
        'weaponarchetypes.meta compatible',
        'Compatible weaponarchetypes.meta',
        hasName('weaponarchetypes.meta'),
      );
      need(
        'weapon-textures',
        'YTD del arma o diccionario heredado',
        'Weapon YTD or inherited dictionary',
        has('ytd'),
        false,
      );
      break;
    case 'map':
      need('map-placement', 'YMAP con colocaciones', 'YMAP placements', has('ymap'));
      need(
        'map-archetype',
        'YTYP si el mapa usa archetypes propios',
        'YTYP when using custom archetypes',
        has('ytyp'),
        false,
      );
      break;
    default:
      need(
        'native-files',
        'Al menos un archivo nativo',
        'At least one native file',
        files.some((file) => NATIVE.has(file.extension)),
        false,
      );
  }
  return checks;
}

export function validateResourceFiles(files, rawOptions = {}) {
  if (!Array.isArray(files) || !files.length || files.length > 512)
    throw Error('Choose 1–512 native resource files.');
  const options = optionValues(rawOptions);
  const names = new Set(),
    report = [],
    references = [],
    issues = [],
    handlingNames = new Set(),
    xmlFiles = [];
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
      const isRaw =
        ['ymap', 'ytyp'].includes(ext) &&
        /^\s*(?:\uFEFF)?</.test(new TextDecoder().decode(bytes.subarray(0, 128)));
      let version = null,
        validation = 'RSC7 header';
      if (isRaw) {
        const xml = xmlSource(bytes, name),
          tree = parseXML(xml),
          expected = ext === 'ymap' ? 'CMapData' : 'CMapTypes';
        if (tree.name !== expected) throw Error(`${name}: expected ${expected} root for raw XML.`);
        xmlFiles.push({ name, key, tree, xml, ext });
        validation = 'Raw XML root and syntax';
      } else {
        if (magic !== 'RSC7' || bytes.byteLength < 17)
          throw Error(`${name}: a complete Legacy RSC7 header is required.`);
        version = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true);
        if (ext === 'ytd' && version !== 13)
          throw Error(`${name}: only YTD RSC7 version 13 is supported.`);
      }
      report.push({
        name,
        extension: ext,
        bytes: bytes.byteLength,
        path: `stream/${name}`,
        version,
        type: ext === 'ytyp' ? 'DLC_ITYP_REQUEST' : null,
        validation,
      });
    } else if (ext === 'meta') {
      const xml = xmlSource(bytes, name),
        tree = parseXML(xml);
      const spec =
        META[key] ||
        (tree.name === 'ShopPedApparel' ? ['SHOP_PED_APPAREL_META_FILE', 'ShopPedApparel'] : null);
      if (!spec)
        throw Error(
          `${name}: unsupported metadata name or root. Use a recognized GTA .meta name or ShopPedApparel XML.`,
        );
      if (tree.name !== spec[1]) throw Error(`${name}: expected ${spec[1]} root.`);
      report.push({
        name,
        extension: ext,
        bytes: bytes.byteLength,
        path: `data/${name}`,
        type: spec[0],
        validation: 'XML root and syntax',
      });
      xmlFiles.push({ name, key, tree, xml, ext });
      if (key === 'handling.meta') {
        for (const node of descendants(tree, 'handlingName')) {
          const value = nodeText(node, xml).toLowerCase();
          if (handlingNames.has(value))
            issues.push(
              issue(
                'duplicate-handling',
                `handlingName duplicado: ${value}.`,
                `Duplicate handlingName: ${value}.`,
                'missing',
                name,
              ),
            );
          handlingNames.add(value);
        }
      }
    } else
      throw Error(
        `${name}: only native GTA resources and supported .meta files can be packaged. Import GLB in the scene editor and compile externally first.`,
      );
  }
  const nativeNames = new Map();
  for (const item of report.filter((file) => file.path.startsWith('stream/'))) {
    const base = item.name.toLowerCase().replace(/\.[^.]+$/, '');
    const found = nativeNames.get(base) || new Set();
    found.add(item.extension);
    nativeNames.set(base, found);
  }
  const addReference = (kind, value, name, extensions) => {
    if (!value || value.toLowerCase() === 'null') return;
    if (references.length >= 4096)
      throw Error('Too many metadata references: maximum 4096 per resource.');
    const key = value.toLowerCase();
    const present =
      kind === 'handling'
        ? handlingNames.has(key)
        : extensions.some((ext) => nativeNames.get(key)?.has(ext));
    const ref = { kind, value, file: name, present, extensions };
    references.push(ref);
    if (!present)
      issues.push(
        issue(
          `external-${kind}`,
          `${name}: ${kind} «${value}» no está en este paquete. Puede depender del juego base u otro recurso.`,
          `${name}: ${kind} “${value}” is not in this package. It may be a base-game or another-resource dependency.`,
          'review',
          name,
        ),
      );
  };
  for (const { name, key, tree, xml, ext } of xmlFiles) {
    if (['vehicles.meta', 'weaponarchetypes.meta'].includes(key)) {
      for (const item of child(tree, 'InitDatas')?.children || []) {
        addReference(
          'model',
          nodeText(child(item, 'modelName'), xml),
          name,
          key === 'vehicles.meta' ? ['yft'] : ['ydr'],
        );
        addReference('texture', nodeText(child(item, 'txdName'), xml), name, ['ytd']);
        if (key === 'vehicles.meta')
          addReference('handling', nodeText(child(item, 'handlingId'), xml), name, []);
      }
    }
    if (key === 'carvariations.meta') {
      for (const node of descendants(tree, 'modelName'))
        addReference('model', nodeText(node, xml), name, ['yft']);
    }
    if (key === 'weapons.meta') {
      for (const node of descendants(tree, 'Model'))
        addReference('model', nodeText(node, xml), name, ['ydr']);
    }
    if (ext === 'ytyp') {
      for (const item of child(tree, 'archetypes')?.children || []) {
        const type = nodeText(child(item, 'assetType'), xml);
        const extensions =
          type === 'ASSET_TYPE_DRAWABLEDICTIONARY'
            ? ['ydd']
            : type === 'ASSET_TYPE_FRAGMENT'
              ? ['yft']
              : ['ydr'];
        addReference('model', nodeText(child(item, 'assetName'), xml), name, extensions);
        addReference('texture', nodeText(child(item, 'textureDictionary'), xml), name, ['ytd']);
      }
    }
    if (tree.name === 'ShopPedApparel') {
      const full = nodeText(child(tree, 'fullDlcName'), xml);
      const ped = nodeText(child(tree, 'pedName'), xml);
      if (
        full &&
        !report.some(
          (file) =>
            file.extension === 'ymt' && file.name.toLowerCase() === `${full.toLowerCase()}.ymt`,
        )
      )
        issues.push(
          issue(
            'clothing-ymt-name',
            `${name}: no se encuentra ${full}.ymt. Revisa la colección exportada.`,
            `${name}: ${full}.ymt was not found. Review the exported collection.`,
            'review',
            name,
          ),
        );
      if (
        full &&
        report.some(
          (file) =>
            ['ydd', 'ytd'].includes(file.extension) &&
            file.name.includes('^') &&
            !file.name.toLowerCase().startsWith(`${full.toLowerCase()}^`),
        )
      )
        issues.push(
          issue(
            'clothing-collection-name',
            `${name}: algunos prefijos con ^ no coinciden con ${full}. Conserva los identificadores de la colección.`,
            `${name}: some ^ prefixes do not match ${full}. Preserve collection identifiers.`,
            'review',
            name,
          ),
        );
      if (ped && !['mp_m_freemode_01', 'mp_f_freemode_01'].includes(ped.toLowerCase()))
        issues.push(
          issue(
            'clothing-ped',
            `${name}: ped ${ped}; comprueba su rig, componentes y soporte de colección.`,
            `${name}: ped ${ped}; review its rig, components and collection support.`,
            'review',
            name,
          ),
        );
    }
  }
  const checks = workflowChecks(report, options, issues);
  if (!report.some((item) => NATIVE.has(item.extension)))
    issues.push(
      issue(
        'metadata-only',
        'No hay modelos ni texturas nativas. Los metadatos necesitan modelos del juego u otro recurso.',
        'No native model or texture files included. Metadata will need existing game models.',
      ),
    );
  if (total > 64 * 1024 * 1024)
    issues.push(
      issue(
        'download-budget',
        'El paquete supera 64 MB sin comprimir. Revisa tamaño de texturas y LODs para reducir la descarga.',
        'The package exceeds 64 MB uncompressed. Review texture sizes and LODs to reduce downloads.',
      ),
    );
  const unique = [
    ...new Map(issues.map((item) => [`${item.code}:${item.file}:${item.en}`, item])).values(),
  ];
  return {
    files: report,
    totalBytes: total,
    warnings: unique.map((item) => item.en),
    issues: unique,
    references,
    checks,
    options,
    readiness: unique.some((item) => item.severity === 'missing')
      ? 'needs-files'
      : unique.length
        ? 'review'
        : 'ready-to-test',
    note: 'Header and metadata checks do not validate meshes, bone rigs or FiveM runtime compatibility.',
  };
}

export function resourceManifest(report) {
  const metadata = report.files.filter((item) => item.path.startsWith('data/'));
  const itypes = report.files.filter((item) => item.type === 'DLC_ITYP_REQUEST');
  const declared = [...metadata, ...itypes];
  const dependencies = [...(report.options?.dependencies || [])];
  if (report.options?.gameBuild) dependencies.push(`/gameBuild:${report.options.gameBuild}`);
  return `fx_version 'cerulean'\ngame 'gta5'\n\n${report.files.some((item) => ['ymap', 'ytyp'].includes(item.extension)) ? "this_is_a_map 'yes'\n\n" : ''}${declared.length ? `files {\n${declared.map((item) => `  '${item.path}',`).join('\n')}\n}\n\n` : ''}${declared.map((item) => `data_file '${item.type}' '${item.path}'`).join('\n')}\n${dependencies.length ? `\ndependencies {\n${dependencies.map((name) => `  '${name}',`).join('\n')}\n}\n` : ''}`;
}

export async function inspectResourceDictionaries(files, inspect) {
  validateResourceFiles(files);
  const dictionaries = files.filter((file) => /\.ytd$/i.test(file.name));
  if (
    dictionaries.length > 64 ||
    dictionaries.reduce((n, file) => n + fileBytes(file).byteLength, 0) > 256 * 1024 * 1024
  )
    throw Error(
      'Dictionary inspection limit: 64 YTD files / 256 MB. Inspect smaller batches in Texture Lab.',
    );
  const result = [];
  let textures = 0;
  for (const file of dictionaries) {
    try {
      const parsed = await inspect(new File([fileBytes(file)], file.name));
      if (!parsed?.textures || !Array.isArray(parsed.textures))
        throw Error('Invalid dictionary inspection result.');
      textures += parsed.textures.length;
      if (textures > 8192) throw Error('Maximum 8192 dictionary textures per inspection.');
      const seen = new Set(),
        warnings = [];
      for (const texture of parsed.textures) {
        const key = String(texture.name).toLowerCase();
        if (seen.has(key)) warnings.push(`Duplicate texture name: ${texture.name}.`);
        seen.add(key);
        if (texture.width > 2048 || texture.height > 2048)
          warnings.push(
            `${texture.name}: ${texture.width}×${texture.height}; review the texture memory budget.`,
          );
        if (texture.levels === 1 && Math.max(texture.width, texture.height) > 4)
          warnings.push(`${texture.name}: no mip chain; review distant rendering and aliasing.`);
      }
      result.push({
        name: file.name,
        bytes: fileBytes(file).byteLength,
        resourceMemory: parsed.resourceMemory,
        textures: parsed.textures,
        warnings,
        error: null,
      });
    } catch (error) {
      result.push({
        name: file.name,
        bytes: fileBytes(file).byteLength,
        textures: [],
        warnings: [],
        error: error.message,
      });
    }
  }
  return result;
}

export function resourceWorkflowSteps(profile = 'generic', locale = 'es') {
  if (!Object.hasOwn(TITLES, profile)) throw Error('Unknown resource workflow.');
  const common = [
    [
      'Conserva los originales. Exporta modelos y metadatos nativos mediante un flujo GTA compatible antes de empaquetar.',
      'Keep originals. Export native models and metadata with a compatible GTA workflow before packaging.',
    ],
    [
      'Añade los archivos de la misma colección o vehículo. Elige una receta y revisa archivos faltantes y referencias externas.',
      'Add files from the same collection or vehicle. Choose a workflow and review missing files and external references.',
    ],
    [
      'Comprueba los diccionarios YTD y exporta el informe. Ninguna comprobación cambia nombres ni bytes originales.',
      'Check YTD dictionaries and export the report. Checks never change original names or bytes.',
    ],
    [
      'Copia la carpeta del ZIP a resources, añade ensure al server.cfg y comprueba el recurso dentro de FiveM.',
      'Copy the ZIP folder into resources, add ensure to server.cfg, and test the resource inside FiveM.',
    ],
  ];
  const specific = {
    generic: [
      [
        'El manifest registra solo los metadatos presentes. Los binarios de stream se conservan sin reinterpretarlos.',
        'The manifest registers only metadata present. Stream binaries are preserved without reinterpreting them.',
      ],
    ],
    vehicle: [
      [
        'modelName debe apuntar al YFT; txdName al YTD y handlingId a una entrada existente. Una dependencia base puede ser válida: confírmala en el juego.',
        'modelName must reference the YFT, txdName the YTD, and handlingId an existing entry. A base-game dependency can be valid: confirm it in-game.',
      ],
      [
        'Revisa LODs, pivote, ruedas, puertas, asientos, luces y colisiones. El YFT _hi y los kits solo se incluyen si el modelo los usa.',
        'Review LODs, pivot, wheels, doors, seats, lights and collisions. Include _hi YFT and kits only if the model uses them.',
      ],
    ],
    livery: [
      [
        'Pinta sobre la UV real del vehículo. Conserva el nombre de la textura que muestrea su material; una livery suele usar un nombre sign, pero depende del modelo.',
        'Paint over the real vehicle UV. Preserve the texture name sampled by its material; liveries often use a sign name, but this depends on the model.',
      ],
      [
        'En Texture Lab conserva todas las demás entradas del YTD y sus mipmaps. Escribe aquí el nombre exacto del diccionario de destino sin extensión.',
        'In Texture Lab preserve every other YTD entry and its mipmaps. Enter the exact target dictionary name here without an extension.',
      ],
      [
        'Añade como dependencia el recurso de vehículo si es externo. Este paquete reemplaza un diccionario: no activa por sí solo slots o flags de liveries.',
        'Add the vehicle resource as a dependency when external. This package replaces a dictionary; it does not activate livery slots or flags on its own.',
      ],
    ],
    clothing: [
      [
        'Mantén juntos YMT, ShopPedApparel y los nombres collection^component. El prefijo antes de ^ debe corresponder al fullDlcName exportado.',
        'Keep YMT, ShopPedApparel and collection^component names together. The prefix before ^ should match the exported fullDlcName.',
      ],
      [
        'En freemode: jbib es componente 11 (tops), lowr es 4 (pantalones), feet es 6 (calzado) y uppr es 3 (torso). Comprueba drawable/texture y el menú de ropa de tu framework.',
        'For freemode: jbib is component 11 (tops), lowr is 4 (trousers), feet is 6 (footwear), and uppr is 3 (torso). Check drawable/texture indices and your framework clothing menu.',
      ],
      [
        'La receta no inventa un YMT ni pesos de huesos. Comprueba clipping, rig y soporte de colecciones en la build y servidor usados.',
        'This workflow does not invent YMT files or bone weights. Check clipping, rig and collection support in your selected game build and server.',
      ],
    ],
    'clothing-replace': [
      [
        'Conserva el nombre exacto de la pieza original y los nombres de las texturas internas. Reemplazar no crea componentes o índices nuevos.',
        'Preserve the exact original component name and internal texture names. Replacement does not create new components or indices.',
      ],
      [
        'Comprueba que la UV, el rig y el ped destino coinciden. Respalda los recursos y evita dos reemplazos del mismo archivo.',
        'Check UV, rig and target ped compatibility. Back up resources and avoid two replacements of the same file.',
      ],
    ],
    prop: [
      [
        'El assetName del archetype YTYP apunta al YDR. Para mapas propios coloca ese archetype en un YMAP; para scripts úsalo por su nombre.',
        'The YTYP archetype assetName references the YDR. Place that archetype in a YMAP for custom maps, or reference its name from scripts.',
      ],
      [
        'Exporta bounds, colisión y LODs en el compilador. YBN separado depende de tu objeto: no todos los props lo necesitan.',
        'Export bounds, collision and LODs in your compiler. A separate YBN depends on the object; not every prop needs one.',
      ],
    ],
    ped: [
      [
        'Exporta un rig GTA válido con sus drawables, fragmento y variaciones. Un esqueleto MakeHuman o una animación GLB solo permite preparación visual.',
        'Export a valid GTA rig with its drawables, fragment and variations. A MakeHuman skeleton or GLB animation is only for visual preparation.',
      ],
      [
        'Conserva componentes y nombres; comprueba peds.meta, movimiento, animaciones, cabeza, manos, ragdoll y texturas dentro de FiveM.',
        'Preserve components and names; check peds.meta, movement, animations, head, hands, ragdoll and textures inside FiveM.',
      ],
    ],
    weapon: [
      [
        'El Model de weapons.meta y modelName de weaponarchetypes.meta deben apuntar al YDR correcto. El identificador WEAPON_ debe ser único en tu servidor.',
        'Model in weapons.meta and modelName in weaponarchetypes.meta must reference the correct YDR. The WEAPON_ identifier must be unique on your server.',
      ],
      [
        'Usa metadatos y un rig de arma compatibles como base. Verifica posición en la mano, muzzle, cargador, componentes, animaciones y clips antes de publicar.',
        'Use compatible metadata and weapon rigs as a base. Verify hand placement, muzzle, magazine, components, animations and clips before publishing.',
      ],
      [
        'El paquete prepara streaming y metadatos; no asigna inventario, iconos, tiendas o permisos de tu framework.',
        'The package prepares streaming and metadata; it does not assign framework inventory, icons, shops or permissions.',
      ],
    ],
    map: [
      [
        'Puedes incluir YMAP/YTYP nativos o XML raw con raíz CMapData/CMapTypes y el mismo nombre de extensión. Se conservan sin conversión.',
        'Include native YMAP/YTYP or raw XML with a CMapData/CMapTypes root and the same file extension. They are preserved without conversion.',
      ],
      [
        'Comprueba cada archetype externo, bounds y colisiones. Un PNG de Map Studio es una imagen; no se interpreta como un YMAP ni reemplaza el radar.',
        'Check every external archetype, bound and collision. A Map Studio PNG is an image; it is not interpreted as a YMAP and does not replace the radar.',
      ],
    ],
  };
  return [...specific[profile], ...common].map((pair) => pair[locale === 'en' ? 1 : 0]);
}

export function resourceReportText(report, name = 'jara_resource', locale = 'es') {
  const en = locale === 'en';
  const title = TITLES[report.options.profile][en ? 1 : 0];
  return `Jara Studio — ${title}\n\n${en ? 'Resource' : 'Recurso'}: ${name}\n${en ? 'Files' : 'Archivos'}: ${report.files.length}\n${en ? 'Uncompressed bytes' : 'Bytes sin comprimir'}: ${report.totalBytes}\n${en ? 'Readiness' : 'Estado'}: ${report.readiness}\n\n${report.files.map((file) => `${file.path} (${file.bytes} B) — ${file.validation}`).join('\n')}\n\n${en ? 'Review' : 'Revisiones'}\n${report.issues.length ? report.issues.map((item) => `• ${item[en ? 'en' : 'es']}`).join('\n') : en ? 'No missing workflow files or unresolved references detected.' : 'No se detectaron archivos de receta faltantes ni referencias sin resolver.'}\n\n${resourceWorkflowSteps(
    report.options.profile,
    locale,
  )
    .map((step, i) => `${i + 1}. ${step}`)
    .join(
      '\n\n',
    )}\n\n${en ? `Install: copy ${name} to server resources and add ensure ${name} in server.cfg.` : `Instalación: copia ${name} a resources del servidor y añade ensure ${name} en server.cfg.`}\n\n${en ? 'No source files were compiled, renamed or modified. Header, XML and dictionary checks do not prove mesh, rig or FiveM runtime compatibility. Confirm redistribution rights and test in FiveM.' : 'Los archivos originales no se compilaron, renombraron ni modificaron. Comprobar cabeceras, XML y diccionarios no demuestra compatibilidad de mallas, rigs ni funcionamiento en FiveM. Confirma derechos de redistribución y prueba en FiveM.'}\n`;
}

export async function packResource(files, name, rawOptions = {}) {
  const id = String(name || 'jara_resource').toLowerCase();
  if (!RESOURCE_NAME.test(id))
    throw Error('Resource name: 3–64 lowercase letters, digits or underscores.');
  const report = validateResourceFiles(files, rawOptions);
  if (report.options.dependencies.includes(id)) throw Error('A resource cannot depend on itself.');
  if (report.readiness === 'needs-files')
    throw Error(
      'The selected workflow is missing required files. Review the checklist before packaging.',
    );
  if (rawOptions.dictionaryInspection) {
    const dictionaries = rawOptions.dictionaryInspection;
    const expected = report.files.filter((file) => file.extension === 'ytd');
    if (
      !Array.isArray(dictionaries) ||
      expected.length !== dictionaries.length ||
      expected.some(
        (file) =>
          !dictionaries.some((item) => item.name === file.name && item.bytes === file.bytes),
      )
    )
      throw Error('Dictionary inspection is outdated. Inspect the current files again.');
    if (dictionaries.some((item) => item.error))
      throw Error(
        'A YTD dictionary failed inspection. Fix it in Texture Lab or import a valid original.',
      );
    report.dictionaries = dictionaries;
  }
  const zip = new JSZip();
  for (let i = 0; i < files.length; i++)
    zip.file(`${id}/${report.files[i].path}`, fileBytes(files[i]));
  zip.file(`${id}/fxmanifest.lua`, resourceManifest(report));
  zip.file(
    `${id}/validation.json`,
    JSON.stringify(
      { ...report, generator: 'Jara Studio', schema: 2, runtimeTested: false },
      null,
      2,
    ),
  );
  zip.file(`${id}/README.txt`, resourceReportText(report, id, rawOptions.locale || 'es'));
  return {
    bytes: await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }),
    report,
  };
}

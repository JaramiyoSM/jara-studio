import { parseXML, child, nodeText, replaceXML } from './toolbox-xml.js';
import JSZip from 'jszip';
export const HANDLING_FIELDS = [
  ['fMass', 'Mass / Masa', 'kg', 100, 100000],
  ['fInitialDragCoeff', 'Drag / Resistencia', '', 0, 100],
  ['fDriveBiasFront', 'Front drive bias / Tracción delantera', '0–1', 0, 1],
  ['nInitialDriveGears', 'Gears / Marchas', '', 1, 10],
  ['fInitialDriveForce', 'Drive force / Fuerza de motor', '', 0, 5],
  ['fDriveInertia', 'Drive inertia / Inercia de motor', '', 0.01, 10],
  ['fInitialDriveMaxFlatVel', 'Flat velocity / Velocidad nominal', '', 1, 1000],
  ['fBrakeForce', 'Brake force / Frenada', '', 0, 10],
  ['fBrakeBiasFront', 'Front brake bias / Frenada delantera', '0–1', 0, 1],
  ['fHandBrakeForce', 'Handbrake / Freno de mano', '', 0, 10],
  ['fSteeringLock', 'Steering lock / Giro', '°', 1, 100],
  ['fTractionCurveMax', 'Peak traction / Agarre máximo', '', 0, 10],
  ['fTractionCurveMin', 'Minimum traction / Agarre mínimo', '', 0, 10],
  ['fTractionCurveLateral', 'Lateral traction / Tracción lateral', '°', 1, 90],
  ['fTractionLossMult', 'Traction loss / Pérdida de agarre', '', 0, 10],
  ['fLowSpeedTractionLossMult', 'Low speed slip / Deslizamiento lento', '', 0, 10],
  ['fSuspensionForce', 'Spring force / Suspensión', '', 0, 20],
  ['fSuspensionCompDamp', 'Compression / Compresión', '', 0, 20],
  ['fSuspensionReboundDamp', 'Rebound / Rebote', '', 0, 20],
  ['fAntiRollBarForce', 'Anti-roll / Barra estabilizadora', '', 0, 20],
  ['fCollisionDamageMult', 'Collision damage / Daño de choque', '', 0, 10],
  ['fEngineDamageMult', 'Engine damage / Daño de motor', '', 0, 20],
  ['fPetrolTankVolume', 'Fuel tank / Depósito', 'L', 1, 1000],
  ['fOilVolume', 'Oil / Aceite', 'L', 0.1, 100],
];
const specs = new Map(HANDLING_FIELDS.map((item) => [item[0], item]));
export function inspectHandling(xml) {
  const root = parseXML(xml);
  if (root.name !== 'CHandlingDataMgr') throw Error('Expected CHandlingDataMgr root.');
  const list = child(root, 'HandlingData');
  if (!list) throw Error('HandlingData is missing.');
  const cars = list.children
    .filter((n) => n.name === 'Item' && n.attrs.type === 'CHandlingData')
    .map((node, index) => {
      const name = nodeText(child(node, 'handlingName'), xml);
      if (!name || name.length > 80) throw Error('A vehicle has no valid handlingName.');
      const fields = {};
      for (const [key] of HANDLING_FIELDS) {
        const field = child(node, key);
        if (field?.attrs.value !== undefined) {
          const val = Number(field.attrs.value);
          if (!Number.isFinite(val)) throw Error(`Invalid numeric field ${key}.`);
          fields[key] = { value: val, ...field.attrSpans.value };
        }
      }
      return { index, name, fields };
    });
  if (!cars.length) throw Error('No CHandlingData vehicles found.');
  if (cars.length > 2048) throw Error('Maximum 2048 vehicles per file.');
  return cars;
}
export function editHandling(xml, index, changes) {
  const car = inspectHandling(xml)[index];
  if (!car) throw Error('Unknown vehicle.');
  const edits = [];
  for (const [key, input] of Object.entries(changes)) {
    const spec = specs.get(key),
      field = car.fields[key],
      value = Number(input);
    if (!spec || !field) throw Error(`Field ${key} is not present in this base.`);
    if (
      String(input).trim() === '' ||
      !Number.isFinite(value) ||
      value < spec[3] ||
      value > spec[4] ||
      (key === 'nInitialDriveGears' && !Number.isInteger(value))
    )
      throw Error(`Out-of-range value for ${key}.`);
    edits.push({ ...field, value: String(value) });
  }
  return replaceXML(xml, edits);
}
export const HANDLING_PRESETS = {
  street: { fDriveBiasFront: 0.5, fBrakeBiasFront: 0.6, fSteeringLock: 35 },
  sport: {
    fDriveBiasFront: 0,
    fInitialDriveForce: 0.34,
    fDriveInertia: 1.15,
    fBrakeForce: 0.95,
    fSteeringLock: 38,
    fTractionCurveMax: 2.5,
    fTractionCurveMin: 2.2,
  },
  drift: {
    fDriveBiasFront: 0,
    fInitialDriveForce: 0.4,
    fSteeringLock: 55,
    fTractionCurveMax: 1.4,
    fTractionCurveMin: 1.15,
    fTractionLossMult: 1.4,
    fLowSpeedTractionLossMult: 0.2,
  },
  offroad: {
    fDriveBiasFront: 0.5,
    fInitialDriveForce: 0.29,
    fSteeringLock: 36,
    fTractionCurveMax: 2.2,
    fTractionCurveMin: 1.9,
    fTractionLossMult: 0.8,
    fSuspensionForce: 1.5,
    fSuspensionCompDamp: 0.9,
    fSuspensionReboundDamp: 1.3,
  },
};
export function handlingPreset(xml, index, preset) {
  if (!HANDLING_PRESETS[preset]) throw Error('Unknown preset.');
  const car = inspectHandling(xml)[index],
    changes = Object.fromEntries(
      Object.entries(HANDLING_PRESETS[preset]).filter(([key]) => car?.fields[key]),
    );
  return editHandling(xml, index, changes);
}
export function handlingExample() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<CHandlingDataMgr>\n  <HandlingData>\n    <Item type="CHandlingData">\n      <handlingName>JARA_PRACTICE</handlingName>\n${HANDLING_FIELDS.map(([key, , , ,]) => `      <${key} value="${{ fMass: 1500, fInitialDragCoeff: 8, fDriveBiasFront: 0.5, nInitialDriveGears: 6, fInitialDriveForce: 0.3, fDriveInertia: 1, fInitialDriveMaxFlatVel: 160, fBrakeForce: 0.8, fBrakeBiasFront: 0.6, fHandBrakeForce: 0.6, fSteeringLock: 35, fTractionCurveMax: 2.3, fTractionCurveMin: 2, fTractionCurveLateral: 22.5, fTractionLossMult: 1, fLowSpeedTractionLossMult: 1, fSuspensionForce: 2, fSuspensionCompDamp: 1.2, fSuspensionReboundDamp: 1.7, fAntiRollBarForce: 0.6, fCollisionDamageMult: 1, fEngineDamageMult: 1, fPetrolTankVolume: 65, fOilVolume: 5 }[key]}" />`).join('\n')}\n      <SubHandlingData><Item type="NULL"/><Item type="NULL"/><Item type="NULL"/></SubHandlingData>\n    </Item>\n  </HandlingData>\n</CHandlingDataMgr>\n`;
}
export async function packHandling(files, resource = 'jara_handling') {
  const name = String(resource).toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(name))
    throw Error('Use a resource name with 3–64 lowercase letters, numbers or underscores.');
  if (!files.length || files.length > 64) throw Error('Select 1–64 handling files.');
  const zip = new JSZip(),
    paths = [],
    names = new Set();
  for (let i = 0; i < files.length; i++) {
    const cars = inspectHandling(files[i].xml);
    for (const car of cars) {
      const id = car.name.toLowerCase();
      if (names.has(id)) throw Error(`Duplicate handlingName: ${car.name}.`);
      names.add(id);
    }
    const path = `data/handling_${i + 1}.meta`;
    paths.push(path);
    zip.file(`${name}/${path}`, files[i].xml);
  }
  zip.file(
    `${name}/fxmanifest.lua`,
    `fx_version 'cerulean'\ngame 'gta5'\n\nfiles {\n${paths.map((p) => `  '${p}',`).join('\n')}\n}\n${paths.map((p) => `data_file 'HANDLING_FILE' '${p}'`).join('\n')}\n`,
  );
  zip.file(
    `${name}/README.txt`,
    `Jara Studio — handling resource\n\nPlace ${name} in your server resources and add ensure ${name} to server.cfg.\nMatch handlingName in vehicles.meta. This package contains handling values only; no vehicle models are generated.\nPreset values are starting points. Test braking, grip and acceleration in your own FiveM server.\n`,
  );
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

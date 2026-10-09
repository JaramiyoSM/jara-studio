import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { extension, MAX_IMPORT_BYTES, safeName } from './scene-project.js';

export const newId = () => crypto.randomUUID();
export const MAX_SCENE_VERTICES = 10_000_000;
export function vertexCount(object) {
  let count = 0;
  object.traverse((n) => {
    if (n.isMesh) count += n.geometry.getAttribute('position')?.count || 0;
  });
  return count;
}
export function validateSceneAddition(content, object) {
  validateSceneBatch(content, [object]);
}
export function validateSceneBatch(content, objects) {
  if (content.children.length + objects.length > 500)
    throw new Error('The workspace supports up to 500 objects.');
  if (
    vertexCount(content) + objects.reduce((sum, object) => sum + vertexCount(object), 0) >
    MAX_SCENE_VERTICES
  )
    throw new Error('The workspace supports up to 10 million vertices.');
}
export function transformOf(object) {
  return [
    ...object.position.toArray(),
    ...object.rotation.toArray().slice(0, 3),
    ...object.scale.toArray(),
  ].map((v) => (Object.is(v, -0) ? 0 : v));
}
export function applyTransform(object, values) {
  object.position.fromArray(values);
  object.rotation.set(...values.slice(3, 6));
  object.scale.fromArray(values.slice(6));
  object.updateMatrixWorld(true);
}
export function scopeAnimationBindings(object, scope) {
  if (!object.animations?.length) return;
  const targets = new Map();
  let index = 0;
  object.traverse((node) => {
    const old = node.name;
    const label = node.userData.displayName || old || `Node_${index}`;
    node.userData.displayName = label;
    node.name = `${THREE.PropertyBinding.sanitizeNodeName(label)}_${scope.slice(0, 8)}_${index++}`;
    if (old) targets.set(old, node.name);
    targets.set(node.uuid, node.name);
  });
  for (const clip of object.animations)
    for (const track of clip.tracks) {
      const binding = THREE.PropertyBinding.parseTrackName(track.name);
      if (binding.nodeName && targets.has(binding.nodeName))
        track.name = track.name.replace(binding.nodeName, targets.get(binding.nodeName));
      else if (!binding.nodeName && track.name.startsWith('.'))
        track.name = object.name + track.name;
      if (binding.objectName === 'bones' && targets.has(binding.objectIndex))
        track.name = track.name.replace(
          `[${binding.objectIndex}]`,
          `[${targets.get(binding.objectIndex)}]`,
        );
    }
}
export function wrapObject(object, name, source = null) {
  const group = new THREE.Group();
  group.name = safeName(name);
  group.userData = { jaraId: newId(), source, locked: false };
  scopeAnimationBindings(object, group.userData.jaraId);
  group.add(object);
  group.animations = object.animations || [];
  return group;
}
export function duplicateObject(object) {
  const copy = clone(object);
  copy.name = `${object.name} copy`;
  copy.userData = { ...object.userData, jaraId: newId() };
  copy.position.x += 0.3;
  copy.traverse((node) => {
    if (node.isMesh) {
      node.geometry = node.geometry.clone();
      node.material = Array.isArray(node.material)
        ? node.material.map((m) => m.clone())
        : node.material.clone();
    }
  });
  copy.animations = object.animations.map((c) => c.clone());
  const outerName = copy.name;
  scopeAnimationBindings(copy, copy.userData.jaraId);
  copy.name = outerName;
  return copy;
}
export function createPrimitive(kind) {
  const geometries = {
    box: () => new THREE.BoxGeometry(1, 1, 1),
    sphere: () => new THREE.SphereGeometry(0.5, 32, 24),
    cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
    plane: () => new THREE.PlaneGeometry(2, 2),
  };
  if (!geometries[kind]) throw new Error('Unknown primitive');
  const mesh = new THREE.Mesh(
    geometries[kind](),
    new THREE.MeshStandardMaterial({
      color: '#c69bab',
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide,
    }),
  );
  mesh.name = kind;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (kind === 'plane') mesh.rotation.x = -Math.PI / 2;
  const result = wrapObject(mesh, kind);
  result.position.y = kind === 'plane' ? 0 : 0.5;
  return result;
}
export async function loadModel(file, files = [file]) {
  if (file.size > MAX_IMPORT_BYTES || file.data.byteLength > MAX_IMPORT_BYTES)
    throw new Error('Each model must be smaller than 96 MB');
  const manager = new THREE.LoadingManager();
  const urls = [];
  const sourceMap = new Map();
  let pending = false,
    dependencyError = null,
    complete;
  const loaded = new Promise((resolve) => (complete = resolve));
  manager.onStart = () => (pending = true);
  manager.onLoad = () => complete();
  manager.onError = (url) =>
    (dependencyError = new Error(
      `Could not decode local dependency: ${url.startsWith('blob:') ? 'image' : url}`,
    ));
  for (const f of files) {
    if (f.data.byteLength > MAX_IMPORT_BYTES) throw new Error('A dependency exceeds 96 MB');
    const url = URL.createObjectURL(new Blob([f.data]));
    urls.push(url);
    sourceMap.set(f.name.toLowerCase(), url);
  }
  manager.setURLModifier((url) => {
    const basename = decodeURIComponent(url.split(/[\\/]/).pop()).toLowerCase();
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const found = sourceMap.get(basename);
    if (!found) throw new Error(`Missing local dependency: ${basename}`);
    return found;
  });
  const data = file.data.buffer.slice(
    file.data.byteOffset,
    file.data.byteOffset + file.data.byteLength,
  );
  try {
    let model;
    switch (extension(file.name)) {
      case 'glb':
      case 'gltf': {
        const gltf = await new GLTFLoader(manager).parseAsync(
          extension(file.name) === 'gltf' ? new TextDecoder().decode(data) : data,
          '',
        );
        model = gltf.scene;
        model.animations = gltf.animations;
        break;
      }
      case 'obj': {
        const loader = new OBJLoader(manager);
        const mtl = files.find((f) => extension(f.name) === 'mtl');
        if (mtl) {
          const materials = new MTLLoader(manager).parse(new TextDecoder().decode(mtl.data), '');
          materials.preload();
          loader.setMaterials(materials);
        }
        model = loader.parse(new TextDecoder().decode(data));
        break;
      }
      case 'fbx':
        model = new FBXLoader(manager).parse(data, '');
        break;
      case 'stl':
        model = new THREE.Mesh(
          new STLLoader().parse(data),
          new THREE.MeshStandardMaterial({ color: '#d4b4bf', roughness: 0.7 }),
        );
        break;
      default:
        throw new Error('Supported models: GLB, glTF, OBJ, FBX, STL');
    }
    if (pending) {
      let timer;
      try {
        await Promise.race([
          loaded,
          new Promise(
            (_, reject) =>
              (timer = setTimeout(
                () => reject(new Error('Local texture loading timed out')),
                15000,
              )),
          ),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
    if (dependencyError) throw dependencyError;
    let vertices = 0,
      meshes = 0;
    model.traverse((n) => {
      if (n.isMesh) {
        meshes++;
        vertices += n.geometry.getAttribute('position')?.count || 0;
        n.castShadow = true;
        n.receiveShadow = true;
        if (!n.name) n.name = `Mesh ${meshes}`;
        if (n.material) {
          for (const material of [].concat(n.material)) {
            if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
          }
        }
      }
    });
    if (!meshes) throw new Error('This file does not contain a mesh');
    if (vertices > 5_000_000) throw new Error('Model exceeds the 5 million vertex workspace limit');
    return wrapObject(model, file.name.replace(/\.[^.]+$/, ''), file.name);
  } finally {
    setTimeout(() => urls.forEach((url) => URL.revokeObjectURL(url)), 4000);
  }
}
export function sceneStats(group) {
  const stats = {
    objects: group.children.length,
    meshes: 0,
    triangles: 0,
    bones: 0,
    materials: new Set(),
  };
  group.traverse((n) => {
    if (n.isBone) stats.bones++;
    if (n.isMesh) {
      stats.meshes++;
      stats.triangles += Math.floor(
        (n.geometry.index?.count || n.geometry.getAttribute('position')?.count || 0) / 3,
      );
      [].concat(n.material).forEach((m) => stats.materials.add(m.uuid));
    }
  });
  return { ...stats, materials: stats.materials.size };
}
export async function exportGLB(group) {
  const snapshot = clone(group);
  snapshot.updateMatrixWorld(true);
  const animations = group.children.flatMap((o) => o.animations || []);
  const buffer = await new GLTFExporter().parseAsync(snapshot, {
    binary: true,
    onlyVisible: false,
    trs: true,
    animations,
  });
  return new Uint8Array(buffer);
}
export function exportOBJ(group) {
  return new OBJExporter().parse(group);
}
export async function parseProjectScene(bytes) {
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const root = gltf.scene.children.find((n) => n.name === 'JaraScene') || gltf.scene;
  return { objects: [...root.children], animations: gltf.animations };
}
export function disposeObject(object) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  object.traverse((n) => {
    if (n.geometry) geometries.add(n.geometry);
    if (n.material)
      [].concat(n.material).forEach((m) => {
        materials.add(m);
        for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      });
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
export function meshDetails(object) {
  const meshes = [];
  object?.traverse((n) => {
    if (n.isMesh) meshes.push(n);
  });
  return meshes;
}
export function uvPaths(geometry, size = 320, channel = 0) {
  const uv = geometry?.getAttribute(channel ? `uv${channel}` : 'uv');
  if (!uv) return [];
  const index = geometry.index;
  const count = index?.count || uv.count;
  const paths = [];
  for (let i = 0; i < Math.min(count, 90000); i += 3) {
    let path = [];
    for (let k = 0; k < 3; k++) {
      const id = index ? index.getX(i + k) : i + k;
      path.push([uv.getX(id) * size, (1 - uv.getY(id)) * size]);
    }
    paths.push(path);
  }
  return paths;
}

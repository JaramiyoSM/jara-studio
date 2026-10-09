import * as THREE from 'three';

export const SURFACE_SIZES = [512, 1024, 2048];
export const MAX_SURFACE_LAYERS = 16;
export const MAX_SURFACE_HISTORY_BYTES = 96 * 1024 * 1024;

export function surfaceCanvas(size = 1024) {
  if (!SURFACE_SIZES.includes(size)) throw new Error('Supported texture sizes: 512, 1024, 2048');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return canvas;
}

export function copySurfaceCanvas(canvas) {
  const copy = surfaceCanvas(canvas.width);
  copy.getContext('2d').drawImage(canvas, 0, 0);
  return copy;
}

export function newSurfaceLayer(type, size, options = {}) {
  return {
    id: crypto.randomUUID(),
    type,
    name: type,
    visible: true,
    opacity: 1,
    x: size / 2,
    y: size / 2,
    width: size / 3,
    height: type === 'text' ? size / 16 : size / 3,
    rotation: 0,
    color: '#f5c0d5',
    text: 'JARAMIYO',
    ...(type === 'paint' ? { canvas: surfaceCanvas(size) } : {}),
    ...options,
  };
}

export function renderSurface(canvas, base, layers) {
  const ctx = canvas.getContext('2d'),
    size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(base, 0, 0, size, size);
  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    if (layer.type === 'paint') ctx.drawImage(layer.canvas, 0, 0, size, size);
    else if (layer.type === 'fill') {
      ctx.fillStyle = layer.color;
      ctx.fillRect(0, 0, size, size);
    } else {
      ctx.translate(layer.x, layer.y);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      if (layer.type === 'image')
        ctx.drawImage(layer.image, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
      if (layer.type === 'text') {
        ctx.fillStyle = layer.color;
        ctx.font = `700 ${Math.max(8, layer.height)}px "Karla", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(layer.text, 0, 0, Math.max(8, layer.width));
      }
    }
    ctx.restore();
  }
  return canvas;
}

export function paintSurface(canvas, from, to, { color, size, opacity = 1, erase = false }) {
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  if (from.x === to.x && from.y === to.y) {
    ctx.beginPath();
    ctx.arc(to.x, to.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function surfaceUVPaths(mesh, material, materialIndex, size) {
  const geometry = mesh?.geometry,
    uv = geometry?.getAttribute(material?.map?.channel ? `uv${material.map.channel}` : 'uv');
  if (!uv) return [];
  const count = geometry.index?.count || uv.count,
    groups = Array.isArray(mesh.material)
      ? geometry.groups.filter((group) => group.materialIndex === materialIndex)
      : [{ start: 0, count }],
    paths = [],
    transform = material?.map,
    value = new THREE.Vector2();
  if (transform?.matrixAutoUpdate) transform.updateMatrix();
  let visited = 0;
  for (const group of groups)
    for (let i = group.start; i + 2 < Math.min(group.start + group.count, count); i += 3) {
      if (visited++ >= 30000) return paths;
      const path = [];
      for (let k = 0; k < 3; k++) {
        const id = geometry.index ? geometry.index.getX(i + k) : i + k;
        value.set(uv.getX(id), uv.getY(id));
        if (transform) value.applyMatrix3(transform.matrix);
        path.push([value.x * size, (transform?.flipY === false ? value.y : 1 - value.y) * size]);
      }
      paths.push(path);
    }
  return paths;
}

export function surfaceTexture(canvas, original, name) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = original?.flipY ?? true;
  texture.channel = original?.channel || 0;
  if (original) {
    texture.wrapS = original.wrapS;
    texture.wrapT = original.wrapT;
    texture.offset.copy(original.offset);
    texture.repeat.copy(original.repeat);
    texture.center.copy(original.center);
    texture.rotation = original.rotation;
    texture.anisotropy = original.anisotropy;
    texture.minFilter = original.minFilter;
    texture.magFilter = original.magFilter;
    texture.generateMipmaps = original.generateMipmaps;
    texture.premultiplyAlpha = original.premultiplyAlpha;
    texture.matrixAutoUpdate = original.matrixAutoUpdate;
    texture.matrix.copy(original.matrix);
  }
  return texture;
}

export function materialWithSurface(material, canvas, name, neutral = false) {
  const next = material.clone();
  next.map = surfaceTexture(canvas, material.map, name);
  if (neutral && next.color) next.color.set('#ffffff');
  next.needsUpdate = true;
  return next;
}

export function replaceMeshMaterial(mesh, index, material) {
  if (Array.isArray(mesh.material)) {
    const slots = [...mesh.material];
    slots[index] = material;
    mesh.material = slots;
  } else mesh.material = material;
}

export function boundedSurfaceHistory(history, state, maxBytes = MAX_SURFACE_HISTORY_BYTES) {
  const next = [...history, state].slice(-30);
  const bytes = () => {
    const canvases = new Set(
      next.flatMap((entry) => entry.layers.map((layer) => layer.canvas)).filter(Boolean),
    );
    return [...canvases].reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0);
  };
  while (next.length > 1 && bytes() > maxBytes) next.shift();
  return next;
}

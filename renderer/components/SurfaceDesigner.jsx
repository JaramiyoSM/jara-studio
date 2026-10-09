import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import {
  Brush,
  Eraser,
  Move,
  Type,
  ImagePlus,
  Layers,
  Eye,
  EyeOff,
  Trash2,
  Undo2,
  Redo2,
  Download,
  X,
  Check,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { openFiles, saveFile } from '../lib/desktop.js';
import { safeName } from '../lib/scene-project.js';
import {
  surfaceCanvas,
  copySurfaceCanvas,
  newSurfaceLayer,
  renderSurface,
  paintSurface,
  surfaceUVPaths,
  surfaceTexture,
  replaceMeshMaterial,
  boundedSurfaceHistory,
  MAX_SURFACE_LAYERS,
} from '../lib/surface-design.js';
import './surface-designer.css';

const messages = {
  es: {
    title: 'Taller de superficies',
    subtitle: 'Ropa, liveries y detalles · sobre las UV de tu modelo',
    brush: 'Pincel',
    erase: 'Borrador',
    move: 'Mover capa',
    text: 'Añadir texto',
    image: 'Importar imagen',
    layer: 'Nueva capa de pintura',
    fill: 'Capa de color',
    layers: 'Capas del diseño',
    base: 'Textura original',
    color: 'Color del pincel',
    size: 'Tamaño del pincel',
    opacity: 'Opacidad',
    width: 'Ancho',
    height: 'Alto / letra',
    x: 'Posición X',
    y: 'Posición Y',
    rotation: 'Rotación',
    name: 'Nombre de capa',
    content: 'Texto',
    showUV: 'Mostrar guía UV',
    neutral: 'Colores sin tinte del material',
    undo: 'Deshacer diseño',
    redo: 'Rehacer diseño',
    apply: 'Aplicar al modelo',
    cancel: 'Cerrar sin aplicar',
    export: 'Exportar textura PNG',
    preview: 'Vista 3D del diseño',
    hint: 'Pinta sobre la textura; usa Mover para colocar textos e imágenes. El borrador actúa en la capa de pintura elegida.',
    flattened:
      'Al aplicar, las capas se combinan en la textura del material. El PNG y la textura final quedan disponibles en GLB / .jara. Las UV y los originales se conservan.',
    selected: 'Material seleccionado',
    local: 'Sin subidas · imágenes PNG, JPG o WebP',
    imported: 'Imagen',
    painted: 'Pintura',
    empty: 'Crea una capa para empezar.',
    remove: 'Eliminar capa',
    show: 'Mostrar capa',
    hide: 'Ocultar capa',
    noUV: 'Este material no tiene UV utilizables.',
    unavailable: 'La vista 3D no está disponible. Puedes editar y exportar el PNG.',
    changed: 'Hay un diseño sin aplicar. ¿Cerrar y descartarlo?',
    limit: 'El diseño admite hasta 16 capas.',
    textureLimit: 'Las imágenes deben ocupar como máximo 32 MB y 16 millones de píxeles.',
    imageError: 'Usa una imagen PNG, JPG o WebP válida.',
    guided: 'Guía UV: las islas compartidas o repetidas reciben el mismo diseño.',
    close: 'Cerrar taller de superficies',
    zoom: 'Zoom de textura',
    downscaled:
      'La edición usa como máximo 2048 px; el original conserva su resolución en el proyecto.',
    resolution: 'Resolución',
    resize: 'Cambiar la resolución remuestrea el diseño y reinicia su historial. ¿Continuar?',
    memory:
      'El diseño ha alcanzado su límite de memoria. Reduce la resolución o el número de capas de pintura / imágenes.',
    up: 'Subir capa',
    down: 'Bajar capa',
    paint3D: 'Pintar / colocar en 3D',
    orbit:
      'Desactiva para orbitar. Pincel pinta la superficie; Mover coloca textos e imágenes sobre ella.',
  },
  en: {
    title: 'Surface workshop',
    subtitle: 'Clothing, liveries and details · on your model’s UVs',
    brush: 'Brush',
    erase: 'Eraser',
    move: 'Move layer',
    text: 'Add text',
    image: 'Import image',
    layer: 'New paint layer',
    fill: 'Color layer',
    layers: 'Design layers',
    base: 'Original texture',
    color: 'Brush color',
    size: 'Brush size',
    opacity: 'Opacity',
    width: 'Width',
    height: 'Height / font',
    x: 'Position X',
    y: 'Position Y',
    rotation: 'Rotation',
    name: 'Layer name',
    content: 'Text',
    showUV: 'Show UV guide',
    neutral: 'Untinted material colors',
    undo: 'Undo design',
    redo: 'Redo design',
    apply: 'Apply to model',
    cancel: 'Close without applying',
    export: 'Export texture PNG',
    preview: '3D design preview',
    hint: 'Paint on the texture; use Move to place text and images. The eraser affects the selected paint layer.',
    flattened:
      'Applying combines the layers into the material texture. PNG and the final texture are available in GLB / .jara. UVs and originals are preserved.',
    selected: 'Selected material',
    local: 'No uploads · PNG, JPG or WebP images',
    imported: 'Image',
    painted: 'Paint',
    empty: 'Create a layer to start.',
    remove: 'Delete layer',
    show: 'Show layer',
    hide: 'Hide layer',
    noUV: 'This material does not have usable UVs.',
    unavailable: '3D preview is unavailable. You can still edit and export the PNG.',
    changed: 'There is an unapplied design. Close and discard it?',
    limit: 'A design supports up to 16 layers.',
    textureLimit: 'Images must be no larger than 32 MB and 16 million pixels.',
    imageError: 'Use a valid PNG, JPG or WebP image.',
    guided: 'UV guide: shared or repeated islands receive the same design.',
    close: 'Close surface workshop',
    zoom: 'Texture zoom',
    downscaled: 'Editing uses up to 2048 px; the original keeps its resolution in the project.',
    resolution: 'Resolution',
    resize: 'Changing resolution resamples the design and resets its history. Continue?',
    memory:
      'The design has reached its memory limit. Lower the resolution or use fewer paint / image layers.',
    up: 'Raise layer',
    down: 'Lower layer',
    paint3D: 'Paint / place in 3D',
    orbit:
      'Turn off to orbit. Brush paints the surface; Move places text and images directly on it.',
  },
};

function SurfacePreview({
  object,
  mesh,
  materialIndex,
  texture,
  neutral,
  revision,
  label,
  unavailable,
  paintMode,
  onDesign,
}) {
  const mount = useRef(null),
    runtime = useRef(null),
    events = useRef({ paintMode, onDesign });
  events.current = { paintMode, onDesign };
  const [error, setError] = useState(false);
  useEffect(() => {
    const node = mount.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.domElement.setAttribute('aria-label', label);
    node.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#191419');
    scene.add(new THREE.HemisphereLight(0xffffff, 0x57424b, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(3, 5, 4);
    scene.add(key);
    const originalMeshes = [],
      copiedMeshes = [],
      copy = clone(object);
    copy.visible = true;
    object.traverse((n) => {
      if (n.isMesh) originalMeshes.push(n);
    });
    copy.traverse((n) => {
      if (n.isMesh) copiedMeshes.push(n);
    });
    const target = copiedMeshes[originalMeshes.indexOf(mesh)],
      original = [].concat(mesh.material)[materialIndex],
      material = original.clone();
    material.map = texture;
    material.wireframe = false;
    replaceMeshMaterial(target, materialIndex, material);
    scene.add(copy);
    const bounds = new THREE.Box3().setFromObject(copy),
      center = bounds.getCenter(new THREE.Vector3()),
      extent = Math.max(bounds.getSize(new THREE.Vector3()).length(), 0.1),
      camera = new THREE.PerspectiveCamera(40, 1, Math.max(0.001, extent / 10000), extent * 50);
    camera.position.copy(center).add(new THREE.Vector3(extent * 0.7, extent * 0.3, extent * 0.85));
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.target.copy(center);
    orbit.enableDamping = true;
    const state = { renderer, material, original, orbit, dirty: true };
    runtime.current = state;
    const raycaster = new THREE.Raycaster(),
      cursor = new THREE.Vector2();
    let drawing = false;
    const hitPoint = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      cursor.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      copy.updateMatrixWorld(true);
      raycaster.setFromCamera(cursor, camera);
      const hit = raycaster.intersectObject(copy, true)[0];
      if (
        !hit ||
        hit.object !== target ||
        (Array.isArray(target.material) && hit.face.materialIndex !== materialIndex)
      )
        return null;
      const channel = texture.channel || 0,
        attribute = target.geometry.getAttribute(channel ? `uv${channel}` : 'uv');
      if (!attribute || !hit.barycoord) return null;
      const uv = THREE.Triangle.getInterpolatedAttribute(
        attribute,
        hit.face.a,
        hit.face.b,
        hit.face.c,
        hit.barycoord,
        new THREE.Vector2(),
      );
      if (texture.matrixAutoUpdate) texture.updateMatrix();
      texture.transformUv(uv);
      return {
        x: Math.max(0, Math.min(texture.image.width, uv.x * texture.image.width)),
        y: Math.max(0, Math.min(texture.image.height, uv.y * texture.image.height)),
        from3D: true,
      };
    };
    const pointerDown = (event) => {
      if (!events.current.paintMode || event.button !== 0) return;
      const point = hitPoint(event);
      if (point && events.current.onDesign('down', point)) {
        drawing = true;
        renderer.domElement.setPointerCapture(event.pointerId);
      }
    };
    const pointerMove = (event) => {
      if (drawing) {
        const point = hitPoint(event);
        if (point) events.current.onDesign('move', point);
      }
    };
    const pointerEnd = () => {
      if (drawing) {
        drawing = false;
        events.current.onDesign('end');
      }
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerEnd);
    renderer.domElement.addEventListener('pointercancel', pointerEnd);
    const observer = new ResizeObserver(() => {
      const width = Math.max(1, node.clientWidth),
        height = Math.max(1, node.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      state.dirty = true;
    });
    observer.observe(node);
    let frame;
    const tick = () => {
      const changed = orbit.update();
      if (state.dirty || changed) {
        renderer.render(scene, camera);
        state.dirty = false;
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      orbit.dispose();
      material.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerEnd);
      renderer.domElement.removeEventListener('pointercancel', pointerEnd);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, [object, mesh, materialIndex, texture]);
  useEffect(() => {
    const state = runtime.current;
    if (!state) return;
    state.material.color?.copy(neutral ? new THREE.Color('#ffffff') : state.original.color);
    state.material.needsUpdate = true;
    texture.needsUpdate = true;
    state.dirty = true;
  }, [revision, neutral, texture]);
  useEffect(() => {
    if (runtime.current) runtime.current.orbit.enabled = !paintMode;
  }, [paintMode, texture]);
  return (
    <div className="surface-preview" ref={mount}>
      {error && <p>{unavailable}</p>}
    </div>
  );
}

export default function SurfaceDesigner({
  object,
  mesh,
  material,
  materialIndex,
  locale,
  onApply,
  onClose,
}) {
  const t = messages[locale] || messages.en,
    imageSize = Math.max(material.map?.image?.width || 0, material.map?.image?.height || 0),
    data = useRef(null),
    working = useRef(null),
    visible = useRef(null),
    overlay = useRef(null),
    dialog = useRef(null),
    stroke = useRef(null),
    imported = useRef([]),
    bitmaps = useRef([]),
    textureRef = useRef(null);
  const [size, setSize] = useState(
      imageSize > 1024 ? 2048 : imageSize > 512 ? 1024 : imageSize ? 512 : 1024,
    ),
    [revision, setRevision] = useState(0),
    [tool, setTool] = useState('brush'),
    [color, setColor] = useState('#f5c0d5'),
    [brushSize, setBrushSize] = useState(32),
    [brushOpacity, setBrushOpacity] = useState(1),
    [selected, setSelected] = useState(''),
    [showUV, setShowUV] = useState(true),
    [neutral, setNeutral] = useState(false),
    [zoom, setZoom] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [changed, setChanged] = useState(false),
    [paintMode, setPaintMode] = useState(false);
  if (!data.current) {
    const base = surfaceCanvas(size),
      ctx = base.getContext('2d');
    if (material.map?.image) {
      try {
        ctx.drawImage(material.map.image, 0, 0, size, size);
      } catch {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
    }
    const layer = newSurfaceLayer('paint', size, { name: t.painted });
    data.current = { base, layers: [layer], undo: [], redo: [] };
    working.current = surfaceCanvas(size);
    renderSurface(working.current, base, [layer]);
    textureRef.current = surfaceTexture(working.current, material.map, 'surface-preview');
  }
  const state = data.current,
    active = state.layers.find((layer) => layer.id === selected) || state.layers.at(-1),
    touch = () => {
      setRevision((value) => value + 1);
      setChanged(true);
    },
    snapshot = () => ({ layers: state.layers }),
    push = (before) => {
      state.undo = boundedSurfaceHistory(state.undo, before);
      state.redo = [];
    },
    mutate = (next) => {
      push(snapshot());
      state.layers = next;
      touch();
    },
    patch = (values) => {
      if (active)
        mutate(
          state.layers.map((layer) => (layer.id === active.id ? { ...layer, ...values } : layer)),
        );
    },
    close = () => {
      if (!busy && (!changed || window.confirm(t.changed))) onClose();
    },
    history = (direction) => {
      const source = state[direction],
        target = direction === 'undo' ? 'redo' : 'undo';
      if (!source.length) return;
      state[target] = boundedSurfaceHistory(state[target], snapshot());
      state.layers = source.pop().layers;
      touch();
    };
  const add = (type, options = {}) => {
    if (state.layers.length >= MAX_SURFACE_LAYERS) {
      setError(t.limit);
      return;
    }
    if (
      type === 'paint' &&
      (state.layers.filter((layer) => layer.type === 'paint').length + 1) * size * size * 4 >
        64 * 1024 * 1024
    ) {
      setError(t.memory);
      return;
    }
    const layer = newSurfaceLayer(type, size, {
      name:
        type === 'paint'
          ? t.painted
          : type === 'text'
            ? 'JARAMIYO'
            : type === 'fill'
              ? t.fill
              : t.imported,
      color,
      ...options,
    });
    mutate([...state.layers, layer]);
    setSelected(layer.id);
    setTool(type === 'paint' ? 'brush' : 'move');
    setError('');
    if (['text', 'image'].includes(type)) setPaintMode(true);
  };
  const resize = (nextSize) => {
    if (nextSize === size || busy || stroke.current) return;
    if (
      state.layers.filter((layer) => layer.type === 'paint').length * nextSize * nextSize * 4 >
      64 * 1024 * 1024
    ) {
      setError(t.memory);
      return;
    }
    if (changed && !window.confirm(t.resize)) return;
    const ratio = nextSize / size,
      base = surfaceCanvas(nextSize);
    base.getContext('2d').drawImage(state.base, 0, 0, nextSize, nextSize);
    state.base = base;
    state.layers = state.layers.map((layer) => {
      let canvas;
      if (layer.canvas) {
        canvas = surfaceCanvas(nextSize);
        canvas.getContext('2d').drawImage(layer.canvas, 0, 0, nextSize, nextSize);
      }
      return {
        ...layer,
        ...(canvas ? { canvas } : {}),
        x: layer.x * ratio,
        y: layer.y * ratio,
        width: layer.width * ratio,
        height: layer.height * ratio,
      };
    });
    state.undo = [];
    state.redo = [];
    working.current = surfaceCanvas(nextSize);
    renderSurface(working.current, state.base, state.layers);
    const previous = textureRef.current;
    textureRef.current = surfaceTexture(working.current, material.map, 'surface-preview');
    setSize(nextSize);
    setBrushSize(Math.min(brushSize, Math.floor(nextSize / 3)));
    touch();
    previous.dispose();
    setError('');
  };
  const reorder = (delta) => {
    if (!active) return;
    const layers = [...state.layers],
      index = layers.findIndex((layer) => layer.id === active.id),
      target = index + delta;
    if (target < 0 || target >= layers.length) return;
    [layers[index], layers[target]] = [layers[target], layers[index]];
    mutate(layers);
  };
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.querySelector('button')?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const node = dialog.current;
    const key = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
      if ((event.ctrlKey || event.metaKey) && ['s', 'o'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        ['z', 'y'].includes(event.key.toLowerCase()) &&
        !event.target.closest('input,textarea')
      ) {
        event.preventDefault();
        event.stopPropagation();
        history(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo');
      }
      if (event.key === 'Tab') {
        const controls = [
            ...node.querySelectorAll(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
            ),
          ],
          first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    node.addEventListener('keydown', key);
    return () => node.removeEventListener('keydown', key);
  }, [changed, busy, revision]);
  useEffect(
    () => () => {
      textureRef.current?.dispose();
      bitmaps.current.forEach((bitmap) => bitmap.close());
    },
    [],
  );
  useEffect(() => {
    let active = true;
    document.fonts?.ready.then(() => {
      if (active) setRevision((value) => value + 1);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    renderSurface(working.current, state.base, state.layers);
    if (visible.current) {
      const ctx = visible.current.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(working.current, 0, 0);
    }
    if (overlay.current) {
      const ctx = overlay.current.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      if (showUV) {
        ctx.beginPath();
        for (const path of surfaceUVPaths(mesh, material, materialIndex, size)) {
          ctx.moveTo(...path[0]);
          ctx.lineTo(...path[1]);
          ctx.lineTo(...path[2]);
          ctx.closePath();
        }
        ctx.strokeStyle = 'rgba(20,8,18,.8)';
        ctx.lineWidth = Math.max(1, size / 512);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,204,226,.75)';
        ctx.lineWidth = Math.max(0.5, size / 1024);
        ctx.stroke();
      }
      if (active && ['text', 'image'].includes(active.type)) {
        ctx.save();
        ctx.translate(active.x, active.y);
        ctx.rotate((active.rotation * Math.PI) / 180);
        ctx.strokeStyle = '#73f4bc';
        ctx.lineWidth = size / 512;
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(-active.width / 2, -active.height / 2, active.width, active.height);
        ctx.restore();
      }
    }
    textureRef.current.needsUpdate = true;
  }, [revision, selected, showUV, material, mesh]);
  const position = (event) => {
    const bounds = visible.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(size, ((event.clientX - bounds.left) / bounds.width) * size)),
      y: Math.max(0, Math.min(size, ((event.clientY - bounds.top) / bounds.height) * size)),
    };
  };
  const begin = (point, place = false) => {
    if (busy || !active) return false;
    const before = snapshot();
    if (['brush', 'erase'].includes(tool)) {
      if (active.type !== 'paint' || !active.visible) {
        setError(t.hint);
        return false;
      }
      const canvas = copySurfaceCanvas(active.canvas);
      state.layers = state.layers.map((layer) =>
        layer.id === active.id ? { ...layer, canvas } : layer,
      );
      stroke.current = {
        before,
        id: active.id,
        last: point,
        canvas,
        tool,
        color,
        size: brushSize,
        opacity: brushOpacity,
      };
      paintSurface(canvas, point, point, {
        color,
        size: brushSize,
        opacity: brushOpacity,
        erase: tool === 'erase',
      });
    } else if (['image', 'text'].includes(active.type)) {
      stroke.current = {
        before,
        id: active.id,
        point,
        x: place ? point.x : active.x,
        y: place ? point.y : active.y,
        tool: 'move',
      };
      if (place)
        state.layers = state.layers.map((layer) =>
          layer.id === active.id ? { ...layer, x: point.x, y: point.y } : layer,
        );
    } else return false;
    touch();
    return true;
  };
  const down = (event) => {
    if (event.button === 0 && begin(position(event)))
      event.currentTarget.setPointerCapture(event.pointerId);
  };
  const advance = (point) => {
    const current = stroke.current;
    if (!current) return;
    if (current.tool === 'move')
      state.layers = state.layers.map((layer) =>
        layer.id === current.id
          ? {
              ...layer,
              x: current.x + point.x - current.point.x,
              y: current.y + point.y - current.point.y,
            }
          : layer,
      );
    else {
      const jump =
        point.from3D && Math.hypot(point.x - current.last.x, point.y - current.last.y) > size / 4;
      paintSurface(current.canvas, jump ? point : current.last, point, {
        ...current,
        erase: current.tool === 'erase',
      });
      current.last = point;
    }
    touch();
  };
  const move = (event) => advance(position(event));
  const end = () => {
    if (stroke.current) {
      push(stroke.current.before);
      stroke.current = null;
      touch();
    }
  };
  const design3D = (kind, point) => {
    if (kind === 'down') return begin(point, true);
    if (kind === 'move') advance(point);
    if (kind === 'end') end();
  };
  const importImage = async () => {
    if (busy || state.layers.length >= MAX_SURFACE_LAYERS) {
      setError(t.limit);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const files = await openFiles({ kind: 'image' }),
        file = files?.[0];
      if (!file) return;
      if (!/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error(t.imageError);
      if (file.data.byteLength > 32 * 1024 * 1024) throw new Error(t.textureLimit);
      if (
        imported.current.reduce((sum, entry) => sum + entry.data.byteLength, 0) +
          file.data.byteLength >
        64 * 1024 * 1024
      )
        throw new Error(t.memory);
      const bitmap = await createImageBitmap(new Blob([file.data]));
      if (
        bitmap.width * bitmap.height > 16_777_216 ||
        Math.max(bitmap.width, bitmap.height) > 8192
      ) {
        bitmap.close();
        throw new Error(t.textureLimit);
      }
      if (
        (bitmaps.current.reduce((sum, image) => sum + image.width * image.height, 0) +
          bitmap.width * bitmap.height) *
          4 >
        64 * 1024 * 1024
      ) {
        bitmap.close();
        throw new Error(t.memory);
      }
      bitmaps.current.push(bitmap);
      imported.current.push(file);
      const width = size * 0.4,
        height = (width * bitmap.height) / bitmap.width;
      add('image', { image: bitmap, sourceFile: file, name: safeName(file.name), width, height });
    } catch (failure) {
      setError(failure.message || t.imageError);
    } finally {
      setBusy(false);
    }
  };
  const exportPNG = async () => {
    setBusy(true);
    setError('');
    try {
      renderSurface(working.current, state.base, state.layers);
      const blob = await new Promise((resolve) => working.current.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG export failed');
      await saveFile({
        name: `${safeName(object.name)}-${safeName(material.name || 'surface')}.png`,
        bytes: new Uint8Array(await blob.arrayBuffer()),
        kind: 'image',
      });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      renderSurface(working.current, state.base, state.layers);
      await onApply({
        canvas: copySurfaceCanvas(working.current),
        neutral,
        sources: [
          ...new Set(
            state.layers.filter((layer) => layer.type === 'image').map((layer) => layer.sourceFile),
          ),
        ],
      });
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <div
      className="surface-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="surface-title"
      data-testid="surface-designer"
    >
      <div className="surface-dialog" ref={dialog}>
        <header>
          <div>
            <span className="eyebrow">JARAMIYO / SURFACE</span>
            <h1 id="surface-title">{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
          <button className="icon-button" aria-label={t.close} disabled={busy} onClick={close}>
            <X size={20} />
          </button>
        </header>
        <div className="surface-toolbar">
          {[
            [Brush, 'brush', t.brush],
            [Eraser, 'erase', t.erase],
            [Move, 'move', t.move],
          ].map(([Icon, key, label]) => (
            <button
              key={key}
              className={`button compact ${tool === key ? 'active' : ''}`}
              onClick={() => setTool(key)}
              disabled={busy}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
          <span className="surface-divider" />
          <label>
            {t.color}
            <input
              aria-label={t.color}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <label>
            {t.size}
            <input
              aria-label={t.size}
              type="range"
              min="1"
              max={size / 3}
              step="1"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
            <b>{brushSize}px</b>
          </label>
          <label>
            {t.opacity}
            <input
              aria-label={`${t.opacity} · ${t.brush}`}
              type="range"
              min=".05"
              max="1"
              step=".05"
              value={brushOpacity}
              onChange={(e) => setBrushOpacity(Number(e.target.value))}
            />
          </label>
          <span className="toolbar-spacer" />
          <button
            className="icon-button"
            aria-label={t.undo}
            disabled={!state.undo.length || busy}
            onClick={() => history('undo')}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label={t.redo}
            disabled={!state.redo.length || busy}
            onClick={() => history('redo')}
          >
            <Redo2 size={17} />
          </button>
        </div>
        <div className="surface-body">
          <section className="surface-artboard">
            <div className="surface-canvas-options">
              <label>
                <input
                  type="checkbox"
                  checked={showUV}
                  onChange={(e) => setShowUV(e.target.checked)}
                />
                {t.showUV}
              </label>
              <label>
                {t.zoom}
                <select
                  aria-label={t.zoom}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                >
                  {[0.5, 1, 1.5, 2].map((value) => (
                    <option key={value} value={value}>
                      {value * 100}%
                    </option>
                  ))}
                </select>
              </label>
              <select
                aria-label={t.resolution}
                value={size}
                onChange={(event) => resize(Number(event.target.value))}
              >
                {[512, 1024, 2048].map((value) => (
                  <option key={value} value={value}>
                    {value} px
                  </option>
                ))}
              </select>
            </div>
            <div className="surface-canvas-scroll">
              <div
                className="surface-canvas-stack"
                style={{ width: `${zoom * 100}%`, minWidth: `${zoom * 100}%` }}
              >
                <canvas
                  width={size}
                  height={size}
                  ref={visible}
                  aria-label="Design texture"
                  data-testid="surface-pixels"
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={end}
                  style={{ cursor: tool === 'move' ? 'move' : 'crosshair' }}
                />
                <canvas
                  width={size}
                  height={size}
                  ref={overlay}
                  className="surface-uv-overlay"
                  aria-hidden="true"
                />
              </div>
            </div>
            <p>{t.hint}</p>
            <p className="hint">{t.guided}</p>
          </section>
          <section className="surface-preview-column">
            <div className="surface-preview-heading">
              <span>{t.preview}</span>
              <b>{mesh.userData.displayName || mesh.name}</b>
              <label className="surface-paint-mode">
                <input
                  type="checkbox"
                  checked={paintMode}
                  onChange={(event) => setPaintMode(event.target.checked)}
                />
                {t.paint3D}
              </label>
              <p>{t.orbit}</p>
            </div>
            <SurfacePreview
              object={object}
              mesh={mesh}
              materialIndex={materialIndex}
              texture={textureRef.current}
              neutral={neutral}
              revision={revision}
              label={t.preview}
              unavailable={t.unavailable}
              paintMode={paintMode}
              onDesign={design3D}
            />
            <label className="surface-neutral">
              <input
                type="checkbox"
                checked={neutral}
                onChange={(e) => {
                  setNeutral(e.target.checked);
                  setChanged(true);
                }}
              />
              {t.neutral}
            </label>
            <p className="hint">
              {t.selected}: {material.name || materialIndex + 1}
            </p>
          </section>
          <aside className="surface-layers">
            <h2>
              <Layers size={15} />
              {t.layers}
              <small>
                {state.layers.length}/{MAX_SURFACE_LAYERS}
              </small>
            </h2>
            <div className="surface-add-layers">
              <button
                className="button compact"
                aria-label={t.layer}
                title={t.layer}
                disabled={busy}
                onClick={() => add('paint')}
              >
                <Brush size={15} />
              </button>
              <button className="button compact" disabled={busy} onClick={() => add('text')}>
                <Type size={15} />
                {t.text}
              </button>
              <button className="button compact" disabled={busy} onClick={importImage}>
                <ImagePlus size={15} />
                {t.image}
              </button>
              <button className="button compact" disabled={busy} onClick={() => add('fill')}>
                <Layers size={15} />
                {t.fill}
              </button>
            </div>
            <div className="surface-layer-list">
              {[...state.layers].reverse().map((layer) => (
                <div key={layer.id} className={active?.id === layer.id ? 'active' : ''}>
                  <button
                    className="surface-layer-name"
                    onClick={() => {
                      setSelected(layer.id);
                      if (layer.type !== 'paint') setTool('move');
                    }}
                  >
                    {layer.type === 'text' ? (
                      <Type size={13} />
                    ) : layer.type === 'image' ? (
                      <ImagePlus size={13} />
                    ) : (
                      <Brush size={13} />
                    )}
                    <span>{layer.name}</span>
                  </button>
                  <button
                    className="icon-button tiny"
                    aria-label={`${layer.visible ? t.hide : t.show} ${layer.name}`}
                    onClick={() =>
                      mutate(
                        state.layers.map((entry) =>
                          entry.id === layer.id ? { ...entry, visible: !entry.visible } : entry,
                        ),
                      )
                    }
                  >
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button
                    className="icon-button tiny"
                    aria-label={`${t.remove} ${layer.name}`}
                    onClick={() => mutate(state.layers.filter((entry) => entry.id !== layer.id))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <div className="surface-base-layer">
                <LockIcon />
                {t.base}
              </div>
            </div>
            {active ? (
              <div className="surface-layer-controls">
                <div className="surface-layer-order">
                  <button
                    className="button compact"
                    aria-label={t.up}
                    disabled={state.layers.at(-1) === active}
                    onClick={() => reorder(1)}
                  >
                    <ArrowUp size={14} />
                    {t.up}
                  </button>
                  <button
                    className="button compact"
                    aria-label={t.down}
                    disabled={state.layers[0] === active}
                    onClick={() => reorder(-1)}
                  >
                    <ArrowDown size={14} />
                    {t.down}
                  </button>
                </div>
                <label>
                  {t.name}
                  <input
                    aria-label={t.name}
                    value={active.name}
                    maxLength="80"
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </label>
                {active.type === 'text' && (
                  <label>
                    {t.content}
                    <input
                      aria-label={t.content}
                      value={active.text}
                      maxLength="160"
                      onChange={(e) => patch({ text: e.target.value })}
                    />
                  </label>
                )}
                {['text', 'fill'].includes(active.type) && (
                  <label>
                    {t.color}
                    <input
                      type="color"
                      aria-label="Layer color"
                      value={active.color}
                      onChange={(e) => patch({ color: e.target.value })}
                    />
                  </label>
                )}
                <label>
                  {t.opacity}
                  <input
                    aria-label={`${t.opacity} · ${t.layers}`}
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={active.opacity}
                    onChange={(e) => patch({ opacity: Number(e.target.value) })}
                  />
                </label>
                {['text', 'image'].includes(active.type) && (
                  <div className="surface-numbers">
                    {[
                      ['x', t.x, -size, size * 2],
                      ['y', t.y, -size, size * 2],
                      ['width', t.width, 8, size * 3],
                      ['height', t.height, 8, size * 3],
                      ['rotation', t.rotation, -360, 360],
                    ].map(([key, label, min, max]) => (
                      <label key={key}>
                        {label}
                        <input
                          aria-label={label}
                          type="number"
                          min={min}
                          max={max}
                          step="1"
                          value={Math.round(active[key] * 100) / 100}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            if (Number.isFinite(value))
                              patch({ [key]: Math.max(min, Math.min(max, value)) });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p>{t.empty}</p>
            )}
            <p className="hint">{t.local}</p>
            {imageSize > 2048 && <p className="hint">{t.downscaled}</p>}
          </aside>
        </div>
        {error && (
          <div className="surface-error" role="alert">
            {error}
          </div>
        )}
        <footer>
          <p>{t.flattened}</p>
          <button className="button" disabled={busy} onClick={exportPNG}>
            <Download size={15} />
            {t.export}
          </button>
          <button className="button primary" disabled={busy} onClick={apply}>
            <Check size={15} />
            {t.apply}
          </button>
        </footer>
      </div>
    </div>
  );
}

function LockIcon() {
  return <span aria-hidden="true">◈</span>;
}

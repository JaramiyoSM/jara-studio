import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import {
  Box,
  Plus,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Move,
  RotateCw,
  Scaling,
  Focus,
  Grid3X3,
  Bone,
  Play,
  Pause,
  SkipBack,
  ImagePlus,
  Download,
  Camera,
  Undo2,
  Redo2,
  Upload,
  FileArchive,
  Save,
  FolderOpen,
  Layers,
  Ruler,
  Maximize2,
  Check,
  ArrowUpRight,
  BookOpen,
} from 'lucide-react';
import {
  openFiles,
  saveFile,
  openProject,
  saveProject,
  saveRecovery,
  loadRecovery,
  openExternal,
  setUnsaved,
} from '../lib/desktop.js';
import {
  createPrimitive,
  duplicateObject,
  loadModel,
  transformOf,
  applyTransform,
  sceneStats,
  exportGLB,
  exportOBJ,
  parseProjectScene,
  meshDetails,
  disposeObject,
  newId,
  validateSceneAddition,
  validateSceneBatch,
} from '../lib/scene-engine.js';
import {
  createProjectArchive,
  readProjectArchive,
  MODEL_EXTENSIONS,
  extension,
  safeName,
  validateTransform,
  validateOriginalSources,
} from '../lib/scene-project.js';
import SurfaceDesigner from './SurfaceDesigner.jsx';
import { materialWithSurface, replaceMeshMaterial, surfaceUVPaths } from '../lib/surface-design.js';

const text = {
  es: {
    objects: 'Objetos',
    inspector: 'Inspector',
    import: 'Importar',
    empty: 'Tu siguiente creación empieza aquí',
    emptyBody:
      'Importa un modelo o abre un ejemplo. Trabaja con tus archivos, sin subirlos a un servidor.',
    add: 'Añadir objeto',
    model: 'Modelo 3D',
    project: 'Proyecto',
    new: 'Nueva escena',
    save: 'Guardar proyecto',
    open: 'Abrir proyecto',
    recovery: 'Recuperar sesión',
    samples: 'Ejemplos listos para explorar',
    select: 'Selecciona un objeto para inspeccionar sus mallas, materiales y transformaciones.',
    transform: 'Transformación',
    position: 'Posición · m',
    rotation: 'Rotación · °',
    scale: 'Escala',
    translate: 'Mover',
    rotate: 'Rotar',
    scaleTool: 'Escalar',
    snap: 'Ajuste',
    world: 'Mundo',
    local: 'Local',
    meshes: 'Mallas',
    material: 'Material',
    color: 'Color',
    roughness: 'Rugosidad',
    metalness: 'Metal',
    opacity: 'Opacidad',
    texture: 'Textura de color',
    uv: 'Mapa UV',
    noUV: 'Esta malla no tiene coordenadas UV.',
    wire: 'Alambre',
    skeleton: 'Esqueleto',
    frame: 'Encuadrar',
    perspective: 'Perspectiva',
    front: 'Frente',
    right: 'Derecha',
    top: 'Superior',
    distance: 'Medir dos puntos',
    animation: 'Animaciones',
    noAnimations: 'Este objeto no incluye clips. Importa un GLB o FBX animado para reproducirlos.',
    none: 'Pose de reposo',
    export: 'Exportar',
    reset: 'Restablecer',
    projectName: 'Nombre del proyecto',
    saved: 'Proyecto guardado.',
    restored: 'Proyecto abierto.',
    imported: 'Modelo importado.',
    duplicate: 'Duplicar',
    remove: 'Eliminar',
    hide: 'Ocultar',
    show: 'Mostrar',
    locked: 'Bloquear',
    unlocked: 'Desbloquear',
    undo: 'Deshacer',
    redo: 'Rehacer',
    textureLoaded: 'Textura aplicada al material seleccionado.',
    surface: 'Diseñar ropa / livery',
    surfaceApplied: 'Diseño aplicado. Guarda el proyecto para conservar la textura editada.',
    surfaceNoUV: 'Importa un modelo con UV para diseñar su textura.',
    uvDownload: 'Exportar UV PNG',
    offline: 'LOCAL · PRIVADO',
    ready: 'Listo',
    source: 'Origen',
    meters: 'Unidades en metros',
    faces: 'triángulos',
    notice:
      'GLB / OBJ son formatos de trabajo. La compilación YDR, YDD y los esqueletos GTA se completan en Sollumz / Blender.',
    focus: 'Pantalla completa',
    missing: 'No hay una sesión guardada.',
    sampleLoading: 'Cargando ejemplo…',
    human: 'Humano articulado',
    clothing: 'Camiseta y vaqueros',
    weapon: 'Arma de ejemplo',
    car: 'Vehículo de ejemplo',
    prop: 'Caja de ejemplo',
    primitive: 'Primitivas',
    selection: 'Selección',
    mesh: 'Malla',
    all: 'Todas',
    duration: 'Duración',
    time: 'Tiempo',
    changes: 'Cambios locales',
    savedLabel: 'Guardado',
    clone: 'Copia',
    exported: 'Archivo exportado.',
    loading: 'Procesando…',
    grid: 'Rejilla',
    normal: 'Sombreado',
    deleteConfirm: '¿Eliminar el objeto seleccionado?',
    saveBeforeNew: 'La escena contiene cambios sin guardar. ¿Crear una escena nueva?',
    openReplace: 'Abrir un proyecto reemplaza la escena actual. ¿Continuar?',
    help: 'Clic selecciona · arrastrar orbita · rueda acerca · F encuadra · W/E/R transforma · Ctrl+Z deshace',
    sources: 'Los archivos originales permanecen en el proyecto .jara.',
  },
  en: {
    objects: 'Objects',
    inspector: 'Inspector',
    import: 'Import',
    empty: 'Your next creation starts here',
    emptyBody:
      'Import a model or open a sample. Work with your own files without uploading them to a server.',
    add: 'Add object',
    model: '3D model',
    project: 'Project',
    new: 'New scene',
    save: 'Save project',
    open: 'Open project',
    recovery: 'Recover session',
    samples: 'Ready to explore',
    select: 'Select an object to inspect its meshes, materials and transforms.',
    transform: 'Transform',
    position: 'Position · m',
    rotation: 'Rotation · °',
    scale: 'Scale',
    translate: 'Move',
    rotate: 'Rotate',
    scaleTool: 'Scale',
    snap: 'Snap',
    world: 'World',
    local: 'Local',
    meshes: 'Meshes',
    material: 'Material',
    color: 'Color',
    roughness: 'Roughness',
    metalness: 'Metalness',
    opacity: 'Opacity',
    texture: 'Color texture',
    uv: 'UV map',
    noUV: 'This mesh does not contain UV coordinates.',
    wire: 'Wireframe',
    skeleton: 'Skeleton',
    frame: 'Frame selection',
    perspective: 'Perspective',
    front: 'Front',
    right: 'Right',
    top: 'Top',
    distance: 'Measure two points',
    animation: 'Animations',
    noAnimations: 'This object has no clips. Import an animated GLB or FBX to play its animations.',
    none: 'Rest pose',
    export: 'Export',
    reset: 'Reset',
    projectName: 'Project name',
    saved: 'Project saved.',
    restored: 'Project opened.',
    imported: 'Model imported.',
    duplicate: 'Duplicate',
    remove: 'Delete',
    hide: 'Hide',
    show: 'Show',
    locked: 'Lock',
    unlocked: 'Unlock',
    undo: 'Undo',
    redo: 'Redo',
    textureLoaded: 'Texture applied to the selected material.',
    surface: 'Design clothing / livery',
    surfaceApplied: 'Design applied. Save your project to keep the edited texture.',
    surfaceNoUV: 'Import a model with UVs to design its texture.',
    uvDownload: 'Export UV PNG',
    offline: 'LOCAL · PRIVATE',
    ready: 'Ready',
    source: 'Source',
    meters: 'Units in meters',
    faces: 'triangles',
    notice:
      'GLB / OBJ are working formats. YDR, YDD compilation and GTA skeletons are completed in Sollumz / Blender.',
    focus: 'Full screen',
    missing: 'No saved session is available.',
    sampleLoading: 'Loading sample…',
    human: 'Rigged human',
    clothing: 'T-shirt and jeans',
    weapon: 'Weapon sample',
    car: 'Vehicle sample',
    prop: 'Crate sample',
    primitive: 'Primitives',
    selection: 'Selection',
    mesh: 'Mesh',
    all: 'All',
    duration: 'Duration',
    time: 'Time',
    changes: 'Local changes',
    savedLabel: 'Saved',
    clone: 'Copy',
    exported: 'File exported.',
    loading: 'Processing…',
    grid: 'Grid',
    normal: 'Shading',
    deleteConfirm: 'Delete the selected object?',
    saveBeforeNew: 'The scene contains unsaved changes. Create a new scene?',
    openReplace: 'Opening a project replaces this scene. Continue?',
    help: 'Click selects · drag orbits · wheel zooms · F frames · W/E/R transforms · Ctrl+Z undoes',
    sources: 'Original files remain in the .jara project.',
  },
};
const modes = {
  props: { sample: 'prop' },
  peds: { sample: 'human' },
  vehicles: { sample: 'car' },
  weapons: { sample: 'weapon' },
  clothing: { sample: 'clothing' },
  scene: { sample: null },
};
const primitiveNames = {
  box: ['Cubo', 'Box'],
  sphere: ['Esfera', 'Sphere'],
  cylinder: ['Cilindro', 'Cylinder'],
  plane: ['Plano', 'Plane'],
};

function UVPreview({ mesh, material, materialIndex, onExport, label, noUV }) {
  const canvas = useRef(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const ctx = node.getContext('2d');
    ctx.fillStyle = '#1c171b';
    ctx.fillRect(0, 0, 320, 320);
    const image = material?.map?.image;
    if (image) {
      try {
        ctx.drawImage(image, 0, 0, 320, 320);
      } catch {}
    }
    ctx.strokeStyle = 'rgba(60,29,48,.9)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (const points of surfaceUVPaths(mesh, material, materialIndex, 320)) {
      ctx.moveTo(...points[0]);
      ctx.lineTo(...points[1]);
      ctx.lineTo(...points[2]);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(248,182,213,.7)';
    ctx.lineWidth = 0.45;
    ctx.stroke();
  }, [mesh, material, material?.map, materialIndex]);
  if (!mesh?.geometry.getAttribute(material?.map?.channel ? `uv${material.map.channel}` : 'uv'))
    return <p className="hint">{noUV}</p>;
  return (
    <>
      <canvas ref={canvas} width={320} height={320} className="uv-canvas" aria-label="UV preview" />
      <button
        className="button subtle wide"
        onClick={() => canvas.current.toBlob((blob) => onExport(blob), 'image/png')}
      >
        <Download size={14} />
        {label}
      </button>
    </>
  );
}
function VectorFields({ label, values, onChange, onPending, convert = 1, disabled = false }) {
  return (
    <div className="vector-fields">
      <label>{label}</label>
      <div>
        {['X', 'Y', 'Z'].map((axis, index) => (
          <label key={axis}>
            <span className={`axis-${axis.toLowerCase()}`}>{axis}</span>
            <input
              key={`${values[index]}-${axis}`}
              aria-label={`${label} ${axis}`}
              type="number"
              disabled={disabled}
              step={convert === 1 ? '.01' : '1'}
              defaultValue={Math.round(values[index] * convert * 1000) / 1000}
              onChange={onPending}
              onBlur={(e) => {
                const previous = Math.round(values[index] * convert * 1000) / 1000;
                const value = e.target.value.trim() === '' ? NaN : Number(e.target.value) / convert;
                if (!Number.isFinite(value)) {
                  e.currentTarget.value = String(previous);
                  return;
                }
                if (value !== values[index] && onChange(index, value) === false)
                  e.currentTarget.value = String(previous);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

const SceneStudio = forwardRef(function SceneStudio(
  { locale = 'es', mode = 'scene', onStatus = () => {} },
  ref,
) {
  const t = text[locale] || text.es;
  const mount = useRef(null),
    shell = useRef(null),
    engine = useRef(null),
    statusRef = useRef(onStatus),
    localeRef = useRef(t),
    busyRef = useRef(false),
    dirtyRef = useRef(false),
    modeRef = useRef(mode),
    nameRef = useRef('Untitled');
  const [objects, setObjects] = useState([]),
    [selected, setSelected] = useState(null),
    [meshId, setMeshId] = useState(''),
    [materialIndex, setMaterialIndex] = useState(0),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [name, setName] = useState('Untitled'),
    [transformMode, setTransformMode] = useState('translate'),
    [space, setSpace] = useState('world'),
    [snap, setSnap] = useState(false),
    [snapStep, setSnapStep] = useState(0.1),
    [view, setView] = useState('perspective'),
    [grid, setGrid] = useState(true),
    [wire, setWire] = useState(false),
    [bones, setBones] = useState(false),
    [measure, setMeasure] = useState(false),
    [measurement, setMeasurement] = useState(null),
    [undoCount, setUndoCount] = useState(0),
    [redoCount, setRedoCount] = useState(0),
    [clip, setClip] = useState(''),
    [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [expanded, setExpanded] = useState({}),
    [showSamples, setShowSamples] = useState(true),
    [toast, setToast] = useState(''),
    [webglError, setWebglError] = useState(''),
    [surface, setSurface] = useState(null);
  statusRef.current = onStatus;
  localeRef.current = t;
  modeRef.current = mode;
  nameRef.current = name;
  useEffect(() => {
    setUnsaved('scene', dirty);
    return () => {
      setUnsaved('scene', false);
    };
  }, [dirty]);
  const notify = (message) => {
    setToast(message);
    statusRef.current(message);
  };
  const markPending = () => {
    dirtyRef.current = true;
    setDirty(true);
  };
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  const update = (mark = true) => {
    const e = engine.current;
    if (!e) return;
    e.needsRender = true;
    setObjects([...e.content.children]);
    setRevision((n) => n + 1);
    setUndoCount(e.undo.length);
    setRedoCount(e.redo.length);
    if (mark) {
      dirtyRef.current = true;
      setDirty(true);
    }
  };
  const select = (object, mesh = null) => {
    const e = engine.current;
    if (!e) return;
    e.selected = object;
    setSelected(object);
    const first = mesh || meshDetails(object)[0];
    e.mesh = first;
    setMeshId(first?.uuid || '');
    setMaterialIndex(0);
    setClip('');
    setPlaying(false);
    setTime(0);
    e.mixers.forEach((m) => m.stopAllAction());
    e.playing = false;
    e.controls.detach();
    if (object && !object.userData.locked) e.controls.attach(object);
    refreshHelpers();
  };
  const refreshHelpers = () => {
    const e = engine.current;
    if (!e) return;
    e.needsRender = true;
    if (e.box) {
      e.scene.remove(e.box);
      e.box.dispose();
      e.box = null;
    }
    if (e.skeleton) {
      e.scene.remove(e.skeleton);
      e.skeleton.dispose();
      e.skeleton = null;
    }
    if (e.selected) {
      e.box = new THREE.BoxHelper(e.selected, 0xdca3bc);
      e.scene.add(e.box);
      if (e.bones) {
        e.skeleton = new THREE.SkeletonHelper(e.selected);
        e.scene.add(e.skeleton);
      }
    }
  };
  const command = (redo, undo) => {
    const e = engine.current;
    redo();
    e.undo.push({ redo, undo });
    if (e.undo.length > 80) e.undo.shift();
    e.redo = [];
    update();
    refreshHelpers();
  };
  const undo = () => {
    const e = engine.current,
      action = e.undo.pop();
    if (!action) return;
    action.undo();
    e.redo.push(action);
    if (e.selected && !e.content.children.includes(e.selected)) select(null);
    update();
    refreshHelpers();
  };
  const redo = () => {
    const e = engine.current,
      action = e.redo.pop();
    if (!action) return;
    action.redo();
    e.undo.push(action);
    update();
    refreshHelpers();
  };
  const frame = (object = engine.current?.selected) => {
    const e = engine.current;
    if (!e) return;
    const target = object || e.content;
    const box = new THREE.Box3().setFromObject(target);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()).length() || 1;
    e.orbit.target.copy(center);
    const direction = e.camera.position.clone().sub(e.orbit.target).normalize();
    if (direction.lengthSq() < 0.1) direction.set(1, 0.7, 1).normalize();
    e.perspective.position.copy(center).addScaledVector(direction, size * 1.3);
    e.orthographic.position.copy(center).addScaledVector(e.orthoDirection, size * 2);
    e.orthoSize = size * 0.72;
    resize();
    e.needsRender = true;
    e.orbit.update();
  };
  const resize = () => {
    const e = engine.current,
      node = mount.current;
    if (!e || !node) return;
    const w = Math.max(node.clientWidth, 1),
      h = Math.max(node.clientHeight, 1),
      aspect = w / h;
    e.renderer.setSize(w, h, false);
    e.perspective.aspect = aspect;
    e.perspective.updateProjectionMatrix();
    e.orthographic.left = -e.orthoSize * aspect;
    e.orthographic.right = e.orthoSize * aspect;
    e.orthographic.top = e.orthoSize;
    e.orthographic.bottom = -e.orthoSize;
    e.orthographic.updateProjectionMatrix();
    e.needsRender = true;
  };
  useEffect(() => {
    const node = mount.current,
      scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a1519');
    scene.fog = new THREE.Fog('#1a1519', 50, 180);
    const content = new THREE.Group();
    content.name = 'JaraScene';
    scene.add(content);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
    } catch {
      const message =
        localeRef.current === text.es
          ? 'No se ha podido activar WebGL 2. Revisa el controlador de tu GPU y la aceleración de gráficos de Windows.'
          : 'WebGL 2 could not start. Check your GPU driver and Windows graphics acceleration.';
      setWebglError(message);
      statusRef.current(message);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label', '3D viewport');
    renderer.domElement.tabIndex = 0;
    node.appendChild(renderer.domElement);
    const perspective = new THREE.PerspectiveCamera(42, 1, 0.01, 5000);
    perspective.position.set(4, 2.6, 4);
    const orthographic = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.01, 5000);
    orthographic.position.set(0, 2, 6);
    const orbit = new OrbitControls(perspective, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.12;
    orbit.target.set(0, 0.5, 0);
    const controls = new TransformControls(perspective, renderer.domElement);
    controls.setSize(0.85);
    scene.add(controls.getHelper());
    const helper = new THREE.GridHelper(40, 80, 0x66505d, 0x332a30);
    helper.material.transparent = true;
    helper.material.opacity = 0.55;
    scene.add(helper);
    const axes = new THREE.AxesHelper(1.5);
    axes.position.y = 0.003;
    scene.add(axes);
    scene.add(new THREE.HemisphereLight(0xffedf6, 0x706568, 2.8));
    const key = new THREE.DirectionalLight(0xffe8dd, 3.2);
    key.position.set(4, 8, 5);
    key.castShadow = false;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.001;
    key.shadow.normalBias = 0.035;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc2dfff, 1.5);
    fill.position.set(-5, 3, -4);
    scene.add(fill);
    const e = {
      scene,
      content,
      renderer,
      perspective,
      orthographic,
      camera: perspective,
      orbit,
      controls,
      grid: helper,
      axes,
      orthoSize: 3,
      orthoDirection: new THREE.Vector3(0, 0, 1),
      selected: null,
      mesh: null,
      box: null,
      skeleton: null,
      bones: false,
      measure: false,
      points: [],
      measureLine: null,
      undo: [],
      redo: [],
      sources: [],
      mixers: new Map(),
      playing: false,
      action: null,
      clip: null,
      time: 0,
      clock: new THREE.Clock(),
      dragStart: null,
      disposed: false,
      needsRender: true,
    };
    engine.current = e;
    controls.addEventListener('dragging-changed', (ev) => {
      orbit.enabled = !ev.value;
      if (ev.value && e.selected) e.dragStart = transformOf(e.selected);
      if (!ev.value && e.selected && e.dragStart) {
        const object = e.selected,
          before = e.dragStart,
          after = transformOf(object);
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          e.undo.push({
            undo: () => applyTransform(object, before),
            redo: () => applyTransform(object, after),
          });
          e.redo = [];
          update();
        }
        e.dragStart = null;
        refreshHelpers();
      }
    });
    controls.addEventListener('change', () => (e.needsRender = true));
    controls.addEventListener('objectChange', () => {
      if (e.box) e.box.update();
      setRevision((n) => n + 1);
    });
    let pointerStart = null;
    const down = (event) => {
      pointerStart = { x: event.clientX, y: event.clientY, button: event.button };
    };
    const up = (event) => {
      if (
        !pointerStart ||
        pointerStart.button !== 0 ||
        e.controls.dragging ||
        Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        e.camera,
      );
      const hits = ray.intersectObjects(content.children, true).filter((hit) => {
        let n = hit.object;
        while (n && n !== content) {
          if (!n.visible) return false;
          n = n.parent;
        }
        return hit.object.isMesh;
      });
      if (e.measure && hits[0]) {
        e.points.push(hits[0].point.clone());
        if (e.points.length === 2) {
          if (e.measureLine) {
            scene.remove(e.measureLine);
            e.measureLine.geometry.dispose();
            e.measureLine.material.dispose();
          }
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(e.points),
            new THREE.LineBasicMaterial({ color: '#ffc475', depthTest: false }),
          );
          scene.add(line);
          e.measureLine = line;
          setMeasurement(e.points[0].distanceTo(e.points[1]));
          e.points = [];
          e.needsRender = true;
        }
        return;
      }
      if (hits[0]) {
        let owner = hits[0].object;
        while (owner.parent && owner.parent !== content) owner = owner.parent;
        select(owner, hits[0].object);
      } else select(null);
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();
    let lastUi = 0,
      raf;
    const render = () => {
      if (e.disposed) return;
      if (!node.getClientRects().length) {
        e.needsRender = true;
        e.clock.getDelta();
        raf = requestAnimationFrame(render);
        return;
      }
      const dt = Math.min(e.clock.getDelta(), 0.1);
      if (e.playing) {
        e.mixers.forEach((m) => m.update(dt));
        e.time = e.action?.time || 0;
        if (performance.now() - lastUi > 100) {
          setTime(e.time);
          lastUi = performance.now();
        }
      }
      const orbitChanged = orbit.update();
      if (e.playing || orbitChanged || e.controls.dragging || e.needsRender) {
        if (e.box) e.box.update();
        renderer.render(scene, e.camera);
        e.needsRender = false;
      }
      raf = requestAnimationFrame(render);
    };
    render();
    return () => {
      e.disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      controls.dispose();
      orbit.dispose();
      content.children.forEach(disposeObject);
      e.undo = [];
      e.redo = [];
      e.mixers.forEach((m) => m.stopAllAction());
      renderer.dispose();
      renderer.forceContextLoss();
      node.removeChild(renderer.domElement);
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.controls.setMode(transformMode);
    e.controls.setSpace(space);
    e.controls.setTranslationSnap(snap ? snapStep : null);
    e.controls.setRotationSnap(snap ? Math.PI / 12 : null);
    e.controls.setScaleSnap(snap ? 0.1 : null);
  }, [transformMode, space, snap, snapStep]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.grid.visible = grid;
    e.axes.visible = grid;
    e.needsRender = true;
  }, [grid]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.bones = bones;
    refreshHelpers();
  }, [bones, selected]);
  useEffect(() => {
    if (engine.current) {
      engine.current.measure = measure;
      engine.current.points = [];
    }
  }, [measure]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.content.traverse((n) => {
      if (n.isMesh)
        [].concat(n.material).forEach((m) => {
          m.wireframe = wire;
        });
    });
    e.needsRender = true;
  }, [wire, objects]);
  useEffect(() => {
    const key = (e) => {
      if (
        document.querySelector('[role=dialog]') ||
        !mount.current?.getClientRects().length ||
        e.target.closest('input,select,textarea,[contenteditable]') ||
        busyRef.current
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (['w', 'e', 'r'].includes(e.key.toLowerCase()))
        setTransformMode({ w: 'translate', e: 'rotate', r: 'scale' }[e.key.toLowerCase()]);
      else if (e.key.toLowerCase() === 'f') frame();
      else if (e.key === 'Delete' && engine.current?.selected) removeSelected();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const task = async (fn) => {
    if (busyRef.current) return;
    if (!engine.current) {
      notify(webglError || 'WebGL 2 is unavailable.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      notify(error.message || String(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const addObject = (object) => {
    const e = engine.current;
    try {
      validateSceneAddition(e.content, object);
    } catch (error) {
      disposeObject(object);
      throw error;
    }
    command(
      () => e.content.add(object),
      () => e.content.remove(object),
    );
    if (object.animations.length) e.mixers.set(object, new THREE.AnimationMixer(object));
    select(object);
    frame(object);
  };
  const importModels = () =>
    task(async () => {
      const files = await openFiles({ kind: 'model' });
      if (!files?.length) return;
      const models = files.filter((f) => MODEL_EXTENSIONS.includes(extension(f.name)));
      if (!models.length) throw new Error('Select a GLB, glTF, OBJ, FBX or STL model.');
      if (engine.current.content.children.length + models.length > 500)
        throw new Error('The workspace supports up to 500 objects.');
      validateOriginalSources(engine.current.sources, files);
      const parsed = [];
      try {
        for (const file of models) {
          parsed.push(await loadModel(file, files));
          validateSceneBatch(engine.current.content, parsed);
        }
      } catch (error) {
        parsed.forEach(disposeObject);
        throw error;
      }
      engine.current.sources.push(...files);
      for (const model of parsed) addObject(model);
      notify(t.imported);
    });
  const loadSample = (sample) =>
    task(async () => {
      notify(t.sampleLoading);
      const response = await fetch(`./samples/${sample}.glb`);
      if (!response.ok) throw new Error('Sample unavailable');
      const data = new Uint8Array(await response.arrayBuffer());
      const file = { name: `${sample}.glb`, data, size: data.length };
      validateOriginalSources(engine.current.sources, [file]);
      const model = await loadModel(file);
      model.name = t[sample] || sample;
      addObject(model);
      engine.current.sources.push(file);
      setShowSamples(false);
      notify(t.imported);
    });
  const removeSelected = () => {
    const e = engine.current,
      object = e.selected;
    if (!object) return;
    command(
      () => {
        e.content.remove(object);
      },
      () => e.content.add(object),
    );
    select(null);
  };
  const toggleVisible = (object) => {
    const previous = object.visible;
    command(
      () => (object.visible = !previous),
      () => (object.visible = previous),
    );
  };
  const toggleLocked = (object) => {
    const previous = !!object.userData.locked;
    command(
      () => (object.userData.locked = !previous),
      () => (object.userData.locked = previous),
    );
    if (eSelected(object)) select(object);
  };
  const eSelected = (object) => engine.current.selected === object;
  const changeTransform = (offset, index, value) => {
    const object = engine.current.selected;
    if (!object || object.userData.locked) return false;
    const before = transformOf(object),
      after = [...before];
    after[offset + index] = value;
    try {
      validateTransform(after);
    } catch (error) {
      notify(error.message);
      setRevision((n) => n + 1);
      return false;
    }
    command(
      () => applyTransform(object, after),
      () => applyTransform(object, before),
    );
    return true;
  };
  const changeMaterial = (material, key, value) => {
    const before = material[key]?.isColor ? material[key].clone() : material[key];
    const apply = (v) => {
      if (material[key]?.isColor) material[key].set(v);
      else material[key] = v;
      material.transparent = material.opacity < 1;
      material.needsUpdate = true;
    };
    command(
      () => apply(value),
      () => apply(before),
    );
  };
  const assignTexture = () =>
    task(async () => {
      const object = engine.current.selected,
        mesh = meshDetails(object).find((n) => n.uuid === meshId),
        material = [].concat(mesh?.material || [])[materialIndex];
      if (!material) return;
      const files = await openFiles({ kind: 'image' });
      if (!files?.length) return;
      const file = files[0];
      validateOriginalSources(engine.current.sources, [file]);
      if (file.data.byteLength > 32 * 1024 * 1024) throw new Error('Texture exceeds 32 MB');
      const url = URL.createObjectURL(new Blob([file.data]));
      let texture;
      try {
        texture = await new THREE.TextureLoader().loadAsync(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      texture.flipY =
        material.map?.flipY ?? !['glb', 'gltf'].includes(extension(object.userData.source || ''));
      texture.channel = material.map?.channel || 0;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.name = file.name;
      const before = material.map;
      command(
        () => {
          material.map = texture;
          material.needsUpdate = true;
        },
        () => {
          material.map = before;
          material.needsUpdate = true;
        },
      );
      engine.current.sources.push(file);
      notify(t.textureLoaded);
    });
  const applySurface = async ({ canvas, neutral, sources }) => {
    if (!surface || busyRef.current) throw new Error(t.loading);
    const { mesh, material, materialIndex: slot, object } = surface;
    if (!engine.current.content.children.includes(object)) throw new Error(t.select);
    validateOriginalSources(engine.current.sources, sources);
    const next = materialWithSurface(
      material,
      canvas,
      `${safeName(object.name)}-surface.png`,
      neutral,
    );
    command(
      () => replaceMeshMaterial(mesh, slot, next),
      () => replaceMeshMaterial(mesh, slot, material),
    );
    engine.current.sources.push(...sources);
    setSurface(null);
    notify(t.surfaceApplied);
  };
  const setCameraView = (value) => {
    const e = engine.current;
    setView(value);
    if (value === 'perspective') {
      e.camera = e.perspective;
    } else {
      e.camera = e.orthographic;
      e.orthoDirection.copy(
        {
          front: new THREE.Vector3(0, 0, 1),
          right: new THREE.Vector3(1, 0, 0),
          top: new THREE.Vector3(0, 1, 0),
        }[value],
      );
      e.orthographic.up.set(0, value === 'top' ? 0 : 1, value === 'top' ? -1 : 0);
      e.orthographic.position.copy(e.orbit.target).addScaledVector(e.orthoDirection, 10);
    }
    e.orbit.object = e.camera;
    e.orbit.enableRotate = value === 'perspective';
    e.controls.camera = e.camera;
    e.orbit.update();
    frame();
  };
  const chooseClip = (value) => {
    const e = engine.current;
    e.mixers.forEach((m) => m.stopAllAction());
    e.playing = false;
    setClip(value);
    setPlaying(false);
    setTime(0);
    e.time = 0;
    e.action = null;
    e.clip = null;
    if (value && e.selected) {
      const next = e.selected.animations[Number(value) - 1],
        mixer = e.mixers.get(e.selected) || new THREE.AnimationMixer(e.selected);
      e.mixers.set(e.selected, mixer);
      e.action = mixer.clipAction(next);
      e.clip = next;
      e.action.play();
      mixer.setTime(0);
    }
    refreshHelpers();
  };
  const play = () => {
    const e = engine.current;
    if (!e.action) return;
    e.playing = !e.playing;
    setPlaying(e.playing);
  };
  const seek = (value) => {
    const e = engine.current;
    e.mixers.get(e.selected)?.setTime(value);
    e.time = value;
    setTime(value);
    refreshHelpers();
  };
  const exportRest = async () => {
    const e = engine.current;
    const oldTime = e.time,
      wasPlaying = e.playing,
      oldClip = e.clip,
      selected = e.selected;
    e.mixers.forEach((m) => m.stopAllAction());
    e.playing = false;
    try {
      return await exportGLB(e.content);
    } finally {
      if (oldClip && selected) {
        const mixer = e.mixers.get(selected);
        e.action = mixer.clipAction(oldClip);
        e.action.play();
        mixer.setTime(oldTime);
        e.playing = wasPlaying;
      }
    }
  };
  const archive = async () => {
    const e = engine.current;
    const scene = await exportRest();
    return createProjectArchive({
      scene,
      sources: e.sources,
      manifest: {
        format: 'jara-studio',
        version: 1,
        name: nameRef.current,
        mode: modeRef.current,
        objects: e.content.children.map((o) => ({
          id: o.userData.jaraId,
          name: o.name,
          visible: o.visible,
          locked: o.userData.locked,
          transform: transformOf(o),
          source: o.userData.source,
        })),
        camera: { position: e.camera.position.toArray(), target: e.orbit.target.toArray() },
        createdAt: new Date().toISOString(),
      },
    });
  };
  const save = () =>
    task(async () => {
      const bytes = await archive();
      const result = await saveProject({ name: `${safeName(nameRef.current)}.jara`, bytes });
      if (!result?.canceled) {
        dirtyRef.current = false;
        setDirty(false);
        notify(t.saved);
      }
    });
  const clearScene = () => {
    const e = engine.current;
    if (!e) return;
    select(null);
    e.mixers.forEach((m) => m.stopAllAction());
    e.mixers.clear();
    for (const object of [...e.content.children]) {
      e.content.remove(object);
      disposeObject(object);
    }
    e.undo = [];
    e.redo = [];
    e.sources = [];
    if (e.measureLine) {
      e.scene.remove(e.measureLine);
      e.measureLine.geometry.dispose();
      e.measureLine.material.dispose();
      e.measureLine = null;
    }
    setMeasurement(null);
    update(false);
  };
  const restore = async (bytes) => {
    const { manifest, scene, sources } = await readProjectArchive(bytes);
    const parsed = await parseProjectScene(scene);
    if (parsed.objects.length !== manifest.objects.length)
      throw new Error('Project object count does not match its scene');
    const candidate = new THREE.Group();
    for (const object of parsed.objects) {
      validateSceneAddition(candidate, object);
      candidate.add(object);
    }
    clearScene();
    const e = engine.current;
    parsed.objects.forEach((object, index) => {
      const info = manifest.objects[index];
      object.userData = {
        ...object.userData,
        jaraId: info.id,
        source: info.source,
        locked: info.locked,
      };
      object.name = info.name;
      object.visible = info.visible;
      applyTransform(object, info.transform);
      object.animations = parsed.animations.filter((c) => {
        const names = new Set();
        object.traverse((n) => names.add(n.name));
        return c.tracks.some((track) => names.has(track.name.split('.')[0]));
      });
      e.content.add(object);
      if (object.animations.length) e.mixers.set(object, new THREE.AnimationMixer(object));
    });
    e.sources = sources;
    setName(manifest.name);
    dirtyRef.current = false;
    setDirty(false);
    update(false);
    if (manifest.camera) {
      e.perspective.position.fromArray(manifest.camera.position);
      e.orbit.target.fromArray(manifest.camera.target);
      e.orbit.update();
    } else frame(e.content);
    if (e.content.children[0]) select(e.content.children[0]);
    setShowSamples(false);
    notify(t.restored);
  };
  const open = () =>
    task(async () => {
      if (dirtyRef.current && !window.confirm(localeRef.current.openReplace)) return;
      const file = await openProject();
      if (file?.data) await restore(file.data);
    });
  const recover = () =>
    task(async () => {
      if (dirtyRef.current && !window.confirm(localeRef.current.openReplace)) return;
      const result = await loadRecovery();
      if (result?.data) await restore(result.data);
      else if (result instanceof Uint8Array) await restore(result);
      else notify(t.missing);
    });
  const newScene = () => {
    if (dirtyRef.current && !window.confirm(t.saveBeforeNew)) return;
    clearScene();
    setName('Untitled');
    dirtyRef.current = false;
    setDirty(false);
    setShowSamples(true);
  };
  const exportFormat = (format) =>
    task(async () => {
      const e = engine.current;
      if (!e.content.children.length) throw new Error('The scene is empty');
      let bytes, ext;
      if (format === 'glb') {
        bytes = await exportRest();
        ext = 'glb';
      } else if (format === 'obj') {
        bytes = new TextEncoder().encode(exportOBJ(e.content));
        ext = 'obj';
      } else {
        bytes = new TextEncoder().encode(
          JSON.stringify(
            {
              name: nameRef.current,
              objects: e.content.children.map((o) => ({
                name: o.name,
                id: o.userData.jaraId,
                position: o.position.toArray(),
                rotation: o.rotation.toArray().slice(0, 3),
                scale: o.scale.toArray(),
                visible: o.visible,
              })),
            },
            null,
            2,
          ),
        );
        ext = 'json';
      }
      const result = await saveFile({
        name: `${safeName(nameRef.current)}.${ext}`,
        bytes,
        kind: ext,
      });
      if (!result?.canceled) notify(t.exported);
    });
  const screenshot = () =>
    task(async () => {
      const e = engine.current;
      e.renderer.render(e.scene, e.camera);
      const blob = await new Promise((resolve) =>
        e.renderer.domElement.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('Screenshot unavailable');
      await saveFile({
        name: `${safeName(nameRef.current)}-viewport.png`,
        bytes: new Uint8Array(await blob.arrayBuffer()),
        kind: 'image',
      });
      notify(t.exported);
    });
  useImperativeHandle(
    ref,
    () => ({
      save,
      open,
      newScene,
      importModels,
      exportGLB: () => exportFormat('glb'),
      exportOBJ: () => exportFormat('obj'),
      screenshot,
      recover,
    }),
    [name, dirty, locale, mode],
  );
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!dirtyRef.current || busyRef.current || !engine.current?.content.children.length) return;
      busyRef.current = true;
      try {
        await saveRecovery(await archive());
        statusRef.current(localeRef.current.changes + ' · autosave');
      } catch (error) {
        statusRef.current(error.message);
      } finally {
        busyRef.current = false;
      }
    }, 45000);
    return () => clearInterval(timer);
  }, []);
  const meshes = meshDetails(selected),
    activeMesh = meshes.find((n) => n.uuid === meshId) || meshes[0],
    materials = [].concat(activeMesh?.material || []),
    activeMaterial = materials[materialIndex] || materials[0],
    transform = selected ? transformOf(selected) : null,
    stats = engine.current
      ? sceneStats(engine.current.content)
      : { objects: 0, meshes: 0, triangles: 0, bones: 0, materials: 0 },
    clips = selected?.animations || [];
  if (webglError)
    return (
      <div className="gpu-error" role="alert">
        <Grid3X3 size={38} />
        <span className="eyebrow">JARA STUDIO / GRAPHICS</span>
        <h1>
          {locale === 'es' ? 'Revisa la aceleración de gráficos' : 'Check graphics acceleration'}
        </h1>
        <p>{webglError}</p>
        <p>
          {locale === 'es'
            ? 'Puedes continuar preparando archivos en Utilidades. El estudio 3D necesita un contexto WebGL 2 disponible.'
            : 'You can continue preparing files in Utilities. The 3D studio needs an available WebGL 2 context.'}
        </p>
        <button
          className="button primary"
          onClick={() => openExternal('https://jara-tools.vercel.app/#/guide?chapter=desktop')}
        >
          <BookOpen size={16} />
          {locale === 'es' ? 'Ver documentación' : 'Open documentation'}
        </button>
      </div>
    );
  return (
    <div className="scene-studio" ref={shell} data-testid="scene-studio">
      <aside className="objects-panel">
        <div className="panel-heading">
          <span>
            <Layers size={15} />
            {t.objects}
          </span>
          <span className="count">{objects.length}</span>
        </div>
        <div className="scene-project-name">
          <input
            aria-label={t.projectName}
            value={name}
            onChange={(e) => {
              setName(e.target.value.slice(0, 120));
              dirtyRef.current = true;
              setDirty(true);
            }}
          />
          <span
            className={dirty ? 'dirty-dot' : 'saved-dot'}
            title={dirty ? t.changes : t.savedLabel}
          />
        </div>
        <button className="button primary wide" onClick={importModels} disabled={busy}>
          <Upload size={15} />
          {t.import} GLB / OBJ / FBX
        </button>
        <details className="primitive-menu">
          <summary>
            <Plus size={14} />
            {t.add}
            <ChevronDown size={14} />
          </summary>
          <div>
            {Object.keys(primitiveNames).map((kind) => (
              <button key={kind} onClick={() => task(async () => addObject(createPrimitive(kind)))}>
                <Box size={14} />
                {primitiveNames[kind][locale === 'en' ? 1 : 0]}
              </button>
            ))}
          </div>
        </details>
        <div className="object-tree">
          {objects.map((object) => (
            <div key={object.userData.jaraId} className="tree-group">
              <div className={`tree-row ${selected === object ? 'selected' : ''}`}>
                <button
                  className="tree-expand"
                  aria-label="Expand meshes"
                  onClick={() =>
                    setExpanded({ ...expanded, [object.uuid]: !expanded[object.uuid] })
                  }
                >
                  {expanded[object.uuid] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <button className="tree-name" onClick={() => select(object)}>
                  <Box size={14} />
                  <span>{object.name}</span>
                </button>
                <button
                  className="icon-button tiny"
                  aria-label={`${object.visible ? t.hide : t.show} ${object.name}`}
                  onClick={() => toggleVisible(object)}
                >
                  {object.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button
                  className="icon-button tiny"
                  aria-label={`${object.userData.locked ? t.unlocked : t.locked} ${object.name}`}
                  onClick={() => toggleLocked(object)}
                >
                  {object.userData.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
              </div>
              {expanded[object.uuid] &&
                meshDetails(object).map((mesh) => (
                  <button
                    className={`mesh-tree-row ${meshId === mesh.uuid ? 'selected' : ''}`}
                    key={mesh.uuid}
                    onClick={() => select(object, mesh)}
                  >
                    <Grid3X3 size={12} />
                    {mesh.userData.displayName || mesh.name || 'Mesh'}
                  </button>
                ))}
            </div>
          ))}
          {!objects.length && (
            <div className="tree-empty">
              <Box size={26} />
              <p>{t.select}</p>
            </div>
          )}
        </div>
        <div className="selection-actions">
          <button
            className="icon-button"
            title={t.duplicate}
            aria-label={t.duplicate}
            disabled={!selected || busy}
            onClick={() =>
              task(async () => {
                validateSceneAddition(engine.current.content, selected);
                addObject(duplicateObject(selected));
              })
            }
          >
            <Copy size={15} />
          </button>
          <button
            className="icon-button"
            title={t.remove}
            aria-label={t.remove}
            disabled={!selected || busy}
            onClick={removeSelected}
          >
            <Trash2 size={15} />
          </button>
          <button
            className="icon-button"
            title={t.undo}
            aria-label={t.undo}
            disabled={!undoCount || busy}
            onClick={undo}
          >
            <Undo2 size={15} />
          </button>
          <button
            className="icon-button"
            title={t.redo}
            aria-label={t.redo}
            disabled={!redoCount || busy}
            onClick={redo}
          >
            <Redo2 size={15} />
          </button>
        </div>
        <details
          className="sample-menu"
          open={showSamples}
          onToggle={(e) => setShowSamples(e.currentTarget.open)}
        >
          <summary>
            {t.samples}
            <ChevronDown size={14} />
          </summary>
          <div>
            {['human', 'clothing', 'weapon', 'car', 'prop'].map((sample) => (
              <button
                key={sample}
                className={modes[mode]?.sample === sample ? 'recommended' : ''}
                onClick={() => loadSample(sample)}
                disabled={busy}
              >
                <img
                  src={`./samples/${sample}.webp`}
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                  alt=""
                />
                <span>{t[sample]}</span>
                <ArrowUpRight size={12} />
              </button>
            ))}
          </div>
        </details>
        <div className="local-note">
          <span className="live-dot" />
          {t.offline}
          <p>{t.sources}</p>
        </div>
      </aside>
      <main className="scene-workspace">
        <div className="viewport-toolbar">
          <div className="tool-group">
            {[
              [Move, 'translate', t.translate],
              [RotateCw, 'rotate', t.rotate],
              [Scaling, 'scale', t.scaleTool],
            ].map(([Icon, value, label]) => (
              <button
                key={value}
                className={`icon-button ${transformMode === value ? 'active' : ''}`}
                title={`${label} (${value === 'translate' ? 'W' : value === 'rotate' ? 'E' : 'R'})`}
                aria-label={label}
                onClick={() => setTransformMode(value)}
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
          <select
            aria-label="Transform space"
            value={space}
            onChange={(e) => setSpace(e.target.value)}
          >
            <option value="world">{t.world}</option>
            <option value="local">{t.local}</option>
          </select>
          <label className="snap-toggle">
            <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
            {t.snap}
          </label>
          {snap && (
            <input
              className="snap-input"
              aria-label="Snap distance"
              type="number"
              min=".001"
              max="1000"
              step=".01"
              value={snapStep}
              onChange={(e) =>
                setSnapStep(Math.max(0.001, Math.min(1000, Number(e.target.value) || 0.1)))
              }
            />
          )}
          <span className="toolbar-spacer" />
          <button
            className={`icon-button ${measure ? 'active' : ''}`}
            title={t.distance}
            aria-label={t.distance}
            onClick={() => setMeasure(!measure)}
          >
            <Ruler size={16} />
          </button>
          <button
            className="icon-button"
            title={t.frame}
            aria-label={t.frame}
            onClick={() => frame()}
          >
            <Focus size={16} />
          </button>
          <button
            className="icon-button"
            title={t.focus}
            aria-label={t.focus}
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen()
                : shell.current.requestFullscreen()
            }
          >
            <Maximize2 size={16} />
          </button>
        </div>
        <div className="viewport-area">
          <div ref={mount} className="three-mount" />
          <div className="view-selector">
            <select
              aria-label="Camera view"
              value={view}
              onChange={(e) => setCameraView(e.target.value)}
            >
              {['perspective', 'front', 'right', 'top'].map((v) => (
                <option value={v} key={v}>
                  {t[v]}
                </option>
              ))}
            </select>
            <button
              aria-label={t.grid}
              title={t.grid}
              className={`icon-button tiny ${grid ? 'active' : ''}`}
              onClick={() => setGrid(!grid)}
            >
              <Grid3X3 size={14} />
            </button>
          </div>
          {!objects.length && (
            <div className="viewport-welcome">
              <div className="welcome-symbol">
                <Box size={30} />
              </div>
              <span className="eyebrow">JARA STUDIO</span>
              <h1>{t.empty}</h1>
              <p>{t.emptyBody}</p>
              <div>
                <button className="button primary" disabled={busy} onClick={importModels}>
                  <Upload size={15} />
                  {t.import} {t.model}
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => loadSample(modes[mode]?.sample || 'human')}
                >
                  <Play size={15} />
                  {t.samples}
                </button>
              </div>
              <span className="welcome-formats">GLB · GLTF · OBJ + MTL · FBX · STL</span>
            </div>
          )}
          <div className="viewport-info">
            <span>
              {stats.triangles.toLocaleString()} {t.faces}
            </span>
            <span>
              {stats.meshes} {t.meshes.toLowerCase()}
            </span>
            {stats.bones > 0 && <span>{stats.bones} bones</span>}
          </div>
          {measure && (
            <div className="measurement-badge">
              <Ruler size={14} />
              {measurement === null ? t.distance : `${measurement.toFixed(4)} m`}
            </div>
          )}
          {busy && (
            <div className="busy-indicator">
              <span className="spinner" />
              {t.loading}
            </div>
          )}
        </div>
        <div className="animation-panel">
          <div className="animation-heading">
            <span>
              <Play size={13} />
              {t.animation}
            </span>
            <select
              aria-label="Animation clip"
              value={clip}
              onChange={(e) => chooseClip(e.target.value)}
            >
              <option value="">{t.none}</option>
              {clips.map((c, i) => (
                <option value={String(i + 1)} key={`${c.name}-${i}`}>
                  {c.name || `Clip ${i + 1}`} · {c.duration.toFixed(1)}s
                </option>
              ))}
            </select>
            <div className="animation-buttons">
              <button
                className="icon-button tiny"
                disabled={!clip}
                aria-label={t.reset}
                onClick={() => seek(0)}
              >
                <SkipBack size={14} />
              </button>
              <button
                className={`icon-button tiny ${playing ? 'active' : ''}`}
                disabled={!clip}
                aria-label={playing ? 'Pause animation' : 'Play animation'}
                onClick={play}
              >
                {playing ? <Pause size={14} /> : <Play size={14} />}
              </button>
            </div>
          </div>
          {clip ? (
            <div className="timeline">
              <span>{time.toFixed(2)}s</span>
              <input
                aria-label={t.time}
                type="range"
                min="0"
                max={clips[Number(clip) - 1]?.duration || 1}
                step=".001"
                value={Math.min(time, clips[Number(clip) - 1]?.duration || 1)}
                onChange={(e) => seek(Number(e.target.value))}
              />
              <span>{(clips[Number(clip) - 1]?.duration || 0).toFixed(2)}s</span>
            </div>
          ) : (
            <p>
              {clips.length
                ? locale === 'es'
                  ? 'Selecciona un clip para revisar el movimiento del esqueleto.'
                  : 'Select a clip to preview the skeleton movement.'
                : t.noAnimations}
            </p>
          )}
          <div className="viewport-help">{t.help}</div>
        </div>
      </main>
      <aside className="inspector-panel">
        <div className="panel-heading">
          <span>
            <Scaling size={15} />
            {t.inspector}
          </span>
          {selected && (
            <button className="icon-button tiny" title={t.frame} onClick={() => frame()}>
              <Focus size={14} />
            </button>
          )}
        </div>
        {selected ? (
          <>
            <div className="inspector-name">
              <input
                aria-label="Object name"
                key={selected.uuid}
                defaultValue={selected.name}
                onChange={markPending}
                onBlur={(e) => {
                  const before = selected.name,
                    next = safeName(e.target.value);
                  e.currentTarget.value = next;
                  command(
                    () => (selected.name = next),
                    () => (selected.name = before),
                  );
                }}
              />
              <span>{selected.userData.source || t.primitive}</span>
            </div>
            <details open className="inspector-section">
              <summary>
                {t.transform}
                <ChevronDown size={13} />
              </summary>
              <VectorFields
                label={t.position}
                disabled={selected.userData.locked}
                values={transform.slice(0, 3)}
                onPending={markPending}
                onChange={(i, v) => changeTransform(0, i, v)}
              />
              <VectorFields
                label={t.rotation}
                disabled={selected.userData.locked}
                values={transform.slice(3, 6)}
                onPending={markPending}
                convert={180 / Math.PI}
                onChange={(i, v) => changeTransform(3, i, v)}
              />
              <VectorFields
                label={t.scale}
                disabled={selected.userData.locked}
                values={transform.slice(6)}
                onPending={markPending}
                onChange={(i, v) => changeTransform(6, i, v)}
              />
              <p className="hint">{t.meters}</p>
            </details>
            <details open className="inspector-section">
              <summary>
                {t.meshes}
                <span>{meshes.length}</span>
                <ChevronDown size={13} />
              </summary>
              <select
                className="wide"
                aria-label={t.mesh}
                value={activeMesh?.uuid || ''}
                onChange={(e) => {
                  setMeshId(e.target.value);
                  engine.current.mesh = meshes.find((m) => m.uuid === e.target.value);
                  setMaterialIndex(0);
                }}
              >
                {meshes.map((m, index) => (
                  <option value={m.uuid} key={m.uuid}>
                    {m.userData.displayName || m.name || `Mesh ${index + 1}`}
                  </option>
                ))}
              </select>
              <div className="toggle-row">
                <label>
                  <input
                    type="checkbox"
                    checked={wire}
                    onChange={(e) => setWire(e.target.checked)}
                  />
                  {t.wire}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={bones}
                    onChange={(e) => setBones(e.target.checked)}
                  />
                  {t.skeleton}
                </label>
              </div>
            </details>
            {activeMaterial && (
              <details open className="inspector-section">
                <summary>
                  {t.material}
                  <span>{materials.length}</span>
                  <ChevronDown size={13} />
                </summary>
                {materials.length > 1 && (
                  <select
                    className="wide"
                    aria-label="Material slot"
                    value={materialIndex}
                    onChange={(e) => setMaterialIndex(Number(e.target.value))}
                  >
                    {materials.map((m, i) => (
                      <option value={i} key={m.uuid}>
                        {m.name || `Material ${i + 1}`}
                      </option>
                    ))}
                  </select>
                )}
                <label className="material-color">
                  {t.color}
                  <input
                    type="color"
                    aria-label={t.color}
                    value={`#${activeMaterial.color?.getHexString() || 'ffffff'}`}
                    onChange={(e) => changeMaterial(activeMaterial, 'color', e.target.value)}
                  />
                  <code>#{activeMaterial.color?.getHexString() || 'ffffff'}</code>
                </label>
                {[
                  ['roughness', t.roughness],
                  ['metalness', t.metalness],
                  ['opacity', t.opacity],
                ].map(
                  ([key, label]) =>
                    activeMaterial[key] !== undefined && (
                      <label className="material-range" key={key}>
                        {label}
                        <span>{Number(activeMaterial[key]).toFixed(2)}</span>
                        <input
                          aria-label={label}
                          type="range"
                          min="0"
                          max="1"
                          step=".01"
                          value={activeMaterial[key]}
                          onChange={(e) =>
                            changeMaterial(activeMaterial, key, Number(e.target.value))
                          }
                        />
                      </label>
                    ),
                )}
                <button className="button wide" onClick={assignTexture} disabled={busy}>
                  <ImagePlus size={14} />
                  {t.texture}
                </button>
                <button
                  className="button primary wide"
                  disabled={
                    busy ||
                    !activeMesh.geometry.getAttribute(
                      activeMaterial.map?.channel ? `uv${activeMaterial.map.channel}` : 'uv',
                    )
                  }
                  title={
                    activeMesh.geometry.getAttribute(
                      activeMaterial.map?.channel ? `uv${activeMaterial.map.channel}` : 'uv',
                    )
                      ? t.surface
                      : t.surfaceNoUV
                  }
                  onClick={() =>
                    setSurface({
                      object: selected,
                      mesh: activeMesh,
                      material: activeMaterial,
                      materialIndex: materials.indexOf(activeMaterial),
                    })
                  }
                >
                  <Layers size={14} />
                  {t.surface}
                </button>
                {activeMaterial.map && (
                  <p className="hint">
                    {activeMaterial.map.name || 'Embedded texture'} ·{' '}
                    {activeMaterial.map.image?.width} × {activeMaterial.map.image?.height}
                  </p>
                )}
              </details>
            )}
            <details className="inspector-section">
              <summary>
                {t.uv}
                <ChevronDown size={13} />
              </summary>
              <UVPreview
                mesh={activeMesh}
                material={activeMaterial}
                materialIndex={materials.indexOf(activeMaterial)}
                noUV={t.noUV}
                label={t.uvDownload}
                onExport={(blob) =>
                  task(async () => {
                    if (blob)
                      await saveFile({
                        name: `${safeName(selected.name)}-uv.png`,
                        bytes: new Uint8Array(await blob.arrayBuffer()),
                        kind: 'image',
                      });
                  })
                }
              />
            </details>
            <div className="export-block">
              <span>{t.export}</span>
              <div>
                <button className="button" disabled={busy} onClick={() => exportFormat('glb')}>
                  GLB
                </button>
                <button className="button" disabled={busy} onClick={() => exportFormat('obj')}>
                  OBJ
                </button>
                <button className="button" disabled={busy} onClick={() => exportFormat('json')}>
                  JSON
                </button>
                <button
                  className="icon-button"
                  disabled={busy}
                  aria-label="Screenshot"
                  title="Screenshot"
                  onClick={screenshot}
                >
                  <Camera size={15} />
                </button>
              </div>
              <p>{t.notice}</p>
            </div>
          </>
        ) : (
          <div className="inspector-empty">
            <Scaling size={25} />
            <p>{t.select}</p>
            <div>
              <span>01</span>
              {t.import} {t.model}
            </div>
            <div>
              <span>02</span>
              {t.material} + UV
            </div>
            <div>
              <span>03</span>
              {t.export} GLB
            </div>
          </div>
        )}
      </aside>
      {toast && (
        <div className="studio-toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
      {surface && (
        <SurfaceDesigner
          {...surface}
          locale={locale}
          onApply={applySurface}
          onClose={() => setSurface(null)}
        />
      )}
    </div>
  );
});
export default SceneStudio;

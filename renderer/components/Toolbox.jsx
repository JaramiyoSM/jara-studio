import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Car,
  Image as ImageIcon,
  Package,
  Map as MapIcon,
  FolderOpen,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Layers,
  Trash2,
  Plus,
  ChevronRight,
  Save,
  Info,
} from 'lucide-react';
import { openFiles, saveFile, setUnsaved } from '../lib/desktop.js';
import {
  HANDLING_FIELDS,
  inspectHandling,
  editHandling,
  handlingPreset,
  handlingExample,
  packHandling,
} from '../lib/toolbox-handling.js';
import { validateResourceFiles, resourceManifest, packResource } from '../lib/toolbox-resource.js';
import { createTextureClient } from '../lib/toolbox-texture-client.js';
import { channelPixels, mipTable, safeTextureName } from '../lib/toolbox-textures.js';
import MapStudio from './ToolboxMap.jsx';
import './toolbox.css';
const bytesText = (value) =>
  value >= 1048576
    ? `${(value / 1048576).toFixed(1)} MB`
    : value >= 1024
      ? `${(value / 1024).toFixed(1)} KB`
      : `${value} B`;
const uid = () => crypto.randomUUID();
const localFile = (value) =>
  new File([value.data], value.name, {
    type: /\.png$/i.test(value.name)
      ? 'image/png'
      : /\.jpe?g$/i.test(value.name)
        ? 'image/jpeg'
        : /\.webp$/i.test(value.name)
          ? 'image/webp'
          : 'application/octet-stream',
  });
const NOTE = ({ children }) => (
  <div className="tb-note">
    <Info size={15} />
    <span>{children}</span>
  </div>
);
function WorkspaceTitle({ icon: Icon, title, children, actions }) {
  return (
    <div className="tb-title">
      <div className="tb-title-icon">
        <Icon size={23} />
      </div>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      <div className="tb-title-actions">{actions}</div>
    </div>
  );
}
function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="tb-empty">
      <Icon size={42} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export default function Toolbox({ locale = 'es', onStatus = () => {} }) {
  const en = locale === 'en',
    t = (es, english) => (en ? english : es),
    [tab, setTab] = useState('handling'),
    [status, setStatus] = useState('');
  const notify = (message) => {
    setStatus(message);
    onStatus(message);
  };
  const tools = [
    ['handling', Car, 'Handling', 'XML · multi-car'],
    ['textures', ImageIcon, t('Texturas', 'Textures'), 'DDS · YTD · RGBA'],
    ['maps', MapIcon, 'Map Studio', t('Zonas · postales', 'Zones · postals')],
    ['resource', Package, t('Recursos', 'Resources'), 'Native · ZIP'],
  ];
  return (
    <section className="toolbox" aria-label={t('Herramientas de recursos', 'Resource tools')}>
      <header className="tb-navigation">
        <div className="tb-navigation-title">
          <SlidersHorizontal size={19} />
          <span>{t('Mesa de trabajo', 'Workbench')}</span>
          <small>{t('Archivos locales. Tu control.', 'Local files. Your control.')}</small>
        </div>
        <div className="tb-tabs" role="tablist" aria-label={t('Herramientas', 'Tools')}>
          {tools.map(([id, Icon, title, subtitle]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              aria-controls={`toolbox-${id}`}
              id={`toolbox-tab-${id}`}
              onClick={() => {
                setTab(id);
                setStatus('');
              }}
            >
              <Icon size={19} />
              <span>
                {title}
                <small>{subtitle}</small>
              </span>
            </button>
          ))}
        </div>
      </header>
      <div className="tb-workspace">
        {tools.map(([id]) => (
          <div
            key={id}
            role="tabpanel"
            id={`toolbox-${id}`}
            aria-labelledby={`toolbox-tab-${id}`}
            hidden={tab !== id}
          >
            {id === 'handling' ? (
              <HandlingStudio en={en} notify={notify} />
            ) : id === 'textures' ? (
              <TextureStudio en={en} notify={notify} />
            ) : id === 'maps' ? (
              <MapStudio locale={locale} onStatus={notify} />
            ) : (
              <ResourceStudio en={en} notify={notify} />
            )}
          </div>
        ))}
      </div>
      {status && (
        <div className="tb-status" role="status">
          <CheckCircle2 size={15} />
          {status}
        </div>
      )}
    </section>
  );
}
function HandlingStudio({ en, notify }) {
  const t = (es, english) => (en ? english : es),
    [files, setFiles] = useState([]),
    [active, setActive] = useState(''),
    [targets, setTargets] = useState(new Set()),
    [draft, setDraft] = useState({}),
    [search, setSearch] = useState(''),
    [resource, setResource] = useState('jara_handling'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    setUnsaved('handling', files.length > 0);
  }, [files.length]);
  useEffect(() => () => setUnsaved('handling', false), []);
  const cars = useMemo(
    () =>
      files.flatMap((file) =>
        inspectHandling(file.xml).map((car) => ({ ...car, key: `${file.id}:${car.index}`, file })),
      ),
    [files],
  );
  const current = cars.find((car) => car.key === active) || cars[0];
  useEffect(() => {
    setDraft(
      Object.fromEntries(
        Object.entries(current?.fields || {}).map(([key, value]) => [key, String(value.value)]),
      ),
    );
  }, [current?.key, current?.file.xml]);
  const run = async (task) => {
    setError('');
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const load = () =>
    run(async () => {
      const selected = await openFiles({ kind: 'any' });
      if (!selected.length) return;
      if (
        files.length + selected.length > 64 ||
        selected.reduce((n, file) => n + file.size, 0) > 32 * 1048576
      )
        throw Error(
          t('Máximo 64 archivos / 32 MB por importación.', 'Maximum 64 files / 32 MB per import.'),
        );
      const next = selected.map((file) => {
        if (!/\.(?:meta|xml)$/i.test(file.name))
          throw Error(t('Importa handling.meta o XML.', 'Import handling.meta or XML.'));
        const xml = new TextDecoder('utf-8', { fatal: true })
          .decode(file.data)
          .replace(/^\uFEFF/, '');
        inspectHandling(xml);
        return { id: uid(), name: file.name, xml, original: xml };
      });
      setFiles((old) => [...old, ...next]);
      setActive(`${next[0].id}:0`);
      notify(
        t(
          'Bases cargadas. Los campos originales se conservarán.',
          'Bases loaded. Original fields will be preserved.',
        ),
      );
    });
  const addExample = () => {
    const xml = handlingExample(),
      file = { id: uid(), name: 'handling-practice.meta', xml, original: xml };
    setFiles((old) => [...old, file]);
    setActive(`${file.id}:0`);
    notify(
      t(
        'Base didáctica creada; vincúlala a un vehículo propio.',
        'Learning base created; link it to your own vehicle.',
      ),
    );
  };
  const apply = () =>
    run(async () => {
      if (!current) return;
      const changes = Object.fromEntries(
        Object.entries(draft).filter(
          ([key, value]) => value.trim() === '' || Number(value) !== current.fields[key]?.value,
        ),
      );
      const xml = editHandling(current.file.xml, current.index, changes);
      setFiles((old) => old.map((file) => (file.id === current.file.id ? { ...file, xml } : file)));
      notify(
        t(
          'Cambios aplicados al vehículo seleccionado.',
          'Changes applied to the selected vehicle.',
        ),
      );
    });
  const preset = (value) =>
    run(async () => {
      const selected = targets.size ? cars.filter((car) => targets.has(car.key)) : [current];
      const changed = new Map(files.map((file) => [file.id, file.xml]));
      for (const car of selected.filter(Boolean))
        changed.set(car.file.id, handlingPreset(changed.get(car.file.id), car.index, value));
      setFiles((old) => old.map((file) => ({ ...file, xml: changed.get(file.id) })));
      notify(
        t(
          `Perfil aplicado a ${selected.length} vehículo(s). Compruébalo en FiveM.`,
          `Preset applied to ${selected.length} vehicle(s). Test it in FiveM.`,
        ),
      );
    });
  const exportXML = () =>
    run(async () => {
      if (!current) return;
      const result = await saveFile({
        name: current.file.name,
        bytes: new TextEncoder().encode(current.file.xml),
        kind: 'native',
      });
      if (!result.canceled)
        notify(t('XML guardado con todas sus entradas.', 'XML saved with all its entries.'));
    });
  const exportZIP = () =>
    run(async () => {
      const bytes = await packHandling(files, resource),
        result = await saveFile({ name: `${resource}.zip`, bytes, kind: 'archive' });
      if (!result.canceled)
        notify(t('Recurso handling listo para probar.', 'Handling resource ready to test.'));
    });
  const visible = cars.filter((car) =>
    `${car.name} ${car.file.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <WorkspaceTitle
        icon={Car}
        title="Handling Studio"
        actions={
          <>
            <button disabled={busy} onClick={load}>
              <FolderOpen size={16} />
              {t('Importar XML', 'Import XML')}
            </button>
            <button disabled={busy} onClick={addExample}>
              <Plus size={15} />
              {t('Base de práctica', 'Practice base')}
            </button>
          </>
        }
      >
        {t(
          'Edita varios coches conservando cada campo y subentrada de la base.',
          'Tune multiple vehicles while preserving every field and sub-entry in the base.',
        )}
      </WorkspaceTitle>
      {error && (
        <div className="tb-error" role="alert">
          <AlertTriangle size={17} />
          {error}
        </div>
      )}
      {!cars.length ? (
        <Empty
          icon={Car}
          title={t('Empieza con tu handling.meta', 'Start with your handling.meta')}
          action={
            <button className="tb-primary" onClick={load}>
              <FolderOpen size={16} />
              {t('Abrir bases de vehículos', 'Open vehicle bases')}
            </button>
          }
        >
          {t(
            'Importa uno o varios archivos. Los ajustes se escriben sobre el XML original; no se inventan datos de vehículos.',
            'Import one or multiple files. Edits are written into the original XML; vehicle data is never invented.',
          )}
        </Empty>
      ) : (
        <div className="tb-columns">
          <aside className="tb-panel tb-list-panel">
            <div className="tb-panel-heading">
              <h3>
                {t('Vehículos', 'Vehicles')} <small>{cars.length}</small>
              </h3>
              <button
                title={t('Vaciar mesa', 'Clear workspace')}
                onClick={() => {
                  setFiles([]);
                  setTargets(new Set());
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <input
              aria-label={t('Buscar vehículo', 'Search vehicle')}
              placeholder={t('Nombre o archivo…', 'Name or file…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="tb-item-list">
              {visible.map((car) => (
                <div
                  key={car.key}
                  className={`tb-list-item ${current?.key === car.key ? 'active' : ''}`}
                >
                  <input
                    type="checkbox"
                    aria-label={`${t('Seleccionar', 'Select')} ${car.name}`}
                    checked={targets.has(car.key)}
                    onChange={(e) =>
                      setTargets((old) => {
                        const n = new Set(old);
                        e.target.checked ? n.add(car.key) : n.delete(car.key);
                        return n;
                      })
                    }
                  />
                  <button onClick={() => setActive(car.key)}>
                    <strong>{car.name}</strong>
                    <small>{car.file.name}</small>
                  </button>
                  <ChevronRight size={13} />
                </div>
              ))}
            </div>
            <NOTE>
              {t(
                'Marca coches para aplicar un perfil a todos. Los valores personalizados solo cambian el coche activo.',
                'Check vehicles to apply a preset to all. Custom values change only the active vehicle.',
              )}
            </NOTE>
          </aside>
          <main className="tb-panel tb-fields-panel">
            <div className="tb-panel-heading">
              <div>
                <small className="tb-eyebrow">
                  {t('INSPECTOR DE VEHÍCULO', 'VEHICLE INSPECTOR')}
                </small>
                <h3>{current?.name}</h3>
              </div>
              <button
                onClick={() => {
                  setFiles((old) =>
                    old.map((file) =>
                      file.id === current.file.id ? { ...file, xml: file.original } : file,
                    ),
                  );
                  notify(
                    t(
                      'Archivo completo restaurado a su base.',
                      'Complete file restored to its base.',
                    ),
                  );
                }}
              >
                <RotateCcw size={14} />
                {t('Restaurar archivo', 'Restore file')}
              </button>
            </div>
            <div className="tb-presets">
              <span>{t('Perfil', 'Preset')}</span>
              {[
                ['street', t('Calle', 'Street')],
                ['sport', t('Deportivo', 'Sport')],
                ['drift', 'Drift'],
                ['offroad', 'Off-road'],
              ].map(([id, label]) => (
                <button key={id} disabled={busy} onClick={() => preset(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="tb-field-grid">
              {HANDLING_FIELDS.filter(([key]) => current?.fields[key]).map(
                ([key, label, unit, min, max]) => (
                  <label key={key}>
                    <span>
                      {label.split(' / ')[en ? 0 : 1]}
                      <small>{unit}</small>
                    </span>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step={key === 'nInitialDriveGears' ? 1 : 'any'}
                      value={draft[key] ?? ''}
                      onChange={(e) => setDraft((old) => ({ ...old, [key]: e.target.value }))}
                    />
                    <code>{key}</code>
                  </label>
                ),
              )}
            </div>
            <div className="tb-action-row">
              <button className="tb-primary" disabled={busy} onClick={apply}>
                <Save size={15} />
                {t('Aplicar cambios', 'Apply changes')}
              </button>
              <span>
                {t(
                  'No se modifican flags, vectores ni subhandling.',
                  'Flags, vectors and subhandling stay intact.',
                )}
              </span>
            </div>
          </main>
          <aside className="tb-panel tb-export-panel">
            <div className="tb-panel-heading">
              <h3>{t('Entrega', 'Delivery')}</h3>
              <Package size={17} />
            </div>
            <label>
              {t('Nombre del recurso', 'Resource name')}
              <input
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                maxLength={64}
              />
            </label>
            <button disabled={busy} onClick={exportXML}>
              <Download size={16} />
              {t('XML del archivo activo', 'Active file XML')}
            </button>
            <button className="tb-primary" disabled={busy} onClick={exportZIP}>
              <Package size={16} />
              {t('ZIP de todos los archivos', 'ZIP all files')}
            </button>
            <ul className="tb-check-list">
              <li>
                <CheckCircle2 size={14} />
                fxmanifest.lua
              </li>
              <li>
                <CheckCircle2 size={14} />
                HANDLING_FILE
              </li>
              <li>
                <CheckCircle2 size={14} />
                {t('XML originales editados', 'Edited original XML')}
              </li>
            </ul>
            <NOTE>
              {t(
                'La velocidad nominal no es una predicción exacta de km/h. Prueba cada perfil en tu servidor. El ZIP necesita los modelos y sus vehicles.meta.',
                'Nominal velocity is not an exact km/h prediction. Test each preset in your server. The ZIP still needs vehicle models and their vehicles.meta.',
              )}
            </NOTE>
          </aside>
        </div>
      )}
    </>
  );
}
function TexturePreview({ texture, mip, channel, before, client }) {
  const canvas = useRef(null),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setError('');
    const draw = (pixels) => {
      if (!alive) return;
      const ctx = canvas.current?.getContext('2d');
      if (!ctx) return;
      canvas.current.width = pixels.width;
      canvas.current.height = pixels.height;
      ctx.putImageData(
        new ImageData(channelPixels(pixels.pixels, channel), pixels.width, pixels.height),
        0,
        0,
      );
    };
    if (texture?._encoded && !before) {
      client
        .task('mip', texture, mip)
        .then(draw)
        .catch((e) => alive && setError(e.message));
    } else {
      const url = before ? texture?.originalPreviewUrl || texture?.previewUrl : texture?.previewUrl;
      if (!url) {
        setError(texture?.warning || 'No preview');
        return () => {
          alive = false;
        };
      }
      const image = new Image();
      image.onload = () => {
        if (!alive) return;
        const width = Math.min(512, image.naturalWidth),
          height = Math.max(1, Math.round((image.naturalHeight * width) / image.naturalWidth)),
          temp = document.createElement('canvas');
        temp.width = width;
        temp.height = height;
        const ctx = temp.getContext('2d');
        ctx.drawImage(image, 0, 0, width, height);
        draw({ width, height, pixels: ctx.getImageData(0, 0, width, height).data });
      };
      image.onerror = () => alive && setError('Preview could not be loaded.');
      image.src = url;
    }
    return () => {
      alive = false;
    };
  }, [texture?.id, texture?.previewUrl, mip, channel, before, client]);
  return (
    <div className="tb-texture-canvas">
      {error ? (
        <div className="tb-preview-error">
          <ImageIcon size={32} />
          {error}
        </div>
      ) : (
        <canvas ref={canvas} aria-label="Texture channel preview" />
      )}
    </div>
  );
}
function TextureStudio({ en, notify }) {
  const t = (es, english) => (en ? english : es),
    [textures, setTextures] = useState([]),
    [active, setActive] = useState(''),
    [selected, setSelected] = useState(new Set()),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [error, setError] = useState(''),
    [channel, setChannel] = useState('RGB'),
    [mip, setMip] = useState(0),
    [format, setFormat] = useState('BC3'),
    [size, setSize] = useState('1024'),
    [mipmaps, setMipmaps] = useState(true),
    [fit, setFit] = useState(false),
    [before, setBefore] = useState(false),
    [name, setName] = useState('jara_textures');
  useEffect(() => {
    setUnsaved('textures', textures.length > 0);
  }, [textures.length]);
  useEffect(() => () => setUnsaved('textures', false), []);
  const client = useRef(null),
    urls = useRef(new Set()),
    alive = useRef(true);
  if (!client.current) client.current = createTextureClient();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      client.current?.close();
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current.clear();
    };
  }, []);
  const current = textures.find((item) => item.id === active) || textures[0],
    chosen = textures.filter((item) => selected.has(item.id)),
    mips = current ? mipTable(current) : [];
  useEffect(() => {
    setMip(0);
    setBefore(false);
  }, [current?.id]);
  const remember = (items) => {
    for (const item of items)
      if (item.previewUrl?.startsWith('blob:')) urls.current.add(item.previewUrl);
    return items;
  };
  const run = async (task) => {
    setError('');
    setBusy(true);
    try {
      await task();
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) {
        setBusy(false);
        setProgress('');
      }
    }
  };
  const load = () =>
    run(async () => {
      const files = await openFiles({ kind: 'texture' });
      if (!files.length) return;
      if (files.length > 64 || files.reduce((n, file) => n + file.size, 0) > 256 * 1048576)
        throw Error(
          t(
            'Máximo 64 archivos y 256 MB por importación.',
            'Maximum 64 files and 256 MB per import.',
          ),
        );
      const next = [];
      try {
        for (let i = 0; i < files.length; i++) {
          setProgress(`${t('Leyendo', 'Reading')} ${i + 1}/${files.length}: ${files[i].name}`);
          next.push(
            ...remember(await client.current.task('inspectTextureFile', localFile(files[i]))),
          );
        }
        if (
          textures.length + next.length > 2048 ||
          [...textures, ...next].reduce(
            (n, item) => n + (item.rgba?.byteLength || 0) + (item.memoryBytes || 0),
            0,
          ) >
            384 * 1048576
        )
          throw Error(
            t(
              'La mesa supera 2048 texturas o 384 MB. Procesa lotes más pequeños.',
              'Workspace exceeds 2048 textures or 384 MB. Process smaller batches.',
            ),
          );
        setTextures((old) => [...old, ...next]);
        setActive(next[0]?.id || '');
        setSelected(new Set(next.map((item) => item.id)));
        notify(t(`${next.length} texturas cargadas.`, `${next.length} textures loaded.`));
      } catch (e) {
        for (const item of next) {
          URL.revokeObjectURL(item.previewUrl);
          urls.current.delete(item.previewUrl);
        }
        throw e;
      }
    });
  const optimize = () =>
    run(async () => {
      if (!chosen.length) throw Error(t('Selecciona texturas primero.', 'Select textures first.'));
      if (chosen.some((item) => !item.canOptimize))
        throw Error(
          t(
            'BC7 o formatos no compatibles se pueden conservar, pero no recodificar.',
            'BC7 or unsupported formats can be preserved, but not re-encoded.',
          ),
        );
      const replacements = new Map();
      try {
        for (let i = 0; i < chosen.length; i++) {
          setProgress(`${t('Recodificando', 'Re-encoding')} ${i + 1}/${chosen.length}`);
          const original = chosen[i],
            result = remember([
              await client.current.task('optimizeTexture', original, {
                maxSize: Number(size) || undefined,
                format,
                mipmaps,
                fitForYtd: fit,
              }),
            ])[0];
          replacements.set(original.id, {
            ...result,
            originalPreviewUrl: original.originalPreviewUrl || original.previewUrl,
          });
        }
        if (!alive.current) return;
        setTextures((old) =>
          old.map((item) => {
            const replacement = replacements.get(item.id);
            if (replacement && item.previewUrl !== replacement.originalPreviewUrl) {
              URL.revokeObjectURL(item.previewUrl);
              urls.current.delete(item.previewUrl);
            }
            return replacement || item;
          }),
        );
        setBefore(false);
        notify(
          t(
            'Solo las texturas seleccionadas se han recodificado.',
            'Only selected textures were re-encoded.',
          ),
        );
      } catch (e) {
        for (const item of replacements.values()) {
          URL.revokeObjectURL(item.previewUrl);
          urls.current.delete(item.previewUrl);
        }
        throw e;
      }
    });
  const exportPack = () =>
    run(async () => {
      if (!chosen.length)
        throw Error(t('Selecciona texturas para exportar.', 'Select textures to export.'));
      const blob = await client.current.task('exportTexturePack', chosen),
        result = await saveFile({
          name: `${safeTextureName(name)}-dds.zip`,
          bytes: blob,
          kind: 'archive',
        });
      if (!result.canceled) notify(t('DDS y XML guardados.', 'DDS and XML saved.'));
    });
  const exportYTD = () =>
    run(async () => {
      const blob = await client.current.task('createYtd', textures),
        result = await saveFile({
          name: `${safeTextureName(name)}.ytd`,
          bytes: blob,
          kind: 'native',
        });
      if (!result.canceled)
        notify(
          t(
            'Diccionario YTD guardado, incluyendo las entradas sin seleccionar.',
            'YTD dictionary saved, including unselected entries.',
          ),
        );
    });
  const exportPNG = () =>
    run(async () => {
      if (!current) return;
      const result = remember([
        await client.current.task('optimizeTexture', current, { format: 'PNG', mipmaps: false }),
      ])[0];
      try {
        const out = await saveFile({
          name: `safe-${safeTextureName(current.textureName)}.png`,
          bytes: result.blob,
          kind: 'texture',
        });
        if (!out.canceled)
          notify(t('PNG a resolución de la textura guardado.', 'Full-resolution PNG saved.'));
      } finally {
        URL.revokeObjectURL(result.previewUrl);
        urls.current.delete(result.previewUrl);
      }
    });
  const clear = () => {
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
    setTextures([]);
    setSelected(new Set());
    setActive('');
  };
  return (
    <>
      <WorkspaceTitle
        icon={ImageIcon}
        title="Texture Lab"
        actions={
          <button disabled={busy} onClick={load}>
            <FolderOpen size={16} />
            {t('Abrir texturas', 'Open textures')}
          </button>
        }
      >
        {t(
          'Inspección real de canales y mipmaps. Recodifica un lote y conserva el resto del diccionario.',
          'Inspect actual channels and mipmaps. Re-encode a batch and preserve the rest of the dictionary.',
        )}
      </WorkspaceTitle>
      {error && (
        <div className="tb-error" role="alert">
          <AlertTriangle size={17} />
          {error}
        </div>
      )}
      {progress && (
        <div className="tb-progress" role="status">
          <span className="tb-spinner" />
          {progress}
        </div>
      )}
      {!textures.length ? (
        <Empty
          icon={Layers}
          title={t('Mira lo que hay dentro de tus texturas', 'See inside your textures')}
          action={
            <button className="tb-primary" disabled={busy} onClick={load}>
              <FolderOpen size={16} />
              PNG / DDS / YTD
            </button>
          }
        >
          {t(
            'DDS 2D, imágenes y YTD Legacy RSC7 v13. El procesamiento pesado ocurre en un worker local.',
            '2D DDS, images and Legacy RSC7 v13 YTD. Heavy processing runs in a local worker.',
          )}
        </Empty>
      ) : (
        <div className="tb-columns tb-textures-layout">
          <aside className="tb-panel tb-list-panel">
            <div className="tb-panel-heading">
              <h3>
                {t('Diccionario', 'Dictionary')} <small>{textures.length}</small>
              </h3>
              <button
                disabled={busy}
                onClick={clear}
                title={t('Vaciar texturas', 'Clear textures')}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="tb-small-actions">
              <button
                disabled={busy}
                onClick={() => setSelected(new Set(textures.map((item) => item.id)))}
              >
                {t('Todas', 'All')}
              </button>
              <button disabled={busy} onClick={() => setSelected(new Set())}>
                {t('Ninguna', 'None')}
              </button>
              <small>
                {selected.size} {t('marcadas', 'selected')}
              </small>
            </div>
            <div className="tb-item-list">
              {textures.map((item) => (
                <div
                  key={item.id}
                  className={`tb-list-item ${current?.id === item.id ? 'active' : ''}`}
                >
                  <input
                    type="checkbox"
                    aria-label={`${t('Seleccionar', 'Select')} ${item.textureName || item.name}`}
                    disabled={busy}
                    checked={selected.has(item.id)}
                    onChange={(e) =>
                      setSelected((old) => {
                        const next = new Set(old);
                        e.target.checked ? next.add(item.id) : next.delete(item.id);
                        return next;
                      })
                    }
                  />
                  <button onClick={() => setActive(item.id)}>
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt="" />
                    ) : (
                      <ImageIcon size={25} />
                    )}
                    <span>
                      <strong>{item.textureName || item.name}</strong>
                      <small>
                        {item.width}×{item.height} · {item.format}
                      </small>
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </aside>
          <main className="tb-panel tb-preview-panel">
            <div className="tb-panel-heading">
              <h3>{current?.textureName || current?.name}</h3>
              <div className="tb-channel-buttons">
                {['RGB', 'R', 'G', 'B', 'A'].map((value) => (
                  <button
                    key={value}
                    className={channel === value ? 'active' : ''}
                    onClick={() => setChannel(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <TexturePreview
              texture={current}
              mip={mip}
              channel={channel}
              before={before}
              client={client.current}
            />
            <div className="tb-preview-meta">
              <span>
                {current.width} × {current.height}
              </span>
              <span>{current.format}</span>
              <span>{bytesText(current.memoryBytes || 0)} VRAM</span>
              <button
                disabled={!current.originalPreviewUrl}
                className={before ? 'active' : ''}
                onClick={() => setBefore((value) => !value)}
              >
                {t('Ver original', 'Show original')}
              </button>
            </div>
            {current.warning && <NOTE>{current.warning}</NOTE>}
            <div className="tb-mips">
              <h4>{t('Mipmaps del archivo', 'File mipmaps')}</h4>
              {mips.length ? (
                <div>
                  {mips.map((item) => (
                    <button
                      key={item.level}
                      className={mip === item.level ? 'active' : ''}
                      disabled={before || current.codec === 'BC7'}
                      onClick={() => setMip(item.level)}
                    >
                      <strong>Mip {item.level}</strong>
                      <small>
                        {item.width} × {item.height}
                      </small>
                      <small>{bytesText(item.bytes)}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p>
                  {t(
                    'La imagen original no tiene mipmaps codificados.',
                    'The source image has no encoded mipmaps.',
                  )}
                </p>
              )}
            </div>
            <NOTE>
              {t(
                'BC1 usa alfa de 1 bit. BC3 conserva alfa gradual. BC7 se conserva sin vista previa ni recodificación.',
                'BC1 has 1-bit alpha. BC3 preserves gradual alpha. BC7 is preserved without preview or re-encoding.',
              )}
            </NOTE>
          </main>
          <aside className="tb-panel tb-export-panel">
            <div className="tb-panel-heading">
              <h3>{t('Lote seleccionado', 'Selected batch')}</h3>
              <SlidersHorizontal size={17} />
            </div>
            <label>
              {t('Formato', 'Format')}
              <select
                aria-label={t('Formato', 'Format')}
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option>BC3</option>
                <option>BC1</option>
                <option>RGBA8</option>
              </select>
            </label>
            <label>
              {t('Lado máximo', 'Maximum side')}
              <select
                aria-label={t('Lado máximo', 'Maximum side')}
                value={size}
                onChange={(e) => setSize(e.target.value)}
              >
                <option value="0">{t('Conservar tamaño', 'Keep size')}</option>
                {[256, 512, 1024, 2048, 4096].map((value) => (
                  <option key={value} value={value}>
                    {value} px
                  </option>
                ))}
              </select>
            </label>
            <label className="tb-checkbox">
              <input
                type="checkbox"
                checked={mipmaps}
                onChange={(e) => setMipmaps(e.target.checked)}
              />
              {t('Generar mipmaps', 'Generate mipmaps')}
            </label>
            <label className="tb-checkbox">
              <input type="checkbox" checked={fit} onChange={(e) => setFit(e.target.checked)} />
              {t('Ajustar lados para YTD', 'Fit dimensions for YTD')}
            </label>
            <button className="tb-primary" disabled={busy || !chosen.length} onClick={optimize}>
              <SlidersHorizontal size={16} />
              {t(`Recodificar ${chosen.length}`, `Re-encode ${chosen.length}`)}
            </button>
            <hr />
            <label>
              {t('Nombre de salida', 'Output name')}
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </label>
            <button disabled={busy || !chosen.length} onClick={exportPack}>
              <Download size={16} />
              {t('DDS + XML seleccionados', 'Selected DDS + XML')}
            </button>
            <button disabled={busy || !current.canOptimize} onClick={exportPNG}>
              <ImageIcon size={16} />
              {t('PNG de textura activa', 'Active texture PNG')}
            </button>
            <button disabled={busy} onClick={exportYTD}>
              <Package size={16} />
              {t('YTD completo de la mesa', 'Entire workspace YTD')}
            </button>
            <NOTE>
              {t(
                'Exportar YTD incluye todas las entradas, sin borrar las no seleccionadas. Los nombres deben ser únicos. Solo Legacy v13, no Enhanced ni escrow.',
                'YTD export includes all entries and keeps unselected ones. Names must be unique. Legacy v13 only, not Enhanced or escrow.',
              )}
            </NOTE>
          </aside>
        </div>
      )}
    </>
  );
}
function ResourceStudio({ en, notify }) {
  const t = (es, english) => (en ? english : es),
    [files, setFiles] = useState([]),
    [resource, setResource] = useState('jara_resource'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [ack, setAck] = useState(false),
    [manifest, setManifest] = useState(false);
  useEffect(() => {
    setUnsaved('resources', files.length > 0);
  }, [files.length]);
  useEffect(() => () => setUnsaved('resources', false), []);
  const report = useMemo(() => {
    try {
      return files.length ? validateResourceFiles(files) : null;
    } catch {
      return null;
    }
  }, [files]);
  const add = async () => {
    setError('');
    setBusy(true);
    try {
      const selected = await openFiles({ kind: 'native' });
      if (!selected.length) return;
      const next = [...files, ...selected];
      validateResourceFiles(next);
      setFiles(next);
      setAck(false);
      notify(t('Cabeceras y metadatos comprobados.', 'Headers and metadata checked.'));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const pack = async () => {
    setError('');
    setBusy(true);
    try {
      const result = await packResource(files, resource),
        out = await saveFile({ name: `${resource}.zip`, bytes: result.bytes, kind: 'archive' });
      if (!out.canceled)
        notify(
          t(
            'Paquete guardado sin modificar los archivos originales.',
            'Package saved without modifying the original files.',
          ),
        );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <WorkspaceTitle
        icon={Package}
        title={t('Resource Pack · entrega nativa', 'Resource Pack · native delivery')}
        actions={
          <button disabled={busy} onClick={add}>
            <FolderOpen size={16} />
            {t('Añadir archivos', 'Add files')}
          </button>
        }
      >
        {t(
          'Valida y organiza recursos ya compilados. Genera el manifest que corresponde a los archivos presentes.',
          'Validate and organize already compiled resources. Generate the manifest matching the files actually present.',
        )}
      </WorkspaceTitle>
      {error && (
        <div className="tb-error" role="alert">
          <AlertTriangle size={17} />
          {error}
        </div>
      )}
      {!report ? (
        <Empty
          icon={Package}
          title={t(
            'De archivos nativos a un recurso ordenado',
            'From native files to an organized resource',
          )}
          action={
            <button className="tb-primary" onClick={add}>
              <FolderOpen size={16} />
              {t('Abrir archivos GTA Legacy', 'Open GTA Legacy files')}
            </button>
          }
        >
          {t(
            'YDR, YDD, YFT, YTD, YTYP, YMAP, YBN, YCD, YMT y metadatos compatibles. Los GLB deben compilarse en Blender/Sollumz antes de este paso.',
            'YDR, YDD, YFT, YTD, YTYP, YMAP, YBN, YCD, YMT and supported metadata. GLB models must be compiled in Blender/Sollumz before this step.',
          )}
        </Empty>
      ) : (
        <div className="tb-resource-layout">
          <main className="tb-panel">
            <div className="tb-panel-heading">
              <h3>
                {files.length} {t('archivos', 'files')}{' '}
                <small>{bytesText(report.totalBytes)}</small>
              </h3>
              <button
                onClick={() => {
                  setFiles([]);
                  setAck(false);
                }}
              >
                <Trash2 size={15} />
                {t('Vaciar', 'Clear')}
              </button>
            </div>
            <div className="tb-resource-table">
              <table>
                <thead>
                  <tr>
                    <th>{t('Archivo', 'File')}</th>
                    <th>{t('Destino', 'Destination')}</th>
                    <th>{t('Comprobación', 'Check')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {report.files.map((item, index) => (
                    <tr key={item.name}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{bytesText(item.bytes)}</small>
                      </td>
                      <td>
                        <code>{item.path}</code>
                      </td>
                      <td>
                        <span className="tb-verified">
                          <CheckCircle2 size={13} />
                          {item.validation}
                        </span>
                      </td>
                      <td>
                        <button
                          aria-label={`${t('Quitar', 'Remove')} ${item.name}`}
                          onClick={() => {
                            setFiles((old) => old.filter((_, i) => i !== index));
                            setAck(false);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="tb-disclosure" onClick={() => setManifest((value) => !value)}>
              <ChevronRight size={15} style={{ transform: manifest ? 'rotate(90deg)' : '' }} />
              fxmanifest.lua
            </button>
            {manifest && <pre className="tb-code">{resourceManifest(report)}</pre>}
            {report.warnings.length > 0 && (
              <div className="tb-resource-warnings">
                <h4>
                  <AlertTriangle size={15} />
                  {t('Dependencias por revisar', 'Dependencies to review')}
                </h4>
                {report.warnings.map((value, i) => (
                  <p key={i}>{value}</p>
                ))}
              </div>
            )}
            <NOTE>
              {t(
                'La cabecera RSC7 no demuestra que la malla o el rig sea válido. Prueba siempre el recurso dentro de FiveM. No se compila ni se ejecuta código.',
                'An RSC7 header does not prove the mesh or rig is valid. Always test the resource inside FiveM. No code is compiled or executed.',
              )}
            </NOTE>
          </main>
          <aside className="tb-panel tb-export-panel">
            <div className="tb-panel-heading">
              <h3>{t('Empaquetar', 'Package')}</h3>
              <Package size={18} />
            </div>
            <label>
              {t('Nombre de recurso', 'Resource name')}
              <input
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                maxLength={64}
              />
            </label>
            <ul className="tb-check-list">
              <li>
                <CheckCircle2 size={14} />
                stream/
              </li>
              <li>
                <CheckCircle2 size={14} />
                data/
              </li>
              <li>
                <CheckCircle2 size={14} />
                fxmanifest.lua
              </li>
              <li>
                <CheckCircle2 size={14} />
                validation.json
              </li>
            </ul>
            <label className="tb-checkbox">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              {t(
                'He revisado las dependencias y los permisos de estos archivos.',
                'I have reviewed file dependencies and permissions.',
              )}
            </label>
            <button className="tb-primary" disabled={!ack || busy} onClick={pack}>
              <Package size={16} />
              {t('Crear recurso ZIP', 'Create resource ZIP')}
            </button>
            <NOTE>
              {t(
                'Tus archivos permanecen en este equipo. El ZIP contiene solo tus recursos y el manifest generado.',
                'Your files stay on this computer. The ZIP contains only your resources and the generated manifest.',
              )}
            </NOTE>
          </aside>
        </div>
      )}
    </>
  );
}

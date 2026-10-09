import React, { useEffect, useRef, useState } from 'react';
import {
  Map,
  MousePointer2,
  PenLine,
  Type,
  Hand,
  Plus,
  Minus,
  Maximize2,
  FolderOpen,
  Download,
  Undo2,
  Redo2,
  Trash2,
  Lock,
  Unlock,
  Copy,
  ChevronUp,
  ChevronDown,
  Check,
  Image as ImageIcon,
  Navigation,
  Info,
  AlertTriangle,
  Square,
} from 'lucide-react';
import { openFiles, saveFile, setUnsaved } from '../lib/desktop.js';
import {
  ROAD_BOUNDS,
  exportMapJSON,
  importMapJSON,
  mapPostals,
  packPostals,
} from '../lib/toolbox-map.js';
const uid = () => crypto.randomUUID(),
  copy = (zones) =>
    zones.map((zone) => ({ ...zone, points: zone.points.map((point) => [...point]) })),
  clamp = (value) => Math.max(0, Math.min(1000, value));
export default function MapStudio({ locale = 'es', onStatus = () => {} }) {
  const t = (es, en) => (locale === 'en' ? en : es),
    [zones, setZones] = useState([]),
    [selected, setSelected] = useState(''),
    [tool, setTool] = useState('select'),
    [draft, setDraft] = useState([]),
    [zoom, setZoom] = useState(1),
    [center, setCenter] = useState([500, 500]),
    [history, setHistory] = useState({ past: [], future: [] }),
    [background, setBackground] = useState({
      url: './samples/roadmap.png',
      name: 'San Andreas · Jara cartography',
      bounds: ROAD_BOUNDS,
    }),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [showGrid, setShowGrid] = useState(false);
  const svg = useRef(null),
    container = useRef(null),
    gesture = useRef(null),
    latest = useRef(zones),
    url = useRef(null),
    alive = useRef(true),
    viewport = useRef({ zoom, center });
  latest.current = zones;
  viewport.current = { zoom, center };
  useEffect(
    () => () => {
      alive.current = false;
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  useEffect(() => {
    setUnsaved('map', zones.length > 0 || background.url.startsWith('blob:'));
  }, [zones.length, background.url]);
  useEffect(() => () => setUnsaved('map', false), []);
  const current = zones.find((zone) => zone.id === selected);
  const point = (event) => {
    const rect = svg.current.getBoundingClientRect(),
      v = viewport.current;
    return [
      clamp(v.center[0] + (((event.clientX - rect.left) / rect.width - 0.5) * 1000) / v.zoom),
      clamp(v.center[1] + (((event.clientY - rect.top) / rect.height - 0.5) * 1000) / v.zoom),
    ];
  };
  const remember = (before, after) => {
    if (JSON.stringify(before) !== JSON.stringify(after))
      setHistory((old) => ({ past: [...old.past, copy(before)].slice(-50), future: [] }));
  };
  const change = (after) => {
      remember(zones, after);
      setZones(after);
    },
    update = (id, changes) =>
      change(zones.map((zone) => (zone.id === id ? { ...zone, ...changes } : zone)));
  const undo = () => {
    if (!history.past.length) return;
    setZones(copy(history.past.at(-1)));
    setHistory((old) => ({
      past: old.past.slice(0, -1),
      future: [copy(zones), ...old.future].slice(0, 50),
    }));
  };
  const redo = () => {
    if (!history.future.length) return;
    setZones(copy(history.future[0]));
    setHistory((old) => ({
      past: [...old.past, copy(zones)].slice(-50),
      future: old.future.slice(1),
    }));
  };
  const finish = () => {
    if (draft.length < 3) return;
    const points =
        draft.length > 3 &&
        Math.hypot(draft.at(-1)[0] - draft.at(-2)[0], draft.at(-1)[1] - draft.at(-2)[1]) < 2
          ? draft.slice(0, -1)
          : draft,
      zone = {
        id: uid(),
        type: 'polygon',
        name: t(`Zona ${zones.length + 1}`, `Zone ${zones.length + 1}`),
        points,
        color: '#eda8bf',
        opacity: 0.3,
        locked: false,
      };
    change([...zones, zone]);
    setSelected(zone.id);
    setDraft([]);
    setTool('select');
  };
  useEffect(() => {
    const target = svg.current,
      wheel = (event) => {
        event.preventDefault();
        const rect = target.getBoundingClientRect(),
          v = viewport.current,
          next = Math.max(0.6, Math.min(12, v.zoom * Math.exp(-event.deltaY * 0.0012))),
          rx = (event.clientX - rect.left) / rect.width - 0.5,
          ry = (event.clientY - rect.top) / rect.height - 0.5;
        setCenter([
          v.center[0] + rx * 1000 * (1 / v.zoom - 1 / next),
          v.center[1] + ry * 1000 * (1 / v.zoom - 1 / next),
        ]);
        setZoom(next);
      };
    target.addEventListener('wheel', wheel, { passive: false });
    return () => target.removeEventListener('wheel', wheel);
  }, []);
  const down = (event) => {
    if (event.button === 1 || tool === 'pan') {
      event.preventDefault();
      svg.current.setPointerCapture(event.pointerId);
      gesture.current = {
        type: 'pan',
        x: event.clientX,
        y: event.clientY,
        center: [...center],
        zoom,
      };
      return;
    }
    if (event.button !== 0) return;
    const p = point(event);
    if (tool === 'polygon') {
      setDraft((old) => [...old, p]);
      return;
    }
    if (tool === 'label') {
      const zone = {
        id: uid(),
        type: 'label',
        name: String(3000 + zones.filter((item) => item.type === 'label').length),
        points: [p],
        color: '#ffffff',
        opacity: 1,
        locked: false,
        postal: true,
        size: 12,
      };
      change([...zones, zone]);
      setSelected(zone.id);
      setTool('select');
      return;
    }
    setSelected('');
  };
  const startMove = (event, id, index) => {
    if (tool !== 'select') return;
    event.stopPropagation();
    const zone = zones.find((z) => z.id === id);
    setSelected(id);
    if (zone.locked) return;
    svg.current.setPointerCapture(event.pointerId);
    gesture.current = {
      type: index === undefined ? 'move' : 'vertex',
      id,
      index,
      origin: point(event),
      before: copy(zones),
    };
  };
  const move = (event) => {
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'pan') {
      const rect = svg.current.getBoundingClientRect();
      setCenter([
        g.center[0] - ((event.clientX - g.x) * 1000) / rect.width / g.zoom,
        g.center[1] - ((event.clientY - g.y) * 1000) / rect.height / g.zoom,
      ]);
      return;
    }
    const p = point(event);
    setZones(
      g.before.map((zone) => {
        if (zone.id !== g.id) return zone;
        if (g.type === 'vertex')
          return {
            ...zone,
            points: zone.points.map((value, index) => (index === g.index ? p : value)),
          };
        const dx = Math.max(
            -Math.min(...zone.points.map((q) => q[0])),
            Math.min(1000 - Math.max(...zone.points.map((q) => q[0])), p[0] - g.origin[0]),
          ),
          dy = Math.max(
            -Math.min(...zone.points.map((q) => q[1])),
            Math.min(1000 - Math.max(...zone.points.map((q) => q[1])), p[1] - g.origin[1]),
          );
        return { ...zone, points: zone.points.map((q) => [q[0] + dx, q[1] + dy]) };
      }),
    );
  };
  const up = (event) => {
    const g = gesture.current;
    if (g?.before) remember(g.before, latest.current);
    gesture.current = null;
    if (svg.current.hasPointerCapture(event.pointerId))
      svg.current.releasePointerCapture(event.pointerId);
  };
  const keys = (event) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    if (event.key === 'Enter' && tool === 'polygon') {
      event.preventDefault();
      finish();
    }
    if (event.key === 'Escape') {
      setDraft([]);
      setTool('select');
    }
    if (event.key === 'Delete' && current && !current.locked)
      change(zones.filter((zone) => zone.id !== current.id));
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
    }
  };
  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const importBackground = () =>
    run(async () => {
      const file = (await openFiles({ kind: 'texture' }))[0];
      if (!file) return;
      if (!/\.(png|jpe?g|webp)$/i.test(file.name) || file.size > 32 * 1048576)
        throw Error(t('Abre PNG/JPG/WebP de hasta 32 MB.', 'Open PNG/JPG/WebP up to 32 MB.'));
      const bitmap = await createImageBitmap(new Blob([file.data]));
      try {
        if (
          bitmap.width !== bitmap.height ||
          bitmap.width > 8192 ||
          bitmap.width * bitmap.height > 16777216
        )
          throw Error(
            t('Mapa cuadrado, máximo 16 MP / 8192 px.', 'Square map, maximum 16 MP / 8192 px.'),
          );
      } finally {
        bitmap.close();
      }
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(new Blob([file.data]));
      setBackground({ url: url.current, name: file.name, bounds: null });
      setCenter([500, 500]);
      setZoom(1);
      onStatus(
        t(
          'Imagen cargada; el GPS queda desactivado hasta calibrar coordenadas.',
          'Image loaded; GPS is disabled without verified coordinates.',
        ),
      );
    });
  const importJSON = () =>
    run(async () => {
      const file = (await openFiles({ kind: 'any' }))[0];
      if (!file) return;
      change(importMapJSON(new TextDecoder().decode(file.data)));
      setDraft([]);
      setSelected('');
      onStatus(
        t('Capas importadas; comprueba el fondo.', 'Layers imported; verify the background.'),
      );
    });
  const save = async (name, bytes, kind = 'any') => {
    const result = await saveFile({ name, bytes, kind });
    if (!result.canceled)
      onStatus(
        t(
          'Exportación guardada. Comprueba el recurso en FiveM.',
          'Export saved. Test the resource in FiveM.',
        ),
      );
  };
  const exportJSON = () =>
    run(() =>
      save(
        'jara-map-zones.json',
        new TextEncoder().encode(exportMapJSON(zones, background.bounds)),
      ),
    );
  const exportPostals = () =>
    run(() =>
      save(
        'postals.json',
        new TextEncoder().encode(JSON.stringify(mapPostals(zones, background.bounds), null, 2)),
      ),
    );
  const exportGPS = () =>
    run(async () =>
      save('jara_postals.zip', await packPostals(zones, background.bounds), 'archive'),
    );
  const exportPNG = () =>
    run(async () => {
      const image = new Image();
      image.src = background.url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const scale = canvas.width / 1000;
      for (const zone of zones) {
        ctx.save();
        ctx.globalAlpha = zone.opacity;
        ctx.fillStyle = zone.color;
        ctx.strokeStyle = zone.color;
        ctx.lineWidth = 2 * scale;
        if (zone.type === 'polygon') {
          ctx.beginPath();
          zone.points.forEach((p, i) =>
            i ? ctx.lineTo(p[0] * scale, p[1] * scale) : ctx.moveTo(p[0] * scale, p[1] * scale),
          );
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = Math.min(1, zone.opacity + 0.4);
          ctx.stroke();
        } else {
          ctx.font = `600 ${(zone.size || 12) * scale}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 3 * scale;
          ctx.strokeStyle = '#171015';
          ctx.strokeText(zone.name, zone.points[0][0] * scale, zone.points[0][1] * scale);
          ctx.fillText(zone.name, zone.points[0][0] * scale, zone.points[0][1] * scale);
        }
        ctx.restore();
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw Error('PNG export failed.');
      await save('jara-map.png', blob, 'texture');
    });
  const demo = () => {
    const polygon = {
        id: uid(),
        type: 'polygon',
        name: t('Ruta Jara', 'Jara route'),
        points: [
          [599, 632],
          [648, 596],
          [705, 604],
          [722, 666],
          [676, 719],
          [602, 695],
        ],
        color: '#eda8bf',
        opacity: 0.28,
        locked: false,
      },
      label = {
        id: uid(),
        type: 'label',
        name: '3030',
        points: [[655, 657]],
        color: '#ffffff',
        opacity: 1,
        postal: true,
        size: 12,
        locked: false,
      };
    change([...zones, polygon, label]);
    setSelected(polygon.id);
    setTool('select');
    setZoom(2.2);
    setCenter([642, 666]);
  };
  const reorder = (direction) => {
    const index = zones.findIndex((zone) => zone.id === selected),
      other = index + direction;
    if (other < 0 || other >= zones.length) return;
    const next = [...zones];
    [next[index], next[other]] = [next[other], next[index]];
    change(next);
  };
  const tools = [
    ['select', MousePointer2, t('Seleccionar', 'Select')],
    ['polygon', PenLine, t('Dibujar zona', 'Draw zone')],
    ['label', Type, t('Postal / etiqueta', 'Postal / label')],
    ['pan', Hand, t('Mover vista', 'Pan view')],
  ];
  return (
    <div className="tb-map-studio" onKeyDown={keys} tabIndex={-1}>
      <div className="tb-title">
        <div className="tb-title-icon">
          <Map size={23} />
        </div>
        <div>
          <h2>Map Studio</h2>
          <p>
            {t(
              'Cartografía, polígonos y postales. Del boceto al recurso GPS.',
              'Cartography, polygons and postals. From sketch to GPS resource.',
            )}
          </p>
        </div>
        <div className="tb-title-actions">
          <button onClick={importBackground} disabled={busy}>
            <FolderOpen size={15} />
            {t('Mapa propio', 'Own map')}
          </button>
          <button onClick={demo}>
            <Plus size={15} />
            {t('Probar una zona', 'Try a zone')}
          </button>
        </div>
      </div>
      {error && (
        <div className="tb-error" role="alert">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}
      <div className="tb-map-layout" ref={container}>
        <aside className="tb-panel tb-map-layers">
          <div className="tb-panel-heading">
            <h3>
              {t('Capas', 'Layers')} <small>{zones.length}</small>
            </h3>
            <button onClick={importJSON} title={t('Importar capas JSON', 'Import JSON layers')}>
              <FolderOpen size={15} />
            </button>
          </div>
          <div className="tb-map-background">
            <ImageIcon size={18} />
            <div>
              <strong>{background.name}</strong>
              <small>
                {background.bounds
                  ? t('Coordenadas de referencia', 'Reference coordinates')
                  : t('Imagen sin calibrar', 'Uncalibrated image')}
              </small>
            </div>
          </div>
          <div className="tb-item-list">
            {[...zones].reverse().map((zone) => (
              <div key={zone.id} className={`tb-list-item ${selected === zone.id ? 'active' : ''}`}>
                <button onClick={() => setSelected(zone.id)}>
                  {zone.type === 'polygon' ? (
                    <Square size={16} color={zone.color} />
                  ) : (
                    <Type size={16} />
                  )}
                  <span>
                    <strong>{zone.name}</strong>
                    <small>
                      {zone.type === 'polygon'
                        ? `${zone.points.length} ${t('vértices', 'vertices')}`
                        : zone.postal
                          ? 'GPS'
                          : t('Etiqueta', 'Label')}
                    </small>
                  </span>
                </button>
                <button
                  aria-label={`${zone.locked ? t('Desbloquear', 'Unlock') : t('Bloquear', 'Lock')} ${zone.name}`}
                  onClick={() => update(zone.id, { locked: !zone.locked })}
                >
                  {zone.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
              </div>
            ))}
          </div>
          {!zones.length && (
            <p className="tb-map-empty-label">
              {t('Traza una zona o coloca una postal.', 'Draw a zone or place a postal.')}
            </p>
          )}
          <div className="tb-map-layer-actions">
            <button
              disabled={!current || current.locked}
              onClick={() => {
                const zone = {
                  ...current,
                  id: uid(),
                  name: `${current.name} copy`,
                  points: current.points.map((p) => [clamp(p[0] + 10), clamp(p[1] + 10)]),
                };
                change([...zones, zone]);
                setSelected(zone.id);
              }}
              title={t('Duplicar capa', 'Duplicate layer')}
            >
              <Copy size={14} />
            </button>
            <button
              disabled={!current}
              onClick={() => reorder(1)}
              title={t('Subir capa', 'Raise layer')}
            >
              <ChevronUp size={14} />
            </button>
            <button
              disabled={!current}
              onClick={() => reorder(-1)}
              title={t('Bajar capa', 'Lower layer')}
            >
              <ChevronDown size={14} />
            </button>
            <button
              disabled={!current || current.locked}
              onClick={() => change(zones.filter((zone) => zone.id !== selected))}
              title={t('Borrar capa', 'Delete layer')}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="tb-note">
            <Info size={14} />
            <span>
              {t(
                'Cartografía original de San Andreas, dibujada a partir de coordenadas de carreteras. No incluye texturas extraídas de GTA.',
                'Original San Andreas cartography drawn from road coordinates. No extracted GTA textures.',
              )}
            </span>
          </div>
        </aside>
        <main className="tb-map-canvas-panel">
          <div className="tb-map-toolbar">
            <div>
              {tools.map(([id, Icon, label]) => (
                <button
                  key={id}
                  className={tool === id ? 'active' : ''}
                  aria-label={label}
                  title={label}
                  onClick={() => {
                    setTool(id);
                    setDraft([]);
                  }}
                >
                  <Icon size={17} />
                </button>
              ))}
            </div>
            <div>
              <button onClick={undo} disabled={!history.past.length} title={t('Deshacer', 'Undo')}>
                <Undo2 size={15} />
              </button>
              <button onClick={redo} disabled={!history.future.length} title={t('Rehacer', 'Redo')}>
                <Redo2 size={15} />
              </button>
              <button
                onClick={() => container.current?.requestFullscreen?.()}
                title={t('Pantalla completa', 'Full screen')}
              >
                <Maximize2 size={15} />
              </button>
            </div>
          </div>
          <div className="tb-map-viewport">
            <svg
              ref={svg}
              viewBox={`${center[0] - 500 / zoom} ${center[1] - 500 / zoom} ${1000 / zoom} ${1000 / zoom}`}
              preserveAspectRatio="none"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onDoubleClick={() => tool === 'polygon' && finish()}
              style={{
                cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair',
              }}
              role="img"
              aria-label={t('Lienzo de mapa editable', 'Editable map canvas')}
            >
              <defs>
                <pattern id="tb-map-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#ffffff20" strokeWidth=".5" />
                </pattern>
              </defs>
              <rect x="-5000" y="-5000" width="10000" height="10000" fill="#10191c" />
              <image href={background.url} width="1000" height="1000" />
              {showGrid && <rect width="1000" height="1000" fill="url(#tb-map-grid)" />}
              {zones.map((zone) =>
                zone.type === 'polygon' ? (
                  <polygon
                    key={zone.id}
                    points={zone.points.map((p) => p.join(',')).join(' ')}
                    fill={zone.color}
                    fillOpacity={zone.opacity}
                    stroke={selected === zone.id ? '#ffffff' : zone.color}
                    strokeWidth={1.5 / zoom}
                    onPointerDown={(event) => startMove(event, zone.id)}
                  />
                ) : (
                  <g key={zone.id} onPointerDown={(event) => startMove(event, zone.id)}>
                    <circle
                      cx={zone.points[0][0]}
                      cy={zone.points[0][1]}
                      r={4 / zoom}
                      fill={zone.color}
                    />
                    <text
                      x={zone.points[0][0]}
                      y={zone.points[0][1]}
                      fontSize={zone.size || 12}
                      fontFamily="Arial"
                      fontWeight="600"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={zone.color}
                      fillOpacity={zone.opacity}
                      stroke="#171015"
                      strokeWidth={2 / zoom}
                      paintOrder="stroke"
                    >
                      {zone.name}
                    </text>
                  </g>
                ),
              )}
              {current?.type === 'polygon' &&
                !current.locked &&
                tool === 'select' &&
                current.points.map((p, index) => (
                  <circle
                    key={index}
                    cx={p[0]}
                    cy={p[1]}
                    r={3.7 / zoom}
                    fill="#f9e3eb"
                    stroke="#522637"
                    strokeWidth={1 / zoom}
                    onPointerDown={(event) => startMove(event, current.id, index)}
                  />
                ))}
              {draft.length > 0 && (
                <>
                  <polyline
                    points={draft.map((p) => p.join(',')).join(' ')}
                    fill="none"
                    stroke="#eda8bf"
                    strokeWidth={1.5 / zoom}
                    strokeDasharray={`${5 / zoom} ${3 / zoom}`}
                  />
                  {draft.map((p, index) => (
                    <circle
                      key={index}
                      cx={p[0]}
                      cy={p[1]}
                      r={3.5 / zoom}
                      fill="#eda8bf"
                      onPointerDown={(event) => {
                        if (index === 0 && draft.length >= 3) {
                          event.stopPropagation();
                          finish();
                        }
                      }}
                    />
                  ))}
                </>
              )}
            </svg>
            <div className="tb-map-hint">
              {tool === 'polygon'
                ? t(
                    'Clic: puntos · Enter: cerrar · Esc: cancelar',
                    'Click: points · Enter: close · Esc: cancel',
                  )
                : tool === 'label'
                  ? t('Clic para colocar la postal', 'Click to place a postal')
                  : t(
                      'Rueda: zoom · Arrastra: editar · Botón central: mover',
                      'Wheel: zoom · Drag: edit · Middle button: pan',
                    )}
            </div>
            {tool === 'polygon' && draft.length >= 3 && (
              <button className="tb-map-finish tb-primary" onClick={finish}>
                <Check size={15} />
                {t('Cerrar zona', 'Close zone')}
              </button>
            )}
          </div>
          <div className="tb-map-bottom">
            <span>{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((value) => Math.max(0.6, value / 1.25))}
              aria-label={t('Alejar', 'Zoom out')}
            >
              <Minus size={13} />
            </button>
            <button
              onClick={() => setZoom((value) => Math.min(12, value * 1.25))}
              aria-label={t('Acercar', 'Zoom in')}
            >
              <Plus size={13} />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setCenter([500, 500]);
              }}
            >
              {t('Encuadrar', 'Fit')}
            </button>
            <label>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              {t('Cuadrícula', 'Grid')}
            </label>
          </div>
        </main>
        <aside className="tb-panel tb-map-inspector">
          <div className="tb-panel-heading">
            <h3>{t('Inspector', 'Inspector')}</h3>
            {current?.locked && <Lock size={15} />}
          </div>
          {current ? (
            <>
              <label>
                {t('Nombre / código', 'Name / code')}
                <input
                  disabled={current.locked}
                  value={current.name}
                  maxLength={100}
                  onChange={(e) => update(current.id, { name: e.target.value })}
                />
              </label>
              <label>
                {t('Color', 'Color')}
                <input
                  disabled={current.locked}
                  type="color"
                  value={current.color}
                  onChange={(e) => update(current.id, { color: e.target.value })}
                />
              </label>
              <label>
                {t('Opacidad', 'Opacity')}
                <input
                  disabled={current.locked}
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={current.opacity}
                  onChange={(e) => update(current.id, { opacity: Number(e.target.value) })}
                />
                <small>{Math.round(current.opacity * 100)}%</small>
              </label>
              {current.type === 'label' ? (
                <>
                  <label className="tb-checkbox">
                    <input
                      type="checkbox"
                      disabled={current.locked}
                      checked={!!current.postal}
                      onChange={(e) => update(current.id, { postal: e.target.checked })}
                    />
                    {t('Postal GPS', 'GPS postal')}
                  </label>
                  <label>
                    {t('Tamaño de texto', 'Text size')}
                    <input
                      type="number"
                      disabled={current.locked}
                      min="3"
                      max="60"
                      value={current.size || 12}
                      onChange={(e) => {
                        const size = Number(e.target.value);
                        if (size >= 3 && size <= 60) update(current.id, { size });
                      }}
                    />
                  </label>
                </>
              ) : (
                <details>
                  <summary>
                    {t('Vértices precisos', 'Precise vertices')} · {current.points.length}
                  </summary>
                  <div className="tb-map-point-fields">
                    {current.points.map((p, index) => (
                      <div key={index}>
                        <small>{index + 1}</small>
                        {p.map((value, axis) => (
                          <input
                            key={axis}
                            type="number"
                            min="0"
                            max="1000"
                            step=".1"
                            disabled={current.locked}
                            aria-label={`Vertex ${index + 1} ${axis ? 'Y' : 'X'}`}
                            value={Math.round(value * 10) / 10}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (Number.isFinite(n) && n >= 0 && n <= 1000)
                                update(current.id, {
                                  points: current.points.map((p, i) =>
                                    i === index ? p.map((v, j) => (j === axis ? n : v)) : p,
                                  ),
                                });
                            }}
                          />
                        ))}
                        <button
                          disabled={current.locked || current.points.length <= 3}
                          aria-label={`Delete vertex ${index + 1}`}
                          onClick={() =>
                            update(current.id, {
                              points: current.points.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <p className="tb-map-empty-label">
              {t('Selecciona una capa para editarla.', 'Select a layer to edit it.')}
            </p>
          )}
          <hr />
          <h4>{t('Exportar', 'Export')}</h4>
          <button disabled={busy} onClick={exportPNG}>
            <ImageIcon size={15} />
            {t('Mapa PNG completo', 'Complete map PNG')}
          </button>
          <button disabled={busy || !zones.length} onClick={exportJSON}>
            <Download size={15} />
            {t('Zonas JSON', 'Zones JSON')}
          </button>
          <button disabled={busy || !background.bounds} onClick={exportPostals}>
            <Navigation size={15} />
            Postals JSON
          </button>
          <button className="tb-primary" disabled={busy || !background.bounds} onClick={exportGPS}>
            <Navigation size={15} />
            {t('Recurso /jaragps', '/jaragps resource')}
          </button>
          <div className="tb-note">
            <Info size={14} />
            <span>
              {t(
                'PNG exporta imagen; GPS exporta lógica. Para sustituir el radar, prepara sus tiles YTD aparte.',
                'PNG exports an image; GPS exports logic. To replace native radar, prepare its YTD tiles separately.',
              )}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

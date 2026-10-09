import React, { useRef, useState, useEffect, lazy, Suspense } from 'react';
import {
  Box,
  Shirt,
  Car,
  PersonStanding,
  Package,
  Crosshair,
  Wrench,
  Save,
  FolderOpen,
  Upload,
  Download,
  ChevronDown,
  BookOpen,
  ArrowUpRight,
  Menu,
  HardDrive,
} from 'lucide-react';
import SceneStudio from './components/SceneStudio.jsx';
import { openExternal, runtimeVersion } from './lib/desktop.js';
import { version as appVersion } from '../package.json';
import './styles.css';
const Toolbox = lazy(() => import('./components/Toolbox.jsx'));
const labels = {
  es: {
    scene: 'Escena',
    clothing: 'Ropa',
    vehicles: 'Vehículos',
    peds: 'Peds',
    props: 'Props',
    weapons: 'Armas',
    tools: 'Utilidades',
    file: 'Archivo',
    new: 'Nueva escena',
    open: 'Abrir proyecto',
    save: 'Guardar proyecto',
    recover: 'Recuperar sesión',
    import: 'Importar modelos',
    export: 'Exportar escena',
    guide: 'Guía de trabajo',
    ready: 'Listo para crear',
    version: 'Vista previa',
    local: 'Tus archivos se procesan en este equipo',
    guideTitle: 'Un estudio para crear recursos',
    guideIntro:
      'Jara Studio reúne la preparación de modelos 3D y recursos FiveM en un espacio local. Empieza con un ejemplo o importa tus archivos.',
    guideSteps: [
      'Importa GLB, glTF, OBJ + MTL, FBX o STL. Incluye las imágenes referenciadas en la misma selección.',
      'Selecciona objetos en el árbol o directamente sobre la malla. Usa W, E y R para mover, rotar y escalar; F encuadra.',
      'Inspecciona mallas y materiales. En Diseñar ropa / livery pinta sobre las UV, añade texto o imágenes y aplica la textura con vista 3D. Reproduce clips de animación existentes.',
      'Guarda un proyecto .jara para conservar la escena, texturas y originales. El guardado de recuperación se realiza cada 45 segundos cuando hay cambios.',
      'Exporta GLB para continuar en Blender / Sollumz. OBJ contiene geometría y coordenadas UV; no incorpora materiales ni texturas.',
      'En Utilidades prepara handling.meta, texturas, manifiestos y postales. Revisa el recurso y pruébalo en tu servidor FiveM.',
    ],
    guideLimit:
      'Esta versión prepara escenas y recursos. No compila YDR/YDD, no modifica topología ni realiza retopología o rigging automático GTA.',
    close: 'Volver al estudio',
    docs: 'Documentación completa',
    discord: 'Comunidad Jaramiyo',
  },
  en: {
    scene: 'Scene',
    clothing: 'Clothing',
    vehicles: 'Vehicles',
    peds: 'Peds',
    props: 'Props',
    weapons: 'Weapons',
    tools: 'Utilities',
    file: 'File',
    new: 'New scene',
    open: 'Open project',
    save: 'Save project',
    recover: 'Recover session',
    import: 'Import models',
    export: 'Export scene',
    guide: 'Workflow guide',
    ready: 'Ready to create',
    version: 'Preview',
    local: 'Your files are processed on this computer',
    guideTitle: 'A workspace for resource creation',
    guideIntro:
      'Jara Studio brings 3D model preparation and FiveM resources into one local workspace. Start with a sample or import your own files.',
    guideSteps: [
      'Import GLB, glTF, OBJ + MTL, FBX or STL. Include referenced images in the same file selection.',
      'Select objects in the tree or on a mesh. Use W, E and R to move, rotate and scale; F frames the selection.',
      'Inspect meshes and materials. Design clothing / livery paints on UVs, adds text and image layers, and applies textures with a 3D preview. Play existing animation clips.',
      'Save a .jara project to preserve the scene, textures and original files. Recovery saves run every 45 seconds when changes exist.',
      'Export GLB to continue in Blender / Sollumz. OBJ contains geometry and UV coordinates; materials and textures are not embedded.',
      'Use Utilities for handling.meta, textures, manifests and postals. Review the resource and test it on your FiveM server.',
    ],
    guideLimit:
      'This version prepares scenes and resources. It does not compile YDR/YDD, edit mesh topology, retopologize or automatically create GTA rigs.',
    close: 'Back to studio',
    docs: 'Full documentation',
    discord: 'Jaramiyo community',
  },
};
const sections = [
  ['scene', Box],
  ['clothing', Shirt],
  ['vehicles', Car],
  ['peds', PersonStanding],
  ['props', Package],
  ['weapons', Crosshair],
  ['tools', Wrench],
];

export default function App() {
  const [locale, setLocale] = useState(
    () =>
      (navigator.languages || [navigator.language])
        .map((l) => l.toLowerCase().split('-')[0])
        .find((l) => ['es', 'en'].includes(l)) || 'en',
  );
  const [mode, setMode] = useState('scene'),
    [status, setStatus] = useState(''),
    [guide, setGuide] = useState(false),
    [fileMenu, setFileMenu] = useState(false),
    [exportMenu, setExportMenu] = useState(false),
    [toolsMounted, setToolsMounted] = useState(false);
  const studio = useRef(null),
    guideDialog = useRef(null);
  const t = labels[locale];
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    let active = true;
    window.jaraDesktop
      ?.getLocale?.()
      .then((value) => {
        if (active && ['es', 'en'].includes(value)) setLocale(value);
      })
      .catch(() => {});
    const unsubscribe = window.jaraDesktop?.onLocale?.((value) => {
      if (active && ['es', 'en'].includes(value)) setLocale(value);
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  const changeLocale = async (value) => {
    if (!['es', 'en'].includes(value)) return;
    try {
      const saved = await window.jaraDesktop?.setLocale?.(value);
      setLocale(['es', 'en'].includes(saved) ? saved : value);
    } catch {
      setLocale(value);
      setStatus(
        value === 'es'
          ? 'Idioma cambiado para esta sesión. No se pudo guardar la preferencia.'
          : 'Language changed for this session. The preference could not be saved.',
      );
    }
  };
  useEffect(() => {
    if (!guide) return;
    const previous = document.activeElement;
    const node = guideDialog.current;
    const elements = [...node.querySelectorAll('button,a[href],input,select,[tabindex="0"]')];
    elements[0]?.focus();
    const trap = (e) => {
      if (e.key !== 'Tab' || !elements.length) return;
      const first = elements[0],
        last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', trap);
    return () => {
      node.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [guide]);
  const action = (key) => {
    if (typeof document.activeElement?.blur === 'function') document.activeElement.blur();
    setFileMenu(false);
    setExportMenu(false);
    if (key === 'help') {
      setGuide(true);
      return;
    }
    const commands = {
      import: 'importModels',
      open: 'open',
      save: 'save',
      export: 'exportGLB',
      new: 'newScene',
      recover: 'recover',
      obj: 'exportOBJ',
      screenshot: 'screenshot',
    };
    if (key !== 'help' && mode === 'tools') setMode('scene');
    setTimeout(() => studio.current?.[commands[key]]?.(), 0);
  };
  useEffect(() => {
    const event = (e) => action(e.detail);
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['s', 'o'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        action(e.key.toLowerCase() === 's' ? 'save' : 'open');
      }
      if (e.key === 'F1') {
        e.preventDefault();
        setGuide(true);
      }
      if (e.key === 'Escape') {
        setGuide(false);
        setFileMenu(false);
        setExportMenu(false);
      }
    };
    window.addEventListener('jara-command', event);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('jara-command', event);
      window.removeEventListener('keydown', key);
    };
  }, [mode]);
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setMode('scene');
          }}
        >
          <span className="brand-mark">J.</span>
          <div>
            Jara <strong>Studio</strong>
            <span>by Jaramiyo</span>
          </div>
          <small>
            {t.version} {appVersion.split('.').slice(0, 2).join('.')}
          </small>
        </a>
        <div className="header-file">
          <button
            className={`header-menu-button ${fileMenu ? 'active' : ''}`}
            onClick={() => {
              setFileMenu(!fileMenu);
              setExportMenu(false);
            }}
          >
            {t.file}
            <ChevronDown size={12} />
          </button>
          {fileMenu && (
            <div className="dropdown-menu">
              {[
                ['new', Box, t.new],
                ['open', FolderOpen, t.open],
                ['save', Save, t.save],
                ['import', Upload, t.import],
                ['recover', HardDrive, t.recover],
              ].map(([key, Icon, label]) => (
                <button key={key} onClick={() => action(key)}>
                  <Icon size={15} />
                  {label}
                  <span>{key === 'save' ? 'Ctrl+S' : key === 'open' ? 'Ctrl+O' : ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="header-actions">
          <select
            className="app-language"
            aria-label={locale === 'es' ? 'Idioma del programa' : 'Application language'}
            value={locale}
            onChange={(event) => changeLocale(event.target.value)}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
          <button
            className="icon-button"
            title={t.open}
            aria-label={t.open}
            onClick={() => action('open')}
          >
            <FolderOpen size={17} />
          </button>
          <button className="button compact" onClick={() => action('save')}>
            <Save size={14} />
            {t.save}
          </button>
          <div className="header-file">
            <button
              className="button primary compact"
              onClick={() => {
                setExportMenu(!exportMenu);
                setFileMenu(false);
              }}
            >
              <Download size={14} />
              {t.export}
              <ChevronDown size={12} />
            </button>
            {exportMenu && (
              <div className="dropdown-menu right">
                <button onClick={() => action('export')}>
                  GLB · geometry, materials, textures
                </button>
                <button onClick={() => action('obj')}>OBJ · geometry + UV</button>
                <button onClick={() => action('screenshot')}>PNG · viewport</button>
              </div>
            )}
          </div>
          <button
            className="icon-button guide-button"
            title={t.guide}
            aria-label={t.guide}
            onClick={() => setGuide(true)}
          >
            <BookOpen size={17} />
          </button>
        </div>
      </header>
      <div className="app-main">
        <nav className="mode-rail" aria-label="Workspace">
          {sections.map(([key, Icon]) => (
            <button
              key={key}
              className={mode === key ? 'active' : ''}
              onClick={() => {
                setMode(key);
                if (key === 'tools') setToolsMounted(true);
                setFileMenu(false);
                setExportMenu(false);
              }}
              title={t[key]}
              aria-label={t[key]}
              aria-current={mode === key ? 'page' : undefined}
            >
              <Icon size={21} />
              <span>{t[key]}</span>
            </button>
          ))}
          <div className="rail-spacer" />
          <button onClick={() => openExternal('https://discord.gg/TvDYptEDAj')} title={t.discord}>
            <ArrowUpRight size={20} />
            <span>Jaramiyo</span>
          </button>
        </nav>
        <div className="editor-main">
          <div className={`scene-root ${mode === 'tools' ? 'hidden' : ''}`}>
            <SceneStudio ref={studio} locale={locale} mode={mode} onStatus={setStatus} />
          </div>
          {toolsMounted && (
            <div className={`toolbox-root ${mode === 'tools' ? '' : 'hidden'}`}>
              <Suspense fallback={<div className="toolbox-loading">Loading utilities…</div>}>
                <Toolbox locale={locale} onStatus={setStatus} />
              </Suspense>
            </div>
          )}
        </div>
      </div>
      <footer className="app-status">
        <span>
          <span className="live-dot" />
          {status || t.ready}
        </span>
        <span>
          <HardDrive size={11} />
          {t.local}
          <b>JARA STUDIO {runtimeVersion || appVersion}</b>
        </span>
      </footer>
      {guide && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGuide(false);
          }}
        >
          <div className="guide-dialog" ref={guideDialog}>
            <span className="eyebrow">JARAMIYO / WORKFLOW</span>
            <h1 id="guide-title">{t.guideTitle}</h1>
            <p>{t.guideIntro}</p>
            <ol>
              {t.guideSteps.map((step, i) => (
                <li key={i}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
            <p className="guide-limit">{t.guideLimit}</p>
            <div>
              <button className="button primary" onClick={() => setGuide(false)}>
                {t.close}
              </button>
              <button
                className="button"
                onClick={() =>
                  openExternal('https://jara-tools.vercel.app/#/guide?chapter=desktop')
                }
              >
                <BookOpen size={15} />
                {t.docs}
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

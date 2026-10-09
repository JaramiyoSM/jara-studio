import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Package,
  FolderOpen,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Info,
  Download,
  Car,
  Shirt,
  Box,
  PersonStanding,
  Crosshair,
  Map,
  Image,
  FileCheck2,
  ListChecks,
} from 'lucide-react';
import { openFiles, saveFile, setUnsaved } from '../lib/desktop.js';
import {
  RESOURCE_PROFILES,
  validateResourceFiles,
  resourceManifest,
  packResource,
  resourceWorkflowSteps,
  inspectResourceDictionaries,
} from '../lib/toolbox-resource.js';
import { createTextureClient } from '../lib/toolbox-texture-client.js';
import './resource-pack.css';

const ICONS = {
  generic: Package,
  vehicle: Car,
  livery: Image,
  clothing: Shirt,
  'clothing-replace': Shirt,
  prop: Box,
  ped: PersonStanding,
  weapon: Crosshair,
  map: Map,
};
const bytesText = (value) =>
  value >= 1048576
    ? `${(value / 1048576).toFixed(1)} MB`
    : value >= 1024
      ? `${(value / 1024).toFixed(1)} KB`
      : `${value} B`;

function Note({ children }) {
  return (
    <div className="tb-note">
      <Info size={15} />
      <span>{children}</span>
    </div>
  );
}
export default function ResourceStudio({ en, notify }) {
  const t = (es, english) => (en ? english : es);
  const [files, setFiles] = useState([]);
  const [resource, setResource] = useState('jara_resource');
  const [profile, setProfile] = useState('generic');
  const [target, setTarget] = useState('');
  const [dependencies, setDependencies] = useState('');
  const [gameBuild, setGameBuild] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState(false);
  const [manifest, setManifest] = useState(false);
  const [dictionaryInspection, setDictionaryInspection] = useState(null);
  const client = useRef(null);
  const options = useMemo(
    () => ({
      profile,
      target,
      dependencies: dependencies.split(/[\s,]+/).filter(Boolean),
      gameBuild,
    }),
    [profile, target, dependencies, gameBuild],
  );
  const analysis = useMemo(() => {
    if (!files.length) return { report: null, error: '' };
    try {
      return { report: validateResourceFiles(files, options), error: '' };
    } catch (e) {
      return { report: validateResourceFiles(files), error: e.message };
    }
  }, [files, options]);
  const report = analysis.report;
  const dictionaryError = dictionaryInspection?.some((item) => item.error);
  const missingFiles = report?.readiness === 'needs-files';
  useEffect(() => {
    setUnsaved('resources', files.length > 0);
  }, [files.length]);
  useEffect(
    () => () => {
      setUnsaved('resources', false);
      client.current?.close();
    },
    [],
  );
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
  const add = () =>
    run(async () => {
      const selected = await openFiles({ kind: 'native' });
      if (!selected.length) return;
      const next = [...files, ...selected];
      validateResourceFiles(next);
      setFiles(next);
      setAck(false);
      setDictionaryInspection(null);
      notify(
        t(
          'Cabeceras y metadatos comprobados. Revisa la receta y las dependencias.',
          'Headers and metadata checked. Review the workflow and dependencies.',
        ),
      );
    });
  const inspect = () =>
    run(async () => {
      client.current ||= createTextureClient();
      const result = await inspectResourceDictionaries(files, (file) =>
        client.current.task('inspectTextureDictionary', file),
      );
      setDictionaryInspection(result);
      setAck(false);
      notify(
        result.some((item) => item.error)
          ? t(
              'Hay un diccionario inválido. Revisa el informe.',
              'An invalid dictionary was found. Review the report.',
            )
          : t(
              'Diccionarios comprobados sin modificar sus texturas.',
              'Dictionaries checked without changing their textures.',
            ),
      );
    });
  const exportReport = () =>
    run(async () => {
      const current = validateResourceFiles(files, options);
      const out = await saveFile({
        name: `${resource || 'jara_resource'}-validation.json`,
        bytes: new TextEncoder().encode(
          JSON.stringify(
            {
              ...current,
              dictionaries: dictionaryInspection,
              generator: 'Jara Studio',
              schema: 2,
              runtimeTested: false,
            },
            null,
            2,
          ),
        ),
        kind: 'document',
      });
      if (!out.canceled)
        notify(
          t(
            'Informe guardado. Los originales siguen intactos.',
            'Report saved. Originals remain intact.',
          ),
        );
    });
  const pack = () =>
    run(async () => {
      const result = await packResource(files, resource, {
        ...options,
        locale: en ? 'en' : 'es',
        ...(dictionaryInspection ? { dictionaryInspection } : {}),
      });
      const out = await saveFile({ name: `${resource}.zip`, bytes: result.bytes, kind: 'archive' });
      if (!out.canceled)
        notify(
          t(
            'Paquete guardado sin modificar los archivos originales.',
            'Package saved without modifying the original files.',
          ),
        );
    });
  const changeProfile = (value) => {
    setProfile(value);
    setAck(false);
    setError('');
  };
  const readiness = missingFiles
    ? t('Faltan archivos', 'Missing files')
    : dictionaryError
      ? t('Diccionario inválido', 'Invalid dictionary')
      : report?.issues.length
        ? t('Revisar dependencias', 'Review dependencies')
        : t('Listo para probar', 'Ready to test');
  return (
    <>
      <div className="tb-title">
        <div className="tb-title-icon">
          <Package size={23} />
        </div>
        <div>
          <h2>{t('Resource Pack · entrega nativa', 'Resource Pack · native delivery')}</h2>
          <p>
            {t(
              'De tus archivos GTA a una carpeta organizada, con receta, dependencias e informe.',
              'From your GTA files to an organized folder, with workflow, dependencies and report.',
            )}
          </p>
        </div>
        <div className="tb-title-actions">
          <button disabled={busy} onClick={add}>
            <FolderOpen size={16} />
            {t('Añadir archivos', 'Add files')}
          </button>
        </div>
      </div>
      {(error || analysis.error) && (
        <div className="tb-error" role="alert">
          <AlertTriangle size={17} />
          {error || analysis.error}
        </div>
      )}
      <section
        className="rp-recipe-panel tb-panel"
        aria-label={t('Receta del recurso', 'Resource workflow')}
      >
        <div className="tb-panel-heading">
          <h3>
            <ListChecks size={17} />
            {t('¿Qué vas a entregar?', 'What are you shipping?')}
          </h3>
          <span>{t('Los nombres y bytes se conservan', 'Names and bytes are preserved')}</span>
        </div>
        <div className="rp-recipe-grid">
          {RESOURCE_PROFILES.map((item) => {
            const Icon = ICONS[item.id];
            return (
              <button
                key={item.id}
                aria-pressed={profile === item.id}
                disabled={busy}
                onClick={() => changeProfile(item.id)}
              >
                <Icon size={18} />
                <span>{item[en ? 'en' : 'es']}</span>
              </button>
            );
          })}
        </div>
        <details className="rp-workflow-help" key={profile} open={!report}>
          <summary>{t('Pasos de esta receta', 'Workflow steps')}</summary>
          <ol>
            {resourceWorkflowSteps(profile, en ? 'en' : 'es').map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </details>
      </section>
      {!report ? (
        <div className="tb-empty rp-empty">
          <Package size={42} />
          <h3>
            {t(
              'Trae tus modelos y metadatos compilados',
              'Bring your compiled models and metadata',
            )}
          </h3>
          <p>
            {t(
              'YDR, YDD, YFT, YTD, YTYP, YMAP, YBN, YCD, YMT y metadatos compatibles. También YMAP/YTYP XML raw. Las mallas GLB/OBJ/FBX se preparan en la escena y se compilan con Blender/Sollumz antes de este paso.',
              'YDR, YDD, YFT, YTD, YTYP, YMAP, YBN, YCD, YMT and compatible metadata. Raw XML YMAP/YTYP is also accepted. Prepare GLB/OBJ/FBX meshes in the scene, then compile with Blender/Sollumz before this step.',
            )}
          </p>
          <button className="tb-primary" disabled={busy} onClick={add}>
            <FolderOpen size={16} />
            {t('Abrir archivos GTA Legacy', 'Open GTA Legacy files')}
          </button>
        </div>
      ) : (
        <div className="tb-resource-layout rp-resource-layout">
          <main className="tb-panel">
            <div className="tb-panel-heading">
              <h3>
                {files.length} {t('archivos', 'files')}{' '}
                <small>{bytesText(report.totalBytes)}</small>
              </h3>
              <button
                disabled={busy}
                onClick={() => {
                  setFiles([]);
                  setAck(false);
                  setDictionaryInspection(null);
                }}
              >
                <Trash2 size={15} />
                {t('Vaciar', 'Clear')}
              </button>
            </div>
            <div
              className="rp-readiness"
              data-state={
                missingFiles || dictionaryError
                  ? 'missing'
                  : report.issues.length
                    ? 'review'
                    : 'ready'
              }
            >
              {missingFiles || dictionaryError ? (
                <AlertTriangle size={18} />
              ) : (
                <FileCheck2 size={18} />
              )}
              <div>
                <strong>{readiness}</strong>
                <small>
                  {t(
                    'Revisión de estructura. El funcionamiento se comprueba dentro de FiveM.',
                    'Structure review. Runtime behavior must be checked inside FiveM.',
                  )}
                </small>
              </div>
            </div>
            {profile !== 'generic' && (
              <ul className="rp-required-list">
                {report.checks.map((item) => (
                  <li key={item.id} data-present={item.present}>
                    <span>
                      {item.present ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {item[en ? 'en' : 'es']}
                    </span>
                    <small>
                      {item.present
                        ? t('Presente', 'Present')
                        : item.required
                          ? t('Falta', 'Missing')
                          : t('Revisar', 'Review')}
                    </small>
                  </li>
                ))}
              </ul>
            )}
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
                          {item.validation === 'RSC7 header'
                            ? t('Cabecera RSC7', 'RSC7 header')
                            : item.validation === 'Raw XML root and syntax'
                              ? t('XML raw válido', 'Valid raw XML')
                              : t('Raíz y sintaxis XML', 'XML root and syntax')}
                        </span>
                      </td>
                      <td>
                        <button
                          disabled={busy}
                          aria-label={`${t('Quitar', 'Remove')} ${item.name}`}
                          onClick={() => {
                            setFiles((old) => old.filter((_, i) => i !== index));
                            setAck(false);
                            setDictionaryInspection(null);
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
            {report.files.some((file) => file.extension === 'ytd') && (
              <section className="rp-dictionaries">
                <div className="rp-dictionary-heading">
                  <div>
                    <h4>{t('Diccionarios de texturas', 'Texture dictionaries')}</h4>
                    <small>
                      {t(
                        'Comprueba entradas reales, mipmaps y memoria. No se recodifica.',
                        'Check actual entries, mipmaps and memory. No re-encoding.',
                      )}
                    </small>
                  </div>
                  <button disabled={busy} onClick={inspect}>
                    <FileCheck2 size={15} />
                    {busy ? t('Procesando…', 'Processing…') : t('Comprobar YTD', 'Check YTD')}
                  </button>
                </div>
                {!dictionaryInspection && (
                  <Note>
                    {t(
                      'De momento solo se ha comprobado la cabecera RSC7. Abre el diccionario para comprobar su estructura interna.',
                      'Only the RSC7 header has been checked so far. Inspect the dictionary to check its internal structure.',
                    )}
                  </Note>
                )}
                {dictionaryInspection?.map((dictionary) => (
                  <details key={dictionary.name} open={Boolean(dictionary.error)}>
                    <summary>
                      <span>{dictionary.name}</span>
                      <small>
                        {dictionary.error
                          ? t('No válido', 'Invalid')
                          : `${dictionary.textures.length} ${t('texturas', 'textures')} · ${bytesText(dictionary.resourceMemory || 0)}`}
                      </small>
                    </summary>
                    {dictionary.error ? (
                      <p className="rp-dictionary-error">{dictionary.error}</p>
                    ) : (
                      <>
                        <div className="rp-texture-entries">
                          {dictionary.textures.map((entry, i) => (
                            <div key={`${entry.name}-${i}`}>
                              <code>{entry.name}</code>
                              <span>
                                {entry.width}×{entry.height} · {entry.codec} · {entry.levels} mips
                              </span>
                            </div>
                          ))}
                        </div>
                        {dictionary.warnings.map((warning, i) => (
                          <p key={i}>{warning}</p>
                        ))}
                      </>
                    )}
                  </details>
                ))}
              </section>
            )}
            <button className="tb-disclosure" onClick={() => setManifest((value) => !value)}>
              <ChevronRight size={15} style={{ transform: manifest ? 'rotate(90deg)' : '' }} />
              fxmanifest.lua
            </button>
            {manifest && <pre className="tb-code">{resourceManifest(report)}</pre>}
            {report.issues.length > 0 && (
              <div className="tb-resource-warnings">
                <h4>
                  <AlertTriangle size={15} />
                  {t('Archivos y dependencias por revisar', 'Files and dependencies to review')}
                </h4>
                {report.issues.map((item, i) => (
                  <p key={i} data-severity={item.severity}>
                    {item[en ? 'en' : 'es']}
                  </p>
                ))}
              </div>
            )}
            <Note>
              {t(
                'No se compila ni se ejecuta código. Una cabecera o XML correcto no demuestra que la malla, el rig o sus referencias funcionen en el juego.',
                'No code is compiled or executed. A valid header or XML does not prove the mesh, rig or references work in-game.',
              )}
            </Note>
          </main>
          <aside className="tb-panel tb-export-panel rp-export-panel">
            <div className="tb-panel-heading">
              <h3>{t('Empaquetar', 'Package')}</h3>
              <Package size={18} />
            </div>
            <label>
              {t('Nombre de recurso', 'Resource name')}
              <input
                value={resource}
                disabled={busy}
                onChange={(e) => {
                  setResource(e.target.value);
                  setAck(false);
                }}
                maxLength={64}
              />
            </label>
            {profile === 'livery' && (
              <label>
                {t('Diccionario de destino (sin .ytd)', 'Target dictionary (without .ytd)')}
                <input
                  placeholder="sultanrs"
                  aria-label={t(
                    'Diccionario de destino (sin .ytd)',
                    'Target dictionary (without .ytd)',
                  )}
                  aria-describedby="rp-target-hint"
                  value={target}
                  disabled={busy}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setAck(false);
                  }}
                  maxLength={80}
                />
                <small id="rp-target-hint">
                  {t(
                    'Debe coincidir con el YTD importado y el material del vehículo.',
                    'Must match the imported YTD and the vehicle material.',
                  )}
                </small>
              </label>
            )}
            <details className="rp-advanced">
              <summary>{t('Dependencias y build', 'Dependencies and build')}</summary>
              <label>
                {t('Recursos externos', 'External resources')}
                <input
                  placeholder="my_vehicle, my_assets"
                  aria-label={t('Recursos externos', 'External resources')}
                  aria-describedby="rp-dependencies-hint"
                  value={dependencies}
                  disabled={busy}
                  onChange={(e) => {
                    setDependencies(e.target.value);
                    setAck(false);
                  }}
                  maxLength={2048}
                />
                <small id="rp-dependencies-hint">
                  {t(
                    'Solo recursos reales que deben cargar antes. Separa por comas.',
                    'Only actual resources that must load first. Separate with commas.',
                  )}
                </small>
              </label>
              <label>
                {t('Build mínima (opcional)', 'Minimum build (optional)')}
                <input
                  type="number"
                  min="1604"
                  max="99999"
                  step="1"
                  value={gameBuild}
                  disabled={busy}
                  onChange={(e) => {
                    setGameBuild(e.target.value);
                    setAck(false);
                  }}
                />
              </label>
            </details>
            <ul className="tb-check-list">
              <li>
                <CheckCircle2 size={14} />
                stream/ + data/
              </li>
              <li>
                <CheckCircle2 size={14} />
                fxmanifest.lua
              </li>
              <li>
                <CheckCircle2 size={14} />
                validation.json
              </li>
              <li>
                <CheckCircle2 size={14} />
                README.txt · {en ? 'EN' : 'ES'}
              </li>
            </ul>
            <button disabled={busy || Boolean(analysis.error)} onClick={exportReport}>
              <Download size={15} />
              {t('Guardar informe', 'Save report')}
            </button>
            <label className="tb-checkbox">
              <input
                type="checkbox"
                checked={ack}
                disabled={busy}
                onChange={(e) => setAck(e.target.checked)}
              />
              {t(
                'He revisado las dependencias y los permisos de estos archivos.',
                'I have reviewed file dependencies and permissions.',
              )}
            </label>
            <button
              className="tb-primary"
              disabled={!ack || busy || missingFiles || dictionaryError || Boolean(analysis.error)}
              onClick={pack}
            >
              <Package size={16} />
              {t('Crear recurso ZIP', 'Create resource ZIP')}
            </button>
            {(missingFiles || dictionaryError) && (
              <p className="rp-pack-hint">
                {t(
                  'Completa la receta y corrige diccionarios inválidos antes de crear el ZIP. Puedes guardar el informe.',
                  'Complete the workflow and fix invalid dictionaries before creating the ZIP. You can save the report.',
                )}
              </p>
            )}
            <Note>
              {t(
                'Archivos locales y originales intactos. Prueba el recurso antes de distribuirlo.',
                'Local files and intact originals. Test the resource before distributing it.',
              )}
            </Note>
          </aside>
        </div>
      )}
    </>
  );
}

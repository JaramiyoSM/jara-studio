const host = () => window.jaraDesktop;
export const runtimeVersion = host()?.isDesktop ? '0.1.0' : 'Browser preview';
export const isDesktop = () => Boolean(host()?.isDesktop);
export async function openFiles({ kind = 'any' } = {}) {
  if (host()) return host().openFiles({ kind });
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.oncancel = () => resolve([]);
    input.onchange = async () =>
      resolve(
        await Promise.all(
          [...input.files].map(async (file) => ({
            name: file.name,
            size: file.size,
            data: new Uint8Array(await file.arrayBuffer()),
          })),
        ),
      );
    input.click();
  });
}
export async function saveFile({ name, bytes, kind }) {
  const data =
    bytes instanceof Blob
      ? new Uint8Array(await bytes.arrayBuffer())
      : bytes instanceof ArrayBuffer
        ? new Uint8Array(bytes)
        : bytes;
  if (host()) return host().saveFile({ name, bytes: data, kind });
  const url = URL.createObjectURL(new Blob([data])),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { canceled: false, name };
}
export async function openProject() {
  if (host()) return host().openProject();
  const files = await openFiles();
  return files[0] ? { canceled: false, ...files[0] } : { canceled: true };
}
export async function saveProject({ name, bytes }) {
  const data =
    bytes instanceof Blob
      ? new Uint8Array(await bytes.arrayBuffer())
      : bytes instanceof ArrayBuffer
        ? new Uint8Array(bytes)
        : bytes;
  return host() ? host().saveProject({ name, bytes: data }) : saveFile({ name, bytes: data });
}
export async function saveRecovery(bytes) {
  return host() ? host().saveRecovery(bytes) : { saved: false };
}
export async function loadRecovery() {
  return host() ? host().loadRecovery() : null;
}
export async function clearRecovery() {
  return host() ? host().clearRecovery() : { cleared: true };
}
export async function openExternal(url) {
  if (host()) return host().openExternal(url);
  window.open(url, '_blank', 'noopener,noreferrer');
  return { opened: true };
}
const unsavedModules = new Set();
export function setUnsaved(module, dirty) {
  dirty ? unsavedModules.add(module) : unsavedModules.delete(module);
  host()
    ?.setUnsaved?.(module, Boolean(dirty))
    ?.catch(() => {});
}
window.addEventListener('beforeunload', (event) => {
  if (!host()?.isDesktop && unsavedModules.size) {
    event.preventDefault();
    event.returnValue = '';
  }
});
host()?.onCommand((command) =>
  window.dispatchEvent(new CustomEvent('jara-command', { detail: command })),
);

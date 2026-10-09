export function createTextureClient() {
  let worker = null,
    sequence = 0,
    closed = false;
  const pending = new Map();
  const fail = (message) => {
    for (const item of pending.values()) item.reject(Error(message));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return {
    task(method, ...args) {
      if (closed) return Promise.reject(Error('Texture workspace closed.'));
      if (!worker) {
        worker = new Worker(new URL('./toolbox-texture-worker.js', import.meta.url), {
          type: 'module',
        });
        worker.onmessage = ({ data }) => {
          const item = pending.get(data.id);
          if (!item) return;
          pending.delete(data.id);
          data.error ? item.reject(Error(data.error)) : item.resolve(data.result);
        };
        worker.onerror = () => fail('Texture worker stopped. Retry with fewer files.');
      }
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        try {
          worker.postMessage({ id, method, args });
        } catch (error) {
          pending.delete(id);
          reject(error);
        }
      });
    },
    close() {
      closed = true;
      fail('Texture workspace closed.');
    },
  };
}

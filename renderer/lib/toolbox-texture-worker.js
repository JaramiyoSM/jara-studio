import * as codec from './texture-codec.js';
import { mipDDS } from './toolbox-textures.js';
const METHODS = new Set([
  'inspectTextureFile',
  'optimizeTexture',
  'createYtd',
  'exportTexturePack',
  'decodeDDS',
]);
self.onmessage = async ({ data }) => {
  const { id, method, args } = data;
  try {
    if (method === 'mip') {
      const parsed = codec.decodeDDS(mipDDS(...args));
      if (!parsed.rgba) throw Error('BC7 preview is unavailable.');
      const scale = Math.min(1, 512 / Math.max(parsed.width, parsed.height)),
        width = Math.max(1, Math.round(parsed.width * scale)),
        height = Math.max(1, Math.round(parsed.height * scale)),
        source = new OffscreenCanvas(parsed.width, parsed.height),
        preview = new OffscreenCanvas(width, height);
      source
        .getContext('2d')
        .putImageData(
          new ImageData(new Uint8ClampedArray(parsed.rgba), parsed.width, parsed.height),
          0,
          0,
        );
      const ctx = preview.getContext('2d');
      ctx.drawImage(source, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height).data;
      self.postMessage({ id, result: { width, height, pixels } }, [pixels.buffer]);
      return;
    }
    if (!METHODS.has(method)) throw Error('Unknown texture operation.');
    const result = await codec[method](...args);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message || 'Texture operation failed.' });
  }
};

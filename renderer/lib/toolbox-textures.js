const specs = {
  DXT1: { code: 'DXT1', block: 8 },
  DXT3: { code: 'DXT3', block: 16 },
  DXT5: { code: 'DXT5', block: 16 },
  BC4: { code: 'ATI1', block: 8 },
  BC5: { code: 'ATI2', block: 16 },
  BC7: { code: 'DX10', block: 16 },
  A8B8G8R8: { pixel: 4, masks: [255, 65280, 16711680, 4278190080], flags: 65 },
  A8R8G8B8: { pixel: 4, masks: [16711680, 65280, 255, 4278190080], flags: 65 },
  X8R8G8B8: { pixel: 4, masks: [16711680, 65280, 255, 0], flags: 64 },
  R5G6B5: { pixel: 2, masks: [63488, 2016, 31, 0], flags: 64 },
  A1R5G5B5: { pixel: 2, masks: [31744, 992, 31, 32768], flags: 65 },
  L8: { pixel: 1, masks: [255, 0, 0, 0], flags: 131072 },
  A8: { pixel: 1, masks: [0, 0, 0, 255], flags: 2 },
};
export function mipTable(texture) {
  const spec = specs[texture.codec];
  const levels = Number(texture.levels || 1);
  if (!spec || !Number.isInteger(levels) || levels < 1 || levels > 14) return [];
  let width = texture.width,
    height = texture.height,
    offset = 0;
  return Array.from({ length: levels }, (_, level) => {
    const bytes = spec.block
      ? Math.ceil(width / 4) * Math.ceil(height / 4) * spec.block
      : width * height * spec.pixel;
    const item = { level, width, height, bytes, offset };
    offset += bytes;
    width = Math.max(1, width >> 1);
    height = Math.max(1, height >> 1);
    return item;
  });
}
export function mipDDS(texture, level) {
  const table = mipTable(texture),
    item = table[level],
    spec = specs[texture.codec],
    payload = texture._encoded || texture.allLevels;
  if (!item || !payload || payload.length < item.offset + item.bytes)
    throw Error('Mip level data is unavailable.');
  const dx10 = texture.codec === 'BC7',
    out = new Uint8Array((dx10 ? 148 : 128) + item.bytes),
    view = new DataView(out.buffer),
    put = (at, value) => view.setUint32(at, value >>> 0, true);
  put(0, 0x20534444);
  put(4, 124);
  put(8, 0x1007 | (spec.block ? 0x80000 : 8));
  put(12, item.height);
  put(16, item.width);
  put(20, spec.block ? item.bytes : item.width * spec.pixel);
  put(28, 1);
  put(76, 32);
  put(80, spec.block ? 4 : spec.flags);
  put(108, 0x1000);
  if (spec.block)
    put(
      84,
      [...spec.code].reduce((n, c, i) => n + c.charCodeAt(0) * 2 ** (8 * i), 0),
    );
  else {
    put(88, spec.pixel * 8);
    spec.masks.forEach((mask, i) => put(92 + i * 4, mask));
  }
  if (dx10) {
    put(128, 98);
    put(132, 3);
    put(140, 1);
  }
  out.set(payload.subarray(item.offset, item.offset + item.bytes), dx10 ? 148 : 128);
  return out;
}
export function channelPixels(rgba, channel = 'RGB') {
  if (
    !['RGB', 'R', 'G', 'B', 'A'].includes(channel) ||
    !rgba ||
    rgba.length % 4 ||
    rgba.length > 512 * 512 * 4
  )
    throw Error('Invalid preview channel.');
  const pixels = new Uint8ClampedArray(rgba);
  if (channel === 'RGB') return pixels;
  const component = { R: 0, G: 1, B: 2, A: 3 }[channel];
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = pixels[i + 1] = pixels[i + 2] = rgba[i + component];
    pixels[i + 3] = 255;
  }
  return pixels;
}
export function safeTextureName(value) {
  const name = String(value || 'texture')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]/g, '_')
    .replace(/^\.+/, '_')
    .slice(0, 100);
  return name || 'texture';
}

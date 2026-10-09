const NAME = /^[A-Za-z_][\w:.-]*$/;
export function decodeXML(text) {
  return String(text).replace(/&([^;]+);/g, (_, name) => {
    const known = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(known, name)) return known[name];
    const code = /^#x[\da-f]+$/i.test(name)
      ? parseInt(name.slice(2), 16)
      : /^#\d+$/.test(name)
        ? Number(name.slice(1))
        : NaN;
    if (
      !Number.isInteger(code) ||
      code < 1 ||
      code > 0x10ffff ||
      (code >= 0xd800 && code <= 0xdfff)
    )
      throw Error('Invalid XML entity.');
    return String.fromCodePoint(code);
  });
}
export function parseXML(source) {
  if (
    typeof source !== 'string' ||
    source.length > 8 * 1024 * 1024 ||
    /<!DOCTYPE|<!ENTITY/i.test(source)
  )
    throw Error('XML is too large or contains a forbidden declaration.');
  const root = { name: '#document', children: [], start: 0, end: source.length },
    stack = [root];
  const tokens =
    /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?(?:[^<>"']|"[^"]*"|'[^']*')*>/g;
  let match,
    cursor = 0,
    count = 0;
  const text = (value) => {
    if (value.includes('<') || /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/i.test(value))
      throw Error('Malformed XML text.');
    decodeXML(value);
    if (stack.length === 1 && value.trim()) throw Error('Text outside XML root.');
  };
  while ((match = tokens.exec(source))) {
    text(source.slice(cursor, match.index));
    const raw = match[0];
    cursor = tokens.lastIndex;
    if (++count > 200000) throw Error('Too many XML elements.');
    if (raw.startsWith('<!--')) {
      if (raw.slice(4, -3).includes('--')) throw Error('Malformed XML comment.');
      continue;
    }
    if (raw.startsWith('<?')) continue;
    if (raw.startsWith('<![CDATA[')) {
      if (stack.length === 1) throw Error('CDATA outside XML root.');
      continue;
    }
    if (raw.startsWith('</')) {
      const name = raw.slice(2, -1).trim();
      if (!NAME.test(name) || stack.length === 1 || stack.at(-1).name !== name)
        throw Error('Unbalanced XML element.');
      const node = stack.pop();
      node.closeStart = match.index;
      node.end = cursor;
      continue;
    }
    const self = /\/\s*>$/.test(raw),
      content = raw.slice(1, self ? raw.lastIndexOf('/') : -1),
      nm = /^([\w:.-]+)/.exec(content);
    if (!nm || !NAME.test(nm[1])) throw Error('Invalid XML element.');
    const attrs = {},
      attrSpans = {},
      tail = content.slice(nm[1].length);
    let used = 0;
    const pattern = /\s+([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g;
    let am;
    while ((am = pattern.exec(tail))) {
      if (
        tail.slice(used, am.index).trim() ||
        !NAME.test(am[1]) ||
        Object.hasOwn(attrs, am[1]) ||
        am[3].includes('<')
      )
        throw Error('Invalid XML attribute.');
      attrs[am[1]] = decodeXML(am[3]);
      const rel = am.index + am[0].indexOf(am[2]) + 1;
      attrSpans[am[1]] = {
        start: match.index + 1 + nm[1].length + rel,
        end: match.index + 1 + nm[1].length + rel + am[3].length,
      };
      used = pattern.lastIndex;
    }
    if (tail.slice(used).trim()) throw Error('Malformed XML attributes.');
    const parent = stack.at(-1),
      node = {
        name: nm[1],
        attrs,
        attrSpans,
        children: [],
        start: match.index,
        openEnd: cursor,
        end: self ? cursor : null,
        closeStart: self ? cursor : null,
        parent,
      };
    parent.children.push(node);
    if (!self) {
      stack.push(node);
      if (stack.length > 64) throw Error('XML nesting is too deep.');
    }
  }
  text(source.slice(cursor));
  if (stack.length !== 1 || root.children.length !== 1)
    throw Error('XML needs exactly one closed root.');
  return root.children[0];
}
export function child(node, name) {
  return node.children.find((item) => item.name === name);
}
export function nodeText(node, source) {
  return node
    ? decodeXML(
        source
          .slice(node.openEnd, node.closeStart)
          .replace(/<!--[\s\S]*?-->/g, '')
          .trim(),
      )
    : '';
}
export function replaceXML(source, replacements) {
  let out = source,
    last = source.length;
  for (const item of [...replacements].sort((a, b) => b.start - a.start)) {
    if (item.start < 0 || item.end < item.start || item.end > last)
      throw Error('Overlapping XML edits.');
    out = out.slice(0, item.start) + item.value + out.slice(item.end);
    last = item.start;
  }
  parseXML(out);
  return out;
}

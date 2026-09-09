import { inflateSync } from 'node:zlib';

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function requireValue(value, message) {
  if (!value) throw new Error(`PNG: ${message}`);
}
function chunks(bytes) {
  requireValue(bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'signature');
  const result = [];
  for (let offset = 8; offset < bytes.length;) {
    requireValue(offset + 12 <= bytes.length, 'truncated chunk');
    const size = bytes.readUInt32BE(offset), end = offset + size + 12;
    requireValue(end <= bytes.length, 'chunk length');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    requireValue(crc32(bytes.subarray(offset + 4, end - 4)) === bytes.readUInt32BE(end - 4), 'CRC');
    requireValue(!['acTL', 'fcTL', 'fdAT'].includes(type), 'APNG is not a sprite sheet');
    requireValue(type[0] === type[0].toLowerCase() || ['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(type), 'unknown critical chunk');
    result.push({ type, data: bytes.subarray(offset + 8, end - 4) });
    offset = end;
  }
  return result;
}
function paeth(a, b, c) {
  const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
}
function decodeRows(raw, width, height, colors) {
  let previous = Buffer.alloc(width), visible = 0;
  const indices = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    const start = y * (width + 1), filter = raw[start], row = Buffer.alloc(width);
    requireValue(filter <= 4, 'invalid filter');
    for (let x = 0; x < width; x++) {
      const a = x ? row[x - 1] : 0, b = previous[x], c = x ? previous[x - 1] : 0;
      const predictors = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)];
      row[x] = (raw[start + x + 1] + predictors[filter]) & 255;
      requireValue(row[x] < colors, 'palette index outside PLTE');
      if (row[x] !== 0) visible++;
    }
    indices.set(row, y * width);
    previous = row;
  }
  requireValue(visible > 0, 'entire sheet is transparent');
  return indices;
}
export function inspectPng(bytes, { allowPartialAlpha = false, pixels = false } = {}) {
  requireValue(bytes.length <= 16 * 1024 * 1024, 'file exceeds 16 MiB');
  const all = chunks(bytes), one = type => all.filter(c => c.type === type);
  requireValue(all[0]?.type === 'IHDR' && all.at(-1)?.type === 'IEND', 'chunk order');
  for (const type of ['IHDR', 'PLTE', 'tRNS', 'IEND']) requireValue(one(type).length === 1, `one ${type} required`);
  const head = one('IHDR')[0].data;
  requireValue(head.length === 13 && one('IEND')[0].data.length === 0, 'header/end length');
  const width = head.readUInt32BE(0), height = head.readUInt32BE(4);
  requireValue(width > 0 && height > 0 && width <= 4096 && height <= 4096, 'dimensions 1..4096');
  requireValue(head[8] === 8 && head[9] === 3, '8-bit indexed color required');
  requireValue(head[10] === 0 && head[11] === 0 && head[12] === 0, 'compression/filter/interlace');
  const palette = one('PLTE')[0].data, alpha = one('tRNS')[0].data;
  const colors = palette.length / 3;
  requireValue(Number.isInteger(colors) && colors >= 2 && colors <= 32, 'palette size 2..32');
  requireValue(alpha.length >= 1 && alpha.length <= colors && alpha[0] === 0, 'transparent index 0');
  requireValue([...alpha.subarray(1)].every(v => allowPartialAlpha ? v > 0 : v === 255), 'only index 0 may be transparent; no partial alpha without glass mode');
  const firstData = all.findIndex(c => c.type === 'IDAT'), lastData = all.findLastIndex(c => c.type === 'IDAT');
  requireValue(firstData > all.findIndex(c => c.type === 'tRNS'), 'tRNS before IDAT');
  requireValue(all.findIndex(c => c.type === 'PLTE') < all.findIndex(c => c.type === 'tRNS'), 'PLTE before tRNS');
  requireValue(all.slice(firstData, lastData + 1).every(c => c.type === 'IDAT'), 'contiguous IDAT');
  const expected = (width + 1) * height;
  const raw = inflateSync(Buffer.concat(one('IDAT').map(c => c.data)), { maxOutputLength: expected });
  requireValue(raw.length === expected, 'decoded length');
  const indices = decodeRows(raw, width, height, colors);
  if (!pixels) return { width, height, colors };
  const rgba = new Uint8Array(width * height * 4);
  indices.forEach((index, i) => { rgba.set(palette.subarray(index * 3, index * 3 + 3), i * 4); rgba[i * 4 + 3] = alpha[index] ?? 255; });
  return { width, height, colors, rgba };
}

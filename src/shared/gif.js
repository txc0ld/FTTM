/**
 * Minimal animated GIF89a encoder (no dependencies).
 * Usage:
 *   const enc = new GifEncoder(width, height);
 *   enc.addFrame(canvasOrImageData, delayMs);
 *   const blob = enc.finish();       // Blob("image/gif")
 */

export class GifEncoder {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.frames = [];
  }

  /** Add a frame. src = HTMLCanvasElement | ImageData. delay in ms. */
  addFrame(src, delay = 100) {
    let data;
    if (src instanceof ImageData) {
      data = src.data;
    } else {
      // canvas element
      data = src.getContext("2d").getImageData(0, 0, this.w, this.h).data;
    }
    this.frames.push({ data, delay });
  }

  /** Encode all frames and return a Blob. */
  finish() {
    const palette = this._palette();
    const buf = [];
    const w = (v) => buf.push(v & 0xff);
    const w16 = (v) => { w(v); w(v >> 8); };
    const ws = (s) => { for (let i = 0; i < s.length; i++) w(s.charCodeAt(i)); };

    // ── Header ──
    ws("GIF89a");

    // ── Logical Screen Descriptor ──
    w16(this.w);
    w16(this.h);
    w(0xf7); // GCT flag, 8-bit color, 256 entries
    w(0);    // bg color index
    w(0);    // pixel aspect ratio

    // ── Global Color Table (256 × RGB) ──
    for (let i = 0; i < 256; i++) {
      w(palette[i * 3]);
      w(palette[i * 3 + 1]);
      w(palette[i * 3 + 2]);
    }

    // ── NETSCAPE looping extension ──
    w(0x21); w(0xff); w(0x0b);
    ws("NETSCAPE2.0");
    w(0x03); w16(0); w(0); // loop forever
    w(0x00);

    // ── Frames ──
    for (const frame of this.frames) {
      const indices = this._quantize(frame.data, palette);

      // Graphic Control Extension
      w(0x21); w(0xf9); w(0x04);
      w(0x00); // no transparency, no disposal
      w16(Math.round(frame.delay / 10)); // delay in 1/100s
      w(0x00); // transparent color index (unused)
      w(0x00);

      // Image Descriptor
      w(0x2c);
      w16(0); w16(0);       // x, y
      w16(this.w); w16(this.h);
      w(0x00);               // no LCT, not interlaced

      // LZW image data
      const minCode = 8;
      w(minCode);
      const lzw = lzwEncode(indices, minCode);
      // Write as sub-blocks (max 255 bytes each)
      let pos = 0;
      while (pos < lzw.length) {
        const chunk = Math.min(255, lzw.length - pos);
        w(chunk);
        for (let i = 0; i < chunk; i++) w(lzw[pos++]);
      }
      w(0x00); // block terminator
    }

    w(0x3b); // GIF trailer
    return new Blob([new Uint8Array(buf)], { type: "image/gif" });
  }

  /** Build a 256-color palette from all frames using popularity. */
  _palette() {
    // Quantize colors to 5-bit (32×32×32 = 32768 buckets)
    const hist = new Uint32Array(32768);
    const colorSum = new Float64Array(32768 * 3);

    for (const frame of this.frames) {
      const d = frame.data;
      for (let i = 0; i < d.length; i += 4) {
        const ri = d[i] >> 3, gi = d[i + 1] >> 3, bi = d[i + 2] >> 3;
        const idx = (ri << 10) | (gi << 5) | bi;
        hist[idx]++;
        colorSum[idx * 3] += d[i];
        colorSum[idx * 3 + 1] += d[i + 1];
        colorSum[idx * 3 + 2] += d[i + 2];
      }
    }

    // Find top 256 buckets by popularity
    const entries = [];
    for (let i = 0; i < 32768; i++) {
      if (hist[i] > 0) entries.push(i);
    }
    entries.sort((a, b) => hist[b] - hist[a]);

    const palette = new Uint8Array(256 * 3);
    const count = Math.min(256, entries.length);
    for (let i = 0; i < count; i++) {
      const idx = entries[i];
      const c = hist[idx];
      palette[i * 3] = Math.round(colorSum[idx * 3] / c);
      palette[i * 3 + 1] = Math.round(colorSum[idx * 3 + 1] / c);
      palette[i * 3 + 2] = Math.round(colorSum[idx * 3 + 2] / c);
    }
    return palette;
  }

  /** Map RGBA pixels to palette indices. */
  _quantize(data, palette) {
    // Build lookup cache (5-bit quantized → palette index)
    const cache = new Uint8Array(32768);
    const filled = new Uint8Array(32768);

    const n = data.length / 4;
    const out = new Uint8Array(n);

    for (let i = 0; i < n; i++) {
      const p = i * 4;
      const ri = data[p] >> 3, gi = data[p + 1] >> 3, bi = data[p + 2] >> 3;
      const key = (ri << 10) | (gi << 5) | bi;

      if (filled[key]) {
        out[i] = cache[key];
        continue;
      }

      // Find nearest palette color
      let best = 0, bestDist = Infinity;
      for (let j = 0; j < 256; j++) {
        const dr = data[p] - palette[j * 3];
        const dg = data[p + 1] - palette[j * 3 + 1];
        const db = data[p + 2] - palette[j * 3 + 2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) { bestDist = dist; best = j; }
        if (dist === 0) break;
      }

      cache[key] = best;
      filled[key] = 1;
      out[i] = best;
    }
    return out;
  }
}

/** LZW compression for GIF. Returns byte array. */
function lzwEncode(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;

  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;

  // Dictionary: key = "prefix,suffix" → code
  // Use a trie-like structure with Map for speed
  let table = new Map();
  const initTable = () => {
    table.clear();
    for (let i = 0; i < clearCode; i++) table.set(i << 12 | 0xfff, i);
    nextCode = eoiCode + 1;
    codeSize = minCodeSize + 1;
  };
  initTable();

  const output = [];
  let bits = 0, bitCount = 0;

  const emit = (code) => {
    bits |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(bits & 0xff);
      bits >>= 8;
      bitCount -= 8;
    }
  };

  emit(clearCode);

  // Use prefix tracking with combined key
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const suffix = pixels[i];
    const key = prefix << 12 | suffix;

    if (table.has(key)) {
      prefix = table.get(key);
    } else {
      emit(prefix);

      if (nextCode < 4096) {
        table.set(key, nextCode);
        if (nextCode > (1 << codeSize) - 1 && codeSize < 12) codeSize++;
        nextCode++;
      } else {
        emit(clearCode);
        initTable();
      }
      prefix = suffix;
    }
  }

  emit(prefix);
  emit(eoiCode);
  if (bitCount > 0) output.push(bits & 0xff);

  return output;
}

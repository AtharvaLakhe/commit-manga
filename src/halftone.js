// Turns a GitHub avatar into a manga portrait: solid ink for the shadows, a screentone of dots for
// the mid-tones, bare paper for the lights. Runs on a canvas, returns a PNG data URL.

const cache = new Map();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function inkPortrait(avatarUrl, size = 240, cell = 4) {
  if (!avatarUrl) return null;
  const key = `${avatarUrl}|${size}|${cell}`;
  if (cache.has(key)) return cache.get(key);
  const job = (async () => {
    const src = avatarUrl + (avatarUrl.includes('?') ? '&' : '?') + `s=${size}`;
    const img = await loadImage(src);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    // luminance, then stretch the contrast between the 5th and 95th percentiles
    const lum = new Float32Array(size * size);
    for (let i = 0; i < lum.length; i++) lum[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
    const sorted = Float32Array.from(lum).sort();
    const lo = sorted[Math.floor(sorted.length * .05)], hi = sorted[Math.floor(sorted.length * .95)];
    const span = Math.max(hi - lo, .05);

    const out = document.createElement('canvas');
    out.width = out.height = size;
    const o = out.getContext('2d');
    o.fillStyle = '#fbfaf6';
    o.fillRect(0, 0, size, size);
    o.fillStyle = '#0b0b0b';
    const img2 = o.getImageData(0, 0, size, size);
    // solid ink where it's dark
    for (let i = 0; i < lum.length; i++) {
      const v = (lum[i] - lo) / span;
      if (v < .22) { img2.data[i * 4] = img2.data[i * 4 + 1] = img2.data[i * 4 + 2] = 11; }
    }
    o.putImageData(img2, 0, 0);
    // screentone dots for the middle, on a 45° grid
    const step = cell * Math.SQRT2;
    for (let gy = -size; gy < size * 2; gy += step) {
      for (let gx = -size; gx < size * 2; gx += step) {
        const x = (gx - gy) / Math.SQRT2 + size / 2, y = (gx + gy) / Math.SQRT2 - size / 2;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const v = (lum[(y | 0) * size + (x | 0)] - lo) / span;
        if (v < .22 || v > .86) continue;
        const r = cell * .62 * Math.sqrt(1 - (v - .22) / .64);
        o.beginPath();
        o.arc(x, y, r, 0, Math.PI * 2);
        o.fill();
      }
    }
    return out.toDataURL('image/png');
  })().catch(() => null);
  cache.set(key, job);
  return job;
}

import { sR } from "./utils";

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */

export const BG = "#dfff00";
export const BK = "#000000";
export const W = 1080;
export const H = 1350;
export const HEADING_FONT = "Bajern";
export const BODY_FONT = "DeptBody";
export const OBIT_FONT = "Special Elite";

/* ═══════════════════════════════════════════════
   ASSET MANAGEMENT
   ═══════════════════════════════════════════════ */

export let reaperImg = null;
export let logoImg = null;
export let fvckTaxImg = null;
export let reaperServiceImg = null;
export let fp1Img = null;
export let fp2Img = null;

let assetsPromise = null;

export function loadAssets() {
  if (assetsPromise) return assetsPromise;

  assetsPromise = (async () => {
    if (!document.getElementById("dt-fonts")) {
      const l = document.createElement("link");
      l.id = "dt-fonts";
      l.rel = "stylesheet";
      l.href =
        "https://fonts.googleapis.com/css2?family=Special+Elite&family=Rock+Salt&display=swap";
      document.head.appendChild(l);
    }
    if (!document.getElementById("dt-deptbody")) {
      const style = document.createElement("style");
      style.id = "dt-deptbody";
      style.textContent = `@font-face { font-family: "DeptBody"; src: url("https://www.deptofdeath.xyz/_next/static/media/0c8c4ded07fff55c-s.p.5c4452a7.woff2") format("woff2"); font-weight: normal; font-style: normal; }`;
      document.head.appendChild(style);
    }
    if (!document.getElementById("dt-bajern")) {
      const style = document.createElement("style");
      style.id = "dt-bajern";
      style.textContent = `@font-face { font-family: "Bajern"; src: url("https://www.deptofdeath.xyz/_next/static/media/Bajern-s.p.64e1f714.otf") format("opentype"); font-weight: normal; font-style: normal; }`;
      document.head.appendChild(style);
    }

    const imgLoad = (src) =>
      new Promise((res) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = src;
      });

    const fontP = new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        attempts++;
        Promise.all([
          document.fonts.load(`48px "${HEADING_FONT}"`),
          document.fonts.load(`48px "${BODY_FONT}"`),
          document.fonts.load(`48px "${OBIT_FONT}"`),
          document.fonts.load(`48px "Rock Salt"`),
        ]).then(() => {
          if (document.fonts.check(`48px "${HEADING_FONT}"`) || attempts > 30)
            resolve();
          else setTimeout(check, 150);
        });
      };
      setTimeout(check, 300);
    });

    const [, reaper, logo, fvckTax, reaperService, fp1, fp2] =
      await Promise.all([
        fontP,
        imgLoad("/reaper.png"),
        imgLoad("https://www.deptofdeath.xyz/images/logo.png"),
        imgLoad("/assets/FTTM OLs.png"),
        imgLoad("/assets/reaperservice.png"),
        imgLoad("/fingerprint1.png"),
        imgLoad("/fingerprint2.png"),
      ]);

    reaperImg = reaper;
    logoImg = logo;
    fvckTaxImg = fvckTax;
    reaperServiceImg = reaperService;
    fp1Img = fp1;
    fp2Img = fp2;
  })();

  return assetsPromise;
}

/* ═══════════════════════════════════════════════
   DISTRESS ENGINE
   ═══════════════════════════════════════════════ */

export function addGrain(ctx, intensity, seed) {
  const r = sR(seed),
    d = ctx.getImageData(0, 0, W, H),
    p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (r() < intensity) {
      if (p[i] < 128 && r() < 0.3) {
        p[i] = 204;
        p[i + 1] = 255;
        p[i + 2] = 0;
      } else if (p[i] >= 128 && r() < 0.5) {
        p[i] = 0;
        p[i + 1] = 0;
        p[i + 2] = 0;
      }
    }
  }
  ctx.putImageData(d, 0, 0);
}

export function addScratches(ctx, n, seed) {
  const r = sR(seed);
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    let x = r() * W,
      y = r() * H;
    const a = (r() - 0.5) * 0.6,
      len = 80 + r() * 500;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const st = 6 + Math.floor(r() * 10);
    for (let s = 0; s < st; s++) {
      x += (Math.cos(a) * len) / st + (r() - 0.5) * 4;
      y += (Math.sin(a) * len) / st + (r() - 0.5) * 4;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = r() > 0.5 ? BK : BG;
    ctx.lineWidth = 0.5 + r() * 2;
    ctx.stroke();
  }
  ctx.restore();
}

export function addSplatter(ctx, n, seed) {
  const r = sR(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const cx = r() * W,
      cy = r() * H,
      rad = 3 + r() * 22;
    ctx.fillStyle = r() > 0.4 ? BK : BG;
    ctx.globalAlpha = 0.05 + r() * 0.1;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    for (let d = 0; d < 2 + Math.floor(r() * 8); d++) {
      ctx.beginPath();
      ctx.arc(
        cx + (r() - 0.5) * rad * 6,
        cy + (r() - 0.5) * rad * 6,
        1 + r() * rad * 0.35,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
  ctx.restore();
}

export function addEdgeWear(ctx, seed) {
  const r = sR(seed);
  ctx.save();
  ctx.fillStyle = BG;
  for (let x = 0; x < W; x += 2)
    if (r() < 0.15) ctx.fillRect(x, 0, 2 + r() * 4, 1 + r() * 8);
  for (let x = 0; x < W; x += 2)
    if (r() < 0.15)
      ctx.fillRect(x, H - 1 - r() * 8, 2 + r() * 4, 1 + r() * 8);
  for (let y = 0; y < H; y += 2)
    if (r() < 0.12) ctx.fillRect(0, y, 1 + r() * 6, 2 + r() * 4);
  for (let y = 0; y < H; y += 2)
    if (r() < 0.12)
      ctx.fillRect(W - 1 - r() * 6, y, 1 + r() * 6, 2 + r() * 4);
  ctx.restore();
}

export function addHalftone(ctx, density, maxR, seed) {
  const r = sR(seed);
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = BK;
  for (let y = 0; y < H; y += 18)
    for (let x = 0; x < W; x += 18)
      if (r() < density) {
        ctx.beginPath();
        ctx.arc(
          x + r() * 18,
          y + r() * 18,
          1 + r() * maxR,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
  ctx.restore();
}

export function addStain(ctx, cx, cy, rad, seed) {
  const r = sR(seed);
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = BK;
  for (let i = 0; i < 3; i++) {
    ctx.lineWidth = 1 + r() * 3;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      const w = rad + (r() - 0.5) * rad * 0.15;
      a === 0
        ? ctx.moveTo(cx + Math.cos(a) * w, cy + Math.sin(a) * w)
        : ctx.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * w);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

export function addFoldCrease(ctx, vert, pos, seed) {
  const r = sR(seed);
  ctx.save();
  if (vert) {
    const x = W * pos;
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = BK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y < H; y += 3) ctx.lineTo(x + (r() - 0.5) * 3, y);
    ctx.stroke();
    ctx.globalAlpha = 0.03;
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let y = 0; y < H; y += 3)
      ctx.lineTo(x + 4 + (r() - 0.5) * 2, y);
    ctx.stroke();
  } else {
    const y = H * pos;
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = BK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < W; x += 3) ctx.lineTo(x, y + (r() - 0.5) * 3);
    ctx.stroke();
    ctx.globalAlpha = 0.03;
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let x = 0; x < W; x += 3)
      ctx.lineTo(x, y + 4 + (r() - 0.5) * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function addTornEdge(ctx, side, depth, seed) {
  const r = sR(seed);
  ctx.save();
  ctx.fillStyle = BG;
  ctx.beginPath();
  if (side === "bottom") {
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) ctx.lineTo(x, H - r() * depth);
    ctx.lineTo(W, H);
  } else {
    ctx.moveTo(W, 0);
    for (let y = 0; y <= H; y += 3) ctx.lineTo(W - r() * depth, y);
    ctx.lineTo(W, H);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function addDrips(ctx, x, y, w, n, seed) {
  const r = sR(seed);
  ctx.save();
  ctx.fillStyle = BK;
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < n; i++) {
    const dx = x + r() * w,
      dh = 15 + r() * 60,
      dw = 1 + r() * 3;
    ctx.fillRect(dx, y, dw, dh);
    ctx.beginPath();
    ctx.arc(dx + dw / 2, y + dh, dw * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function addTape(ctx, x, y, w, h, angle) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = BK;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent";
  ctx.globalAlpha = 1.0;
  const tGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  tGrad.addColorStop(0, "rgba(204,255,0,0.15)");
  tGrad.addColorStop(0.3, "rgba(0,0,0,0)");
  tGrad.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = tGrad;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = "rgba(204,255,0,0.05)";
  for (let i = -w / 2; i < w / 2; i += 4) ctx.fillRect(i, -h / 2, 1, h);
  ctx.restore();
}

export function applyDistress(ctx) {
  ctx.save();
  const g = ctx.createRadialGradient(
    W / 2, H / 2, W * 0.3,
    W / 2, H / 2, Math.max(W, H) * 0.85
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ═══════════════════════════════════════════════
   DRAWING HELPERS
   ═══════════════════════════════════════════════ */

export function rRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function clear(ctx) {
  ctx.clearRect(0, 0, W, H);
}

export function sLine(ctx, x1, y1, x2, y2, lw = 3) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = lw;
  ctx.strokeStyle = BK;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

export function dLine(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.setLineDash([12, 8]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 2;
  ctx.strokeStyle = BK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function dRect(ctx, x, y, w, h, lw) {
  ctx.save();
  ctx.lineJoin = "miter";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = lw * 1.5;
  ctx.shadowOffsetY = lw * 1.5;
  ctx.strokeStyle = BK;
  ctx.lineWidth = lw;
  ctx.strokeRect(x, y, w, h);
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = lw / 2;
  ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  ctx.restore();
}

export function dText(ctx, text, x, y, size, font, align = "center") {
  ctx.save();
  ctx.font = `bold ${size}px "${font}", serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = BK;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function heading(ctx, text, x, y, size, align = "center") {
  dText(ctx, text, x, y, size, HEADING_FONT, align);
}

export function body(ctx, text, x, y, size, align = "center") {
  dText(ctx, text, x, y, size, BODY_FONT, align);
}

export function dStamp(ctx, cx, cy, rad, text, text2, seed, color) {
  const col = color || BK;
  const r = sR(seed);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((r() - 0.5) * 0.25);
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 4;
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = col;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += 0.04) {
    const w = rad + (r() - 0.5) * 5;
    a === 0
      ? ctx.moveTo(Math.cos(a) * w, Math.sin(a) * w)
      : ctx.lineTo(Math.cos(a) * w, Math.sin(a) * w);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += 0.04) {
    const w = rad - 10 + (r() - 0.5) * 4;
    a === 0
      ? ctx.moveTo(Math.cos(a) * w, Math.sin(a) * w)
      : ctx.lineTo(Math.cos(a) * w, Math.sin(a) * w);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.font = `bold ${rad * 0.32}px "${BODY_FONT}", monospace`;
  ctx.fillStyle = col;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, -rad * 0.1);
  if (text2) {
    ctx.font = `bold ${rad * 0.22}px "${BODY_FONT}", monospace`;
    ctx.fillText(text2, 0, rad * 0.22);
  }
  ctx.restore();
}

export function drawLogoStamp(ctx, cx, cy, size, angle) {
  if (!logoImg) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 4;
  ctx.globalAlpha = 0.9;
  const aspect = logoImg.width / logoImg.height;
  ctx.drawImage(
    logoImg,
    (-size * aspect) / 2,
    -size / 2,
    size * aspect,
    size
  );
  ctx.restore();
}

export function drawReaper(ctx, x, y, size, alpha) {
  if (!reaperImg) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const aspect = reaperImg.width / reaperImg.height;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  ctx.drawImage(reaperImg, x, y, size * aspect, size);
  ctx.restore();
}

export function drawImg(ctx, img, x, y, sz) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 10;
  ctx.shadowOffsetX = 5;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, x, y, sz, sz);
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = BK;
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, sz, sz);
  const gloss = ctx.createLinearGradient(x, y, x + sz, y + sz);
  gloss.addColorStop(0, "rgba(255,255,255,0.4)");
  gloss.addColorStop(0.3, "rgba(255,255,255,0.0)");
  gloss.addColorStop(0.7, "rgba(0,0,0,0.0)");
  gloss.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = gloss;
  ctx.fillRect(x, y, sz, sz);
  ctx.restore();
}

export function drawCross(ctx, cx, cy, w, h) {
  const t = 14;
  const f = 8;
  ctx.save();
  ctx.fillStyle = BK;
  // vertical bar
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2 - f);
  ctx.lineTo(cx - t - f, cy - h / 2 + h * 0.2);
  ctx.lineTo(cx - t, cy - h / 2 + h * 0.2);
  ctx.lineTo(cx - t, cy + h / 2 - f);
  ctx.lineTo(cx - t - f, cy + h / 2 + f);
  ctx.lineTo(cx, cy + h / 2 + f * 2);
  ctx.lineTo(cx + t + f, cy + h / 2 + f);
  ctx.lineTo(cx + t, cy + h / 2 - f);
  ctx.lineTo(cx + t, cy - h / 2 + h * 0.2);
  ctx.lineTo(cx + t + f, cy - h / 2 + h * 0.2);
  ctx.closePath();
  ctx.fill();
  // horizontal bar
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 - f, cy - h / 4);
  ctx.lineTo(cx - w / 2 + f, cy - h / 4 - t - f);
  ctx.lineTo(cx - w / 2 + f, cy - h / 4 - t);
  ctx.lineTo(cx + w / 2 - f, cy - h / 4 - t);
  ctx.lineTo(cx + w / 2 - f, cy - h / 4 - t - f);
  ctx.lineTo(cx + w / 2 + f, cy - h / 4);
  ctx.lineTo(cx + w / 2 - f, cy - h / 4 + t + f);
  ctx.lineTo(cx + w / 2 - f, cy - h / 4 + t);
  ctx.lineTo(cx - w / 2 + f, cy - h / 4 + t);
  ctx.lineTo(cx - w / 2 + f, cy - h / 4 + t + f);
  ctx.closePath();
  ctx.fill();
  // center circle
  ctx.beginPath();
  ctx.arc(cx, cy - h / 4, t + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BG;
  ctx.beginPath();
  ctx.arc(cx, cy - h / 4, t - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BK;
  ctx.beginPath();
  ctx.arc(cx, cy - h / 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function wrapText(ctx, text, x, y, mw, lh) {
  const words = text.split(" ");
  let line = "",
    ty = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > mw && i > 0) {
      ctx.fillText(line.trim(), x, ty);
      line = words[i] + " ";
      ty += lh;
    } else line = test;
  }
  ctx.fillText(line.trim(), x, ty);
  return ty;
}

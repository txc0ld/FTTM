import { useState, useRef, useEffect, useCallback } from "react";
import DailyRiot from "./DailyRiot";
import IrsWatchdog from "./IrsWatchdog";
import Citizenship from "./Citizenship";
import Boneyard from "./Boneyard";
import KillFeed from "./KillFeed";
import WhaleWatch from "./WhaleWatch";
import Census from "./Census";
import TaxTracker from "./TaxTracker";
import ShareCard from "./ShareCard";
import { useTheme } from "./shared/theme";
import { useSound } from "./shared/sound";
import { GifEncoder } from "./shared/gif";

/* ═══════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════ */

const BG = "#dfff00";
const BK = "#000000";
const W = 1080;
const H = 1350;
const HEADING_FONT = "Bajern";
const BODY_FONT = "DeptBody";
const OBIT_FONT = "Special Elite";

const CONTRACT = "0x4f249b2dc6cecbd549a0c354bbfc4919e8c5d3ae";
const EVADER = "0x0beed7099af7514ccedf642cfea435731176fb02";
const EVADER_CONTRACT = "0x075f90ff6b89a1c164fb352bebd0a16f55804ca2";
const ALCHEMY_BASE = "https://eth-mainnet.g.alchemy.com/nft/v3/demo";

const TEMPLATES = [
  { id: "fvcktax", name: "FVCK TAX" },
  { id: "reaperservice", name: "REAPER SERVICE" },
  { id: "tombstone", name: "TOMBSTONE" },
  { id: "wanted", name: "WANTED" },
  { id: "deathcert", name: "DEATH CERT" },
  { id: "mugshot", name: "MUGSHOT" },
  { id: "audit", name: "AUDIT NOTICE" },
  { id: "obituary", name: "OBITUARY" },
  { id: "toetag", name: "TOE TAG" },
  { id: "rapsheet", name: "RAP SHEET" },
  { id: "evidence", name: "EVIDENCE BOARD" },
  { id: "taxreceipt", name: "TAX RECEIPT" },
  { id: "citizenid", name: "CITIZEN ID" },
  { id: "commendation", name: "COMMENDATION" },
  { id: "elimcert", name: "ELIMINATION CERT" },
  { id: "ripposter", name: "RIP POSTER" },
  { id: "bodybagtag", name: "BODY BAG TAG" },
  { id: "wasted", name: "WASTED" },
  { id: "blank", name: "BLANK" },
];

/* ═══════════════════════════════════════════════
   API — ALCHEMY NFT v3
   ═══════════════════════════════════════════════ */

function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function parseMeta(nft) {
  const attrs = {};
  const rawAttrs = nft.raw?.metadata?.attributes || [];
  rawAttrs.forEach((a) => {
    if (a.trait_type) attrs[a.trait_type.toLowerCase()] = a.value;
  });
  const tokenId = nft.tokenId || "0";
  const image =
    nft.image?.cachedUrl ||
    nft.image?.originalUrl ||
    nft.image?.pngUrl ||
    nft.raw?.metadata?.image ||
    "";
  const auditHash = cyrb53(tokenId, 6969);
  const taxHash = cyrb53(tokenId, 4200);
  const inAudit = (auditHash % 100) < 5;
  const taxDue = (taxHash % 100) < 12;

  return {
    id: tokenId,
    name: nft.name || nft.title || `Citizen #${tokenId}`,
    image,
    class: attrs.class || attrs.type || "UNKNOWN",
    insured: (attrs.insured || attrs.insurance || "").toLowerCase(),
    status: attrs.status || "ALIVE",
    background: attrs.background || "",
    headwear: attrs.headwear || attrs.hat || "",
    expression: attrs.expression || attrs.mouth || "",
    eyewear: attrs.eyewear || attrs.eyes || "",
    skin: attrs.skin || "",
    allTraits: attrs,
    inAudit,
    taxDue,
  };
}

async function fetchWalletNFTs(wallet) {
  let allNfts = [];
  let pageKey = null;
  let pagesFetches = 0;

  do {
    let url = `${ALCHEMY_BASE}/getNFTsForOwner?owner=${wallet}&contractAddresses[]=${CONTRACT}&withMetadata=true&pageSize=100`;
    if (pageKey) {
      url += `&pageKey=${pageKey}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    
    if (data.ownedNfts) {
      allNfts = allNfts.concat(data.ownedNfts);
    }
    
    pageKey = data.pageKey;
    pagesFetches++;
    
    // Safety cap: up to 500 NFTs (5 pages of 100)
    if (pagesFetches >= 5) break; 
  } while (pageKey);

  return allNfts.map((nft) => parseMeta(nft));
}

async function fetchTokenById(tokenId) {
  const url = `${ALCHEMY_BASE}/getNFTMetadata?contractAddress=${CONTRACT}&tokenId=${tokenId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const nft = await res.json();
  if (!nft.tokenId && !nft.id?.tokenId) throw new Error("Token not found");
  return parseMeta(nft);
}

async function fetchEvaderById(tokenId) {
  const url = `${ALCHEMY_BASE}/getNFTMetadata?contractAddress=${EVADER_CONTRACT}&tokenId=${tokenId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const nft = await res.json();
  if (!nft.tokenId && !nft.id?.tokenId) throw new Error("Evader not found");
  const parsed = parseMeta(nft);
  // Prefer IPFS original over Alchemy CDN — CDN strips backgrounds on grayscale evaders
  const ipfsImage =
    nft.image?.originalUrl ||
    (nft.raw?.metadata?.image || "").replace("ipfs://", "https://ipfs.io/ipfs/");
  if (ipfsImage) parsed.image = ipfsImage;
  return parsed;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

/* ═══════════════════════════════════════════════
   FONTS & REAPER ASSET
   ═══════════════════════════════════════════════ */

let reaperImg = null;
let logoImg = null;
let fvckTaxImg = null;
let reaperServiceImg = null;
let fp1Img = null;
let fp2Img = null;

function loadAssets() {
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
  const reaperP = new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      reaperImg = img;
      res();
    };
    img.onerror = () => res();
    img.src = "/reaper.png";
  });
  const logoP = new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      logoImg = img;
      res();
    };
    img.onerror = () => res();
    img.src = "https://www.deptofdeath.xyz/images/logo.png";
  });
  const fvckTaxP = new Promise((res) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      fvckTaxImg = img;
      res();
    };
    img.onerror = () => res();
    img.src = "/assets/FTTM OLs.png";
  });
  const reaperServiceP = new Promise((res) => {
    const img = new Image();
    img.onload = () => { reaperServiceImg = img; res(); };
    img.onerror = () => res();
    img.src = "/assets/reaperservice.png";
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
  
  const fp1P = new Promise((res) => {
    const img = new Image();
    img.onload = () => { fp1Img = img; res(); };
    img.onerror = () => res();
    img.src = "/fingerprint1.png";
  });
  
  const fp2P = new Promise((res) => {
    const img = new Image();
    img.onload = () => { fp2Img = img; res(); };
    img.onerror = () => res();
    img.src = "/fingerprint2.png";
  });

  return Promise.all([fontP, reaperP, logoP, fvckTaxP, reaperServiceP, fp1P, fp2P]);
}

/* ═══════════════════════════════════════════════
   DISTRESS ENGINE
   ═══════════════════════════════════════════════ */

function sR(seed) {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function addGrain(ctx, intensity, seed) {
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

function addScratches(ctx, n, seed) {
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

function addSplatter(ctx, n, seed) {
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
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.restore();
}

function addEdgeWear(ctx, seed) {
  const r = sR(seed);
  ctx.save();
  ctx.fillStyle = BG;
  for (let x = 0; x < W; x += 2)
    if (r() < 0.15) ctx.fillRect(x, 0, 2 + r() * 4, 1 + r() * 8);
  for (let x = 0; x < W; x += 2)
    if (r() < 0.15) ctx.fillRect(x, H - 1 - r() * 8, 2 + r() * 4, 1 + r() * 8);
  for (let y = 0; y < H; y += 2)
    if (r() < 0.12) ctx.fillRect(0, y, 1 + r() * 6, 2 + r() * 4);
  for (let y = 0; y < H; y += 2)
    if (r() < 0.12) ctx.fillRect(W - 1 - r() * 6, y, 1 + r() * 6, 2 + r() * 4);
  ctx.restore();
}

function addHalftone(ctx, density, maxR, seed) {
  const r = sR(seed);
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = BK;
  for (let y = 0; y < H; y += 18)
    for (let x = 0; x < W; x += 18)
      if (r() < density) {
        ctx.beginPath();
        ctx.arc(x + r() * 18, y + r() * 18, 1 + r() * maxR, 0, Math.PI * 2);
        ctx.fill();
      }
  ctx.restore();
}

function addStain(ctx, cx, cy, rad, seed) {
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

function addFoldCrease(ctx, vert, pos, seed) {
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
    for (let y = 0; y < H; y += 3) ctx.lineTo(x + 4 + (r() - 0.5) * 2, y);
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
    for (let x = 0; x < W; x += 3) ctx.lineTo(x, y + 4 + (r() - 0.5) * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function addTornEdge(ctx, side, depth, seed) {
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

function addDrips(ctx, x, y, w, n, seed) {
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

function addTape(ctx, x, y, w, h, angle) {
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

function applyDistress(ctx, seed) {
  ctx.save();
  
  // Subtle structural vignette (darkening edges safely)
  const g = ctx.createRadialGradient(W/2, H/2, W*0.3, W/2, H/2, Math.max(W,H)*0.85);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  // Deep structural crinkles and folds instead of dust/grunge





  
  ctx.restore();
}

/* ═══════════════════════════════════════════════
   DRAWING HELPERS
   ═══════════════════════════════════════════════ */

function rRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clear(ctx) {
  ctx.clearRect(0, 0, W, H);
}
function sLine(ctx, x1, y1, x2, y2, lw = 3) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = lw; // Solid crisp drop shadow
  ctx.strokeStyle = BK;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}
function dLine(ctx, x1, y1, x2, y2) {
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

function dRect(ctx, x, y, w, h, lw, seed) {
  ctx.save();
  ctx.lineJoin = "miter";
  // Strong, crisp outer shadow
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = lw * 1.5;
  ctx.shadowOffsetY = lw * 1.5;
  ctx.strokeStyle = BK;
  ctx.lineWidth = lw;
  ctx.strokeRect(x, y, w, h);
  
  // Inner bevel highlight
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = lw / 2;
  ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  
  ctx.restore();
}

function dText(ctx, text, x, y, size, font, align = "center") {
  ctx.save();
  ctx.font = `bold ${size}px "${font}", serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = BK;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function heading(ctx, text, x, y, size, align = "center") {
  dText(ctx, text, x, y, size, HEADING_FONT, align);
}
function body(ctx, text, x, y, size, align = "center") {
  dText(ctx, text, x, y, size, BODY_FONT, align);
}

function dStamp(ctx, cx, cy, rad, text, text2, seed, color) {
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

function drawLogoStamp(ctx, cx, cy, size, angle, seed) {
  if (!logoImg) return;
  const r = sR(seed);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 4;
  ctx.globalAlpha = 0.9;
  const aspect = logoImg.width / logoImg.height;
  ctx.drawImage(logoImg, (-size * aspect) / 2, -size / 2, size * aspect, size);
  ctx.restore();
}

function drawReaper(ctx, x, y, size, alpha) {
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

function drawImg(ctx, img, x, y, sz) {
  ctx.save();
  // Just a simple clean shadow and frame
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
  
  // Subtle glare on the photo
  const gloss = ctx.createLinearGradient(x, y, x + sz, y + sz);
  gloss.addColorStop(0, "rgba(255,255,255,0.4)");
  gloss.addColorStop(0.3, "rgba(255,255,255,0.0)");
  gloss.addColorStop(0.7, "rgba(0,0,0,0.0)");
  gloss.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = gloss;
  ctx.fillRect(x, y, sz, sz);
  
  ctx.restore();
}

function drawCross(ctx, cx, cy, w, h) {
  const t = 14; // arm thickness
  const f = 8; // flare at ends
  ctx.save();
  ctx.fillStyle = BK;
  ctx.beginPath();
  // top point
  ctx.moveTo(cx, cy - h / 2 - f);
  ctx.lineTo(cx - t - f, cy - h / 4 + t);
  ctx.lineTo(cx - t, cy - h / 4 + t);
  // left arm point
  ctx.lineTo(cx - t, cy - h / 4);
  ctx.lineTo(cx - w / 2 - f, cy - h / 4 + t / 2);
  ctx.lineTo(cx - w / 2 - f, cy - h / 4 - t / 2);
  ctx.lineTo(cx - t, cy - h / 4 - t);
  ctx.lineTo(cx - t, cy - h / 4 - t);
  // back to top
  ctx.lineTo(cx - t - f, cy - h / 4 - t);
  ctx.lineTo(cx, cy - h / 2 - f);
  // top right
  ctx.lineTo(cx + t + f, cy - h / 4 - t);
  ctx.lineTo(cx + t, cy - h / 4 - t);
  // right arm point
  ctx.lineTo(cx + t, cy - h / 4);
  ctx.lineTo(cx + w / 2 + f, cy - h / 4 - t / 2);
  ctx.lineTo(cx + w / 2 + f, cy - h / 4 + t / 2);
  ctx.lineTo(cx + t, cy - h / 4 + t);
  // bottom
  ctx.lineTo(cx + t + f, cy - h / 4 + t);
  ctx.lineTo(cx, cy - h / 2 - f); // dummy close top
  ctx.fill();
  // draw as separate vertical + horizontal for cleaner result
  ctx.beginPath();
  // vertical bar with pointed top and flared bottom
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
  // horizontal bar with pointed ends
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

function wrapText(ctx, text, x, y, mw, lh) {
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

/* ═══════════════════════════════════════════════
   TEMPLATES — all accept (ctx, img, id, meta)
   meta = { class, insured, status, ... }
   ═══════════════════════════════════════════════ */

function drawTombstone(ctx, img, id, m) {
  clear(ctx);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.font = `bold 160px "${HEADING_FONT}", serif`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("DEPT OF DEATH", W / 2, 10);
  ctx.restore();
  drawReaper(ctx, W - 340, H - 420, 350, 0.18);
  ctx.fillStyle = BK;
  ctx.fillRect(0, H - 120, W, 120);
  ctx.save();
  ctx.font = `bold 60px "${HEADING_FONT}", serif`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`CITIZEN ${id}`, W / 2, H - 60);
  ctx.restore();
  
  const tx = 190,
    ty = 180,
    tw = 700,
    th = 950;
  ctx.strokeStyle = BK;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(tx, ty + 350);
  ctx.arcTo(tx, ty, tx + tw / 2, ty, 350);
  ctx.arcTo(tx + tw, ty, tx + tw, ty + 350, 350);
  ctx.lineTo(tx + tw, ty + th);
  ctx.lineTo(tx, ty + th);
  ctx.closePath();
  ctx.stroke();
  
  // inner border following the arch
  ctx.save();
  ctx.strokeStyle = BK;
  ctx.lineWidth = 2;
  const ix = tx + 25,
    iy = ty + 25,
    iw = tw - 50,
    ih = th - 50;
  ctx.beginPath();
  ctx.moveTo(ix, iy + 325);
  ctx.arcTo(ix, iy, ix + iw / 2, iy, 325);
  ctx.arcTo(ix + iw, iy, ix + iw, iy + 325, 325);
  ctx.lineTo(ix + iw, iy + ih);
  ctx.lineTo(ix, iy + ih);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  
  drawCross(ctx, W / 2, ty + 140, 100, 160);

  if (img) {
    drawImg(ctx, img, W / 2 - 175, ty + 290, 350);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(W / 2 - 175, ty + 290, 350, 350);
  } else {
    dRect(ctx, W / 2 - 175, ty + 290, 350, 350, 4, 222);
  }
  
  // High-End Graphic Cracks
  ctx.save();
  
  // Clip the cracks within the tombstone boundary so they do not spill onto the background
  ctx.beginPath();
  ctx.moveTo(tx, ty + 350);
  ctx.arcTo(tx, ty, tx + tw / 2, ty, 350);
  ctx.arcTo(tx + tw, ty, tx + tw, ty + 350, 350);
  ctx.lineTo(tx + tw, ty + th);
  ctx.lineTo(tx, ty + th);
  ctx.closePath();
  ctx.clip();

  ctx.lineJoin = "bevel";
  ctx.lineCap = "round";
  
  const drawFissure = (sx, sy, baseA, len, maxForks, mainThick, rSeed) => {
    let _r = sR(rSeed);
    let cx = sx, cy = sy, ca = baseA;
    let dist = 0;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineWidth = mainThick;
    
    while(dist < len) {
      let step = 15 + _r() * 25;
      ca += (_r() - 0.5) * 1.1; // erratic turn
      cx += Math.cos(ca) * step;
      cy += Math.sin(ca) * step;
      ctx.lineTo(cx, cy);
      dist += step;
      
      // Fracturing fork
      if (maxForks > 0 && _r() > 0.6) {
        maxForks--;
        ctx.save();
        ctx.lineWidth = mainThick * 0.5;
        let fx = cx, fy = cy, fa = ca + (_r() > 0.5 ? 1 : -1) * (0.6 + _r()*0.4);
        let fDist = 0;
        let fLen = len * 0.4 * _r();
        ctx.moveTo(fx, fy);
        while(fDist < fLen) {
            let fStep = 10 + _r() * 15;
            fa += (_r() - 0.5) * 1.5;
            fx += Math.cos(fa) * fStep;
            fy += Math.sin(fa) * fStep;
            ctx.lineTo(fx, fy);
            fDist += fStep;
        }
        ctx.restore();
        ctx.moveTo(cx, cy); // Jump back
      }
    }
  };

  ctx.strokeStyle = BK;
  drawFissure(tx + 80, ty, Math.PI / 2.3, 350, 3, 4, 991);
  ctx.stroke();
  
  drawFissure(tx + tw - 60, ty + 30, Math.PI * 0.7, 280, 2, 3, 992);
  ctx.stroke();

  drawFissure(tx, ty + 400, Math.PI * 0.15, 160, 1, 3, 993);
  ctx.stroke();

  drawFissure(tx + tw, ty + 580, Math.PI * 0.9, 200, 2, 3.5, 994);
  ctx.stroke();
  
  // Super fine hairline fractures
  ctx.globalAlpha = 0.5;
  drawFissure(tx + 250, ty + th, -Math.PI / 2.1, 220, 2, 1.5, 995);
  ctx.stroke();
  drawFissure(tx + 450, ty + th, -Math.PI / 1.7, 180, 1, 1.5, 996);
  ctx.stroke();
  
  ctx.restore();
  
  heading(ctx, "R I P", W / 2, ty + 700, 104);
  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText(
    m.class !== "UNKNOWN"
      ? `CLASS: ${m.class.toUpperCase()} — ${m.insured === "yes" ? "INSURED" : "UNINSURED"}`
      : "MINTED 2026 — ELIMINATED 2026",
    W / 2,
    ty + 798,
  );
  dLine(ctx, tx + 60, ty + 830, tx + tw - 60, ty + 830);
  body(ctx, "DEPT. OF DEATH", W / 2, ty + 880, 32);
  drawLogoStamp(ctx, tx + 160, ty + 830, 160, 0, 1010);


  applyDistress(ctx, 1);
}

function drawWanted(ctx, img, id, m) {
  clear(ctx);
  dRect(ctx, 30, 30, W - 60, H - 60, 8, 200);
  dRect(ctx, 50, 50, W - 100, H - 100, 3, 201);
  [
    [60, 60],
    [W - 60, 60],
    [60, H - 60],
    [W - 60, H - 60],
  ].forEach(([cx, cy]) => {
    ctx.fillStyle = BK;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BG;
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  const star = (cx, cy, rad) => {
    ctx.save();
    ctx.fillStyle = BK;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      i === 0
        ? ctx.moveTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a))
        : ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  star(140, 165, 30);
  star(W - 140, 165, 30);
  heading(ctx, "WANTED", W / 2, 135, 182);

  sLine(ctx, 100, 245, W - 100, 245, 4);
  body(ctx, "DEAD OR DELINQUENT", W / 2, 290, 40);
  sLine(ctx, 100, 330, W - 100, 330, 4);
  const iS = 480,
    iX = W / 2 - iS / 2,
    iY = 375;
  if (img) drawImg(ctx, img, iX, iY, iS);
  else {
    dRect(ctx, iX, iY, iS, iS, 6, 202);
    body(ctx, "CITIZEN", W / 2, iY + iS / 2 - 20, 48);
    body(ctx, "IMAGE", W / 2, iY + iS / 2 + 30, 48);
  }
  [
    [iX + 14, iY + 14],
    [iX + iS - 14, iY + 14],
    [iX + 14, iY + iS - 14],
    [iX + iS - 14, iY + iS - 14],
  ].forEach(([nx, ny]) => {
    ctx.fillStyle = BK;
    ctx.beginPath();
    ctx.arc(nx, ny, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BG;
    ctx.beginPath();
    ctx.arc(nx - 2, ny - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  sLine(ctx, 100, 905, W - 100, 905, 4);
  heading(ctx, `CITIZEN #${id}`, W / 2, 958, 60);
  body(
    ctx,
    m.class !== "UNKNOWN"
      ? `CLASS: ${m.class.toUpperCase()}`
      : "CRIME: TAX EVASION",
    W / 2,
    1025,
    32,
  );
  body(ctx, "STATUS: DELINQUENT", W / 2, 1070, 28);
  sLine(ctx, 100, 1115, W - 100, 1115, 4);
  heading(ctx, "REWARD", W / 2, 1165, 68);

  body(ctx, "ONE SHARE OF THE TREASURY", W / 2, 1225, 28);
  drawReaper(ctx, 55, H - 310, 240, 0.2);
  body(ctx, "— DEPT. OF DEATH —", W / 2, 1285, 24);
  drawLogoStamp(ctx, W - 160, H - 200, 130, -0.12, 1002);
  applyDistress(ctx, 2);
}

function drawDeathCert(ctx, img, id, m) {
  clear(ctx);
  dRect(ctx, 40, 40, W - 80, H - 80, 6, 300);
  dRect(ctx, 55, 55, W - 110, H - 110, 2, 301);
  ctx.fillStyle = BK;
  ctx.fillRect(55, 55, W - 110, 90);
  ctx.font = `bold 36px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText("DEPT. OF DEATH — OFFICIAL DOCUMENT", W / 2, 110);
  heading(ctx, "CERTIFICATE", W / 2, 220, 103);
  body(ctx, "— OF ELIMINATION —", W / 2, 285, 36);

  sLine(ctx, 100, 325, W - 100, 325, 3);
  const classVal =
    m.class !== "UNKNOWN" ? m.class.toUpperCase() : "________________";
  const insVal =
    m.insured === "yes"
      ? "INSURED"
      : m.insured === "no"
        ? "UNINSURED"
        : "________________";
  [
    ["CITIZEN ID:", `#${id}`],
    ["CLASS:", classVal],
    ["INSURANCE:", insVal],
    ["CAUSE OF DEATH:", "FAILURE TO PAY TAXES"],
    ["AUDITED BY:", "INTERNAL REAPER SERVICE"],
  ].forEach(([l, v], i) => {
    const fy = 375 + i * 58;
    ctx.font = `bold 22px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BK;
    ctx.textAlign = "left";
    ctx.fillText(l, 100, fy);
    ctx.font = `400 22px "${BODY_FONT}", monospace`;
    ctx.fillText(v, 420, fy);
    dLine(ctx, 420, fy + 10, W - 100, fy + 10);
  });
  if (img) drawImg(ctx, img, W / 2 - 180, 685, 360);
  else dRect(ctx, W / 2 - 180, 685, 360, 360, 4, 302);


  sLine(ctx, 100, 1085, W - 100, 1085, 3);
  ctx.font = `400 18px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = BK;
  ctx.fillText("THIS CITIZEN HAS BEEN PERMANENTLY ELIMINATED.", W / 2, 1115);
  ctx.fillText("NFT BURNED AND REMINTED TO EVADER CONTRACT.", W / 2, 1145);
  drawReaper(ctx, W / 2 + 210, 600, 380, 0.12);
  dStamp(ctx, 200, 1240, 58, "VOID", "BURNED", 303, "#8b1a1a");
  dStamp(ctx, W - 200, 1240, 58, "IRS", "VERIFIED", 304, "#8b1a1a");
  dLine(ctx, W / 2 - 120, 1260, W / 2 + 120, 1260);
  ctx.font = `400 16px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = BK;
  ctx.fillText("AUTHORIZED REAPER", W / 2, 1285);
  drawLogoStamp(ctx, W / 2, 1200, 120, 0.08, 1003);
  applyDistress(ctx, 3);
}

function drawMugshot(ctx, img, id, m) {
  clear(ctx);
  ctx.fillStyle = BK;
  ctx.fillRect(0, 0, W, 100);
  ctx.fillRect(0, H - 100, W, 100);
  ctx.font = `bold 44px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText("DEPT. OF DEATH — BOOKING", W / 2, 65);
  const sY = 150,
    eY = 950,
    st = (eY - sY) / 10;
  for (let i = 0; i <= 10; i++) {
    const ly = sY + i * st,
      mk = i % 2 === 0;
    sLine(ctx, 0, ly, mk ? 120 : 80, ly, mk ? 3 : 1);
    sLine(ctx, W - (mk ? 120 : 80), ly, W, ly, mk ? 3 : 1);
    if (mk) {
      ctx.font = `bold 18px "${BODY_FONT}", monospace`;
      ctx.fillStyle = BK;
      ctx.textAlign = "left";
      ctx.fillText(`${6 - i * 0.5}'`, 5, ly - 8);
      ctx.textAlign = "right";
      ctx.fillText(`${6 - i * 0.5}'`, W - 5, ly - 8);
    }
  }
  sLine(ctx, W / 2, 100, W / 2, 150, 1);
  drawReaper(ctx, W - 320, 160, 300, 0.1);
  const iS = 520;
  if (img) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, W / 2 - iS / 2, 240, iS, iS);
    ctx.restore();
  } else dRect(ctx, W / 2 - iS / 2, 240, iS, iS, 4, 400);
  const pY = 830;
  ctx.fillStyle = BK;
  ctx.fillRect(W / 2 - 320, pY, 640, 200);
  ctx.strokeStyle = BG;
  ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - 310, pY + 10, 620, 180);
  ctx.font = `bold 60px "${HEADING_FONT}", serif`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText(`CITIZEN #${id}`, W / 2, pY + 78);
  ctx.font = `bold 32px "${BODY_FONT}", monospace`;
  ctx.fillText("TAX EVADER", W / 2, pY + 128);
  ctx.font = `400 22px "${BODY_FONT}", monospace`;
  ctx.fillText("DEPT. OF DEATH // IRS", W / 2, pY + 172);
  const insText =
    m.insured === "yes" ? "ACTIVE" : m.insured === "no" ? "NONE" : "UNVERIFIED";
  [
    ["STATUS:", "DELINQUENT"],
    ["CLASS:", m.class !== "UNKNOWN" ? m.class.toUpperCase() : "UNCLASSIFIED"],
    ["INSURANCE:", insText],
    ["SENTENCE:", "ELIMINATION"],
  ].forEach(([l, v], i) => {
    const fy = 1080 + i * 42;
    ctx.font = `bold 22px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BK;
    ctx.textAlign = "left";
    ctx.fillText(l, 100, fy);
    ctx.font = `400 22px "${BODY_FONT}", monospace`;
    ctx.fillText(v, 420, fy);
  });
  ctx.font = `bold 24px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText("INTERNAL REAPER SERVICE — CASE FILE", W / 2, H - 40);
  dStamp(
    ctx,
    W / 2 + iS / 2 - 20,
    240 + iS - 20,
    70,
    "BOOKED",
    "",
    401,
    "#8b1a1a",
  );
  drawLogoStamp(ctx, 160, 400, 130, -0.1, 1004);
  applyDistress(ctx, 4);
}

function drawAudit(ctx, img, id, m) {
  clear(ctx);
  dRect(ctx, 30, 30, W - 60, H - 60, 5, 500);
  ctx.fillStyle = BK;
  ctx.fillRect(30, 30, W - 60, 120);
  ctx.font = `bold 28px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "left";
  ctx.fillText("FORM DT-420", 60, 75);
  ctx.textAlign = "right";
  ctx.fillText("INTERNAL REAPER SERVICE", W - 60, 75);
  ctx.textAlign = "center";
  ctx.font = `bold 20px "${BODY_FONT}", monospace`;
  ctx.fillText("DEPT. OF DEATH — OFFICIAL USE ONLY", W / 2, 120);
  heading(ctx, "NOTICE OF AUDIT", W / 2, 215, 136);

  sLine(ctx, 80, 268, W - 80, 268, 4);
  dRect(ctx, 80, 288, W - 160, 70, 3, 501);
  ctx.font = `bold 20px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText("THIS CITIZEN HAS BEEN FLAGGED FOR TAX DELINQUENCY", W / 2, 328);
  ctx.font = `bold 24px "${BODY_FONT}", monospace`;
  ctx.textAlign = "left";
  ctx.fillText("SUBJECT:", 80, 408);
  if (img) drawImg(ctx, img, 80, 428, 280);
  else dRect(ctx, 80, 428, 280, 280, 4, 502);

  const insVal =
    m.insured === "yes"
      ? "[X] YES  [ ] NO"
      : m.insured === "no"
        ? "[ ] YES  [X] NO"
        : "[ ] YES  [ ] NO";
  [
    ["CITIZEN ID:", `#${id}`],
    ["TAX STATUS:", "DELINQUENT"],
    ["CLASS:", m.class !== "UNKNOWN" ? m.class.toUpperCase() : "___________"],
    ["AMOUNT OWED:", "___________"],
    ["INSURANCE:", insVal],
    ["BRIBE USED:", "[ ] YES  [ ] NO"],
  ].forEach(([l, v], i) => {
    const fy = 458 + i * 48;
    ctx.font = `bold 20px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BK;
    ctx.textAlign = "left";
    ctx.fillText(l, 400, fy);
    ctx.font = `400 20px "${BODY_FONT}", monospace`;
    ctx.fillText(v, 680, fy);
  });
  sLine(ctx, 80, 748, W - 80, 748, 3);
  body(ctx, "ENFORCEMENT ACTION", W / 2, 798, 36);
  [
    "[ ] CITIZEN HAS 24 HOURS TO SETTLE TAX",
    "[ ] FAILURE TO COMPLY = ELIMINATION",
    "[ ] CITIZEN BURNED FROM MAIN COLLECTION",
    "[ ] REMINTED TO EVADER CONTRACT",
    "[X] NO APPEALS. NO EXCEPTIONS. NO MERCY.",
  ].forEach((a, i) => {
    ctx.font = `400 20px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BK;
    ctx.textAlign = "left";
    ctx.fillText(a, 100, 858 + i * 44);
  });
  sLine(ctx, 80, 1098, W - 80, 1098, 3);
  drawReaper(ctx, W - 300, 820, 260, 0.15);
  ctx.font = `bold 20px "${BODY_FONT}", monospace`;
  ctx.textAlign = "left";
  ctx.fillStyle = BK;
  ctx.fillText("AUDITOR:", 100, 1138);
  ctx.font = `400 22px "Rock Salt", cursive`;
  ctx.fillText("the tax man", 260, 1140);
  dLine(ctx, 260, 1148, 480, 1148);
  ctx.font = `bold 20px "${BODY_FONT}", monospace`;
  ctx.fillText("DATE:", 520, 1138);
  ctx.font = `400 22px "Rock Salt", cursive`;
  ctx.fillText(
    new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    640,
    1140,
  );
  dLine(ctx, 640, 1148, 860, 1148);
  dStamp(ctx, 200, 1238, 52, "AUDIT", "ACTIVE", 503, "#8b1a1a");
  dStamp(ctx, W - 200, 1238, 62, "IRS", "OFFICIAL", 504, "#8b1a1a");
  ctx.font = `400 14px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = BK;
  ctx.fillText(
    "FORM DT-420 REV. 2026 // DEPT. OF DEATH // ALL RIGHTS RESERVED",
    W / 2,
    H - 55,
  );
  drawLogoStamp(ctx, W / 2, 1200, 110, 0.1, 1005);
  applyDistress(ctx, 5);
}

function drawObituary(ctx, img, id, m) {
  clear(ctx);
  sLine(ctx, 60, 40, 60, H - 40, 2);
  sLine(ctx, W - 60, 40, W - 60, H - 40, 2);
  ctx.fillStyle = BK;
  ctx.fillRect(80, 50, W - 160, 6);
  heading(ctx, "The Daily Ledger", W / 2, 102, 60);
  ctx.fillStyle = BK;
  ctx.fillRect(80, 132, W - 160, 3);
  ctx.font = `400 16px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText(
    "ONCHAIN SINCE 2026  //  VOLUME LXIX  //  DEPT. OF DEATH",
    W / 2,
    160,
  );
  ctx.fillStyle = BK;
  ctx.fillRect(80, 177, W - 160, 6);
  body(ctx, "OBITUARIES", W / 2, 228, 44);
  sLine(ctx, 200, 253, W - 200, 253, 2);
  if (img) drawImg(ctx, img, W / 2 - 200, 283, 400);
  else dRect(ctx, W / 2 - 200, 283, 400, 400, 4, 600);


  ctx.font = `bold italic 20px "${OBIT_FONT}", serif`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText(`Citizen #${id}, photographed before elimination.`, W / 2, 713);
  sLine(ctx, 100, 743, W - 100, 743, 2);
  ctx.font = `400 22px "${OBIT_FONT}", serif`;
  ctx.textAlign = "left";
  ctx.fillStyle = BK;
  const n = parseInt(id) || 42;
  const cName = m.class !== "UNKNOWN" ? `a ${m.class}` : "a quiet participant";
  const insured = m.insured === "yes";
  
  const obituariesList = [
    `Citizen #${id}, a resident of the blockchain and ${cName} of the onchain economy, was officially eliminated from the Death & Taxes registry after failing to meet their daily tax obligation. Audited by the Internal Reaper Service and found to be delinquent, #${id} was given a 24-hour grace period but failed to settle their outstanding balance. The elimination was executed on-chain and their token has been burned from the main collection. ${insured ? "Their life insurance was active. The citizen retains its colored artwork in the Evader contract." : "They held no life insurance. Their citizen has been reminted in grayscale to the Evader contract."} No next of kin were found on-chain. The treasury grows.`,
    `Following a brutal audit by the IRS, Citizen #${id}—known as ${cName}—has met their untimely demise. Ignorance of the rising tax rate proved fatal, as the 24-hour grace period expired without a transaction. The ledger has been swept clean, permanently burning the token from the main registry. ${insured ? "Fortunately for their estate, active life insurance secures a colored remint in the Evader contract." : "Without life insurance, their legacy lives on only in grayscale within the Evader contract."} Another lesson etched onto the blockchain: pay your tick.`,
    `The Department of Death officially records the passing of Citizen #${id}, ${cName}. Despite warnings broadcast across the network, they neglected their daily obligation. A player-initiated audit triggered the countdown, and silence followed. By decree of the protocol, the citizen was executed and purged from the primary collection. ${insured ? "Their foresight in purchasing life insurance grants them a vibrant afterlife in the Evader contract." : "Lacking insurance, the asset has been stripped of color, reminted as a grayscale ghost."} The system is perfectly balanced.`,
    `In a sobering reminder of the absolute certainty of on-chain taxation, Citizen #${id} has been eliminated. Once ${cName}, their failure to submit the required ETH before the audit window closed sealed their fate. The Reaper's transaction was final and irreversible, incinerating the original token. ${insured ? "Thanks to a life insurance policy, their colored artwork survives in the Evader contract." : "A lack of insurance leaves behind only a muted, grayscale shell in the Evader contract."} The treasury reclaims what is owed.`,
    `We mourn (briefly) the loss of Citizen #${id}. This ${cName} played a dangerous game of fiscal chicken and lost to a merciless auditor. With the 24-hour window elapsed and no ETH deployed, the execution was processed flawlessly by the contract. ${insured ? "A prudent life insurance policy ensures they retain their full-color glory among the Evaders." : "Penniless and uninsured, they have been reborn as a solemn grayscale token in the Evader ranks."} Death is final, but the tax rate climbs ever higher.`,
    `The ledger is unforgiving. Citizen #${id}, acting as ${cName}, was struck from the Death & Taxes rolls today. It remains unclear if it was an oversight or an act of rebellion, but the unpaid tax debt triggered an irreversible on-chain execution. The original asset is now ash. ${insured ? "A verified insurance policy means their colored essence is preserved in the Evader contract." : "Having no insurance, their digital footprint continues in bleak grayscale in the Evader contract."} Let this serve as a warning to the living.`,
    `Another soul claimed by the IRS. Citizen #${id}, remembered as ${cName}, failed to settle their outstanding balance after a targeted audit. The smart contract showed no mercy, burning the citizen from the main collection exactly 24 hours later. ${insured ? "Their active life insurance softens the blow, securing a colored remint in the Evader contract." : "Bereft of insurance, their token has been permanently dullened to grayscale in the Evader remint."} The protocol demands its due.`,
    `Citizen #${id} (${cName}) has officially flatlined. Despite surviving the early days of the system, a neglected tax payment led to a fatal audit. The execution transaction confirmed instantly, incinerating their presence on the main roster. ${insured ? "An active premium ensures their colored artwork persists in the Evader registry." : "They took their chances without insurance, resulting in a bleak grayscale remint in the Evaders."} The population dwindles. The treasury thickens.`,
    `A tragic, yet entirely preventable, elimination. Citizen #${id}, ${cName}, ignored the mounting daily tax and faced the Reaper's sickle. The 24-hour bailout window yielded nothing, prompting the smart contract to burn the original token permanently. ${insured ? "Their estate rejoices; life insurance preserves their vibrant color in the Evader contract." : "No insurance was found. They exist now only as a grayscale ghost in the Evader contract."} May their wallet rest in peace.`,
    `The bell tolls for Citizen #${id}. Acting as ${cName}, they ultimately succumbed to the relentless mathematics of the protocol. An unpaid debt, a swift audit, and a flawless execution burned their token from the main collection. ${insured ? "They die with dignity—and insurance—retaining their original colorful artwork as an Evader." : "Without the safety net of insurance, their reminted Evader token takes on a lifeless grayscale."} Survival is an ongoing expense.`
  ];
  
  const seed = parseInt(String(id).replace(/\D/g, "")) || Math.floor(Math.random() * 100);
  const obitText = obituariesList[seed % 10];
  const ty = wrapText(ctx, obitText, 100, 793, W - 200, 34);
  sLine(ctx, 100, ty + 50, W - 100, ty + 50, 2);
  drawReaper(ctx, 70, ty + 60, 180, 0.2);
  drawReaper(ctx, W - 250, ty + 60, 180, 0.2);
  ctx.font = `italic 20px "${OBIT_FONT}", serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = BK;
  ctx.fillText('"Nothing is certain except death and taxes."', W / 2, ty + 90);
  ctx.font = `400 18px "${OBIT_FONT}", serif`;
  ctx.fillText("— Benjamin Franklin", W / 2, ty + 120);
  ctx.fillStyle = BK;
  ctx.fillRect(80, H - 60, W - 160, 6);
  ctx.font = `400 14px "${BODY_FONT}", monospace`;
  ctx.fillText(
    "DEPT. OF DEATH // PRINTED ON THE ETERNAL LEDGER",
    W / 2,
    H - 35,
  );

  drawLogoStamp(ctx, W - 150, 200, 120, 0.12, 1006);
  applyDistress(ctx, 6);
}

/* ═══════════════════════════════════════════════
   TOE TAG
   ═══════════════════════════════════════════════ */
function drawToeTag(ctx, img, id, m) {
  clear(ctx);
  drawReaper(ctx, W / 2 - 200, 50, 400, 0.08);

  // string/twine from top
  ctx.save();
  ctx.strokeStyle = BK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.quadraticCurveTo(W / 2 + 30, 80, W / 2 - 10, 160);
  ctx.quadraticCurveTo(W / 2 + 20, 200, W / 2, 240);
  ctx.stroke();
  // tie loop
  ctx.beginPath();
  ctx.arc(W / 2, 250, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // tag shape — large rounded rectangle, slightly rotated
  ctx.save();
  ctx.translate(W / 2, 780);
  ctx.rotate(-0.03);
  const tw = 680,
    th = 900,
    rad = 40;
  const tx = -tw / 2,
    ty = -th / 2;

  // tag shadow
  ctx.fillStyle = BK;
  ctx.globalAlpha = 0.06;
  ctx.beginPath();
  rRect(ctx, tx + 8, ty + 8, tw, th, rad);
  ctx.fill();
  ctx.globalAlpha = 1;

  // tag body
  ctx.fillStyle = BG;
  ctx.strokeStyle = BK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  rRect(ctx, tx, ty, tw, th, rad);
  ctx.fill();
  ctx.stroke();

  // hole at top
  ctx.fillStyle = BG;
  ctx.strokeStyle = BK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, ty + 60, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // inner border
  ctx.strokeStyle = BK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  rRect(ctx, tx + 20, ty + 100, tw - 40, th - 120, rad - 10);
  ctx.stroke();

  // "DEPT. OF DEATH" at top
  ctx.font = `bold 20px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DEPT. OF DEATH — MORGUE", 0, ty + 130);

  // dashed divider
  ctx.setLineDash([8, 5]);
  ctx.beginPath();
  ctx.moveTo(tx + 50, ty + 155);
  ctx.lineTo(tx + tw - 50, ty + 155);
  ctx.stroke();
  ctx.setLineDash([]);

  // handwritten citizen info
  ctx.font = `400 36px "Rock Salt", cursive`;
  ctx.fillStyle = BK;
  ctx.textAlign = "left";
  ctx.fillText(`Citizen #${id}`, tx + 60, ty + 210);

  ctx.font = `400 24px "Rock Salt", cursive`;
  ctx.fillText("cause:", tx + 60, ty + 280);
  ctx.fillText("tax evasion", tx + 250, ty + 280);

  ctx.fillText("status:", tx + 60, ty + 340);
  ctx.fillText("eliminated", tx + 250, ty + 340);

  ctx.fillText("class:", tx + 60, ty + 400);
  ctx.fillText(
    m.class !== "UNKNOWN" ? m.class.toLowerCase() : "unknown",
    tx + 250,
    ty + 400,
  );

  ctx.fillText("insurance:", tx + 60, ty + 460);
  ctx.fillText(m.insured === "yes" ? "active" : "none", tx + 300, ty + 460);

  ctx.fillText("date:", tx + 60, ty + 520);
  ctx.font = `400 22px "Rock Salt", cursive`;
  ctx.fillText(
    new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    tx + 250,
    ty + 520,
  );

  // dashed lines under each field
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1;
  [ty + 225, ty + 295, ty + 355, ty + 415, ty + 475, ty + 535].forEach((ly) => {
    ctx.beginPath();
    ctx.moveTo(tx + 50, ly);
    ctx.lineTo(tx + tw - 50, ly);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // polaroid image clipped to tag
  if (img) {
    ctx.save();
    ctx.rotate(-0.02);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, tx + 320, ty + 530, 280, 280);
    ctx.strokeStyle = BK;
    ctx.lineWidth = 4;
    ctx.strokeRect(tx + 320, ty + 530, 280, 280);
    ctx.restore();
  }

  // "DECEASED" red stamp
  ctx.restore();
  dStamp(ctx, W / 2 + 180, 1000, 80, "DECEASED", "", 701, "#8b1a1a");
  drawLogoStamp(ctx, W / 2 - 220, 1150, 110, -0.15, 1007);
  applyDistress(ctx, 7);
}

/* ═══════════════════════════════════════════════
   RAP SHEET
   ═══════════════════════════════════════════════ */
function drawRapSheet(ctx, img, id, m) {
  clear(ctx);
  dRect(ctx, 25, 25, W - 50, H - 50, 5, 700);

  // header bar
  ctx.fillStyle = BK;
  ctx.fillRect(25, 25, W - 50, 110);
  ctx.font = `bold 30px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText("DEPT. OF DEATH — CRIMINAL RECORD", W / 2, 65);
  ctx.font = `bold 18px "${BODY_FONT}", monospace`;
  ctx.fillText("INTERNAL REAPER SERVICE // CONFIDENTIAL", W / 2, 105);

  // case number bar
  ctx.fillStyle = BK;
  ctx.fillRect(50, 155, W - 100, 50);
  ctx.font = `bold 28px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "left";
  ctx.fillText(`CASE NO. IRS-${id}-DT`, 70, 187);
  ctx.textAlign = "right";
  ctx.fillText("CLASSIFICATION: FELONY", W - 70, 187);

  // mugshot area — front view
  sLine(ctx, 60, 230, W - 60, 230, 3);
  ctx.font = `bold 18px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText("FRONT", 220, 260);
  ctx.fillText("PROFILE", 520, 260);

  if (img) {
    drawImg(ctx, img, 70, 280, 300);
    // silhouette for profile
    ctx.save();
    ctx.fillStyle = BK;
    ctx.fillRect(370, 280, 300, 300);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(img, 370, 280, 300, 300);
    ctx.restore();
    ctx.strokeStyle = BK;
    ctx.lineWidth = 6;
    ctx.strokeRect(370, 280, 300, 300);
  } else {
    dRect(ctx, 70, 280, 300, 300, 4, 702);
    dRect(ctx, 370, 280, 300, 300, 4, 703);
    body(ctx, "FRONT", 220, 430, 28);
    body(ctx, "PROFILE", 520, 430, 28);
  }

  // fingerprint graphics using uploaded images
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.85;
  
  const drawFp = (img, x, y, size, rot, label) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (img) ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
    
    ctx.font = `bold 14px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BK;
    ctx.textAlign = "center";
    ctx.globalCompositeOperation = "source-over"; // Reset for text
    ctx.fillText(label, x, y + size/2 + 20);
    ctx.globalCompositeOperation = "multiply";
  };
  
  const fpSeed = parseInt(String(id).replace(/\D/g, "")) || Math.floor(Math.random() * 100);
  const isFp1 = fpSeed % 2 === 0;
  const rot = isFp1 ? -0.05 : 0.1;
  const fpImg = isFp1 ? fp1Img : fp2Img;
  
  drawFp(fpImg, 820, 380, 200, rot, "THUMB PRINT");

  
  ctx.restore();

  sLine(ctx, 60, 610, W - 60, 610, 3);

  // charge heading
  heading(ctx, "CHARGE: TAX EVASION", W / 2, 665, 56);

  sLine(ctx, 60, 720, W - 60, 720, 2);

  // criminal details
  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "left";
  const fields = [
    ["CITIZEN ID:", `#${id}`],
    ["ALIASES:", "UNKNOWN"],
    ["CLASS:", m.class !== "UNKNOWN" ? m.class.toUpperCase() : "UNCLASSIFIED"],
    [
      "INSURANCE:",
      m.insured === "yes" ? "ACTIVE" : m.insured === "no" ? "EXPIRED" : "NONE",
    ],
    ["PRIOR OFFENSES:", "SEE BELOW"],
  ];
  fields.forEach(([l, v], i) => {
    const fy = 770 + i * 46;
    ctx.font = `bold 20px "${BODY_FONT}", monospace`;
    ctx.fillText(l, 80, fy);
    ctx.font = `400 20px "${BODY_FONT}", monospace`;
    ctx.fillText(v, 420, fy);
  });

  sLine(ctx, 60, 1010, W - 60, 1010, 2);

  // offenses checklist
  body(ctx, "PRIOR OFFENSES", W / 2, 1050, 30);
  const offenses = [
    "[X] FAILURE TO PAY DAILY TAX",
    "[X] IGNORING IRS AUDIT NOTICE",
    "[X] RESISTING ELIMINATION",
    "[ ] BRIBERY OF REAPER (UNPROVEN)",
    "[X] EVASION OF TREASURY OBLIGATIONS",
  ];
  offenses.forEach((o, i) => {
    ctx.font = `400 18px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BK;
    ctx.textAlign = "left";
    ctx.fillText(o, 100, 1095 + i * 36);
  });

  // stamps and footer
  drawReaper(ctx, W - 280, 740, 240, 0.1);
  dStamp(ctx, W - 150, 1200, 70, "GUILTY", "", 704, "#8b1a1a");
  drawLogoStamp(ctx, 150, 1220, 110, 0.1, 1008);
  ctx.font = `400 14px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = BK;
  ctx.fillText(
    "DEPT. OF DEATH // CRIMINAL RECORDS DIVISION // PERMANENT FILE",
    W / 2,
    H - 45,
  );
  applyDistress(ctx, 8);
}

/* ═══════════════════════════════════════════════
   EVIDENCE BOARD
   ═══════════════════════════════════════════════ */
function drawEvidenceBoard(ctx, img, id, m) {
  // dark cork background
  ctx.fillStyle = "#2a2216";
  ctx.fillRect(0, 0, W, H);

  // subtle grain texture on cork
  const r = sR(800);
  ctx.fillStyle = "#3d3220";
  for (let i = 0; i < 3000; i++) {
    ctx.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 2);
  }

  // helper: draw a pin
  const drawPin = (x, y, col) => {
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // helper: draw string between points
  const drawString = (x1, y1, x2, y2) => {
    ctx.save();
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const cpx = (x1 + x2) / 2 + (r() - 0.5) * 60;
    const cpy = (y1 + y2) / 2 + 20 + r() * 30;
    ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    ctx.stroke();
    ctx.restore();
  };

  // case header — paper note pinned
  ctx.save();
  ctx.translate(W / 2, 100);
  ctx.rotate(-0.02);
  ctx.fillStyle = BG;
  ctx.fillRect(-260, -50, 520, 100);
  ctx.strokeStyle = BK;
  ctx.lineWidth = 2;
  ctx.strokeRect(-260, -50, 520, 100);
  ctx.font = `bold 48px "${HEADING_FONT}", serif`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`CASE #${id}`, 0, 0);
  ctx.restore();
  drawPin(W / 2, 50, "#ff3333");

  // citizen image — polaroid style, pinned
  if (img) {
    ctx.save();
    ctx.translate(W / 2 - 30, 440);
    ctx.rotate(0.05);
    ctx.strokeStyle = BK;
    ctx.lineWidth = 4;
    ctx.strokeRect(-170, -180, 340, 340);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, -170, -180, 340, 340);
    ctx.font = `400 20px "Rock Salt", cursive`;
    ctx.fillStyle = BK;
    ctx.textAlign = "center";
    ctx.fillText(`citizen #${id}`, 0, 195);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(W / 2 - 30, 440);
    ctx.rotate(0.05);
    ctx.strokeStyle = BK;
    ctx.lineWidth = 4;
    ctx.strokeRect(-170, -180, 340, 340);
    ctx.font = `bold 28px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BK;
    ctx.textAlign = "center";
    ctx.fillText("PHOTO", 0, -10);
    ctx.fillText("MISSING", 0, 25);
    ctx.restore();
  }
  drawPin(W / 2 - 30, 245, "#ff3333");

  // scattered notes
  const notes = [
    { text: "TAX EVADER", x: 120, y: 300, rot: -0.15, w: 240, h: 60 },
    { text: "LAST SEEN\nON-CHAIN", x: 830, y: 280, rot: 0.1, w: 200, h: 80 },
    { text: "DELINQUENT", x: 160, y: 720, rot: 0.08, w: 230, h: 60 },
    {
      text:
        m.class !== "UNKNOWN"
          ? `CLASS:\n${m.class.toUpperCase()}`
          : "CLASS:\nUNKNOWN",
      x: 850,
      y: 600,
      rot: -0.05,
      w: 200,
      h: 80,
    },
    {
      text: m.insured === "yes" ? "INSURED\n✓" : "NO\nINSURANCE",
      x: 870,
      y: 820,
      rot: 0.12,
      w: 180,
      h: 80,
    },
  ];

  notes.forEach((n) => {
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(n.rot);
    ctx.fillStyle = BG;
    ctx.fillRect(-n.w / 2, -n.h / 2, n.w, n.h);
    ctx.strokeStyle = BK;
    ctx.lineWidth = 1;
    ctx.strokeRect(-n.w / 2, -n.h / 2, n.w, n.h);
    ctx.font = `bold 20px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = n.text.split("\n");
    lines.forEach((line, li) => {
      ctx.fillText(line, 0, (li - (lines.length - 1) / 2) * 24);
    });
    ctx.restore();
    drawPin(n.x, n.y - n.h / 2, n.text.includes("EVADER") ? "#ff3333" : BG);
  });

  // strings connecting elements
  drawString(W / 2, 150, 120, 300);
  drawString(W / 2, 150, 830, 280);
  drawString(120, 300, 160, 720);
  drawString(830, 280, 850, 600);
  drawString(850, 600, 870, 820);
  drawString(W / 2 - 30, 660, 160, 720);

  // red circle around citizen
  ctx.save();
  ctx.strokeStyle = "#ff3333";
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(W / 2 - 30, 440, 220, 0, Math.PI * 2);
  ctx.stroke();
  // X mark
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 250, 220);
  ctx.lineTo(W / 2 + 190, 660);
  ctx.moveTo(W / 2 + 190, 220);
  ctx.lineTo(W / 2 - 250, 660);
  ctx.stroke();
  ctx.restore();

  // bottom section — case notes
  ctx.save();
  ctx.translate(W / 2, 1020);
  ctx.rotate(-0.02);
  ctx.fillStyle = BG;
  ctx.fillRect(-380, -60, 760, 180);
  ctx.strokeStyle = BK;
  ctx.lineWidth = 2;
  ctx.strokeRect(-380, -60, 760, 180);
  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "left";
  ctx.fillText("SUBJECT: CITIZEN #" + id, -350, -25);
  ctx.fillText("STATUS: MARKED FOR ELIMINATION", -350, 10);
  ctx.fillText("DEPT: INTERNAL REAPER SERVICE", -350, 45);
  ctx.fillText("PRIORITY: MAXIMUM", -350, 80);
  ctx.restore();
  drawPin(W / 2, 960, "#ff3333");

  // classified stamp
  dStamp(ctx, 200, 1200, 80, "CLASSIFIED", "", 801, "#8b1a1a");
  drawLogoStamp(ctx, W - 200, 1200, 120, 0.1, 1009);

  // footer note
  ctx.save();
  ctx.translate(W / 2, H - 50);
  ctx.font = `400 14px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText(
    "INTERNAL REAPER SERVICE // EVIDENCE ROOM // DO NOT REMOVE",
    0,
    0,
  );
  ctx.restore();

  applyDistress(ctx, 9);
}

/* ═══════════════════════════════════════════════
   TAX RECEIPT (LAW-ABIDING)
   ═══════════════════════════════════════════════ */
function drawTaxReceipt(ctx, img, id, m) {
  clear(ctx);
  dRect(ctx, 35, 35, W - 70, H - 70, 4, 900);
  dRect(ctx, 50, 50, W - 100, H - 100, 2, 901);

  // header bar
  ctx.fillStyle = BK;
  ctx.fillRect(50, 50, W - 100, 100);
  ctx.font = `bold 32px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText("DEPT. OF DEATH — TREASURY DIVISION", W / 2, 110);

  // main heading
  heading(ctx, "OFFICIAL", W / 2, 230, 80);
  heading(ctx, "TAX RECEIPT", W / 2, 310, 80);
  sLine(ctx, 100, 365, W - 100, 365, 3);

  // receipt number and date
  ctx.font = `bold 20px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "left";
  ctx.fillText(`RECEIPT NO: DT-${id}-${new Date().getFullYear()}`, 80, 405);
  ctx.textAlign = "right";
  ctx.fillText(
    `DATE: ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" })}`,
    W - 80,
    405,
  );

  sLine(ctx, 80, 430, W - 80, 430, 2);

  // citizen image
  if (img) drawImg(ctx, img, W / 2 - 160, 460, 320);
  else dRect(ctx, W / 2 - 160, 460, 320, 320, 4, 902);



  // form fields
  sLine(ctx, 80, 820, W - 80, 820, 2);
  const receiptFields = [
    ["CITIZEN ID:", `#${id}`],
    ["CLASS:", m.class !== "UNKNOWN" ? m.class.toUpperCase() : "STANDARD"],
    ["INSURANCE:", m.insured === "yes" ? "ACTIVE" : "PENDING"],
    ["TAX STATUS:", "✓ PAID"],
    ["AMOUNT:", "0.001 ETH"],
    ["PAYMENT:", "CONFIRMED"],
  ];
  receiptFields.forEach(([l, v], i) => {
    const fy = 862 + i * 44;
    ctx.font = `bold 22px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BK;
    ctx.textAlign = "left";
    ctx.fillText(l, 100, fy);
    ctx.font = `400 22px "${BODY_FONT}", monospace`;
    ctx.fillText(v, 420, fy);
    dLine(ctx, 420, fy + 10, W - 100, fy + 10);
  });

  sLine(ctx, 80, 1140, W - 80, 1140, 2);

  // status message
  ctx.font = `bold 24px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText("THIS CITIZEN IS IN GOOD STANDING.", W / 2, 1175);
  ctx.fillText("NO FURTHER ACTION REQUIRED.", W / 2, 1205);

  // stamps
  dStamp(ctx, 200, 1270, 55, "PAID", "IN FULL", 903);
  dStamp(ctx, W - 200, 1270, 55, "VALID", "", 904);

  // footer
  ctx.font = `400 14px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = BK;
  ctx.fillText(
    "DEPT. OF DEATH // TREASURY DIVISION // RETAIN FOR YOUR RECORDS",
    W / 2,
    H - 55,
  );

  drawLogoStamp(ctx, W / 2, 1230, 100, 0.05, 1010);
  applyDistress(ctx, 10);
}

/* ═══════════════════════════════════════════════
   CITIZEN ID CARD (LAW-ABIDING)
   ═══════════════════════════════════════════════ */
function drawCitizenID(ctx, img, id, m) {
  // Invert the world for this template to stand out: Pitch black background
  ctx.fillStyle = BK;
  ctx.fillRect(0, 0, W, H);

  // Subtle background grid for security feel
  ctx.strokeStyle = "rgba(204,255,0,0.05)";
  ctx.lineWidth = 1;
  for(let x=0; x<W; x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y=0; y<H; y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // The ID Card Object
  const cx = 80, cy = 100, cw = W - 160, ch = H - 200;
  
  ctx.save();
  // Card Drop Shadow
  ctx.shadowColor = "rgba(204,255,0,0.4)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = BG;
  
  // Card Shape with rounded corners
  ctx.lineJoin = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = BG; // Outer structural stroke
  ctx.strokeRect(cx, cy, cw, ch);
  ctx.fillRect(cx, cy, cw, ch);
  
  ctx.shadowColor = "transparent";

  // Lanyard clip hole at the top
  ctx.fillStyle = BK;
  ctx.fillRect(W/2 - 60, cy + 30, 120, 20);
  ctx.beginPath();
  ctx.arc(W/2 - 60, cy + 40, 10, 0, Math.PI * 2);
  ctx.arc(W/2 + 60, cy + 40, 10, 0, Math.PI * 2);
  ctx.fill();

  // Internal structural lines
  ctx.lineWidth = 4;
  ctx.strokeStyle = BK;
  ctx.strokeRect(cx + 20, cy + 80, cw - 40, ch - 100);

  // Header Zone
  ctx.fillStyle = BK;
  ctx.fillRect(cx + 20, cy + 80, cw - 40, 110);
  ctx.font = `bold 46px "${HEADING_FONT}", serif`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("INTERNAL REAPER SERVICE", W/2, cy + 120);
  ctx.font = `400 18px "${BODY_FONT}", monospace`;
  ctx.letterSpacing = "6px";
  ctx.fillText("CLASSIFIED LEVEL V SECURE ACCESS", W/2, cy + 160);
  ctx.letterSpacing = "0px";

  // Bold side strip for security badge vibe
  ctx.fillStyle = BK;
  ctx.fillRect(cx + 40, cy + 220, 40, ch - 360);
  ctx.fillStyle = BG;
  ctx.font = `bold 30px "${BODY_FONT}", monospace`;
  ctx.translate(cx + 70, cy + Math.floor((ch - 360)/2) + 220);
  ctx.rotate(-Math.PI/2);
  ctx.fillText("PERMANENT RECORD", 0, 0);
  ctx.rotate(Math.PI/2);
  ctx.translate(-(cx + 70), -(cy + Math.floor((ch - 360)/2) + 220));

  // The Photo
  const px = cx + 110, py = cy + 220, psz = 380;
  ctx.fillStyle = BK;
  ctx.fillRect(px, py, psz, psz);
  
  if (img) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, px + 10, py + 10, psz - 20, psz - 20);
    // Draw fingerprint/hologram over photo
    ctx.fillStyle = "rgba(204,255,0,0.15)";
    ctx.beginPath();
    ctx.arc(px + psz - 50, py + psz - 50, 60, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.font = `bold 32px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BG;
    ctx.textAlign = "center";
    ctx.fillText("NO PHOTO", px + psz/2, py + psz/2);
  }

  // Giant ID number
  ctx.fillStyle = BK;
  ctx.textAlign = "left";
  ctx.font = `bold 80px "${HEADING_FONT}", serif`;
  ctx.fillText(`ID# ${id}`, px + psz + 40, py + 80);
  
  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillText("AUTHORIZATION:", px + psz + 40, py + 150);
  ctx.font = `400 26px "${BODY_FONT}", monospace`;
  ctx.fillText("FULL ACCESS", px + psz + 40, py + 185);

  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillText("CLASS:", px + psz + 40, py + 245);
  ctx.font = `400 26px "${BODY_FONT}", monospace`;
  let cLabel = m.class !== "UNKNOWN" ? m.class.toUpperCase() : "UNCLASSIFIED";
  ctx.fillText(cLabel, px + psz + 40, py + 280);

  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillText("INSURANCE:", px + psz + 40, py + 340);
  ctx.font = `400 26px "${BODY_FONT}", monospace`;
  ctx.fillText(m.insured === "yes" ? "ACTIVE" : "NONE", px + psz + 40, py + 375);

  // Horizontal divider
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(px, py + psz + 40);
  ctx.lineTo(cx + cw - 40, py + psz + 40);
  ctx.stroke();

  // Bottom section - Barcode & Security Data
  const bx = px, by = py + psz + 80, bw = 500, bh = 80;
  
  // Custom thick barcode logic matching badge scale
  const barR = sR(parseInt(id) * 3 || 101);
  ctx.fillStyle = BK;
  let bPos = bx;
  while (bPos < bx + bw) {
    const barW = 2 + Math.floor(barR() * 8);
    const gap = 2 + Math.floor(barR() * 6);
    ctx.fillRect(bPos, by, barW, bh);
    bPos += barW + gap;
  }
  
  ctx.textAlign = "center";
  ctx.font = `bold 16px "${BODY_FONT}", monospace`;
  ctx.fillText(`>>> SYSTEM LOG [${id}:${CONTRACT.slice(2, 8).toUpperCase()}] <<<`, bx + bw/2, by + bh + 25);

  // Add the reaper icon large in the blank space below
  drawReaper(ctx, W/2 - 121, by + bh + 50, 342, 1);

  // Official Seal
  drawLogoStamp(ctx, cx + cw - 120, by + 40, 140, 0, 999);
  
  // Overlaid distressed stamp indicating card validation
  dStamp(ctx, px + 34, py + 34, 60, "ACTIVE", "", 124, "#ff57d9");
  
  ctx.restore();

  // Apply minimal, hard physical distress distinct to the black background
  addGrain(ctx, 0.04, 2);
  addScratches(ctx, 20, 500);
}

/* ═══════════════════════════════════════════════
   COMMENDATION (LAW-ABIDING)
   ═══════════════════════════════════════════════ */
function drawCommendation(ctx, img, id, m) {
  clear(ctx);

  // ornate double border
  dRect(ctx, 30, 30, W - 60, H - 60, 6, 1100);
  dRect(ctx, 50, 50, W - 100, H - 100, 2, 1101);

  // corner decorations (star shapes)
  const cornerStar = (cx, cy) => {
    ctx.save();
    ctx.fillStyle = BK;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rr = i % 2 === 0 ? 20 : 8;
      i === 0
        ? ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a))
        : ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  cornerStar(80, 80);
  cornerStar(W - 80, 80);
  cornerStar(80, H - 80);
  cornerStar(W - 80, H - 80);

  // decorative top bar
  ctx.fillStyle = BK;
  ctx.fillRect(100, 70, W - 200, 4);
  ctx.fillRect(100, 78, W - 200, 2);

  // department header
  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText("DEPT. OF DEATH — OFFICE OF THE REAPER", W / 2, 120);

  // main heading
  heading(ctx, "CERTIFICATE OF", W / 2, 200, 60);
  heading(ctx, "COMMENDATION", W / 2, 280, 80);

  // decorative lines
  sLine(ctx, 150, 330, W - 150, 330, 3);
  ctx.fillStyle = BK;
  ctx.fillRect(W / 2 - 30, 325, 60, 12);

  // awarded to
  body(ctx, "AWARDED TO", W / 2, 390, 28);
  heading(ctx, `CITIZEN #${id}`, W / 2, 450, 72);

  // reason
  sLine(ctx, 200, 500, W - 200, 500, 2);
  ctx.font = `400 22px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText("For outstanding tax compliance", W / 2, 545);
  ctx.fillText("and continued survival within", W / 2, 575);
  ctx.fillText("the Death & Taxes ecosystem.", W / 2, 605);
  sLine(ctx, 200, 640, W - 200, 640, 2);

  // citizen image
  if (img) drawImg(ctx, img, W / 2 - 175, 670, 350);
  else dRect(ctx, W / 2 - 175, 670, 350, 350, 4, 1102);



  // class and insurance
  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText(
    m.class !== "UNKNOWN"
      ? `CLASS: ${m.class.toUpperCase()} — ${m.insured === "yes" ? "INSURED" : "UNINSURED"}`
      : "A CITIZEN IN GOOD STANDING",
    W / 2,
    1060,
  );

  sLine(ctx, 100, 1095, W - 100, 1095, 2);

  // signature
  ctx.font = `bold 20px "${BODY_FONT}", monospace`;
  ctx.textAlign = "left";
  ctx.fillText("SIGNED:", 100, 1135);
  ctx.font = `400 24px "Rock Salt", cursive`;
  ctx.fillText("the tax man", 260, 1137);
  dLine(ctx, 260, 1148, 480, 1148);

  ctx.font = `bold 20px "${BODY_FONT}", monospace`;
  ctx.fillText("DATE:", 520, 1135);
  ctx.font = `400 22px "Rock Salt", cursive`;
  ctx.fillText(
    new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    640,
    1137,
  );
  dLine(ctx, 640, 1148, 860, 1148);

  // stamps
  dStamp(ctx, 200, 1240, 55, "HONORED", "", 1103);
  dStamp(ctx, W - 200, 1240, 55, "VALID", "", 1104);

  // decorative bottom bar
  ctx.fillStyle = BK;
  ctx.fillRect(100, H - 78, W - 200, 2);
  ctx.fillRect(100, H - 72, W - 200, 4);

  // footer
  ctx.font = `400 14px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = BK;
  ctx.fillText(
    "DEPT. OF DEATH // THIS COMMENDATION DOES NOT GUARANTEE SURVIVAL",
    W / 2,
    H - 45,
  );

  drawLogoStamp(ctx, W / 2, 1200, 100, 0.05, 1012);
  applyDistress(ctx, 12);
}

function drawFvckTax(ctx, img, id, m) {
  clear(ctx);

  if (img) {
    const imgAspect = img.width / img.height;
    
    // The canvas is now W x W (1080x1080) natively for this template.
    const sqSize = W;
    const sqX = 0;
    const sqY = 0;

    let sx, sy, sWidth, sHeight;

    if (imgAspect > 1) {
      // Image is wider than a square
      sHeight = img.height;
      sWidth = img.height;
      sx = (img.width - sWidth) / 2;
      sy = 0;
    } else {
      // Image is taller than a square
      sWidth = img.width;
      sHeight = img.width;
      sx = 0;
      sy = (img.height - sHeight) / 2;
    }

    ctx.fillStyle = BK;
    ctx.fillRect(0, 0, W, W);
    
    // Draw the perfectly cropped square image in the center
    ctx.drawImage(img, sx, sy, sWidth, sHeight, sqX, sqY, sqSize, sqSize);

    if (fvckTaxImg) {
      // Also draw the overlay square exactly over the image
      ctx.drawImage(fvckTaxImg, sqX, sqY, sqSize, sqSize);
    }
  } else {
    ctx.fillStyle = BK;
    ctx.fillRect(0, 0, W, W);
    if (fvckTaxImg) {
      ctx.drawImage(fvckTaxImg, 0, 0, W, W);
    }
  }

  ctx.shadowColor = "transparent";
  ctx.shadowOffsetY = 0;
  ctx.shadowOffsetX = 0;


  applyDistress(ctx, 42); // Heavy distress on this rebel piece
}

/* ═══════════════════════════════════════════════
   REAPER SERVICE
   ═══════════════════════════════════════════════ */
function drawReaperService(ctx, img, id, m) {
  clear(ctx);

  if (img) {
    const imgAspect = img.width / img.height;
    const sqSize = W;
    let sx, sy, sWidth, sHeight;

    if (imgAspect > 1) {
      sHeight = img.height;
      sWidth = img.height;
      sx = (img.width - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = img.width;
      sHeight = img.width;
      sx = 0;
      sy = (img.height - sHeight) / 2;
    }

    ctx.fillStyle = BK;
    ctx.fillRect(0, 0, W, W);
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sqSize, sqSize);

    if (reaperServiceImg) {
      ctx.drawImage(reaperServiceImg, 0, 0, W, W);
    }
  } else {
    ctx.fillStyle = BK;
    ctx.fillRect(0, 0, W, W);
    if (reaperServiceImg) {
      ctx.drawImage(reaperServiceImg, 0, 0, W, W);
    }
  }

  ctx.shadowColor = "transparent";
  ctx.shadowOffsetY = 0;
  ctx.shadowOffsetX = 0;
}

/* ═══════════════════════════════════════════════
   ELIMINATION CERTIFICATE
   ═══════════════════════════════════════════════ */
function drawElimCert(ctx, img, id, m) {
  clear(ctx);

  // Government document style
  dRect(ctx, 30, 30, W - 60, H - 60, 6, 3000);
  dRect(ctx, 50, 50, W - 100, H - 100, 2, 3001);

  // Header
  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText("DEPARTMENT OF DEATH — BUREAU OF ELIMINATIONS", W / 2, 95);

  sLine(ctx, 80, 112, W - 80, 112, 3);

  heading(ctx, "CERTIFICATE OF", W / 2, 170, 48);
  heading(ctx, "ELIMINATION", W / 2, 232, 76);

  sLine(ctx, 80, 272, W - 80, 272, 3);

  body(ctx, "THIS DOCUMENT HEREBY CERTIFIES THAT", W / 2, 316, 22);
  heading(ctx, `CITIZEN #${id}`, W / 2, 370, 60);

  body(ctx, `CLASS: ${(m.class || "UNKNOWN").toUpperCase()}`, W / 2, 418, 24);

  // Image with greyed treatment — 30% larger
  const iS = 442, iX = W / 2 - iS / 2, iY = 470;
  if (img) {
    ctx.save();
    ctx.filter = "grayscale(100%) contrast(0.8)";
    ctx.drawImage(img, iX, iY, iS, iS);
    ctx.filter = "none";
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = BK;
    ctx.fillRect(iX, iY, iS, iS);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = BK;
    ctx.lineWidth = 4;
    ctx.strokeRect(iX, iY, iS, iS);
    ctx.restore();
  } else {
    dRect(ctx, iX, iY, iS, iS, 4, 3002);
    body(ctx, "NO IMAGE", W / 2, iY + iS / 2, 36);
  }

  // Red ELIMINATED stamp
  dStamp(ctx, W / 2, iY + iS / 2, 160, "ELIMINATED", "CONFIRMED", 3003, "#8b1a1a");

  body(ctx, "HAS BEEN PERMANENTLY REMOVED FROM THE REGISTRY", W / 2, iY + iS + 56, 22);

  dLine(ctx, 200, iY + iS + 96, W - 200, iY + iS + 96);
  body(ctx, "AUTHORIZED BY THE REAPER", W / 2, iY + iS + 126, 20);

  drawLogoStamp(ctx, 200, H - 140, 100, -0.1, 3010);
  drawReaper(ctx, W - 250, H - 230, 180, 0.15);

  // Footer
  ctx.fillStyle = BK;
  ctx.fillRect(80, H - 80, W - 160, 3);
  ctx.font = `bold 16px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("DEPT. OF DEATH // THIS CERTIFICATE IS FINAL AND IRREVOCABLE", W / 2, H - 50);

  applyDistress(ctx, 8);
}

/* ═══════════════════════════════════════════════
   RIP POSTER
   ═══════════════════════════════════════════════ */
function drawRipPoster(ctx, img, id, m) {
  clear(ctx);

  // Outer frame
  dRect(ctx, 30, 30, W - 60, H - 60, 8, 3100);
  dRect(ctx, 50, 50, W - 100, H - 100, 3, 3101);

  // Corner decorations
  [[60, 60], [W - 60, 60], [60, H - 60], [W - 60, H - 60]].forEach(([cx, cy]) => {
    ctx.fillStyle = BK;
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
  });

  heading(ctx, "REST IN", W / 2, 140, 120);
  heading(ctx, "PIECES", W / 2, 260, 140);

  sLine(ctx, 100, 330, W - 100, 330, 4);
  body(ctx, "FORMERLY A TAX-PAYING CITIZEN", W / 2, 370, 28);
  sLine(ctx, 100, 400, W - 100, 400, 4);

  // Grayscale image
  const iS = 440, iX = W / 2 - iS / 2, iY = 430;
  if (img) {
    ctx.save();
    ctx.filter = "grayscale(100%)";
    drawImg(ctx, img, iX, iY, iS);
    ctx.filter = "none";
    ctx.restore();
  } else {
    dRect(ctx, iX, iY, iS, iS, 6, 3102);
    body(ctx, "CITIZEN", W / 2, iY + iS / 2 - 20, 48);
    body(ctx, "IMAGE", W / 2, iY + iS / 2 + 30, 48);
  }

  sLine(ctx, 100, 920, W - 100, 920, 4);
  heading(ctx, `CITIZEN #${id}`, W / 2, 970, 56);
  body(ctx, m.class !== "UNKNOWN" ? `CLASS: ${m.class.toUpperCase()}` : "CRIME: EXISTING", W / 2, 1030, 28);

  // Diagonal ribbon
  ctx.save();
  ctx.translate(W / 2, iY + iS / 2);
  ctx.rotate(-0.3);
  ctx.fillStyle = "#8b1a1a";
  ctx.fillRect(-250, -25, 500, 50);
  ctx.font = `bold 32px "${HEADING_FONT}", serif`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ELIMINATED", 0, 0);
  ctx.restore();

  drawReaper(ctx, 60, H - 300, 220, 0.18);

  body(ctx, "— DEPT. OF DEATH —", W / 2, 1100, 24);
  body(ctx, "THEY LIVED. THEY WERE TAXED. THEY PERISHED.", W / 2, H - 80, 18);

  applyDistress(ctx, 5);
}

/* ═══════════════════════════════════════════════
   BODY BAG TAG
   ═══════════════════════════════════════════════ */
function drawBodyBagTag(ctx, img, id, m) {
  clear(ctx);

  // Inverted colors: black background, lime text
  ctx.fillStyle = BK;
  ctx.fillRect(0, 0, W, H);

  // Border in lime
  ctx.strokeStyle = BG;
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.lineWidth = 2;
  ctx.strokeRect(35, 35, W - 70, H - 70);

  // Toe tag hole
  ctx.fillStyle = BG;
  ctx.beginPath();
  ctx.arc(W / 2, 70, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BK;
  ctx.beginPath();
  ctx.arc(W / 2, 70, 12, 0, Math.PI * 2);
  ctx.fill();

  // Header
  ctx.font = `bold 28px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText("DEPT. OF DEATH — BODY BAG DIVISION", W / 2, 130);

  // Line
  ctx.strokeStyle = BG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 155);
  ctx.lineTo(W - 80, 155);
  ctx.stroke();

  // Main heading
  ctx.font = `bold 84px "${HEADING_FONT}", serif`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText(`BODY BAG`, W / 2, 250);
  ctx.font = `bold 120px "${HEADING_FONT}", serif`;
  ctx.fillText(`#${id}`, W / 2, 370);

  // Image with green border
  const iS = 350, iX = W / 2 - iS / 2, iY = 420;
  if (img) {
    ctx.drawImage(img, iX, iY, iS, iS);
    ctx.strokeStyle = BG;
    ctx.lineWidth = 4;
    ctx.strokeRect(iX, iY, iS, iS);
  } else {
    ctx.strokeStyle = BG;
    ctx.lineWidth = 4;
    ctx.strokeRect(iX, iY, iS, iS);
    ctx.font = `bold 48px "${HEADING_FONT}", serif`;
    ctx.fillStyle = BG;
    ctx.fillText("NO IMAGE", W / 2, iY + iS / 2);
  }

  // Details
  ctx.font = `bold 28px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "left";
  const detailY = iY + iS + 50;
  ctx.fillText(`SUBJECT: CITIZEN #${id}`, 80, detailY);
  ctx.fillText(`CLASS: ${(m.class || "UNKNOWN").toUpperCase()}`, 80, detailY + 45);
  ctx.fillText(`INSURANCE: ${m.insured === "yes" ? "YES (VOIDED)" : "NONE"}`, 80, detailY + 90);
  ctx.fillText(`STATUS: DECEASED`, 80, detailY + 135);

  // Cause of death
  ctx.strokeStyle = BG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, detailY + 170);
  ctx.lineTo(W - 80, detailY + 170);
  ctx.stroke();
  ctx.font = `bold 24px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("CAUSE OF DEATH: TAXATION", W / 2, detailY + 210);

  // Footer
  ctx.strokeStyle = BG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, H - 80);
  ctx.lineTo(W - 80, H - 80);
  ctx.stroke();
  ctx.font = `bold 16px "${BODY_FONT}", monospace`;
  ctx.fillText("DO NOT OPEN — PROPERTY OF THE DEPT. OF DEATH", W / 2, H - 50);

  // Plastic bag effects — clip around image area
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, iY);
  ctx.rect(0, iY, iX, iS);
  ctx.rect(iX + iS, iY, W - iX - iS, iS);
  ctx.rect(0, iY + iS, W, H - iY - iS);
  ctx.clip();

  // Diagonal sheen / light reflection streaks
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#ffffff";
  for (let i = -2; i < 6; i++) {
    const x = i * 260 - 100;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 120, 0);
    ctx.lineTo(x - H * 0.3 + 120, H);
    ctx.lineTo(x - H * 0.3, H);
    ctx.closePath();
    ctx.fill();
  }

  // Plastic wrinkle / crease lines
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  const r = sR(3300);
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    const startX = r() * W;
    const startY = r() * H;
    ctx.moveTo(startX, startY);
    for (let j = 0; j < 4; j++) {
      ctx.lineTo(startX + (r() - 0.3) * 400, startY + (r() - 0.3) * 300);
    }
    ctx.stroke();
  }

  // Glossy gradient along edges (like light catching a bag)
  const edgeGrad = ctx.createLinearGradient(0, 0, W, H);
  edgeGrad.addColorStop(0, "rgba(255,255,255,0.07)");
  edgeGrad.addColorStop(0.3, "rgba(255,255,255,0)");
  edgeGrad.addColorStop(0.7, "rgba(255,255,255,0)");
  edgeGrad.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();

  // Zipper teeth across the top (outside clip)
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = BG;
  const zipY = 18;
  const toothW = 12, toothH = 8, toothGap = 6;
  for (let x = 60; x < W - 60; x += toothW + toothGap) {
    ctx.fillRect(x, zipY, toothW, toothH);
  }
  // Zipper pull tab
  ctx.globalAlpha = 0.6;
  ctx.fillRect(W / 2 - 8, zipY - 4, 16, toothH + 12);
  ctx.fillRect(W / 2 - 14, zipY + toothH + 4, 28, 8);
  ctx.restore();
}

/* ═══════════════════════════════════════════════
   WASTED (GTA-style) — square 1080x1080
   Downloads as animated GIF with text fade-in.
   ═══════════════════════════════════════════════ */

/** Draw the darkened/desaturated base image (no text).
 *  If evImg is provided, it is used instead of img for the dead frame. */
function _wastedBase(ctx, img, S, evImg) {
  ctx.clearRect(0, 0, S, S);
  const src = evImg || img;
  if (src) {
    const scale = Math.max(S / src.width, S / src.height);
    const sw = src.width * scale, sh = src.height * scale;
    ctx.drawImage(src, (S - sw) / 2, (S - sh) / 2, sw, sh);
  } else {
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, S, S);
  }
  if (!evImg) {
    // No evader — desaturate + darken citizen image
    const imageData = ctx.getImageData(0, 0, S, S);
    const px = imageData.data;
    for (let i = 0; i < px.length; i += 4) {
      const gray = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
      const dark = gray * 0.65;
      px[i] = dark; px[i + 1] = dark; px[i + 2] = dark;
    }
    ctx.putImageData(imageData, 0, 0);
  }
  // Dark vignette
  const vig = ctx.createRadialGradient(S / 2, S / 2, S * 0.15, S / 2, S / 2, S * 0.7);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.6, "rgba(0,0,0,0.25)");
  vig.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, S, S);
}

/** Draw the WASTED text at a given alpha. */
function _wastedText(ctx, S, alpha, id, m) {
  const textY = S / 2 + 20;
  const fontSize = Math.round(S * 0.15);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `900 ${fontSize}px "${HEADING_FONT}", Impact, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Black outer stroke
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.round(fontSize * 0.12);
  ctx.lineJoin = "round";
  ctx.strokeText("WASTED", S / 2, textY);

  // Lime fill (#dfff00)
  ctx.fillStyle = BG;
  ctx.fillText("WASTED", S / 2, textY);

  // Bright highlight pass
  ctx.globalAlpha = alpha * 0.2;
  ctx.fillStyle = "#fff";
  ctx.fillText("WASTED", S / 2, textY - 2);
  ctx.globalAlpha = 1;
  ctx.restore();

  // Scan lines
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#000";
  for (let y = 0; y < S; y += 4) ctx.fillRect(0, y, S, 2);
  ctx.globalAlpha = 1;
  ctx.restore();

}

/** Static preview renderer (final frame). */
function drawWasted(ctx, img, id, m, evImg) {
  const S = W;
  _wastedBase(ctx, img, S, evImg);
  _wastedText(ctx, S, 1, id, m);
}

/** Generate animated GIF: citizen → cross-fade to darkened evader → text fade-in → hold.
 *  Returns a Promise<Blob>. gifSize controls resolution (default 480). */
async function buildWastedGif(img, id, m, gifSize = 480, evImg = null) {
  const S = gifSize;
  const cvs = document.createElement("canvas");
  cvs.width = S; cvs.height = S;
  const ctx = cvs.getContext("2d", { willReadFrequently: true });

  const enc = new GifEncoder(S, S);

  // Helper: draw image full-bleed
  const drawImg = (src) => {
    ctx.clearRect(0, 0, S, S);
    if (src) {
      const scale = Math.max(S / src.width, S / src.height);
      const sw = src.width * scale, sh = src.height * scale;
      ctx.drawImage(src, (S - sw) / 2, (S - sh) / 2, sw, sh);
    } else {
      ctx.fillStyle = "#444";
      ctx.fillRect(0, 0, S, S);
    }
  };

  // Grab clean citizen pixel data
  drawImg(img);
  const cleanData = ctx.getImageData(0, 0, S, S);

  // Grab target pixel data: evader raw (already dark art) or darkened citizen
  drawImg(evImg || img);
  const evaderRaw = ctx.getImageData(0, 0, S, S);
  const darkPixels = new Uint8ClampedArray(evaderRaw.data.length);
  if (evImg) {
    // Evader art is already dark — use as-is
    darkPixels.set(evaderRaw.data);
  } else {
    // No evader image — darken/desaturate citizen
    for (let i = 0; i < evaderRaw.data.length; i += 4) {
      const gray = evaderRaw.data[i] * 0.299 + evaderRaw.data[i + 1] * 0.587 + evaderRaw.data[i + 2] * 0.114;
      const dark = gray * 0.65;
      darkPixels[i] = dark; darkPixels[i + 1] = dark; darkPixels[i + 2] = dark; darkPixels[i + 3] = 255;
    }
  }

  // ── Phase 1: Original citizen image — hold 20 frames × 100ms = 2s ──
  for (let i = 0; i < 20; i++) enc.addFrame(cleanData, 100);

  // ── Phase 2: Cross-fade citizen → darkened evader + vignette (20 frames × 80ms = 1.6s) ──
  for (let f = 1; f <= 20; f++) {
    const t = f / 20;
    const blended = ctx.createImageData(S, S);
    for (let i = 0; i < cleanData.data.length; i += 4) {
      blended.data[i] = Math.round(cleanData.data[i] + (darkPixels[i] - cleanData.data[i]) * t);
      blended.data[i + 1] = Math.round(cleanData.data[i + 1] + (darkPixels[i + 1] - cleanData.data[i + 1]) * t);
      blended.data[i + 2] = Math.round(cleanData.data[i + 2] + (darkPixels[i + 2] - cleanData.data[i + 2]) * t);
      blended.data[i + 3] = 255;
    }
    ctx.putImageData(blended, 0, 0);
    // Vignette fades in with darkness
    const vig = ctx.createRadialGradient(S / 2, S / 2, S * 0.15, S / 2, S / 2, S * 0.7);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(0.6, `rgba(0,0,0,${0.25 * t})`);
    vig.addColorStop(1, `rgba(0,0,0,${0.65 * t})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, S, S);
    enc.addFrame(ctx.getImageData(0, 0, S, S), 80);
  }

  // ── Phase 3: WASTED text slowly fades in (25 frames × 120ms = 3s) ──
  for (let i = 1; i <= 25; i++) {
    _wastedBase(ctx, img, S, evImg);
    _wastedText(ctx, S, i / 25, id, m);
    enc.addFrame(ctx.getImageData(0, 0, S, S), 120);
  }

  // ── Phase 4: Hold final frame (15 frames × 120ms = ~1.8s) ──
  const finalData = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < 15; i++) enc.addFrame(finalData, 120);

  return enc.finish();
}

function drawBlank(ctx, img) {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  if (img) {
    const scale = Math.max(cw / img.width, ch / img.height);
    const sw = img.width * scale;
    const sh = img.height * scale;
    ctx.drawImage(img, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
  }
}

const RENDERERS = {
  tombstone: drawTombstone,
  wanted: drawWanted,
  deathcert: drawDeathCert,
  mugshot: drawMugshot,
  audit: drawAudit,
  obituary: drawObituary,
  toetag: drawToeTag,
  rapsheet: drawRapSheet,
  evidence: drawEvidenceBoard,
  taxreceipt: drawTaxReceipt,
  citizenid: drawCitizenID,
  commendation: drawCommendation,
  fvcktax: drawFvckTax,
  reaperservice: drawReaperService,
  elimcert: drawElimCert,
  ripposter: drawRipPoster,
  bodybagtag: drawBodyBagTag,
  wasted: drawWasted,
  blank: drawBlank,
};

/* ═══════════════════════════════════════════════
   APP COMPONENT
   ═══════════════════════════════════════════════ */

const EMPTY_META = {
  class: "UNKNOWN",
  insured: "",
  status: "",
  allTraits: {},
};

export default function App() {
  const { dark, toggle: toggleTheme, colors } = useTheme();
  const { muted, toggle: toggleSound, playClick, playStamp } = useSound();

  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("crew")) return "citizenship";
    if (params.get("view")) return params.get("view");
    return "registry";
  });
  const [wallet, setWallet] = useState("");
  const [ownedNFTs, setOwnedNFTs] = useState([]);
  const [cid, setCid] = useState("");
  const [img, setImg] = useState(null);
  const [evaderImg, setEvaderImg] = useState(null);
  const [tpl, setTpl] = useState("blank");
  const [meta, setMeta] = useState(EMPTY_META);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingToken, setFetchingToken] = useState(false);
  const [evaderId, setEvaderId] = useState("");
  const [fetchingEvader, setFetchingEvader] = useState(false);
  const [psychId, setPsychId] = useState("");
  const [fetchingPsych, setFetchingPsych] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const cvs = useRef(null);
  const file = useRef(null);

  const [mobile, setMobile] = useState(window.innerWidth < 768);
  const [tickerVals, setTickerVals] = useState({ day: 2, time: "00:00 UTC", taxRate: "0.00138" });

  // Dropdown state
  const [intelOpen, setIntelOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  // Batch export state
  const [batchExporting, setBatchExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");

  // Share card state
  const [showShareCard, setShowShareCard] = useState(false);

  // Download background options
  const [transparentBg, setTransparentBg] = useState(true);
  const [bgColor, setBgColor] = useState("#dfff00");

  const [menuOpen, setMenuOpen] = useState(false);
  const navTo = (v) => {
    playClick();
    setView(v);
    setIntelOpen(false);
    setReportsOpen(false);
    setMenuOpen(false);
  };

  const [easterEgg, setEasterEgg] = useState(false);

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);

    // Konami code easter egg
    const konami = [38,38,40,40,37,39,37,39,66,65];
    let pos = 0;
    const onKey = (e) => {
      if (e.keyCode === konami[pos]) {
        pos++;
        if (pos === konami.length) {
          setEasterEgg(true);
          pos = 0;
          setTimeout(() => setEasterEgg(false), 6000);
        }
      } else {
        pos = 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => {
    const updateTicker = () => {
      const now = new Date();
      // Base: March 2, 2026 UTC 00:00:00
      const baseDate = Date.UTC(2026, 2, 2); 
      const diffMs = now.getTime() - baseDate;
      const day = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      const taxValue = (day * 0.00069).toFixed(5);
      
      const hh = now.getUTCHours().toString().padStart(2, "0");
      const mm = now.getUTCMinutes().toString().padStart(2, "0");
      
      setTickerVals({
        day,
        time: `${hh}:${mm} UTC`,
        taxRate: taxValue
      });
    };
    
    updateTicker();
    const int = setInterval(updateTicker, 60000);
    return () => clearInterval(int);
  }, []);

  useEffect(() => {
    loadAssets().then(() => setReady(true));
  }, []);

  const render = useCallback(() => {
    const c = cvs.current;
    if (!c || !ready) return;
    c.width = W;
    c.height = (tpl === "fvcktax" || tpl === "reaperservice" || tpl === "blank" || tpl === "wasted") ? W : H;
    if (tpl === "wasted") {
      drawWasted(c.getContext("2d"), img, cid || "????", meta, evaderImg);
    } else {
      RENDERERS[tpl](c.getContext("2d"), img, cid || "????", meta);
    }
  }, [tpl, img, cid, ready, meta, evaderImg]);

  useEffect(() => {
    render();
    setGifPreviewUrl(null);
  }, [render]);

  // Auto-fetch evader image when citizen image loads (for WASTED template transition)
  // Evader names contain citizen ID; check Boneyard cache for image URL
  useEffect(() => {
    if (!cid || !img) { setEvaderImg(null); return; }
    let cancelled = false;
    const tid = setTimeout(async () => {
      try {
        let evUrl = null;

        // Check Boneyard localStorage cache (populated when user visits Boneyard)
        try {
          const raw = JSON.parse(localStorage.getItem("dt_boneyard_cache"));
          if (raw?.tokens) {
            const match = raw.tokens.find((t) => {
              const m = t.name && t.name.match(/(\d+)\s*$/);
              return m && m[1] === String(cid);
            });
            if (match?.image) evUrl = match.image;
          }
        } catch {}

        // Fallback: construct IPFS URL directly (known CID pattern for evader images)
        if (!evUrl) {
          evUrl = `https://nftstorage.link/ipfs/QmPLLa1FwoyA3rDH3GuHZ3zgZWew6EUJcSDTztVCs17oii/citizen-${cid}.png`;
        }

        if (cancelled) return;
        const loaded = await loadImage(evUrl);
        if (!cancelled) setEvaderImg(loaded);
      } catch {
        if (!cancelled) setEvaderImg(null);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(tid); };
  }, [cid, img]);

  // Fetch wallet NFTs
  const handleWalletFetch = async () => {
    const w = wallet.trim();
    if (!w || (!w.startsWith("0x") && !w.endsWith(".eth"))) {
      setError("Enter a valid wallet address or ENS name");
      return;
    }
    setLoading(true);
    setError("");
    setOwnedNFTs([]);
    try {
      const nfts = await fetchWalletNFTs(w);
      if (nfts.length === 0) {
        setError("No Death & Taxes NFTs found in this wallet");
      }
      setOwnedNFTs(nfts);
    } catch (e) {
      setError(e.message || "Failed to fetch NFTs");
    }
    setLoading(false);
  };

  // Select NFT from grid
  const selectNFT = async (nft) => {
    setCid(nft.id);
    setMeta(nft);
    if (nft.image) {
      try {
        const loaded = await loadImage(nft.image);
        setImg(loaded);
      } catch {
        setImg(null);
      }
    }
  };

  // Fetch single token by ID
  const handleIdFetch = async () => {
    if (!cid) return;
    setFetchingToken(true);
    setError("");
    try {
      const nft = await fetchTokenById(cid);
      setMeta(nft);
      if (nft.image) {
        const loaded = await loadImage(nft.image);
        setImg(loaded);
      }
    } catch (e) {
      setError(e.message || "Token not found");
    }
    setFetchingToken(false);
  };

  // Fetch evader token by ID
  const handleEvaderFetch = async () => {
    if (!evaderId) return;
    setFetchingEvader(true);
    setError("");
    try {
      const nft = await fetchEvaderById(evaderId);
      setCid(nft.id);
      setMeta(nft);
      if (nft.image) {
        const loaded = await loadImage(nft.image);
        setImg(loaded);
      }
    } catch (e) {
      setError(e.message || "Evader not found");
    }
    setFetchingEvader(false);
  };

  // Fetch evader psych image from IPFS
  const handlePsychFetch = async () => {
    if (!psychId) return;
    setFetchingPsych(true);
    setError("");
    try {
      const url = `https://ipfs.io/ipfs/QmUHT2Bvu7QruLPFdVzXYTRa1f1Fd3DdpmzHcryc8ycqSn/citizen-${psychId}.png`;
      const loaded = await loadImage(url);
      setImg(loaded);
      setCid(psychId);
    } catch (e) {
      setError("Failed to load Lawbreaker image");
    }
    setFetchingPsych(false);
  };

  // Manual image upload
  const onFile = (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    const rd = new FileReader();
    rd.onload = (e) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => setImg(i);
      i.src = e.target.result;
    };
    rd.readAsDataURL(f);
  };

  const [gifExporting, setGifExporting] = useState(false);
  const [gifPreviewUrl, setGifPreviewUrl] = useState(null);
  const [fullPreview, setFullPreview] = useState(null); // data URL for full-size preview modal

  const dl = async () => {
    const c = cvs.current;
    if (!c) return;
    playStamp();

    // WASTED template → animated GIF
    if (tpl === "wasted") {
      setGifExporting(true);
      try {
        const blob = await buildWastedGif(img, cid || "0", meta, 480, evaderImg);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = `citizen-${cid || "unknown"}-wasted.gif`;
        a.href = url;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (e) { console.error("GIF export failed", e); }
      setGifExporting(false);
      return;
    }

    let src = c;
    if (!transparentBg) {
      const tmp = document.createElement("canvas");
      tmp.width = c.width;
      tmp.height = c.height;
      const tctx = tmp.getContext("2d");
      tctx.fillStyle = bgColor;
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      tctx.drawImage(c, 0, 0);
      src = tmp;
    }
    const a = document.createElement("a");
    a.download = `citizen-${cid || "unknown"}-${tpl}.png`;
    a.href = src.toDataURL("image/png");
    a.click();
  };

  // Batch export
  const batchExport = async () => {
    if (!ownedNFTs.length || batchExporting) return;
    setBatchExporting(true);
    const offscreen = document.createElement("canvas");
    offscreen.width = W;
    offscreen.height = (tpl === "fvcktax" || tpl === "reaperservice" || tpl === "blank" || tpl === "wasted") ? W : H;
    const octx = offscreen.getContext("2d");

    for (let i = 0; i < ownedNFTs.length; i++) {
      const nft = ownedNFTs[i];
      setBatchProgress(`EXPORTING ${i + 1}/${ownedNFTs.length} — #${nft.id}`);
      let nftImg = null;
      if (nft.image) {
        try { nftImg = await loadImage(nft.image); } catch {}
      }
      offscreen.height = (tpl === "fvcktax" || tpl === "reaperservice" || tpl === "blank" || tpl === "wasted") ? W : H;
      RENDERERS[tpl](octx, nftImg, nft.id, nft);
      let src = offscreen;
      if (!transparentBg) {
        const tmp = document.createElement("canvas");
        tmp.width = offscreen.width;
        tmp.height = offscreen.height;
        const tctx = tmp.getContext("2d");
        tctx.fillStyle = bgColor;
        tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.drawImage(offscreen, 0, 0);
        src = tmp;
      }
      const a = document.createElement("a");
      a.download = `citizen-${nft.id}-${tpl}.png`;
      a.href = src.toDataURL("image/png");
      a.click();
      await new Promise((r) => setTimeout(r, 300));
    }
    setBatchExporting(false);
    setBatchProgress("");
  };

  // Theme-aware colors for UI (NOT canvas renderers — those always use BG/BK)
  const uiBg = colors.bg;
  const uiFg = colors.fg;

  // Styles
  const S = {
    input: {
      width: "100%",
      background: colors.inputBg,
      border: `2px solid ${uiFg}`,
      color: uiFg,
      padding: mobile ? "10px 12px" : "12px 16px",
      fontSize: mobile ? 16 : 22,
      fontFamily: `"${BODY_FONT}", monospace`,
      fontWeight: 400,
      letterSpacing: 1,
      outline: "none",
      boxSizing: "border-box",
    },
    btn: {
      background: uiFg,
      color: uiBg,
      border: `2px solid ${uiFg}`,
      padding: mobile ? "10px 14px" : "12px 20px",
      fontFamily: `"${BODY_FONT}", monospace`,
      fontWeight: 400,
      fontSize: mobile ? 16 : 22,
      letterSpacing: 3,
      cursor: "pointer",
      transition: "all 0.15s",
    },
    btnOutline: {
      background: "transparent",
      color: uiFg,
      border: `2px solid ${uiFg}`,
      padding: mobile ? "10px 14px" : "12px 20px",
      fontFamily: `"${BODY_FONT}", monospace`,
      fontWeight: 400,
      fontSize: mobile ? 16 : 22,
      letterSpacing: 3,
      cursor: "pointer",
      transition: "all 0.15s",
    },
    label: {
      fontSize: mobile ? 14 : 18,
      letterSpacing: 3,
      display: "block",
      marginBottom: mobile ? 6 : 10,
      fontWeight: 400,
      textTransform: "uppercase",
      lineHeight: 1,
    },
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: uiBg,
        color: uiFg,
        fontFamily: `"${BODY_FONT}", monospace`,
        fontWeight: 400,
        fontSize: 22,
        textTransform: "lowercase",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* EASTER EGG OVERLAY */}
      {easterEgg && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.92)", color: "#dfff00",
          animation: "fadeIn 0.3s ease-out",
          pointerEvents: "none",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: mobile ? 60 : 120, fontFamily: `"${HEADING_FONT}", serif`, lineHeight: 1 }}>
              DEATH IS CERTAIN
            </div>
            <div style={{ fontSize: mobile ? 24 : 48, fontFamily: `"${HEADING_FONT}", serif`, marginTop: 16, opacity: 0.7 }}>
              TAXES ARE FOREVER
            </div>
            <div style={{ fontSize: 16, marginTop: 30, letterSpacing: 4, opacity: 0.4 }}>
              YOU FOUND THE SECRET
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL BRANDING HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: mobile ? "12px" : "12px 24px", background: uiBg, borderBottom: `2px solid ${uiFg}` }}>
        <div style={{ fontSize: mobile ? 28 : 40, fontFamily: `"${HEADING_FONT}", serif`, lineHeight: 0.8 }}>d/t</div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={toggleTheme}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            style={{ padding: mobile ? "6px 12px" : "6px 14px", border: `2px solid ${uiFg}`, fontSize: mobile ? 14 : 16, fontWeight: "bold", background: "transparent", color: uiFg, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
          >
            {dark ? "LIGHT" : "DARK"}
          </button>
          <button
            onClick={toggleSound}
            title={muted ? "Unmute sounds" : "Mute sounds"}
            style={{ padding: mobile ? "6px 12px" : "6px 14px", border: `2px solid ${uiFg}`, fontSize: mobile ? 14 : 16, fontWeight: "bold", background: "transparent", color: uiFg, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
          >
            {muted ? "SFX OFF" : "SFX ON"}
          </button>
          <button onClick={() => window.open('https://www.deptofdeath.xyz/portal', '_blank')} style={{ padding: mobile ? "6px 14px" : "6px 18px", border: `2px solid ${uiFg}`, fontSize: mobile ? 14 : 16, fontWeight: "bold", background: uiFg, color: uiBg, cursor: "pointer", textTransform: "uppercase", fontFamily: "inherit", whiteSpace: "nowrap" }}>PAY YOUR TICK</button>
        </div>
      </div>

      {/* GLOBAL INFO TICKER */}
      <div style={{ background: uiFg, color: uiBg, padding: mobile ? "6px 12px" : "8px 24px", display: "flex", justifyContent: "space-between", fontSize: mobile ? 14 : 16, fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase", gap: mobile ? 8 : 0 }}>
         <span>{mobile ? `DAY ${tickerVals.day}` : `DAY: ${tickerVals.day} (${tickerVals.time})`}</span>
         <span>{mobile ? `${tickerVals.taxRate} ETH` : `TAX RATE: ${tickerVals.taxRate} ETH`}</span>
         {!mobile && <span>POPULATION: 6969 CITIZENS</span>}
         {mobile && <span>6969</span>}
      </div>

      <div style={{ flex: 1, display: "flex", position: "relative", flexDirection: "column" }}>
        {/* Decor Pattern Overlay */}
        {!mobile && <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05, pointerEvents: "none", fontSize: 15, wordWrap: "break-word", overflow: "hidden", fontFamily: "monospace", letterSpacing: 2 }}>
           {"64656174682674617865732f2f...".repeat(500)}
        </div>}

        {/* MAIN LAYOUT WRAPPER */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            maxWidth: 1600,
            width: "100%",
            margin: mobile ? "0" : "40px auto",
            border: mobile ? "none" : `2px solid ${uiFg}`,
            boxShadow: mobile ? "none" : `12px 12px 0px ${uiFg}`,
            background: uiBg,
            position: "relative",
            zIndex: 10
          }}
        >
      {/* HEADER BAR with page title + burger (mobile) */}
      <div
        style={{
          borderBottom: `2px solid ${uiFg}`,
          padding: mobile ? "10px 16px" : "10px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: mobile ? 28 : 52,
            fontWeight: 600,
            letterSpacing: -1,
            lineHeight: "1",
            fontFamily: `"${HEADING_FONT}", serif`,
            cursor: "pointer",
          }}
          onClick={() => navTo("registry")}
        >
          {view === "riot" ? "riot club" : view === "watchdog" ? "irs watchdog" : view === "citizenship" ? "the citizenship" : view === "boneyard" ? "the boneyard" : view === "killfeed" ? "kill feed" : view === "whalewatch" ? "whale watch" : view === "census" ? "census bureau" : view === "taxtracker" ? "tax tracker" : "reaper registry"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: mobile ? 11 : 14, fontWeight: 400, textAlign: "right", fontFamily: `"${BODY_FONT}", monospace`, opacity: 0.6, lineHeight: 1.3 }}>
            {CONTRACT.slice(0, 6)}...{CONTRACT.slice(-4)}<br />ETHEREUM MAINNET
          </div>
          {mobile && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: "transparent",
                border: `2px solid ${uiFg}`,
                color: uiFg,
                width: 40,
                height: 40,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: menuOpen ? 0 : 5,
                padding: 0,
                position: "relative",
              }}
            >
              <span style={{
                display: "block", width: 20, height: 2, background: uiFg,
                transition: "all 0.3s ease",
                transform: menuOpen ? "rotate(45deg) translate(0, 0)" : "none",
                position: menuOpen ? "absolute" : "relative",
              }} />
              <span style={{
                display: "block", width: 20, height: 2, background: uiFg,
                transition: "all 0.2s ease",
                opacity: menuOpen ? 0 : 1,
              }} />
              <span style={{
                display: "block", width: 20, height: 2, background: uiFg,
                transition: "all 0.3s ease",
                transform: menuOpen ? "rotate(-45deg) translate(0, 0)" : "none",
                position: menuOpen ? "absolute" : "relative",
              }} />
            </button>
          )}
        </div>
      </div>

      {/* MOBILE OVERLAY MENU */}
      {mobile && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 998,
              opacity: menuOpen ? 1 : 0,
              pointerEvents: menuOpen ? "auto" : "none",
              transition: "opacity 0.3s ease",
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              width: "75vw",
              maxWidth: 320,
              height: "100vh",
              background: uiBg,
              borderLeft: `3px solid ${uiFg}`,
              zIndex: 999,
              transform: menuOpen ? "translateX(0)" : "translateX(100%)",
              transition: "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              display: "flex",
              flexDirection: "column",
              overflow: "auto",
            }}
          >
            <div style={{ padding: "20px 24px", borderBottom: `2px solid ${uiFg}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 28, fontFamily: `"${HEADING_FONT}", serif`, fontWeight: 600 }}>MENU</span>
              <button onClick={() => setMenuOpen(false)} style={{ background: "transparent", border: "none", color: uiFg, fontSize: 28, cursor: "pointer", fontFamily: "monospace", lineHeight: 1 }}>X</button>
            </div>
            {[
              { id: "registry", label: "REGISTRY" },
              { id: "riot", label: "RIOT CLUB" },
              { id: "boneyard", label: "BONEYARD" },
              { id: null, label: "INTEL", children: [
                { id: "killfeed", label: "KILL FEED" },
                { id: "whalewatch", label: "WHALE WATCH" },
                { id: "watchdog", label: "IRS WATCHDOG" },
              ]},
              { id: null, label: "REPORTS", children: [
                { id: "census", label: "CENSUS" },
                { id: "taxtracker", label: "TAX TRACKER" },
              ]},
              { id: "citizenship", label: "CITIZENSHIP" },
            ].map((item, idx) => (
              <div key={idx}>
                {item.id ? (
                  <div
                    onClick={() => navTo(item.id)}
                    style={{
                      padding: "14px 24px",
                      cursor: "pointer",
                      fontSize: 18,
                      fontWeight: 500,
                      fontFamily: `"${BODY_FONT}", monospace`,
                      borderBottom: `1px solid ${uiFg}22`,
                      background: view === item.id ? uiFg : "transparent",
                      color: view === item.id ? uiBg : uiFg,
                      transition: "all 0.15s",
                      animationDelay: `${idx * 0.05}s`,
                    }}
                  >
                    {item.label}
                  </div>
                ) : (
                  <div>
                    <div
                      onClick={() => item.label === "INTEL" ? setIntelOpen(!intelOpen) : setReportsOpen(!reportsOpen)}
                      style={{
                        padding: "14px 24px",
                        cursor: "pointer",
                        fontSize: 18,
                        fontWeight: 500,
                        fontFamily: `"${BODY_FONT}", monospace`,
                        borderBottom: `1px solid ${uiFg}22`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      {item.label}
                      <span style={{
                        transition: "transform 0.3s ease",
                        transform: (item.label === "INTEL" ? intelOpen : reportsOpen) ? "rotate(180deg)" : "rotate(0)",
                        fontSize: 14,
                      }}>V</span>
                    </div>
                    <div style={{
                      maxHeight: (item.label === "INTEL" ? intelOpen : reportsOpen) ? 200 : 0,
                      overflow: "hidden",
                      transition: "max-height 0.3s ease",
                      background: `${uiFg}08`,
                    }}>
                      {item.children.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => navTo(c.id)}
                          style={{
                            padding: "10px 24px 10px 40px",
                            cursor: "pointer",
                            fontSize: 15,
                            fontWeight: 400,
                            fontFamily: `"${BODY_FONT}", monospace`,
                            borderBottom: `1px solid ${uiFg}11`,
                            background: view === c.id ? uiFg : "transparent",
                            color: view === c.id ? uiBg : uiFg,
                            transition: "all 0.15s",
                          }}
                        >
                          {c.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* MAIN CONTENT AREA */}
      <div style={{ display: "flex", flex: 1, minWidth: 0 }}>

      {/* DESKTOP SIDEBAR NAV */}
      {!mobile && (
        <div
          style={{
            width: 220,
            flexShrink: 0,
            borderRight: `2px solid ${uiFg}`,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {[
            { id: "registry", label: "REGISTRY" },
            { id: "riot", label: "RIOT CLUB" },
            { id: "boneyard", label: "BONEYARD" },
          ].map((n) => (
            <div
              key={n.id}
              onClick={() => navTo(n.id)}
              style={{
                padding: "12px 20px",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: `"${BODY_FONT}", monospace`,
                borderBottom: `1px solid ${uiFg}22`,
                background: view === n.id ? uiFg : "transparent",
                color: view === n.id ? uiBg : uiFg,
                transition: "all 0.15s",
                letterSpacing: 0.5,
              }}
              onMouseEnter={(e) => { if (view !== n.id) e.currentTarget.style.background = `${uiFg}11`; }}
              onMouseLeave={(e) => { if (view !== n.id) e.currentTarget.style.background = "transparent"; }}
            >
              {n.label}
            </div>
          ))}

          {/* INTEL section */}
          <div
            onClick={() => setIntelOpen(!intelOpen)}
            style={{
              padding: "12px 20px",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              fontFamily: `"${BODY_FONT}", monospace`,
              borderBottom: `1px solid ${uiFg}22`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: ["killfeed", "whalewatch", "watchdog"].includes(view) ? `${uiFg}15` : "transparent",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${uiFg}11`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ["killfeed", "whalewatch", "watchdog"].includes(view) ? `${uiFg}15` : "transparent"; }}
          >
            INTEL
            <span style={{ fontSize: 10, transition: "transform 0.3s ease", transform: intelOpen ? "rotate(180deg)" : "rotate(0)", display: "inline-block" }}>V</span>
          </div>
          <div style={{ maxHeight: intelOpen ? 200 : 0, overflow: "hidden", transition: "max-height 0.3s ease" }}>
            {[
              { id: "killfeed", label: "KILL FEED" },
              { id: "whalewatch", label: "WHALE WATCH" },
              { id: "watchdog", label: "IRS WATCHDOG" },
            ].map((n) => (
              <div
                key={n.id}
                onClick={(e) => { e.stopPropagation(); navTo(n.id); }}
                style={{
                  padding: "10px 20px 10px 32px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 400,
                  fontFamily: `"${BODY_FONT}", monospace`,
                  borderBottom: `1px solid ${uiFg}11`,
                  background: view === n.id ? uiFg : "transparent",
                  color: view === n.id ? uiBg : uiFg,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (view !== n.id) e.currentTarget.style.background = `${uiFg}11`; }}
                onMouseLeave={(e) => { if (view !== n.id) e.currentTarget.style.background = "transparent"; }}
              >
                {n.label}
              </div>
            ))}
          </div>

          {/* REPORTS section */}
          <div
            onClick={() => setReportsOpen(!reportsOpen)}
            style={{
              padding: "12px 20px",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              fontFamily: `"${BODY_FONT}", monospace`,
              borderBottom: `1px solid ${uiFg}22`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: ["census", "taxtracker"].includes(view) ? `${uiFg}15` : "transparent",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${uiFg}11`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ["census", "taxtracker"].includes(view) ? `${uiFg}15` : "transparent"; }}
          >
            REPORTS
            <span style={{ fontSize: 10, transition: "transform 0.3s ease", transform: reportsOpen ? "rotate(180deg)" : "rotate(0)", display: "inline-block" }}>V</span>
          </div>
          <div style={{ maxHeight: reportsOpen ? 200 : 0, overflow: "hidden", transition: "max-height 0.3s ease" }}>
            {[
              { id: "census", label: "CENSUS" },
              { id: "taxtracker", label: "TAX TRACKER" },
            ].map((n) => (
              <div
                key={n.id}
                onClick={() => navTo(n.id)}
                style={{
                  padding: "10px 20px 10px 32px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 400,
                  fontFamily: `"${BODY_FONT}", monospace`,
                  borderBottom: `1px solid ${uiFg}11`,
                  background: view === n.id ? uiFg : "transparent",
                  color: view === n.id ? uiBg : uiFg,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { if (view !== n.id) e.currentTarget.style.background = `${uiFg}11`; }}
                onMouseLeave={(e) => { if (view !== n.id) e.currentTarget.style.background = "transparent"; }}
              >
                {n.label}
              </div>
            ))}
          </div>

          {/* CITIZENSHIP */}
          <div
            onClick={() => navTo("citizenship")}
            style={{
              padding: "12px 20px",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              fontFamily: `"${BODY_FONT}", monospace`,
              borderBottom: `1px solid ${uiFg}22`,
              background: view === "citizenship" ? uiFg : "transparent",
              color: view === "citizenship" ? uiBg : uiFg,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (view !== "citizenship") e.currentTarget.style.background = `${uiFg}11`; }}
            onMouseLeave={(e) => { if (view !== "citizenship") e.currentTarget.style.background = "transparent"; }}
          >
            CITIZENSHIP
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", flex: 1, minWidth: 0, overflowX: "hidden" }}>
        {view === "riot" ? (
          <DailyRiot mobile={mobile} ownedNFTs={ownedNFTs} wallet={wallet} setWallet={setWallet} handleWalletFetch={handleWalletFetch} loading={loading} error={error} />
        ) : view === "watchdog" ? (
          <IrsWatchdog mobile={mobile} ownedNFTs={ownedNFTs} selectNFT={selectNFT} setView={setView} wallet={wallet} setWallet={setWallet} handleWalletFetch={handleWalletFetch} loading={loading} error={error} />
        ) : view === "citizenship" ? (
          <Citizenship mobile={mobile} />
        ) : view === "boneyard" ? (
          <Boneyard mobile={mobile} />
        ) : view === "killfeed" ? (
          <KillFeed mobile={mobile} />
        ) : view === "whalewatch" ? (
          <WhaleWatch mobile={mobile} />
        ) : view === "census" ? (
          <Census mobile={mobile} />
        ) : view === "taxtracker" ? (
          <TaxTracker mobile={mobile} wallet={wallet} setWallet={setWallet} ownedNFTs={ownedNFTs} handleWalletFetch={handleWalletFetch} loading={loading} error={error} />
        ) : (
          <>
        {/* LEFT PANEL */}
        <div
          style={{
            width: mobile ? "100%" : 380,
            minWidth: mobile ? 0 : 340,
            borderRight: mobile ? "none" : `2px solid ${uiFg}`,
            borderBottom: mobile ? `2px solid ${uiFg}` : "none",
            padding: mobile ? "16px" : "24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: mobile ? 16 : 24,
            flexShrink: 0,
            overflowY: "auto",
            alignSelf: "stretch",
          }}
        >
          {/* WALLET INPUT */}
          <div>
            <label style={S.label}>WALLET ADDRESS</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleWalletFetch()}
                placeholder="0x... or ENS"
                style={{ ...S.input }}
              />
              <button
                onClick={handleWalletFetch}
                disabled={loading}
                style={{ ...S.btn, whiteSpace: "nowrap" }}
              >
                {loading ? "..." : "FETCH"}
              </button>
            </div>
            <div style={{ fontSize: 16, fontWeight: 400, marginTop: 6 }}>
              Pulls all Death & Taxes NFTs from wallet
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div
              style={{
                fontSize: 18,
                color: uiFg,
                padding: "12px 16px",
                border: `2px solid ${uiFg}`,
                background: "transparent",
              }}
            >
              {error}
            </div>
          )}



          {/* CITIZEN ID */}
          <div>
            <label style={S.label}>CITIZEN ID</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={cid}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  if (v === "" || (parseInt(v) >= 0 && parseInt(v) <= 6969))
                    setCid(v);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleIdFetch()}
                placeholder="0 — 6969"
                style={{ ...S.input, fontSize: 32 }}
              />
              <button
                onClick={handleIdFetch}
                disabled={fetchingToken || !cid}
                style={{
                  ...S.btnOutline,
                  whiteSpace: "nowrap",
                }}
              >
                {fetchingToken ? "..." : "PULL"}
              </button>
            </div>
          </div>

          {/* EVADER ID */}
          <div>
            <label style={S.label}>EVADER ID</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={evaderId}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setEvaderId(v);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleEvaderFetch()}
                placeholder="EVADER TOKEN ID"
                style={{ ...S.input, fontSize: 32 }}
              />
              <button
                onClick={handleEvaderFetch}
                disabled={fetchingEvader || !evaderId}
                style={{
                  ...S.btnOutline,
                  whiteSpace: "nowrap",
                }}
              >
                {fetchingEvader ? "..." : "PULL"}
              </button>
            </div>
          </div>

          {/* LAWBREAKER */}
          <div>
            <label style={S.label}>LAWBREAKER</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={psychId}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setPsychId(v);
                }}
                onKeyDown={(e) => e.key === "Enter" && handlePsychFetch()}
                placeholder="TOKEN ID"
                style={{ ...S.input, fontSize: 32 }}
              />
              <button
                onClick={handlePsychFetch}
                disabled={fetchingPsych || !psychId}
                style={{
                  ...S.btnOutline,
                  whiteSpace: "nowrap",
                }}
              >
                {fetchingPsych ? "..." : "PULL"}
              </button>
            </div>
          </div>

          {/* METADATA DISPLAY */}
          {meta.class !== "UNKNOWN" && (
            <div
              style={{
                border: `2px solid ${uiFg}`,
                padding: 16,
                fontSize: 18,
              }}
            >
              <label style={{ ...S.label, marginBottom: 8 }}>METADATA</label>
              {Object.entries(meta.allTraits).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    borderBottom: `1px dashed ${uiFg}`,
                  }}
                >
                  <span style={{ fontWeight: 400, textTransform: "uppercase" }}>
                    {k}
                  </span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* IMAGE UPLOAD / BATCH DISPLAY */}
          <div>
            <label style={S.label}>
              {ownedNFTs.length > 0 ? `COLLECTION (${ownedNFTs.length})` : "CITIZEN IMAGE"}
            </label>
            {ownedNFTs.length > 0 && (ownedNFTs.some(n => n.inAudit) || ownedNFTs.some(n => n.taxDue)) && (
              <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap", fontSize: 14, fontWeight: 700 }}>
                {ownedNFTs.filter(n => n.inAudit).length > 0 && (
                  <span style={{ background: colors.error, color: "#fff", padding: "3px 8px" }}>
                    {ownedNFTs.filter(n => n.inAudit).length} IN AUDIT
                  </span>
                )}
                {ownedNFTs.filter(n => n.taxDue).length > 0 && (
                  <span style={{ background: uiFg, color: uiBg, padding: "3px 8px" }}>
                    {ownedNFTs.filter(n => n.taxDue).length} TAX DUE
                  </span>
                )}
              </div>
            )}
            {ownedNFTs.length > 0 ? (
              <div
                style={{
                  border: `2px solid ${uiFg}`,
                  height: 320,
                  overflowY: "auto",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))",
                  gridAutoRows: "max-content",
                  gap: 8,
                  padding: 8,
                  background: "transparent",
                }}
              >
                {ownedNFTs.map((nft) => (
                  <div
                    key={nft.id}
                    onClick={() => selectNFT(nft)}
                    style={{
                      cursor: "pointer",
                      border: cid === nft.id ? `2px solid ${uiFg}` : `2px solid transparent`,
                      transition: "all 0.1s",
                      position: "relative",
                      background: cid === nft.id ? uiFg : "transparent"
                    }}
                  >
                    <img
                      src={nft.image}
                      alt={nft.name}
                      style={{
                        width: "100%",
                        aspectRatio: "1/1",
                        objectFit: "cover",
                        imageRendering: "pixelated",
                        display: "block",
                        opacity: cid === nft.id ? 0.9 : 1
                      }}
                    />
                    {(nft.inAudit || nft.taxDue) && (
                      <div style={{ position: "absolute", top: 2, right: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                        {nft.inAudit && <div style={{ background: colors.error, color: "#fff", fontSize: 12, fontWeight: 700, padding: "3px 6px", lineHeight: 1.2 }}>AUDIT</div>}
                        {nft.taxDue && <div style={{ background: uiFg, color: uiBg, fontSize: 12, fontWeight: 700, padding: "3px 6px", lineHeight: 1.2 }}>TAX</div>}
                      </div>
                    )}
                    <div style={{
                      marginTop: 4,
                      color: cid === nft.id ? uiBg : uiFg,
                      background: "transparent",
                      textAlign: "center",
                      fontSize: 14,
                      padding: "2px 0",
                      fontWeight: 600,
                      fontFamily: `"${BODY_FONT}", monospace`
                    }}>
                      #{nft.id}
                    </div>
                    <a
                      href={`https://opensea.io/assets/ethereum/${CONTRACT}/${nft.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: "block",
                        textAlign: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        color: cid === nft.id ? uiBg : uiFg,
                        textDecoration: "none",
                        opacity: 0.6,
                        padding: "2px 0",
                      }}
                    >
                      OPENSEA
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
                  }}
                  onClick={() => file.current?.click()}
                  style={{
                    border: `2px dashed ${uiFg}`,
                    padding: 20,
                    textAlign: "center",
                    cursor: "pointer",
                    background: "transparent",
                    transition: "all 0.2s",
                  }}
                >
                  {img ? (
                    <div>
                      <img
                        src={img.src}
                        alt=""
                        style={{
                          width: 100,
                          height: 100,
                          imageRendering: "pixelated",
                          border: `2px solid ${uiFg}`,
                        }}
                      />
                      <div style={{ fontSize: 16, marginTop: 8, fontWeight: 400 }}>
                        CLICK TO REPLACE
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 36, marginBottom: 4 }}>+</div>
                      <div style={{ fontSize: 16, fontWeight: 400 }}>
                        DROP OR CLICK — OR USE PULL ABOVE
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={file}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => onFile(e.target.files[0])}
                />
              </>
            )}
          </div>

          {/* BATCH EXPORT + SHARE CARD */}
          {ownedNFTs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={batchExport}
                disabled={batchExporting}
                style={{
                  ...S.btn,
                  fontSize: mobile ? 14 : 16,
                  padding: "8px 12px",
                  opacity: batchExporting ? 0.6 : 1,
                }}
              >
                {batchExporting ? batchProgress : `BATCH EXPORT ALL (${ownedNFTs.length})`}
              </button>
              <button
                onClick={() => setShowShareCard(!showShareCard)}
                style={{
                  ...S.btnOutline,
                  fontSize: mobile ? 14 : 16,
                  padding: "8px 12px",
                }}
              >
                {showShareCard ? "HIDE SHARE CARD" : "GENERATE SHARE CARD"}
              </button>
            </div>
          )}

          {/* SHARE CARD INLINE */}
          {showShareCard && (
            <ShareCard
              nft={meta.class !== "UNKNOWN" ? meta : ownedNFTs[0] || null}
              walletCount={ownedNFTs.length}
              onClose={() => setShowShareCard(false)}
              mobile={mobile}
            />
          )}

        </div>

        {/* MIDDLE PANEL - TEMPLATES */}
        <div
          style={{
            width: mobile ? "100%" : 260,
            flexShrink: 0,
            borderRight: mobile ? "none" : `2px solid ${uiFg}`,
            borderBottom: mobile ? `2px solid ${uiFg}` : "none",
            padding: mobile ? "16px" : "24px 24px",
            display: "flex",
            flexDirection: "column",
            alignSelf: "stretch",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <label style={S.label}>TEMPLATE</label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 3,
              }}
            >
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { playClick(); setTpl(t.id); }}
                  style={{
                    background: tpl === t.id ? uiFg : "transparent",
                    color: tpl === t.id ? uiBg : uiFg,
                    border: `1px solid ${uiFg}`,
                    padding: "4px 6px",
                    fontFamily: `"${BODY_FONT}", monospace`,
                    fontWeight: 500,
                    fontSize: mobile ? 11 : 12,
                    letterSpacing: 0.5,
                    lineHeight: "1.2",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — CANVAS */}
        <div
          style={{
            flex: 1,
            minWidth: mobile ? 0 : 300,
            padding: mobile ? "16px" : "24px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <label style={{ ...S.label, visibility: "hidden", userSelect: "none", marginBottom: mobile ? 6 : 10 }}>PREVIEW</label>
          <div
            style={{
              background: "transparent",
              padding: 12,
              border: `2px solid ${uiFg}`,
              maxWidth: "100%",
              overflow: "auto",
              position: "relative",
            }}
          >
            <canvas
              ref={cvs}
              onClick={() => {
                const c = cvs.current;
                if (!c) return;
                if (tpl === "wasted" && gifPreviewUrl) {
                  setFullPreview(gifPreviewUrl);
                  return;
                }
                const tmp = document.createElement("canvas");
                tmp.width = c.width;
                tmp.height = c.height;
                const tctx = tmp.getContext("2d");
                if (!transparentBg) {
                  tctx.fillStyle = bgColor;
                  tctx.fillRect(0, 0, tmp.width, tmp.height);
                }
                tctx.drawImage(c, 0, 0);
                setFullPreview(tmp.toDataURL("image/png"));
              }}
              style={{
                width: "100%",
                maxWidth: 420,
                height: "auto",
                display: gifPreviewUrl ? "none" : "block",
                cursor: "pointer",
              }}
            />
            {gifPreviewUrl && (
              <img
                src={gifPreviewUrl}
                alt="GIF Preview"
                onClick={() => setFullPreview(gifPreviewUrl)}
                style={{
                  width: "100%",
                  maxWidth: 420,
                  height: "auto",
                  display: "block",
                  cursor: "pointer",
                }}
              />
            )}
          </div>
          <div style={{ fontSize: 16, fontWeight: 400, textAlign: "center" }}>
            death and taxes // reaper registry // by m0dest
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 700, fontSize: mobile ? 14 : 16 }}>
              <input
                type="checkbox"
                checked={transparentBg}
                onChange={() => { setTransparentBg(true); }}
                style={{ accentColor: uiFg, width: 18, height: 18, cursor: "pointer" }}
              />
              TRANSPARENT
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 700, fontSize: mobile ? 14 : 16 }}>
              <input
                type="checkbox"
                checked={!transparentBg}
                onChange={() => { setTransparentBg(false); }}
                style={{ accentColor: uiFg, width: 18, height: 18, cursor: "pointer" }}
              />
              BG COLOR
              <input
                type="color"
                value={bgColor}
                onChange={(e) => { setBgColor(e.target.value); setTransparentBg(false); }}
                style={{ width: 28, height: 28, border: `2px solid ${uiFg}`, padding: 0, cursor: "pointer", background: "transparent" }}
              />
            </label>
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              onClick={dl}
              style={{
                ...S.btn,
                padding: "10px 20px 14px",
                fontSize: mobile ? 18 : 22,
                fontFamily: `"${HEADING_FONT}", serif`,
                lineHeight: "1",
              }}
            >
              {gifExporting ? "ENCODING GIF..." : tpl === "wasted" ? "download gif" : "download png"}
            </button>
            {tpl === "wasted" && (
              <button
                onClick={async () => {
                  if (gifExporting) return;
                  setGifExporting(true);
                  try {
                    const blob = await buildWastedGif(img, cid || "0", meta, 480, evaderImg);
                    if (gifPreviewUrl) URL.revokeObjectURL(gifPreviewUrl);
                    setGifPreviewUrl(URL.createObjectURL(blob));
                  } catch (e) { console.error("GIF preview failed", e); }
                  setGifExporting(false);
                }}
                style={{
                  ...S.btn,
                  padding: "10px 20px 14px",
                  fontSize: mobile ? 18 : 22,
                  fontFamily: `"${HEADING_FONT}", serif`,
                  lineHeight: "1",
                }}
              >
                {gifExporting ? "ENCODING..." : gifPreviewUrl ? "refresh preview" : "preview gif"}
              </button>
            )}
            <button
              onClick={() => {
                const c = cvs.current;
                if (!c) return;
                c.toBlob((blob) => {
                  if (!blob) return;
                  const text = encodeURIComponent(
                    "death and taxes — reaper registry\nhttps://deptofdeath.xyz",
                  );
                  const url = `https://x.com/intent/tweet?text=${text}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }, "image/png");
              }}
              style={{
                ...S.btn,
                padding: "10px 20px 14px",
                fontSize: mobile ? 18 : 22,
                fontFamily: `"${HEADING_FONT}", serif`,
                lineHeight: "1",
              }}
            >
              share to x
            </button>
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 400,
            textAlign: "center",
            opacity: 0.8,
            maxWidth: mobile ? "90%" : "80%",
            margin: "40px auto 20px auto",
            lineHeight: 1.4,
          }}>
            Not affiliated with dept of death // m0dest. All death and taxes media, branding and copyright belongs to m0dest & the IRS. deptofdeath.xyz
          </div>
        </div>
          </>
        )}
      </div>
      </div>
        </div>
      </div>

      {/* ── FULL PREVIEW MODAL ── */}
      {fullPreview && (
        <div
          onClick={() => setFullPreview(null)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.85)", zIndex: 99999,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 20,
          }}
        >
          <img
            src={fullPreview}
            alt="Full Preview"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw", maxHeight: "90vh",
              objectFit: "contain",
              border: `3px solid ${uiFg}`,
              boxShadow: `0 0 40px rgba(0,0,0,0.5)`,
              cursor: "default",
            }}
          />
          <div style={{
            position: "absolute", top: 20, right: 30,
            color: "#fff", fontSize: 36, fontWeight: 800,
            cursor: "pointer", fontFamily: `"${HEADING_FONT}", serif`,
          }}>
            X
          </div>
        </div>
      )}
    </div>
  );
}

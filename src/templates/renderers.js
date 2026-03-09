import { sR } from "../shared/utils";
import { GifEncoder } from "../shared/gif";
import {
  BG, BK, W, H, HEADING_FONT, BODY_FONT, OBIT_FONT,
  reaperImg, logoImg, fvckTaxImg, reaperServiceImg, fp1Img, fp2Img,
  clear, sLine, dLine, dRect, dText, heading, body, dStamp,
  drawLogoStamp, drawReaper, drawImg, drawCross, rRect, wrapText,
  applyDistress, addGrain, addScratches,
} from "../shared/canvas";
import { CONTRACT } from "../shared/api";

export const TEMPLATES = [
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
  { id: "grid", name: "GRID" },
  { id: "blank", name: "BLANK" },
];

/* ═══════════════════════════════════════════════
   TOMBSTONE
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

  const tx = 190, ty = 180, tw = 700, th = 950;
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

  ctx.save();
  ctx.strokeStyle = BK;
  ctx.lineWidth = 2;
  const ix = tx + 25, iy = ty + 25, iw = tw - 50, ih = th - 50;
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

  // Cracks clipped within tombstone
  ctx.save();
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
    while (dist < len) {
      let step = 15 + _r() * 25;
      ca += (_r() - 0.5) * 1.1;
      cx += Math.cos(ca) * step;
      cy += Math.sin(ca) * step;
      ctx.lineTo(cx, cy);
      dist += step;
      if (maxForks > 0 && _r() > 0.6) {
        maxForks--;
        ctx.save();
        ctx.lineWidth = mainThick * 0.5;
        let fx = cx, fy = cy, fa = ca + (_r() > 0.5 ? 1 : -1) * (0.6 + _r() * 0.4);
        let fDist = 0;
        let fLen = len * 0.4 * _r();
        ctx.moveTo(fx, fy);
        while (fDist < fLen) {
          let fStep = 10 + _r() * 15;
          fa += (_r() - 0.5) * 1.5;
          fx += Math.cos(fa) * fStep;
          fy += Math.sin(fa) * fStep;
          ctx.lineTo(fx, fy);
          fDist += fStep;
        }
        ctx.restore();
        ctx.moveTo(cx, cy);
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
    ty + 798
  );
  dLine(ctx, tx + 60, ty + 830, tx + tw - 60, ty + 830);
  body(ctx, "DEPT. OF DEATH", W / 2, ty + 880, 32);
  drawLogoStamp(ctx, tx + 160, ty + 830, 160, 0, 1010);
  applyDistress(ctx, 1);
}

/* ═══════════════════════════════════════════════
   WANTED
   ═══════════════════════════════════════════════ */

function drawWanted(ctx, img, id, m) {
  clear(ctx);
  dRect(ctx, 30, 30, W - 60, H - 60, 8, 200);
  dRect(ctx, 50, 50, W - 100, H - 100, 3, 201);
  [[60, 60], [W - 60, 60], [60, H - 60], [W - 60, H - 60]].forEach(([cx, cy]) => {
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
  const iS = 480, iX = W / 2 - iS / 2, iY = 375;
  if (img) drawImg(ctx, img, iX, iY, iS);
  else {
    dRect(ctx, iX, iY, iS, iS, 6, 202);
    body(ctx, "CITIZEN", W / 2, iY + iS / 2 - 20, 48);
    body(ctx, "IMAGE", W / 2, iY + iS / 2 + 30, 48);
  }
  [[iX + 14, iY + 14], [iX + iS - 14, iY + 14], [iX + 14, iY + iS - 14], [iX + iS - 14, iY + iS - 14]].forEach(([nx, ny]) => {
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
  body(ctx, m.class !== "UNKNOWN" ? `CLASS: ${m.class.toUpperCase()}` : "CRIME: TAX EVASION", W / 2, 1025, 32);
  body(ctx, "STATUS: DELINQUENT", W / 2, 1070, 28);
  sLine(ctx, 100, 1115, W - 100, 1115, 4);
  heading(ctx, "REWARD", W / 2, 1165, 68);
  body(ctx, "ONE SHARE OF THE TREASURY", W / 2, 1225, 28);
  drawReaper(ctx, 55, H - 310, 240, 0.2);
  body(ctx, "— DEPT. OF DEATH —", W / 2, 1285, 24);
  drawLogoStamp(ctx, W - 160, H - 200, 130, -0.12, 1002);
  applyDistress(ctx, 2);
}

/* ═══════════════════════════════════════════════
   DEATH CERTIFICATE
   ═══════════════════════════════════════════════ */

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
  const classVal = m.class !== "UNKNOWN" ? m.class.toUpperCase() : "________________";
  const insVal = m.insured === "yes" ? "INSURED" : m.insured === "no" ? "UNINSURED" : "________________";
  [["CITIZEN ID:", `#${id}`], ["CLASS:", classVal], ["INSURANCE:", insVal], ["CAUSE OF DEATH:", "FAILURE TO PAY TAXES"], ["AUDITED BY:", "INTERNAL REAPER SERVICE"]].forEach(([l, v], i) => {
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

/* ═══════════════════════════════════════════════
   MUGSHOT
   ═══════════════════════════════════════════════ */

function drawMugshot(ctx, img, id, m) {
  clear(ctx);
  ctx.fillStyle = BK;
  ctx.fillRect(0, 0, W, 100);
  ctx.fillRect(0, H - 100, W, 100);
  ctx.font = `bold 44px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText("DEPT. OF DEATH — BOOKING", W / 2, 65);
  const sY = 150, eY = 950, st = (eY - sY) / 10;
  for (let i = 0; i <= 10; i++) {
    const ly = sY + i * st, mk = i % 2 === 0;
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
  const iSz = 520;
  if (img) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, W / 2 - iSz / 2, 240, iSz, iSz);
    ctx.restore();
  } else dRect(ctx, W / 2 - iSz / 2, 240, iSz, iSz, 4, 400);
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
  const insText = m.insured === "yes" ? "ACTIVE" : m.insured === "no" ? "NONE" : "UNVERIFIED";
  [["STATUS:", "DELINQUENT"], ["CLASS:", m.class !== "UNKNOWN" ? m.class.toUpperCase() : "UNCLASSIFIED"], ["INSURANCE:", insText], ["SENTENCE:", "ELIMINATION"]].forEach(([l, v], i) => {
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
  dStamp(ctx, W / 2 + iSz / 2 - 20, 240 + iSz - 20, 70, "BOOKED", "", 401, "#8b1a1a");
  drawLogoStamp(ctx, 160, 400, 130, -0.1, 1004);
  applyDistress(ctx, 4);
}

/* ═══════════════════════════════════════════════
   AUDIT NOTICE
   ═══════════════════════════════════════════════ */

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
  const insVal = m.insured === "yes" ? "[X] YES  [ ] NO" : m.insured === "no" ? "[ ] YES  [X] NO" : "[ ] YES  [ ] NO";
  [["CITIZEN ID:", `#${id}`], ["TAX STATUS:", "DELINQUENT"], ["CLASS:", m.class !== "UNKNOWN" ? m.class.toUpperCase() : "___________"], ["AMOUNT OWED:", "___________"], ["INSURANCE:", insVal], ["BRIBE USED:", "[ ] YES  [ ] NO"]].forEach(([l, v], i) => {
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
  ["[ ] CITIZEN HAS 24 HOURS TO SETTLE TAX", "[ ] FAILURE TO COMPLY = ELIMINATION", "[ ] CITIZEN BURNED FROM MAIN COLLECTION", "[ ] REMINTED TO EVADER CONTRACT", "[X] NO APPEALS. NO EXCEPTIONS. NO MERCY."].forEach((a, i) => {
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
  ctx.fillText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }), 640, 1140);
  dLine(ctx, 640, 1148, 860, 1148);
  dStamp(ctx, 200, 1238, 52, "AUDIT", "ACTIVE", 503, "#8b1a1a");
  dStamp(ctx, W - 200, 1238, 62, "IRS", "OFFICIAL", 504, "#8b1a1a");
  ctx.font = `400 14px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = BK;
  ctx.fillText("FORM DT-420 REV. 2026 // DEPT. OF DEATH // ALL RIGHTS RESERVED", W / 2, H - 55);
  drawLogoStamp(ctx, W / 2, 1200, 110, 0.1, 1005);
  applyDistress(ctx, 5);
}

/* ═══════════════════════════════════════════════
   OBITUARY
   ═══════════════════════════════════════════════ */

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
  ctx.fillText("ONCHAIN SINCE 2026  //  VOLUME LXIX  //  DEPT. OF DEATH", W / 2, 160);
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
  const cName = m.class !== "UNKNOWN" ? `a ${m.class}` : "a quiet participant";
  const insured = m.insured === "yes";
  const obituariesList = [
    `Citizen #${id}, a resident of the blockchain and ${cName} of the onchain economy, was officially eliminated from the Death & Taxes registry after failing to meet their daily tax obligation. Audited by the Internal Reaper Service and found to be delinquent, #${id} was given a 24-hour grace period but failed to settle their outstanding balance. The elimination was executed on-chain and their token has been burned from the main collection. ${insured ? "Their life insurance was active. The citizen retains its colored artwork in the Evader contract." : "They held no life insurance. Their citizen has been reminted in grayscale to the Evader contract."} No next of kin were found on-chain. The treasury grows.`,
    `Following a brutal audit by the IRS, Citizen #${id}\u2014known as ${cName}\u2014has met their untimely demise. Ignorance of the rising tax rate proved fatal, as the 24-hour grace period expired without a transaction. The ledger has been swept clean, permanently burning the token from the main registry. ${insured ? "Fortunately for their estate, active life insurance secures a colored remint in the Evader contract." : "Without life insurance, their legacy lives on only in grayscale within the Evader contract."} Another lesson etched onto the blockchain: pay your tick.`,
    `The Department of Death officially records the passing of Citizen #${id}, ${cName}. Despite warnings broadcast across the network, they neglected their daily obligation. A player-initiated audit triggered the countdown, and silence followed. By decree of the protocol, the citizen was executed and purged from the primary collection. ${insured ? "Their foresight in purchasing life insurance grants them a vibrant afterlife in the Evader contract." : "Lacking insurance, the asset has been stripped of color, reminted as a grayscale ghost."} The system is perfectly balanced.`,
    `In a sobering reminder of the absolute certainty of on-chain taxation, Citizen #${id} has been eliminated. Once ${cName}, their failure to submit the required ETH before the audit window closed sealed their fate. The Reaper's transaction was final and irreversible, incinerating the original token. ${insured ? "Thanks to a life insurance policy, their colored artwork survives in the Evader contract." : "A lack of insurance leaves behind only a muted, grayscale shell in the Evader contract."} The treasury reclaims what is owed.`,
    `We mourn (briefly) the loss of Citizen #${id}. This ${cName} played a dangerous game of fiscal chicken and lost to a merciless auditor. With the 24-hour window elapsed and no ETH deployed, the execution was processed flawlessly by the contract. ${insured ? "A prudent life insurance policy ensures they retain their full-color glory among the Evaders." : "Penniless and uninsured, they have been reborn as a solemn grayscale token in the Evader ranks."} Death is final, but the tax rate climbs ever higher.`,
    `The ledger is unforgiving. Citizen #${id}, acting as ${cName}, was struck from the Death & Taxes rolls today. It remains unclear if it was an oversight or an act of rebellion, but the unpaid tax debt triggered an irreversible on-chain execution. The original asset is now ash. ${insured ? "A verified insurance policy means their colored essence is preserved in the Evader contract." : "Having no insurance, their digital footprint continues in bleak grayscale in the Evader contract."} Let this serve as a warning to the living.`,
    `Another soul claimed by the IRS. Citizen #${id}, remembered as ${cName}, failed to settle their outstanding balance after a targeted audit. The smart contract showed no mercy, burning the citizen from the main collection exactly 24 hours later. ${insured ? "Their active life insurance softens the blow, securing a colored remint in the Evader contract." : "Bereft of insurance, their token has been permanently dullened to grayscale in the Evader remint."} The protocol demands its due.`,
    `Citizen #${id} (${cName}) has officially flatlined. Despite surviving the early days of the system, a neglected tax payment led to a fatal audit. The execution transaction confirmed instantly, incinerating their presence on the main roster. ${insured ? "An active premium ensures their colored artwork persists in the Evader registry." : "They took their chances without insurance, resulting in a bleak grayscale remint in the Evaders."} The population dwindles. The treasury thickens.`,
    `A tragic, yet entirely preventable, elimination. Citizen #${id}, ${cName}, ignored the mounting daily tax and faced the Reaper's sickle. The 24-hour bailout window yielded nothing, prompting the smart contract to burn the original token permanently. ${insured ? "Their estate rejoices; life insurance preserves their vibrant color in the Evader contract." : "No insurance was found. They exist now only as a grayscale ghost in the Evader contract."} May their wallet rest in peace.`,
    `The bell tolls for Citizen #${id}. Acting as ${cName}, they ultimately succumbed to the relentless mathematics of the protocol. An unpaid debt, a swift audit, and a flawless execution burned their token from the main collection. ${insured ? "They die with dignity\u2014and insurance\u2014retaining their original colorful artwork as an Evader." : "Without the safety net of insurance, their reminted Evader token takes on a lifeless grayscale."} Survival is an ongoing expense.`,
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
  ctx.fillText("\u2014 Benjamin Franklin", W / 2, ty + 120);
  ctx.fillStyle = BK;
  ctx.fillRect(80, H - 60, W - 160, 6);
  ctx.font = `400 14px "${BODY_FONT}", monospace`;
  ctx.fillText("DEPT. OF DEATH // PRINTED ON THE ETERNAL LEDGER", W / 2, H - 35);
  drawLogoStamp(ctx, W - 150, 200, 120, 0.12, 1006);
  applyDistress(ctx, 6);
}

/* ═══════════════════════════════════════════════
   TOE TAG
   ═══════════════════════════════════════════════ */

function drawToeTag(ctx, img, id, m) {
  clear(ctx);
  drawReaper(ctx, W / 2 - 200, 50, 400, 0.08);
  ctx.save();
  ctx.strokeStyle = BK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.quadraticCurveTo(W / 2 + 30, 80, W / 2 - 10, 160);
  ctx.quadraticCurveTo(W / 2 + 20, 200, W / 2, 240);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, 250, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(W / 2, 780);
  ctx.rotate(-0.03);
  const tw = 680, th = 900, rad = 40;
  const tx = -tw / 2, ty = -th / 2;
  ctx.fillStyle = BK;
  ctx.globalAlpha = 0.06;
  ctx.beginPath();
  rRect(ctx, tx + 8, ty + 8, tw, th, rad);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = BG;
  ctx.strokeStyle = BK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  rRect(ctx, tx, ty, tw, th, rad);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = BG;
  ctx.strokeStyle = BK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, ty + 60, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = BK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  rRect(ctx, tx + 20, ty + 100, tw - 40, th - 120, rad - 10);
  ctx.stroke();
  ctx.font = `bold 20px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DEPT. OF DEATH \u2014 MORGUE", 0, ty + 130);
  ctx.setLineDash([8, 5]);
  ctx.beginPath();
  ctx.moveTo(tx + 50, ty + 155);
  ctx.lineTo(tx + tw - 50, ty + 155);
  ctx.stroke();
  ctx.setLineDash([]);
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
  ctx.fillText(m.class !== "UNKNOWN" ? m.class.toLowerCase() : "unknown", tx + 250, ty + 400);
  ctx.fillText("insurance:", tx + 60, ty + 460);
  ctx.fillText(m.insured === "yes" ? "active" : "none", tx + 300, ty + 460);
  ctx.fillText("date:", tx + 60, ty + 520);
  ctx.font = `400 22px "Rock Salt", cursive`;
  ctx.fillText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }), tx + 250, ty + 520);
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1;
  [ty + 225, ty + 295, ty + 355, ty + 415, ty + 475, ty + 535].forEach((ly) => {
    ctx.beginPath();
    ctx.moveTo(tx + 50, ly);
    ctx.lineTo(tx + tw - 50, ly);
    ctx.stroke();
  });
  ctx.setLineDash([]);
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
  ctx.fillStyle = BK;
  ctx.fillRect(25, 25, W - 50, 110);
  ctx.font = `bold 30px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText("DEPT. OF DEATH \u2014 CRIMINAL RECORD", W / 2, 65);
  ctx.font = `bold 18px "${BODY_FONT}", monospace`;
  ctx.fillText("INTERNAL REAPER SERVICE // CONFIDENTIAL", W / 2, 105);
  ctx.fillStyle = BK;
  ctx.fillRect(50, 155, W - 100, 50);
  ctx.font = `bold 28px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "left";
  ctx.fillText(`CASE NO. IRS-${id}-DT`, 70, 187);
  ctx.textAlign = "right";
  ctx.fillText("CLASSIFICATION: FELONY", W - 70, 187);
  sLine(ctx, 60, 230, W - 60, 230, 3);
  ctx.font = `bold 18px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText("FRONT", 220, 260);
  ctx.fillText("PROFILE", 520, 260);
  if (img) {
    drawImg(ctx, img, 70, 280, 300);
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
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.85;
  const drawFp = (fpImg, x, y, size, rot, label) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (fpImg) ctx.drawImage(fpImg, -size / 2, -size / 2, size, size);
    ctx.restore();
    ctx.font = `bold 14px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BK;
    ctx.textAlign = "center";
    ctx.globalCompositeOperation = "source-over";
    ctx.fillText(label, x, y + size / 2 + 20);
    ctx.globalCompositeOperation = "multiply";
  };
  const fpSeed = parseInt(String(id).replace(/\D/g, "")) || Math.floor(Math.random() * 100);
  const isFp1 = fpSeed % 2 === 0;
  const rot = isFp1 ? -0.05 : 0.1;
  const fpImgSel = isFp1 ? fp1Img : fp2Img;
  drawFp(fpImgSel, 820, 380, 200, rot, "THUMB PRINT");
  ctx.restore();
  sLine(ctx, 60, 610, W - 60, 610, 3);
  heading(ctx, "CHARGE: TAX EVASION", W / 2, 665, 56);
  sLine(ctx, 60, 720, W - 60, 720, 2);
  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "left";
  [["CITIZEN ID:", `#${id}`], ["ALIASES:", "UNKNOWN"], ["CLASS:", m.class !== "UNKNOWN" ? m.class.toUpperCase() : "UNCLASSIFIED"], ["INSURANCE:", m.insured === "yes" ? "ACTIVE" : m.insured === "no" ? "EXPIRED" : "NONE"], ["PRIOR OFFENSES:", "SEE BELOW"]].forEach(([l, v], i) => {
    const fy = 770 + i * 46;
    ctx.font = `bold 20px "${BODY_FONT}", monospace`;
    ctx.fillText(l, 80, fy);
    ctx.font = `400 20px "${BODY_FONT}", monospace`;
    ctx.fillText(v, 420, fy);
  });
  sLine(ctx, 60, 1010, W - 60, 1010, 2);
  body(ctx, "PRIOR OFFENSES", W / 2, 1050, 30);
  ["[X] FAILURE TO PAY DAILY TAX", "[X] IGNORING IRS AUDIT NOTICE", "[X] RESISTING ELIMINATION", "[ ] BRIBERY OF REAPER (UNPROVEN)", "[X] EVASION OF TREASURY OBLIGATIONS"].forEach((o, i) => {
    ctx.font = `400 18px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BK;
    ctx.textAlign = "left";
    ctx.fillText(o, 100, 1095 + i * 36);
  });
  drawReaper(ctx, W - 280, 740, 240, 0.1);
  dStamp(ctx, W - 150, 1200, 70, "GUILTY", "", 704, "#8b1a1a");
  drawLogoStamp(ctx, 150, 1220, 110, 0.1, 1008);
  ctx.font = `400 14px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = BK;
  ctx.fillText("DEPT. OF DEATH // CRIMINAL RECORDS DIVISION // PERMANENT FILE", W / 2, H - 45);
  applyDistress(ctx, 8);
}

/* ═══════════════════════════════════════════════
   EVIDENCE BOARD
   ═══════════════════════════════════════════════ */

function drawEvidenceBoard(ctx, img, id, m) {
  ctx.fillStyle = "#2a2216";
  ctx.fillRect(0, 0, W, H);
  const r = sR(800);
  ctx.fillStyle = "#3d3220";
  for (let i = 0; i < 3000; i++) ctx.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 2);
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
  const drawString = (x1, y1, x2, y2) => {
    ctx.save();
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2 + (r() - 0.5) * 60, (y1 + y2) / 2 + 20 + r() * 30, x2, y2);
    ctx.stroke();
    ctx.restore();
  };
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
  const notes = [
    { text: "TAX EVADER", x: 120, y: 300, rot: -0.15, w: 240, h: 60 },
    { text: "LAST SEEN\nON-CHAIN", x: 830, y: 280, rot: 0.1, w: 200, h: 80 },
    { text: "DELINQUENT", x: 160, y: 720, rot: 0.08, w: 230, h: 60 },
    { text: m.class !== "UNKNOWN" ? `CLASS:\n${m.class.toUpperCase()}` : "CLASS:\nUNKNOWN", x: 850, y: 600, rot: -0.05, w: 200, h: 80 },
    { text: m.insured === "yes" ? "INSURED\n\u2713" : "NO\nINSURANCE", x: 870, y: 820, rot: 0.12, w: 180, h: 80 },
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
    n.text.split("\n").forEach((line, li, arr) => ctx.fillText(line, 0, (li - (arr.length - 1) / 2) * 24));
    ctx.restore();
    drawPin(n.x, n.y - n.h / 2, n.text.includes("EVADER") ? "#ff3333" : BG);
  });
  drawString(W / 2, 150, 120, 300);
  drawString(W / 2, 150, 830, 280);
  drawString(120, 300, 160, 720);
  drawString(830, 280, 850, 600);
  drawString(850, 600, 870, 820);
  drawString(W / 2 - 30, 660, 160, 720);
  ctx.save();
  ctx.strokeStyle = "#ff3333";
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(W / 2 - 30, 440, 220, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 250, 220);
  ctx.lineTo(W / 2 + 190, 660);
  ctx.moveTo(W / 2 + 190, 220);
  ctx.lineTo(W / 2 - 250, 660);
  ctx.stroke();
  ctx.restore();
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
  dStamp(ctx, 200, 1200, 80, "CLASSIFIED", "", 801, "#8b1a1a");
  drawLogoStamp(ctx, W - 200, 1200, 120, 0.1, 1009);
  ctx.save();
  ctx.translate(W / 2, H - 50);
  ctx.font = `400 14px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText("INTERNAL REAPER SERVICE // EVIDENCE ROOM // DO NOT REMOVE", 0, 0);
  ctx.restore();
  applyDistress(ctx, 9);
}

/* ═══════════════════════════════════════════════
   TAX RECEIPT
   ═══════════════════════════════════════════════ */

function drawTaxReceipt(ctx, img, id, m) {
  clear(ctx);
  dRect(ctx, 35, 35, W - 70, H - 70, 4, 900);
  dRect(ctx, 50, 50, W - 100, H - 100, 2, 901);
  ctx.fillStyle = BK;
  ctx.fillRect(50, 50, W - 100, 100);
  ctx.font = `bold 32px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText("DEPT. OF DEATH \u2014 TREASURY DIVISION", W / 2, 110);
  heading(ctx, "OFFICIAL", W / 2, 230, 80);
  heading(ctx, "TAX RECEIPT", W / 2, 310, 80);
  sLine(ctx, 100, 365, W - 100, 365, 3);
  ctx.font = `bold 20px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "left";
  ctx.fillText(`RECEIPT NO: DT-${id}-${new Date().getFullYear()}`, 80, 405);
  ctx.textAlign = "right";
  ctx.fillText(`DATE: ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" })}`, W - 80, 405);
  sLine(ctx, 80, 430, W - 80, 430, 2);
  if (img) drawImg(ctx, img, W / 2 - 160, 460, 320);
  else dRect(ctx, W / 2 - 160, 460, 320, 320, 4, 902);
  sLine(ctx, 80, 820, W - 80, 820, 2);
  [["CITIZEN ID:", `#${id}`], ["CLASS:", m.class !== "UNKNOWN" ? m.class.toUpperCase() : "STANDARD"], ["INSURANCE:", m.insured === "yes" ? "ACTIVE" : "PENDING"], ["TAX STATUS:", "\u2713 PAID"], ["AMOUNT:", "0.001 ETH"], ["PAYMENT:", "CONFIRMED"]].forEach(([l, v], i) => {
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
  ctx.font = `bold 24px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText("THIS CITIZEN IS IN GOOD STANDING.", W / 2, 1175);
  ctx.fillText("NO FURTHER ACTION REQUIRED.", W / 2, 1205);
  dStamp(ctx, 200, 1270, 55, "PAID", "IN FULL", 903);
  dStamp(ctx, W - 200, 1270, 55, "VALID", "", 904);
  ctx.font = `400 14px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = BK;
  ctx.fillText("DEPT. OF DEATH // TREASURY DIVISION // RETAIN FOR YOUR RECORDS", W / 2, H - 55);
  drawLogoStamp(ctx, W / 2, 1230, 100, 0.05, 1010);
  applyDistress(ctx, 10);
}

/* ═══════════════════════════════════════════════
   CITIZEN ID CARD
   ═══════════════════════════════════════════════ */

function drawCitizenID(ctx, img, id, m) {
  ctx.fillStyle = BK;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(204,255,0,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const cx = 80, cy = 100, cw = W - 160, ch = H - 200;
  ctx.save();
  ctx.shadowColor = "rgba(204,255,0,0.4)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = BG;
  ctx.lineJoin = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = BG;
  ctx.strokeRect(cx, cy, cw, ch);
  ctx.fillRect(cx, cy, cw, ch);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = BK;
  ctx.fillRect(W / 2 - 60, cy + 30, 120, 20);
  ctx.beginPath();
  ctx.arc(W / 2 - 60, cy + 40, 10, 0, Math.PI * 2);
  ctx.arc(W / 2 + 60, cy + 40, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = BK;
  ctx.strokeRect(cx + 20, cy + 80, cw - 40, ch - 100);
  ctx.fillStyle = BK;
  ctx.fillRect(cx + 20, cy + 80, cw - 40, 110);
  ctx.font = `bold 46px "${HEADING_FONT}", serif`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("INTERNAL REAPER SERVICE", W / 2, cy + 120);
  ctx.font = `400 18px "${BODY_FONT}", monospace`;
  ctx.letterSpacing = "6px";
  ctx.fillText("CLASSIFIED LEVEL V SECURE ACCESS", W / 2, cy + 160);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = BK;
  ctx.fillRect(cx + 40, cy + 220, 40, ch - 360);
  ctx.fillStyle = BG;
  ctx.font = `bold 30px "${BODY_FONT}", monospace`;
  ctx.translate(cx + 70, cy + Math.floor((ch - 360) / 2) + 220);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("PERMANENT RECORD", 0, 0);
  ctx.rotate(Math.PI / 2);
  ctx.translate(-(cx + 70), -(cy + Math.floor((ch - 360) / 2) + 220));
  const px = cx + 110, py = cy + 220, psz = 380;
  ctx.fillStyle = BK;
  ctx.fillRect(px, py, psz, psz);
  if (img) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, px + 10, py + 10, psz - 20, psz - 20);
    ctx.fillStyle = "rgba(204,255,0,0.15)";
    ctx.beginPath();
    ctx.arc(px + psz - 50, py + psz - 50, 60, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.font = `bold 32px "${BODY_FONT}", monospace`;
    ctx.fillStyle = BG;
    ctx.textAlign = "center";
    ctx.fillText("NO PHOTO", px + psz / 2, py + psz / 2);
  }
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
  ctx.fillText(m.class !== "UNKNOWN" ? m.class.toUpperCase() : "UNCLASSIFIED", px + psz + 40, py + 280);
  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillText("INSURANCE:", px + psz + 40, py + 340);
  ctx.font = `400 26px "${BODY_FONT}", monospace`;
  ctx.fillText(m.insured === "yes" ? "ACTIVE" : "NONE", px + psz + 40, py + 375);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(px, py + psz + 40);
  ctx.lineTo(cx + cw - 40, py + psz + 40);
  ctx.stroke();
  const bx = px, by = py + psz + 80, bw = 500, bh = 80;
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
  ctx.fillText(`>>> SYSTEM LOG [${id}:${CONTRACT.slice(2, 8).toUpperCase()}] <<<`, bx + bw / 2, by + bh + 25);
  drawReaper(ctx, W / 2 - 121, by + bh + 50, 342, 1);
  drawLogoStamp(ctx, cx + cw - 120, by + 40, 140, 0, 999);
  dStamp(ctx, px + 34, py + 34, 60, "ACTIVE", "", 124, "#ff57d9");
  ctx.restore();
  addGrain(ctx, 0.04, 2);
  addScratches(ctx, 20, 500);
}

/* ═══════════════════════════════════════════════
   COMMENDATION
   ═══════════════════════════════════════════════ */

function drawCommendation(ctx, img, id, m) {
  clear(ctx);
  dRect(ctx, 30, 30, W - 60, H - 60, 6, 1100);
  dRect(ctx, 50, 50, W - 100, H - 100, 2, 1101);
  const cornerStar = (cx, cy) => {
    ctx.save();
    ctx.fillStyle = BK;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rr = i % 2 === 0 ? 20 : 8;
      i === 0 ? ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  cornerStar(80, 80);
  cornerStar(W - 80, 80);
  cornerStar(80, H - 80);
  cornerStar(W - 80, H - 80);
  ctx.fillStyle = BK;
  ctx.fillRect(100, 70, W - 200, 4);
  ctx.fillRect(100, 78, W - 200, 2);
  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText("DEPT. OF DEATH \u2014 OFFICE OF THE REAPER", W / 2, 120);
  heading(ctx, "CERTIFICATE OF", W / 2, 200, 60);
  heading(ctx, "COMMENDATION", W / 2, 280, 80);
  sLine(ctx, 150, 330, W - 150, 330, 3);
  ctx.fillStyle = BK;
  ctx.fillRect(W / 2 - 30, 325, 60, 12);
  body(ctx, "AWARDED TO", W / 2, 390, 28);
  heading(ctx, `CITIZEN #${id}`, W / 2, 450, 72);
  sLine(ctx, 200, 500, W - 200, 500, 2);
  ctx.font = `400 22px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText("For outstanding tax compliance", W / 2, 545);
  ctx.fillText("and continued survival within", W / 2, 575);
  ctx.fillText("the Death & Taxes ecosystem.", W / 2, 605);
  sLine(ctx, 200, 640, W - 200, 640, 2);
  if (img) drawImg(ctx, img, W / 2 - 175, 670, 350);
  else dRect(ctx, W / 2 - 175, 670, 350, 350, 4, 1102);
  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText(m.class !== "UNKNOWN" ? `CLASS: ${m.class.toUpperCase()} \u2014 ${m.insured === "yes" ? "INSURED" : "UNINSURED"}` : "A CITIZEN IN GOOD STANDING", W / 2, 1060);
  sLine(ctx, 100, 1095, W - 100, 1095, 2);
  ctx.font = `bold 20px "${BODY_FONT}", monospace`;
  ctx.textAlign = "left";
  ctx.fillText("SIGNED:", 100, 1135);
  ctx.font = `400 24px "Rock Salt", cursive`;
  ctx.fillText("the tax man", 260, 1137);
  dLine(ctx, 260, 1148, 480, 1148);
  ctx.font = `bold 20px "${BODY_FONT}", monospace`;
  ctx.fillText("DATE:", 520, 1135);
  ctx.font = `400 22px "Rock Salt", cursive`;
  ctx.fillText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }), 640, 1137);
  dLine(ctx, 640, 1148, 860, 1148);
  dStamp(ctx, 200, 1240, 55, "HONORED", "", 1103);
  dStamp(ctx, W - 200, 1240, 55, "VALID", "", 1104);
  ctx.fillStyle = BK;
  ctx.fillRect(100, H - 78, W - 200, 2);
  ctx.fillRect(100, H - 72, W - 200, 4);
  ctx.font = `400 14px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = BK;
  ctx.fillText("DEPT. OF DEATH // THIS COMMENDATION DOES NOT GUARANTEE SURVIVAL", W / 2, H - 45);
  drawLogoStamp(ctx, W / 2, 1200, 100, 0.05, 1012);
  applyDistress(ctx, 12);
}

/* ═══════════════════════════════════════════════
   FVCK TAX
   ═══════════════════════════════════════════════ */

function drawFvckTax(ctx, img) {
  clear(ctx);
  if (img) {
    const imgAspect = img.width / img.height;
    const sqSize = W;
    let sx, sy, sWidth, sHeight;
    if (imgAspect > 1) { sHeight = img.height; sWidth = img.height; sx = (img.width - sWidth) / 2; sy = 0; }
    else { sWidth = img.width; sHeight = img.width; sx = 0; sy = (img.height - sHeight) / 2; }
    ctx.fillStyle = BK;
    ctx.fillRect(0, 0, W, W);
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sqSize, sqSize);
    if (fvckTaxImg) ctx.drawImage(fvckTaxImg, 0, 0, sqSize, sqSize);
  } else {
    ctx.fillStyle = BK;
    ctx.fillRect(0, 0, W, W);
    if (fvckTaxImg) ctx.drawImage(fvckTaxImg, 0, 0, W, W);
  }
  ctx.shadowColor = "transparent";
  ctx.shadowOffsetY = 0;
  ctx.shadowOffsetX = 0;
  applyDistress(ctx, 42);
}

/* ═══════════════════════════════════════════════
   REAPER SERVICE
   ═══════════════════════════════════════════════ */

function drawReaperService(ctx, img) {
  clear(ctx);
  if (img) {
    const imgAspect = img.width / img.height;
    const sqSize = W;
    let sx, sy, sWidth, sHeight;
    if (imgAspect > 1) { sHeight = img.height; sWidth = img.height; sx = (img.width - sWidth) / 2; sy = 0; }
    else { sWidth = img.width; sHeight = img.width; sx = 0; sy = (img.height - sHeight) / 2; }
    ctx.fillStyle = BK;
    ctx.fillRect(0, 0, W, W);
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sqSize, sqSize);
    if (reaperServiceImg) ctx.drawImage(reaperServiceImg, 0, 0, W, W);
  } else {
    ctx.fillStyle = BK;
    ctx.fillRect(0, 0, W, W);
    if (reaperServiceImg) ctx.drawImage(reaperServiceImg, 0, 0, W, W);
  }
  ctx.shadowColor = "transparent";
  ctx.shadowOffsetY = 0;
  ctx.shadowOffsetX = 0;
}

/* ═══════════════════════════════════════════════
   ELIMINATION CERT
   ═══════════════════════════════════════════════ */

function drawElimCert(ctx, img, id, m) {
  clear(ctx);
  dRect(ctx, 30, 30, W - 60, H - 60, 6, 3000);
  dRect(ctx, 50, 50, W - 100, H - 100, 2, 3001);
  ctx.font = `bold 22px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.fillText("DEPARTMENT OF DEATH \u2014 BUREAU OF ELIMINATIONS", W / 2, 95);
  sLine(ctx, 80, 112, W - 80, 112, 3);
  heading(ctx, "CERTIFICATE OF", W / 2, 170, 48);
  heading(ctx, "ELIMINATION", W / 2, 232, 76);
  sLine(ctx, 80, 272, W - 80, 272, 3);
  body(ctx, "THIS DOCUMENT HEREBY CERTIFIES THAT", W / 2, 316, 22);
  heading(ctx, `CITIZEN #${id}`, W / 2, 370, 60);
  body(ctx, `CLASS: ${(m.class || "UNKNOWN").toUpperCase()}`, W / 2, 418, 24);
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
  dStamp(ctx, W / 2, iY + iS / 2, 160, "ELIMINATED", "CONFIRMED", 3003, "#8b1a1a");
  body(ctx, "HAS BEEN PERMANENTLY REMOVED FROM THE REGISTRY", W / 2, iY + iS + 56, 22);
  dLine(ctx, 200, iY + iS + 96, W - 200, iY + iS + 96);
  body(ctx, "AUTHORIZED BY THE REAPER", W / 2, iY + iS + 126, 20);
  drawLogoStamp(ctx, 200, H - 140, 100, -0.1, 3010);
  drawReaper(ctx, W - 250, H - 230, 180, 0.15);
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
  dRect(ctx, 30, 30, W - 60, H - 60, 8, 3100);
  dRect(ctx, 50, 50, W - 100, H - 100, 3, 3101);
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
  body(ctx, "\u2014 DEPT. OF DEATH \u2014", W / 2, 1100, 24);
  body(ctx, "THEY LIVED. THEY WERE TAXED. THEY PERISHED.", W / 2, H - 80, 18);
  applyDistress(ctx, 5);
}

/* ═══════════════════════════════════════════════
   BODY BAG TAG
   ═══════════════════════════════════════════════ */

function drawBodyBagTag(ctx, img, id, m) {
  clear(ctx);
  ctx.fillStyle = BK;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = BG;
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.lineWidth = 2;
  ctx.strokeRect(35, 35, W - 70, H - 70);
  ctx.fillStyle = BG;
  ctx.beginPath();
  ctx.arc(W / 2, 70, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BK;
  ctx.beginPath();
  ctx.arc(W / 2, 70, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `bold 28px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText("DEPT. OF DEATH \u2014 BODY BAG DIVISION", W / 2, 130);
  ctx.strokeStyle = BG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 155);
  ctx.lineTo(W - 80, 155);
  ctx.stroke();
  ctx.font = `bold 84px "${HEADING_FONT}", serif`;
  ctx.fillStyle = BG;
  ctx.textAlign = "center";
  ctx.fillText("BODY BAG", W / 2, 250);
  ctx.font = `bold 120px "${HEADING_FONT}", serif`;
  ctx.fillText(`#${id}`, W / 2, 370);
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
  ctx.font = `bold 28px "${BODY_FONT}", monospace`;
  ctx.fillStyle = BG;
  ctx.textAlign = "left";
  const detailY = iY + iS + 50;
  ctx.fillText(`SUBJECT: CITIZEN #${id}`, 80, detailY);
  ctx.fillText(`CLASS: ${(m.class || "UNKNOWN").toUpperCase()}`, 80, detailY + 45);
  ctx.fillText(`INSURANCE: ${m.insured === "yes" ? "YES (VOIDED)" : "NONE"}`, 80, detailY + 90);
  ctx.fillText("STATUS: DECEASED", 80, detailY + 135);
  ctx.strokeStyle = BG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, detailY + 170);
  ctx.lineTo(W - 80, detailY + 170);
  ctx.stroke();
  ctx.font = `bold 24px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("CAUSE OF DEATH: TAXATION", W / 2, detailY + 210);
  ctx.strokeStyle = BG;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, H - 80);
  ctx.lineTo(W - 80, H - 80);
  ctx.stroke();
  ctx.font = `bold 16px "${BODY_FONT}", monospace`;
  ctx.fillText("DO NOT OPEN \u2014 PROPERTY OF THE DEPT. OF DEATH", W / 2, H - 50);
  // Plastic bag effects
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, iY);
  ctx.rect(0, iY, iX, iS);
  ctx.rect(iX + iS, iY, W - iX - iS, iS);
  ctx.rect(0, iY + iS, W, H - iY - iS);
  ctx.clip();
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
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  const r = sR(3300);
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    const startX = r() * W, startY = r() * H;
    ctx.moveTo(startX, startY);
    for (let j = 0; j < 4; j++) ctx.lineTo(startX + (r() - 0.3) * 400, startY + (r() - 0.3) * 300);
    ctx.stroke();
  }
  const edgeGrad = ctx.createLinearGradient(0, 0, W, H);
  edgeGrad.addColorStop(0, "rgba(255,255,255,0.07)");
  edgeGrad.addColorStop(0.3, "rgba(255,255,255,0)");
  edgeGrad.addColorStop(0.7, "rgba(255,255,255,0)");
  edgeGrad.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // Zipper teeth
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = BG;
  const zipY = 18, toothW = 12, toothH = 8, toothGap = 6;
  for (let x = 60; x < W - 60; x += toothW + toothGap) ctx.fillRect(x, zipY, toothW, toothH);
  ctx.globalAlpha = 0.6;
  ctx.fillRect(W / 2 - 8, zipY - 4, 16, toothH + 12);
  ctx.fillRect(W / 2 - 14, zipY + toothH + 4, 28, 8);
  ctx.restore();
}

/* ═══════════════════════════════════════════════
   WASTED (GTA-style)
   ═══════════════════════════════════════════════ */

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
    const imageData = ctx.getImageData(0, 0, S, S);
    const px = imageData.data;
    for (let i = 0; i < px.length; i += 4) {
      const gray = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
      const dark = gray * 0.65;
      px[i] = dark; px[i + 1] = dark; px[i + 2] = dark;
    }
    ctx.putImageData(imageData, 0, 0);
  }
  const vig = ctx.createRadialGradient(S / 2, S / 2, S * 0.15, S / 2, S / 2, S * 0.7);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.6, "rgba(0,0,0,0.25)");
  vig.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, S, S);
}

function _wastedText(ctx, S, alpha, id, m) {
  const textY = S / 2 + 20;
  const fontSize = Math.round(S * 0.15);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `900 ${fontSize}px "${HEADING_FONT}", Impact, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.round(fontSize * 0.12);
  ctx.lineJoin = "round";
  ctx.strokeText("WASTED", S / 2, textY);
  ctx.fillStyle = BG;
  ctx.fillText("WASTED", S / 2, textY);
  ctx.globalAlpha = alpha * 0.2;
  ctx.fillStyle = "#fff";
  ctx.fillText("WASTED", S / 2, textY - 2);
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#000";
  for (let y = 0; y < S; y += 4) ctx.fillRect(0, y, S, 2);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawWasted(ctx, img, id, m, evImg) {
  const S = W;
  _wastedBase(ctx, img, S, evImg);
  _wastedText(ctx, S, 1, id, m);
}

export async function buildWastedGif(img, id, m, gifSize = 480, evImg = null) {
  const S = gifSize;
  const cvs = document.createElement("canvas");
  cvs.width = S; cvs.height = S;
  const ctx = cvs.getContext("2d", { willReadFrequently: true });
  const enc = new GifEncoder(S, S);
  const drawFullBleed = (src) => {
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
  drawFullBleed(img);
  const cleanData = ctx.getImageData(0, 0, S, S);
  drawFullBleed(evImg || img);
  const evaderRaw = ctx.getImageData(0, 0, S, S);
  const darkPixels = new Uint8ClampedArray(evaderRaw.data.length);
  if (evImg) {
    darkPixels.set(evaderRaw.data);
  } else {
    for (let i = 0; i < evaderRaw.data.length; i += 4) {
      const gray = evaderRaw.data[i] * 0.299 + evaderRaw.data[i + 1] * 0.587 + evaderRaw.data[i + 2] * 0.114;
      const dark = gray * 0.65;
      darkPixels[i] = dark; darkPixels[i + 1] = dark; darkPixels[i + 2] = dark; darkPixels[i + 3] = 255;
    }
  }
  for (let i = 0; i < 20; i++) enc.addFrame(cleanData, 100);
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
    const vig = ctx.createRadialGradient(S / 2, S / 2, S * 0.15, S / 2, S / 2, S * 0.7);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(0.6, `rgba(0,0,0,${0.25 * t})`);
    vig.addColorStop(1, `rgba(0,0,0,${0.65 * t})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, S, S);
    enc.addFrame(ctx.getImageData(0, 0, S, S), 80);
  }
  for (let i = 1; i <= 25; i++) {
    _wastedBase(ctx, img, S, evImg);
    _wastedText(ctx, S, i / 25, id, m);
    enc.addFrame(ctx.getImageData(0, 0, S, S), 120);
  }
  const finalData = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < 15; i++) enc.addFrame(finalData, 120);
  return enc.finish();
}

/* ═══════════════════════════════════════════════
   BLANK
   ═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   GRID
   ═══════════════════════════════════════════════ */

function drawGrid(ctx, _img, _id, _meta, _evaderImg, gridImages, gridSize) {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  const n = gridSize || 3;

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, cw, ch);

  // Header area
  const headerH = 140;
  const pad = 24;

  // Title centered horizontally and vertically in header
  ctx.fillStyle = BK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold 90px "${HEADING_FONT}", serif`;
  ctx.fillText("DEATH AND TAXES", cw / 2, headerH / 2);

  // Grid
  const gridTop = headerH + 8;
  const outerPad = 48;
  const gridArea = cw - outerPad * 2;
  const gap = Math.max(2, Math.round(4 / (n / 3)));
  const totalGap = gap * (n - 1);
  const cellSize = (gridArea - totalGap) / n;

  // Black border around grid
  const borderW = 4;
  const gridX = outerPad - borderW;
  const gridY = gridTop + outerPad - borderW;
  const gridW = gridArea + borderW * 2;
  const gridH = gridArea + borderW * 2;
  ctx.strokeStyle = BK;
  ctx.lineWidth = borderW;
  ctx.strokeRect(gridX + borderW / 2, gridY + borderW / 2, gridW - borderW, gridH - borderW);

  const imgs = gridImages || [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const idx = row * n + col;
      const x = outerPad + col * (cellSize + gap);
      const y = gridTop + outerPad + row * (cellSize + gap);

      if (idx < imgs.length && imgs[idx]) {
        const im = imgs[idx];
        const scale = Math.max(cellSize / im.width, cellSize / im.height);
        const sw = im.width * scale;
        const sh = im.height * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, cellSize, cellSize);
        ctx.clip();
        ctx.drawImage(im, x + (cellSize - sw) / 2, y + (cellSize - sh) / 2, sw, sh);
        ctx.restore();
      } else {
        ctx.fillStyle = BK;
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
  }

  // Footer area — below grid with padding
  const gridBottom = gridTop + outerPad + n * cellSize + (n - 1) * gap;
  const footerTop = gridBottom + 16;
  const footerMid = footerTop + (ch - footerTop) / 2;

  // Reaper icon — bottom center
  if (reaperImg) {
    const iconH = Math.min(70, ch - footerTop - 8);
    const aspect = reaperImg.width / reaperImg.height;
    const iconW = iconH * aspect;
    ctx.drawImage(reaperImg, (cw - iconW) / 2, footerTop + (ch - footerTop - iconH) / 2, iconW, iconH);
  }

  // "DEPT OF DEATH" — bottom left
  ctx.fillStyle = BK;
  ctx.font = `bold 18px "${BODY_FONT}", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("DEPT OF DEATH", outerPad, footerMid);

  // "© 2026 ALL RIGHTS RESERVED" — bottom right
  ctx.textAlign = "right";
  ctx.fillText("\u00A92026 ALL RIGHTS RESERVED", cw - outerPad, footerMid);
}

/* ═══════════════════════════════════════════════
   BLANK
   ═══════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════
   RENDERERS MAP
   ═══════════════════════════════════════════════ */

export const RENDERERS = {
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
  grid: drawGrid,
  blank: drawBlank,
};

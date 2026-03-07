import { useRef, useEffect } from "react";

const BG = "#dfff00";
const BK = "#000000";
const HEADING_FONT = "Bajern";
const BODY_FONT = "DeptBody";
const W = 1200;
const H = 630;

function drawShareCard(ctx, nft, walletCount) {
  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = BK;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  // Header
  ctx.fillStyle = BK;
  ctx.font = `bold 64px "${HEADING_FONT}", serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("DEATH + TAXES", 40, 40);

  ctx.font = `bold 24px "${BODY_FONT}", monospace`;
  ctx.fillText("OFFICIAL REAPER REGISTRY", 40, 115);

  // Divider
  ctx.fillRect(40, 155, W - 80, 4);

  if (nft) {
    // NFT image placeholder area
    ctx.strokeStyle = BK;
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 180, 360, 360);

    ctx.font = `bold 48px "${HEADING_FONT}", serif`;
    ctx.fillStyle = BK;
    ctx.textAlign = "left";
    ctx.fillText(`CITIZEN #${nft.id}`, 430, 200);

    ctx.font = `bold 22px "${BODY_FONT}", monospace`;
    ctx.fillText(`CLASS: ${(nft.class || "UNKNOWN").toUpperCase()}`, 430, 270);

    const insuredText = nft.insured === "yes" ? "INSURED" : "UNINSURED";
    ctx.fillText(`STATUS: ${insuredText}`, 430, 310);

    if (nft.inAudit) {
      ctx.fillStyle = "#8b1a1a";
      ctx.fillRect(430, 350, 200, 36);
      ctx.fillStyle = BG;
      ctx.font = `bold 20px "${BODY_FONT}", monospace`;
      ctx.fillText("IN AUDIT", 440, 358);
    } else if (nft.taxDue) {
      ctx.fillStyle = BK;
      ctx.fillRect(430, 350, 200, 36);
      ctx.fillStyle = BG;
      ctx.font = `bold 20px "${BODY_FONT}", monospace`;
      ctx.fillText("TAX DUE", 440, 358);
    } else {
      ctx.strokeStyle = BK;
      ctx.lineWidth = 2;
      ctx.strokeRect(430, 350, 120, 36);
      ctx.fillStyle = BK;
      ctx.font = `bold 20px "${BODY_FONT}", monospace`;
      ctx.fillText("CLEAR", 440, 358);
    }
  }

  // Wallet info
  if (walletCount > 0) {
    ctx.fillStyle = BK;
    ctx.font = `bold 22px "${BODY_FONT}", monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`WALLET HOLDS ${walletCount} CITIZEN${walletCount !== 1 ? "S" : ""}`, 430, 440);
  }

  // Footer
  ctx.fillStyle = BK;
  ctx.fillRect(40, H - 80, W - 80, 4);
  ctx.font = `bold 18px "${BODY_FONT}", monospace`;
  ctx.textAlign = "center";
  ctx.fillText("FUCKTHETAXMAN.XYZ // DEPT. OF DEATH // REAPER REGISTRY", W / 2, H - 45);
}

export default function ShareCard({ nft, walletCount, onClose, mobile }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = W;
    c.height = H;
    drawShareCard(c.getContext("2d"), nft, walletCount);

    // If nft has an image, draw it
    if (nft?.image) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 40, 180, 360, 360);
        ctx.strokeStyle = BK;
        ctx.lineWidth = 4;
        ctx.strokeRect(40, 180, 360, 360);
      };
      img.src = typeof nft.image === "string" ? nft.image : nft.image.src;
    }
  }, [nft, walletCount]);

  const download = () => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement("a");
    a.download = `dt-share-${nft?.id || "card"}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  };

  const copy = async () => {
    const c = canvasRef.current;
    if (!c) return;
    try {
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    } catch {}
  };

  return (
    <div style={{
      border: `3px solid ${BK}`,
      padding: mobile ? 12 : 20,
      background: BG,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: mobile ? 18 : 24, fontWeight: 800, fontFamily: `"${HEADING_FONT}", serif` }}>
          SHARE CARD (1200x630)
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: `2px solid ${BK}`,
            padding: "4px 12px",
            fontSize: 16,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          X
        </button>
      </div>
      <div style={{ border: `2px solid ${BK}`, overflow: "auto" }}>
        <canvas ref={canvasRef} style={{ width: "100%", maxWidth: 600, display: "block" }} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={download} style={{
          background: BK, color: BG, border: `2px solid ${BK}`, padding: "8px 16px",
          fontSize: mobile ? 14 : 18, fontWeight: 800, cursor: "pointer",
          fontFamily: `"${HEADING_FONT}", serif`,
        }}>
          DOWNLOAD PNG
        </button>
        <button onClick={copy} style={{
          background: "transparent", color: BK, border: `2px solid ${BK}`, padding: "8px 16px",
          fontSize: mobile ? 14 : 18, fontWeight: 800, cursor: "pointer",
          fontFamily: `"${HEADING_FONT}", serif`,
        }}>
          COPY TO CLIPBOARD
        </button>
      </div>
    </div>
  );
}

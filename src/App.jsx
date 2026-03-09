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
import { loadImage } from "./shared/utils";
import { fetchWalletNFTs, fetchWalletEvaders, fetchWalletViaOpenSea, fetchTokenById, fetchEvaderById, CONTRACT, EVADER_CONTRACT } from "./shared/api";
import { W, H, HEADING_FONT as CANVAS_HEADING, BODY_FONT, loadAssets } from "./shared/canvas";
import { TEMPLATES, RENDERERS, buildWastedGif } from "./templates";
/* ═══════════════════════════════════════════════
   APP COMPONENT
   ═══════════════════════════════════════════════ */
const HEADING_FONT = "Bajern";

const VALID_VIEWS = ["registry","riot","boneyard","killfeed","whalewatch","watchdog","census","taxtracker","citizenship"];

function pathToView() {
  const p = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  // Support ?crew= deep link for citizenship
  const params = new URLSearchParams(window.location.search);
  if (params.get("crew")) return "citizenship";
  if (p && VALID_VIEWS.includes(p)) return p;
  // Legacy ?view= support
  if (params.get("view") && VALID_VIEWS.includes(params.get("view"))) return params.get("view");
  return "registry";
}

const EMPTY_META = {
  class: "UNKNOWN",
  insured: "",
  status: "",
  allTraits: {},
};

export default function App() {
  const { dark, toggle: toggleTheme, colors } = useTheme();
  const { muted, toggle: toggleSound, playClick, playStamp } = useSound();

  const [view, setView] = useState(pathToView);
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
  const [tickerVals, setTickerVals] = useState({ day: 2, time: "00:00 UTC", taxRate: "0.00138", treasury: null });

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

  // Grid template state
  const [gridSize, setGridSize] = useState(3);
  const [gridImages, setGridImages] = useState([]);
  const [gridSlots, setGridSlots] = useState([]); // array of nft objects or null per slot

  const [menuOpen, setMenuOpen] = useState(false);
  const navTo = (v) => {
    playClick();
    const path = v === "registry" ? "/" : `/${v}`;
    window.history.pushState({}, "", path);
    setView(v);
    setIntelOpen(false);
    setReportsOpen(false);
    setMenuOpen(false);
  };

  const [easterEgg, setEasterEgg] = useState(false);

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);

    // Browser back/forward navigation
    const onPopState = () => setView(pathToView());
    window.addEventListener("popstate", onPopState);

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
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("popstate", onPopState); window.removeEventListener("keydown", onKey); };
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

      // Read treasury from census cache
      let treasury = null;
      try {
        const c = JSON.parse(localStorage.getItem("dt_census_cache"));
        if (c?.treasuryBalance != null) treasury = c.treasuryBalance;
      } catch {}

      setTickerVals({
        day,
        time: `${hh}:${mm} UTC`,
        taxRate: taxValue,
        treasury,
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
    c.height = tpl === "grid" ? W + 198 : (tpl === "fvcktax" || tpl === "reaperservice" || tpl === "blank" || tpl === "wasted") ? W : H;
    if (tpl === "wasted") {
      RENDERERS.wasted(c.getContext("2d"), img, cid || "????", meta, evaderImg);
    } else if (tpl === "grid") {
      RENDERERS.grid(c.getContext("2d"), null, null, null, null, gridImages, gridSize);
    } else {
      RENDERERS[tpl](c.getContext("2d"), img, cid || "????", meta);
    }
  }, [tpl, img, cid, ready, meta, evaderImg, gridImages, gridSize]);

  useEffect(() => {
    render();
    setGifPreviewUrl(null);
  }, [render]);

  // Initialize grid slots when size changes or NFTs load
  useEffect(() => {
    if (tpl !== "grid") return;
    const needed = gridSize * gridSize;
    // Auto-fill slots from ownedNFTs on first load or resize
    const newSlots = [];
    for (let i = 0; i < needed; i++) {
      newSlots.push(i < ownedNFTs.length ? ownedNFTs[i] : null);
    }
    setGridSlots(newSlots);
  }, [tpl, gridSize, ownedNFTs]);

  // Load images for grid slots
  useEffect(() => {
    if (tpl !== "grid" || !gridSlots.length) { setGridImages([]); return; }
    let cancelled = false;
    (async () => {
      const loaded = [];
      for (let i = 0; i < gridSlots.length; i++) {
        if (cancelled) return;
        const nft = gridSlots[i];
        if (nft && nft.image) {
          try { loaded.push(await loadImage(nft.image)); } catch { loaded.push(null); }
        } else {
          loaded.push(null);
        }
      }
      if (!cancelled) setGridImages(loaded);
    })();
    return () => { cancelled = true; };
  }, [tpl, gridSlots]);

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
          evUrl = `https://ipfs.io/ipfs/QmPLLa1FwoyA3rDH3GuHZ3zgZWew6EUJcSDTztVCs17oii/citizen-${cid}.png`;
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
      // Try OpenSea first (better evader images), fallback to Alchemy
      let combined;
      try {
        combined = await fetchWalletViaOpenSea(w);
      } catch {
        const [citizens, evaders] = await Promise.all([
          fetchWalletNFTs(w),
          fetchWalletEvaders(w),
        ]);
        combined = [...citizens, ...evaders];
      }
      if (combined.length === 0) {
        setError("No Death & Taxes NFTs found in this wallet");
      }
      setOwnedNFTs(combined);
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
    a.download = tpl === "grid" ? `grid-${gridSize}x${gridSize}.png` : `citizen-${cid || "unknown"}-${tpl}.png`;
    a.href = src.toDataURL("image/png");
    a.click();
  };

  // Batch export
  const batchExport = async () => {
    if (!ownedNFTs.length || batchExporting) return;
    setBatchExporting(true);
    const offscreen = document.createElement("canvas");
    offscreen.width = W;
    offscreen.height = tpl === "grid" ? W + 198 : (tpl === "fvcktax" || tpl === "reaperservice" || tpl === "blank" || tpl === "wasted") ? W : H;
    const octx = offscreen.getContext("2d");

    // Grid template exports as a single image, not per-NFT
    if (tpl === "grid") {
      setBatchProgress("EXPORTING GRID...");
      RENDERERS.grid(octx, null, null, null, null, gridImages, gridSize);
      let src = offscreen;
      if (!transparentBg) {
        const tmp = document.createElement("canvas");
        tmp.width = offscreen.width; tmp.height = offscreen.height;
        const tctx = tmp.getContext("2d");
        tctx.fillStyle = bgColor;
        tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.drawImage(offscreen, 0, 0);
        src = tmp;
      }
      const a = document.createElement("a");
      a.download = `grid-${gridSize}x${gridSize}.png`;
      a.href = src.toDataURL("image/png");
      a.click();
      setBatchExporting(false);
      setBatchProgress("");
      return;
    }

    for (let i = 0; i < ownedNFTs.length; i++) {
      const nft = ownedNFTs[i];
      setBatchProgress(`EXPORTING ${i + 1}/${ownedNFTs.length} — #${nft.id}`);
      let nftImg = null;
      if (nft.image) {
        try { nftImg = await loadImage(nft.image); } catch {}
      }
      offscreen.height = tpl === "grid" ? W + 198 : (tpl === "fvcktax" || tpl === "reaperservice" || tpl === "blank" || tpl === "wasted") ? W : H;
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
            <div style={{ fontSize: mobile ? 60 : 120, fontFamily: `"${HEADING_FONT}", monospace`, lineHeight: 1 }}>
              DEATH IS CERTAIN
            </div>
            <div style={{ fontSize: mobile ? 24 : 48, fontFamily: `"${HEADING_FONT}", monospace`, marginTop: 16, opacity: 0.7 }}>
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
        <div style={{ fontSize: mobile ? 28 : 40, fontFamily: `"${HEADING_FONT}", monospace`, lineHeight: 0.8 }}>d/t</div>
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
      <div style={{ background: uiFg, color: uiBg, padding: mobile ? "6px 12px" : "8px 24px", display: "flex", justifyContent: "space-between", fontSize: mobile ? 14 : 16, fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase", gap: mobile ? 8 : 0, flexWrap: "wrap" }}>
         <span>{mobile ? `DAY ${tickerVals.day}` : `DAY: ${tickerVals.day} (${tickerVals.time})`}</span>
         <span>{mobile ? `${tickerVals.taxRate} ETH` : `TAX RATE: ${tickerVals.taxRate} ETH`}</span>
         {!mobile && <span>POPULATION: 6969 CITIZENS</span>}
         {mobile && <span>6969</span>}
         {tickerVals.treasury != null && <span>{mobile ? `${tickerVals.treasury} ETH` : `TREASURY: ${tickerVals.treasury} ETH`}</span>}
         {!mobile && tickerVals.treasury != null && <span>SPLIT: {(tickerVals.treasury / 69).toFixed(4)} ETH</span>}
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
            fontFamily: `"${HEADING_FONT}", monospace`,
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
              <span style={{ fontSize: 28, fontFamily: `"${HEADING_FONT}", monospace`, fontWeight: 600 }}>MENU</span>
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
                {ownedNFTs.map((nft) => {
                  const selected = cid === nft.id;
                  const inGrid = tpl === "grid" && gridSlots.some(s => s && s.id === nft.id && s.isEvader === nft.isEvader);
                  const osContract = nft.isEvader ? EVADER_CONTRACT : CONTRACT;
                  return (
                  <div
                    key={`${nft.isEvader ? "e" : "c"}_${nft.id}`}
                    onClick={() => {
                      if (tpl === "grid") {
                        // Add to first empty slot
                        const emptyIdx = gridSlots.findIndex(s => !s);
                        if (emptyIdx !== -1) {
                          const newSlots = [...gridSlots];
                          newSlots[emptyIdx] = nft;
                          setGridSlots(newSlots);
                        }
                      } else {
                        selectNFT(nft);
                      }
                    }}
                    style={{
                      cursor: "pointer",
                      border: selected ? `2px solid ${uiFg}` : `2px solid transparent`,
                      transition: "all 0.1s",
                      position: "relative",
                      background: selected ? uiFg : "transparent",
                      opacity: inGrid ? 0.4 : 1,
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
                        opacity: selected ? 0.9 : 1,
                        background: nft.isEvader ? "#000" : "transparent",
                      }}
                    />
                    {(nft.inAudit || nft.taxDue) && (
                      <div style={{ position: "absolute", top: 2, right: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                        {nft.inAudit && <div style={{ background: colors.error, color: "#fff", fontSize: 12, fontWeight: 700, padding: "3px 6px", lineHeight: 1.2 }}>AUDIT</div>}
                        {nft.taxDue && <div style={{ background: uiFg, color: uiBg, fontSize: 12, fontWeight: 700, padding: "3px 6px", lineHeight: 1.2 }}>TAX</div>}
                      </div>
                    )}
                    {nft.isEvader && (
                      <div style={{ position: "absolute", bottom: 38, left: 0, right: 0, background: "rgba(139,26,26,0.75)", color: "#fff", fontSize: 9, fontWeight: 800, textAlign: "center", padding: "2px 0", letterSpacing: 1 }}>
                        EVADER
                      </div>
                    )}
                    <div style={{
                      marginTop: 4,
                      color: selected ? uiBg : uiFg,
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
                      href={`https://opensea.io/assets/ethereum/${osContract}/${nft.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: "block",
                        textAlign: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        color: selected ? uiBg : uiFg,
                        textDecoration: "none",
                        opacity: 0.6,
                        padding: "2px 0",
                      }}
                    >
                      OPENSEA
                    </a>
                  </div>
                  );
                })}
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

            {/* Grid size selector */}
            {tpl === "grid" && (
              <div style={{ marginTop: 12 }}>
                <label style={{ ...S.label, fontSize: 11 }}>GRID SIZE</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                  {[2,3,4,5,6,7,8,9,10].map((n) => (
                    <button
                      key={n}
                      onClick={() => { playClick(); setGridSize(n); }}
                      style={{
                        background: gridSize === n ? uiFg : "transparent",
                        color: gridSize === n ? uiBg : uiFg,
                        border: `1px solid ${uiFg}`,
                        padding: "4px 8px",
                        fontFamily: `"${BODY_FONT}", monospace`,
                        fontWeight: 500,
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {n}x{n}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, opacity: 0.5, marginTop: 6, fontFamily: `"${BODY_FONT}", monospace` }}>
                  {!wallet ? "CONNECT WALLET TO POPULATE" : "CLICK CELL TO REMOVE · DRAG TO REORDER"}
                </div>
              </div>
            )}
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
                if (tpl === "grid") return; // handled by overlay
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
                cursor: tpl === "grid" ? "default" : "pointer",
              }}
            />
            {/* Grid overlay for drag-to-reorder and click-to-remove */}
            {tpl === "grid" && !gifPreviewUrl && (
              <div
                style={{
                  position: "absolute",
                  top: `${12 + 0}px`, // 12px padding
                  left: "12px",
                  right: "12px",
                  bottom: "12px",
                  pointerEvents: "none",
                }}
              >
                <div style={{
                  position: "absolute",
                  top: `${(148 + 48) / 1278 * 100}%`,
                  left: `${48 / 1080 * 100}%`,
                  right: `${48 / 1080 * 100}%`,
                  bottom: `${48 / 1278 * 100}%`,
                  display: "grid",
                  gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                  gridTemplateRows: `repeat(${gridSize}, 1fr)`,
                  gap: `${Math.max(2, Math.round(4 / (gridSize / 3))) / 1080 * 100}%`,
                  pointerEvents: "auto",
                }}>
                  {gridSlots.map((slot, i) => (
                    <div
                      key={i}
                      draggable={!!slot}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", String(i));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromIdx = parseInt(e.dataTransfer.getData("text/plain"));
                        if (isNaN(fromIdx) || fromIdx === i) return;
                        const newSlots = [...gridSlots];
                        const tmp = newSlots[i];
                        newSlots[i] = newSlots[fromIdx];
                        newSlots[fromIdx] = tmp;
                        setGridSlots(newSlots);
                      }}
                      onClick={() => {
                        if (slot) {
                          // Remove NFT from cell
                          const newSlots = [...gridSlots];
                          newSlots[i] = null;
                          setGridSlots(newSlots);
                        }
                      }}
                      style={{
                        cursor: slot ? "grab" : "default",
                        borderRadius: 2,
                        transition: "box-shadow 0.15s",
                        boxShadow: slot ? "inset 0 0 0 1px rgba(255,255,255,0.1)" : "none",
                      }}
                      onMouseOver={(e) => { if (slot) e.currentTarget.style.boxShadow = "inset 0 0 0 2px rgba(255,0,0,0.6)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.boxShadow = slot ? "inset 0 0 0 1px rgba(255,255,255,0.1)" : "none"; }}
                    />
                  ))}
                </div>
              </div>
            )}
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
                fontFamily: `"${HEADING_FONT}", monospace`,
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
                  fontFamily: `"${HEADING_FONT}", monospace`,
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
                fontFamily: `"${HEADING_FONT}", monospace`,
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
            cursor: "pointer", fontFamily: `"${HEADING_FONT}", monospace`,
          }}>
            X
          </div>
        </div>
      )}
    </div>
  );
}

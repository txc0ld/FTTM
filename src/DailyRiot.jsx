import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "./shared/theme";
import {
  CONTRACT,
  EVADER_CONTRACT,
  fetchTokenById as sharedFetchTokenById,
  fetchEvaderById as sharedFetchEvaderById,
  fetchOwnersForNFT,
  reverseENS,
} from "./shared/api";
import { sR } from "./shared/utils";

const HEADING_FONT = "Bajern";
const BODY_FONT = "DeptBody";

/* ═══════════════════════════════════════
   CSS KEYFRAMES (injected once)
   ═══════════════════════════════════════ */
const STYLE_ID = "riot-animations";
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes slideLeft { from { transform: translateX(-120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideRight { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes vsFlash { 0% { opacity: 0; transform: scale(3); } 40% { opacity: 1; transform: scale(1.1); } 60% { opacity: 1; transform: scale(1); } 100% { opacity: 0.15; transform: scale(1); } }
    @keyframes shakeIt { 0%,100% { transform: translateX(0); } 15% { transform: translateX(-6px) rotate(-0.5deg); } 30% { transform: translateX(5px) rotate(0.5deg); } 45% { transform: translateX(-4px); } 60% { transform: translateX(3px); } 75% { transform: translateX(-2px); } }
    @keyframes cardPulse { 0% { box-shadow: 8px 8px 0px currentColor; } 50% { box-shadow: 12px 12px 0px currentColor; } 100% { box-shadow: 8px 8px 0px currentColor; } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes streakGlow { 0%,100% { text-shadow: 0 0 4px rgba(230,194,0,0.3); } 50% { text-shadow: 0 0 12px rgba(230,194,0,0.8); } }
    @keyframes feedSlide { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
    .riot-slide-l { animation: slideLeft 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
    .riot-slide-r { animation: slideRight 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.15s both; }
    .riot-vs { animation: vsFlash 0.8s ease-out 0.3s both; }
    .riot-shake { animation: shakeIt 0.4s ease-out 0.45s; }
    .riot-pulse { animation: cardPulse 2s ease-in-out infinite; color: currentColor; }
    .riot-fadeup { animation: fadeUp 0.4s ease-out both; }
    .riot-streak { animation: streakGlow 2s ease-in-out infinite; }
    .riot-feed-item { animation: feedSlide 0.3s ease-out both; }
  `;
  document.head.appendChild(style);
}

/* ═══════════════════════════════════════
   API / DATA HELPERS
   ═══════════════════════════════════════ */
async function resolveOwner(contractAddress, tokenId) {
  try {
    const data = await fetchOwnersForNFT(contractAddress, tokenId);
    const addr = data.owners?.[0] || null;
    if (!addr) return { address: null, ens: null };
    const ens = await reverseENS(addr);
    return { address: addr, ens };
  } catch {
    return { address: null, ens: null };
  }
}

async function fetchTokenById(tokenId) {
  const parsed = await sharedFetchTokenById(tokenId);
  return { ...parsed, isEvader: false };
}

async function fetchEvaderById(tokenId) {
  const evader = await sharedFetchEvaderById(tokenId);

  // Evader art is extremely dark — fetch the original citizen image for the same ID
  try {
    const citizen = await sharedFetchTokenById(tokenId);
    if (citizen.image) evader.image = citizen.image;
  } catch {}

  return {
    id: evader.id,
    name: evader.name,
    image: evader.image,
    class: evader.class,
    isEvader: true,
  };
}

async function fetchFighterWithRetry(rng) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const useEvader = rng() < 0.3;
      if (useEvader) {
        const id = Math.floor(rng() * 501) + 1;
        return await fetchEvaderById(id);
      } else {
        const id = Math.floor(rng() * 6970);
        return await fetchTokenById(id);
      }
    } catch {}
  }
  try { return await fetchTokenById(1); } catch {}
  return null;
}

function getTimeLeft() {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(19, 0, 0, 0);
  if (now.getTime() >= next.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  const diffMs = next.getTime() - now.getTime();
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} UNTIL NEXT TAX`;
}

function fighterLabel(f) {
  return f.isEvader ? `EVADER #${f.id}` : `CITIZEN #${f.id}`;
}

function fmtKey(key) {
  if (!key) return "?";
  const parts = key.split("_");
  if (parts.length < 2) return key;
  return parts[0] === "e" ? `EVADER #${parts[1]}` : `CITIZEN #${parts[1]}`;
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  const days = Math.floor(hrs / 24);
  return `${days}D AGO`;
}

/* ═══════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════ */
function FighterImg({ src, alt, style, isEvader }) {
  const [failed, setFailed] = useState(false);
  const { colors } = useTheme();
  if (!src || failed) {
    return (
      <div style={{ ...style, background: colors.fg, color: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800 }}>
        {alt || "?"}
      </div>
    );
  }
  if (isEvader) {
    // Use citizen image (fetched in fetchEvaderById) with "eliminated" visual treatment
    const { filter: _f, ...restStyle } = style || {};
    return (
      <div style={{ ...restStyle, overflow: "hidden", position: "relative" }}>
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            imageRendering: style?.imageRendering || "pixelated",
            filter: "grayscale(1) contrast(1.1) brightness(0.85)",
          }}
        />
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(139,26,26,0.15)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "rgba(139,26,26,0.75)", color: "#fff",
          fontSize: 11, fontWeight: 800, textAlign: "center",
          padding: "3px 0", letterSpacing: 2,
        }}>
          ELIMINATED
        </div>
      </div>
    );
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} style={style} />;
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */
export default function DailyRiot({ mobile, ownedNFTs, wallet, setWallet, handleWalletFetch, loading, error }) {
  const { colors } = useTheme();
  const BG = colors.bg;
  const BK = colors.fg;

  useEffect(() => { injectStyles(); }, []);

  // ── NAV ──
  const [nav, setNav] = useState("VOTE");
  const [epoch, setEpoch] = useState(-1);
  const [timeLeft, setTimeLeft] = useState(getTimeLeft());

  // ── VOTE STATE ──
  const [mainVoted, setMainVoted] = useState(false);
  const [streetVotes, setStreetVotes] = useState(0);
  const [c1, setC1] = useState(null);
  const [c2, setC2] = useState(null);
  const [c1Owner, setC1Owner] = useState(null);
  const [c2Owner, setC2Owner] = useState(null);
  const [riotLoading, setRiotLoading] = useState(true);
  const [riotError, setRiotError] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [lastVote, setLastVote] = useState(null); // { winner, loser } for battle card

  // ── WALLET AUTH ──
  const [riotWallet, setRiotWallet] = useState(null);
  const [riotSig, setRiotSig] = useState(null); // session signature, signed once on connect
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [voteError, setVoteError] = useState("");

  // ── LEADERBOARD ──
  const [leaderboard, setLeaderboard] = useState({});
  const [lbLoading, setLbLoading] = useState(false);
  const [expandedFighter, setExpandedFighter] = useState(null);
  const [factionView, setFactionView] = useState(false);

  // ── HISTORY ──
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── STREAK ──
  const [streak, setStreak] = useState(0);

  // ── BATTLE CARD ──
  const battleCardRef = useRef(null);

  // ── STYLES ──
  const NavBtn = ({ active, children, onClick, badge }) => (
    <button
      onClick={onClick}
      style={{
        background: active ? BK : "transparent",
        color: active ? BG : BK,
        border: `2px solid ${BK}`,
        padding: "6px 12px",
        fontFamily: `"${HEADING_FONT}", serif`,
        fontSize: mobile ? 13 : 16,
        cursor: "pointer",
        textTransform: "lowercase",
        transition: "all 0.1s",
        position: "relative",
      }}
    >
      {children}
      {badge > 0 && (
        <span style={{
          position: "absolute", top: -6, right: -6, background: colors.error, color: "#fff",
          fontSize: 10, fontWeight: 800, padding: "2px 5px", borderRadius: "50%", minWidth: 16, textAlign: "center",
        }}>{badge}</span>
      )}
    </button>
  );

  const SBtn = {
    background: BK, color: BG, border: `2px solid ${BK}`, padding: "12px 20px",
    fontFamily: `"${BODY_FONT}", monospace`, fontWeight: 400, fontSize: 22, letterSpacing: 3,
    cursor: "pointer", width: "100%", marginTop: 20, transition: "all 0.15s",
  };

  /* ═══════════════════════════════════════
     DATA FETCHERS
     ═══════════════════════════════════════ */
  const fetchLeaderboard = async () => {
    setLbLoading(true);
    try {
      const res = await fetch("/api/riot/leaderboard");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const lb = {};
      (data.fighters || []).forEach((f) => {
        lb[f.fighter_key] = {
          id: f.token_id, isEvader: f.is_evader, image: f.image,
          class: f.class || "", wins: f.wins, losses: f.losses,
        };
      });
      setLeaderboard(lb);
    } catch {
      setLeaderboard(JSON.parse(localStorage.getItem("dt_riot_lb") || "{}"));
    }
    setLbLoading(false);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/riot/history");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHistory(data.votes || []);
    } catch {
      setHistory([]);
    }
    setHistoryLoading(false);
  };

  /* ═══════════════════════════════════════
     STREAK LOGIC
     ═══════════════════════════════════════ */
  function loadStreak(currentEpoch) {
    const lastEpoch = parseInt(localStorage.getItem("dt_riot_streak_epoch") || "0");
    const saved = parseInt(localStorage.getItem("dt_riot_streak") || "0");
    if (lastEpoch === currentEpoch) {
      setStreak(saved);
    } else if (lastEpoch === currentEpoch - 1) {
      setStreak(saved); // will increment on first vote today
    } else {
      setStreak(0);
      localStorage.setItem("dt_riot_streak", "0");
    }
  }

  function bumpStreak(currentEpoch) {
    const lastEpoch = parseInt(localStorage.getItem("dt_riot_streak_epoch") || "0");
    let s = parseInt(localStorage.getItem("dt_riot_streak") || "0");
    if (lastEpoch === currentEpoch) return s; // already bumped today
    if (lastEpoch === currentEpoch - 1) {
      s += 1;
    } else {
      s = 1;
    }
    localStorage.setItem("dt_riot_streak", String(s));
    localStorage.setItem("dt_riot_streak_epoch", String(currentEpoch));
    setStreak(s);
    return s;
  }

  /* ═══════════════════════════════════════
     WALLET AUTH
     ═══════════════════════════════════════ */
  const syncVotesFromServer = async (walletAddr, currentEpoch) => {
    try {
      const res = await fetch(`/api/riot/check-votes?wallet=${walletAddr}`);
      if (res.ok) {
        const data = await res.json();
        setMainVoted(data.mainVoted);
        setStreetVotes(data.streetVotes);
        const ep = currentEpoch >= 0 ? currentEpoch : epoch;
        if (data.mainVoted) localStorage.setItem(`dt_riot_main_${ep}`, "true");
        localStorage.setItem(`dt_riot_street_${ep}`, String(data.streetVotes));
      }
    } catch {}
  };

  const connectRiotWallet = async () => {
    if (!window.ethereum) {
      setRiotError("INSTALL METAMASK TO VOTE.");
      return;
    }
    setWalletConnecting(true);
    setRiotError("");
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts[0]) {
        const addr = accounts[0].toLowerCase();
        // Sign once per session — covers all votes for this epoch
        const msPerDay = 1000 * 60 * 60 * 24;
        const offset19H = 19 * 60 * 60 * 1000;
        const ep = epoch >= 0 ? epoch : Math.floor((Date.now() - offset19H) / msPerDay);
        const message = `RIOT CLUB SESSION\nEpoch: ${ep}`;
        const sig = await window.ethereum.request({
          method: "personal_sign",
          params: [message, addr],
        });
        setRiotWallet(addr);
        setRiotSig(sig);
        await syncVotesFromServer(addr, ep);
      }
    } catch {
      setRiotError("WALLET CONNECTION REJECTED.");
    }
    setWalletConnecting(false);
  };

  const disconnectRiotWallet = () => {
    setRiotWallet(null);
    setRiotSig(null);
  };

  /* ═══════════════════════════════════════
     INIT
     ═══════════════════════════════════════ */
  useEffect(() => {
    const msPerDay = 1000 * 60 * 60 * 24;
    const offset19H = 19 * 60 * 60 * 1000;
    const calcEpoch = Math.floor((Date.now() - offset19H) / msPerDay);

    // No auto-connect — user must click Connect Wallet to sign session
    setEpoch(calcEpoch);

    fetchLeaderboard();
    loadStreak(calcEpoch);

    // Clean old keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("dt_riot_main_") || k.startsWith("dt_riot_street_") || k.startsWith("dt_riot_winner_"))) {
        const oldEpoch = parseInt(k.split("_").pop());
        if (!isNaN(oldEpoch) && calcEpoch - oldEpoch > 7) keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Listen for account changes
    const onAccountsChanged = (accounts) => {
      if (accounts[0]) {
        const addr = accounts[0].toLowerCase();
        setRiotWallet(addr);
        syncVotesFromServer(addr, calcEpoch);
      } else {
        setRiotWallet(null);
      }
    };
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", onAccountsChanged);
    }

    const intvl = setInterval(() => setTimeLeft(getTimeLeft()), 60000);
    return () => {
      clearInterval(intvl);
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      }
    };
  }, []);

  /* ═══════════════════════════════════════
     FETCH PAIR + ANIMATED REVEAL
     ═══════════════════════════════════════ */
  const fetchPair = useCallback(async () => {
    if (epoch < 0 || !riotWallet) return;
    setRiotLoading(true);
    setRiotError("");
    setRevealed(false);
    setLastVote(null);
    const m = localStorage.getItem(`dt_riot_main_${epoch}`) === "true";
    setMainVoted(m);
    const st = parseInt(localStorage.getItem(`dt_riot_street_${epoch}`) || "0");
    setStreetVotes(st);

    if (m && st >= 10) { setRiotLoading(false); return; }

    const rng = !m ? sR(epoch * 100) : sR(Date.now() ^ (Math.random() * 999999));
    try {
      const [r1, r2] = await Promise.all([fetchFighterWithRetry(rng), fetchFighterWithRetry(rng)]);
      if (r1 && r2 && r1.id === r2.id && r1.isEvader === r2.isEvader) {
        const r2b = await fetchFighterWithRetry(rng);
        setC2(r2b || r2);
      } else {
        if (r2) setC2(r2);
      }
      if (r1) setC1(r1);
      if (!r1 && !r2) setRiotError("FAILED TO SUMMON COMBATANTS. TRY AGAIN.");
    } catch {
      setRiotError("FAILED TO SUMMON COMBATANTS. TRY AGAIN.");
    }
    setRiotLoading(false);
    requestAnimationFrame(() => setRevealed(true));
  }, [epoch, riotWallet]);

  useEffect(() => {
    if (nav === "VOTE") fetchPair();
    if (nav === "HISTORY") fetchHistory();
  }, [nav, fetchPair]);

  // Fetch owners
  useEffect(() => {
    if (c1) {
      setC1Owner(null);
      resolveOwner(c1.isEvader ? EVADER_CONTRACT : CONTRACT, c1.id).then(setC1Owner).catch(() => {});
    }
  }, [c1?.id, c1?.isEvader]);

  useEffect(() => {
    if (c2) {
      setC2Owner(null);
      resolveOwner(c2.isEvader ? EVADER_CONTRACT : CONTRACT, c2.id).then(setC2Owner).catch(() => {});
    }
  }, [c2?.id, c2?.isEvader]);

  /* ═══════════════════════════════════════
     HANDLE VOTE
     ═══════════════════════════════════════ */
  const handleVote = async (winner, loser) => {
    setVoteError("");
    if (!riotWallet || !riotSig) {
      setVoteError("CONNECT WALLET TO VOTE.");
      return;
    }

    // Submit to server with session signature (signed once on connect)
    let serverData;
    try {
      const res = await fetch("/api/riot/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner, loser, wallet: riotWallet, signature: riotSig }),
      });
      serverData = await res.json();
      if (!res.ok) {
        setVoteError(serverData.error || "VOTE REJECTED.");
        return;
      }
    } catch {
      setVoteError("FAILED TO SUBMIT VOTE.");
      return;
    }

    // Update vote state from server
    setMainVoted(serverData.mainVoted);
    setStreetVotes(serverData.streetVotes);
    if (serverData.mainVoted) localStorage.setItem(`dt_riot_main_${epoch}`, "true");
    localStorage.setItem(`dt_riot_street_${epoch}`, String(serverData.streetVotes));

    // Show battle card
    setLastVote({ winner, loser });
    bumpStreak(epoch);

    // Optimistic local leaderboard update
    const lb = { ...leaderboard };
    const wKey = `${winner.isEvader ? "e" : "c"}_${winner.id}`;
    const lKey = `${loser.isEvader ? "e" : "c"}_${loser.id}`;
    if (!lb[wKey]) lb[wKey] = { id: winner.id, image: winner.image, wins: 0, losses: 0, isEvader: winner.isEvader, class: winner.class };
    if (!lb[lKey]) lb[lKey] = { id: loser.id, image: loser.image, wins: 0, losses: 0, isEvader: loser.isEvader, class: loser.class };
    lb[wKey].wins += 1;
    lb[lKey].losses += 1;
    setLeaderboard(lb);
    localStorage.setItem("dt_riot_lb", JSON.stringify(lb));
    localStorage.setItem(`dt_riot_winner_${epoch}`, wKey);
  };

  const nextFight = async () => {
    setLastVote(null);
    setRevealed(false);
    setRiotLoading(true);
    setRiotError("");
    const rng = sR(Date.now() ^ (Math.random() * 999999));
    try {
      const [r1, r2] = await Promise.all([fetchFighterWithRetry(rng), fetchFighterWithRetry(rng)]);
      if (r1) setC1(r1);
      if (r2) setC2(r2);
      if (!r1 && !r2) setRiotError("FAILED TO SUMMON NEXT COMBATANTS.");
    } catch {
      setRiotError("FAILED TO SUMMON NEXT COMBATANTS.");
    }
    setRiotLoading(false);
    requestAnimationFrame(() => setRevealed(true));
  };

  /* ═══════════════════════════════════════
     BATTLE CARD (shareable canvas)
     ═══════════════════════════════════════ */
  const drawBattleCard = useCallback(async () => {
    if (!lastVote || !battleCardRef.current) return;
    const cvs = battleCardRef.current;
    const W = 1200, H = 630;
    cvs.width = W; cvs.height = H;
    const ctx = cvs.getContext("2d");
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);

    // Load fighter images
    const loadImg = (src) => new Promise((resolve) => {
      if (!src) { resolve(null); return; }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    const [winImg, loseImg] = await Promise.all([
      loadImg(lastVote.winner.image),
      loadImg(lastVote.loser.image),
    ]);

    // Re-draw background (canvas may have been cleared)
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = colors.fg;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, W - 8, H - 8);

    // Title
    ctx.fillStyle = colors.fg;
    ctx.font = `bold 48px "${HEADING_FONT}", serif`;
    ctx.textAlign = "center";
    ctx.fillText("RIOT CLUB", W / 2, 70);

    // VS
    ctx.font = `bold 80px "${HEADING_FONT}", serif`;
    ctx.globalAlpha = 0.1;
    ctx.fillText("VS", W / 2, H / 2 + 20);
    ctx.globalAlpha = 1;

    // Winner image
    const imgSize = 280;
    const winX = W / 4 - imgSize / 2, winY = 150;
    if (winImg) {
      ctx.drawImage(winImg, winX, winY, imgSize, imgSize);
    }
    ctx.strokeStyle = colors.fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(winX, winY, imgSize, imgSize);

    // Loser image (slightly smaller, dimmed)
    const loseSize = 240;
    const loseX = (W / 4) * 3 - loseSize / 2, loseY = 170;
    if (loseImg) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(loseImg, loseX, loseY, loseSize, loseSize);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = colors.fg;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(loseX, loseY, loseSize, loseSize);
    ctx.globalAlpha = 1;

    // Winner label
    ctx.fillStyle = colors.fg;
    ctx.font = `bold 28px "${HEADING_FONT}", serif`;
    ctx.fillText("WINNER", W / 4, 120);
    ctx.font = `bold 36px "${HEADING_FONT}", serif`;
    ctx.fillText(fighterLabel(lastVote.winner).toUpperCase(), W / 4, 540);

    // Loser label
    ctx.globalAlpha = 0.5;
    ctx.font = `bold 28px "${HEADING_FONT}", serif`;
    ctx.fillText("DEFEATED", (W / 4) * 3, 120);
    ctx.font = `bold 36px "${HEADING_FONT}", serif`;
    ctx.fillText(fighterLabel(lastVote.loser).toUpperCase(), (W / 4) * 3, 540);
    ctx.globalAlpha = 1;

    // Divider
    ctx.fillStyle = colors.fg;
    ctx.fillRect(W / 2 - 3, 100, 6, H - 200);

    // Footer
    ctx.font = `14px "${BODY_FONT}", monospace`;
    ctx.fillStyle = colors.fg;
    ctx.globalAlpha = 0.6;
    ctx.fillText("FUCKTHETAXMAN.XYZ", W / 2, H - 20);
    ctx.globalAlpha = 1;
  }, [lastVote, colors]);

  useEffect(() => { drawBattleCard(); }, [drawBattleCard]);

  const downloadBattleCard = () => {
    if (!battleCardRef.current) return;
    const link = document.createElement("a");
    link.download = `riot-${lastVote.winner.id}-vs-${lastVote.loser.id}.png`;
    link.href = battleCardRef.current.toDataURL("image/png");
    link.click();
  };

  /* ═══════════════════════════════════════
     RENDER: VOTE VIEW
     ═══════════════════════════════════════ */
  const renderVoteView = () => {
    // ── WALLET GATE — must connect before anything ──
    if (!riotWallet) {
      return (
        <div style={{ textAlign: "center", marginTop: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ fontSize: mobile ? 28 : 48, fontFamily: `"${HEADING_FONT}", serif` }}>WALLET REQUIRED</div>
          <div style={{ fontSize: mobile ? 14 : 18, opacity: 0.7, maxWidth: 500 }}>
            CONNECT YOUR WALLET TO CAST VOTES. EACH WALLET GETS 1 DAILY RIOT VOTE + 10 STREET RIOT VOTES PER DAY.
          </div>
          <button
            onClick={connectRiotWallet}
            disabled={walletConnecting}
            style={{
              ...SBtn, width: "auto", padding: "14px 40px", marginTop: 10,
              opacity: walletConnecting ? 0.5 : 1,
            }}
          >
            {walletConnecting ? "CONNECTING..." : "CONNECT WALLET"}
          </button>
          {voteError && <div style={{ fontSize: 14, fontWeight: 700, color: colors.error }}>{voteError}</div>}
        </div>
      );
    }

    if (riotLoading) {
      return (
        <div style={{ fontSize: mobile ? 28 : 40, textAlign: 'center', marginTop: 100, fontFamily: `"${HEADING_FONT}", serif` }}>
          SUMMONING COMBATANTS...
        </div>
      );
    }

    if (riotError) {
      return (
        <div style={{ textAlign: "center", marginTop: 80 }}>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>{riotError}</div>
          <button onClick={fetchPair} style={{ background: BK, color: BG, border: "none", padding: "12px 24px", fontSize: 18, fontWeight: 800, cursor: "pointer", fontFamily: `"${HEADING_FONT}", serif` }}>
            RETRY
          </button>
        </div>
      );
    }

    const isDone = mainVoted && streetVotes >= 10;

    // ── BATTLE CARD (shown after vote) ──
    if (lastVote) {
      return (
        <div className="riot-fadeup" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: 24 }}>
          <div style={{ fontSize: mobile ? 28 : 48, fontFamily: `"${HEADING_FONT}", serif`, textAlign: "center" }}>
            {fighterLabel(lastVote.winner)} WINS
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ border: `4px solid ${BK}`, padding: 12, boxShadow: `6px 6px 0 ${BK}` }}>
              <FighterImg src={lastVote.winner.image} alt={fighterLabel(lastVote.winner)} isEvader={lastVote.winner.isEvader} style={{ width: mobile ? 140 : 200, height: mobile ? 140 : 200, imageRendering: "pixelated" }} />
              <div style={{ textAlign: "center", fontSize: 18, fontWeight: 800, marginTop: 8 }}>{fighterLabel(lastVote.winner)}</div>
            </div>
            <div style={{ fontSize: 40, fontFamily: `"${HEADING_FONT}", serif`, opacity: 0.2 }}>VS</div>
            <div style={{ border: `2px solid ${BK}`, padding: 12, opacity: 0.4 }}>
              <FighterImg src={lastVote.loser.image} alt={fighterLabel(lastVote.loser)} isEvader={lastVote.loser.isEvader} style={{ width: mobile ? 100 : 140, height: mobile ? 100 : 140, imageRendering: "pixelated", filter: "grayscale(60%)" }} />
              <div style={{ textAlign: "center", fontSize: 14, fontWeight: 600, marginTop: 8 }}>{fighterLabel(lastVote.loser)}</div>
            </div>
          </div>

          {/* Shareable Battle Card */}
          <canvas ref={battleCardRef} style={{ width: "100%", maxWidth: 600, border: `2px solid ${BK}`, display: "block" }} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={downloadBattleCard} style={{ ...SBtn, width: "auto", marginTop: 0, padding: "10px 24px", fontSize: 16 }}>
              DOWNLOAD BATTLE CARD
            </button>
            {!isDone && (
              <button
                onClick={nextFight}
                style={{ ...SBtn, width: "auto", marginTop: 0, padding: "10px 24px", fontSize: 16, background: "transparent", color: BK }}
              >
                NEXT FIGHT
              </button>
            )}
          </div>
          {isDone && (
            <div style={{ textAlign: "center", marginTop: 16, fontSize: 18, fontWeight: 700 }}>
              ALL VOTES EXHAUSTED. {timeLeft}
            </div>
          )}
        </div>
      );
    }

    if (isDone) {
      return (
        <div style={{ textAlign: "center", marginTop: 80, border: `4px solid ${BK}`, padding: 40, background: "transparent", boxShadow: `8px 8px 0px ${BK}` }}>
          <div style={{ fontSize: mobile ? 40 : 60, fontFamily: `"${HEADING_FONT}", serif` }}>THE RIOTS HAVE SETTLED.</div>
          <div style={{ fontSize: 24, marginTop: 20, fontWeight: "bold", textTransform: "uppercase" }}>YOU HAVE EXHAUSTED ALL VOTES FOR TODAY.</div>
          <div style={{ fontSize: 20, marginTop: 10 }}>{timeLeft}</div>
        </div>
      );
    }

    // ── MAIN MATCHUP WITH ANIMATION ──
    const OwnerTag = ({ owner }) => {
      if (!owner) return <div style={{ fontSize: 13, textAlign: "center", opacity: 0.4, marginBottom: 4, fontFamily: `"${BODY_FONT}", monospace` }}>OWNER: ...</div>;
      const display = owner.ens || (owner.address ? `${owner.address.slice(0, 6)}...${owner.address.slice(-4)}` : "UNKNOWN");
      return (
        <div style={{ fontSize: 13, textAlign: "center", marginBottom: 4, fontWeight: owner.ens ? 700 : 400, letterSpacing: 1, fontFamily: `"${BODY_FONT}", monospace` }}>
          OWNER: {display}
        </div>
      );
    };

    const cardStyle = (side) => ({
      width: mobile ? "100%" : 360,
      border: `4px solid ${BK}`,
      padding: 20,
      background: "transparent",
      boxShadow: `8px 8px 0px ${BK}`,
    });

    return (
      <div className={revealed ? "riot-shake" : ""} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: "100%" }}>
        {/* Streak badge */}
        {streak > 0 && (
          <div className="riot-streak" style={{
            background: BK, color: BG, padding: "4px 16px", fontSize: 14, fontWeight: 800,
            letterSpacing: 2, marginBottom: 16, fontFamily: `"${HEADING_FONT}", serif`,
          }}>
            {streak} DAY STREAK
          </div>
        )}

        <div style={{ background: BK, color: BG, padding: "8px 24px", fontSize: mobile ? 20 : 28, fontFamily: `"${HEADING_FONT}", serif`, marginBottom: 40, letterSpacing: 2 }}>
          {!mainVoted ? "MAIN DAILY RIOT (1/1)" : `STREET RIOTS (${Math.min(streetVotes + 1, 10)}/10)`}
        </div>

        {voteError && (
          <div style={{ textAlign: "center", marginBottom: 20, padding: "8px 16px", border: `2px solid ${colors.error}`, color: colors.error, fontWeight: 700, fontSize: 14 }}>
            {voteError}
          </div>
        )}

        <div style={{ display: 'flex', gap: mobile ? 30 : 80, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
          {c1 && (
            <div className={revealed ? "riot-slide-l" : ""} style={{ ...cardStyle("left"), opacity: revealed ? 1 : 0 }}>
              <FighterImg src={c1.image} alt={`#${c1.id}`} isEvader={c1.isEvader} style={{ width: "100%", aspectRatio: '1', border: `2px solid ${BK}`, imageRendering: 'pixelated' }} />
              <div style={{ fontSize: mobile ? 28 : 36, fontFamily: `"${HEADING_FONT}", serif`, textAlign: 'center', marginTop: 16 }}>{fighterLabel(c1)}</div>
              <div style={{ fontSize: 16, textAlign: 'center', textTransform: 'uppercase', marginBottom: 4, fontWeight: "bold" }}>CLASS: {c1.class}</div>
              <OwnerTag owner={c1Owner} />
              {c1.isEvader && <div style={{ fontSize: 14, textAlign: "center", fontWeight: 700, color: colors.error }}>ELIMINATED</div>}
              <button
                onClick={() => handleVote(c1, c2)}
                style={SBtn}
                onMouseOver={e => { e.target.style.background = 'transparent'; e.target.style.color = BK; }}
                onMouseOut={e => { e.target.style.background = BK; e.target.style.color = BG; }}
              >
                VOTE {fighterLabel(c1)}
              </button>
            </div>
          )}

          {!mobile && (
            <div className={revealed ? "riot-vs" : ""} style={{ fontSize: 120, fontFamily: `"${HEADING_FONT}", serif`, opacity: 0, marginTop: 140 }}>
              VS
            </div>
          )}

          {c2 && (
            <div className={revealed ? "riot-slide-r" : ""} style={{ ...cardStyle("right"), opacity: revealed ? 1 : 0 }}>
              <FighterImg src={c2.image} alt={`#${c2.id}`} isEvader={c2.isEvader} style={{ width: "100%", aspectRatio: '1', border: `2px solid ${BK}`, imageRendering: 'pixelated' }} />
              <div style={{ fontSize: mobile ? 28 : 36, fontFamily: `"${HEADING_FONT}", serif`, textAlign: 'center', marginTop: 16 }}>{fighterLabel(c2)}</div>
              <div style={{ fontSize: 16, textAlign: 'center', textTransform: 'uppercase', marginBottom: 4, fontWeight: "bold" }}>CLASS: {c2.class}</div>
              <OwnerTag owner={c2Owner} />
              {c2.isEvader && <div style={{ fontSize: 14, textAlign: "center", fontWeight: 700, color: colors.error }}>ELIMINATED</div>}
              <button
                onClick={() => handleVote(c2, c1)}
                style={SBtn}
                onMouseOver={e => { e.target.style.background = 'transparent'; e.target.style.color = BK; }}
                onMouseOut={e => { e.target.style.background = BK; e.target.style.color = BG; }}
              >
                VOTE {fighterLabel(c2)}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════
     RENDER: LEADERBOARD
     ═══════════════════════════════════════ */
  const renderLeaderboard = () => {
    if (lbLoading) return <div style={{ textAlign: "center", marginTop: 80, fontSize: 30, fontFamily: `"${HEADING_FONT}", serif` }}>LOADING GLOBAL LEADERBOARD...</div>;

    const list = Object.entries(leaderboard).map(([key, v]) => ({ key, ...v })).sort((a, b) => {
      const dA = a.wins - a.losses, dB = b.wins - b.losses;
      return dB !== dA ? dB - dA : b.wins - a.wins;
    });

    if (list.length === 0) return <div style={{ textAlign: "center", marginTop: 80, fontSize: 30, fontFamily: `"${HEADING_FONT}", serif` }}>NO BLOOD SHED YET.</div>;

    // ── FACTION VIEW ──
    if (factionView) {
      const factions = {};
      list.forEach(f => {
        const cls = (f.class || "UNKNOWN").toUpperCase();
        if (!factions[cls]) factions[cls] = { wins: 0, losses: 0, count: 0 };
        factions[cls].wins += f.wins;
        factions[cls].losses += f.losses;
        factions[cls].count += 1;
      });
      const factionList = Object.entries(factions)
        .map(([cls, d]) => ({ cls, ...d, diff: d.wins - d.losses }))
        .sort((a, b) => b.diff - a.diff);

      return (
        <div style={{ width: "100%", border: `4px solid ${BK}`, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: `2px dashed ${BK}` }}>
            <span style={{ fontSize: mobile ? 14 : 18, fontWeight: 800, letterSpacing: 2 }}>FACTION WARS</span>
            <button onClick={() => setFactionView(false)} style={{ background: "transparent", color: BK, border: `2px solid ${BK}`, padding: "4px 12px", fontSize: mobile ? 14 : 16, fontWeight: 700, cursor: "pointer" }}>
              FIGHTERS
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {factionList.map((f, i) => {
              const total = f.wins + f.losses;
              const wp = total ? Math.round((f.wins / total) * 100) : 0;
              const barWidth = total ? Math.round((f.wins / total) * 100) : 0;
              return (
                <div key={f.cls} className="riot-fadeup" style={{ animationDelay: `${i * 0.05}s`, border: `2px solid ${BK}`, padding: mobile ? 12 : 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: mobile ? 20 : 28, fontFamily: `"${HEADING_FONT}", serif`, color: i === 0 ? "#E6C200" : BK }}>#{i + 1}</span>
                      <span style={{ fontSize: mobile ? 16 : 22, fontWeight: 800 }}>{f.cls}</span>
                      <span style={{ fontSize: 13, opacity: 0.6 }}>{f.count} FIGHTERS</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: mobile ? 14 : 18, fontWeight: 700 }}>
                      <span>{f.wins}W</span>
                      <span>{f.losses}L</span>
                      <span style={{ color: f.diff >= 0 ? "#1B5E20" : "#B71C1C" }}>{f.diff > 0 ? "+" + f.diff : f.diff}</span>
                    </div>
                  </div>
                  {/* Win rate bar */}
                  <div style={{ height: 6, background: "rgba(0,0,0,0.1)", width: "100%" }}>
                    <div style={{ height: "100%", width: `${barWidth}%`, background: BK, transition: "width 0.6s ease-out" }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, textAlign: "right", opacity: 0.7 }}>{wp}% WIN RATE</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // ── FIGHTER LEADERBOARD ──
    const top3 = list.slice(0, 3);
    const rest = list.slice(3);
    const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
    const podiumColors = { 0: "#9E9E9E", 1: "#E6C200", 2: "#CD7F32" };
    const podiumLabels = { 0: "2ND", 1: "1ST", 2: "3RD" };
    const podiumSizes = { 0: mobile ? 100 : 140, 1: mobile ? 130 : 180, 2: mobile ? 90 : 130 };

    return (
      <div style={{ width: "100%" }}>
        {/* ── TOP 3 PODIUM ── */}
        {top3.length >= 3 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: mobile ? 12 : 24, marginBottom: 30 }}>
            {podiumOrder.map((c, pi) => {
              const origIdx = pi === 0 ? 1 : pi === 1 ? 0 : 2;
              const total = c.wins + c.losses;
              const wp = total ? Math.round((c.wins / total) * 100) : 0;
              const diff = c.wins - c.losses;
              const sz = podiumSizes[pi];
              const label = c.isEvader ? `EVADER #${c.id}` : `CITIZEN #${c.id}`;
              return (
                <div key={c.key} className="riot-fadeup" style={{
                  animationDelay: `${pi * 0.1}s`,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                }}>
                  <div style={{
                    fontSize: mobile ? 12 : 16, fontWeight: 800, letterSpacing: 2,
                    color: podiumColors[pi], fontFamily: `"${HEADING_FONT}", serif`,
                  }}>
                    {podiumLabels[pi]}
                  </div>
                  <div style={{
                    border: `3px solid ${podiumColors[pi]}`, padding: 4,
                    boxShadow: origIdx === 0 ? `0 0 20px rgba(230,194,0,0.3)` : `4px 4px 0 ${BK}`,
                  }}>
                    <FighterImg
                      src={c.image} alt={label} isEvader={c.isEvader}
                      style={{ width: sz, height: sz, imageRendering: "pixelated" }}
                    />
                  </div>
                  <div style={{
                    fontSize: mobile ? 13 : 18, fontWeight: 800,
                    fontFamily: `"${HEADING_FONT}", serif`, textAlign: "center",
                  }}>
                    {label}
                  </div>
                  <div style={{ fontSize: mobile ? 11 : 13, fontWeight: 700, opacity: 0.7, textAlign: "center" }}>
                    {c.wins}W-{c.losses}L
                    <span style={{ color: diff >= 0 ? "#1B5E20" : "#B71C1C", marginLeft: 6 }}>
                      ({diff > 0 ? "+" + diff : diff})
                    </span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5 }}>{wp}% WIN RATE</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TABLE ── */}
        <div style={{ border: `4px solid ${BK}`, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: `2px dashed ${BK}`, gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: mobile ? 14 : 18, fontWeight: 800, letterSpacing: 2 }}>LEADERBOARD</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setFactionView(true)} style={{ background: "transparent", color: BK, border: `2px solid ${BK}`, padding: "4px 12px", fontSize: mobile ? 13 : 16, fontWeight: 700, cursor: "pointer" }}>
                FACTIONS
              </button>
              <button onClick={fetchLeaderboard} style={{ background: "transparent", color: BK, border: `2px solid ${BK}`, padding: "4px 12px", fontSize: mobile ? 13 : 16, fontWeight: 700, cursor: "pointer" }}>
                REFRESH
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: mobile ? "36px 1fr 50px 50px" : "50px 1fr 80px 80px 80px 70px",
              gap: 8, padding: "10px 12px", background: BK, color: BG, fontWeight: 800,
              fontSize: mobile ? 12 : 16, fontFamily: `"${HEADING_FONT}", serif`, letterSpacing: 1,
            }}>
              <span>#</span><span>FIGHTER</span>
              {!mobile && <span>+/-</span>}
              <span>W</span><span>L</span>
              {!mobile && <span>WIN%</span>}
            </div>

            {list.map((c, i) => {
            const total = c.wins + c.losses;
            const wp = total === 0 ? 0 : Math.round((c.wins / total) * 100);
            const diff = c.wins - c.losses;
            const rankColor = i === 0 ? "#E6C200" : i === 1 ? "#9E9E9E" : i === 2 ? "#CD7F32" : BK;
            const label = c.isEvader ? `EVADER #${c.id}` : `#${c.id}`;
            const isExpanded = expandedFighter === c.key;

            return (
              <div key={c.key} className="riot-fadeup" style={{ animationDelay: `${i * 0.03}s` }}>
                <div
                  onClick={() => setExpandedFighter(isExpanded ? null : c.key)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: mobile ? "36px 1fr 50px 50px" : "50px 1fr 80px 80px 80px 70px",
                    gap: 8, padding: "10px 12px", border: `1px solid ${BK}`,
                    cursor: "pointer", alignItems: "center",
                    background: isExpanded ? (colors.dark ? "rgba(223,255,0,0.08)" : "rgba(0,0,0,0.04)") : (i < 3 ? (colors.dark ? "rgba(223,255,0,0.04)" : "rgba(0,0,0,0.02)") : "transparent"),
                    transition: "background 0.2s",
                  }}
                >
                  <span style={{ fontSize: mobile ? 18 : 28, fontFamily: `"${HEADING_FONT}", serif`, color: rankColor, fontWeight: 800 }}>
                    {i + 1}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                    <FighterImg src={c.image} alt={label} isEvader={c.isEvader} style={{ width: 36, height: 36, imageRendering: "pixelated", border: `2px solid ${BK}`, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: mobile ? 14 : 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {label}
                    </span>
                    {c.isEvader && <span style={{ fontSize: 10, fontWeight: 800, background: colors.error, color: "#fff", padding: "1px 4px", flexShrink: 0 }}>DEAD</span>}
                  </span>
                  {!mobile && (
                    <span style={{ color: diff >= 0 ? "#1B5E20" : "#B71C1C", fontWeight: 700, fontSize: 18 }}>
                      {diff > 0 ? "+" + diff : diff}
                    </span>
                  )}
                  <span style={{ fontWeight: 700, fontSize: mobile ? 14 : 16 }}>{c.wins}</span>
                  <span style={{ fontSize: mobile ? 14 : 16 }}>{c.losses}</span>
                  {!mobile && <span style={{ fontWeight: 700, fontSize: 16 }}>{wp}%</span>}
                </div>

                {/* ── EXPANDED FIGHTER PROFILE ── */}
                {isExpanded && (
                  <div style={{
                    border: `1px solid ${BK}`, borderTop: "none", padding: mobile ? 12 : 20,
                    display: "flex", flexDirection: mobile ? "column" : "row", gap: 20, alignItems: "flex-start",
                  }}>
                    <FighterImg src={c.image} alt={label} isEvader={c.isEvader} style={{ width: mobile ? "100%" : 160, aspectRatio: "1", imageRendering: "pixelated", border: `3px solid ${BK}` }} />
                    <div style={{ flex: 1, width: "100%" }}>
                      <div style={{ fontSize: mobile ? 24 : 32, fontFamily: `"${HEADING_FONT}", serif`, marginBottom: 8 }}>
                        {c.isEvader ? `EVADER #${c.id}` : `CITIZEN #${c.id}`}
                      </div>
                      {c.class && <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 2 }}>CLASS: {c.class}</div>}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                        {[
                          { label: "FIGHTS", value: total },
                          { label: "WIN RATE", value: `${wp}%` },
                          { label: "DIFF", value: diff > 0 ? `+${diff}` : String(diff) },
                        ].map(s => (
                          <div key={s.label} style={{ border: `2px solid ${BK}`, padding: "8px 12px", textAlign: "center" }}>
                            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: `"${HEADING_FONT}", serif` }}>{s.value}</div>
                            <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.7, marginTop: 2 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                      {/* Win/Loss bar */}
                      <div style={{ display: "flex", height: 8, width: "100%", border: `1px solid ${BK}` }}>
                        <div style={{ width: `${wp}%`, background: "#1B5E20", transition: "width 0.4s" }} />
                        <div style={{ flex: 1, background: "#B71C1C" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 4, fontWeight: 700 }}>
                        <span>{c.wins} WINS</span>
                        <span>{c.losses} LOSSES</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════
     RENDER: LIVE HISTORY FEED
     ═══════════════════════════════════════ */
  const renderHistory = () => {
    if (historyLoading) return <div style={{ textAlign: "center", marginTop: 80, fontSize: 30, fontFamily: `"${HEADING_FONT}", serif` }}>LOADING BATTLE FEED...</div>;

    return (
      <div style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: `4px solid ${BK}`, paddingBottom: 12 }}>
          <span style={{ fontSize: mobile ? 18 : 24, fontWeight: 800, letterSpacing: 2, fontFamily: `"${HEADING_FONT}", serif` }}>LIVE BATTLE FEED</span>
          <button onClick={fetchHistory} style={{ background: "transparent", color: BK, border: `2px solid ${BK}`, padding: "4px 12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            REFRESH
          </button>
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, fontSize: 22, fontFamily: `"${HEADING_FONT}", serif`, border: `2px dashed ${BK}` }}>
            NO BATTLES RECORDED YET.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map((v, i) => (
              <div
                key={v.id}
                className="riot-feed-item"
                style={{
                  animationDelay: `${i * 0.04}s`,
                  display: "flex", alignItems: "center", gap: mobile ? 8 : 16,
                  padding: mobile ? "8px 10px" : "10px 16px",
                  border: `1px solid ${BK}`,
                  fontSize: mobile ? 13 : 16,
                  background: i === 0 ? (colors.dark ? "rgba(223,255,0,0.06)" : "rgba(0,0,0,0.03)") : "transparent",
                }}
              >
                <FighterImg src={v.winner_image} alt="W" isEvader={v.winner_key?.startsWith("e_")} style={{ width: 32, height: 32, imageRendering: "pixelated", border: `2px solid ${BK}`, flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <span style={{ fontWeight: 800 }}>{fmtKey(v.winner_key)}</span>
                  <span style={{ opacity: 0.5, margin: "0 6px" }}>defeated</span>
                  <span style={{ fontWeight: 600 }}>{fmtKey(v.loser_key)}</span>
                </div>
                <span style={{ fontSize: mobile ? 11 : 13, opacity: 0.5, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {timeAgo(v.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════
     RENDER: MY COLLECTION + PORTFOLIO
     ═══════════════════════════════════════ */
  const renderProfile = () => {
    if (!wallet) return <div style={{ textAlign: "center", marginTop: 80, fontSize: 30, fontFamily: `"${HEADING_FONT}", serif` }}>CONNECT WALLET ON REGISTRY TAB FIRST.</div>;
    if (!ownedNFTs || ownedNFTs.length === 0) return <div style={{ textAlign: "center", marginTop: 80, fontSize: 30, fontFamily: `"${HEADING_FONT}", serif` }}>NO CITIZENS IN COLLECTION.</div>;

    let w = 0, l = 0;
    let insuredCount = 0, auditCount = 0;
    ownedNFTs.forEach(nft => {
      const key = `c_${nft.id}`;
      const s = leaderboard[key] || leaderboard[nft.id] || { wins: 0, losses: 0 };
      w += s.wins; l += s.losses;
      if (nft.insured === "yes") insuredCount++;
      if (nft.inAudit) auditCount++;
    });
    const total = w + l;
    const wr = total === 0 ? 0 : Math.round((w / total) * 100);

    return (
      <div style={{ width: "100%" }}>
        {/* Portfolio Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 40, borderBottom: `4px solid ${BK}`, paddingBottom: 30 }}>
          <div style={{ fontSize: mobile ? 36 : 60, fontFamily: `"${HEADING_FONT}", serif`, lineHeight: 1 }}>MY COLLECTION</div>

          {/* Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 16, marginTop: 24, width: "100%", maxWidth: 700 }}>
            {[
              { label: "CITIZENS", value: ownedNFTs.length },
              { label: "RECORD", value: `${w}-${l}` },
              { label: "WIN RATE", value: `${wr}%` },
              { label: "INSURED", value: `${insuredCount}/${ownedNFTs.length}` },
            ].map(s => (
              <div key={s.label} style={{ border: `3px solid ${BK}`, padding: mobile ? 12 : 16, textAlign: "center" }}>
                <div style={{ fontSize: mobile ? 24 : 36, fontWeight: 800, fontFamily: `"${HEADING_FONT}", serif` }}>{s.value}</div>
                <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.7, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {auditCount > 0 && (
            <div style={{ marginTop: 16, background: colors.error, color: "#fff", padding: "8px 20px", fontWeight: 800, fontSize: 14, letterSpacing: 2 }}>
              {auditCount} CITIZEN{auditCount > 1 ? "S" : ""} UNDER AUDIT
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ fontSize: mobile ? 24 : 32, fontFamily: `"${HEADING_FONT}", serif` }}>YOUR CITIZENS ({ownedNFTs.length})</div>
          <div style={{ flex: 1, height: 4, background: BK }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
          {ownedNFTs.map((nft, idx) => {
            const key = `c_${nft.id}`;
            const s = leaderboard[key] || leaderboard[nft.id] || { wins: 0, losses: 0 };
            const to = s.wins + s.losses;
            const wp = to === 0 ? 0 : Math.round((s.wins / to) * 100);
            const d = s.wins - s.losses;

            return (
              <div key={nft.id} className="riot-fadeup" style={{ animationDelay: `${idx * 0.05}s`, border: `4px solid ${BK}`, padding: 14, boxShadow: `6px 6px 0px ${BK}` }}>
                <FighterImg src={nft.image || ""} alt={`#${nft.id}`} style={{ width: "100%", aspectRatio: "1", imageRendering: "pixelated", border: `2px solid ${BK}` }} />
                <div style={{ marginTop: 12, fontSize: 28, fontFamily: `"${HEADING_FONT}", serif` }}>#{nft.id}</div>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, opacity: 0.7 }}>CLASS: {nft.class}</div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, borderTop: `2px solid ${BK}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: "bold" }}>
                    {s.wins}-{s.losses}
                    <span style={{ color: d >= 0 ? "#1B5E20" : "#B71C1C", fontSize: 14, marginLeft: 6 }}>({d > 0 ? "+" + d : d})</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: "bold" }}>{wp}%</div>
                </div>

                {/* Mini bar */}
                <div style={{ display: "flex", height: 4, width: "100%", marginTop: 6, border: `1px solid ${BK}` }}>
                  <div style={{ width: `${wp}%`, background: "#1B5E20" }} />
                  <div style={{ flex: 1, background: to > 0 ? "#B71C1C" : "transparent" }} />
                </div>

                {/* Status tags */}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {nft.inAudit && <span style={{ fontSize: 11, fontWeight: 800, background: colors.error, color: "#fff", padding: "2px 6px" }}>AUDIT</span>}
                  {nft.taxDue && <span style={{ fontSize: 11, fontWeight: 800, background: BK, color: BG, padding: "2px 6px" }}>TAX DUE</span>}
                  {nft.insured === "yes" && <span style={{ fontSize: 11, fontWeight: 700, border: `1px solid ${BK}`, padding: "2px 6px" }}>INSURED</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════
     MAIN RETURN
     ═══════════════════════════════════════ */
  return (
    <div style={{ width: "100%", padding: mobile ? "16px 12px" : "20px 40px", display: 'flex', flexDirection: 'column' }}>

      {/* Top Nav Block */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", borderBottom: `4px solid ${BK}`, paddingBottom: 20, marginBottom: 40, gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 16, fontWeight: "bold", letterSpacing: 1 }}>{timeLeft}</div>
          {streak > 1 && (
            <div className="riot-streak" style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: "#E6C200" }}>
              {streak} DAY STREAK
            </div>
          )}
        </div>
        {riotWallet ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, fontFamily: `"${BODY_FONT}", monospace`,
              letterSpacing: 1, padding: "4px 10px", border: `2px solid ${BK}`,
            }}>
              {riotWallet.slice(0, 6)}...{riotWallet.slice(-4)}
            </div>
            <button
              onClick={disconnectRiotWallet}
              style={{
                background: "transparent", color: BK, border: `2px solid ${BK}`,
                padding: "4px 8px", fontSize: 12, fontWeight: 800, cursor: "pointer",
                fontFamily: `"${BODY_FONT}", monospace`,
              }}
            >
              X
            </button>
          </div>
        ) : (
          <button
            onClick={connectRiotWallet}
            disabled={walletConnecting}
            style={{
              background: BK, color: BG, border: `2px solid ${BK}`,
              padding: "6px 14px", fontSize: mobile ? 12 : 14, fontWeight: 800,
              cursor: walletConnecting ? "wait" : "pointer",
              fontFamily: `"${HEADING_FONT}", serif`, letterSpacing: 1,
            }}
          >
            {walletConnecting ? "CONNECTING..." : "CONNECT WALLET"}
          </button>
        )}
        <div style={{ display: "flex", gap: mobile ? 6 : 10, flexWrap: "wrap" }}>
          <NavBtn active={nav === "VOTE"} onClick={() => setNav("VOTE")}>vote</NavBtn>
          <NavBtn active={nav === "LEADERBOARD"} onClick={() => setNav("LEADERBOARD")}>leaderboard</NavBtn>
          <NavBtn active={nav === "HISTORY"} onClick={() => setNav("HISTORY")}>live</NavBtn>
          <NavBtn active={nav === "PROFILE"} onClick={() => setNav("PROFILE")}>collection</NavBtn>
        </div>
      </div>

      {/* Wallet Checker */}
      <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: mobile ? 12 : 16, alignItems: mobile ? "stretch" : "center", marginBottom: 40 }}>
        <input
          type="text"
          placeholder="PASTE WALLET ADDRESS OR ENS"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleWalletFetch()}
          style={{
            flex: 1, background: "transparent", border: `2px solid ${BK}`, padding: "12px 16px",
            fontSize: mobile ? 14 : 18, fontWeight: 600, outline: "none", textTransform: "uppercase", fontFamily: "inherit",
          }}
        />
        <button
          onClick={handleWalletFetch}
          disabled={loading}
          style={{
            background: loading ? BK : BG, color: loading ? BG : BK, border: `3px solid ${BK}`,
            padding: "12px 24px", fontSize: mobile ? 14 : 18, fontWeight: 800,
            cursor: loading ? "wait" : "pointer", fontFamily: `"${HEADING_FONT}", serif`, whiteSpace: "nowrap",
          }}
        >
          {loading ? "CHECKING..." : "CHECK WALLET"}
        </button>
      </div>
      {error && <div style={{ fontSize: 14, fontWeight: 700, color: colors.error, marginTop: -32, marginBottom: 24 }}>{error}</div>}

      {/* Dynamic Content */}
      <div style={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
        {nav === "VOTE" && renderVoteView()}
        {nav === "LEADERBOARD" && renderLeaderboard()}
        {nav === "HISTORY" && renderHistory()}
        {nav === "PROFILE" && renderProfile()}
      </div>
    </div>
  );
}

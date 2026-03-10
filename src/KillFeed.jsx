import { useState, useEffect, useRef } from "react";
import { useTheme } from "./shared/theme";
import { useSound } from "./shared/sound";

const HEADING_FONT = "Bajern";
const BODY_FONT = "DeptBody";
const LEADERBOARD_API = "https://dt-leaderboard-livid.vercel.app/api/leaderboard";
const LS_KEY = "dt_boneyard_cache";
const KILL_CACHE_KEY = "dt_kill_leaderboard";
const KILLABLE_CACHE_KEY = "dt_killable_cache";
const FIVE_MIN = 5 * 60 * 1000;
const TOTAL_CITIZENS = 6969;
const TREASURY = "0x0dae6E01A88826b4E77d717d9639B64F749C0152";
const PRICE_ETH = "0.0069";
const PRICE_HEX = "0x187E7D288000"; // 6900000000000000 wei

function shortAddr(addr) {
  if (!addr) return "UNKNOWN";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function displayAddr(addr, ens, mobile) {
  if (ens) return ens;
  return mobile ? shortAddr(addr) : addr;
}

function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(KILL_CACHE_KEY));
    if (raw && raw.ts && Date.now() - raw.ts < FIVE_MIN) return raw.data;
  } catch {}
  return null;
}

function saveCache(data) {
  localStorage.setItem(KILL_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
}

function Countdown({ targetTs, mobile }) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = targetTs - now;
  if (diff <= 0) return <span style={{ color: "#ff0000", fontWeight: 900 }}>KILLABLE NOW</span>;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return (
    <span style={{ fontFamily: '"DeptBody", monospace', fontWeight: 700, letterSpacing: 1, fontSize: mobile ? 12 : 14 }}>
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}

export default function KillFeed({ mobile, defaultTab }) {
  const { colors } = useTheme();
  const { playClick, playStaticBuzz } = useSound();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(defaultTab || "KILLS");
  const [viewMode, setViewMode] = useState("LEADERBOARD");
  const [paused, setPaused] = useState(false);
  const [killable, setKillable] = useState([]);
  const [killableLoading, setKillableLoading] = useState(false);
  const [killableProgress, setKillableProgress] = useState("");
  const [killWallet, setKillWallet] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [payError, setPayError] = useState("");

  const bg = colors.bg;
  const fg = colors.fg;

  useEffect(() => {
    const cached = loadCache();
    if (cached) { setData(cached); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(LEADERBOARD_API);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      setData(json);
      saveCache(json);
    } catch (e) {
      setError(e.message || "Failed to fetch leaderboard");
    }
    setLoading(false);
  };

  // Load killable cache on mount
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KILLABLE_CACHE_KEY));
      if (raw && raw.ts && Date.now() - raw.ts < FIVE_MIN) setKillable(raw.data);
    } catch {}
  }, []);

  const scanKillable = async () => {
    setKillableLoading(true);
    setKillableProgress("SCANNING ALL 6969 CITIZENS...");
    try {
      const res = await fetch("/api/killable-scan");
      if (!res.ok) throw new Error(`Scan failed: ${res.status}`);
      const data = await res.json();
      const found = [...data.killable, ...data.delinquent];
      setKillable(found);
      localStorage.setItem(KILLABLE_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: found }));
    } catch (e) {
      console.error(e);
    }
    setKillableLoading(false);
    setKillableProgress("");
  };

  const connectAndCheckAccess = async () => {
    if (!window.ethereum) {
      setPayError("OPEN THIS SITE IN METAMASK BROWSER");
      return;
    }
    setAccessLoading(true);
    setPayError("");
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = accounts[0]?.toLowerCase();
      if (!addr) throw new Error("No account");
      setKillWallet(addr);
      const res = await fetch(`/api/killable-access?wallet=${addr}`);
      const data = await res.json();
      setHasAccess(data.hasAccess === true);
    } catch (e) {
      setPayError(e.message || "Connection failed");
    }
    setAccessLoading(false);
  };

  const payForAccess = async () => {
    if (!killWallet || !window.ethereum) return;
    setAccessLoading(true);
    setPayError("");
    try {
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{
          from: killWallet,
          to: TREASURY,
          value: PRICE_HEX,
        }],
      });
      setPayError("CONFIRMING TRANSACTION...");
      // Wait for confirmation
      let confirmed = false;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const receipt = await window.ethereum.request({
            method: "eth_getTransactionReceipt",
            params: [txHash],
          });
          if (receipt && receipt.status === "0x1") { confirmed = true; break; }
          if (receipt && receipt.status === "0x0") throw new Error("Transaction reverted");
        } catch {}
      }
      if (!confirmed) throw new Error("Transaction not confirmed after 3 minutes");
      // Verify with server
      const res = await fetch("/api/killable-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: killWallet, txHash }),
      });
      const result = await res.json();
      if (result.hasAccess) {
        setHasAccess(true);
        setPayError("");
      } else {
        throw new Error(result.error || "Verification failed");
      }
    } catch (e) {
      setPayError(e.message || "Payment failed");
    }
    setAccessLoading(false);
  };

  // Auto-check access when switching to KILLABLE tab
  useEffect(() => {
    if (tab === "KILLABLE" && !killWallet && window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
        if (accounts[0]) {
          const addr = accounts[0].toLowerCase();
          setKillWallet(addr);
          fetch(`/api/killable-access?wallet=${addr}`)
            .then((r) => r.json())
            .then((d) => setHasAccess(d.hasAccess === true))
            .catch(() => {});
        }
      }).catch(() => {});
    }
  }, [tab, killWallet]);

  if (!data && loading) {
    return (
      <div style={{ padding: mobile ? 16 : 40, width: "100%", boxSizing: "border-box" }}>
        <div style={{ fontSize: mobile ? 28 : 48, fontFamily: `"${HEADING_FONT}", monospace`, marginBottom: 16 }}>
          KILL FEED
        </div>
        <div style={{ border: `2px solid ${fg}`, padding: 40, textAlign: "center", fontSize: mobile ? 16 : 22, fontFamily: `"${BODY_FONT}", monospace` }}>
          FETCHING LEADERBOARD DATA...
        </div>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div style={{ padding: mobile ? 16 : 40, width: "100%", boxSizing: "border-box" }}>
        <div style={{ fontSize: mobile ? 28 : 48, fontFamily: `"${HEADING_FONT}", monospace`, marginBottom: 16 }}>
          KILL FEED
        </div>
        <div style={{ border: `2px dashed ${fg}`, padding: 40, textAlign: "center", fontSize: mobile ? 16 : 22 }}>
          {error}
        </div>
        <button onClick={fetchData} style={{ marginTop: 16, background: fg, color: bg, border: "none", padding: "8px 20px", fontSize: 16, fontWeight: 500, cursor: "pointer", fontFamily: `"${HEADING_FONT}", monospace` }}>
          RETRY
        </button>
      </div>
    );
  }

  if (!data) return null;

  const killLb = data.killLeaderboard || [];
  const auditLb = data.auditLeaderboard || [];
  const recentKills = data.recentKills || [];
  const recentAudits = data.recentAudits || [];
  const topKills = killLb.length > 0 ? killLb[0].kills : 1;
  const topAudits = auditLb.length > 0 ? auditLb[0].audits : 1;

  // Combine recent kills + audits for ticker
  const ticker = [
    ...recentKills.slice(0, 20).map((k) => ({ type: "KILL", text: `#${k.tokenId} KILLED BY ${k.ens || shortAddr(k.executor)}` })),
    ...recentAudits.slice(0, 15).map((a) => ({ type: "AUDIT", text: `#${a.fromTokenId} AUDITED #${a.targetTokenId}` })),
  ];

  return (
    <div style={{ padding: mobile ? 16 : 40, width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", overflow: "hidden", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* TICKER */}
      {ticker.length > 0 && (
        <div
          onClick={() => { setPaused((p) => !p); playClick(); }}
          style={{
            overflow: "hidden",
            border: `3px solid ${fg}`,
            background: fg,
            color: bg,
            padding: "10px 0",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 30,
              whiteSpace: "nowrap",
              animation: paused ? "none" : "dt-marquee 80s linear infinite",
              fontFamily: `"${BODY_FONT}", monospace`,
              fontSize: mobile ? 12 : 15,
              fontWeight: 500,
              letterSpacing: 1,
            }}
          >
            {[...ticker, ...ticker].map((t, i) => (
              <span key={i} style={{ color: bg }}>
                {t.text}
              </span>
            ))}
          </div>
          <style>{`@keyframes dt-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
        </div>
      )}

      {/* HEADER + STATS */}
      <div style={{ borderBottom: `4px solid ${fg}`, paddingBottom: 16 }}>
        <div style={{ fontSize: mobile ? 28 : 48, fontFamily: `"${HEADING_FONT}", monospace`, lineHeight: 1 }}>
          KILL FEED
        </div>
        <div style={{
          display: "flex",
          gap: mobile ? 16 : 32,
          marginTop: 12,
          flexWrap: "wrap",
          fontFamily: `"${BODY_FONT}", monospace`,
        }}>
          <div>
            <span style={{ fontSize: mobile ? 24 : 36, fontWeight: 900 }}>{data.totalKills || 0}</span>
            <span style={{ fontSize: mobile ? 11 : 14, opacity: 0.6, marginLeft: 8 }}>KILLS</span>
          </div>
          <div>
            <span style={{ fontSize: mobile ? 24 : 36, fontWeight: 900 }}>{data.totalAudits || 0}</span>
            <span style={{ fontSize: mobile ? 11 : 14, opacity: 0.6, marginLeft: 8 }}>AUDITS</span>
          </div>
          <div>
            <span style={{ fontSize: mobile ? 24 : 36, fontWeight: 900 }}>{data.currentEpoch || 0}</span>
            <span style={{ fontSize: mobile ? 11 : 14, opacity: 0.6, marginLeft: 8 }}>EPOCH</span>
          </div>
        </div>
      </div>

      {/* TABS: KILLS / AUDITS */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["KILLS", "AUDITS", "KILLABLE"].map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setViewMode("LEADERBOARD"); playClick(); }}
            style={{
              background: tab === t ? fg : "transparent",
              color: tab === t ? bg : fg,
              border: `2px solid ${fg}`,
              padding: "6px 16px",
              fontSize: mobile ? 14 : 16,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: `"${HEADING_FONT}", monospace`,
            }}
          >
            {t}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {/* Sub-view toggle (only for KILLS/AUDITS) */}
        {tab !== "KILLABLE" && ["LEADERBOARD", "RECENT"].map((v) => (
          <button
            key={v}
            onClick={() => { setViewMode(v); playClick(); }}
            style={{
              background: viewMode === v ? fg : "transparent",
              color: viewMode === v ? bg : fg,
              border: `2px solid ${fg}`,
              padding: "4px 12px",
              fontSize: mobile ? 12 : 14,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: `"${BODY_FONT}", monospace`,
            }}
          >
            {v}
          </button>
        ))}
        <button
          onClick={() => { fetchData(); playStaticBuzz(); }}
          disabled={loading}
          style={{
            background: "transparent",
            color: fg,
            border: `2px solid ${fg}`,
            padding: "4px 12px",
            fontSize: mobile ? 12 : 14,
            fontWeight: 500,
            cursor: loading ? "wait" : "pointer",
            fontFamily: `"${BODY_FONT}", monospace`,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "..." : "REFRESH"}
        </button>
      </div>

      {/* ═══ KILLS TAB ═══ */}
      {tab === "KILLS" && viewMode === "LEADERBOARD" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: mobile ? 12 : 14, opacity: 0.5, fontFamily: `"${BODY_FONT}", monospace`, marginBottom: 8 }}>
            TOP EXECUTIONERS — RANKED BY KILL COUNT
          </div>
          {killLb.map((k) => {
            let badge = "";
            if (k.rank === 1) badge = "GRIM REAPER";
            else if (k.rank === 2) badge = "EXECUTIONER";
            else if (k.rank === 3) badge = "HITMAN";
            else if (k.kills >= 50) badge = "SERIAL KILLER";
            else if (k.kills >= 20) badge = "HUNTER";
            else if (k.kills >= 5) badge = "ENFORCER";

            return (
              <div
                key={k.address}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: mobile ? 6 : 16,
                  border: `2px solid ${fg}`,
                  padding: mobile ? "8px 6px" : 12,
                  background: k.rank <= 3 ? fg : "transparent",
                  color: k.rank <= 3 ? bg : fg,
                  overflow: "hidden",
                }}
              >
                {/* Rank */}
                <div style={{
                  fontSize: k.rank <= 3 ? (mobile ? 22 : 32) : (mobile ? 16 : 20),
                  fontWeight: 900,
                  fontFamily: `"${BODY_FONT}", monospace`,
                  width: mobile ? 36 : 48,
                  textAlign: "center",
                  flexShrink: 0,
                }}>
                  #{k.rank}
                </div>

                {/* Address + badge */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: mobile ? 13 : 16,
                    fontWeight: 500,
                    fontFamily: `"${BODY_FONT}", monospace`,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {displayAddr(k.address, k.ens, mobile)}
                  </div>
                  {badge && (
                    <div style={{
                      fontSize: mobile ? 10 : 12,
                      fontWeight: 400,
                      marginTop: 2,
                      fontFamily: `"${BODY_FONT}", monospace`,
                      letterSpacing: 1,
                      opacity: k.rank <= 3 ? 0.8 : 0.5,
                    }}>
                      {badge}
                    </div>
                  )}
                </div>

                {/* Kill bar */}
                <div style={{ width: mobile ? 60 : 120, flexShrink: 0 }}>
                  <div style={{
                    height: 14,
                    background: k.rank <= 3 ? `${bg}33` : `${fg}22`,
                    position: "relative",
                    border: `1px solid ${k.rank <= 3 ? bg : fg}`,
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${(k.kills / topKills) * 100}%`,
                      background: k.rank <= 3 ? bg : fg,
                    }} />
                  </div>
                </div>

                {/* Pct */}
                <div style={{
                  fontSize: mobile ? 11 : 14,
                  fontFamily: `"${BODY_FONT}", monospace`,
                  opacity: 0.6,
                  width: mobile ? 36 : 48,
                  textAlign: "right",
                  flexShrink: 0,
                }}>
                  {data.totalKills ? ((k.kills / data.totalKills) * 100).toFixed(1) + "%" : ""}
                </div>

                {/* Count */}
                <div style={{
                  fontSize: k.rank <= 3 ? (mobile ? 20 : 28) : (mobile ? 16 : 20),
                  fontWeight: 900,
                  fontFamily: `"${BODY_FONT}", monospace`,
                  width: mobile ? 40 : 56,
                  textAlign: "right",
                  flexShrink: 0,
                  color: k.rank <= 3 ? bg : fg,
                }}>
                  {k.kills}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RECENT KILLS */}
      {tab === "KILLS" && viewMode === "RECENT" && (
        <div>
          <div style={{ fontSize: mobile ? 12 : 14, opacity: 0.5, fontFamily: `"${BODY_FONT}", monospace`, marginBottom: 12 }}>
            RECENT ELIMINATIONS
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: 8,
          }}>
            {recentKills.map((k, i) => (
              <div
                key={i}
                style={{
                  border: `2px solid ${fg}`,
                  padding: mobile ? 8 : 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ fontSize: mobile ? 18 : 24, fontWeight: 900, fontFamily: `"${BODY_FONT}", monospace` }}>
                  #{k.tokenId}
                </div>
                <div style={{
                  fontSize: mobile ? 11 : 13,
                  fontFamily: `"${BODY_FONT}", monospace`,
                  opacity: 0.6,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {displayAddr(k.executor, k.ens, true)}
                </div>
                <div style={{
                  background: fg,
                  color: bg,
                  padding: "2px 6px",
                  fontSize: mobile ? 10 : 12,
                  fontWeight: 500,
                  fontFamily: `"${BODY_FONT}", monospace`,
                  alignSelf: "flex-start",
                }}>
                  KILLED
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ AUDITS TAB ═══ */}
      {tab === "AUDITS" && viewMode === "LEADERBOARD" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: mobile ? 12 : 14, opacity: 0.5, fontFamily: `"${BODY_FONT}", monospace`, marginBottom: 8 }}>
            TOP AUDITORS — RANKED BY AUDIT COUNT
          </div>
          {auditLb.map((a) => (
            <div
              key={a.address}
              style={{
                display: "flex",
                alignItems: "center",
                gap: mobile ? 6 : 16,
                border: `2px solid ${fg}`,
                padding: mobile ? "8px 6px" : 12,
                background: a.rank <= 3 ? fg : "transparent",
                color: a.rank <= 3 ? bg : fg,
                overflow: "hidden",
              }}
            >
              <div style={{
                fontSize: a.rank <= 3 ? (mobile ? 22 : 32) : (mobile ? 16 : 20),
                fontWeight: 900,
                fontFamily: `"${BODY_FONT}", monospace`,
                width: mobile ? 36 : 48,
                textAlign: "center",
                flexShrink: 0,
              }}>
                #{a.rank}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: mobile ? 13 : 16,
                  fontWeight: 500,
                  fontFamily: `"${BODY_FONT}", monospace`,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {displayAddr(a.address, a.ens, mobile)}
                </div>
              </div>

              <div style={{ width: mobile ? 60 : 120, flexShrink: 0 }}>
                <div style={{
                  height: 14,
                  background: a.rank <= 3 ? `${bg}33` : `${fg}22`,
                  position: "relative",
                  border: `1px solid ${a.rank <= 3 ? bg : fg}`,
                }}>
                  <div style={{
                    height: "100%",
                    width: `${(a.audits / topAudits) * 100}%`,
                    background: a.rank <= 3 ? bg : fg,
                  }} />
                </div>
              </div>

              <div style={{
                fontSize: mobile ? 11 : 14,
                fontFamily: `"${BODY_FONT}", monospace`,
                opacity: 0.6,
                width: mobile ? 36 : 48,
                textAlign: "right",
                flexShrink: 0,
              }}>
                {data.totalAudits ? ((a.audits / data.totalAudits) * 100).toFixed(1) + "%" : ""}
              </div>

              <div style={{
                fontSize: a.rank <= 3 ? (mobile ? 20 : 28) : (mobile ? 16 : 20),
                fontWeight: 900,
                fontFamily: `"${BODY_FONT}", monospace`,
                width: mobile ? 40 : 56,
                textAlign: "right",
                flexShrink: 0,
              }}>
                {a.audits}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RECENT AUDITS */}
      {tab === "AUDITS" && viewMode === "RECENT" && (
        <div>
          <div style={{ fontSize: mobile ? 12 : 14, opacity: 0.5, fontFamily: `"${BODY_FONT}", monospace`, marginBottom: 12 }}>
            RECENT AUDITS
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: 8,
          }}>
            {recentAudits.map((a, i) => (
              <div
                key={i}
                style={{
                  border: `2px solid ${fg}`,
                  padding: mobile ? 8 : 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ fontSize: mobile ? 14 : 18, fontWeight: 900, fontFamily: `"${BODY_FONT}", monospace` }}>
                  #{a.fromTokenId} → #{a.targetTokenId}
                </div>
                <div style={{
                  fontSize: mobile ? 11 : 13,
                  fontFamily: `"${BODY_FONT}", monospace`,
                  opacity: 0.6,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {displayAddr(a.executor, a.ens, true)}
                </div>
                <div style={{
                  background: fg,
                  color: bg,
                  padding: "2px 6px",
                  fontSize: mobile ? 10 : 12,
                  fontWeight: 500,
                  fontFamily: `"${BODY_FONT}", monospace`,
                  alignSelf: "flex-start",
                }}>
                  AUDIT
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ KILLABLE TAB ═══ */}
      {tab === "KILLABLE" && !hasAccess && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
          border: `3px solid ${fg}`, padding: mobile ? 24 : 48, textAlign: "center",
        }}>
          <div style={{ fontSize: mobile ? 24 : 36, fontWeight: 900, fontFamily: `"${HEADING_FONT}", monospace` }}>
            CLASSIFIED DATA
          </div>
          <div style={{ fontSize: mobile ? 13 : 16, fontFamily: `"${BODY_FONT}", monospace`, opacity: 0.7, maxWidth: 500 }}>
            REAL-TIME KILLABLE CITIZEN SCAN REQUIRES ONE-TIME ACCESS FEE.
            SCANS ALL 6969 CITIZENS ON-CHAIN TO IDENTIFY TARGETS WITH EXPIRED AUDITS.
          </div>
          <div style={{
            fontSize: mobile ? 32 : 48, fontWeight: 900,
            fontFamily: `"${BODY_FONT}", monospace`,
          }}>
            {PRICE_ETH} ETH
          </div>
          <div style={{ fontSize: 12, fontFamily: `"${BODY_FONT}", monospace`, opacity: 0.5 }}>
            ONE-TIME PAYMENT — PERMANENT ACCESS
          </div>

          {!killWallet ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
              {window.ethereum ? (
                <button
                  onClick={connectAndCheckAccess}
                  disabled={accessLoading}
                  style={{
                    background: fg, color: bg, border: "none",
                    padding: "14px 32px", fontSize: mobile ? 16 : 20, fontWeight: 700,
                    fontFamily: `"${HEADING_FONT}", monospace`, cursor: "pointer",
                    letterSpacing: 1,
                  }}
                >
                  {accessLoading ? "CONNECTING..." : "CONNECT WALLET"}
                </button>
              ) : (
                <a
                  href={`https://metamask.app.link/dapp/${window.location.host}/killfeed`}
                  style={{
                    background: fg, color: bg, border: "none",
                    padding: "14px 32px", fontSize: mobile ? 16 : 20, fontWeight: 700,
                    fontFamily: `"${HEADING_FONT}", monospace`, cursor: "pointer",
                    letterSpacing: 1, textDecoration: "none", display: "inline-block",
                  }}
                >
                  OPEN IN METAMASK
                </a>
              )}
            </div>
          ) : (
            <button
              onClick={payForAccess}
              disabled={accessLoading}
              style={{
                background: "#ff0000", color: "#fff", border: "none",
                padding: "14px 32px", fontSize: mobile ? 16 : 20, fontWeight: 700,
                fontFamily: `"${HEADING_FONT}", monospace`, cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              {accessLoading ? (payError || "PROCESSING...") : `PAY ${PRICE_ETH} ETH`}
            </button>
          )}

          {killWallet && (
            <div style={{ fontSize: 12, fontFamily: `"${BODY_FONT}", monospace`, opacity: 0.5 }}>
              {killWallet.slice(0, 6)}...{killWallet.slice(-4)}
            </div>
          )}

          {payError && !accessLoading && (
            <div style={{ fontSize: 13, fontFamily: `"${BODY_FONT}", monospace`, color: "#ff0000" }}>
              {payError}
            </div>
          )}
        </div>
      )}

      {tab === "KILLABLE" && hasAccess && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: mobile ? 12 : 14, opacity: 0.5, fontFamily: `"${BODY_FONT}", monospace` }}>
            CITIZENS WITH DELINQUENT TAX + EXPIRED AUDIT — READY TO BE ELIMINATED
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => { scanKillable(); playStaticBuzz(); }}
              disabled={killableLoading}
              style={{
                background: killableLoading ? fg : "transparent",
                color: killableLoading ? bg : fg,
                border: `2px solid ${fg}`,
                padding: "8px 20px",
                fontSize: mobile ? 14 : 16,
                fontWeight: 700,
                cursor: killableLoading ? "wait" : "pointer",
                fontFamily: `"${HEADING_FONT}", monospace`,
              }}
            >
              {killableLoading ? killableProgress : "SCAN ALL CITIZENS"}
            </button>
            {killable.length > 0 && !killableLoading && (
              <div style={{ display: "flex", gap: 12, fontFamily: `"${BODY_FONT}", monospace` }}>
                <span style={{ fontSize: mobile ? 14 : 18, fontWeight: 900, color: "#ff0000" }}>
                  {killable.filter((c) => c.killable).length} KILLABLE
                </span>
                <span style={{ fontSize: mobile ? 14 : 18, fontWeight: 900, color: "#cc0000" }}>
                  {killable.filter((c) => !c.killable).length} DELINQUENT
                </span>
              </div>
            )}
          </div>

          {killable.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
              gap: 4,
            }}>
              {killable.map((c) => (
                <div
                  key={c.tokenId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: mobile ? 8 : 16,
                    border: `2px solid ${fg}`,
                    padding: mobile ? "8px 10px" : "10px 16px",
                    background: c.killable ? "#ff000015" : "transparent",
                  }}
                >
                  <div style={{
                    fontSize: mobile ? 18 : 24,
                    fontWeight: 900,
                    fontFamily: `"${BODY_FONT}", monospace`,
                    minWidth: mobile ? 60 : 80,
                  }}>
                    #{c.tokenId}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: mobile ? 11 : 13,
                      fontFamily: `"${BODY_FONT}", monospace`,
                      opacity: 0.6,
                    }}>
                      {Math.abs(c.daysRemaining)}d OVERDUE
                    </div>
                    <div style={{ marginTop: 2 }}>
                      {c.killable ? (
                        <Countdown targetTs={0} mobile={mobile} />
                      ) : c.auditDue ? (
                        <Countdown targetTs={c.auditDue} mobile={mobile} />
                      ) : (
                        <span style={{ fontSize: mobile ? 11 : 13, fontFamily: `"${BODY_FONT}", monospace`, opacity: 0.4 }}>NO AUDIT YET</span>
                      )}
                    </div>
                  </div>
                  <a
                    href="https://www.deptofdeath.xyz/directory"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: c.killable ? "#ff0000" : "#cc0000",
                      color: "#fff",
                      padding: mobile ? "4px 8px" : "6px 12px",
                      fontSize: mobile ? 10 : 12,
                      fontWeight: 700,
                      fontFamily: `"${BODY_FONT}", monospace`,
                      letterSpacing: 1,
                      flexShrink: 0,
                      textDecoration: "none",
                      cursor: "pointer",
                    }}>
                    {c.killable ? "KILL" : "VIEW"}
                  </a>
                </div>
              ))}
            </div>
          )}

          {killable.length === 0 && !killableLoading && (
            <div style={{ fontSize: 14, opacity: 0.4, fontFamily: `"${BODY_FONT}", monospace`, padding: 40, textAlign: "center", border: `2px dashed ${fg}` }}>
              CLICK SCAN TO CHECK ALL {TOTAL_CITIZENS} CITIZENS
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ fontSize: mobile ? 10 : 12, opacity: 0.4, fontFamily: `"${BODY_FONT}", monospace`, textAlign: "center", marginTop: 8 }}>
        DATA: DT-LEADERBOARD // {data.updatedAt ? `UPDATED ${new Date(data.updatedAt).toLocaleString()}` : ""} // EPOCH {data.currentEpoch || 0}
      </div>
    </div>
  );
}

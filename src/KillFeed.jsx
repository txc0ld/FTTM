import { useState, useEffect, useRef } from "react";
import { useTheme } from "./shared/theme";
import { useSound } from "./shared/sound";

const HEADING_FONT = "DeptBody";
const BODY_FONT = "DeptBody";
const LEADERBOARD_API = "https://dt-leaderboard-livid.vercel.app/api/leaderboard";
const LS_KEY = "dt_boneyard_cache";
const KILL_CACHE_KEY = "dt_kill_leaderboard";
const FIVE_MIN = 5 * 60 * 1000;

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

export default function KillFeed({ mobile }) {
  const { colors } = useTheme();
  const { playClick, playStaticBuzz } = useSound();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("KILLS");
  const [viewMode, setViewMode] = useState("LEADERBOARD");
  const [paused, setPaused] = useState(false);

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
            <span style={{ fontSize: mobile ? 24 : 36, fontWeight: 900, fontFamily: `"${HEADING_FONT}", monospace` }}>{data.totalKills || 0}</span>
            <span style={{ fontSize: mobile ? 11 : 14, opacity: 0.6, marginLeft: 8 }}>KILLS</span>
          </div>
          <div>
            <span style={{ fontSize: mobile ? 24 : 36, fontWeight: 900, fontFamily: `"${HEADING_FONT}", monospace` }}>{data.totalAudits || 0}</span>
            <span style={{ fontSize: mobile ? 11 : 14, opacity: 0.6, marginLeft: 8 }}>AUDITS</span>
          </div>
          <div>
            <span style={{ fontSize: mobile ? 24 : 36, fontWeight: 900, fontFamily: `"${HEADING_FONT}", monospace` }}>{data.currentEpoch || 0}</span>
            <span style={{ fontSize: mobile ? 11 : 14, opacity: 0.6, marginLeft: 8 }}>EPOCH</span>
          </div>
        </div>
      </div>

      {/* TABS: KILLS / AUDITS */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["KILLS", "AUDITS"].map((t) => (
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
        {/* Sub-view toggle */}
        {["LEADERBOARD", "RECENT"].map((v) => (
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
                  fontFamily: `"${HEADING_FONT}", monospace`,
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
                  fontFamily: `"${HEADING_FONT}", monospace`,
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
                <div style={{ fontSize: mobile ? 18 : 24, fontWeight: 900, fontFamily: `"${HEADING_FONT}", monospace` }}>
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
                fontFamily: `"${HEADING_FONT}", monospace`,
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
                fontFamily: `"${HEADING_FONT}", monospace`,
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
                <div style={{ fontSize: mobile ? 14 : 18, fontWeight: 900, fontFamily: `"${HEADING_FONT}", monospace` }}>
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

      {/* Footer */}
      <div style={{ fontSize: mobile ? 10 : 12, opacity: 0.4, fontFamily: `"${BODY_FONT}", monospace`, textAlign: "center", marginTop: 8 }}>
        DATA: DT-LEADERBOARD // {data.updatedAt ? `UPDATED ${new Date(data.updatedAt).toLocaleString()}` : ""} // EPOCH {data.currentEpoch || 0}
      </div>
    </div>
  );
}

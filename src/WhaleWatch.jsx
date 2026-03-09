import { useState, useEffect, useRef } from "react";
import { useTheme } from "./shared/theme";
import { useSound } from "./shared/sound";
import { CONTRACT, fetchOwnersForContract } from "./shared/api";

const HEADING_FONT = "Bajern";
const BODY_FONT = "DeptBody";
const LS_KEY = "dt_owners_cache";
const FOUR_HOURS = 4 * 60 * 60 * 1000;

function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY));
    if (raw && raw.ts && raw.owners) return raw;
  } catch {}
  return null;
}

function saveCache(owners) {
  localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), owners }));
}

function getBadge(count) {
  if (count >= 50) return { label: "KRAKEN", color: "#8b1a1a", textColor: "#fff" };
  if (count >= 20) return { label: "WHALE", color: "fg", textColor: "bg" };
  if (count >= 10) return { label: "SHARK", color: "#444", textColor: "#fff" };
  return null;
}

export default function WhaleWatch({ mobile }) {
  const { colors } = useTheme();
  const { playClick, playStaticBuzz } = useSound();
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const fetchingRef = useRef(false);

  const bg = colors.bg;
  const fg = colors.fg;

  const fetchOwners = async (silent = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (!silent) {
      setLoading(true);
      setProgress("SCANNING CHAIN...");
    }
    setError("");

    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      try {
        let pageKey = null;
        let allOwners = {};
        let pages = 0;

        do {
          const data = await fetchOwnersForContract(CONTRACT, {
            withTokenBalances: true,
            pageKey: pageKey || undefined,
          });

          (data.owners || []).forEach((o) => {
            const count = o.tokenBalances ? o.tokenBalances.length : 0;
            if (allOwners[o.ownerAddress]) {
              allOwners[o.ownerAddress] += count;
            } else {
              allOwners[o.ownerAddress] = count;
            }
          });

          pages++;
          if (!silent) setProgress(`SCANNING PAGE ${pages}... ${Object.keys(allOwners).length} OWNERS`);
          pageKey = data.pageKey || null;
          if (pageKey) await new Promise((r) => setTimeout(r, 200));
        } while (pageKey);

        const sorted = Object.entries(allOwners)
          .map(([addr, count]) => ({ addr, count }))
          .sort((a, b) => b.count - a.count);

        setOwners(sorted);
        saveCache(sorted);
        setLastRefresh(Date.now());
        if (!silent) setProgress("");
        fetchingRef.current = false;
        setLoading(false);
        return;
      } catch (e) {
        retries++;
        if (retries > maxRetries) {
          if (!silent) setError(e.message || "FAILED TO FETCH OWNERS");
          break;
        }
        // Wait before retry
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!silent) {
      setProgress("");
      setLoading(false);
    }
    fetchingRef.current = false;
  };

  // Always load cache first, then background refresh if stale
  useEffect(() => {
    const cached = loadCache();
    if (cached && cached.owners) {
      setOwners(cached.owners);
      setLastRefresh(cached.ts);
      // Background refresh if stale
      if (Date.now() - cached.ts >= FOUR_HOURS) {
        fetchOwners(true);
      }
    } else {
      fetchOwners(false);
    }
  }, []);

  const totalHeld = owners.reduce((s, o) => s + o.count, 0);
  const staleInfo = lastRefresh ? (() => {
    const age = Date.now() - lastRefresh;
    const h = Math.floor(age / (1000 * 60 * 60));
    const m = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m ago`;
  })() : null;

  return (
    <div style={{ padding: mobile ? 16 : 40, width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER */}
      <div style={{ borderBottom: `4px solid ${fg}`, paddingBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", justifyContent: "space-between", alignItems: mobile ? "flex-start" : "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: mobile ? 28 : 48, fontFamily: `"${HEADING_FONT}", monospace`, lineHeight: 1 }}>
              WHALE WATCH
            </div>
            <div style={{ fontSize: mobile ? 14 : 18, marginTop: 8, opacity: 0.7 }}>
              {owners.length} UNIQUE HOLDERS // {totalHeld} TOKENS TRACKED
              {staleInfo && ` // UPDATED ${staleInfo}`}
            </div>
          </div>
          <button
            onClick={() => { fetchOwners(false); playStaticBuzz(); }}
            disabled={loading}
            style={{
              background: loading ? fg : bg,
              color: loading ? bg : fg,
              border: `3px solid ${fg}`,
              padding: mobile ? "10px 20px" : "12px 24px",
              fontSize: mobile ? 14 : 18,
              fontWeight: 800,
              cursor: loading ? "wait" : "pointer",
              fontFamily: `"${HEADING_FONT}", monospace`,
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "SCANNING..." : "RESCAN"}
          </button>
        </div>
        {loading && progress && (
          <div style={{ fontSize: mobile ? 14 : 18, fontWeight: 700, marginTop: 12, background: fg, color: bg, padding: "8px 16px" }}>
            {progress}
          </div>
        )}
        {error && (
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.error, marginTop: 8 }}>
            {error}
            {owners.length > 0 && <span style={{ opacity: 0.7 }}> — SHOWING CACHED DATA</span>}
          </div>
        )}
      </div>

      {/* LEGEND */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: mobile ? 14 : 16, fontWeight: 700 }}>
        <span style={{ background: "#8b1a1a", color: "#fff", padding: "4px 10px" }}>KRAKEN (50+)</span>
        <span style={{ background: fg, color: bg, padding: "4px 10px" }}>WHALE (20+)</span>
        <span style={{ background: "#444", color: "#fff", padding: "4px 10px" }}>SHARK (10+)</span>
      </div>

      {/* LEADERBOARD */}
      {owners.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Header row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: mobile ? "40px 1fr 60px" : "60px 1fr 100px 80px",
            gap: 8,
            padding: "8px 12px",
            background: fg,
            color: bg,
            fontWeight: 800,
            fontSize: mobile ? 14 : 16,
            fontFamily: `"${BODY_FONT}", monospace`,
          }}>
            <span>#</span>
            <span>WALLET</span>
            {!mobile && <span>BADGE</span>}
            <span style={{ textAlign: "right" }}>COUNT</span>
          </div>
          {owners.slice(0, 100).map((o, i) => {
            const badge = getBadge(o.count);
            return (
              <div
                key={o.addr}
                style={{
                  display: "grid",
                  gridTemplateColumns: mobile ? "40px 1fr 60px" : "60px 1fr 100px 80px",
                  gap: 8,
                  padding: "8px 12px",
                  border: `1px solid ${fg}`,
                  fontSize: mobile ? 14 : 16,
                  fontFamily: `"${BODY_FONT}", monospace`,
                  background: i < 3 ? (colors.dark ? "rgba(223,255,0,0.08)" : "rgba(0,0,0,0.04)") : "transparent",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: 800 }}>{i + 1}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {mobile ? `${o.addr.slice(0, 6)}...${o.addr.slice(-4)}` : o.addr}
                </span>
                {!mobile && (
                  <span>
                    {badge && (
                      <span style={{ background: badge.color === "fg" ? fg : badge.color, color: badge.textColor === "bg" ? bg : badge.textColor, padding: "4px 10px", fontSize: 14, fontWeight: 800 }}>
                        {badge.label}
                      </span>
                    )}
                  </span>
                )}
                <span style={{ textAlign: "right", fontWeight: 800, fontSize: mobile ? 14 : 18 }}>
                  {o.count}
                  {mobile && badge && (
                    <span style={{ display: "block", background: badge.color === "fg" ? fg : badge.color, color: badge.textColor === "bg" ? bg : badge.textColor, padding: "4px 8px", fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                      {badge.label}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : !loading && (
        <div style={{ textAlign: "center", padding: 40, fontSize: 20, fontWeight: 600, border: `2px dashed ${fg}` }}>
          NO DATA YET.
          <button
            onClick={() => { fetchOwners(false); playStaticBuzz(); }}
            style={{
              display: "block",
              margin: "16px auto 0",
              background: fg,
              color: bg,
              border: "none",
              padding: "12px 24px",
              fontSize: 18,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: `"${HEADING_FONT}", monospace`,
            }}
          >
            SCAN NOW
          </button>
        </div>
      )}
    </div>
  );
}

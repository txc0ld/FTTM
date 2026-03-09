import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "./shared/theme";
import { useSound } from "./shared/sound";
import { EVADER_CONTRACT, parseEvaderMeta as _parseEvaderMeta, fetchNFTsForContract } from "./shared/api";
const HEADING_FONT = "Bajern";
const BODY_FONT = "DeptBody";

const LS_KEY = "dt_boneyard_cache";
const TWELVE_HOURS = 12 * 60 * 60 * 1000;

function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY));
    if (raw && raw.ts && raw.tokens) return raw;
  } catch {}
  return null;
}

function saveCache(tokens) {
  localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), tokens }));
}

function parseEvaderMeta(nft) {
  const parsed = _parseEvaderMeta(nft);
  // Convert ipfs:// protocol to a gateway URL
  if (parsed.image && parsed.image.startsWith("ipfs://"))
    parsed.image = parsed.image.replace("ipfs://", "https://ipfs.io/ipfs/");
  // Map shared field names to the ones this component uses
  return {
    id: parsed.id,
    name: parsed.name,
    image: parsed.image,
    allTraits: parsed.allTraits,
    mintTime: parsed.mintTimestamp,
    mintBlock: parsed.blockNumber,
    mintTx: parsed.transactionHash,
    mintAddress: parsed.mintAddress,
  };
}

async function fetchAllEvaders(onProgress) {
  let all = [];
  let pageKey = null;
  let pages = 0;

  do {
    const data = await fetchNFTsForContract(EVADER_CONTRACT, {
      withMetadata: true,
      limit: 100,
      pageKey: pageKey || undefined,
    });
    const nfts = (data.nfts || []).map(parseEvaderMeta);
    all = all.concat(nfts);
    pages++;
    if (onProgress) onProgress(pages, all.length);

    pageKey = data.pageKey || null;
    if (pageKey) await new Promise((r) => setTimeout(r, 100));
  } while (pageKey);

  all.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  return all;
}

function EvaderImg({ src, id, style, loading: lazy }) {
  const { colors: _c } = useTheme();
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        style={{
          ...style,
          background: _c.fg,
          color: _c.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: 800,
        }}
      >
        #{id}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`EVADER #${id}`}
      loading={lazy ? "lazy" : undefined}
      onError={() => setFailed(true)}
      style={{ ...style, background: "#1a1a1a" }}
    />
  );
}

export default function Boneyard({ mobile }) {
  const { colors } = useTheme();
  const { playClick, playStaticBuzz } = useSound();
  const BG = colors.bg;
  const BK = colors.fg;
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [lastFetch, setLastFetch] = useState(null);
  const [sortBy, setSortBy] = useState("id_asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedToken, setSelectedToken] = useState(null);
  const [subView, setSubView] = useState("GRID");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const statsRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Load from cache on mount, auto-fetch if stale or empty
  useEffect(() => {
    const cached = loadCache();
    if (cached && cached.tokens.length > 0) {
      setTokens(cached.tokens);
      setLastFetch(cached.ts);
      const age = Date.now() - cached.ts;
      if (age >= TWELVE_HOURS) {
        doFetch();
      }
    } else {
      doFetch();
    }
  }, []);

  const doFetch = async () => {
    setLoading(true);
    setError("");
    setProgress("SCRAPING PAGE 0...");
    try {
      const all = await fetchAllEvaders((pages, count) => {
        setProgress(`SCRAPING PAGE ${pages}... ${count} EVADERS RECOVERED`);
      });
      setTokens(all);
      setLastFetch(Date.now());
      saveCache(all);
      setProgress("");
    } catch (e) {
      setError(e.message || "FAILED TO FETCH EVADERS");
    }
    setLoading(false);
  };

  const sorted = [...tokens].sort((a, b) => {
    if (sortBy === "id_asc") return parseInt(a.id) - parseInt(b.id);
    if (sortBy === "id_desc") return parseInt(b.id) - parseInt(a.id);
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return 0;
  });

  const filtered = searchQuery
    ? sorted.filter(
        (t) =>
          t.id.includes(searchQuery) ||
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          Object.values(t.allTraits).some((v) =>
            String(v).toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : sorted;

  const staleMs = lastFetch ? Date.now() - lastFetch : null;
  const staleHours = staleMs ? Math.floor(staleMs / (1000 * 60 * 60)) : null;
  const staleMin = staleMs ? Math.floor((staleMs % (1000 * 60 * 60)) / (1000 * 60)) : null;

  return (
    <div
      style={{
        padding: mobile ? "16px" : "40px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* HEADER */}
      <div style={{ borderBottom: `4px solid ${BK}`, paddingBottom: 16 }}>
        <div
          style={{
            display: "flex",
            flexDirection: mobile ? "column" : "row",
            justifyContent: "space-between",
            alignItems: mobile ? "flex-start" : "center",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: mobile ? 14 : 18,
                fontWeight: 500,
                marginBottom: 4,
              }}
            >
              CONTRACT: {EVADER_CONTRACT.slice(0, 6)}...
              {EVADER_CONTRACT.slice(-4)}
            </div>
            <div
              style={{
                fontSize: mobile ? 14 : 16,
                fontWeight: 500,
                opacity: 0.6,
              }}
            >
              Auto-refreshes every 12 hours
              {lastFetch &&
                ` | Last pull: ${staleHours}h ${staleMin}m ago`}
            </div>
          </div>
          <button
            onClick={() => { doFetch(); playStaticBuzz(); }}
            disabled={loading}
            style={{
              background: loading ? BK : BG,
              color: loading ? BG : BK,
              border: `3px solid ${BK}`,
              padding: mobile ? "10px 20px" : "12px 24px",
              fontSize: mobile ? 14 : 18,
              fontWeight: 800,
              cursor: loading ? "wait" : "pointer",
              fontFamily: `"${HEADING_FONT}", monospace`,
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            {loading ? "EXHUMING..." : "PULL ALL EVADERS"}
          </button>
        </div>
        {loading && progress && (
          <div
            style={{
              fontSize: mobile ? 14 : 18,
              fontWeight: 700,
              marginTop: 12,
              background: BK,
              color: BG,
              padding: "8px 16px",
            }}
          >
            {progress}
          </div>
        )}
        {error && (
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: colors.error,
              marginTop: 8,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* STATS */}
      <div
        style={{
          display: "flex",
          gap: mobile ? 8 : 16,
          flexWrap: "wrap",
          fontSize: mobile ? 14 : 18,
          fontWeight: 700,
        }}
      >
        <span style={{ background: BK, color: BG, padding: "6px 14px" }}>
          {tokens.length} EVADERS CATALOGUED
        </span>
        {searchQuery && (
          <span style={{ border: `2px solid ${BK}`, padding: "4px 12px" }}>
            {filtered.length} MATCH{filtered.length !== 1 ? "ES" : ""}
          </span>
        )}
      </div>

      {/* SUB-NAV: GRID | TIMELINE | STATS */}
      {tokens.length > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          {["GRID", "TIMELINE", "STATS"].map((sv) => (
            <button
              key={sv}
              onClick={() => { setSubView(sv); playClick(); }}
              style={{
                background: subView === sv ? BK : "transparent",
                color: subView === sv ? BG : BK,
                border: `2px solid ${BK}`,
                padding: "6px 16px",
                fontSize: mobile ? 14 : 16,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: `"${HEADING_FONT}", monospace`,
              }}
            >
              {sv}
            </button>
          ))}
        </div>
      )}

      {/* SEARCH + SORT */}
      {tokens.length > 0 && subView === "GRID" && (
        <div
          style={{
            display: "flex",
            flexDirection: mobile ? "column" : "row",
            gap: 12,
            alignItems: mobile ? "stretch" : "center",
          }}
        >
          <input
            type="text"
            placeholder="SEARCH BY ID, NAME, OR TRAIT..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: `2px solid ${BK}`,
              padding: "10px 16px",
              fontSize: mobile ? 14 : 18,
              fontWeight: 600,
              outline: "none",
              textTransform: "uppercase",
              fontFamily: "inherit",
            }}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              background: "transparent",
              border: `2px solid ${BK}`,
              padding: mobile ? "8px 12px" : "10px 16px",
              fontSize: mobile ? 14 : 16,
              fontWeight: 600,
              outline: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              fontFamily: "inherit",
            }}
          >
            <option value="id_asc">ID (LOW TO HIGH)</option>
            <option value="id_desc">ID (HIGH TO LOW)</option>
            <option value="name">NAME</option>
          </select>
        </div>
      )}

      {/* TOKEN DETAIL POPOUT */}
      {selectedToken && (
        <div
          onClick={() => setSelectedToken(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: mobile ? 16 : 40,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: BG,
              color: BK,
              border: `4px solid ${BK}`,
              boxShadow: `8px 8px 0px ${BK}`,
              maxWidth: 640,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {/* Close bar */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: mobile ? "12px 16px" : "16px 24px",
              borderBottom: `3px solid ${BK}`,
            }}>
              <div style={{
                fontSize: mobile ? 24 : 36,
                fontWeight: 800,
                fontFamily: `"${HEADING_FONT}", monospace`,
                lineHeight: 1,
              }}>
                EVADER #{selectedToken.id}
              </div>
              <button
                onClick={() => setSelectedToken(null)}
                style={{
                  background: BK,
                  color: BG,
                  border: "none",
                  width: 36,
                  height: 36,
                  fontSize: 18,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                X
              </button>
            </div>

            {/* Image */}
            <div style={{ padding: mobile ? 16 : 24, background: "#1a1a1a", margin: mobile ? 0 : "0" }}>
              <EvaderImg
                src={selectedToken.image}
                id={selectedToken.id}
                style={{
                  width: "100%",
                  maxWidth: 480,
                  aspectRatio: "1",
                  imageRendering: "pixelated",
                  border: `3px solid ${BK}`,
                  display: "block",
                  margin: "0 auto",
                  background: "#1a1a1a",
                }}
              />
            </div>

            {/* Details */}
            <div style={{ padding: mobile ? "0 16px 16px" : "0 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: mobile ? 14 : 18, fontWeight: 500 }}>
                {selectedToken.name}
              </div>

              {Object.keys(selectedToken.allTraits).length > 0 ? (
                <div style={{ border: `2px solid ${BK}`, padding: 16, fontSize: mobile ? 14 : 18 }}>
                  <div style={{ fontSize: mobile ? 14 : 16, letterSpacing: 3, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>
                    TRAITS
                  </div>
                  {Object.entries(selectedToken.allTraits).map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 0",
                        borderBottom: `1px dashed ${BK}`,
                      }}
                    >
                      <span style={{ fontWeight: 400, textTransform: "uppercase" }}>{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 500, opacity: 0.6 }}>
                  NO METADATA AVAILABLE
                </div>
              )}

              {selectedToken.mintTime && (
                <div style={{ fontSize: mobile ? 14 : 16, opacity: 0.7 }}>
                  ELIMINATED: {new Date(selectedToken.mintTime).toLocaleString()}
                </div>
              )}

              <a
                href={`https://opensea.io/assets/ethereum/${EVADER_CONTRACT}/${selectedToken.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  background: BK,
                  color: BG,
                  padding: "10px 24px",
                  fontSize: mobile ? 14 : 16,
                  fontWeight: 700,
                  textDecoration: "none",
                  fontFamily: "inherit",
                  textAlign: "center",
                }}
              >
                VIEW ON OPENSEA
              </a>
            </div>
          </div>
        </div>
      )}

      {subView === "GRID" && (
      <>

      {/* TOKEN GRID */}
      {tokens.length === 0 && !loading ? (
        <div
          style={{
            fontSize: mobile ? 18 : 22,
            fontWeight: 500,
            padding: "40px 0",
            borderTop: `2px dashed ${BK}`,
            textAlign: "center",
          }}
        >
          NO EVADERS RECOVERED YET. HIT PULL TO EXHUME THE COLLECTION.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: mobile
              ? "repeat(auto-fill, minmax(140px, 1fr))"
              : "repeat(auto-fill, minmax(180px, 1fr))",
            gap: mobile ? 12 : 20,
          }}
        >
          {filtered.map((token) => (
            <div
              key={token.id}
              onClick={() => setSelectedToken(token)}
              style={{
                border: `3px solid ${BK}`,
                padding: 8,
                cursor: "pointer",
                background: "transparent",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                transition: "transform 0.1s, background 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translate(-2px, -2px)";
                e.currentTarget.style.boxShadow = `4px 4px 0px ${BK}`;
                e.currentTarget.style.background = colors.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <EvaderImg
                src={token.image}
                id={token.id}
                loading
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  imageRendering: "auto",
                  display: "block",
                  border: `1px solid ${BK}`,
                }}
              />
              <div
                style={{
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: mobile ? 18 : 24,
                    fontWeight: 800,
                    fontFamily: `"${HEADING_FONT}", monospace`,
                  }}
                >
                  #{token.id}
                </div>
                <div
                  style={{
                    fontSize: mobile ? 14 : 16,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    opacity: 0.7,
                  }}
                >
                  {token.name}
                </div>
                <a
                  href={`https://opensea.io/assets/ethereum/${EVADER_CONTRACT}/${token.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: BK,
                    textDecoration: "none",
                    opacity: 0.6,
                    marginTop: 2,
                  }}
                >
                  OPENSEA
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {/* TIMELINE VIEW */}
      {subView === "TIMELINE" && tokens.length > 0 && (() => {
        // Group tokens by date using mintTime or fallback to ID-based pseudo-date
        const grouped = {};
        tokens.forEach((t) => {
          let dateKey = "UNKNOWN DATE";
          if (t.mintTime) {
            const d = new Date(t.mintTime);
            if (!isNaN(d.getTime())) {
              dateKey = d.toISOString().split("T")[0];
            }
          }
          if (!grouped[dateKey]) grouped[dateKey] = [];
          grouped[dateKey].push(t);
        });
        const sortedDates = Object.keys(grouped).sort().reverse();

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {sortedDates.map((date) => (
              <div key={date}>
                <div style={{
                  fontSize: mobile ? 18 : 24,
                  fontWeight: 800,
                  fontFamily: `"${HEADING_FONT}", monospace`,
                  borderBottom: `3px solid ${BK}`,
                  paddingBottom: 8,
                  marginBottom: 12,
                }}>
                  {date} — {grouped[date].length} ELIMINATION{grouped[date].length !== 1 ? "S" : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {grouped[date].map((t) => (
                    <div
                      key={t.id}
                      onClick={() => { setSelectedToken(t); setSubView("GRID"); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: mobile ? 10 : 16,
                        border: `2px solid ${BK}`,
                        padding: mobile ? 6 : 10,
                        cursor: "pointer",
                        transition: "all 0.1s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = colors.hover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <EvaderImg
                        src={t.image}
                        id={t.id}
                        loading
                        style={{ width: mobile ? 40 : 56, height: mobile ? 40 : 56, objectFit: "cover", border: `2px solid ${BK}`, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, fontFamily: `"${HEADING_FONT}", monospace` }}>
                          EVADER #{t.id}
                        </div>
                        <div style={{ fontSize: mobile ? 14 : 16, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.name}
                        </div>
                      </div>
                      <div style={{
                        background: colors.error,
                        color: "#fff",
                        padding: "4px 10px",
                        fontSize: mobile ? 14 : 16,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}>
                        ELIMINATED
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* STATS VIEW */}
      {subView === "STATS" && tokens.length > 0 && (() => {
        // Compute kills per date
        const perDay = {};
        tokens.forEach((t) => {
          let dateKey = "UNKNOWN";
          if (t.mintTime) {
            const d = new Date(t.mintTime);
            if (!isNaN(d.getTime())) dateKey = d.toISOString().split("T")[0];
          }
          perDay[dateKey] = (perDay[dateKey] || 0) + 1;
        });
        const sortedDays = Object.entries(perDay).filter(([d]) => d !== "UNKNOWN").sort((a, b) => a[0].localeCompare(b[0]));
        const busiestDay = sortedDays.length > 0 ? sortedDays.reduce((a, b) => b[1] > a[1] ? b : a) : null;
        const avgRate = sortedDays.length > 0 ? (sortedDays.reduce((s, d) => s + d[1], 0) / sortedDays.length).toFixed(1) : "?";

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Stats cards */}
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
              <div style={{ border: `3px solid ${BK}`, padding: mobile ? 12 : 20, textAlign: "center" }}>
                <div style={{ fontSize: mobile ? 14 : 16, letterSpacing: 3, opacity: 0.7, marginBottom: 6 }}>TOTAL ELIMINATIONS</div>
                <div style={{ fontSize: mobile ? 32 : 48, fontWeight: 800, fontFamily: `"${HEADING_FONT}", monospace` }}>{tokens.length}</div>
              </div>
              <div style={{ border: `3px solid ${BK}`, padding: mobile ? 12 : 20, textAlign: "center" }}>
                <div style={{ fontSize: mobile ? 14 : 16, letterSpacing: 3, opacity: 0.7, marginBottom: 6 }}>BUSIEST DAY</div>
                <div style={{ fontSize: mobile ? 18 : 24, fontWeight: 800, fontFamily: `"${HEADING_FONT}", monospace` }}>
                  {busiestDay ? `${busiestDay[0]} (${busiestDay[1]})` : "?"}
                </div>
              </div>
              <div style={{ border: `3px solid ${BK}`, padding: mobile ? 12 : 20, textAlign: "center" }}>
                <div style={{ fontSize: mobile ? 14 : 16, letterSpacing: 3, opacity: 0.7, marginBottom: 6 }}>AVG PER DAY</div>
                <div style={{ fontSize: mobile ? 32 : 48, fontWeight: 800, fontFamily: `"${HEADING_FONT}", monospace` }}>{avgRate}</div>
              </div>
            </div>

            {/* Bar chart */}
            {sortedDays.length > 0 && (
              <div style={{ border: `2px solid ${BK}`, overflow: "hidden" }}>
                <canvas
                  ref={(el) => {
                    if (!el) return;
                    const barW = Math.max(30, Math.floor((el.parentElement?.offsetWidth || 600) / sortedDays.length));
                    const canvasW = barW * sortedDays.length;
                    const maxVal = Math.max(...sortedDays.map((d) => d[1]));
                    const canvasH = 300;
                    el.width = canvasW;
                    el.height = canvasH;
                    const ctx = el.getContext("2d");
                    ctx.fillStyle = BG;
                    ctx.fillRect(0, 0, canvasW, canvasH);
                    sortedDays.forEach(([date, count], i) => {
                      const h = (count / maxVal) * (canvasH - 50);
                      ctx.fillStyle = BK;
                      ctx.fillRect(i * barW + 2, canvasH - h - 20, barW - 4, h);
                      ctx.fillStyle = BK;
                      ctx.font = `bold 14px "${BODY_FONT}", monospace`;
                      ctx.textAlign = "center";
                      ctx.fillText(String(count), i * barW + barW / 2, canvasH - h - 26);
                      // Date label (rotated)
                      ctx.save();
                      ctx.translate(i * barW + barW / 2, canvasH - 4);
                      ctx.rotate(-Math.PI / 4);
                      ctx.font = `13px "${BODY_FONT}", monospace`;
                      ctx.textAlign = "right";
                      ctx.fillText(date.slice(5), 0, 0);
                      ctx.restore();
                    });
                  }}
                  style={{ width: "100%", display: "block" }}
                />
              </div>
            )}

            {/* Per-day table */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", background: BK, color: BG, padding: "6px 12px", fontWeight: 800, fontSize: mobile ? 14 : 16 }}>
                <span>DATE</span>
                <span style={{ textAlign: "right" }}>KILLS</span>
              </div>
              {[...sortedDays].reverse().map(([date, count]) => (
                <div key={date} style={{ display: "grid", gridTemplateColumns: "1fr 80px", border: `1px solid ${BK}`, padding: "4px 12px", fontSize: mobile ? 14 : 16 }}>
                  <span>{date}</span>
                  <span style={{ textAlign: "right", fontWeight: 800 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{
            position: "fixed",
            bottom: mobile ? 20 : 32,
            right: mobile ? 20 : 32,
            width: 44,
            height: 44,
            background: BK,
            color: BG,
            border: "none",
            fontSize: 20,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            opacity: 0.8,
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "0.8"}
        >
          ^
        </button>
      )}
    </div>
  );
}

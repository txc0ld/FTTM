import { useState, useEffect, useRef } from "react";
import { useTheme } from "./shared/theme";
import { useSound } from "./shared/sound";
import { CONTRACT, EVADER_CONTRACT, fetchNFTsForContract, fetchContractMeta as apiFetchContractMeta } from "./shared/api";

const HEADING_FONT = "Bajern";
const BODY_FONT = "DeptBody";

const CENSUS_LS = "dt_census_cache";
const SIX_HOURS = 6 * 60 * 60 * 1000;

function loadCensusCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CENSUS_LS));
    if (raw && raw.ts && Date.now() - raw.ts < SIX_HOURS) return raw;
  } catch {}
  return null;
}

function saveCensusCache(data) {
  localStorage.setItem(CENSUS_LS, JSON.stringify({ ts: Date.now(), ...data }));
}

export default function Census({ mobile }) {
  const { colors } = useTheme();
  const { playClick, playStaticBuzz } = useSound();
  const [contractMeta, setContractMeta] = useState(null);
  const [evaderMeta, setEvaderMeta] = useState(null);
  const [classes, setClasses] = useState(null);
  const [classEliminated, setClassEliminated] = useState({});
  const [insuredCount, setInsuredCount] = useState(0);
  const [uninsuredCount, setUninsuredCount] = useState(0);
  const [bribedCount, setBribedCount] = useState(0);
  const [unbribedCount, setUnbribedCount] = useState(0);
  const [bribedElimCount, setBribedElimCount] = useState(0);
  const [bribeHolders, setBribeHolders] = useState([]);
  const [bribeFilter, setBribeFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const chartRef = useRef(null);

  const bg = colors.bg;
  const fg = colors.fg;

  // Load from cache on mount
  useEffect(() => {
    const cached = loadCensusCache();
    if (cached) {
      if (cached.classes) setClasses(cached.classes);
      if (cached.classEliminated) setClassEliminated(cached.classEliminated);
      if (cached.insuredCount != null) setInsuredCount(cached.insuredCount);
      if (cached.uninsuredCount != null) setUninsuredCount(cached.uninsuredCount);
      if (cached.bribedCount != null) setBribedCount(cached.bribedCount);
      if (cached.unbribedCount != null) setUnbribedCount(cached.unbribedCount);
      if (cached.bribedElimCount != null) setBribedElimCount(cached.bribedElimCount);
      if (cached.bribeHolders) setBribeHolders(cached.bribeHolders);
    }
    fetchContractMetaData();
  }, []);

  // Draw bar chart when classes change
  useEffect(() => {
    if (!classes || !chartRef.current) return;
    drawChart();
  }, [classes, classEliminated, colors]);

  const fetchContractMetaData = async () => {
    try {
      const [main, evader] = await Promise.all([
        apiFetchContractMeta(CONTRACT),
        apiFetchContractMeta(EVADER_CONTRACT),
      ]);
      setContractMeta(main);
      setEvaderMeta(evader);
    } catch {}
  };

  const applyCensusResult = (r) => {
    setClasses(r.classes);
    setClassEliminated(r.classEliminated);
    setInsuredCount(r.insuredCount);
    setUninsuredCount(r.uninsuredCount);
    setBribedCount(r.bribedCount);
    setUnbribedCount(r.unbribedCount);
    setBribedElimCount(r.bribedElimCount);
    setBribeHolders(r.bribeHolders || []);
    saveCensusCache(r);
  };

  const scrapeClasses = async () => {
    setLoading(true);
    setError("");
    setProgress("REQUESTING CENSUS DATA...");
    try {
      // Try fast server-side census first
      const res = await fetch("/api/census");
      if (res.ok) {
        const data = await res.json();
        applyCensusResult(data);
        setProgress("");
        setLoading(false);
        return;
      }
    } catch {}

    // Fallback: client-side scrape
    setProgress("SERVER UNAVAILABLE — SCRAPING CLIENT-SIDE...");
    try {
      const classCounts = {};
      const classInsured = { yes: 0, no: 0 };
      let pageKey = null;
      let pages = 0;
      let total = 0;

      do {
        const data = await fetchNFTsForContract(CONTRACT, {
          withMetadata: true,
          limit: 100,
          pageKey: pageKey || undefined,
        });

        (data.nfts || []).forEach((nft) => {
          const attrs = {};
          (nft.raw?.metadata?.attributes || []).forEach((a) => {
            if (a.trait_type) attrs[a.trait_type.toLowerCase()] = a.value;
          });
          const cls = (attrs.class || attrs.type || "UNKNOWN").toUpperCase();
          classCounts[cls] = (classCounts[cls] || 0) + 1;
          const ins = (attrs.insured || attrs.insurance || "").toLowerCase();
          if (ins === "yes") classInsured.yes++;
          else classInsured.no++;
          total++;
        });

        pages++;
        setProgress(`SCANNING PAGE ${pages}... ${total} CITIZENS PROCESSED`);
        pageKey = data.pageKey || null;
        if (pageKey) await new Promise((r) => setTimeout(r, 200));
      } while (pageKey);

      const elimByClass = {};
      let evaderKey = null;
      let evaderPages = 0;
      do {
        let data;
        try {
          data = await fetchNFTsForContract(EVADER_CONTRACT, {
            withMetadata: true,
            limit: 100,
            pageKey: evaderKey || undefined,
          });
        } catch {
          break;
        }

        (data.nfts || []).forEach((nft) => {
          const attrs = {};
          (nft.raw?.metadata?.attributes || []).forEach((a) => {
            if (a.trait_type) attrs[a.trait_type.toLowerCase()] = a.value;
          });
          const cls = (attrs.class || attrs.type || "UNKNOWN").toUpperCase();
          elimByClass[cls] = (elimByClass[cls] || 0) + 1;
        });

        evaderPages++;
        setProgress(`SCANNING EVADERS PAGE ${evaderPages}...`);
        evaderKey = data.pageKey || null;
        if (evaderKey) await new Promise((r) => setTimeout(r, 200));
      } while (evaderKey);

      // Bribe data requires on-chain game contract query (server-side only)
      applyCensusResult({
        classes: classCounts, classEliminated: elimByClass,
        insuredCount: classInsured.yes, uninsuredCount: classInsured.no,
        bribedCount: 0, unbribedCount: 0,
        bribedElimCount: 0,
      });
      setProgress("");
    } catch (e) {
      setError(e.message || "CENSUS FAILED");
    }
    setLoading(false);
  };

  const drawChart = () => {
    const canvas = chartRef.current;
    if (!canvas || !classes) return;
    const entries = Object.entries(classes).sort((a, b) => b[1] - a[1]);
    const barH = 32;
    const labelW = mobile ? 80 : 140;
    const padding = 20;
    const canvasH = entries.length * (barH + 8) + padding * 2;
    const canvasW = canvas.parentElement?.offsetWidth || 600;

    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvasW, canvasH);

    const maxVal = Math.max(...entries.map((e) => e[1]));
    const barAreaW = canvasW - labelW - padding * 2;

    entries.forEach(([cls, count], i) => {
      const y = padding + i * (barH + 8);
      const barW = (count / maxVal) * barAreaW;

      // Label
      ctx.fillStyle = fg;
      ctx.font = `bold ${mobile ? 14 : 16}px "${BODY_FONT}", monospace`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(cls, labelW - 8, y + barH / 2);

      // Bar
      ctx.fillStyle = fg;
      ctx.fillRect(labelW, y, barW, barH);

      // Count text
      ctx.fillStyle = barW > 40 ? bg : fg;
      ctx.textAlign = barW > 40 ? "right" : "left";
      ctx.font = `bold ${mobile ? 14 : 16}px "${BODY_FONT}", monospace`;
      ctx.fillText(String(count), barW > 40 ? labelW + barW - 8 : labelW + barW + 8, y + barH / 2);

      // Elimination overlay
      const elim = classEliminated[cls] || 0;
      if (elim > 0) {
        const elimW = (elim / maxVal) * barAreaW;
        ctx.fillStyle = "#8b1a1a";
        ctx.globalAlpha = 0.7;
        ctx.fillRect(labelW, y, elimW, barH);
        ctx.globalAlpha = 1;
      }
    });
  };

  const elimFromCensus = Object.values(classEliminated).reduce((s, v) => s + v, 0);
  const evaderSupply = evaderMeta?.totalSupply || evaderMeta?.openSeaMetadata?.totalSupply || null;
  const elimTotal = elimFromCensus || (evaderSupply ? parseInt(evaderSupply) : 0);
  const livingSupply = contractMeta?.totalSupply || contractMeta?.openSeaMetadata?.totalSupply || "?";
  const totalSupply = livingSupply !== "?" && elimTotal ? parseInt(livingSupply) + elimTotal : livingSupply;
  const floorPrice = contractMeta?.openSeaMetadata?.floorPrice || "?";

  const hasInsurance = insuredCount > 0 || uninsuredCount > 0;
  const hasBribes = bribedCount > 0 || unbribedCount > 0;

  const sectionHeader = (text) => (
    <div style={{
      borderBottom: `3px solid ${fg}`,
      paddingBottom: 8,
      marginTop: 16,
      fontSize: mobile ? 20 : 28,
      fontWeight: 800,
      fontFamily: `"${HEADING_FONT}", serif`,
      letterSpacing: 3,
    }}>
      {text}
    </div>
  );

  return (
    <div style={{ padding: mobile ? 16 : 40, width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER */}
      <div style={{ borderBottom: `4px solid ${fg}`, paddingBottom: 16 }}>
        <div style={{ fontSize: mobile ? 28 : 48, fontFamily: `"${HEADING_FONT}", serif`, lineHeight: 1 }}>
          CENSUS BUREAU
        </div>
        <div style={{ fontSize: mobile ? 14 : 18, marginTop: 8, opacity: 0.7 }}>
          POPULATION DATA // CLASS BREAKDOWN // INSURANCE REPORT // BRIBE REPORT
        </div>
      </div>

      {/* SCAN CONTROLS */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => { scrapeClasses(); playStaticBuzz(); }}
          disabled={loading}
          style={{
            background: loading ? fg : bg,
            color: loading ? bg : fg,
            border: `3px solid ${fg}`,
            padding: "10px 24px",
            fontSize: mobile ? 16 : 20,
            fontWeight: 800,
            cursor: loading ? "wait" : "pointer",
            fontFamily: `"${HEADING_FONT}", serif`,
          }}
        >
          {loading ? "SCRAPING..." : classes ? "RESCAN CENSUS" : "RUN CENSUS"}
        </button>
        {loading && progress && (
          <span style={{ background: fg, color: bg, padding: "6px 14px", fontWeight: 700, fontSize: mobile ? 14 : 16 }}>
            {progress}
          </span>
        )}
        {error && <span style={{ color: colors.error, fontWeight: 700 }}>{error}</span>}
      </div>

      {/* ─── POPULATION ─── */}
      {sectionHeader("POPULATION")}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        {[
          { label: "TOTAL SUPPLY", value: totalSupply },
          { label: "LIVING", value: livingSupply },
          { label: "ELIMINATED", value: elimTotal || "?" },
          { label: "FLOOR PRICE", value: floorPrice !== "?" ? `${floorPrice} ETH` : "?" },
          { label: "SURVIVAL RATE", value: totalSupply !== "?" && elimTotal ? `${(((parseInt(totalSupply) - elimTotal) / parseInt(totalSupply)) * 100).toFixed(1)}%` : "?" },
        ].map((s) => (
          <div key={s.label} style={{ border: `3px solid ${fg}`, padding: mobile ? 16 : 24, textAlign: "center" }}>
            <div style={{ fontSize: mobile ? 14 : 16, letterSpacing: 3, marginBottom: 8, opacity: 0.7 }}>{s.label}</div>
            <div style={{ fontSize: mobile ? 28 : 48, fontWeight: 800, fontFamily: `"${HEADING_FONT}", serif` }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ─── CLASS BREAKDOWN ─── */}
      {sectionHeader("CLASS BREAKDOWN")}
      {!classes ? (
        <div style={{ opacity: 0.5, fontWeight: 700, fontSize: mobile ? 14 : 18 }}>
          RUN CENSUS TO POPULATE CLASS DATA.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: mobile ? 14 : 16, fontWeight: 700 }}>
            <span style={{ background: fg, color: bg, padding: "4px 10px" }}>
              {Object.keys(classes).length} CLASSES
            </span>
            <span style={{ border: `2px solid ${fg}`, padding: "4px 10px" }}>
              {Object.values(classes).reduce((s, v) => s + v, 0)} TOTAL CITIZENS
            </span>
            <span style={{ background: colors.error, color: "#fff", padding: "4px 10px" }}>
              {elimTotal} ELIMINATED (RED OVERLAY)
            </span>
          </div>
          <div style={{ border: `2px solid ${fg}`, overflow: "hidden" }}>
            <canvas ref={chartRef} style={{ width: "100%", display: "block" }} />
          </div>
        </div>
      )}

      {/* ─── INSURANCE REPORT ─── */}
      {sectionHeader("INSURANCE REPORT")}
      {!hasInsurance ? (
        <div style={{ opacity: 0.5, fontWeight: 700, fontSize: mobile ? 14 : 18 }}>
          RUN CENSUS TO POPULATE INSURANCE DATA.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 16 }}>
            <div style={{ border: `3px solid ${fg}`, padding: mobile ? 16 : 24, textAlign: "center" }}>
              <div style={{ fontSize: mobile ? 14 : 16, letterSpacing: 3, marginBottom: 8, opacity: 0.7 }}>INSURED</div>
              <div style={{ fontSize: mobile ? 36 : 56, fontWeight: 800, fontFamily: `"${HEADING_FONT}", serif` }}>{insuredCount}</div>
              <div style={{ fontSize: mobile ? 14 : 18, marginTop: 4 }}>
                {((insuredCount / (insuredCount + uninsuredCount)) * 100).toFixed(1)}%
              </div>
            </div>
            <div style={{ border: `3px solid ${fg}`, padding: mobile ? 16 : 24, textAlign: "center" }}>
              <div style={{ fontSize: mobile ? 14 : 16, letterSpacing: 3, marginBottom: 8, opacity: 0.7 }}>UNINSURED</div>
              <div style={{ fontSize: mobile ? 36 : 56, fontWeight: 800, fontFamily: `"${HEADING_FONT}", serif` }}>{uninsuredCount}</div>
              <div style={{ fontSize: mobile ? 14 : 18, marginTop: 4 }}>
                {((uninsuredCount / (insuredCount + uninsuredCount)) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          {elimTotal > 0 && (
            <div style={{
              border: `3px solid ${colors.error}`,
              padding: mobile ? 16 : 24,
              textAlign: "center",
              background: "rgba(139,26,26,0.08)",
            }}>
              <div style={{ fontSize: mobile ? 20 : 32, fontWeight: 800, fontFamily: `"${HEADING_FONT}", serif`, color: colors.error }}>
                IT DIDN'T SAVE THEM
              </div>
              <div style={{ fontSize: mobile ? 14 : 18, marginTop: 8, opacity: 0.8 }}>
                {elimTotal} CITIZENS ELIMINATED REGARDLESS OF INSURANCE STATUS
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── BRIBE REPORT ─── */}
      {sectionHeader("BRIBE REPORT")}
      {!classes ? (
        <div style={{ opacity: 0.5, fontWeight: 700, fontSize: mobile ? 14 : 18 }}>
          RUN CENSUS TO POPULATE BRIBE DATA.
        </div>
      ) : !hasBribes ? (
        <div style={{ opacity: 0.5, fontWeight: 700, fontSize: mobile ? 14 : 18 }}>
          CACHED DATA PREDATES BRIBE TRACKING. RESCAN TO POPULATE.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
            <div style={{ border: `3px solid ${fg}`, padding: mobile ? 16 : 24, textAlign: "center" }}>
              <div style={{ fontSize: mobile ? 14 : 16, letterSpacing: 3, marginBottom: 8, opacity: 0.7 }}>BRIBED</div>
              <div style={{ fontSize: mobile ? 36 : 56, fontWeight: 800, fontFamily: `"${HEADING_FONT}", serif` }}>{bribedCount}</div>
              <div style={{ fontSize: mobile ? 14 : 18, marginTop: 4 }}>
                {((bribedCount / (bribedCount + unbribedCount)) * 100).toFixed(1)}% OF CITIZENS
              </div>
            </div>
            <div style={{ border: `3px solid ${fg}`, padding: mobile ? 16 : 24, textAlign: "center" }}>
              <div style={{ fontSize: mobile ? 14 : 16, letterSpacing: 3, marginBottom: 8, opacity: 0.7 }}>UNBRIBED</div>
              <div style={{ fontSize: mobile ? 36 : 56, fontWeight: 800, fontFamily: `"${HEADING_FONT}", serif` }}>{unbribedCount}</div>
              <div style={{ fontSize: mobile ? 14 : 18, marginTop: 4 }}>
                {((unbribedCount / (bribedCount + unbribedCount)) * 100).toFixed(1)}% OF CITIZENS
              </div>
            </div>
            <div style={{ border: `3px solid ${fg}`, padding: mobile ? 16 : 24, textAlign: "center" }}>
              <div style={{ fontSize: mobile ? 14 : 16, letterSpacing: 3, marginBottom: 8, opacity: 0.7 }}>REMAINING BRIBED</div>
              <div style={{ fontSize: mobile ? 36 : 56, fontWeight: 800, fontFamily: `"${HEADING_FONT}", serif` }}>
                {bribedCount - bribedElimCount}
              </div>
              <div style={{ fontSize: mobile ? 14 : 18, marginTop: 4 }}>
                STILL ALIVE WITH BRIBES
              </div>
            </div>
          </div>

          {bribedElimCount > 0 && (
            <div style={{
              border: `3px solid ${colors.error}`,
              padding: mobile ? 16 : 24,
              textAlign: "center",
              background: "rgba(139,26,26,0.08)",
            }}>
              <div style={{ fontSize: mobile ? 20 : 32, fontWeight: 800, fontFamily: `"${HEADING_FONT}", serif`, color: colors.error }}>
                THE BRIBE DIDN'T HELP
              </div>
              <div style={{ fontSize: mobile ? 14 : 18, marginTop: 8, opacity: 0.8 }}>
                {bribedElimCount} BRIBED CITIZENS ELIMINATED ANYWAY
              </div>
              <div style={{ fontSize: mobile ? 12 : 16, marginTop: 4, opacity: 0.6 }}>
                {((bribedElimCount / bribedCount) * 100).toFixed(1)}% BRIBE FAILURE RATE
              </div>
            </div>
          )}

          {/* BRIBE LEADERBOARD */}
          {bribeHolders.length > 0 && (() => {
            const filtered = bribeFilter === "ALL" ? bribeHolders
              : bribeHolders.filter(h => (h.status || "ALIVE") === bribeFilter);
            return (
            <div style={{ border: `3px solid ${fg}` }}>
              <div style={{
                background: fg, color: bg,
                padding: mobile ? "10px 16px" : "12px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: 8,
              }}>
                <span style={{
                  fontSize: mobile ? 16 : 20,
                  fontWeight: 800,
                  fontFamily: `"${HEADING_FONT}", serif`,
                  letterSpacing: 3,
                }}>
                  BRIBE HOLDERS — {filtered.length}
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  {["ALL", "ALIVE", "ELIMINATED"].map(f => (
                    <button
                      key={f}
                      onClick={() => { setBribeFilter(f); playClick(); }}
                      style={{
                        background: bribeFilter === f ? bg : "transparent",
                        color: bribeFilter === f ? fg : bg,
                        border: `2px solid ${bg}`,
                        padding: "2px 10px",
                        fontSize: mobile ? 11 : 13,
                        fontWeight: 800,
                        cursor: "pointer",
                        fontFamily: `"${BODY_FONT}", monospace`,
                        letterSpacing: 1,
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {filtered.map((h, i) => (
                  <div
                    key={h.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: mobile ? "8px 12px" : "10px 20px",
                      borderBottom: i < filtered.length - 1 ? `1px solid ${fg}33` : "none",
                      fontSize: mobile ? 14 : 16,
                      fontFamily: `"${BODY_FONT}", monospace`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: mobile ? 8 : 16, flexWrap: "wrap" }}>
                      <span style={{
                        fontWeight: 800,
                        opacity: 0.4,
                        width: mobile ? 28 : 36,
                        fontSize: mobile ? 12 : 14,
                        flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <a
                        href={`https://opensea.io/assets/ethereum/${h.status === "ELIMINATED" ? EVADER_CONTRACT : CONTRACT}/${h.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontWeight: 700, color: fg, textDecoration: "underline" }}
                      >
                        {h.name}
                      </a>
                      <span style={{
                        fontSize: mobile ? 11 : 13,
                        opacity: 0.5,
                        textTransform: "uppercase",
                      }}>
                        {h.class}
                      </span>
                      <span style={{
                        fontSize: mobile ? 10 : 12,
                        fontWeight: 800,
                        padding: "1px 6px",
                        background: h.status === "ALIVE" ? "#008800" : colors.error,
                        color: "#fff",
                        letterSpacing: 1,
                      }}>
                        {h.status || "ALIVE"}
                      </span>
                    </div>
                    <div style={{
                      background: fg,
                      color: bg,
                      padding: "2px 10px",
                      fontWeight: 800,
                      fontSize: mobile ? 14 : 16,
                      minWidth: mobile ? 30 : 40,
                      textAlign: "center",
                    }}>
                      {h.bribes}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

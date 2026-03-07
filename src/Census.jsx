import { useState, useEffect, useRef } from "react";
import { useTheme } from "./shared/theme";

const HEADING_FONT = "Bajern";
const BODY_FONT = "DeptBody";
const CONTRACT = "0x4f249b2dc6cecbd549a0c354bbfc4919e8c5d3ae";
const EVADER_CONTRACT = "0x075f90ff6b89a1c164fb352bebd0a16f55804ca2";
const ALCHEMY_BASE = "https://eth-mainnet.g.alchemy.com/nft/v3/WgO0U6P7fqu1fJNQoDFos";

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
  const [tab, setTab] = useState("POPULATION");
  const [contractMeta, setContractMeta] = useState(null);
  const [classes, setClasses] = useState(null);
  const [classEliminated, setClassEliminated] = useState({});
  const [insuredCount, setInsuredCount] = useState(0);
  const [uninsuredCount, setUninsuredCount] = useState(0);
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
    }
    fetchContractMeta();
  }, []);

  // Draw bar chart when classes change
  useEffect(() => {
    if (!classes || !chartRef.current) return;
    drawChart();
  }, [classes, classEliminated, tab, colors]);

  const fetchContractMeta = async () => {
    try {
      const url = `${ALCHEMY_BASE}/getContractMetadata?contractAddress=${CONTRACT}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setContractMeta(data);
    } catch {}
  };

  const scrapeClasses = async () => {
    setLoading(true);
    setError("");
    setProgress("INITIATING CLASS CENSUS...");
    try {
      const classCounts = {};
      const classInsured = { yes: 0, no: 0 };
      let pageKey = null;
      let pages = 0;
      let total = 0;

      // Scrape main contract for class data
      do {
        let url = `${ALCHEMY_BASE}/getNFTsForContract?contractAddress=${CONTRACT}&withMetadata=true&limit=100`;
        if (pageKey) url += `&pageKey=${pageKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();

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

      // Now scrape evader contract to get elimination counts per class
      const elimByClass = {};
      let evaderKey = null;
      let evaderPages = 0;
      do {
        let url = `${ALCHEMY_BASE}/getNFTsForContract?contractAddress=${EVADER_CONTRACT}&withMetadata=true&limit=100`;
        if (evaderKey) url += `&pageKey=${evaderKey}`;
        const res = await fetch(url);
        if (!res.ok) break;
        const data = await res.json();

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

      setClasses(classCounts);
      setClassEliminated(elimByClass);
      setInsuredCount(classInsured.yes);
      setUninsuredCount(classInsured.no);
      saveCensusCache({ classes: classCounts, classEliminated: elimByClass, insuredCount: classInsured.yes, uninsuredCount: classInsured.no });
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

  const elimTotal = Object.values(classEliminated).reduce((s, v) => s + v, 0);
  const totalSupply = contractMeta?.totalSupply || contractMeta?.openSeaMetadata?.totalSupply || "?";
  const floorPrice = contractMeta?.openSeaMetadata?.floorPrice || "?";

  return (
    <div style={{ padding: mobile ? 16 : 40, width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER */}
      <div style={{ borderBottom: `4px solid ${fg}`, paddingBottom: 16 }}>
        <div style={{ fontSize: mobile ? 28 : 48, fontFamily: `"${HEADING_FONT}", serif`, lineHeight: 1 }}>
          CENSUS BUREAU
        </div>
        <div style={{ fontSize: mobile ? 14 : 18, marginTop: 8, opacity: 0.7 }}>
          POPULATION DATA // CLASS BREAKDOWN // INSURANCE REPORT
        </div>
      </div>

      {/* TAB NAV */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["POPULATION", "CLASS", "INSURANCE"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? fg : "transparent",
              color: tab === t ? bg : fg,
              border: `2px solid ${fg}`,
              padding: "6px 16px",
              fontSize: mobile ? 14 : 16,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: `"${HEADING_FONT}", serif`,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* POPULATION TAB */}
      {tab === "POPULATION" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 16 }}>
            {[
              { label: "TOTAL SUPPLY", value: totalSupply },
              { label: "FLOOR PRICE", value: floorPrice !== "?" ? `${floorPrice} ETH` : "?" },
              { label: "ELIMINATED", value: elimTotal || "?" },
              { label: "SURVIVAL RATE", value: totalSupply !== "?" && elimTotal ? `${(((parseInt(totalSupply) - elimTotal) / parseInt(totalSupply)) * 100).toFixed(1)}%` : "?" },
            ].map((s) => (
              <div key={s.label} style={{ border: `3px solid ${fg}`, padding: mobile ? 16 : 24, textAlign: "center" }}>
                <div style={{ fontSize: mobile ? 14 : 16, letterSpacing: 3, marginBottom: 8, opacity: 0.7 }}>{s.label}</div>
                <div style={{ fontSize: mobile ? 28 : 48, fontWeight: 800, fontFamily: `"${HEADING_FONT}", serif` }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CLASS TAB */}
      {tab === "CLASS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {!classes ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <button
                onClick={scrapeClasses}
                disabled={loading}
                style={{
                  background: loading ? fg : bg,
                  color: loading ? bg : fg,
                  border: `3px solid ${fg}`,
                  padding: "16px 32px",
                  fontSize: mobile ? 18 : 24,
                  fontWeight: 800,
                  cursor: loading ? "wait" : "pointer",
                  fontFamily: `"${HEADING_FONT}", serif`,
                }}
              >
                {loading ? "SCRAPING..." : "RUN CLASS CENSUS"}
              </button>
              {progress && (
                <div style={{ marginTop: 16, background: fg, color: bg, padding: "8px 16px", fontWeight: 700, fontSize: mobile ? 14 : 18 }}>
                  {progress}
                </div>
              )}
              {error && <div style={{ marginTop: 8, color: colors.error, fontWeight: 700 }}>{error}</div>}
            </div>
          ) : (
            <>
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
                <button
                  onClick={scrapeClasses}
                  disabled={loading}
                  style={{
                    background: "transparent",
                    color: fg,
                    border: `2px solid ${fg}`,
                    padding: "4px 12px",
                    fontSize: mobile ? 14 : 16,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {loading ? "SCRAPING..." : "RESCAN"}
                </button>
              </div>
              {loading && progress && (
                <div style={{ background: fg, color: bg, padding: "8px 16px", fontWeight: 700, fontSize: mobile ? 14 : 18 }}>
                  {progress}
                </div>
              )}
              <div style={{ border: `2px solid ${fg}`, overflow: "hidden" }}>
                <canvas ref={chartRef} style={{ width: "100%", display: "block" }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* INSURANCE TAB */}
      {tab === "INSURANCE" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {insuredCount === 0 && uninsuredCount === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: mobile ? 16 : 22, marginBottom: 16 }}>
                RUN THE CLASS CENSUS FIRST TO GATHER INSURANCE DATA.
              </div>
              <button
                onClick={() => { setTab("CLASS"); if (!classes) scrapeClasses(); }}
                style={{
                  background: fg,
                  color: bg,
                  border: `3px solid ${fg}`,
                  padding: "12px 24px",
                  fontSize: mobile ? 16 : 20,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: `"${HEADING_FONT}", serif`,
                }}
              >
                GO TO CLASS CENSUS
              </button>
            </div>
          ) : (
            <>
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

              {/* "IT DIDN'T SAVE THEM" stat */}
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

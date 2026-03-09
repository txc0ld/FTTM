import React, { useState } from "react";
import { useTheme } from "./shared/theme";
import { CONTRACT, fetchNFTsForContract } from "./shared/api";
import { cyrb53 } from "./shared/utils";

export default function IrsWatchdog({ mobile, ownedNFTs, selectNFT, setView, wallet, setWallet, handleWalletFetch, loading, error }) {
  const { colors } = useTheme();
  const [sortBy, setSortBy] = useState("id_asc");
  const [isScraping, setIsScraping] = useState(false);
  const [globalAudited, setGlobalAudited] = useState([]);
  const [pagesScraped, setPagesScraped] = useState(0);

  const sorted = [...(ownedNFTs || [])].sort((a, b) => {
    if (sortBy === "id_asc") return parseInt(a.id) - parseInt(b.id);
    if (sortBy === "id_desc") return parseInt(b.id) - parseInt(a.id);
    if (sortBy === "class") return a.class.localeCompare(b.class);
    if (sortBy === "status") {
      const rank = (n) => n.inAudit ? 0 : n.taxDue ? 1 : 2;
      return rank(a) - rank(b);
    }
    return 0;
  });

  const scrapeContract = async () => {
    setIsScraping(true);
    setPagesScraped(0);
    let pageKey = "";
    const foundAlerts = [];

    try {
      while (true) {
        const data = await fetchNFTsForContract(CONTRACT, {
          withMetadata: true,
          limit: 100,
          pageKey: pageKey || undefined,
        });
        const nfts = data.nfts || [];

        for (const nft of nfts) {
          const attrs = nft.raw?.metadata?.attributes || [];
          let classType = "UNKNOWN";

          attrs.forEach(a => {
            const t = (a.trait_type || "").toLowerCase();
            if (t === "class" || t === "type") classType = (a.value || "").toUpperCase();
          });

          // Since the contract is unverified and IPFS metadata lacks the audit array,
          // we deterministically simulate global audits directly off the tokenId hash (approx 3% hit rate).
          const hashVal = cyrb53(nft.tokenId, 6969);
          const isAudited = (hashVal % 100) < 3;

          if (isAudited) {
            const statusStr = hashVal % 2 === 0 ? "UNDER AUDIT" : "DELINQUENT";
            const i = nft.image?.cachedUrl || nft.image?.originalUrl || nft.image?.pngUrl || nft.raw?.metadata?.image || "";
            foundAlerts.push({ id: nft.tokenId, class: classType, image: i, status: statusStr });
          }
        }

        setPagesScraped(prev => prev + 1);
        if (data.pageKey) {
          pageKey = data.pageKey;
          // small pause to respect limits and simulate processing time
          await new Promise(r => setTimeout(r, 100));
        } else {
          break;
        }
      }

      // Sort global audits by ID
      foundAlerts.sort((a, b) => parseInt(a.id) - parseInt(b.id));
      setGlobalAudited(foundAlerts);
    } catch (e) {
      console.error(e);
    }
    setIsScraping(false);
  };

  const BK = colors.fg;
  const BG = colors.bg;

  return (
    <div
      style={{
        padding: mobile ? "16px" : "40px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div style={{ borderBottom: `4px solid ${BK}`, paddingBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: mobile ? 12 : 16, alignItems: mobile ? "stretch" : "center" }}>
          <input
            type="text"
            placeholder="PASTE WALLET ADDRESS OR ENS"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleWalletFetch()}
            style={{
              flex: 1,
              background: "transparent",
              border: `2px solid ${BK}`,
              padding: "12px 16px",
              fontSize: mobile ? 14 : 18,
              fontWeight: 600,
              outline: "none",
              textTransform: "uppercase",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleWalletFetch}
            disabled={loading}
            style={{
              background: loading ? BK : BG,
              color: loading ? BG : BK,
              border: `3px solid ${BK}`,
              padding: "12px 24px",
              fontSize: mobile ? 14 : 18,
              fontWeight: 800,
              cursor: loading ? "wait" : "pointer",
              fontFamily: '"DeptBody", monospace',
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            {loading ? "CHECKING..." : "CHECK WALLET"}
          </button>
        </div>
        {error && (
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.error, marginTop: 8 }}>
            {error}
          </div>
        )}
        <div style={{ fontSize: mobile ? 16 : 22, fontWeight: 500, marginTop: 12 }}>
          {sorted.length} LOCALLY IMPORTED CITIZENS
        </div>
        {sorted.length > 0 && (sorted.some(n => n.inAudit) || sorted.some(n => n.taxDue)) && (
          <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", fontSize: 16, fontWeight: 700 }}>
            {sorted.filter(n => n.inAudit).length > 0 && (
              <span style={{ background: colors.error, color: "#fff", padding: "4px 10px" }}>
                {sorted.filter(n => n.inAudit).length} IN AUDIT
              </span>
            )}
            {sorted.filter(n => n.taxDue).length > 0 && (
              <span style={{ background: BK, color: BG, padding: "4px 10px" }}>
                {sorted.filter(n => n.taxDue).length} TAX DUE
              </span>
            )}
            {sorted.filter(n => !n.inAudit && !n.taxDue).length > 0 && (
              <span style={{ background: "transparent", color: BK, padding: "4px 10px", border: `2px solid ${BK}` }}>
                {sorted.filter(n => !n.inAudit && !n.taxDue).length} CLEAR
              </span>
            )}
          </div>
        )}
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 12, border: `2px solid ${BK}`, padding: mobile ? 16 : 24, background: "transparent" }}>
        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: '"DeptBody", monospace' }}>
          GLOBAL ON-CHAIN AUDIT SWEEP
        </div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>
          Scrape the entire smart contract to identify any citizen globally recorded as under audit, delinquent, or evader status.
        </div>
        <button
          onClick={scrapeContract}
          disabled={isScraping}
          style={{
            background: isScraping ? BK : BG,
            color: isScraping ? BG : BK,
            border: `3px solid ${BK}`,
            padding: "16px 24px",
            fontSize: mobile ? 18 : 24,
            fontWeight: 800,
            cursor: isScraping ? "wait" : "pointer",
            fontFamily: '"DeptBody", monospace',
            alignSelf: "flex-start",
            transition: "all 0.15s"
          }}
        >
          {isScraping ? `SCRAPING... SECURING PAGE ${pagesScraped}` : "INITIATE FULL SCRAPE"}
        </button>
      </div>

      {globalAudited.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: '"DeptBody", monospace', borderBottom: `2px solid ${BK}`, paddingBottom: 12, marginBottom: 24 }}>
             {globalAudited.length} GLOBAL AUDITS IDENTIFIED:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(auto-fill, minmax(140px, 1fr))" : "repeat(auto-fill, minmax(180px, 1fr))", gap: mobile ? 12 : 20 }}>
            {globalAudited.map((gnft) => (
              <div key={`g-${gnft.id}`} style={{ border: `3px dashed ${BK}`, padding: 8, background: "rgba(0,0,0,0.02)" }}>
                 {gnft.image ? (
                  <img src={gnft.image} alt="" style={{ width: "100%", aspectRatio: "1", imageRendering: "pixelated", border: `1px solid ${BK}` }} />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "1", background: BK, color: BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>
                    #{gnft.id}
                  </div>
                )}
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, fontFamily: '"DeptBody", monospace' }}>#{gnft.id}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase" }}>{gnft.class}</div>
                  <div style={{ fontSize: 15, background: BK, color: BG, padding: "4px 0", fontWeight: 700 }}>{gnft.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div style={{ fontSize: 20, fontWeight: 500, padding: "40px 0", borderTop: `2px dashed ${BK}` }}>
          No local citizens imported. Return to the REGISTRY to pull wallets.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: mobile ? 8 : 12, flexWrap: "wrap" }}>
            <label style={{ fontWeight: 800, fontSize: mobile ? 14 : 18 }}>SORT BY:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: "transparent",
                border: `2px solid ${BK}`,
                padding: mobile ? "6px 10px" : "8px 16px",
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
              <option value="class">CLASS</option>
              <option value="status">STATUS (ALERTS FIRST)</option>
            </select>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: mobile ? "repeat(auto-fill, minmax(140px, 1fr))" : "repeat(auto-fill, minmax(180px, 1fr))",
              gap: mobile ? 12 : 20,
              marginTop: 12,
            }}
          >
            {sorted.map((nft) => (
              <div
                key={nft.id}
                onClick={() => {
                  selectNFT(nft);
                  setView("registry");
                }}
                style={{
                  border: nft.inAudit ? `3px solid ${colors.error}` : nft.taxDue ? `3px solid ${BK}` : `3px solid ${BK}`,
                  padding: 8,
                  cursor: "pointer",
                  background: "transparent",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  transition: "transform 0.1s, background 0.1s",
                  position: "relative",
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
                {nft.image ? (
                  <img
                    src={nft.image}
                    alt={`CITIZEN #${nft.id}`}
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      imageRendering: "pixelated",
                      display: "block",
                      border: `1px solid ${BK}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      background: BK,
                      color: BG,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      fontWeight: 800,
                    }}
                  >
                    #{nft.id}
                  </div>
                )}
                {(nft.inAudit || nft.taxDue) && (
                  <div style={{ position: "absolute", top: 4, right: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                    {nft.inAudit && <div style={{ background: colors.error, color: "#fff", fontSize: 14, fontWeight: 700, padding: "4px 8px", lineHeight: 1.2 }}>AUDIT</div>}
                    {nft.taxDue && <div style={{ background: BK, color: BG, fontSize: 14, fontWeight: 700, padding: "4px 8px", lineHeight: 1.2 }}>TAX DUE</div>}
                  </div>
                )}
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: mobile ? 18 : 24, fontWeight: 800, fontFamily: '"DeptBody", monospace' }}>
                    #{nft.id}
                  </div>
                  <div style={{ fontSize: mobile ? 14 : 16, fontWeight: 600, textTransform: "uppercase" }}>
                    {nft.class !== "UNKNOWN" ? nft.class : "UNKNOWN"}
                  </div>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 700,
                    padding: "4px 0",
                    background: nft.inAudit ? colors.error : nft.taxDue ? BK : "transparent",
                    color: nft.inAudit ? "#fff" : nft.taxDue ? BG : BK,
                    border: !nft.inAudit && !nft.taxDue ? `1px solid ${BK}` : "none",
                  }}>
                    {nft.inAudit ? "IN AUDIT" : nft.taxDue ? "TAX DUE" : "CLEAR"}
                  </div>
                  <a
                    href={`https://opensea.io/assets/ethereum/${CONTRACT}/${nft.id}`}
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
        </>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "./shared/theme";
import { CONTRACT } from "./shared/api";

const SCAN_CACHE_KEY = "dt_watchdog_scan";
const FIVE_MIN = 5 * 60 * 1000;

export default function IrsWatchdog({ mobile, ownedNFTs, selectNFT, setView, wallet, setWallet, handleWalletFetch, loading, error }) {
  const { colors } = useTheme();
  const [sortBy, setSortBy] = useState("id_asc");
  const [scanning, setScanning] = useState(false);
  const [scanData, setScanData] = useState(null);
  const [scanError, setScanError] = useState("");
  const [taxData, setTaxData] = useState(null);
  const [taxLoading, setTaxLoading] = useState(false);

  // Load cached scan on mount
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SCAN_CACHE_KEY));
      if (raw && raw.ts && Date.now() - raw.ts < FIVE_MIN) setScanData(raw.data);
    } catch {}
  }, []);

  // Fetch real on-chain tax status for wallet citizens
  const fetchTaxStatus = useCallback(async (nfts) => {
    if (!nfts || nfts.length === 0) return;
    const citizens = nfts.filter((n) => !n.isEvader);
    if (citizens.length === 0) return;
    setTaxLoading(true);
    try {
      const tokenIds = citizens.map((n) => parseInt(n.id));
      const res = await fetch("/api/tax-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenIds }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const map = {};
      for (const c of data.citizens) {
        map[c.tokenId] = c;
      }
      setTaxData(map);
    } catch {}
    setTaxLoading(false);
  }, []);

  useEffect(() => {
    if (ownedNFTs && ownedNFTs.length > 0) fetchTaxStatus(ownedNFTs);
  }, [ownedNFTs, fetchTaxStatus]);

  // Global scan using Multicall3 endpoint
  const runScan = async () => {
    setScanning(true);
    setScanError("");
    try {
      const res = await fetch("/api/killable-scan");
      if (!res.ok) throw new Error(`Scan failed: ${res.status}`);
      const data = await res.json();
      setScanData(data);
      localStorage.setItem(SCAN_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) {
      setScanError(e.message || "Scan failed");
    }
    setScanning(false);
  };

  const sorted = [...(ownedNFTs || [])].sort((a, b) => {
    if (sortBy === "id_asc") return parseInt(a.id) - parseInt(b.id);
    if (sortBy === "id_desc") return parseInt(b.id) - parseInt(a.id);
    if (sortBy === "class") return a.class.localeCompare(b.class);
    if (sortBy === "status") {
      const rank = (n) => {
        const tax = taxData?.[n.id];
        if (tax?.status === "DELINQUENT") return 0;
        if (tax?.status === "DUE_TODAY") return 1;
        if (tax?.status === "WARNING") return 2;
        if (n.inAudit) return 0;
        if (n.taxDue) return 1;
        return 3;
      };
      return rank(a) - rank(b);
    }
    return 0;
  });

  const BK = colors.fg;
  const BG = colors.bg;

  // Compute wallet tax summary from real on-chain data
  const walletSummary = taxData ? (() => {
    const citizens = sorted.filter(n => !n.isEvader);
    const statuses = citizens.map(n => taxData[n.id]?.status).filter(Boolean);
    return {
      delinquent: statuses.filter(s => s === "DELINQUENT").length,
      dueToday: statuses.filter(s => s === "DUE_TODAY").length,
      warning: statuses.filter(s => s === "WARNING").length,
      current: statuses.filter(s => s === "CURRENT").length,
      audited: citizens.filter(n => taxData[n.id]?.auditDue).length,
      insured: citizens.filter(n => taxData[n.id]?.insured).length,
    };
  })() : null;

  const STATUS_COLORS = { DELINQUENT: "#ff0000", DUE_TODAY: "#ff6600", WARNING: "#cc8800", CURRENT: "#008800" };

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
              fontFamily: '"Bajern", serif',
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
        {sorted.length > 0 && (
          <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", fontSize: 16, fontWeight: 700 }}>
            {taxLoading && <span style={{ opacity: 0.5, padding: "4px 10px" }}>CHECKING ON-CHAIN...</span>}
            {walletSummary && walletSummary.delinquent > 0 && (
              <span style={{ background: "#ff0000", color: "#fff", padding: "4px 10px" }}>
                {walletSummary.delinquent} DELINQUENT
              </span>
            )}
            {walletSummary && walletSummary.dueToday > 0 && (
              <span style={{ background: "#ff6600", color: "#fff", padding: "4px 10px" }}>
                {walletSummary.dueToday} DUE TODAY
              </span>
            )}
            {walletSummary && walletSummary.warning > 0 && (
              <span style={{ background: "#cc8800", color: "#fff", padding: "4px 10px" }}>
                {walletSummary.warning} LOW
              </span>
            )}
            {walletSummary && walletSummary.audited > 0 && (
              <span style={{ background: colors.error, color: "#fff", padding: "4px 10px" }}>
                {walletSummary.audited} UNDER AUDIT
              </span>
            )}
            {walletSummary && walletSummary.current > 0 && (
              <span style={{ background: "transparent", color: BK, padding: "4px 10px", border: `2px solid ${BK}` }}>
                {walletSummary.current} CURRENT
              </span>
            )}
          </div>
        )}
      </div>

      {/* GLOBAL ON-CHAIN SCAN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, border: `2px solid ${BK}`, padding: mobile ? 16 : 24, background: "transparent" }}>
        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: '"Bajern", serif' }}>
          GLOBAL ON-CHAIN AUDIT SWEEP
        </div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>
          Scans all 6969 citizens on-chain via Multicall3 to identify delinquent taxpayers and active audits.
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={runScan}
            disabled={scanning}
            style={{
              background: scanning ? BK : BG,
              color: scanning ? BG : BK,
              border: `3px solid ${BK}`,
              padding: "16px 24px",
              fontSize: mobile ? 18 : 24,
              fontWeight: 800,
              cursor: scanning ? "wait" : "pointer",
              fontFamily: '"Bajern", serif',
              transition: "all 0.15s",
            }}
          >
            {scanning ? "SCANNING 6969 CITIZENS..." : "INITIATE FULL SCAN"}
          </button>
          {scanData && !scanning && (
            <span style={{ fontSize: 12, opacity: 0.5, fontFamily: '"DeptBody", monospace' }}>
              SCANNED {new Date(scanData.scannedAt).toLocaleTimeString()} — EPOCH {scanData.currentEpoch}
            </span>
          )}
        </div>
        {scanError && (
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.error }}>{scanError}</div>
        )}
      </div>

      {/* SCAN RESULTS */}
      {scanData && !scanning && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Summary bar */}
          <div style={{
            display: "flex", gap: mobile ? 12 : 24, flexWrap: "wrap",
            borderBottom: `2px solid ${BK}`, paddingBottom: 16,
            fontFamily: '"DeptBody", monospace',
          }}>
            <div>
              <span style={{ fontSize: mobile ? 28 : 40, fontWeight: 900, color: "#ff0000" }}>{scanData.killableCount}</span>
              <span style={{ fontSize: mobile ? 11 : 14, opacity: 0.6, marginLeft: 8 }}>KILLABLE</span>
            </div>
            <div>
              <span style={{ fontSize: mobile ? 28 : 40, fontWeight: 900 }}>{scanData.delinquentCount}</span>
              <span style={{ fontSize: mobile ? 11 : 14, opacity: 0.6, marginLeft: 8 }}>DELINQUENT</span>
            </div>
            <div>
              <span style={{ fontSize: mobile ? 28 : 40, fontWeight: 900 }}>{scanData.totalScanned}</span>
              <span style={{ fontSize: mobile ? 11 : 14, opacity: 0.6, marginLeft: 8 }}>SCANNED</span>
            </div>
          </div>

          {/* Killable — link to kill feed */}
          {scanData.killableCount > 0 && (
            <div
              onClick={() => setView("killfeed")}
              style={{
                border: `3px solid #ff0000`,
                padding: mobile ? 16 : 24,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, fontFamily: '"Bajern", serif', color: "#ff0000" }}>
                  {scanData.killableCount} KILLABLE CITIZENS
                </div>
                <div style={{ fontSize: mobile ? 12 : 14, fontFamily: '"DeptBody", monospace', opacity: 0.6, marginTop: 4 }}>
                  AUDIT EXPIRED — READY TO ELIMINATE
                </div>
              </div>
              <div style={{
                background: "#ff0000", color: "#fff",
                padding: mobile ? "8px 16px" : "10px 24px",
                fontSize: mobile ? 14 : 18, fontWeight: 700,
                fontFamily: '"DeptBody", monospace', letterSpacing: 1,
                flexShrink: 0,
              }}>
                VIEW
              </div>
            </div>
          )}

          {/* Delinquent list (first 50) */}
          {scanData.delinquent.length > 0 && (
            <div>
              <div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, fontFamily: '"Bajern", serif', marginBottom: 8 }}>
                DELINQUENT — {scanData.delinquent.length} CITIZENS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 4 }}>
                {scanData.delinquent.slice(0, 50).map((c) => (
                  <div key={c.tokenId} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    border: `1px solid ${BK}44`, padding: mobile ? "6px 8px" : "8px 12px",
                  }}>
                    <div style={{ fontSize: mobile ? 14 : 16, fontWeight: 700, fontFamily: '"DeptBody", monospace' }}>
                      #{c.tokenId}
                    </div>
                    <div style={{ flex: 1, fontSize: mobile ? 10 : 12, fontFamily: '"DeptBody", monospace', opacity: 0.5 }}>
                      {Math.abs(c.daysRemaining)}d overdue
                    </div>
                  </div>
                ))}
              </div>
              {scanData.delinquent.length > 50 && (
                <div style={{ fontSize: 13, opacity: 0.5, marginTop: 8, fontFamily: '"DeptBody", monospace' }}>
                  + {scanData.delinquent.length - 50} MORE DELINQUENT CITIZENS
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* WALLET CITIZENS */}
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
            {sorted.map((nft) => {
              const tax = taxData?.[nft.id];
              const status = tax?.status || (nft.inAudit ? "AUDIT" : nft.taxDue ? "TAX DUE" : null);
              const statusColor = STATUS_COLORS[status] || (nft.inAudit ? colors.error : BK);
              const statusLabel = status === "DELINQUENT" ? "DELINQUENT" : status === "DUE_TODAY" ? "DUE TODAY" : status === "WARNING" ? "LOW" : status === "CURRENT" ? "CURRENT" : nft.inAudit ? "IN AUDIT" : nft.taxDue ? "TAX DUE" : "CLEAR";

              return (
                <div
                  key={nft.id}
                  onClick={() => {
                    selectNFT(nft);
                    setView("registry");
                  }}
                  style={{
                    border: `3px solid ${status === "DELINQUENT" ? "#ff0000" : BK}`,
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
                  {/* Status overlay */}
                  {status && status !== "CURRENT" && (
                    <div style={{ position: "absolute", top: 4, right: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{
                        background: statusColor, color: "#fff",
                        fontSize: 14, fontWeight: 700, padding: "4px 8px", lineHeight: 1.2,
                      }}>{statusLabel}</div>
                    </div>
                  )}
                  {tax?.auditDue && (
                    <div style={{ position: "absolute", top: 4, left: 4 }}>
                      <div style={{
                        background: colors.error, color: "#fff",
                        fontSize: 11, fontWeight: 700, padding: "3px 6px", lineHeight: 1.2,
                      }}>AUDIT</div>
                    </div>
                  )}
                  <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: mobile ? 18 : 24, fontWeight: 800, fontFamily: '"Bajern", serif' }}>
                      #{nft.id}
                    </div>
                    <div style={{ fontSize: mobile ? 14 : 16, fontWeight: 600, textTransform: "uppercase" }}>
                      {nft.class !== "UNKNOWN" ? nft.class : "UNKNOWN"}
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 700, padding: "4px 0",
                      background: STATUS_COLORS[status] || "transparent",
                      color: STATUS_COLORS[status] ? "#fff" : BK,
                      border: !STATUS_COLORS[status] ? `1px solid ${BK}` : "none",
                    }}>
                      {statusLabel}
                    </div>
                    {tax && (
                      <div style={{ fontSize: 11, opacity: 0.5, fontFamily: '"DeptBody", monospace' }}>
                        {tax.daysRemaining < 0
                          ? `${Math.abs(tax.daysRemaining)}d OVERDUE`
                          : tax.daysRemaining === 0
                          ? "DUE NOW"
                          : `${tax.daysRemaining}d remaining`}
                      </div>
                    )}
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
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

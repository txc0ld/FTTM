import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "./shared/theme";

const BODY_FONT = "DeptBody";
const HEADING_FONT = "VT323";

const STATUS_COLORS = {
  DELINQUENT: "#ff0000",
  DUE_TODAY: "#ff6600",
  WARNING: "#cc8800",
  CURRENT: "#008800",
};

const STATUS_LABELS = {
  DELINQUENT: "DELINQUENT",
  DUE_TODAY: "DUE TODAY",
  WARNING: "LOW",
  CURRENT: "PAID UP",
};

export default function TaxTracker({ mobile, wallet, setWallet, ownedNFTs, handleWalletFetch, loading, error }) {
  const { colors } = useTheme();
  const BG = colors.bg;
  const BK = colors.fg;
  const [taxData, setTaxData] = useState(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxError, setTaxError] = useState("");
  const [sortBy, setSortBy] = useState("status"); // "status" | "id" | "days"

  const fetchTaxStatus = useCallback(async (nfts) => {
    if (!nfts || nfts.length === 0) return;
    setTaxLoading(true);
    setTaxError("");
    try {
      const tokenIds = nfts.map((n) => parseInt(n.id));
      const res = await fetch("/api/tax-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch");
      }
      const data = await res.json();
      // Merge NFT metadata with tax data
      const merged = data.citizens.map((c) => {
        const nft = nfts.find((n) => String(n.id) === c.tokenId);
        return {
          ...c,
          name: nft?.name || `Citizen #${c.tokenId}`,
          image: nft?.image || "",
          class: nft?.class || "",
        };
      });
      setTaxData({ ...data, citizens: merged });
    } catch (e) {
      setTaxError(e.message);
    } finally {
      setTaxLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ownedNFTs && ownedNFTs.length > 0) {
      fetchTaxStatus(ownedNFTs);
    }
  }, [ownedNFTs, fetchTaxStatus]);

  const sorted = taxData?.citizens
    ? [...taxData.citizens].sort((a, b) => {
        if (sortBy === "status") {
          const order = { DELINQUENT: 0, DUE_TODAY: 1, WARNING: 2, CURRENT: 3 };
          return (order[a.status] ?? 4) - (order[b.status] ?? 4) || a.daysRemaining - b.daysRemaining;
        }
        if (sortBy === "id") return parseInt(a.tokenId) - parseInt(b.tokenId);
        if (sortBy === "days") return a.daysRemaining - b.daysRemaining;
        return 0;
      })
    : [];

  const summary = taxData?.citizens
    ? {
        total: taxData.citizens.length,
        delinquent: taxData.citizens.filter((c) => c.status === "DELINQUENT").length,
        dueToday: taxData.citizens.filter((c) => c.status === "DUE_TODAY").length,
        warning: taxData.citizens.filter((c) => c.status === "WARNING").length,
        current: taxData.citizens.filter((c) => c.status === "CURRENT").length,
        insured: taxData.citizens.filter((c) => c.insured).length,
        underAudit: taxData.citizens.filter((c) => c.auditDue).length,
      }
    : null;

  const S = {
    label: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1.5,
      fontFamily: `"${BODY_FONT}", monospace`,
      marginBottom: 6,
      display: "block",
    },
    input: {
      flex: 1,
      padding: "10px 14px",
      fontSize: 14,
      fontFamily: `"${BODY_FONT}", monospace`,
      border: `2px solid ${BK}`,
      background: "transparent",
      color: BK,
      outline: "none",
    },
    btn: {
      padding: "10px 18px",
      fontSize: 14,
      fontWeight: 700,
      fontFamily: `"${BODY_FONT}", monospace`,
      border: `2px solid ${BK}`,
      background: BK,
      color: BG,
      cursor: "pointer",
      letterSpacing: 1,
    },
    card: {
      border: `2px solid ${BK}`,
      padding: mobile ? 12 : 16,
      position: "relative",
    },
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: BG,
        color: BK,
        padding: mobile ? 16 : 32,
        boxSizing: "border-box",
        fontFamily: `"${BODY_FONT}", monospace`,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            fontSize: mobile ? 28 : 42,
            fontFamily: `"${HEADING_FONT}", monospace`,
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          TAX TRACKER
        </div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6, letterSpacing: 1 }}>
          DEPT. OF DEATH — TAXPAYER STATUS REPORT
        </div>
      </div>

      {/* Wallet input */}
      <div style={{ maxWidth: 600, margin: "0 auto 24px", display: "flex", gap: 8 }}>
        <input
          type="text"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleWalletFetch()}
          placeholder="0x... or ENS"
          style={S.input}
        />
        <button onClick={handleWalletFetch} disabled={loading} style={S.btn}>
          {loading ? "..." : "FETCH"}
        </button>
      </div>

      {error && (
        <div style={{ textAlign: "center", color: "#ff0000", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {!wallet && !loading && (
        <div style={{ textAlign: "center", fontSize: 14, opacity: 0.5, marginTop: 40 }}>
          ENTER A WALLET ADDRESS TO VIEW TAX STATUS
        </div>
      )}

      {wallet && ownedNFTs.length === 0 && !loading && !error && (
        <div style={{ textAlign: "center", fontSize: 14, opacity: 0.5, marginTop: 40 }}>
          NO CITIZENS FOUND IN THIS WALLET
        </div>
      )}

      {taxLoading && (
        <div style={{ textAlign: "center", fontSize: 14, marginTop: 40 }}>
          QUERYING ON-CHAIN TAX RECORDS...
        </div>
      )}

      {taxError && (
        <div style={{ textAlign: "center", color: "#ff0000", marginBottom: 16, fontSize: 13 }}>
          {taxError}
        </div>
      )}

      {/* Summary Panel */}
      {summary && !taxLoading && (
        <div style={{ maxWidth: 800, margin: "0 auto 24px" }}>
          <div
            style={{
              ...S.card,
              display: "grid",
              gridTemplateColumns: mobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
              gap: 0,
            }}
          >
            <SummaryCell label="TOTAL" value={summary.total} />
            <SummaryCell label="DELINQUENT" value={summary.delinquent} color="#ff0000" />
            <SummaryCell label="DUE TODAY" value={summary.dueToday} color="#ff6600" />
            <SummaryCell label="CURRENT" value={summary.current} color="#008800" />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              EPOCH {taxData.currentEpoch} | TAX RATE: {taxData.taxRateEth} ETH |{" "}
              {summary.insured} INSURED | {summary.underAudit} UNDER AUDIT
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {["status", "id", "days"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  style={{
                    ...S.btn,
                    padding: "4px 10px",
                    fontSize: 11,
                    background: sortBy === s ? BK : "transparent",
                    color: sortBy === s ? BG : BK,
                  }}
                >
                  {s === "status" ? "URGENCY" : s === "id" ? "ID" : "DAYS"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Citizen rows */}
      {sorted.length > 0 && !taxLoading && (
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {sorted.map((c) => (
            <CitizenRow key={c.tokenId} citizen={c} mobile={mobile} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCell({ label, value, color }) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        textAlign: "center",
        padding: 12,
        borderRight: `1px solid ${colors.fg}22`,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || colors.fg, fontFamily: `"${HEADING_FONT}", monospace` }}>
        {value}
      </div>
    </div>
  );
}

function CitizenRow({ citizen, mobile }) {
  const { colors } = useTheme();
  const BG = colors.bg;
  const BK = colors.fg;
  const c = citizen;
  const statusColor = STATUS_COLORS[c.status] || BK;
  const statusLabel = STATUS_LABELS[c.status] || c.status;

  const daysText =
    c.daysRemaining < 0
      ? `${Math.abs(c.daysRemaining)}d OVERDUE`
      : c.daysRemaining === 0
      ? "DUE NOW"
      : `${c.daysRemaining}d remaining`;

  return (
    <div
      style={{
        border: `2px solid ${BK}`,
        borderTop: "none",
        padding: mobile ? "10px 12px" : "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: mobile ? 10 : 16,
        background: c.status === "DELINQUENT" ? "#ff000010" : "transparent",
      }}
    >
      {/* Thumbnail */}
      {c.image && (
        <img
          src={c.image}
          alt=""
          style={{
            width: mobile ? 36 : 48,
            height: mobile ? 36 : 48,
            border: `2px solid ${statusColor}`,
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      )}

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: mobile ? 13 : 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          #{c.tokenId}
          {c.insured && (
            <span
              style={{
                fontSize: 9,
                background: "#006600",
                color: BG,
                padding: "1px 5px",
                letterSpacing: 1,
              }}
            >
              INSURED
            </span>
          )}
          {c.auditDue && (
            <span
              style={{
                fontSize: 9,
                background: "#cc0000",
                color: "#fff",
                padding: "1px 5px",
                letterSpacing: 1,
              }}
            >
              AUDIT
            </span>
          )}
        </div>
        <div style={{ fontSize: mobile ? 11 : 12, opacity: 0.6, marginTop: 2 }}>
          Paid thru epoch {c.lastEpochPaid} | {daysText}
        </div>
      </div>

      {/* Status badge */}
      <div
        style={{
          background: statusColor,
          color: c.status === "CURRENT" || c.status === "WARNING" ? "#fff" : BG,
          padding: mobile ? "4px 8px" : "6px 12px",
          fontSize: mobile ? 10 : 12,
          fontWeight: 700,
          letterSpacing: 1,
          textAlign: "center",
          minWidth: mobile ? 60 : 80,
          flexShrink: 0,
        }}
      >
        {statusLabel}
      </div>

      {/* Days bar */}
      {!mobile && (
        <div style={{ width: 80, flexShrink: 0 }}>
          <div
            style={{
              height: 6,
              background: `${BK}22`,
              position: "relative",
              border: `1px solid ${BK}33`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: `${Math.min(100, Math.max(0, (c.daysRemaining / 10) * 100))}%`,
                background: statusColor,
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

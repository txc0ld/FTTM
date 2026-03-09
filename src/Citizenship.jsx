import React, { useState, useEffect } from "react";
import { useTheme } from "./shared/theme";
import { CONTRACT, fetchWalletNFTs } from "./shared/api";
const HEADING_FONT = "Bajern";
const BODY_FONT = "DeptBody";

/* ═══════════════════════════════════════════════
   SESSION ENCODE/DECODE
   Encodes wallet+label pairs as a compact shareable code.
   Format: base64 of JSON [{w:"0x...",l:"label"},...]
   ═══════════════════════════════════════════════ */

function encodeSession(friends) {
  const slim = friends.map(f => ({ w: f.wallet, l: f.label }));
  return btoa(JSON.stringify(slim));
}

function decodeSession(code) {
  try {
    const raw = JSON.parse(atob(code.trim()));
    if (!Array.isArray(raw)) return null;
    return raw.map(r => ({ wallet: r.w, label: r.l }));
  } catch { return null; }
}

function generateShareURL(friends) {
  const code = encodeSession(friends);
  return `${window.location.origin}/citizenship?crew=${code}`;
}

const LS_KEY = "dt_citizenship_friends";

function loadFriends() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch { return []; }
}

function saveFriends(friends) {
  localStorage.setItem(LS_KEY, JSON.stringify(friends));
}

const AUDIT_LS = "dt_audit_history";
const NOTIF_LS = "dt_notif_dismissed";
const BONEYARD_LS = "dt_boneyard_cache";

function loadAuditHistory() {
  try { return JSON.parse(localStorage.getItem(AUDIT_LS) || "{}"); } catch { return {}; }
}

function saveAuditSnapshot(walletAddr, nfts) {
  const history = loadAuditHistory();
  if (!history[walletAddr]) history[walletAddr] = [];
  const statuses = (nfts || []).map((n) => ({ id: n.id, inAudit: n.inAudit, taxDue: n.taxDue }));
  history[walletAddr].push({ ts: Date.now(), statuses });
  // Cap at 30 per wallet
  if (history[walletAddr].length > 30) history[walletAddr] = history[walletAddr].slice(-30);
  localStorage.setItem(AUDIT_LS, JSON.stringify(history));
}

function getEvaderNames() {
  try {
    const raw = JSON.parse(localStorage.getItem(BONEYARD_LS));
    if (raw && raw.tokens) return raw.tokens.map((t) => t.name?.toLowerCase() || "");
  } catch {}
  return [];
}

function loadDismissed() {
  try { return JSON.parse(localStorage.getItem(NOTIF_LS) || "[]"); } catch { return []; }
}

function saveDismissed(ids) {
  localStorage.setItem(NOTIF_LS, JSON.stringify(ids));
}

export default function Citizenship({ mobile }) {
  const { colors } = useTheme();
  const BG = colors.bg;
  const BK = colors.fg;
  const [friends, setFriends] = useState([]);
  const [newWallet, setNewWallet] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [addError, setAddError] = useState("");
  const [fetching, setFetching] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAuditHistory, setShowAuditHistory] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Session sharing state
  const [sessionCode, setSessionCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinStatus, setJoinStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);

  // Load friends + check for incoming ?crew= param
  useEffect(() => {
    const saved = loadFriends();
    setFriends(saved);

    // Check URL for shared session
    const params = new URLSearchParams(window.location.search);
    const crewCode = params.get("crew");
    if (crewCode) {
      importSession(crewCode, saved);
      // Clean the URL without reload
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Notification check: compare citizen IDs against evader names
    const evaderNames = getEvaderNames();
    const dismissed = loadDismissed();
    if (evaderNames.length > 0 && saved.length > 0) {
      const alerts = [];
      saved.forEach((f) => {
        (f.nfts || []).forEach((nft) => {
          const citizenName = (nft.name || "").toLowerCase();
          if (evaderNames.some((en) => en && citizenName && en.includes(citizenName.replace(/citizen #/i, "").trim()))) {
            if (!dismissed.includes(nft.id)) {
              alerts.push({ friendLabel: f.label, citizenId: nft.id, citizenName: nft.name });
            }
          }
        });
      });
      setNotifications(alerts);
    }
  }, []);

  const importSession = async (code, existingFriends) => {
    const decoded = decodeSession(code);
    if (!decoded || decoded.length === 0) {
      setJoinStatus("INVALID SESSION CODE");
      return;
    }

    setImporting(true);
    setJoinStatus(`IMPORTING ${decoded.length} WALLET${decoded.length > 1 ? "S" : ""}...`);

    const current = existingFriends || friends;
    const existingWallets = new Set(current.map(f => f.wallet.toLowerCase()));
    const newEntries = decoded.filter(d => !existingWallets.has(d.wallet.toLowerCase()));

    if (newEntries.length === 0) {
      setJoinStatus("ALL WALLETS ALREADY IN YOUR CREW");
      setImporting(false);
      return;
    }

    let added = 0;
    let updated = [...current];

    for (const entry of newEntries) {
      try {
        const nfts = await fetchWalletNFTs(entry.wallet);
        updated.push({
          wallet: entry.wallet,
          label: entry.label || entry.wallet.slice(0, 6) + "..." + entry.wallet.slice(-4),
          nfts,
          citizenCount: nfts.length,
          addedAt: Date.now(),
        });
        added++;
        setJoinStatus(`IMPORTED ${added}/${newEntries.length}...`);
      } catch (e) {
        console.error(`Failed to fetch ${entry.wallet}:`, e);
      }
    }

    setFriends(updated);
    saveFriends(updated);
    setJoinStatus(`${added} NEW ALLY${added !== 1 ? "S" : ""} JOINED THE CREW`);
    setImporting(false);
    setJoinCode("");
  };

  const handleShareSession = () => {
    if (friends.length === 0) return;
    const url = generateShareURL(friends);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCopyCode = () => {
    if (friends.length === 0) return;
    const code = encodeSession(friends);
    navigator.clipboard.writeText(code);
    setSessionCode(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleJoinSession = () => {
    if (!joinCode.trim()) return;
    importSession(joinCode.trim(), friends);
  };

  const addFriend = async () => {
    const w = newWallet.trim();
    const label = newLabel.trim() || w.slice(0, 6) + "..." + w.slice(-4);

    if (!w || (!w.startsWith("0x") && !w.endsWith(".eth"))) {
      setAddError("ENTER A VALID WALLET ADDRESS OR ENS");
      return;
    }

    if (friends.some(f => f.wallet.toLowerCase() === w.toLowerCase())) {
      setAddError("WALLET ALREADY ADDED");
      return;
    }

    setAddError("");
    setFetching("adding");

    try {
      const nfts = await fetchWalletNFTs(w);
      const friend = {
        wallet: w,
        label,
        nfts,
        citizenCount: nfts.length,
        addedAt: Date.now(),
      };
      const updated = [...friends, friend];
      setFriends(updated);
      saveFriends(updated);
      saveAuditSnapshot(w, nfts);
      setNewWallet("");
      setNewLabel("");
      setExpandedIdx(updated.length - 1);
    } catch (e) {
      setAddError(e.message || "FAILED TO FETCH WALLET");
    }
    setFetching(null);
  };

  const removeFriend = (idx) => {
    const updated = friends.filter((_, i) => i !== idx);
    setFriends(updated);
    saveFriends(updated);
    if (expandedIdx === idx) setExpandedIdx(null);
    else if (expandedIdx > idx) setExpandedIdx(expandedIdx - 1);
  };

  const refreshFriend = async (idx) => {
    setFetching(idx);
    try {
      const nfts = await fetchWalletNFTs(friends[idx].wallet);
      const updated = [...friends];
      updated[idx] = { ...updated[idx], nfts, citizenCount: nfts.length };
      setFriends(updated);
      saveFriends(updated);
      saveAuditSnapshot(friends[idx].wallet, nfts);
    } catch (e) {
      console.error(e);
    }
    setFetching(null);
  };

  const totalCitizens = friends.reduce((sum, f) => sum + (f.nfts?.length || 0), 0);
  const totalAudited = friends.reduce((sum, f) => sum + (f.nfts?.filter(n => n.inAudit).length || 0), 0);
  const totalTaxDue = friends.reduce((sum, f) => sum + (f.nfts?.filter(n => n.taxDue).length || 0), 0);

  const allCitizens = friends.flatMap((f, fi) => (f.nfts || []).map(n => ({ ...n, friendLabel: f.label, friendIdx: fi })));
  const filtered = searchQuery
    ? allCitizens.filter(c => c.id.includes(searchQuery) || c.class.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const btnStyle = (active) => ({
    background: active ? BK : "transparent",
    color: active ? BG : BK,
    border: `2px solid ${BK}`,
    padding: mobile ? "6px 12px" : "8px 18px",
    fontSize: mobile ? 14 : 16,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ padding: mobile ? "16px" : "40px", width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* SESSION SHARING */}
      <div style={{ border: `3px solid ${BK}`, padding: mobile ? 16 : 24, background: "transparent" }}>
        <div style={{ fontSize: mobile ? 20 : 28, fontWeight: 800, fontFamily: `"${HEADING_FONT}", monospace`, marginBottom: 16 }}>
          CREW SESSION
        </div>
        <div style={{ fontSize: mobile ? 14 : 18, fontWeight: 500, marginBottom: 16 }}>
          Share your crew link so others can import your entire group. When they open the link, all wallets auto-sync into their citizenship.
        </div>

        {/* Share buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <button
            onClick={handleShareSession}
            disabled={friends.length === 0}
            style={{
              ...btnStyle(true),
              opacity: friends.length === 0 ? 0.4 : 1,
              cursor: friends.length === 0 ? "not-allowed" : "pointer",
              fontFamily: `"${HEADING_FONT}", monospace`,
              fontSize: mobile ? 14 : 18,
              padding: mobile ? "10px 16px" : "12px 24px",
            }}
          >
            {copied ? "LINK COPIED" : "SHARE CREW LINK"}
          </button>
          <button
            onClick={handleCopyCode}
            disabled={friends.length === 0}
            style={{
              ...btnStyle(false),
              opacity: friends.length === 0 ? 0.4 : 1,
              cursor: friends.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            COPY SESSION CODE
          </button>
        </div>

        {/* Join */}
        <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: 8 }}>
          <input
            type="text"
            placeholder="PASTE A SESSION CODE TO JOIN..."
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoinSession()}
            style={{
              flex: 1,
              background: "transparent",
              border: `2px solid ${BK}`,
              padding: "10px 14px",
              fontSize: mobile ? 14 : 18,
              fontWeight: 600,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleJoinSession}
            disabled={importing || !joinCode.trim()}
            style={{
              ...btnStyle(true),
              fontFamily: `"${HEADING_FONT}", monospace`,
              fontSize: mobile ? 14 : 18,
              padding: mobile ? "10px 16px" : "12px 24px",
              cursor: importing ? "wait" : "pointer",
            }}
          >
            {importing ? "SYNCING..." : "JOIN CREW"}
          </button>
        </div>
        {joinStatus && (
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8, color: joinStatus.includes("INVALID") ? colors.error : BK }}>
            {joinStatus}
          </div>
        )}
      </div>

      {/* ADD FRIEND */}
      <div style={{ borderBottom: `4px solid ${BK}`, paddingBottom: 20 }}>
        <div style={{ fontSize: mobile ? 18 : 24, fontWeight: 800, fontFamily: `"${HEADING_FONT}", monospace`, marginBottom: 12 }}>
          ADD TO CREW
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: mobile ? 8 : 12 }}>
            <input
              type="text"
              placeholder="WALLET ADDRESS OR ENS"
              value={newWallet}
              onChange={(e) => setNewWallet(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFriend()}
              style={{
                flex: 2,
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
            <input
              type="text"
              placeholder="LABEL (OPTIONAL)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFriend()}
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
              onClick={addFriend}
              disabled={fetching === "adding"}
              style={{
                background: fetching === "adding" ? BK : BG,
                color: fetching === "adding" ? BG : BK,
                border: `3px solid ${BK}`,
                padding: "12px 24px",
                fontSize: mobile ? 14 : 18,
                fontWeight: 800,
                cursor: fetching === "adding" ? "wait" : "pointer",
                fontFamily: `"${HEADING_FONT}", monospace`,
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {fetching === "adding" ? "IMPORTING..." : "ADD CITIZEN"}
            </button>
          </div>
          {addError && (
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.error }}>{addError}</div>
          )}
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ display: "flex", gap: mobile ? 8 : 16, flexWrap: "wrap", fontSize: mobile ? 14 : 18, fontWeight: 700 }}>
        <span style={{ background: BK, color: BG, padding: "6px 14px" }}>
          {friends.length} {friends.length === 1 ? "ALLY" : "ALLIES"}
        </span>
        <span style={{ border: `2px solid ${BK}`, padding: "4px 12px" }}>
          {totalCitizens} PROTECTED CITIZENS
        </span>
        {totalAudited > 0 && (
          <span style={{ background: colors.error, color: "#fff", padding: "6px 14px" }}>
            {totalAudited} IN AUDIT
          </span>
        )}
        {totalTaxDue > 0 && (
          <span style={{ background: BK, color: BG, padding: "6px 14px" }}>
            {totalTaxDue} TAX DUE
          </span>
        )}
      </div>

      {/* NOTIFICATION ALERTS */}
      {notifications.length > 0 && (
        <div style={{ border: `3px solid ${colors.error}`, padding: mobile ? 12 : 20, background: "rgba(139,26,26,0.08)" }}>
          <div style={{ fontSize: mobile ? 18 : 24, fontWeight: 800, fontFamily: `"${HEADING_FONT}", monospace`, color: colors.error, marginBottom: 12 }}>
            ELIMINATION ALERT ({notifications.length})
          </div>
          <div style={{ fontSize: mobile ? 14 : 18, marginBottom: 12, opacity: 0.8 }}>
            The following citizens match names found in the evader boneyard:
          </div>
          {notifications.map((n) => (
            <div key={n.citizenId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px dashed ${colors.error}` }}>
              <span style={{ fontWeight: 700 }}>
                {n.friendLabel} — {n.citizenName} (#{n.citizenId})
              </span>
              <button
                onClick={() => {
                  const dismissed = loadDismissed();
                  dismissed.push(n.citizenId);
                  saveDismissed(dismissed);
                  setNotifications((prev) => prev.filter((p) => p.citizenId !== n.citizenId));
                }}
                style={{
                  background: "transparent",
                  border: `1px solid ${colors.error}`,
                  color: colors.error,
                  padding: "4px 10px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                DISMISS
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SEARCH */}
      {friends.length > 0 && (
        <div>
          <input
            type="text"
            placeholder="SEARCH CITIZEN ID OR CLASS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
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
          {filtered && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: mobile ? 14 : 18, fontWeight: 800, marginBottom: 12 }}>
                {filtered.length} RESULT{filtered.length !== 1 ? "S" : ""} FOUND
              </div>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(auto-fill, minmax(140px, 1fr))" : "repeat(auto-fill, minmax(160px, 1fr))", gap: mobile ? 10 : 16 }}>
                {filtered.map((c) => (
                  <div key={`s-${c.friendIdx}-${c.id}`} style={{ border: `2px solid ${BK}`, padding: 8, background: "transparent", position: "relative" }}>
                    {c.image ? (
                      <img src={c.image} alt="" style={{ width: "100%", aspectRatio: "1", imageRendering: "pixelated", display: "block", border: `1px solid ${BK}` }} />
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "1", background: BK, color: BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>#{c.id}</div>
                    )}
                    {(c.inAudit || c.taxDue) && (
                      <div style={{ position: "absolute", top: 4, right: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                        {c.inAudit && <div style={{ background: colors.error, color: "#fff", fontSize: 14, fontWeight: 700, padding: "4px 8px" }}>AUDIT</div>}
                        {c.taxDue && <div style={{ background: BK, color: BG, fontSize: 14, fontWeight: 700, padding: "4px 8px" }}>TAX</div>}
                      </div>
                    )}
                    <div style={{ textAlign: "center", marginTop: 6 }}>
                      <div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, fontFamily: `"${HEADING_FONT}", monospace` }}>#{c.id}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", opacity: 0.7 }}>{c.friendLabel}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FRIENDS LIST */}
      {friends.length === 0 ? (
        <div style={{ fontSize: mobile ? 18 : 22, fontWeight: 500, padding: "40px 0", borderTop: `2px dashed ${BK}`, textAlign: "center" }}>
          NO ALLIES REGISTERED. ADD A WALLET OR JOIN A CREW SESSION ABOVE.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {friends.map((f, idx) => {
            const isExpanded = expandedIdx === idx;
            const audited = (f.nfts || []).filter(n => n.inAudit).length;
            const taxed = (f.nfts || []).filter(n => n.taxDue).length;
            const clear = (f.nfts || []).filter(n => !n.inAudit && !n.taxDue).length;

            return (
              <div key={idx} style={{ border: `3px solid ${BK}`, background: "transparent" }}>
                {/* Friend Header */}
                <div
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: mobile ? "12px" : "16px 20px",
                    cursor: "pointer",
                    flexWrap: "wrap",
                    gap: 8,
                    background: isExpanded ? BK : "transparent",
                    color: isExpanded ? BG : BK,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: mobile ? 20 : 28, fontWeight: 800, fontFamily: `"${HEADING_FONT}", monospace` }}>
                      {f.label}
                    </div>
                    <span style={{ fontSize: mobile ? 14 : 16, fontWeight: 600, opacity: 0.6 }}>
                      {f.wallet.slice(0, 6)}...{f.wallet.slice(-4)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: mobile ? 14 : 18, fontWeight: 700 }}>
                      {f.citizenCount || 0} CITIZEN{(f.citizenCount || 0) !== 1 ? "S" : ""}
                    </span>
                    {audited > 0 && <span style={{ background: colors.error, color: "#fff", fontSize: 14, fontWeight: 700, padding: "4px 8px" }}>{audited}</span>}
                    {taxed > 0 && <span style={{ background: isExpanded ? BG : BK, color: isExpanded ? BK : BG, fontSize: 14, fontWeight: 700, padding: "4px 8px" }}>{taxed}</span>}
                    <span style={{ fontSize: 20, fontWeight: 800 }}>{isExpanded ? "−" : "+"}</span>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ padding: mobile ? 12 : 20 }}>
                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                      <button onClick={(e) => { e.stopPropagation(); refreshFriend(idx); }} disabled={fetching === idx} style={btnStyle(false)}>
                        {fetching === idx ? "REFRESHING..." : "REFRESH"}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(f.wallet); }} style={btnStyle(false)}>
                        COPY WALLET
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFriend(idx); }}
                        style={{ ...btnStyle(false), color: colors.error, borderColor: colors.error }}
                      >
                        REMOVE
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAuditHistory(showAuditHistory === idx ? null : idx); }}
                        style={btnStyle(showAuditHistory === idx)}
                      >
                        AUDIT HISTORY
                      </button>
                    </div>

                    {/* Audit History Timeline */}
                    {showAuditHistory === idx && (() => {
                      const history = loadAuditHistory();
                      const snapshots = history[f.wallet] || [];
                      if (snapshots.length === 0) {
                        return (
                          <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 16, padding: "8px 0" }}>
                            NO AUDIT HISTORY YET. REFRESH TO CREATE A SNAPSHOT.
                          </div>
                        );
                      }
                      return (
                        <div style={{ marginBottom: 16, border: `2px solid ${BK}`, padding: mobile ? 8 : 12, maxHeight: 300, overflowY: "auto" }}>
                          <div style={{ fontSize: mobile ? 14 : 16, fontWeight: 800, marginBottom: 8, fontFamily: `"${HEADING_FONT}", monospace` }}>
                            AUDIT HISTORY ({snapshots.length} SNAPSHOTS)
                          </div>
                          {[...snapshots].reverse().map((snap, si) => {
                            const d = new Date(snap.ts);
                            const dateStr = d.toLocaleDateString() + " " + d.toLocaleTimeString();
                            const audited = snap.statuses.filter((s) => s.inAudit).length;
                            const taxDue = snap.statuses.filter((s) => s.taxDue).length;
                            const clear = snap.statuses.length - audited - taxDue;
                            return (
                              <div key={si} style={{ padding: "4px 0", borderBottom: `1px dashed ${BK}`, fontSize: mobile ? 14 : 16 }}>
                                <span style={{ fontWeight: 700 }}>{dateStr}</span>
                                {" — "}
                                <span>{snap.statuses.length} citizens</span>
                                {audited > 0 && <span style={{ color: colors.error, fontWeight: 700 }}> / {audited} audit</span>}
                                {taxDue > 0 && <span style={{ fontWeight: 700 }}> / {taxDue} tax</span>}
                                <span style={{ opacity: 0.6 }}> / {clear} clear</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Status Summary */}
                    {(f.nfts || []).length > 0 && (audited > 0 || taxed > 0) && (
                      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", fontSize: 15, fontWeight: 700 }}>
                        {audited > 0 && <span style={{ background: colors.error, color: "#fff", padding: "4px 10px" }}>{audited} IN AUDIT</span>}
                        {taxed > 0 && <span style={{ background: BK, color: BG, padding: "4px 10px" }}>{taxed} TAX DUE</span>}
                        {clear > 0 && <span style={{ border: `2px solid ${BK}`, padding: "4px 10px" }}>{clear} CLEAR</span>}
                      </div>
                    )}

                    {/* NFT Grid */}
                    {(f.nfts || []).length > 0 ? (
                      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(auto-fill, minmax(100px, 1fr))" : "repeat(auto-fill, minmax(130px, 1fr))", gap: mobile ? 8 : 12 }}>
                        {f.nfts.map((nft) => (
                          <div key={nft.id} style={{ border: `2px solid ${BK}`, padding: 6, background: "transparent", position: "relative" }}>
                            {nft.image ? (
                              <img src={nft.image} alt={`#${nft.id}`} style={{ width: "100%", aspectRatio: "1", imageRendering: "pixelated", display: "block", border: `1px solid ${BK}` }} />
                            ) : (
                              <div style={{ width: "100%", aspectRatio: "1", background: BK, color: BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>#{nft.id}</div>
                            )}
                            {(nft.inAudit || nft.taxDue) && (
                              <div style={{ position: "absolute", top: 2, right: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                                {nft.inAudit && <div style={{ background: colors.error, color: "#fff", fontSize: 15, fontWeight: 700, padding: "4px 8px" }}>AUDIT</div>}
                                {nft.taxDue && <div style={{ background: BK, color: BG, fontSize: 15, fontWeight: 700, padding: "4px 8px" }}>TAX</div>}
                              </div>
                            )}
                            <div style={{ textAlign: "center", marginTop: 4 }}>
                              <div style={{ fontSize: mobile ? 14 : 18, fontWeight: 800, fontFamily: `"${HEADING_FONT}", monospace` }}>#{nft.id}</div>
                              <div style={{ fontSize: mobile ? 14 : 16, fontWeight: 600, textTransform: "uppercase" }}>
                                {nft.class !== "UNKNOWN" ? nft.class : "UNKNOWN"}
                              </div>
                              <div style={{
                                fontSize: 14,
                                fontWeight: 700,
                                padding: "4px 0",
                                marginTop: 2,
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
                                style={{ fontSize: 15, fontWeight: 700, color: BK, textDecoration: "none", opacity: 0.5 }}
                              >
                                OPENSEA
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 16, fontWeight: 500, padding: "20px 0", textAlign: "center", opacity: 0.6 }}>
                        NO DEATH & TAXES CITIZENS FOUND IN THIS WALLET.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

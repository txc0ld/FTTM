import { AbiCoder } from "ethers";

const GAME_CONTRACT = "0xa448c7f618087dda1a3b128cad8a424fbae4b71f";
const CITIZENS_CONTRACT = "0x4f249b2dc6cecbd549a0c354bbfc4919e8c5d3ae";
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const TOTAL = 6969;

// Function selectors
const SEL_CURRENT_EPOCH = "0x76671808";
const SEL_LAST_EPOCH_PAID = "0x72e012d6";
const SEL_AUDIT_DUE_TIMESTAMP = "0x608cf06b";
const SEL_OWNER_OF = "0x6352211e"; // ERC721 ownerOf(uint256)

// Multicall3.aggregate3 selector
const AGGREGATE3_SEL = "0x82ad56cb";

const coder = new AbiCoder();

function pad32(tokenId) {
  return BigInt(tokenId).toString(16).padStart(64, "0");
}

function getRPC() {
  const key = process.env.ALCHEMY_API_KEY;
  return key ? `https://eth-mainnet.g.alchemy.com/v2/${key}` : "https://eth.llamarpc.com";
}

// Encode a Multicall3.aggregate3 call
function encodeMulticall(subCalls) {
  // aggregate3((address,bool,bytes)[])
  const tuples = subCalls.map((c) => [c.target, true, c.data]);
  const encoded = coder.encode(
    ["tuple(address,bool,bytes)[]"],
    [tuples]
  );
  return AGGREGATE3_SEL + encoded.slice(2);
}

// Decode aggregate3 result → array of { success, data }
function decodeMulticall(hex) {
  const decoded = coder.decode(["tuple(bool,bytes)[]"], hex);
  return decoded[0].map((r) => ({
    success: r[0],
    data: r[1],
  }));
}

async function rpcCall(rpcUrl, to, data) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const rpcUrl = getRPC();

  try {
    // 1. Get current epoch
    const epochResult = await rpcCall(rpcUrl, GAME_CONTRACT, SEL_CURRENT_EPOCH);
    const currentEpoch = parseInt(epochResult, 16);
    const nowSec = Math.floor(Date.now() / 1000);

    // 2. Scan all tokens using Multicall3
    //    Each token needs 3 calls: ownerOf + lastEpochPaid + auditDueTimestamp
    //    ownerOf filters out burned/killed citizens (reverts for non-existent tokens)
    //    Pack ~333 tokens per multicall (~999 sub-calls)
    const CHUNK = 333;
    const delinquent = [];
    const killable = [];

    for (let start = 1; start <= TOTAL; start += CHUNK) {
      const end = Math.min(start + CHUNK - 1, TOTAL);
      const subCalls = [];
      for (let id = start; id <= end; id++) {
        subCalls.push({ target: CITIZENS_CONTRACT, data: SEL_OWNER_OF + pad32(id) });
        subCalls.push({ target: GAME_CONTRACT, data: SEL_LAST_EPOCH_PAID + pad32(id) });
        subCalls.push({ target: GAME_CONTRACT, data: SEL_AUDIT_DUE_TIMESTAMP + pad32(id) });
      }

      const calldata = encodeMulticall(subCalls);
      let results;
      // Retry once on failure
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const raw = await rpcCall(rpcUrl, MULTICALL3, calldata);
          results = decodeMulticall(raw);
          break;
        } catch (e) {
          if (attempt === 1) throw e;
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      for (let j = 0; j < (end - start + 1); j++) {
        const id = start + j;
        const ownerResult = results[j * 3];
        const lastPaidResult = results[j * 3 + 1];
        const auditResult = results[j * 3 + 2];

        // Skip burned/killed citizens (ownerOf reverts or returns zero address)
        if (!ownerResult.success) continue;
        const ownerHex = ownerResult.data;
        if (!ownerHex || ownerHex === "0x" || BigInt(ownerHex) === 0n) continue;

        if (!lastPaidResult.success) continue;

        const lastPaid = parseInt(lastPaidResult.data, 16);
        const auditDueTs = auditResult.success ? parseInt(auditResult.data, 16) : 0;
        const daysRemaining = lastPaid - currentEpoch;

        if (daysRemaining < 0) {
          const isKillable = auditDueTs > 0 && auditDueTs <= nowSec;
          const entry = {
            tokenId: String(id),
            daysRemaining,
            auditDue: auditDueTs > 0 ? auditDueTs : null,
            killable: isKillable,
          };
          if (isKillable) killable.push(entry);
          else delinquent.push(entry);
        }
      }
    }

    // Sort: killable first (most overdue), then delinquent (most overdue)
    killable.sort((a, b) => a.daysRemaining - b.daysRemaining);
    delinquent.sort((a, b) => a.daysRemaining - b.daysRemaining);

    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=60");
    return res.status(200).json({
      currentEpoch,
      scannedAt: Date.now(),
      totalScanned: TOTAL,
      killableCount: killable.length,
      delinquentCount: delinquent.length,
      killable,
      delinquent,
    });
  } catch (e) {
    console.error("Killable scan error:", e);
    return res.status(500).json({ error: "Scan failed", detail: e.message });
  }
}

const LLAMA_RPC = "https://eth.llamarpc.com";
const GAME_CONTRACT = "0xa448c7f618087dda1a3b128cad8a424fbae4b71f";

function getRPC() {
  const key = process.env.ALCHEMY_API_KEY;
  return key ? `https://eth-mainnet.g.alchemy.com/v2/${key}` : LLAMA_RPC;
}

// Function selectors
const SEL_CURRENT_EPOCH = "0x76671808";
const SEL_LAST_EPOCH_PAID = "0x72e012d6";
const SEL_HAS_LIFE_INSURANCE = "0x866ec147";
const SEL_AUDIT_DUE_TIMESTAMP = "0x608cf06b";
const SEL_GET_CURRENT_TAX_RATE = "0x64f53f2e";

// Max calls per JSON-RPC batch (Alchemy limits ~100-150)
const MAX_BATCH = 100;
const MAX_RETRIES = 2;

function pad32(tokenId) {
  return BigInt(tokenId).toString(16).padStart(64, "0");
}

async function ethBatchCall(calls) {
  const rpc = getRPC();
  const body = calls.map((data, i) => ({
    jsonrpc: "2.0",
    method: "eth_call",
    params: [{ to: GAME_CONTRACT, data }, "latest"],
    id: i + 1,
  }));
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("RPC returned non-array");
  return json.sort((a, b) => a.id - b.id).map((r) => r.result);
}

async function ethBatchCallWithRetry(calls) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await ethBatchCall(calls);
    } catch (e) {
      if (attempt === MAX_RETRIES) throw e;
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }
}

// Split a large set of calls into chunks and execute sequentially
async function ethBatchCallChunked(calls) {
  const results = [];
  for (let i = 0; i < calls.length; i += MAX_BATCH) {
    const chunk = calls.slice(i, i + MAX_BATCH);
    const chunkResults = await ethBatchCallWithRetry(chunk);
    results.push(...chunkResults);
  }
  return results;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { tokenIds } = req.body;
    if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
      return res.status(400).json({ error: "tokenIds array required" });
    }
    if (tokenIds.length > 200) {
      return res.status(400).json({ error: "Max 200 tokens per request" });
    }

    // Get epoch + tax rate first (small batch, reliable)
    const globalResults = await ethBatchCallWithRetry([
      SEL_CURRENT_EPOCH,
      SEL_GET_CURRENT_TAX_RATE,
    ]);
    const currentEpoch = parseInt(globalResults[0], 16);
    const taxRateWei = BigInt(globalResults[1]);
    const taxRateEth = Number(taxRateWei) / 1e18;

    // Build per-token calls
    const tokenCalls = [];
    for (const id of tokenIds) {
      tokenCalls.push(SEL_LAST_EPOCH_PAID + pad32(id));
      tokenCalls.push(SEL_HAS_LIFE_INSURANCE + pad32(id));
      tokenCalls.push(SEL_AUDIT_DUE_TIMESTAMP + pad32(id));
    }

    // Execute in safe chunks
    const results = await ethBatchCallChunked(tokenCalls);

    const citizens = [];
    for (let i = 0; i < tokenIds.length; i++) {
      const offset = i * 3;
      const lastPaid = parseInt(results[offset], 16);
      const insured = parseInt(results[offset + 1], 16) === 1;
      const auditDueTs = parseInt(results[offset + 2], 16);
      const daysRemaining = lastPaid - currentEpoch;

      citizens.push({
        tokenId: String(tokenIds[i]),
        lastEpochPaid: lastPaid,
        daysRemaining,
        insured,
        auditDue: auditDueTs > 0 ? auditDueTs : null,
        status:
          daysRemaining < 0
            ? "DELINQUENT"
            : daysRemaining === 0
            ? "DUE_TODAY"
            : daysRemaining <= 2
            ? "WARNING"
            : "CURRENT",
      });
    }

    return res.status(200).json({
      currentEpoch,
      taxRateEth: taxRateEth.toFixed(6),
      citizens,
    });
  } catch (e) {
    console.error("Tax status error:", e);
    return res.status(500).json({ error: "Failed to fetch tax status", detail: e.message });
  }
}

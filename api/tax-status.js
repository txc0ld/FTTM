const RPC = "https://eth.llamarpc.com";
const GAME_CONTRACT = "0xa448c7f618087dda1a3b128cad8a424fbae4b71f";

// Function selectors
const SEL_CURRENT_EPOCH = "0x76671808";
const SEL_LAST_EPOCH_PAID = "0x72e012d6";
const SEL_HAS_LIFE_INSURANCE = "0x866ec147";
const SEL_AUDIT_DUE_TIMESTAMP = "0x608cf06b";
const SEL_GET_CURRENT_TAX_RATE = "0x64f53f2e";

function pad32(tokenId) {
  return BigInt(tokenId).toString(16).padStart(64, "0");
}

async function ethCall(data) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to: GAME_CONTRACT, data }, "latest"],
      id: 1,
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function ethBatchCall(calls) {
  const body = calls.map((data, i) => ({
    jsonrpc: "2.0",
    method: "eth_call",
    params: [{ to: GAME_CONTRACT, data }, "latest"],
    id: i + 1,
  }));
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  // Sort by id to maintain order
  return json.sort((a, b) => a.id - b.id).map((r) => r.result);
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

    // Build batch: currentEpoch + taxRate + lastEpochPaid/insurance/auditDue per token
    const calls = [SEL_CURRENT_EPOCH, SEL_GET_CURRENT_TAX_RATE];
    for (const id of tokenIds) {
      calls.push(SEL_LAST_EPOCH_PAID + pad32(id));
      calls.push(SEL_HAS_LIFE_INSURANCE + pad32(id));
      calls.push(SEL_AUDIT_DUE_TIMESTAMP + pad32(id));
    }

    const results = await ethBatchCall(calls);

    const currentEpoch = parseInt(results[0], 16);
    const taxRateWei = BigInt(results[1]);
    const taxRateEth = Number(taxRateWei) / 1e18;

    const citizens = [];
    for (let i = 0; i < tokenIds.length; i++) {
      const offset = 2 + i * 3;
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
    return res.status(500).json({ error: "Failed to fetch tax status" });
  }
}

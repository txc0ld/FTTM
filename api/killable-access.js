import { neon } from "@neondatabase/serverless";

const TREASURY = "0x0dae6e01a88826b4e77d717d9639b64f749c0152";
const PRICE_WEI = "0x187E7D288000"; // 0.0069 ETH in hex (6900000000000000 wei)
const PRICE_MIN = BigInt("6800000000000000"); // slight tolerance for gas price rounding

async function getRPC() {
  const key = process.env.ALCHEMY_API_KEY;
  return key ? `https://eth-mainnet.g.alchemy.com/v2/${key}` : "https://eth.llamarpc.com";
}

async function verifyTx(txHash) {
  const rpc = await getRPC();
  // Get transaction receipt to confirm it succeeded
  const receiptRes = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "eth_getTransactionReceipt",
      params: [txHash],
    }),
  });
  const receiptJson = await receiptRes.json();
  if (!receiptJson.result || receiptJson.result.status !== "0x1") {
    throw new Error("Transaction not confirmed or failed");
  }

  // Get transaction details to verify amount and recipient
  const txRes = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 2,
      method: "eth_getTransactionByHash",
      params: [txHash],
    }),
  });
  const txJson = await txRes.json();
  const tx = txJson.result;
  if (!tx) throw new Error("Transaction not found");

  const to = (tx.to || "").toLowerCase();
  const value = BigInt(tx.value || "0");
  const from = (tx.from || "").toLowerCase();

  if (to !== TREASURY.toLowerCase()) {
    throw new Error("Payment not sent to treasury");
  }
  if (value < PRICE_MIN) {
    throw new Error("Insufficient payment amount");
  }

  return { from, txHash, value: value.toString() };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  // Ensure table exists
  await sql`
    CREATE TABLE IF NOT EXISTS killable_access (
      wallet TEXT PRIMARY KEY,
      tx_hash TEXT NOT NULL,
      paid_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // GET — check if wallet has access
  if (req.method === "GET") {
    const wallet = (req.query.wallet || "").toLowerCase();
    if (!wallet) return res.status(400).json({ error: "wallet required" });

    const rows = await sql`
      SELECT wallet, paid_at FROM killable_access WHERE wallet = ${wallet}
    `;
    return res.status(200).json({ hasAccess: rows.length > 0 });
  }

  // POST — verify payment and grant access
  if (req.method === "POST") {
    const { wallet, txHash } = req.body || {};
    if (!wallet || !txHash) {
      return res.status(400).json({ error: "wallet and txHash required" });
    }
    const walletLower = wallet.toLowerCase();

    // Check if already has access
    const existing = await sql`
      SELECT wallet FROM killable_access WHERE wallet = ${walletLower}
    `;
    if (existing.length > 0) {
      return res.status(200).json({ hasAccess: true, alreadyPaid: true });
    }

    // Check if this tx was already used by someone else
    const txUsed = await sql`
      SELECT wallet FROM killable_access WHERE tx_hash = ${txHash.toLowerCase()}
    `;
    if (txUsed.length > 0) {
      return res.status(400).json({ error: "Transaction already used" });
    }

    // Verify the transaction on-chain
    try {
      const verified = await verifyTx(txHash);
      if (verified.from !== walletLower) {
        return res.status(400).json({ error: "Transaction sender doesn't match wallet" });
      }

      // Grant access
      await sql`
        INSERT INTO killable_access (wallet, tx_hash, paid_at)
        VALUES (${walletLower}, ${txHash.toLowerCase()}, NOW())
        ON CONFLICT (wallet) DO NOTHING
      `;

      return res.status(200).json({ hasAccess: true });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

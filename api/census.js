const CONTRACT = "0x4f249b2dc6cecbd549a0c354bbfc4919e8c5d3ae";
const EVADER_CONTRACT = "0x075f90ff6b89a1c164fb352bebd0a16f55804ca2";
const GAME_CONTRACT = "0xa448c7f618087dda1a3b128cad8a424fbae4b71f";
const RPC = "https://eth.llamarpc.com";
const SEL_BRIBE_BALANCE = "0xca58643b"; // bribeBalance(uint256)

// In-memory cache (persists across warm invocations)
let cached = null;
let cachedAt = 0;
const TTL = 30 * 60 * 1000; // 30 min

async function scrapeContract(key, contractAddress) {
  const base = `https://eth-mainnet.g.alchemy.com/nft/v3/${key}`;
  let pageKey = null;
  let allNfts = [];
  let pages = 0;

  do {
    const params = new URLSearchParams({
      contractAddress,
      withMetadata: "true",
      limit: "100",
    });
    if (pageKey) params.set("pageKey", pageKey);

    const res = await fetch(`${base}/getNFTsForContract?${params}`);
    if (!res.ok) break;
    const data = await res.json();
    if (data.nfts) allNfts = allNfts.concat(data.nfts);
    pageKey = data.pageKey || null;
    pages++;
    if (pages > 100) break;
  } while (pageKey);

  return allNfts;
}

function pad32(tokenId) {
  return BigInt(tokenId).toString(16).padStart(64, "0");
}

async function fetchBribeBalances(tokenIds) {
  // Batch RPC calls in chunks of 500 to avoid payload limits
  const CHUNK = 500;
  const results = {};

  for (let i = 0; i < tokenIds.length; i += CHUNK) {
    const chunk = tokenIds.slice(i, i + CHUNK);
    const body = chunk.map((id, idx) => ({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to: GAME_CONTRACT, data: SEL_BRIBE_BALANCE + pad32(id) }, "latest"],
      id: i + idx + 1,
    }));

    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();

    // Map results back to token IDs
    json.forEach((r, idx) => {
      const tid = chunk[idx];
      if (r.result && r.result !== "0x") {
        results[tid] = parseInt(r.result, 16);
      } else {
        results[tid] = 0;
      }
    });
  }

  return results;
}

function parseAttrs(nft) {
  const attrs = {};
  (nft.raw?.metadata?.attributes || []).forEach((a) => {
    if (a.trait_type) attrs[a.trait_type.toLowerCase()] = a.value;
  });
  return attrs;
}

function aggregate(mainNfts, evaderNfts, bribeBalances) {
  const classes = {};
  const classEliminated = {};
  let insuredCount = 0;
  let uninsuredCount = 0;
  let bribedCount = 0;
  let unbribedCount = 0;
  let bribedElimCount = 0;

  // Collect evader token IDs from their names (e.g. "Tax Evader #123" -> "123")
  const evaderCitizenIds = new Set();
  evaderNfts.forEach((nft) => {
    const name = nft.name || nft.raw?.metadata?.name || "";
    const m = name.match(/(\d+)\s*$/);
    if (m) evaderCitizenIds.add(m[1]);
  });

  mainNfts.forEach((nft) => {
    const attrs = parseAttrs(nft);
    const tokenId = nft.tokenId || "0";
    const cls = (attrs.class || attrs.type || "UNKNOWN").toUpperCase();
    classes[cls] = (classes[cls] || 0) + 1;

    const ins = (attrs.insured || attrs.insurance || "").toLowerCase();
    if (ins === "yes") insuredCount++;
    else uninsuredCount++;

    const bal = bribeBalances[tokenId] || 0;
    if (bal > 0) bribedCount++;
    else unbribedCount++;
  });

  evaderNfts.forEach((nft) => {
    const attrs = parseAttrs(nft);
    const cls = (attrs.class || attrs.type || "UNKNOWN").toUpperCase();
    classEliminated[cls] = (classEliminated[cls] || 0) + 1;

    // Check if the original citizen had a bribe (balance would be 0 now since eliminated,
    // but we can check the class — wealthy citizens start with bribes)
    const citizenClass = (attrs.class || attrs.type || "").toLowerCase();
    if (citizenClass === "wealthy") bribedElimCount++;
  });

  return { classes, classEliminated, insuredCount, uninsuredCount, bribedCount, unbribedCount, bribedElimCount };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.ALCHEMY_API_KEY;
  if (!key) return res.status(500).json({ error: "API key not configured" });

  // Return cached if fresh
  if (cached && Date.now() - cachedAt < TTL) {
    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=300");
    return res.status(200).json(cached);
  }

  try {
    // Scrape both contracts in parallel
    const [mainNfts, evaderNfts] = await Promise.all([
      scrapeContract(key, CONTRACT),
      scrapeContract(key, EVADER_CONTRACT),
    ]);

    // Get bribe balances for all living citizens from game contract
    const tokenIds = mainNfts.map((n) => n.tokenId || "0");
    const bribeBalances = await fetchBribeBalances(tokenIds);

    const result = aggregate(mainNfts, evaderNfts, bribeBalances);
    cached = result;
    cachedAt = Date.now();

    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=300");
    return res.status(200).json(result);
  } catch (e) {
    return res.status(502).json({ error: "Census scrape failed", detail: e.message });
  }
}

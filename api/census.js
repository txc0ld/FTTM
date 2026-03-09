const CONTRACT = "0x4f249b2dc6cecbd549a0c354bbfc4919e8c5d3ae";
const EVADER_CONTRACT = "0x075f90ff6b89a1c164fb352bebd0a16f55804ca2";

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
    if (pages > 100) break; // safety cap
  } while (pageKey);

  return allNfts;
}

function parseAttrs(nft) {
  const attrs = {};
  (nft.raw?.metadata?.attributes || []).forEach((a) => {
    if (a.trait_type) attrs[a.trait_type.toLowerCase()] = a.value;
  });
  return attrs;
}

function aggregate(mainNfts, evaderNfts) {
  const classes = {};
  const classEliminated = {};
  let insuredCount = 0;
  let uninsuredCount = 0;
  let bribedCount = 0;
  let unbribedCount = 0;
  let bribedElimCount = 0;

  mainNfts.forEach((nft) => {
    const attrs = parseAttrs(nft);
    const cls = (attrs.class || attrs.type || "UNKNOWN").toUpperCase();
    classes[cls] = (classes[cls] || 0) + 1;

    const ins = (attrs.insured || attrs.insurance || "").toLowerCase();
    if (ins === "yes") insuredCount++;
    else uninsuredCount++;

    const bribe = (attrs.bribe || attrs.bribes || "").toLowerCase();
    if (bribe && bribe !== "none" && bribe !== "no") bribedCount++;
    else unbribedCount++;
  });

  evaderNfts.forEach((nft) => {
    const attrs = parseAttrs(nft);
    const cls = (attrs.class || attrs.type || "UNKNOWN").toUpperCase();
    classEliminated[cls] = (classEliminated[cls] || 0) + 1;

    const bribe = (attrs.bribe || attrs.bribes || "").toLowerCase();
    if (bribe && bribe !== "none" && bribe !== "no") bribedElimCount++;
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

    const result = aggregate(mainNfts, evaderNfts);
    cached = result;
    cachedAt = Date.now();

    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=300");
    return res.status(200).json(result);
  } catch (e) {
    return res.status(502).json({ error: "Census scrape failed", detail: e.message });
  }
}

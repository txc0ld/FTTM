const CONTRACT = "0x4f249b2dc6cecbd549a0c354bbfc4919e8c5d3ae";
const EVADER_CONTRACT = "0x075f90ff6b89a1c164fb352bebd0a16f55804ca2";
const GAME_CONTRACT = "0xa448c7f618087dda1a3b128cad8a424fbae4b71f";
const SEL_BRIBE_BALANCE = "0xca58643b"; // bribeBalance(uint256)
const SEL_TREASURY = "0x61d027b3"; // treasury()
const OS_CITIZEN_SLUG = "deathandtaxes";
const OS_EVADER_SLUG = "evaders";

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

async function fetchBribeBalances(key, maxTokenId) {
  // Use Alchemy RPC (higher rate limits than LlamaRPC)
  const rpc = `https://eth-mainnet.g.alchemy.com/v2/${key}`;
  const CHUNK = 200;
  const results = {};
  const tokenIds = [];
  for (let i = 1; i <= maxTokenId; i++) tokenIds.push(i);

  for (let i = 0; i < tokenIds.length; i += CHUNK) {
    const chunk = tokenIds.slice(i, i + CHUNK);
    const body = chunk.map((id, idx) => ({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to: GAME_CONTRACT, data: SEL_BRIBE_BALANCE + pad32(id) }, "latest"],
      id: i + idx + 1,
    }));

    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (!Array.isArray(json)) continue;

      json.forEach((r, idx) => {
        const tid = String(chunk[idx]);
        if (r.result && r.result !== "0x") {
          results[tid] = parseInt(r.result, 16);
        }
      });
    } catch {
      // Skip chunk on error
    }
  }

  return results;
}

async function fetchListedTokenIds(slug, osKey) {
  if (!osKey) return new Set();
  const listed = new Set();
  let next = null;
  let pages = 0;
  try {
    do {
      const url = new URL(`https://api.opensea.io/api/v2/listings/collection/${slug}/all`);
      url.searchParams.set("limit", "100");
      if (next) url.searchParams.set("next", next);

      const res = await fetch(url.toString(), {
        headers: { "x-api-key": osKey },
      });
      if (!res.ok) break;
      const data = await res.json();
      (data.listings || []).forEach((l) => {
        const offer = l.protocol_data?.parameters?.offer?.[0];
        if (offer?.identifierOrCriteria) listed.add(offer.identifierOrCriteria);
      });
      next = data.next || null;
      pages++;
      if (pages > 50) break;
    } while (next);
  } catch {}
  return listed;
}

async function fetchTreasuryBalance(key) {
  const rpc = `https://eth-mainnet.g.alchemy.com/v2/${key}`;
  try {
    // Get treasury address from game contract
    const addrRes = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: GAME_CONTRACT, data: SEL_TREASURY }, "latest"], id: 1 }),
    });
    const addrData = await addrRes.json();
    if (!addrData.result || addrData.result === "0x") return null;
    const treasuryAddr = "0x" + addrData.result.slice(26);

    // Get ETH balance of treasury wallet
    const balRes = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [treasuryAddr, "latest"], id: 2 }),
    });
    const balData = await balRes.json();
    if (!balData.result) return null;

    const wei = BigInt(balData.result);
    // Return as number with 4 decimal precision
    return Math.round(Number(wei) / 1e14) / 1e4;
  } catch {
    return null;
  }
}

async function fetchOpenSeaStats(slug, osKey) {
  if (!osKey) return null;
  try {
    const res = await fetch(`https://api.opensea.io/api/v2/collections/${slug}/stats`, {
      headers: { "x-api-key": osKey },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
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

  const bribeHolders = []; // { id, name, class, bribes, status }

  // Build lookup of eliminated citizen IDs + their class from evader names
  const eliminatedMap = {}; // citizenId -> { class }
  evaderNfts.forEach((nft) => {
    const attrs = parseAttrs(nft);
    const cls = (attrs.class || attrs.type || "UNKNOWN").toUpperCase();
    classEliminated[cls] = (classEliminated[cls] || 0) + 1;

    const name = nft.name || nft.raw?.metadata?.name || "";
    const m = name.match(/(\d+)\s*$/);
    if (m) eliminatedMap[m[1]] = { class: cls };
  });

  // Build lookup of living citizen data from main contract
  const citizenMap = {}; // tokenId -> { name, class }
  mainNfts.forEach((nft) => {
    const attrs = parseAttrs(nft);
    const tokenId = nft.tokenId || "0";
    const cls = (attrs.class || attrs.type || "UNKNOWN").toUpperCase();
    classes[cls] = (classes[cls] || 0) + 1;

    const ins = (attrs.insured || attrs.insurance || "").toLowerCase();
    if (ins === "yes") insuredCount++;
    else uninsuredCount++;

    const name = nft.name || nft.raw?.metadata?.name || `Citizen #${tokenId}`;
    citizenMap[tokenId] = { name, class: cls };
  });

  // Count bribes from the actual on-chain data (source of truth)
  let bribedCount = 0;
  let unbribedCount = 0;
  let bribedAlive = 0;
  let bribedElimCount = 0;
  const totalCitizens = Object.keys(citizenMap).length + Object.keys(eliminatedMap).length;

  // Check every token ID that has a bribe balance
  for (const [tid, bal] of Object.entries(bribeBalances)) {
    if (bal <= 0) continue;
    bribedCount++;

    const isEliminated = !!eliminatedMap[tid];
    const citizen = citizenMap[tid];
    const evader = eliminatedMap[tid];

    if (isEliminated) {
      bribedElimCount++;
      bribeHolders.push({
        id: tid,
        name: `Citizen #${tid}`,
        class: evader?.class || "UNKNOWN",
        bribes: bal,
        status: "ELIMINATED",
      });
    } else if (citizen) {
      bribedAlive++;
      bribeHolders.push({
        id: tid,
        name: citizen.name,
        class: citizen.class,
        bribes: bal,
        status: "ALIVE",
      });
    } else {
      // Token exists in game contract but not in either NFT scrape
      bribeHolders.push({
        id: tid,
        name: `Citizen #${tid}`,
        class: "UNKNOWN",
        bribes: bal,
        status: "ALIVE",
      });
    }
  }

  unbribedCount = totalCitizens - bribedCount;

  bribeHolders.sort((a, b) => b.bribes - a.bribes || parseInt(a.id) - parseInt(b.id));
  return { classes, classEliminated, insuredCount, uninsuredCount, bribedCount, unbribedCount, bribedElimCount, bribeHolders };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.ALCHEMY_API_KEY;
  if (!key) return res.status(500).json({ error: "API key not configured" });
  const osKey = process.env.OPENSEA_API_KEY;

  // Return cached if fresh
  if (cached && Date.now() - cachedAt < TTL) {
    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=300");
    return res.status(200).json(cached);
  }

  try {
    const [mainNfts, evaderNfts, bribeBalances, citizenStats, evaderStats, citizenListings, evaderListings, treasuryBalance] = await Promise.all([
      scrapeContract(key, CONTRACT),
      scrapeContract(key, EVADER_CONTRACT),
      fetchBribeBalances(key, 6969),
      fetchOpenSeaStats(OS_CITIZEN_SLUG, osKey),
      fetchOpenSeaStats(OS_EVADER_SLUG, osKey),
      fetchListedTokenIds(OS_CITIZEN_SLUG, osKey),
      fetchListedTokenIds(OS_EVADER_SLUG, osKey),
      fetchTreasuryBalance(key),
    ]);

    const result = aggregate(mainNfts, evaderNfts, bribeBalances);
    result.citizenFloor = citizenStats?.total?.floor_price ?? null;
    result.evaderFloor = evaderStats?.total?.floor_price ?? null;
    result.citizenOwners = citizenStats?.total?.num_owners ?? null;
    result.evaderOwners = evaderStats?.total?.num_owners ?? null;
    result.treasuryBalance = treasuryBalance;

    // Tag bribe holders with listing status
    result.bribeHolders.forEach((h) => {
      h.listed = h.status === "ELIMINATED"
        ? evaderListings.has(h.id)
        : citizenListings.has(h.id);
    });
    cached = result;
    cachedAt = Date.now();

    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=300");
    return res.status(200).json(result);
  } catch (e) {
    return res.status(502).json({ error: "Census scrape failed", detail: e.message });
  }
}

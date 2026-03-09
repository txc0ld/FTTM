const OS_CITIZEN_SLUG = "deathandtaxes";
const OS_EVADER_SLUG = "evaders";

async function fetchOSNfts(wallet, slug, osKey) {
  const nfts = [];
  let next = null;
  let pages = 0;
  do {
    const url = new URL(`https://api.opensea.io/api/v2/chain/ethereum/account/${wallet}/nfts`);
    url.searchParams.set("collection", slug);
    url.searchParams.set("limit", "200");
    if (next) url.searchParams.set("next", next);

    const res = await fetch(url.toString(), {
      headers: { "x-api-key": osKey },
    });
    if (!res.ok) break;
    const data = await res.json();
    if (data.nfts) nfts.push(...data.nfts);
    next = data.next || null;
    pages++;
    if (pages > 10) break;
  } while (next);
  return nfts;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const osKey = process.env.OPENSEA_API_KEY;
  if (!osKey) return res.status(500).json({ error: "OpenSea API key not configured" });

  const wallet = req.query.wallet;
  if (!wallet) return res.status(400).json({ error: "wallet parameter required" });

  try {
    const [citizens, evaders] = await Promise.all([
      fetchOSNfts(wallet, OS_CITIZEN_SLUG, osKey),
      fetchOSNfts(wallet, OS_EVADER_SLUG, osKey),
    ]);

    const result = [
      ...citizens.map((n) => ({
        id: n.identifier,
        name: n.name || `Citizen #${n.identifier}`,
        image: n.display_image_url || n.image_url || "",
        isEvader: false,
      })),
      ...evaders.map((n) => ({
        id: n.identifier,
        name: n.name || `Evader #${n.identifier}`,
        image: n.display_image_url || n.image_url || "",
        isEvader: true,
      })),
    ];

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json(result);
  } catch (e) {
    return res.status(502).json({ error: "Fetch failed", detail: e.message });
  }
}

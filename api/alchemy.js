const ALLOWED = [
  "getNFTsForOwner",
  "getNFTMetadata",
  "getNFTsForContract",
  "getContractMetadata",
  "getOwnersForNFT",
  "getOwnersForContract",
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.ALCHEMY_API_KEY;
  if (!key) return res.status(500).json({ error: "API key not configured" });

  // Extract endpoint from query, forward remaining params
  const rawQuery = (req.url.split("?")[1]) || "";
  const params = new URLSearchParams(rawQuery);
  const endpoint = params.get("endpoint");
  if (!endpoint || !ALLOWED.includes(endpoint)) {
    return res.status(400).json({ error: "Invalid or missing endpoint" });
  }
  params.delete("endpoint");

  const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${key}/${endpoint}?${params.toString()}`;

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();
    // Cache immutable metadata for 5min
    if (upstream.ok) {
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
    }
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: "Upstream request failed", detail: e.message });
  }
}

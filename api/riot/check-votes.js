import { neon } from "@neondatabase/serverless";

function getEpoch() {
  const msPerDay = 1000 * 60 * 60 * 24;
  const offset19H = 19 * 60 * 60 * 1000;
  return Math.floor((Date.now() - offset19H) / msPerDay);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const wallet = (req.query.wallet || "").toLowerCase();
    if (!wallet) return res.status(400).json({ error: "Missing wallet" });

    const epoch = getEpoch();
    const sql = neon(process.env.DATABASE_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS riot_vote_limits (
        wallet TEXT NOT NULL,
        epoch INTEGER NOT NULL,
        main_voted BOOLEAN NOT NULL DEFAULT FALSE,
        street_votes INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (wallet, epoch)
      )
    `;

    const rows = await sql`
      SELECT main_voted, street_votes FROM riot_vote_limits
      WHERE wallet = ${wallet} AND epoch = ${epoch}
    `;

    const data = rows.length > 0
      ? { mainVoted: rows[0].main_voted, streetVotes: rows[0].street_votes }
      : { mainVoted: false, streetVotes: 0 };

    return res.status(200).json({ ...data, epoch });
  } catch (e) {
    console.error("Check votes error:", e);
    return res.status(500).json({ error: "Failed to check votes" });
  }
}

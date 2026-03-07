import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const sql = neon(process.env.DATABASE_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS riot_votes (
        id SERIAL PRIMARY KEY,
        winner_key TEXT NOT NULL,
        winner_image TEXT DEFAULT '',
        loser_key TEXT NOT NULL,
        loser_image TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const rows = await sql`
      SELECT id, winner_key, winner_image, loser_key, loser_image, created_at
      FROM riot_votes
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return res.status(200).json({ votes: rows });
  } catch (e) {
    console.error("History error:", e);
    return res.status(500).json({ error: "Failed to fetch history" });
  }
}

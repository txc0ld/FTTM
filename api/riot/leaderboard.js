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
      CREATE TABLE IF NOT EXISTS riot_fighters (
        fighter_key TEXT PRIMARY KEY,
        token_id TEXT NOT NULL,
        is_evader BOOLEAN NOT NULL DEFAULT FALSE,
        image TEXT DEFAULT '',
        class TEXT DEFAULT '',
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const rows = await sql`
      SELECT fighter_key, token_id, is_evader, image, class, wins, losses
      FROM riot_fighters
      ORDER BY (wins - losses) DESC, wins DESC
      LIMIT 100
    `;

    return res.status(200).json({ fighters: rows });
  } catch (e) {
    console.error("Leaderboard error:", e);
    return res.status(500).json({ error: "Failed to fetch leaderboard", detail: e.message });
  }
}

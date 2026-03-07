import { neon } from "@neondatabase/serverless";
import { verifyMessage } from "ethers";

function getEpoch() {
  const msPerDay = 1000 * 60 * 60 * 24;
  const offset19H = 19 * 60 * 60 * 1000;
  return Math.floor((Date.now() - offset19H) / msPerDay);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { winner, loser, wallet, signature } = req.body;
    if (!winner || !loser || !winner.id || !loser.id) {
      return res.status(400).json({ error: "Missing winner/loser data" });
    }
    if (!wallet || !signature) {
      return res.status(400).json({ error: "Wallet signature required" });
    }

    const epoch = getEpoch();
    const walletLower = wallet.toLowerCase();

    // Verify session signature (signed once on wallet connect)
    const message = `RIOT CLUB SESSION\nEpoch: ${epoch}`;
    let recovered;
    try {
      recovered = verifyMessage(message, signature).toLowerCase();
    } catch {
      return res.status(401).json({ error: "Invalid signature" });
    }
    if (recovered !== walletLower) {
      return res.status(401).json({ error: "Signature mismatch" });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Ensure tables exist
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

    await sql`ALTER TABLE riot_votes ADD COLUMN IF NOT EXISTS wallet TEXT DEFAULT ''`;
    await sql`ALTER TABLE riot_fighters ADD COLUMN IF NOT EXISTS class TEXT DEFAULT ''`;
    await sql`ALTER TABLE riot_fighters ADD COLUMN IF NOT EXISTS image TEXT DEFAULT ''`;

    await sql`
      CREATE TABLE IF NOT EXISTS riot_vote_limits (
        wallet TEXT NOT NULL,
        epoch INTEGER NOT NULL,
        main_voted BOOLEAN NOT NULL DEFAULT FALSE,
        street_votes INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (wallet, epoch)
      )
    `;

    // Check current vote limits
    const rows = await sql`
      SELECT main_voted, street_votes FROM riot_vote_limits
      WHERE wallet = ${walletLower} AND epoch = ${epoch}
    `;

    const current = rows.length > 0
      ? { main_voted: rows[0].main_voted, street_votes: rows[0].street_votes }
      : { main_voted: false, street_votes: 0 };

    if (current.main_voted && current.street_votes >= 10) {
      return res.status(429).json({
        error: "All votes exhausted for today",
        mainVoted: true,
        streetVotes: 10,
      });
    }

    // Record the vote
    const winnerKey = `${winner.isEvader ? "e" : "c"}_${winner.id}`;
    const loserKey = `${loser.isEvader ? "e" : "c"}_${loser.id}`;

    await sql`
      INSERT INTO riot_fighters (fighter_key, token_id, is_evader, image, class, wins, losses, updated_at)
      VALUES (${winnerKey}, ${winner.id}, ${!!winner.isEvader}, ${winner.image || ''}, ${winner.class || ''}, 1, 0, NOW())
      ON CONFLICT (fighter_key) DO UPDATE SET
        wins = riot_fighters.wins + 1,
        image = COALESCE(NULLIF(${winner.image || ''}, ''), riot_fighters.image),
        class = COALESCE(NULLIF(${winner.class || ''}, ''), riot_fighters.class),
        updated_at = NOW()
    `;

    await sql`
      INSERT INTO riot_fighters (fighter_key, token_id, is_evader, image, class, wins, losses, updated_at)
      VALUES (${loserKey}, ${loser.id}, ${!!loser.isEvader}, ${loser.image || ''}, ${loser.class || ''}, 0, 1, NOW())
      ON CONFLICT (fighter_key) DO UPDATE SET
        losses = riot_fighters.losses + 1,
        image = COALESCE(NULLIF(${loser.image || ''}, ''), riot_fighters.image),
        class = COALESCE(NULLIF(${loser.class || ''}, ''), riot_fighters.class),
        updated_at = NOW()
    `;

    await sql`
      INSERT INTO riot_votes (winner_key, winner_image, loser_key, loser_image, wallet, created_at)
      VALUES (${winnerKey}, ${winner.image || ''}, ${loserKey}, ${loser.image || ''}, ${walletLower}, NOW())
    `;

    // Update vote limits
    let newMainVoted, newStreetVotes;
    if (!current.main_voted) {
      newMainVoted = true;
      newStreetVotes = 0;
      await sql`
        INSERT INTO riot_vote_limits (wallet, epoch, main_voted, street_votes)
        VALUES (${walletLower}, ${epoch}, TRUE, 0)
        ON CONFLICT (wallet, epoch) DO UPDATE SET main_voted = TRUE
      `;
    } else {
      newMainVoted = true;
      newStreetVotes = current.street_votes + 1;
      await sql`
        INSERT INTO riot_vote_limits (wallet, epoch, main_voted, street_votes)
        VALUES (${walletLower}, ${epoch}, TRUE, ${newStreetVotes})
        ON CONFLICT (wallet, epoch) DO UPDATE SET street_votes = ${newStreetVotes}
      `;
    }

    return res.status(200).json({
      ok: true,
      mainVoted: newMainVoted,
      streetVotes: newStreetVotes,
    });
  } catch (e) {
    console.error("Vote error:", e);
    return res.status(500).json({ error: "Failed to record vote", detail: e.message });
  }
}

import { getPool } from "@/lib/rag/db";
import { embedEnabled } from "@/lib/rag/embed";

export const runtime = "nodejs";

/** One pooled connection and one `SELECT 1`, the query bounded to 1 s. Never throws. */
async function dbAlive(): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  const client = await pool.connect().catch(() => null);
  if (!client) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, fail) => {
      timer = setTimeout(() => fail(new Error("health probe timed out")), 1000);
    });
    await Promise.race([client.query("SELECT 1"), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    client.release();
  }
}

/** The service answers 200 even when the database is unreachable, so a keep-alive ping is never silenced. */
export async function GET() {
  const db = await dbAlive();
  return Response.json({ ok: true, db, embed: embedEnabled() ? "local" : "off" }, { headers: { "Cache-Control": "no-store" } });
}

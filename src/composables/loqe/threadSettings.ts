export const MAX_THREADS = 32;
export const DEFAULT_THREADS = 8;

export function normalizeThreadCount(value: unknown, limit = MAX_THREADS): number {
  const count = Number(value);
  return Math.min(Number.isInteger(count) && count >= 1 ? count : DEFAULT_THREADS, limit);
}

/** Apply a database-wide setting before starting the next query. */
export async function applyThreadSetting(
  connection: { query(sql: string): Promise<unknown> },
  requested: unknown,
  limit: number,
): Promise<number> {
  const threads = normalizeThreadCount(requested, limit);
  await connection.query(`SET threads = ${threads}`);
  return threads;
}

import { describe, expect, it, vi } from 'vitest';
import { applyThreadSetting, normalizeThreadCount } from './threadSettings';

describe('DuckDB thread settings', () => {
  it.each([0, -1, 2.5, NaN, Infinity, '8; DROP TABLE x'])('defaults invalid value %s', (value) => {
    expect(normalizeThreadCount(value)).toBe(8);
  });

  it('respects the runtime capacity and single-threaded fallback', () => {
    expect(normalizeThreadCount(64, 32)).toBe(32);
    expect(normalizeThreadCount(8, 1)).toBe(1);
    expect(normalizeThreadCount('16', 32)).toBe(16);
  });

  it('reapplies the preference after SQL changes the database setting', async () => {
    let databaseThreads = 8;
    const query = vi.fn(async (sql: string) => {
      databaseThreads = Number(sql.split(' = ')[1]);
    });
    expect(await applyThreadSetting({ query }, 16, 32)).toBe(16);
    expect(query).toHaveBeenCalledExactlyOnceWith('SET threads = 16');
    databaseThreads = 4;
    await applyThreadSetting({ query }, 16, 32);
    expect(databaseThreads).toBe(16);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('does not raise the single-threaded runtime setting', async () => {
    const query = vi.fn();
    expect(await applyThreadSetting({ query }, 32, 1)).toBe(1);
    expect(query).toHaveBeenCalledExactlyOnceWith('SET threads = 1');
  });

  it('reports a rejected runtime change', async () => {
    const query = vi.fn().mockRejectedValue(new Error('Query interrupted'));
    await expect(applyThreadSetting({ query }, 16, 32)).rejects.toThrow('Query interrupted');
  });
});

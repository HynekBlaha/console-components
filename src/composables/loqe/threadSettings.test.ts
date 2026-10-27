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

  it('applies a changed setting to the existing connection', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    expect(await applyThreadSetting({ query }, 16, 32, 8)).toBe(16);
    expect(query).toHaveBeenCalledExactlyOnceWith('SET threads = 16');
    await applyThreadSetting({ query }, 16, 32, 16);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does not raise the single-threaded runtime setting', async () => {
    const query = vi.fn();
    expect(await applyThreadSetting({ query }, 32, 1, 1)).toBe(1);
    expect(query).not.toHaveBeenCalled();
  });

  it('reports a rejected runtime change', async () => {
    const query = vi.fn().mockRejectedValue(new Error('Query interrupted'));
    await expect(applyThreadSetting({ query }, 16, 32, 8)).rejects.toThrow('Query interrupted');
  });
});

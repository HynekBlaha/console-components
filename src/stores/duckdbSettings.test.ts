import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createPersistedStatePlugin } from 'pinia-plugin-persistedstate-2';
import { useDuckDBSettingsStore } from './duckdbSettings';

const savedSettings = new Map<string, string>();
const storage = {
  getItem: (key: string) => savedSettings.get(key) ?? null,
  setItem: (key: string, value: string) => {
    savedSettings.set(key, value);
  },
  removeItem: (key: string) => {
    savedSettings.delete(key);
  },
};

function setupStore() {
  const pinia = createPinia();
  pinia.use(createPersistedStatePlugin({ storage }));
  createApp({}).use(pinia);
  setActivePinia(pinia);
  return useDuckDBSettingsStore();
}

describe('thread preferences', () => {
  beforeEach(() => savedSettings.clear());

  it('resets the preference to eight threads', () => {
    const store = setupStore();
    store.threads = 16;
    store.resetToDefaults();
    expect(store.threads).toBe(8);
    expect(store.settings.threads).toBe(8);
  });

  it('persists the preference without persisting the runtime capability', async () => {
    const store = setupStore();
    store.threads = 16;
    store.threadLimit = 32;
    await nextTick();
    const saved = JSON.parse(savedSettings.get('duckdbSettings')!);
    expect(saved.threads).toBe(16);
    expect(saved).not.toHaveProperty('threadLimit');
    const restored = setupStore();
    expect(restored.threads).toBe(16);
    expect(restored.threadLimit).toBe(1);
  });
});

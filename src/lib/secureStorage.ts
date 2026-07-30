import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Supabase session storage backed by the iOS Keychain / Android Keystore.
 *
 * SecureStore rejects (iOS) or warns about values beyond ~2KB, and a Supabase
 * session — access token, refresh token, and the user object — routinely
 * exceeds that. This adapter transparently splits values across numbered
 * chunks: `key` holds the chunk count, `key.0…key.n-1` hold the slices.
 *
 * Writing fewer chunks than last time must clear the leftovers, otherwise a
 * later read would splice stale ciphertext onto a fresh session.
 */
const CHUNK_SIZE = 1536;

const chunkKey = (key: string, index: number) => `${key}.${index}`;

/** Web has no Keychain; fall back to localStorage so `expo start --web` runs. */
const isWeb = Platform.OS === 'web';

const webStorage = {
  getItem: (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
  removeItem: (key: string) => globalThis.localStorage?.removeItem(key),
};

async function readChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(key);
  if (raw === null) return 0;
  const count = Number.parseInt(raw, 10);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

async function clearChunks(key: string, from: number, to: number): Promise<void> {
  const deletions: Promise<void>[] = [];
  for (let i = from; i < to; i += 1) {
    deletions.push(SecureStore.deleteItemAsync(chunkKey(key, i)));
  }
  await Promise.all(deletions);
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) return webStorage.getItem(key);

    const count = await readChunkCount(key);
    if (count === 0) return null;

    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );

    // A missing chunk means the record is torn (interrupted write, partial
    // wipe). Treat it as absent so the user is asked to sign in again rather
    // than handing Supabase a corrupt session.
    if (parts.some((part) => part === null)) {
      await this.removeItem(key);
      return null;
    }

    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      webStorage.setItem(key, value);
      return;
    }

    const previousCount = await readChunkCount(key);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    // An empty string still needs one chunk so the count marker stays truthful.
    if (chunks.length === 0) chunks.push('');

    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)),
    );
    await SecureStore.setItemAsync(key, String(chunks.length));

    if (previousCount > chunks.length) {
      await clearChunks(key, chunks.length, previousCount);
    }
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      webStorage.removeItem(key);
      return;
    }

    const count = await readChunkCount(key);
    await clearChunks(key, 0, count);
    await SecureStore.deleteItemAsync(key);
  },
};

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Supabase auth tokens move from plaintext AsyncStorage into the OS keychain /
// keystore via expo-secure-store (BRU-37). SecureStore values are capped at
// ~2KB, and a Supabase session (with provider tokens) can exceed that, so we
// chunk the value across multiple SecureStore entries.
const CHUNK_SIZE = 1800; // headroom under the ~2048-byte SecureStore limit

const chunkKey = (key: string, i: number) => `${key}.c${i}`;
const countKey = (key: string) => `${key}.cn`;

async function removeChunked(key: string): Promise<void> {
  const cnt = await SecureStore.getItemAsync(countKey(key));
  if (cnt == null) return;
  const n = parseInt(cnt, 10) || 0;
  for (let i = 0; i < n; i++) {
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
  await SecureStore.deleteItemAsync(countKey(key));
}

async function setChunked(key: string, value: string): Promise<void> {
  await removeChunked(key);
  const n = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
  for (let i = 0; i < n; i++) {
    await SecureStore.setItemAsync(
      chunkKey(key, i),
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    );
  }
  await SecureStore.setItemAsync(countKey(key), String(n));
}

async function getChunked(key: string): Promise<string | null> {
  const cnt = await SecureStore.getItemAsync(countKey(key));
  if (cnt == null) return null;
  const n = parseInt(cnt, 10) || 0;
  let out = "";
  for (let i = 0; i < n; i++) {
    const part = await SecureStore.getItemAsync(chunkKey(key, i));
    if (part == null) return null; // corrupt/partial → treat as missing
    out += part;
  }
  return out;
}

/**
 * Supabase auth storage backed by the secure keychain. Implements the
 * getItem/setItem/removeItem interface Supabase expects. The first read of a
 * key with no SecureStore value transparently migrates any existing token out
 * of AsyncStorage (so an app update doesn't log everyone out) and wipes the
 * plaintext copy.
 */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const secure = await getChunked(key);
    if (secure != null) return secure;
    const legacy = await AsyncStorage.getItem(key);
    if (legacy != null) {
      try {
        await setChunked(key, legacy);
        await AsyncStorage.removeItem(key);
      } catch {
        // If the migration write fails, keep the legacy value usable.
      }
      return legacy;
    }
    return null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await setChunked(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await removeChunked(key);
    await AsyncStorage.removeItem(key).catch(() => {});
  },
};

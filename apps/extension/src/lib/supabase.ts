import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ACCESS_TOKEN_KEY = "contextlines.access_token";
const AUTH_STORAGE_KEY = "contextlines.supabase.auth";

let client: SupabaseClient | null = null;

const chromeSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const result = await chrome.storage.session.get(key);
    const value = result[key];
    return typeof value === "string" ? value : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.session.set({ [key]: value });
  },
  async removeItem(key: string): Promise<void> {
    await chrome.storage.session.remove(key);
  },
};

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.WXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.WXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (
    !url ||
    !anonKey ||
    url.includes("example.supabase.co") ||
    anonKey.startsWith("replace-with")
  ) {
    throw new Error("Supabase 公共配置尚未设置。");
  }

  client = createClient(url, anonKey, {
    auth: {
      flowType: "pkce",
      storage: chromeSessionStorage,
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export async function clearAuthSessionStorage(): Promise<void> {
  await chrome.storage.session.remove([AUTH_STORAGE_KEY, ACCESS_TOKEN_KEY]);
}

export async function syncWorkerAccessToken(
  accessToken: string | null,
): Promise<void> {
  if (accessToken) {
    await chrome.storage.session.set({ [ACCESS_TOKEN_KEY]: accessToken });
  } else {
    await chrome.storage.session.remove(ACCESS_TOKEN_KEY);
  }
}

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import {
  clearAuthSessionStorage,
  getSupabaseClient,
  syncWorkerAccessToken,
} from "./supabase";

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthPhase =
  "loading" | "signed-out" | "signing-in" | "signed-in" | "error";

export interface AuthState {
  phase: AuthPhase;
  user: AuthUser | null;
  error: string | null;
}

type AuthListener = (state: AuthState) => void;

const MOCK_USER: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "learner@example.com",
};

function userFromSession(session: Session | null): AuthUser | null {
  const email = session?.user.email;
  return session && email ? { id: session.user.id, email } : null;
}

export function isAllowedAuthEmail(
  email: string,
  allowedEmail: string | null | undefined,
): boolean {
  const normalizedAllowed = allowedEmail?.trim().toLocaleLowerCase("en-US");
  return Boolean(
    normalizedAllowed &&
    email.trim().toLocaleLowerCase("en-US") === normalizedAllowed,
  );
}

function launchGoogleFlow(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url, interactive: true },
      (redirectUrl) => {
        const lastError = chrome.runtime.lastError;
        if (lastError || !redirectUrl) {
          reject(
            new Error(lastError?.message ?? "Google 登录没有返回回调地址。"),
          );
          return;
        }
        resolve(redirectUrl);
      },
    );
  });
}

export class AuthController {
  readonly #listeners = new Set<AuthListener>();
  readonly #allowedEmail: string | null;
  #state: AuthState;
  #unsubscribe: (() => void) | null = null;
  #operation = 0;

  constructor(
    private readonly useMocks: boolean,
    allowedEmail = import.meta.env.WXT_PUBLIC_ALLOWED_EMAIL,
  ) {
    this.#allowedEmail =
      allowedEmail?.trim().toLocaleLowerCase("en-US") || null;
    this.#state = useMocks
      ? { phase: "signed-in", user: MOCK_USER, error: null }
      : { phase: "loading", user: null, error: null };
  }

  get state(): AuthState {
    return this.#state;
  }

  subscribe(listener: AuthListener): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async initialize(): Promise<void> {
    if (this.useMocks || this.#unsubscribe) return;
    const operation = ++this.#operation;
    try {
      const auth = getSupabaseClient().auth;
      const { data, error } = await auth.getSession();
      if (error) throw error;
      if (operation !== this.#operation) return;
      await this.#acceptSession(data.session);
      const subscription = auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          void this.#acceptSession(session);
        },
      );
      this.#unsubscribe = () => subscription.data.subscription.unsubscribe();
    } catch (error) {
      if (operation !== this.#operation) return;
      await syncWorkerAccessToken(null).catch(() => undefined);
      this.#setState({
        phase: "error",
        user: null,
        error: error instanceof Error ? error.message : "登录初始化失败。",
      });
    }
  }

  async signIn(): Promise<void> {
    if (this.useMocks) return;
    const operation = ++this.#operation;
    this.#setState({ phase: "signing-in", user: null, error: null });
    try {
      const client = getSupabaseClient();
      const redirectTo = chrome.identity.getRedirectURL("auth-callback");
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error("Supabase 没有返回 Google 登录地址。");

      const redirectUrl = new URL(await launchGoogleFlow(data.url));
      const oauthError =
        redirectUrl.searchParams.get("error_description") ??
        redirectUrl.searchParams.get("error");
      if (oauthError) throw new Error(oauthError);

      const code = redirectUrl.searchParams.get("code");
      if (code) {
        const exchanged = await client.auth.exchangeCodeForSession(code);
        if (exchanged.error) throw exchanged.error;
      } else {
        const fragment = new URLSearchParams(redirectUrl.hash.slice(1));
        const accessToken = fragment.get("access_token");
        const refreshToken = fragment.get("refresh_token");
        if (!accessToken || !refreshToken) {
          throw new Error("Google 登录回调缺少会话信息。");
        }
        const session = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (session.error) throw session.error;
      }

      if (operation !== this.#operation) return;
      const session = await client.auth.getSession();
      if (session.error) throw session.error;
      await this.#acceptSession(session.data.session);
    } catch (error) {
      if (operation !== this.#operation) return;
      await syncWorkerAccessToken(null).catch(() => undefined);
      this.#setState({
        phase: "error",
        user: null,
        error: error instanceof Error ? error.message : "Google 登录失败。",
      });
    }
  }

  async signOut(): Promise<void> {
    ++this.#operation;
    this.#setState({ phase: "signed-out", user: null, error: null });
    if (!this.useMocks) {
      await clearAuthSessionStorage().catch(() => undefined);
      await getSupabaseClient()
        .auth.signOut({ scope: "local" })
        .catch(() => undefined);
    }
  }

  dispose(): void {
    ++this.#operation;
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  async #acceptSession(session: Session | null): Promise<void> {
    const user = userFromSession(session);
    if (user && !this.#allowedEmail) {
      await clearAuthSessionStorage().catch(() => undefined);
      this.#setState({
        phase: "error",
        user: null,
        error: "允许邮箱尚未配置。",
      });
      return;
    }
    if (user && !isAllowedAuthEmail(user.email, this.#allowedEmail)) {
      await clearAuthSessionStorage().catch(() => undefined);
      this.#setState({
        phase: "error",
        user: null,
        error: "此 Google 邮箱不在 ContextLines 允许列表中。",
      });
      return;
    }
    await syncWorkerAccessToken(session?.access_token ?? null);
    this.#setState({
      phase: user ? "signed-in" : "signed-out",
      user,
      error: null,
    });
  }

  #setState(state: AuthState): void {
    this.#state = state;
    for (const listener of this.#listeners) listener(state);
  }
}

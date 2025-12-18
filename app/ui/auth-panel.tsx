"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AUTH_STATE_CHANGED_EVENT } from "./auth-events";

type ProviderMetadata = {
  id: string;
  name: string;
  kind: "credentials" | "oauth";
};

type AuthUser = {
  id: string;
  providerId: string;
  providerUserId: string;
  email?: string;
  name?: string;
  createdAt: string;
};

type ApiError = {
  error: string;
  code: string;
};

const SESSION_ENDPOINT = "/api/auth/session";
const REGISTER_ENDPOINT = "/api/auth/register";
const LOGIN_ENDPOINT = "/api/auth/login";
const LOGOUT_ENDPOINT = "/api/auth/logout";
const PROVIDERS_ENDPOINT = "/api/auth/providers";

const PLANNED_OAUTH = [
  { id: "google", label: "Google" },
  { id: "vk", label: "VK" },
  { id: "yandex", label: "Яндекс" },
];

const DEFAULT_PROVIDERS: ProviderMetadata[] = [
  { id: "email", name: "Email и пароль", kind: "credentials" },
];

type AuthPanelMode = "register" | "login" | "both";

type AuthPanelProps = {
  mode?: AuthPanelMode;
};

type StatusMessage =
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export default function AuthPanel({ mode = "both" }: AuthPanelProps) {
  const [providers, setProviders] =
    useState<ProviderMetadata[]>(DEFAULT_PROVIDERS);
  const [selectedProvider, setSelectedProvider] = useState(
    DEFAULT_PROVIDERS[0].id,
  );

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [registerStatus, setRegisterStatus] = useState<StatusMessage>();
  const [loginStatus, setLoginStatus] = useState<StatusMessage>();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      setIsLoadingSession(true);
      try {
        const [sessionRes, providerRes] = await Promise.all([
          fetch(SESSION_ENDPOINT, { cache: "no-store" }),
          fetch(PROVIDERS_ENDPOINT, { cache: "no-store" }),
        ]);

        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          setCurrentUser(sessionData.user);
        }

        if (providerRes.ok) {
          const providerData = await providerRes.json();
          const fetched = providerData.providers ?? [];
          setProviders(fetched.length ? fetched : DEFAULT_PROVIDERS);
          const emailProvider = fetched.find(
            (provider: ProviderMetadata) => provider.id === "email",
          );
          if (emailProvider) {
            setSelectedProvider(emailProvider.id);
          }
        } else {
          setProviders(DEFAULT_PROVIDERS);
        }
      } catch (error) {
        console.error(error);
        setProviders(DEFAULT_PROVIDERS);
      } finally {
        setIsLoadingSession(false);
      }
    }

    bootstrap();
  }, []);

  const currentProviderMetadata = useMemo(
    () => providers.find((provider) => provider.id === selectedProvider),
    [providers, selectedProvider],
  );

  const isProviderSupported =
    currentProviderMetadata?.id === "email" &&
    currentProviderMetadata.kind === "credentials";

  function resolveErrorMessage(data: ApiError | undefined, fallback: string) {
    if (!data) {
      return fallback;
    }
    return data.error ?? fallback;
  }

  function emitAuthStateChanged() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
    }
  }

  async function handleAuthRequest(
    endpoint: string,
    payload: Record<string, unknown>,
  ) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw data as ApiError;
    }
    setCurrentUser(data.user);
    emitAuthStateChanged();
    return data;
  }

  async function onRegister(event: FormEvent) {
    event.preventDefault();
    setRegisterStatus(undefined);
    setIsRegistering(true);
    try {
      const trimmedName = registerName.trim();
      await handleAuthRequest(REGISTER_ENDPOINT, {
        providerId: selectedProvider,
        profile: { name: trimmedName },
        credentials: { email: registerEmail, password: registerPassword },
      });
      setRegisterStatus({
        type: "success",
        message: "Готово! Вы вошли как новый пользователь.",
      });
      setLoginEmail(registerEmail);
      setRegisterPassword("");
    } catch (error) {
      setRegisterStatus({
        type: "error",
        message: resolveErrorMessage(
          error as ApiError | undefined,
          "Не удалось зарегистрироваться",
        ),
      });
    } finally {
      setIsRegistering(false);
    }
  }

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setLoginStatus(undefined);
    setIsLoggingIn(true);
    try {
      await handleAuthRequest(LOGIN_ENDPOINT, {
        providerId: selectedProvider,
        credentials: { email: loginEmail, password: loginPassword },
      });
      setLoginStatus({
        type: "success",
        message: "Добро пожаловать обратно!",
      });
      setLoginPassword("");
    } catch (error) {
      setLoginStatus({
        type: "error",
        message: resolveErrorMessage(
          error as ApiError | undefined,
          "Не удалось войти",
        ),
      });
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function onLogout() {
    setIsLoggingOut(true);
    try {
      await fetch(LOGOUT_ENDPOINT, { method: "POST" });
      setCurrentUser(null);
      emitAuthStateChanged();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoggingOut(false);
    }
  }

  const showRegister = mode === "register" || mode === "both";
  const showLogin = mode === "login" || mode === "both";
  const formGridClass =
    showRegister && showLogin ? "md:grid-cols-2" : "md:grid-cols-1";

  const title =
    mode === "register"
      ? "Регистрация"
      : mode === "login"
        ? "Вход"
        : "Регистрация и вход";
  const description =
    mode === "register"
      ? "Создайте новый аккаунт через выбранный провайдер."
      : mode === "login"
        ? "Войдите в аккаунт через выбранный провайдер."
        : "Построено вокруг концепции провайдеров. Сегодня работает вход по почте/паролю, остальные варианты легко подключаются.";

  return (
    <section className="w-full rounded-3xl border border-zinc-200 bg-white p-10 text-left shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <header className="mb-8 space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-300">
          Аутентификация
        </p>
        <h2 className="text-3xl font-semibold text-zinc-900 dark:text-white">
          {title}
        </h2>
        <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      </header>

      <div className="mb-8 rounded-2xl bg-zinc-50 p-6 dark:bg-zinc-800">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-300">
          Текущий пользователь
        </p>
        {isLoadingSession ? (
          <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-200">
            Загружаем…
          </p>
        ) : currentUser ? (
          <div className="mt-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <p>
              <span className="text-zinc-400">ID:</span> {currentUser.id}
            </p>
            <p>
              <span className="text-zinc-400">Email:</span>{" "}
              {currentUser.email ?? "—"}
            </p>
            <p>
              <span className="text-zinc-400">Имя:</span>{" "}
              {currentUser.name ?? "—"}
            </p>
            <p>
              <span className="text-zinc-400">Провайдер:</span>{" "}
              {currentUser.providerId}
            </p>
            <p>
              <span className="text-zinc-400">Создан:</span>{" "}
              {new Date(currentUser.createdAt).toLocaleString("ru-RU")}
            </p>
            <button
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              className="mt-4 inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-zinc-400 dark:hover:text-white"
            >
              {isLoggingOut ? "Выходим…" : "Выйти"}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-200">
            Не авторизован
          </p>
        )}
      </div>

      <div className="mb-6">
        <label
          htmlFor="provider"
          className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400"
        >
          Провайдер
        </label>
        <select
          id="provider"
          value={selectedProvider}
          onChange={(event) => setSelectedProvider(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
              {provider.kind === "oauth" ? " (OAuth)" : ""}
            </option>
          ))}
        </select>
        {!isProviderSupported && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Провайдер выбран, но пока не подключен. Добавим, когда появится
            реальный OAuth-флоу.
          </p>
        )}
      </div>

      {isProviderSupported ? (
        <div className={`grid gap-8 ${formGridClass}`}>
          {showRegister && (
            <form onSubmit={onRegister} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-300">
                Регистрация
              </h3>
              <input
                type="text"
                placeholder="Имя / никнейм"
                value={registerName}
                onChange={(event) => setRegisterName(event.target.value)}
                required
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-зinc-500 dark:border-зinc-700 dark:bg-зинк-900 dark:text-white"
              />
              <input
                type="email"
                placeholder="Email"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                required
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
              <input
                type="password"
                placeholder="Пароль"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                required
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={isRegistering}
                className="w-full rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
              >
                {isRegistering ? "Создаём…" : "Зарегистрироваться"}
              </button>
              {registerStatus && (
                <p
                  className={`text-xs ${
                    registerStatus.type === "success"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-500 dark:text-red-400"
                  }`}
                >
                  {registerStatus.message}
                </p>
              )}
            </form>
          )}

          {showLogin && (
            <form onSubmit={onLogin} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-300">
                Вход
              </h3>
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                required
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
              <input
                type="password"
                placeholder="Пароль"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                required
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full rounded-full border border-zinc-200 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-zinc-900 transition hover:border-zinc-400 hover:text-black disabled:opacity-50 dark:border-zinc-600 dark:text-white dark:hover:border-zinc-400"
              >
                {isLoggingIn ? "Входим…" : "Войти"}
              </button>
              {loginStatus && (
                <p
                  className={`text-xs ${
                    loginStatus.type === "success"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-500 dark:text-red-400"
                  }`}
                >
                  {loginStatus.message}
                </p>
              )}
            </form>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Этот провайдер пока в плане. Архитектура API уже поддерживает
          регистрацию и вход через внешние сервисы, так что останется подключить
          OAuth-флоу.
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-700">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
          В планах
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          OAuth-провайдеры включатся без изменений в UI — останется только
          добавить кнопки авторизации.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {PLANNED_OAUTH.map((provider) => (
            <button
              key={provider.id}
              type="button"
              disabled
              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
            >
              {provider.label} · скоро
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AUTH_STATE_CHANGED_EVENT } from "./auth-events";

type AuthUser = {
  id: string;
  email?: string;
  name?: string;
};

const SESSION_ENDPOINT = "/api/auth/session";
const LOGOUT_ENDPOINT = "/api/auth/logout";

const NAV_LINKS = [
  { href: "/register", label: "Регистрация" },
  { href: "/login", label: "Вход" },
];

export default function NavigationBar() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  const fetchSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(SESSION_ENDPOINT, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error(error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();

    function handleAuthChange() {
      fetchSession();
    }

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthChange);
    };
  }, [fetchSession]);

  async function logout() {
    try {
      await fetch(LOGOUT_ENDPOINT, { method: "POST" });
      setUser(null);
      window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <header className="w-full border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4 text-sm">
        <Link
          href="/"
          className="text-base font-semibold uppercase tracking-[0.4em] text-zinc-900 dark:text-white"
        >
          Combiner
        </Link>
        <nav className="flex items-center gap-4">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-xs font-semibold uppercase tracking-[0.3em] transition ${
                  isActive
                    ? "text-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          {isLoading ? (
            "Проверяем сессию…"
          ) : user ? (
            <div className="flex items-center gap-2">
              <span>{user.name}</span>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-zinc-200 p-1 text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-400 dark:hover:text-white"
                aria-label="Выйти"
              >
                <span className="text-base leading-none">↩</span>
              </button>
            </div>
          ) : (
            "Не авторизованы"
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AUTH_STATE_CHANGED_EVENT } from "./auth-events";

const REGISTER_ENDPOINT = "/api/auth/register";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: "email",
          profile: { name: name.trim() },
          credentials: { email, password },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Не удалось зарегистрироваться");
      }
      window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
      setStatus({
        type: "success",
        message: "Аккаунт создан, вы вошли",
      });
      setPassword("");
      router.push("/");
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось зарегистрироваться",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Имя / никнейм"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      {status && (
        <p
          className={`text-xs ${
            status.type === "success"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-500 dark:text-red-400"
          }`}
        >
          {status.message}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {isSubmitting ? "Регистрируем…" : "Зарегистрироваться"}
      </button>
    </form>
  );
}

import Link from "next/link";
import AuthPanel from "../ui/auth-panel";

export const metadata = {
  title: "Вход | Combiner",
};

export default function LoginPage() {
  return (
    <>
      <section className="space-y-4 text-center sm:text-left">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-500 dark:text-zinc-400">
          Добро пожаловать
        </p>
        <h1 className="text-4xl font-semibold">Вход</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-300">
          Авторизуйтесь через выбранный провайдер. Архитектура уже готова к
          подключению социальных OAuth-логинов.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="font-semibold text-zinc-900 underline decoration-dotted dark:text-white"
          >
            Зарегистрироваться
          </Link>
        </p>
      </section>

      <AuthPanel mode="login" />
    </>
  );
}

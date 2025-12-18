import Link from "next/link";

export default function Home() {
  return (
    <>
      <section className="rounded-3xl border border-zinc-200 bg-white p-10 text-left shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm uppercase tracking-[0.4em] text-zinc-500 dark:text-zinc-400">
          Combiner
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-black dark:text-white">
          Единая точка входа
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
          Минимально жизнеспособная регистрация и авторизация на провайдерах,
          готовая к расширению за счёт Google, VK, Яндекс и других OAuth
          платформ. Начните с почты и пароля уже сейчас.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/register"
            className="rounded-full bg-zinc-900 px-8 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
          >
            Регистрация
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-zinc-300 px-8 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-zinc-400 dark:hover:text-white"
          >
            Войти
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-dashed border-zinc-300 p-8 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-500 dark:text-zinc-400">
          Что дальше
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5">
          <li>Добавляем провайдеры OAuth, которые подключатся к той же API.</li>
          <li>Переносим хранение пользователей и сессий в постоянную базу.</li>
          <li>Подключаем UI-кнопки соцсетей без изменения текущих экранов.</li>
        </ul>
      </section>
    </>
  );
}

import Link from "next/link";
import AuthPanel from "../ui/auth-panel";

export const metadata = {
  title: "Регистрация | Combiner",
};

export default function RegisterPage() {
  return (
    <>
      <section className="space-y-4 text-center sm:text-left">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-500 dark:text-zinc-400">
          Начните с аккаунта
        </p>
        <h1 className="text-4xl font-semibold">Регистрация</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-300">
          Создайте профиль через выбранный провайдер. Сейчас доступен вход по
          email/паролю, остальное станет доступно без переписывания UI.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Уже есть учётка?{" "}
          <Link
            href="/login"
            className="font-semibold text-zinc-900 underline decoration-dotted dark:text-white"
          >
            Войти
          </Link>
        </p>
      </section>

      <AuthPanel mode="register" />
    </>
  );
}

import Link from "next/link";
import LoginForm from "../ui/login-form";

export const metadata = {
  title: "Вход | Combiner",
};

export default function LoginPage() {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-10 text-left shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="space-y-6 text-center sm:text-left">
        <h1 className="text-4xl font-semibold text-zinc-900 dark:text-white">
          Вход
        </h1>
        <LoginForm />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="font-semibold text-zinc-900 underline decoration-dotted dark:text-white"
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </section>
  );
}

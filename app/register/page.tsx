import Link from "next/link";
import RegisterForm from "../ui/register-form";

export const metadata = {
  title: "Регистрация | Combiner",
};

export default function RegisterPage() {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-10 text-left shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="space-y-6 text-center sm:text-left">
        <h1 className="text-4xl font-semibold text-zinc-900 dark:text-white">
          Регистрация
        </h1>
        <RegisterForm />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Уже есть учётка?{" "}
          <Link
            href="/login"
            className="font-semibold text-zinc-900 underline decoration-dotted dark:text-white"
          >
            Войти
          </Link>
        </p>
      </div>
    </section>
  );
}

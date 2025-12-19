import ChatRoom from "../ui/chat-room";
import { listMessages } from "../lib/chat/store";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authService, SESSION_COOKIE_NAME } from "@/app/lib/auth/service";

async function warmupChatServer() {
  const headerList = await headers();
  const host = headerList.get("host");
  if (!host) {
    return;
  }
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;
  try {
    await fetch(`${baseUrl}/api/chat/socket`, { cache: "no-store" });
  } catch (error) {
    console.error("Не удалось прогреть чат-сервер", error);
  }
}

export const metadata = {
  title: "Чат | Combiner",
};

export default async function ChatPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = await authService.getSessionUser(sessionToken);
  if (!user) {
    redirect("/login");
  }

  await warmupChatServer();

  const clientUser = {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
  };

  const initialMessages = listMessages();

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-left shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-500 dark:text-zinc-400">
          Combiner Chat
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-900 dark:text-white">
          Общайтесь в реальном времени
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
          Любой авторизованный пользователь может присоединиться к открытому
          каналу. Мы синхронизируем историю, автопрокрутку и отправку сообщений
          через вебсокеты, поэтому остаётся только печатать.
        </p>
        <ul className="mt-6 grid gap-4 text-sm text-zinc-600 dark:text-zinc-300 sm:grid-cols-2">
          <li className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
            Режим онлайн — сообщения отправляются мгновенно и сразу появляются у
            всех участников.
          </li>
          <li className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
            История хранится в памяти сервера и передаётся при каждом новом
            подключении.
          </li>
        </ul>
      </div>
      <ChatRoom currentUser={clientUser} initialMessages={initialMessages} />
    </section>
  );
}

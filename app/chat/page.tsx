import ChatRoom from "../ui/chat-room";
import type { ChatMessage } from "../lib/chat/types";

const sampleMessages: ChatMessage[] = [
  {
    id: "page-1",
    userId: "support",
    author: "Команда Combiner",
    content:
      "Добро пожаловать в макет чата. Пока серверная часть отключена, но вы уже можете оценить оформление переписки.",
    createdAt: "2025-12-20T09:00:00.000Z",
  },
  {
    id: "page-2",
    userId: "visitor",
    author: "Гость",
    content: "Спасибо за аккуратный дизайн. Жду момента, когда функциональность будет восстановлена.",
    createdAt: "2025-12-20T09:02:00.000Z",
  },
  {
    id: "page-3",
    userId: "support",
    author: "Команда Combiner",
    content:
      "Когда подключение вернётся, здесь появится настоящая переписка и отправка будет работать в реальном времени.",
    createdAt: "2025-12-20T09:04:00.000Z",
  },
];

export const metadata = {
  title: "Чат | Combiner",
};

export default function ChatPage() {
  const clientUser = {
    id: "client-user",
    name: "Гость",
    email: null,
  };

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-left shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-500 dark:text-zinc-400">
          Combiner Chat
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-900 dark:text-white">
          Чат поддержки Combiner
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
          Эта страница сохраняет визуальную компоновку переписки. Пока серверное взаимодействие отключено, здесь можно наблюдать, как будет выглядеть интерфейс.
        </p>
        <ul className="mt-6 grid gap-4 text-sm text-zinc-600 dark:text-zinc-300 sm:grid-cols-2">
          <li className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
            Интерфейс ориентирован на внутреннюю коммуникацию команды и клиентов в Combiner.
          </li>
          <li className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
            Как только сервер снова будет доступен, обновление подключит сообщения и интерактивность.
          </li>
        </ul>
      </div>
      <ChatRoom currentUser={clientUser} messages={sampleMessages} />
    </section>
  );
}

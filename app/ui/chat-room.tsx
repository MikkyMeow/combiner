"use client";

import { CHAT_HISTORY_LIMIT } from "@/app/lib/chat/constants";
import type { ChatMessage } from "@/app/lib/chat/types";

type ChatRoomProps = {
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  messages?: ChatMessage[];
};

const MESSAGE_LIMIT = CHAT_HISTORY_LIMIT;

const FALLBACK_MESSAGES: ChatMessage[] = [
  {
    id: "fallback-1",
    userId: "support",
    author: "Команда Combiner",
    content:
      "Привет! Пока серверная часть приостанавливает работу, но вёрстка уже готова. Напиши здесь что-нибудь, чтобы увидеть дизайн сообщения.",
    createdAt: "2025-12-20T10:00:00.000Z",
  },
  {
    id: "fallback-2",
    userId: "visitor",
    author: "Гость",
    content:
      "Отлично, вижу стиль чата, но пока что нельзя взаимодействовать с сервером. Жду полной версии.",
    createdAt: "2025-12-20T10:05:00.000Z",
  },
  {
    id: "fallback-3",
    userId: "support",
    author: "Команда Combiner",
    content:
      "Как только сервер снова будет доступен, здесь появятся реальные сообщения и кнопка отправки станет рабочей.",
    createdAt: "2025-12-20T10:07:00.000Z",
  },
];

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatRoom({ currentUser, messages }: ChatRoomProps) {
  const displayMessages =
    messages && messages.length > 0 ? messages : FALLBACK_MESSAGES;
  const currentUserLabel =
    currentUser.name ??
    currentUser.email ??
    "Гость Combiner Chat";
  const statusText = "Чат доступен";

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-6 border-b border-zinc-100 px-6 py-6 dark:border-zinc-900 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500 dark:text-zinc-400">
            Combiner Chat
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-zinc-900 dark:text-white">
            Основной чат
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Наблюдай за тем, как будет выглядеть переписка в интерфейсе Combiner. Здесь пока только макет, но всё оформление уже на месте.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-700">
          <p className="font-semibold text-zinc-900 dark:text-white">
            {currentUserLabel}
          </p>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
            {statusText}
          </p>
        </div>
      </div>
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 rounded-2xl border border-zinc-100 p-4 text-sm dark:border-zinc-900">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
              Для кого
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              Чат служит для быстрых вопросов внутри Combiner. Пока сервер отключён, вёрстка демонстрирует расположение элементов и подсказок.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-zinc-200 p-4 dark:border-zinc-700">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
              Подсказки
            </p>
            <ul className="mt-3 space-y-1 text-zinc-600 dark:text-zinc-300">
              <li>Используй Ctrl+Enter для новой строки в дизайне.</li>
              <li>История ограничена до {MESSAGE_LIMIT} сообщений.</li>
              <li>Нажми Enter, чтобы отправить фразу (после подключения).</li>
            </ul>
          </div>
        </aside>
        <div className="flex flex-col rounded-2xl border border-zinc-100 dark:border-zinc-900">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {displayMessages.map((message) => {
              const isOwn = message.userId === currentUser.id;
              return (
                <article
                  key={message.id}
                  className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                    isOwn
                      ? "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/25"
                      : "border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  }`}
                >
                  <header className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {isOwn ? "Ты" : message.author}
                    </span>
                    <span className="text-zinc-400 dark:text-zinc-500">
                      {formatTime(message.createdAt)}
                    </span>
                  </header>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                    {message.content}
                  </p>
                </article>
              );
            })}
            {displayMessages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                Пока сообщений нет.
              </div>
            )}
          </div>
          <div className="border-t border-zinc-100 p-4 dark:border-zinc-900">
            <label className="sr-only" htmlFor="chat-message">
              Сообщение
            </label>
            <textarea
              id="chat-message"
              placeholder="Напиши сообщение, чтобы увидеть макет его отправки."
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              rows={3}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-full bg-zinc-900 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition dark:bg-white dark:text-zinc-900"
              >
                Отправить
              </button>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                Ctrl+Enter для новой строки
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

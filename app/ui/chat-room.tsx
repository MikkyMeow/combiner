"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { CHAT_HISTORY_LIMIT } from "@/app/lib/chat/constants";
import type { ChatMessage } from "@/app/lib/chat/types";

type ChatRoomProps = {
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  initialMessages: ChatMessage[];
};

type SocketEvent =
  | {
      type: "init";
      payload?: { messages?: ChatMessage[] };
    }
  | {
      type: "message:new";
      payload?: ChatMessage;
    };

const MESSAGE_LIMIT = CHAT_HISTORY_LIMIT;

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

export default function ChatRoom({
  currentUser,
  initialMessages,
}: ChatRoomProps) {
  const [messages, setMessages] =
    useState<ChatMessage[]>(initialMessages ?? []);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [draft, setDraft] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const currentUserLabel = useMemo(
    () => currentUser.name ?? currentUser.email ?? "Неизвестный пользователь",
    [currentUser.email, currentUser.name],
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    function connect() {
      setConnectionStatus("connecting");
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(
        `${protocol}://${window.location.host}/api/chat/socket`,
      );
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        setConnectionStatus("connected");
      });

      socket.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(String(event.data)) as SocketEvent;
          if (data.type === "init" && data.payload?.messages) {
            setMessages(data.payload.messages);
            return;
          }
          if (data.type === "message:new" && data.payload) {
            setMessages((prev) => {
              const next = [...prev, data.payload as ChatMessage];
              if (next.length > MESSAGE_LIMIT) {
                return next.slice(next.length - MESSAGE_LIMIT);
              }
              return next;
            });
          }
        } catch (error) {
          console.error("Не удалось обработать событие сокета", error);
        }
      });

      socket.addEventListener("close", () => {
        socketRef.current = null;
        setConnectionStatus("disconnected");
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(() => {
            void connect();
          }, 3000);
        }
      });

      socket.addEventListener("error", () => {
        socket.close();
      });
    }

    void connect();

    return () => {
      isUnmounted = true;
      socketRef.current?.close();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(
      JSON.stringify({
        type: "message:send",
        payload: { content: text },
      }),
    );
    setDraft("");
  }, [draft]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const onSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      handleSend();
    },
    [handleSend],
  );

  const statusText = useMemo(() => {
    switch (connectionStatus) {
      case "connected":
        return "В сети";
      case "connecting":
        return "Подключаемся…";
      case "disconnected":
        return "Соединение потеряно, пытаемся снова…";
    }
  }, [connectionStatus]);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-6 border-b border-zinc-100 px-6 py-6 dark:border-zinc-900 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-zinc-500 dark:text-zinc-400">
            Combiner Chat
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-zinc-900 dark:text-white">
            Общий канал
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Пишите в общий поток, мы синхронизируем сообщения между
            участниками в реальном времени.
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
              Правила
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              Сообщения видят все авторизованные пользователи. Не публикуйте
              чувствительные данные.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-zinc-200 p-4 dark:border-zinc-700">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
              Шорткаты
            </p>
            <ul className="mt-3 space-y-1 text-zinc-600 dark:text-zinc-300">
              <li>⌘⏎ или Ctrl+⏎ — отправить сообщение</li>
              <li>Ограничение истории: {MESSAGE_LIMIT}</li>
              <li>Строки поддерживаются — просто нажмите Enter</li>
            </ul>
          </div>
          {connectionStatus === "disconnected" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
              Соединение разорвано, переподключаемся автоматически…
            </div>
          )}
        </aside>
        <div className="flex flex-col rounded-2xl border border-zinc-100 dark:border-zinc-900">
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
          >
            {messages.map((message) => {
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
                      {isOwn ? "Вы" : message.author}
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
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                В чате пока пусто. Напишите первое сообщение!
              </div>
            )}
          </div>
          <form
            onSubmit={onSubmit}
            className="border-t border-zinc-100 p-4 dark:border-zinc-900"
          >
            <label className="sr-only" htmlFor="chat-message">
              Сообщение
            </label>
            <textarea
              id="chat-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Введите сообщение…"
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              rows={3}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!draft.trim() || connectionStatus !== "connected"}
                className="rounded-full bg-zinc-900 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-white dark:text-zinc-900 dark:disabled:bg-zinc-500/50"
              >
                Отправить
              </button>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                ⌘⏎ или Ctrl+⏎ — отправка
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

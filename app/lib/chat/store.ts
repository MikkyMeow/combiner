import { CHAT_HISTORY_LIMIT } from "./constants";
import { PublicUser } from "../auth/types";
import { ChatMessage } from "./types";

type ChatStore = {
  messages: ChatMessage[];
};

const globalChatStore =
  (globalThis as typeof globalThis & { __combinerChatStore?: ChatStore })
    .__combinerChatStore ?? {
    messages: [],
  };

if (
  !(globalThis as typeof globalThis & { __combinerChatStore?: ChatStore })
    .__combinerChatStore
) {
  (globalThis as typeof globalThis & { __combinerChatStore?: ChatStore })
    .__combinerChatStore = globalChatStore;
}

const store = globalChatStore;

export function listMessages() {
  return store.messages.map((message) => ({ ...message }));
}

export function addMessage(user: PublicUser, content: string): ChatMessage {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    userId: user.id,
    author: user.name ?? user.email ?? "Неизвестный пользователь",
    content,
    createdAt: new Date().toISOString(),
  };
  store.messages.push(message);
  if (store.messages.length > CHAT_HISTORY_LIMIT) {
    store.messages.splice(0, store.messages.length - CHAT_HISTORY_LIMIT);
  }
  return message;
}

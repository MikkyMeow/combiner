import type { ChatMessage } from "./chatTypes";

const HISTORY_LIMIT = 100;

const historyBuckets = new Map<string | null, ChatMessage[]>();

export const addChatMessage = (message: ChatMessage): void => {
  const key = message.company ?? null;
  const bucket = historyBuckets.get(key) ?? [];
  bucket.push(message);
  if (bucket.length > HISTORY_LIMIT) {
    bucket.shift();
  }
  historyBuckets.set(key, bucket);
};

export const getChatHistory = (company: string | null): ChatMessage[] => {
  const bucket = historyBuckets.get(company) ?? [];
  return [...bucket];
};

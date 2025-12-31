import type { DirectChatMessage } from "./chatTypes";

const HISTORY_LIMIT = 100;

const historyBuckets = new Map<string, DirectChatMessage[]>();

export const getDirectKey = (userA: string, userB: string): string => {
  return [userA, userB].sort((left, right) => left.localeCompare(right)).join("::");
};

export const addDirectMessage = (key: string, message: DirectChatMessage): void => {
  const bucket = historyBuckets.get(key) ?? [];
  bucket.push(message);
  if (bucket.length > HISTORY_LIMIT) {
    bucket.shift();
  }
  historyBuckets.set(key, bucket);
};

export const getDirectHistory = (key: string): DirectChatMessage[] => {
  const bucket = historyBuckets.get(key) ?? [];
  return [...bucket];
};

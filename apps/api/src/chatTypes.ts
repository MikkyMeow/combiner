export type ChatMessage = {
  id: string;
  sender: string;
  company: string | null;
  text: string;
  createdAt: string;
};

export type DirectChatMessage = {
  id: string;
  sender: string;
  recipient: string;
  text: string;
  createdAt: string;
};

export type ChatServerEvent =
  | { type: "history"; messages: ChatMessage[] }
  | { type: "message"; message: ChatMessage }
  | { type: "error"; message: string };

export type ChatClientEvent = {
  type: "message";
  text: string;
};

export type DirectChatServerEvent =
  | { type: "history"; messages: DirectChatMessage[] }
  | { type: "message"; message: DirectChatMessage }
  | { type: "error"; message: string };

export type DirectChatClientEvent = {
  type: "message";
  text: string;
};

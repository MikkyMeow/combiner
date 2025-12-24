export type ChatMessage = {
  id: string;
  sender: string;
  company: string | null;
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

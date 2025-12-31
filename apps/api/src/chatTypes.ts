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
  | { type: "error"; message: string }
  | { type: "call-request"; from: string }
  | { type: "call-accept"; from: string }
  | { type: "call-reject"; from: string }
  | { type: "call-offer"; from: string; offer: RTCSessionDescriptionInit }
  | { type: "call-answer"; from: string; answer: RTCSessionDescriptionInit }
  | { type: "call-ice"; from: string; candidate: RTCIceCandidateInit }
  | { type: "call-end"; from: string; reason?: string };

export type DirectChatClientEvent = {
  type: "message";
  text: string;
}
  | { type: "call-request" }
  | { type: "call-accept" }
  | { type: "call-reject" }
  | { type: "call-offer"; offer: RTCSessionDescriptionInit }
  | { type: "call-answer"; answer: RTCSessionDescriptionInit }
  | { type: "call-ice"; candidate: RTCIceCandidateInit }
  | { type: "call-end"; reason?: string };

import { randomUUID } from "node:crypto";
import { FastifyPluginAsync } from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import WebSocket from "ws";
import { findUserByUsername } from "./usersStore";
import { addChatMessage, getChatHistory } from "./chatStore";
import { addDirectMessage, getDirectHistory, getDirectKey } from "./directChatStore";
import type {
  ChatMessage,
  ChatClientEvent,
  ChatServerEvent,
  DirectChatClientEvent,
  DirectChatMessage,
  DirectChatServerEvent
} from "./chatTypes";
import type { UserRole } from "./db";

const MAX_MESSAGE_LENGTH = 512;

type JwtPayload = {
  username: string;
  role: UserRole;
};

const chatRoutes: FastifyPluginAsync = async (server) => {
  await server.register(fastifyWebsocket);

  const rooms = new Map<string | null, Set<WebSocket>>();
  const directRooms = new Map<string, Set<WebSocket>>();

  const sendEvent = (socket: WebSocket, event: ChatServerEvent | DirectChatServerEvent) => {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      socket.send(JSON.stringify(event));
    } catch {
      /* ignore send failures */
    }
  };

  const joinRoom = (company: string | null, socket: WebSocket) => {
    const room = rooms.get(company) ?? new Set<WebSocket>();
    room.add(socket);
    rooms.set(company, room);
    return room;
  };

  const leaveRoom = (company: string | null, socket: WebSocket) => {
    const room = rooms.get(company);
    if (!room) {
      return;
    }
    room.delete(socket);
    if (room.size === 0) {
      rooms.delete(company);
    }
  };

  const joinDirectRoom = (key: string, socket: WebSocket) => {
    const room = directRooms.get(key) ?? new Set<WebSocket>();
    room.add(socket);
    directRooms.set(key, room);
    return room;
  };

  const leaveDirectRoom = (key: string, socket: WebSocket) => {
    const room = directRooms.get(key);
    if (!room) {
      return;
    }
    room.delete(socket);
    if (room.size === 0) {
      directRooms.delete(key);
    }
  };

  const relayDirectEvent = (
    room: Set<WebSocket>,
    origin: WebSocket,
    event: DirectChatServerEvent
  ) => {
    for (const recipientSocket of room) {
      if (recipientSocket === origin) {
        continue;
      }
      sendEvent(recipientSocket, event);
    }
  };

  server.get<{ Querystring: { token?: string } }>(
    "/teams/chat",
    { websocket: true },
    function (socket, request) {
      const token = request.query?.token;
      if (!token || typeof token !== "string") {
        sendEvent(socket, { type: "error", message: "Authentication token is required" });
        socket.close();
        return;
      }

      let payload: JwtPayload;
      try {
        payload = this.jwt.verify(token) as JwtPayload;
      } catch {
        sendEvent(socket, { type: "error", message: "Invalid authentication token" });
        socket.close();
        return;
      }

      const user = findUserByUsername(payload.username);
      if (!user) {
        sendEvent(socket, { type: "error", message: "User not found" });
        socket.close();
        return;
      }

      const company = user.company ?? null;
      const room = joinRoom(company, socket);
      sendEvent(socket, { type: "history", messages: getChatHistory(company) });

      const handleMessage = (raw: WebSocket.Data) => {
        let payload: ChatClientEvent;
        try {
          const rawText = typeof raw === "string" ? raw : raw.toString();
          payload = JSON.parse(rawText) as ChatClientEvent;
        } catch {
          sendEvent(socket, { type: "error", message: "Unable to parse chat message" });
          return;
        }

        if (payload.type !== "message") {
          sendEvent(socket, { type: "error", message: "Unsupported message type" });
          return;
        }

        const trimmed = (payload.text ?? "").trim();
        if (!trimmed) {
          sendEvent(socket, { type: "error", message: "Message cannot be empty" });
          return;
        }

        if (trimmed.length > MAX_MESSAGE_LENGTH) {
          sendEvent(socket, { type: "error", message: "Message is too long" });
          return;
        }

        if (company === null) {
          sendEvent(socket, { type: "error", message: "Join a company to send messages" });
          return;
        }

        const message: ChatMessage = {
          id: randomUUID(),
          sender: user.username,
          company,
          text: trimmed,
          createdAt: new Date().toISOString()
        };
        addChatMessage(message);

        for (const peer of room) {
          sendEvent(peer, { type: "message", message });
        }
      };

      const cleanUp = () => {
        leaveRoom(company, socket);
        socket.off("message", handleMessage);
      };

      socket.on("message", handleMessage);
      socket.on("close", cleanUp);
      socket.on("error", cleanUp);
    }
  );

  server.get<{ Querystring: { token?: string; peer?: string } }>(
    "/teams/direct",
    { websocket: true },
    function (socket, request) {
      const token = request.query?.token;
      const peer = request.query?.peer;
      if (!token || typeof token !== "string") {
        sendEvent(socket, { type: "error", message: "Authentication token is required" });
        socket.close();
        return;
      }
      if (!peer || typeof peer !== "string") {
        sendEvent(socket, { type: "error", message: "Direct chat peer is required" });
        socket.close();
        return;
      }

      let payload: JwtPayload;
      try {
        payload = this.jwt.verify(token) as JwtPayload;
      } catch {
        sendEvent(socket, { type: "error", message: "Invalid authentication token" });
        socket.close();
        return;
      }

      const user = findUserByUsername(payload.username);
      if (!user) {
        sendEvent(socket, { type: "error", message: "User not found" });
        socket.close();
        return;
      }

      const peerUser = findUserByUsername(peer);
      if (!peerUser) {
        sendEvent(socket, { type: "error", message: "Peer user not found" });
        socket.close();
        return;
      }

      if (!user.company || !peerUser.company || user.company !== peerUser.company) {
        sendEvent(socket, { type: "error", message: "Direct chat is only available within your company" });
        socket.close();
        return;
      }

      const roomKey = getDirectKey(user.username, peerUser.username);
      const room = joinDirectRoom(roomKey, socket);
      sendEvent(socket, { type: "history", messages: getDirectHistory(roomKey) } satisfies DirectChatServerEvent);

      const handleMessage = (raw: WebSocket.Data) => {
        let messagePayload: DirectChatClientEvent;
        try {
          const rawText = typeof raw === "string" ? raw : raw.toString();
          messagePayload = JSON.parse(rawText) as DirectChatClientEvent;
        } catch {
          sendEvent(socket, { type: "error", message: "Unable to parse chat message" });
          return;
        }

        if (messagePayload.type === "message") {
          const trimmed = (messagePayload.text ?? "").trim();
          if (!trimmed) {
            sendEvent(socket, { type: "error", message: "Message cannot be empty" });
            return;
          }

          if (trimmed.length > MAX_MESSAGE_LENGTH) {
            sendEvent(socket, { type: "error", message: "Message is too long" });
            return;
          }

          const message: DirectChatMessage = {
            id: randomUUID(),
            sender: user.username,
            recipient: peerUser.username,
            text: trimmed,
            createdAt: new Date().toISOString()
          };
          addDirectMessage(roomKey, message);

          for (const recipientSocket of room) {
            sendEvent(recipientSocket, { type: "message", message } satisfies DirectChatServerEvent);
          }
          return;
        }

        if (messagePayload.type === "call-request") {
          relayDirectEvent(room, socket, { type: "call-request", from: user.username });
          return;
        }

        if (messagePayload.type === "call-accept") {
          relayDirectEvent(room, socket, { type: "call-accept", from: user.username });
          return;
        }

        if (messagePayload.type === "call-reject") {
          relayDirectEvent(room, socket, { type: "call-reject", from: user.username });
          return;
        }

        if (messagePayload.type === "call-offer") {
          if (!messagePayload.offer) {
            sendEvent(socket, { type: "error", message: "Call offer is required" });
            return;
          }
          relayDirectEvent(room, socket, {
            type: "call-offer",
            from: user.username,
            offer: messagePayload.offer
          });
          return;
        }

        if (messagePayload.type === "call-answer") {
          if (!messagePayload.answer) {
            sendEvent(socket, { type: "error", message: "Call answer is required" });
            return;
          }
          relayDirectEvent(room, socket, {
            type: "call-answer",
            from: user.username,
            answer: messagePayload.answer
          });
          return;
        }

        if (messagePayload.type === "call-ice") {
          if (!messagePayload.candidate) {
            sendEvent(socket, { type: "error", message: "ICE candidate is required" });
            return;
          }
          relayDirectEvent(room, socket, {
            type: "call-ice",
            from: user.username,
            candidate: messagePayload.candidate
          });
          return;
        }

        if (messagePayload.type === "call-end") {
          relayDirectEvent(room, socket, {
            type: "call-end",
            from: user.username,
            reason: messagePayload.reason
          });
          return;
        }

        sendEvent(socket, { type: "error", message: "Unsupported message type" });
      };

      const cleanUp = () => {
        leaveDirectRoom(roomKey, socket);
        socket.off("message", handleMessage);
      };

      socket.on("message", handleMessage);
      socket.on("close", cleanUp);
      socket.on("error", cleanUp);
    }
  );
};

export default chatRoutes;

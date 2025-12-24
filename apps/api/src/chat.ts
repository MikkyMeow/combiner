import { randomUUID } from "node:crypto";
import { FastifyPluginAsync } from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import WebSocket from "ws";
import { findUserByUsername } from "./usersStore";
import { addChatMessage, getChatHistory } from "./chatStore";
import type { ChatMessage, ChatClientEvent, ChatServerEvent } from "./chatTypes";
import type { UserRole } from "./db";

const MAX_MESSAGE_LENGTH = 512;

type JwtPayload = {
  username: string;
  role: UserRole;
};

const chatRoutes: FastifyPluginAsync = async (server) => {
  await server.register(fastifyWebsocket);

  const rooms = new Map<string | null, Set<WebSocket>>();

  const sendEvent = (socket: WebSocket, event: ChatServerEvent) => {
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
};

export default chatRoutes;

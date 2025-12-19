import type { NextApiRequest, NextApiResponse } from "next";
import type { IncomingMessage, Server as HTTPServer } from "http";
import type { Socket } from "net";
import { WebSocketServer, WebSocket } from "ws";
import { authService, SESSION_COOKIE_NAME } from "@/app/lib/auth/service";
import { addMessage, listMessages } from "@/app/lib/chat/store";
import type { PublicUser } from "@/app/lib/auth/types";

type NextApiResponseWithSocket = NextApiResponse & {
  socket: NextApiResponse["socket"] & {
    server: HTTPServer & {
      chatWss?: WebSocketServer;
    };
  };
};

type IncomingChatMessage = {
  type?: string;
  payload?: {
    content?: string;
  };
};

const connections = new Map<WebSocket, PublicUser>();

function parseSessionToken(header: string | undefined) {
  if (!header) {
    return undefined;
  }
  const cookies = header.split(";");
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split("=");
    if (name?.trim() === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rest.join("=").trim());
    }
  }
  return undefined;
}

async function authenticateRequest(request: { headers: { cookie?: string } }) {
  const token = parseSessionToken(request.headers.cookie);
  if (!token) {
    return null;
  }
  return authService.getSessionUser(token);
}

function broadcast(event: unknown) {
  const payload = JSON.stringify(event);
  for (const socket of connections.keys()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

async function handleConnection(socket: WebSocket, request: IncomingMessage) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      socket.close(4001, "UNAUTHORIZED");
      return;
    }
    connections.set(socket, user);
    socket.send(
      JSON.stringify({
        type: "init",
        payload: { messages: listMessages() },
      }),
    );

    socket.on("message", (event) => {
      try {
        const raw = event.toString();
        const data = JSON.parse(raw) as IncomingChatMessage;
        if (data.type !== "message:send") {
          return;
        }
        const content = data.payload?.content;
        if (!content || typeof content !== "string") {
          return;
        }
        const trimmed = content.trim();
        if (!trimmed) {
          return;
        }
        const message = addMessage(user, trimmed.slice(0, 2000));
        broadcast({ type: "message:new", payload: message });
      } catch (error) {
        console.error("Ошибка обработки сообщения чата", error);
      }
    });

    socket.on("close", () => {
      connections.delete(socket);
    });
    socket.on("error", () => {
      connections.delete(socket);
    });
  } catch (error) {
    console.error("Ошибка подключения к чату", error);
    socket.close(1011, "SERVER_ERROR");
  }
}

function ensureWebSocketServer(res: NextApiResponseWithSocket) {
  if (res.socket.server.chatWss) {
    return res.socket.server.chatWss;
  }

  const wss = new WebSocketServer({ noServer: true });

  res.socket.server.on("upgrade", (request, socket, head) => {
    if (!request.url?.startsWith("/api/chat/socket")) {
      return;
    }
    wss.handleUpgrade(request, socket as Socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (socket, request) => {
    handleConnection(socket, request);
  });

  res.socket.server.chatWss = wss;
  return wss;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket,
) {
  ensureWebSocketServer(res);
  const sessionToken = req.cookies[SESSION_COOKIE_NAME];
  const user = await authService.getSessionUser(sessionToken);
  if (!user) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }

  res.status(200).json({ ready: true });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

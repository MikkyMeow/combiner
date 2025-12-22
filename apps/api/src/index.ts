import Fastify from "fastify";
import cors from "@fastify/cors";
import authRoutes from "./auth";

const server = Fastify({ logger: true });

server.register(cors, { origin: true });
server.register(authRoutes);

server.get("/hello", async () => ({ message: "Hello from backend" }));

const start = async () => {
  try {
    await server.listen({
      port: 3000,
      host: "0.0.0.0"
    });
    console.log("Backend listening on http://localhost:3000");
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

start();

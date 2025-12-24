import "./db";
import Fastify from "fastify";
import cors from "@fastify/cors";
import authRoutes from "./auth";
import chatRoutes from "./chat";
import tasksRoutes from "./tasks";
import notesRoutes from "./notes";
import projectsRoutes from "./projects";

const server = Fastify({ logger: true });

server.register(cors, { origin: true });

server.get("/hello", async () => ({ message: "Hello from backend" }));

const start = async () => {
  try {
    await server.register(authRoutes);
    await server.register(chatRoutes);
    await server.register(tasksRoutes);
    await server.register(notesRoutes);
    await server.register(projectsRoutes);

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

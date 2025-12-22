import Fastify from "fastify";
import cors from "@fastify/cors";

const server = Fastify();

server.get("/hello", async () => {
  return { message: "Hello from backend" };
});

const start = async () => {
  try {
    await server.register(cors, {
      origin: true
    });
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

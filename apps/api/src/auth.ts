import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt, { FastifyJWTOptions } from "@fastify/jwt";
import fastifyPlugin from "fastify-plugin";

type UserRecord = { password: string };

interface RegisterBody {
  username: string;
  password: string;
}

interface JwtPayload {
  username: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

const users = new Map<string, UserRecord>();
const jwtSecret = process.env.JWT_SECRET ?? "dev-secret";
const jwtOptions: FastifyJWTOptions = {
  secret: jwtSecret,
  sign: { expiresIn: "12h" }
};

const authRoutes: FastifyPluginAsync = async (server) => {
  await server.register(fastifyJwt, jwtOptions);

  server.decorate("authenticate", async (request, reply) => {
    await request.jwtVerify();
  });

  server.post<{ Body: RegisterBody }>("/register", async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      return reply.status(400).send({ message: "Username and password are required" });
    }

    if (users.has(username)) {
      return reply.status(409).send({ message: "User already exists" });
    }

    users.set(username, { password });
    return { message: "User registered" };
  });

  server.post<{ Body: RegisterBody }>("/login", async (request, reply) => {
    const { username, password } = request.body;
    const user = users.get(username);

    if (!user || user.password !== password) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const token = await reply.jwtSign({ username });
    return { token };
  });

  server.get("/me", { preValidation: [server.authenticate] }, async (request) => ({
    user: request.user
  }));
};

export default fastifyPlugin(authRoutes);

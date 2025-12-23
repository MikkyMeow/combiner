import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt, { FastifyJWTOptions } from "@fastify/jwt";
import fastifyPlugin from "fastify-plugin";
import { listNotes } from "./notesStore";
import { listProjects } from "./projectsStore";
import { listTasks } from "./tasksStore";
import { createUser, findUserByUsername, type UserRecord, updateUser } from "./usersStore";

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
const jwtSecret = process.env.JWT_SECRET ?? "dev-secret";
const jwtOptions: FastifyJWTOptions = {
  secret: jwtSecret,
  sign: { expiresIn: "12h" }
};

type UserProfile = Pick<UserRecord, "username" | "createdAt" | "updatedAt">;

interface UpdateProfileBody {
  password?: string;
}

const buildProfile = (user: UserRecord): UserProfile => ({
  username: user.username,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

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

    if (findUserByUsername(username)) {
      return reply.status(409).send({ message: "User already exists" });
    }

    const now = new Date().toISOString();
    createUser({
      username,
      password,
      createdAt: now,
      updatedAt: now
    });
    return { message: "User registered" };
  });

  server.post<{ Body: RegisterBody }>("/login", async (request, reply) => {
    const { username, password } = request.body;
    const user = findUserByUsername(username);

    if (!user || user.password !== password) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const token = await reply.jwtSign({ username });
    return { token };
  });

  server.get(
    "/me",
    { preValidation: [server.authenticate] },
    async (request, reply) => {
      const username = request.user?.username;
      if (!username) {
        return reply.status(401).send({ message: "Invalid token" });
      }

      const user = findUserByUsername(username);
      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      return {
        user: buildProfile(user),
        tasks: listTasks(username),
        notes: listNotes(username),
        projects: listProjects(username)
      };
    }
  );

  server.patch<{ Body: UpdateProfileBody }>(
    "/me",
    { preValidation: [server.authenticate] },
    async (request, reply) => {
      const username = request.user?.username;
      if (!username) {
        return reply.status(401).send({ message: "Invalid token" });
      }

      const user = findUserByUsername(username);
      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      const trimmedPassword = request.body.password?.trim() ?? "";
      if (!trimmedPassword) {
        return reply.status(400).send({ message: "Password is required" });
      }

      const updatedUser = updateUser(username, {
        password: trimmedPassword,
        updatedAt: new Date().toISOString()
      });
      if (!updatedUser) {
        return reply.status(404).send({ message: "User not found" });
      }

      return {
        user: buildProfile(updatedUser),
        tasks: listTasks(username),
        notes: listNotes(username),
        projects: listProjects(username)
      };
    }
  );
};

export default fastifyPlugin(authRoutes);

import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt, { FastifyJWTOptions } from "@fastify/jwt";
import fastifyPlugin from "fastify-plugin";
import { listNotes } from "./notesStore";
import { listProjects } from "./projectsStore";
import { listTasks } from "./tasksStore";
import {
  createUser,
  findUserByUsername,
  type UserRecord,
  type UserRole,
  updateUser
} from "./usersStore";

interface RegisterBody {
  username: string;
  password: string;
}

interface JwtPayload {
  username: string;
  role: UserRole;
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

type UserProfile = Pick<UserRecord, "username" | "createdAt" | "updatedAt" | "role" | "company">;

interface UpdateProfileBody {
  currentPassword?: string;
  newPassword?: string;
}

interface CreateCompanyBody {
  name?: string;
}

const buildProfile = (user: UserRecord): UserProfile => ({
  username: user.username,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  role: user.role,
  company: user.company ?? null
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
      updatedAt: now,
      role: "user"
    });
    return { message: "User registered" };
  });

  server.post<{ Body: RegisterBody }>("/login", async (request, reply) => {
    const { username, password } = request.body;
    const user = findUserByUsername(username);

    if (!user || user.password !== password) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const token = await reply.jwtSign({ username, role: user.role });
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

      const trimmedCurrent = request.body.currentPassword?.trim() ?? "";
      const trimmedNew = request.body.newPassword?.trim() ?? "";
      if (!trimmedCurrent) {
        return reply.status(400).send({ message: "Current password is required" });
      }
      if (!trimmedNew) {
        return reply.status(400).send({ message: "New password is required" });
      }

      if (trimmedCurrent !== user.password) {
        return reply.status(401).send({ message: "Current password is incorrect" });
      }

      const updatedUser = updateUser(username, {
        password: trimmedNew,
        updatedAt: new Date().toISOString()
      });
      if (!updatedUser) {
        return reply.status(404).send({ message: "User not found" });
      }

      const token = await reply.jwtSign({ username, role: updatedUser.role });
      return {
        user: buildProfile(updatedUser),
        tasks: listTasks(username),
        notes: listNotes(username),
        projects: listProjects(username),
        token
      };
    }
  );

  server.post<{ Body: CreateCompanyBody }>(
    "/me/company",
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

      if (user.company) {
        return reply.status(400).send({ message: "Company already assigned" });
      }

      const trimmedName = request.body.name?.trim() ?? "";
      if (!trimmedName) {
        return reply.status(400).send({ message: "Company name is required" });
      }

      const now = new Date().toISOString();
      const updatedUser = updateUser(username, {
        company: trimmedName,
        role: "owner",
        updatedAt: now
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

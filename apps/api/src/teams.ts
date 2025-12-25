import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { findUserByUsername, listUsersByCompany, type UserRole } from "./usersStore";

type CompanyMember = {
  username: string;
  role: UserRole;
  company: string | null;
};

const teamsRoutes: FastifyPluginAsync = async (server) => {
  const ensureAuthenticated = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!server.authenticate) {
      return reply.status(500).send({ message: "Authentication handler missing" });
    }
    await server.authenticate(request, reply);
  };

  const requireUser = (request: FastifyRequest, reply: FastifyReply) => {
    const username = request.user?.username;
    if (!username) {
      reply.status(401).send({ message: "Invalid token" });
      return null;
    }
    return username;
  };

  server.get(
    "/me/company/members",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const user = findUserByUsername(username);
      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      const company = user.company;
      if (!company) {
        return reply.status(400).send({ message: "Company membership not assigned" });
      }

      const members: CompanyMember[] = listUsersByCompany(company).map((entry) => ({
        username: entry.username,
        role: entry.role,
        company: entry.company ?? null
      }));

      return { members };
    }
  );
};

export default teamsRoutes;

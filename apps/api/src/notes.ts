import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import {
  deleteNote,
  findNoteRowById,
  insertNote,
  listNotes,
  mapNoteRow,
  type NoteRecord,
  type NoteRow,
  updateNote
} from "./notesStore";
import { findProjectForUser } from "./projectsStore";

type NoteCreateBody = {
  title: string;
  content?: string;
  tags?: string[];
  projectId?: string | null;
};

type NoteUpdateBody = Partial<NoteCreateBody>;

const sanitizeTags = (tags?: string[]): string[] =>
  (tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

const normalizeProjectId = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const canAccessNote = (username: string, note: NoteRow): boolean =>
  note.projectId ? !!findProjectForUser(username, note.projectId) : note.username === username;

const toNoteRecord = (note: NoteRow): NoteRecord => mapNoteRow(note);

const notesRoutes: FastifyPluginAsync = async (server) => {
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

  server.get("/notes", { preValidation: [ensureAuthenticated] }, async (request, reply) => {
    const username = requireUser(request, reply);
    if (!username) return;

    const notes = listNotes(username);
    return { notes };
  });

  server.get<{ Params: { id: string } }>(
    "/notes/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const note = findNoteRowById(request.params.id);
      if (!note || !canAccessNote(username, note)) {
        return reply.status(404).send({ message: "Note not found" });
      }
      return toNoteRecord(note);
    }
  );

  server.post<{ Body: NoteCreateBody }>(
    "/notes",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const trimmedTitle = request.body.title?.trim();
      if (!trimmedTitle) {
        return reply.status(400).send({ message: "Title is required" });
      }

      const now = new Date().toISOString();
      const newNote: NoteRecord = {
        id: randomUUID(),
        title: trimmedTitle,
        content: request.body.content ?? "",
        tags: sanitizeTags(request.body.tags),
        projectId: normalizeProjectId(request.body.projectId),
        createdAt: now,
        updatedAt: now
      };

      return insertNote(username, newNote);
    }
  );

  server.put<{ Params: { id: string }; Body: NoteUpdateBody }>(
    "/notes/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const target = findNoteRowById(request.params.id);
      if (!target || !canAccessNote(username, target)) {
        return reply.status(404).send({ message: "Note not found" });
      }

      const updates: NoteUpdateBody & { updatedAt: string } = { updatedAt: new Date().toISOString() };

      if (request.body.title !== undefined) {
        const trimmedTitle = request.body.title.trim();
        if (!trimmedTitle) {
          return reply.status(400).send({ message: "Title cannot be empty" });
        }
        updates.title = trimmedTitle;
      }

      if (request.body.content !== undefined) {
        updates.content = request.body.content;
      }

      if (request.body.tags !== undefined) {
        updates.tags = sanitizeTags(request.body.tags);
      }

      if (request.body.projectId !== undefined) {
        const projectId = normalizeProjectId(request.body.projectId);
        if (projectId !== null) {
          const project = findProjectForUser(username, projectId);
          if (!project) {
            return reply.status(400).send({ message: "Project not found" });
          }
        }
        updates.projectId = projectId;
      }

      const updatedNote = updateNote(target.id, updates);
      if (!updatedNote) {
        return reply.status(404).send({ message: "Note not found" });
      }

      return updatedNote;
    }
  );

  server.delete<{ Params: { id: string } }>(
    "/notes/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const noteRow = findNoteRowById(request.params.id);
      if (!noteRow || !canAccessNote(username, noteRow)) {
        return reply.status(404).send({ message: "Note not found" });
      }

      const deleted = deleteNote(noteRow.id);
      if (!deleted) {
        return reply.status(404).send({ message: "Note not found" });
      }

      return { message: "Note deleted" };
    }
  );
};

export default notesRoutes;

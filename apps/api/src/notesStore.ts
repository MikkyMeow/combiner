import { loadDatabase, saveDatabase, type NoteRow } from "./db";
export type { NoteRow } from "./db";

export type NoteRecord = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};

const mapRow = (row: NoteRow): NoteRecord => ({
  id: row.id,
  title: row.title,
  content: row.content,
  tags: row.tags,
  projectId: row.projectId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export const mapNoteRow = (row: NoteRow): NoteRecord => mapRow(row);

export const listNotes = (username: string): NoteRecord[] => {
  const state = loadDatabase();
  return state.notes
    .filter((note) => note.username === username)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(mapRow);
};

export const findNotesForProject = (projectId: string): NoteRecord[] => {
  const state = loadDatabase();
  return state.notes
    .filter((note) => note.projectId === projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(mapRow);
};

export const findNoteRowById = (noteId: string): NoteRow | null => {
  const state = loadDatabase();
  return state.notes.find((entry) => entry.id === noteId) ?? null;
};

export const insertNote = (username: string, note: NoteRecord): NoteRecord => {
  const state = loadDatabase();
  state.notes.unshift({
    ...note,
    username
  });
  saveDatabase(state);
  return note;
};

type NoteUpdatePayload = {
  title?: string;
  content?: string;
  tags?: string[];
  projectId?: string | null;
  updatedAt: string;
};

export const updateNote = (noteId: string, payload: NoteUpdatePayload): NoteRecord | null => {
  const state = loadDatabase();
  const target = state.notes.find((entry) => entry.id === noteId);
  if (!target) {
    return null;
  }

  if (payload.title !== undefined) {
    target.title = payload.title;
  }

  if (payload.content !== undefined) {
    target.content = payload.content;
  }

  if (payload.tags !== undefined) {
    target.tags = payload.tags;
  }

  if (payload.projectId !== undefined) {
    target.projectId = payload.projectId;
  }

  target.updatedAt = payload.updatedAt;
  saveDatabase(state);
  return mapRow(target);
};

export const deleteNote = (noteId: string): boolean => {
  const state = loadDatabase();
  const existingCount = state.notes.length;
  state.notes = state.notes.filter((entry) => entry.id !== noteId);
  if (state.notes.length === existingCount) {
    return false;
  }
  saveDatabase(state);
  return true;
};

import { createSignal, For, Show, onMount } from "solid-js";
import type { NotificationType } from "../components/notifications/useNotifications";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};

type NotesPageProps = {
  jwtToken: string | null;
  onNotify?: (message: string, type?: NotificationType) => void;
};

const NotesPage = ({ jwtToken, onNotify }: NotesPageProps) => {
  const [notes, setNotes] = createSignal<Note[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [title, setTitle] = createSignal("");
  const [content, setContent] = createSignal("");
  const [tags, setTags] = createSignal("");

  const notify = (message: string, type: NotificationType = "info") => {
    if (message) {
      onNotify?.(message, type);
    }
  };

  const getHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (jwtToken) {
      headers.Authorization = `Bearer ${jwtToken}`;
    }
    return headers;
  };

  const handleUnauthorized = () => {
    const message = "Please sign in to manage notes.";
    setError(message);
    notify(message, "warning");
  };

  const handleFetchError = async (response: Response) => {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      /* fallback message stand */
    }
    setError(message);
    notify(message, "error");
  };

  const parseTags = (input: string) =>
    input
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

  const fetchNotes = async () => {
    if (!jwtToken) {
      handleUnauthorized();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/notes`, {
        headers: getHeaders()
      });
      if (!response.ok) {
        await handleFetchError(response);
        return;
      }
      const payload = (await response.json()) as { notes: Note[] };
      setNotes(payload.notes ?? []);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load notes.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!jwtToken) {
      handleUnauthorized();
      return;
    }

    const trimmedTitle = title().trim();
    if (!trimmedTitle) {
      const message = "Note title is required.";
      setError(message);
      notify(message, "warning");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/notes`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          title: trimmedTitle,
          content: content().trim(),
          tags: parseTags(tags())
        })
      });
      if (!response.ok) {
        await handleFetchError(response);
        return;
      }
      notify("Note added", "success");
      setTitle("");
      setContent("");
      setTags("");
      void fetchNotes();
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to add note.";
      setError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!jwtToken) {
      handleUnauthorized();
      return;
    }

    try {
      const response = await fetch(`${apiUrl()}/notes/${noteId}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (!response.ok) {
        await handleFetchError(response);
        return;
      }
      notify("Note deleted", "info");
      void fetchNotes();
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to delete note.";
      setError(message);
      notify(message, "error");
    }
  };

  onMount(() => {
    void fetchNotes();
  });

  return (
    <section class="knowledge-grid">
      <article class="knowledge-panel">
        <h1>Notes</h1>
        <p class="helper-text">
          Capture ad-hoc markdown notes or ideas tagged for future reference.
        </p>

        <Show when={error()}>
          <p class="helper-text">{error()}</p>
        </Show>

        <form class="knowledge-form" onSubmit={handleCreateNote}>
          <label>
            Title
            <input
              class="text-input"
              value={title()}
              onInput={(event) => setTitle(event.currentTarget.value)}
            />
          </label>
          <label>
            Content
            <textarea
              class="text-input knowledge-textarea"
              value={content()}
              onInput={(event) => setContent(event.currentTarget.value)}
            />
          </label>
          <label>
            Tags (comma separated)
            <input
              class="text-input"
              value={tags()}
              onInput={(event) => setTags(event.currentTarget.value)}
            />
          </label>
          <button class="primary" type="submit" disabled={saving()}>
            {saving() ? "Saving..." : "Save note"}
          </button>
        </form>

        <Show when={loading()}>
          <p class="helper-text">Loading notes...</p>
        </Show>

        <Show when={!loading() && notes().length === 0}>
          <p class="helper-text">No notes yet. Use the form above to create one.</p>
        </Show>

        <div class="knowledge-list">
          <For each={notes()}>
            {(note) => (
                <article class="knowledge-item">
                  <div class="knowledge-item-header">
                    <strong>{note.title}</strong>
                    <span class="status-pill">
                      Updated {new Date(note.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Show when={note.projectId}>
                    <p class="knowledge-item-meta">Linked to a project</p>
                  </Show>
                  <p>{note.content || "No content yet."}</p>
                <Show when={note.tags.length > 0}>
                  <div class="knowledge-item-tags">
                    <For each={note.tags}>{(tag) => <span class="knowledge-tag">{tag}</span>}</For>
                  </div>
                </Show>
                <div class="knowledge-actions">
                  <button class="ghost" type="button" onClick={() => handleDeleteNote(note.id)}>
                    Delete
                  </button>
                </div>
              </article>
            )}
          </For>
        </div>
      </article>
    </section>
  );
};

export default NotesPage;

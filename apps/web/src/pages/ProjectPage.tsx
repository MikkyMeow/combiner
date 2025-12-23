import { createEffect, createSignal, For, Show } from "solid-js";
import type { NotificationType } from "../components/notifications/useNotifications";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type Task = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
  createdBy: string;
};

type Project = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  members: string[];
};

type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectPageProps = {
  projectId: string | null;
  jwtToken: string | null;
  onNotify?: (message: string, type?: NotificationType) => void;
  onNavigate?: (path: string) => void;
};

const ProjectPage = (props: ProjectPageProps) => {
  const [project, setProject] = createSignal<Project | null>(null);
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [notes, setNotes] = createSignal<Note[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [newTitle, setNewTitle] = createSignal("");
  const [newDescription, setNewDescription] = createSignal("");
  const [noteTitle, setNoteTitle] = createSignal("");
  const [noteContent, setNoteContent] = createSignal("");
  const [noteTags, setNoteTags] = createSignal("");
  const [savingNote, setSavingNote] = createSignal(false);
  const [memberUsername, setMemberUsername] = createSignal("");
  const [invitingMember, setInvitingMember] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editTitle, setEditTitle] = createSignal("");
  const [editDescription, setEditDescription] = createSignal("");

  const notify = (message: string, type: NotificationType = "info") => {
    props.onNotify?.(message, type);
  };

  const getHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (props.jwtToken) {
      headers.Authorization = `Bearer ${props.jwtToken}`;
    }
    return headers;
  };

  const handleUnauthorized = () => {
    const message = "Please authenticate before viewing project details.";
    setError(message);
    notify(message, "warning");
  };

  const handleFetchError = async (response: Response) => {
    let message = "Unable to reach the server.";
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      } else {
        message = `${response.statusText} (${response.status})`;
      }
    } catch {
      message = `${response.statusText} (${response.status})`;
    }
    setError(message);
    notify(message, "error");
  };

  const parseTags = (input: string) =>
    input
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

  const fetchProject = async (projectId: string) => {
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    setLoading(true);
    setError(null);
    setProject(null);
    setTasks([]);
    setNotes([]);

    try {
      const response = await fetch(`${apiUrl()}/projects/${encodeURIComponent(projectId)}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const data = (await response.json()) as { project: Project; tasks: Task[]; notes?: Note[] };
      setProject(data.project);
      setTasks(data.tasks ?? []);
      setNotes(data.notes ?? []);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load project data.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    const projectId = props.projectId?.trim();
    if (!projectId) {
      setProject(null);
      setTasks([]);
      setNotes([]);
      setLoading(false);
      const message = "Project identifier is missing.";
      setError(message);
      return;
    }

    void fetchProject(projectId);
  });

  const handleBack = () => {
    props.onNavigate?.("/projects");
  };

  const updateTask = async (
    id: string,
    body: Partial<{ title: string; description: string; completed: boolean }>,
    successMessage?: string
  ) => {
    if (!props.jwtToken) {
      handleUnauthorized();
      return null;
    }

    try {
      const response = await fetch(`${apiUrl()}/tasks/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        await handleFetchError(response);
        return null;
      }

      const updated = (await response.json()) as Task;
      setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)));

      if (successMessage) {
        notify(successMessage, "success");
      }

      return updated;
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to update task.";
      setError(message);
      notify(message, "error");
      return null;
    }
  };

  const handleCreateTask = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    const title = newTitle().trim();
    if (!title) {
      const message = "Task title cannot be empty.";
      setError(message);
      notify(message, "warning");
      return;
    }

    const currentProject = project();
    if (!currentProject) {
      const message = "Project information is missing.";
      setError(message);
      notify(message, "warning");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/tasks`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          title,
          description: newDescription().trim(),
          projectId: currentProject.id
        })
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const created = (await response.json()) as Task;
      setTasks((current) => [created, ...current]);
      setNewTitle("");
      setNewDescription("");
      notify("Task created", "success");
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to create task.";
      setError(message);
      notify(message, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleInviteMember = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    const usernameToInvite = memberUsername().trim();
    if (!usernameToInvite) {
      const message = "Username is required to invite someone.";
      setError(message);
      notify(message, "warning");
      return;
    }

    const projectId = project()?.id ?? props.projectId?.trim();
    if (!projectId) {
      const message = "Project identifier is missing.";
      setError(message);
      notify(message, "warning");
      return;
    }

    setInvitingMember(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/projects/${encodeURIComponent(projectId)}/members`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ username: usernameToInvite })
      });
      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const data = (await response.json()) as { project: Project };
      setProject(data.project);
      setMemberUsername("");
      notify("Collaborator invited", "success");
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to invite collaborator.";
      setError(message);
      notify(message, "error");
    } finally {
      setInvitingMember(false);
    }
  };

  const handleCreateNote = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    const title = noteTitle().trim();
    if (!title) {
      const message = "Note title is required.";
      setError(message);
      notify(message, "warning");
      return;
    }

    const currentProject = project();
    if (!currentProject) {
      const message = "Project data is not available.";
      setError(message);
      notify(message, "warning");
      return;
    }

    setSavingNote(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/notes`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          title,
          content: noteContent().trim(),
          tags: parseTags(noteTags()),
          projectId: currentProject.id
        })
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const created = (await response.json()) as Note;
      setNotes((current) => [created, ...current]);
      setNoteTitle("");
      setNoteContent("");
      setNoteTags("");
      notify("Note saved to project", "success");
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to save note.";
      setError(message);
      notify(message, "error");
    } finally {
      setSavingNote(false);
    }
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleEditSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    const id = editingId();
    if (!id) return;

    const title = editTitle().trim();
    if (!title) {
      const message = "Task title cannot be empty.";
      setError(message);
      notify(message, "warning");
      return;
    }

    setEditing(true);
    try {
      const updatedTask = await updateTask(
        id,
        { title, description: editDescription().trim() },
        "Task updated"
      );

      if (updatedTask) {
        setEditingId(null);
      }
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    try {
      const response = await fetch(`${apiUrl()}/tasks/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: getHeaders()
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      setTasks((current) => current.filter((task) => task.id !== id));
      notify("Task removed", "success");
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to remove task.";
      setError(message);
      notify(message, "error");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    try {
      const response = await fetch(`${apiUrl()}/notes/${encodeURIComponent(noteId)}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (!response.ok) {
        await handleFetchError(response);
        return;
      }
      setNotes((current) => current.filter((note) => note.id !== noteId));
      notify("Note removed from project", "info");
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to remove note.";
      setError(message);
      notify(message, "error");
    }
  };

  const handleToggleCompleted = (task: Task) => {
    void updateTask(task.id, { completed: !task.completed }, "Task status saved");
  };

  return (
    <section class="project-detail-layout">
      <div class="project-detail-columns">
      <section class="tasks-card">
        <div class="project-detail-header">
          {props.onNavigate && (
            <button type="button" class="ghost" onClick={handleBack}>
              Back to projects
            </button>
          )}
          <div>
            <h1>{project()?.title ?? "Project details"}</h1>
            <p class="table-description">
              {project()?.description || "No description provided."}
            </p>
          </div>
        </div>

        <Show when={project()}>
          <div class="project-member-panel">
            <p class="helper-text">
              Owner: <strong>{project()?.owner}</strong>
            </p>
            <p class="helper-text">
              Members:
              <Show
                when={(project()?.members.length ?? 0) > 0}
                fallback={<span class="member-empty">No collaborators yet.</span>}
              >
                <For each={project()?.members ?? []}>
                  {(member) => <span class="member-chip">{member}</span>}
                </For>
              </Show>
            </p>
            <form class="member-form" onSubmit={handleInviteMember}>
              <label>
                Invite collaborator
                <input
                  class="text-input"
                  value={memberUsername()}
                  onInput={(event) => setMemberUsername(event.currentTarget.value)}
                  placeholder="Username"
                  required
                />
              </label>
              <button class="primary" type="submit" disabled={invitingMember()}>
                {invitingMember() ? "Inviting..." : "Add person"}
              </button>
            </form>
          </div>
        </Show>

          <form class="task-form" onSubmit={handleCreateTask}>
            <label>
              Title
              <input
                class="text-input"
                value={newTitle()}
                onInput={(event) => setNewTitle(event.currentTarget.value)}
                placeholder="Task title"
                required
              />
            </label>
            <label>
              Description (optional)
              <textarea
                class="text-input"
                value={newDescription()}
                onInput={(event) => setNewDescription(event.currentTarget.value)}
                rows={3}
                placeholder="Describe what needs to be done"
              />
            </label>
            <button class="primary" type="submit" disabled={creating()}>
              {creating() ? "Saving..." : "Add task"}
            </button>
          </form>

          <Show when={editingId()}>
            <div class="edit-modal-wrapper">
              <section class="edit-panel">
                <h2>Editing task</h2>
                <form onSubmit={handleEditSubmit}>
                  <label>
                    Title
                    <input
                      class="text-input"
                      value={editTitle()}
                      onInput={(event) => setEditTitle(event.currentTarget.value)}
                      required
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      class="text-input"
                      rows={3}
                      value={editDescription()}
                      onInput={(event) => setEditDescription(event.currentTarget.value)}
                    />
                  </label>
                  <div class="edit-actions">
                    <button type="button" class="ghost" onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button class="primary" type="submit" disabled={editing()}>
                      {editing() ? "Saving..." : "Save"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </Show>

          <Show when={error()}>
            <p class="helper-text">{error()}</p>
          </Show>

          <Show when={loading()}>
            <p class="helper-text">Loading project...</p>
          </Show>

          <Show when={!loading() && project()}>
            <p class="helper-text">
              {tasks().length} task{tasks().length === 1 ? "" : "s"} attached to this project.
            </p>

            <Show when={tasks().length === 0}>
              <p class="helper-text">No tasks are linked to this project yet.</p>
            </Show>

            <Show when={tasks().length > 0}>
              <div class="tasks-table-wrapper">
                <table class="tasks-table">
                  <thead>
                    <tr>
                      <th>Title &amp; description</th>
                      <th>Status</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={tasks()}>
                      {(task) => (
                        <tr class={task.completed ? "completed" : ""}>
                          <td>
                            <strong>{task.title}</strong>
                            <p class="table-description">
                              {task.description || "No description provided."}
                            </p>
                          </td>
                          <td>
                            <span class={`status-pill ${task.completed ? "completed" : ""}`}>
                              {task.completed ? "Completed" : "Pending"}
                            </span>
                          </td>
                          <td>
                            <span>Updated {new Date(task.updatedAt).toLocaleString()}</span>
                          </td>
                          <td>
                            <div class="task-actions">
                              <button
                                type="button"
                                class="ghost"
                                onClick={() => handleToggleCompleted(task)}
                              >
                                {task.completed ? "Undo" : "Complete"}
                              </button>
                              <button type="button" class="ghost" onClick={() => startEdit(task)}>
                                Edit
                              </button>
                              <button type="button" class="ghost" onClick={() => handleDelete(task.id)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Show>
        </section>

        <Show when={!loading() && project()}>
          <article class="knowledge-panel project-notes-card">
            <h2>Project notes</h2>
            <p class="helper-text">
              Capture quick guidance, insights, or reminders that live alongside this project.
            </p>

            <form class="knowledge-form" onSubmit={handleCreateNote}>
              <label>
                Title
                <input
                  class="text-input"
                  value={noteTitle()}
                  onInput={(event) => setNoteTitle(event.currentTarget.value)}
                  placeholder="Note title"
                  required
                />
              </label>
              <label>
                Content
                <textarea
                  class="text-input knowledge-textarea"
                  value={noteContent()}
                  onInput={(event) => setNoteContent(event.currentTarget.value)}
                  placeholder="Details or context for this note"
                />
              </label>
              <label>
                Tags (comma separated)
                <input
                  class="text-input"
                  value={noteTags()}
                  onInput={(event) => setNoteTags(event.currentTarget.value)}
                />
              </label>
              <button class="primary" type="submit" disabled={savingNote()}>
                {savingNote() ? "Saving..." : "Save note"}
              </button>
            </form>

            <Show when={notes().length === 0}>
              <p class="helper-text">No notes attached to this project yet.</p>
            </Show>

            <Show when={notes().length > 0}>
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
            </Show>
          </article>
        </Show>
      </div>
    </section>
  );
};

export default ProjectPage;

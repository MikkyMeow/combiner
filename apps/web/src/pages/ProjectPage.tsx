import { createEffect, createSignal, For, Show } from "solid-js";
import type { NotificationType } from "../components/notifications/useNotifications";
import type { Project } from "../types/project";
import {
  TASK_STATUS_OPTIONS,
  getStatusRowClass,
  getStatusPillClass
} from "../types/task";
import type { TaskRecord, TaskStatus } from "../types/task";

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

type ProjectPageProps = {
  projectId: string | null;
  jwtToken: string | null;
  onNotify?: (message: string, type?: NotificationType) => void;
  onNavigate?: (path: string) => void;
  onUnauthorized?: () => void;
};

const ProjectPage = (props: ProjectPageProps) => {
  const [project, setProject] = createSignal<Project | null>(null);
  const [tasks, setTasks] = createSignal<TaskRecord[]>([]);
  const [notes, setNotes] = createSignal<Note[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [newTitle, setNewTitle] = createSignal("");
  const [newDescription, setNewDescription] = createSignal("");
  const [newStatus, setNewStatus] = createSignal<TaskStatus>(TASK_STATUS_OPTIONS[0]);
  const [noteTitle, setNoteTitle] = createSignal("");
  const [noteContent, setNoteContent] = createSignal("");
  const [noteTags, setNoteTags] = createSignal("");
  const [savingNote, setSavingNote] = createSignal(false);
  const [memberUsername, setMemberUsername] = createSignal("");
  const [invitingMember, setInvitingMember] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<"tasks" | "notes">("tasks");

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
    if (response.status === 401) {
      props.onUnauthorized?.();
      return;
    }
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

      const data = (await response.json()) as { project: Project; tasks: TaskRecord[]; notes?: Note[] };
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
    body: Partial<{ title: string; description: string; status: TaskStatus }>,
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

      const updated = (await response.json()) as TaskRecord;
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
          projectId: currentProject.id,
          status: newStatus()
        })
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const created = (await response.json()) as TaskRecord;
      setTasks((current) => [created, ...current]);
      setNewTitle("");
      setNewDescription("");
      setNewStatus(TASK_STATUS_OPTIONS[0]);
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

  const handleChangeStatus = (task: TaskRecord, nextStatus: TaskStatus) => {
    if (task.status === nextStatus) return;
    void updateTask(task.id, { status: nextStatus }, "Task status saved");
  };

  const viewTaskDetail = (task: TaskRecord) => {
    props.onNavigate?.(`/tasks/${encodeURIComponent(task.id)}`);
  };

  return (
    <section class="project-detail-layout">
      <div class="project-header">
        <div class="project-header__info">
          {props.onNavigate && (
            <button type="button" class="ghost" onClick={handleBack}>
              Back to projects
            </button>
          )}
          <h1>{project()?.title ?? "Project details"}</h1>
          <p class="project-description">
            {project()?.description || "No description provided."}
          </p>
          <Show when={project()}>
            <p class="helper-text">
              Scope: {project()?.visibility === "corporate" ? "Corporate" : "Private"}
            </p>
          </Show>
        </div>

        <Show when={project()}>
          <aside class="project-header__members">
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
          </aside>
        </Show>
      </div>

      <Show when={error()}>
        <p class="helper-text">{error()}</p>
      </Show>

      <div class="project-tabs" role="tablist">
        <button
          classList={{ "project-tab": true, "project-tab--active": activeTab() === "tasks" }}
          type="button"
          role="tab"
          aria-selected={activeTab() === "tasks"}
          onClick={() => setActiveTab("tasks")}
        >
          Tasks
        </button>
        <button
          classList={{ "project-tab": true, "project-tab--active": activeTab() === "notes" }}
          type="button"
          role="tab"
          aria-selected={activeTab() === "notes"}
          onClick={() => setActiveTab("notes")}
        >
          Notes
        </button>
      </div>

      <Show when={loading()}>
        <p class="helper-text">Loading project...</p>
      </Show>

      <Show when={!loading() && project() && activeTab() === "tasks"}>
        <section class="tasks-panel">
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
            <label>
              Status
              <select
                class="status-select"
                value={newStatus()}
                onInput={(event) => setNewStatus(event.currentTarget.value as TaskStatus)}
              >
                <For each={TASK_STATUS_OPTIONS}>
                  {(option) => <option value={option}>{option}</option>}
                </For>
              </select>
            </label>
            <button class="primary" type="submit" disabled={creating()}>
              {creating() ? "Saving..." : "Add task"}
            </button>
          </form>

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
                      <tr class={`status-row ${getStatusRowClass(task.status)}`}>
                        <td>
                          <strong>{task.title}</strong>
                          <p class="table-description">
                            {task.description || "No description provided."}
                          </p>
                        </td>
                        <td>
                          <div class="status-cell">
                            <span class={`status-pill ${getStatusPillClass(task.status)}`}>
                              {task.status}
                            </span>
                            <select
                              class="status-select"
                              value={task.status}
                              onInput={(event) =>
                                handleChangeStatus(task, event.currentTarget.value as TaskStatus)
                              }
                            >
                              <For each={TASK_STATUS_OPTIONS}>
                                {(option) => <option value={option}>{option}</option>}
                              </For>
                            </select>
                          </div>
                        </td>
                        <td>
                          <span>Updated {new Date(task.updatedAt).toLocaleString()}</span>
                        </td>
                        <td>
                          <div class="task-actions">
                            <button
                              type="button"
                              class="ghost"
                              onClick={() => viewTaskDetail(task)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              class="ghost"
                              onClick={() => handleDelete(task.id)}
                            >
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
        </section>
      </Show>

      <Show when={!loading() && project() && activeTab() === "notes"}>
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
    </section>
  );
};

export default ProjectPage;

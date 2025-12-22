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
};

type Project = {
  id: string;
  title: string;
  description: string;
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
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [newTitle, setNewTitle] = createSignal("");
  const [newDescription, setNewDescription] = createSignal("");
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

  const fetchProject = async (projectId: string) => {
    if (!props.jwtToken) {
      handleUnauthorized();
      return;
    }

    setLoading(true);
    setError(null);
    setProject(null);
    setTasks([]);

    try {
      const response = await fetch(`${apiUrl()}/projects/${encodeURIComponent(projectId)}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const data = (await response.json()) as { project: Project; tasks: Task[] };
      setProject(data.project);
      setTasks(data.tasks ?? []);
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

  const handleToggleCompleted = (task: Task) => {
    void updateTask(task.id, { completed: !task.completed }, "Task status saved");
  };

  return (
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
  );
};

export default ProjectPage;

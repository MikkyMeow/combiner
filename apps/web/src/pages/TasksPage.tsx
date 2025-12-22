import { createSignal, For, Show, onMount } from "solid-js";
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

type TasksPageProps = {
  jwtToken: string | null;
  onNotify?: (message: string, type?: NotificationType) => void;
};

type TaskUpdatePayload = {
  title?: string;
  description?: string;
  completed?: boolean;
  projectId?: string | null;
};

const TasksPage = ({ jwtToken, onNotify }: TasksPageProps) => {
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [creating, setCreating] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [newTitle, setNewTitle] = createSignal("");
  const [newDescription, setNewDescription] = createSignal("");
  const [newProjectId, setNewProjectId] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editTitle, setEditTitle] = createSignal("");
  const [editDescription, setEditDescription] = createSignal("");
  const [editProjectId, setEditProjectId] = createSignal("");
  const editingTask = () => tasks().find((task) => task.id === editingId());

  const notify = (message: string, type: NotificationType = "info") => {
    onNotify?.(message, type);
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
    const message = "Please authenticate before managing tasks.";
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

  const getProjectLabel = (projectId?: string | null) => {
    if (!projectId) {
      return "Unassigned";
    }
    return projects().find((project) => project.id === projectId)?.title ?? "Unknown project";
  };

  const fetchProjects = async () => {
    if (!jwtToken) {
      return;
    }

    try {
      const response = await fetch(`${apiUrl()}/projects`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const data = (await response.json()) as { projects: Project[] };
      setProjects(data.projects ?? []);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load projects.";
      setError(message);
      notify(message, "error");
    }
  };

  const fetchTasks = async () => {
    if (!jwtToken) {
      handleUnauthorized();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/tasks`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const data = (await response.json()) as { tasks: Task[] };
      setTasks(data.tasks ?? []);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load tasks.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void fetchTasks();
    void fetchProjects();
  });

  const handleCreateTask = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!jwtToken) {
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

    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/tasks`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          title,
          description: newDescription().trim()
          ,
          projectId: newProjectId()
        })
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const createdTask = (await response.json()) as Task;
      setTasks((current) => [createdTask, ...current]);
      setNewTitle("");
      setNewDescription("");
      setNewProjectId("");
      notify("Task created", "success");
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to create task.";
      setError(message);
      notify(message, "error");
    } finally {
      setCreating(false);
    }
  };

  const updateTask = async (id: string, body: TaskUpdatePayload, successMessage?: string) => {
    if (!jwtToken) {
      handleUnauthorized();
      return null;
    }

    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/tasks/${id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        await handleFetchError(response);
        return null;
      }

      const updatedTask = (await response.json()) as Task;
      setTasks((current) =>
        current.map((task) => (task.id === updatedTask.id ? updatedTask : task))
      );

      if (successMessage) {
        notify(successMessage, "success");
      }

      return updatedTask;
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to update task.";
      setError(message);
      notify(message, "error");
      return null;
    }
  };

  const handleToggleCompleted = (task: Task) => {
    void updateTask(task.id, { completed: !task.completed }, "Task status saved");
  };

  const handleDelete = async (id: string) => {
    if (!jwtToken) {
      handleUnauthorized();
      return;
    }

    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/tasks/${id}`, {
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

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditProjectId(task.projectId ?? "");
  };

  const handleEditSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    const id = editingId();
    if (!id) {
      return;
    }

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
        { title, description: editDescription().trim(), projectId: editProjectId() },
        "Task updated"
      );

      if (updatedTask) {
        setEditingId(null);
        setEditProjectId("");
      }
    } finally {
      setEditing(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditProjectId("");
  };

  return (
    <section class="tasks-card">
      <h1>Tasks</h1>
      <form class="task-form" onSubmit={handleCreateTask}>
        <label>
          Title
          <input
            class="text-input"
            value={newTitle()}
            onInput={(event) => setNewTitle(event.currentTarget.value)}
            placeholder="Short summary of the task"
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
            placeholder="More details about what needs to be done"
          />
        </label>
        <label>
          Project (optional)
          <select
            class="text-input"
            value={newProjectId()}
            onChange={(event) => setNewProjectId(event.currentTarget.value)}
          >
            <option value="">Unassigned</option>
            <For each={projects()}>
              {(project) => (
                <option value={project.id}>{project.title}</option>
              )}
            </For>
          </select>
        </label>
        <button class="primary" type="submit" disabled={creating()}>
          {creating() ? "Saving…" : "New Task"}
        </button>
      </form>

      <Show when={error()}>
        <p class="helper-text">{error()}</p>
      </Show>

      <Show when={loading()}>
        <p class="helper-text">Loading tasks…</p>
      </Show>

      <Show when={!loading() && tasks().length === 0}>
        <p class="helper-text">You currently have no tasks.</p>
      </Show>

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
            <label>
              Project (optional)
              <select
                class="text-input"
                value={editProjectId()}
                onChange={(event) => setEditProjectId(event.currentTarget.value)}
              >
                <option value="">Unassigned</option>
                <For each={projects()}>
                  {(project) => (
                    <option value={project.id}>{project.title}</option>
                  )}
                </For>
              </select>
            </label>
            <div class="edit-actions">
              <button type="button" class="ghost" onClick={cancelEdit}>
                Cancel
              </button>
              <button class="primary" type="submit" disabled={editing()}>
                {editing() ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
          <p class="helper-text">
            Editing: <strong>{editingTask()?.title || "…"}</strong>
          </p>
          </section>
        </div>
      </Show>

      <div class="tasks-table-wrapper">
        <table class="tasks-table">
          <thead>
            <tr>
              <th>Title &amp; description</th>
              <th>Project</th>
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
                    <p class="table-description">{task.description || "No description provided."}</p>
                  </td>
                  <td>{getProjectLabel(task.projectId)}</td>
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
    </section>
  );
};

export default TasksPage;

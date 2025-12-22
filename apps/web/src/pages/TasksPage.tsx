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
};

type TasksPageProps = {
  jwtToken: string | null;
  onNotify?: (message: string, type?: NotificationType) => void;
};

type TaskUpdatePayload = {
  title?: string;
  description?: string;
  completed?: boolean;
};

const TasksPage = ({ jwtToken, onNotify }: TasksPageProps) => {
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [creating, setCreating] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [newTitle, setNewTitle] = createSignal("");
  const [newDescription, setNewDescription] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editTitle, setEditTitle] = createSignal("");
  const [editDescription, setEditDescription] = createSignal("");

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

  const cancelEdit = () => {
    setEditingId(null);
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

      <div class="tasks-list">
        <For each={tasks()}>
          {(task) => (
            <article class={`task-card ${task.completed ? "completed" : ""}`}>
              <header class="task-header">
                <strong>{task.title}</strong>
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
              </header>
              <p>{task.description || "No description provided."}</p>
              <div class="task-meta">
                <span>Updated {new Date(task.updatedAt).toLocaleString()}</span>
              </div>

              <Show when={editingId() === task.id}>
                <form class="task-editor" onSubmit={handleEditSubmit}>
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
                      {editing() ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              </Show>
            </article>
          )}
        </For>
      </div>
    </section>
  );
};

export default TasksPage;

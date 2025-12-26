import { createEffect, createSignal, Show } from "solid-js";
import type { NotificationType } from "../components/notifications/useNotifications";
import {
  TASK_STATUS_OPTIONS,
  getStatusPillClass
} from "../types/task";
import type { TaskRecord, TaskStatus } from "../types/task";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type TaskPageProps = {
  taskId: string;
  jwtToken: string | null;
  onNotify?: (message: string, type?: NotificationType) => void;
  onNavigate?: (path: string) => void;
  onUnauthorized?: () => void;
};

const TaskPage = (props: TaskPageProps) => {
  const [task, setTask] = createSignal<TaskRecord | null>(null);
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [status, setStatus] = createSignal<TaskStatus>(TASK_STATUS_OPTIONS[0]);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

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
    const message = "Please authenticate before viewing task details.";
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

  const loadTask = async (id: string) => {
    if (!props.jwtToken) {
      handleUnauthorized();
      setLoading(false);
      setTask(null);
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

      const data = (await response.json()) as { tasks: TaskRecord[] };
      const found = data.tasks.find((entry) => entry.id === id);
      if (!found) {
        const message = "Task not found.";
        setError(message);
        setTask(null);
        return;
      }

      setTask(found);
      setTitle(found.title);
      setDescription(found.description ?? "");
      setStatus(found.status);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load task.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    const id = props.taskId;
    if (!id) {
      setTask(null);
      setError("Task identifier is missing.");
      setLoading(false);
      return;
    }
    void loadTask(id);
  });

  const updateTask = async (
    id: string,
    body: Partial<{ title: string; description: string; status: TaskStatus }>,
    successMessage?: string
  ) => {
    if (!props.jwtToken) {
      handleUnauthorized();
      return null;
    }

    setError(null);
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
      setTask(updated);
      setTitle(updated.title);
      setDescription(updated.description ?? "");
      setStatus(updated.status);
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

  const handleSave = async (event: SubmitEvent) => {
    event.preventDefault();
    const current = task();
    if (!current) {
      return;
    }

    const trimmedTitle = title().trim();
    if (!trimmedTitle) {
      const message = "Task title cannot be empty.";
      setError(message);
      notify(message, "warning");
      return;
    }

    setSaving(true);
    try {
      await updateTask(
        current.id,
        { title: trimmedTitle, description: description().trim() },
        "Task saved"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (nextStatus: TaskStatus) => {
    const current = task();
    if (!current || current.status === nextStatus) {
      setStatus(nextStatus);
      return;
    }
    void updateTask(current.id, { status: nextStatus }, "Task status updated");
  };

  const handleBack = () => {
    if (props.onNavigate) {
      const projectId = task()?.projectId;
      if (projectId) {
        props.onNavigate(`/projects/${encodeURIComponent(projectId)}`);
        return;
      }
      props.onNavigate("/projects");
      return;
    }

    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  return (
    <section class="tasks-card task-detail-card">
      <div class="task-detail-header">
        <button type="button" class="ghost" onClick={handleBack}>
          Back
        </button>
        <div>
          <h1>{task()?.title ?? "Task details"}</h1>
            <p class="table-description">
              <Show
                when={task()}
                fallback="Loading task information..."
              >
                {(current) => (
                  <span>Updated {new Date(current().updatedAt).toLocaleString()}</span>
                )}
              </Show>
            </p>
        </div>
      </div>

      <Show when={error()}>
        <p class="helper-text">{error()}</p>
      </Show>

      <Show when={loading()}>
        <p class="helper-text">Loading task...</p>
      </Show>

      <Show when={!loading() && task()}>
        <div class="task-detail-summary">
          <span class={`status-pill ${getStatusPillClass(status())}`}>{status()}</span>
          <label class="status-field">
            Status
            <select
              class="status-select"
              value={status()}
              onInput={(event) => handleStatusChange(event.currentTarget.value as TaskStatus)}
            >
              <For each={TASK_STATUS_OPTIONS}>
                {(option) => <option value={option}>{option}</option>}
              </For>
            </select>
          </label>
          <p class="helper-text">
            {task()?.projectId ? "Linked to project" : "No project assigned."}
            <Show when={task()?.projectId}>
              {(projectId) => <span> {projectId()}</span>}
            </Show>
          </p>
        </div>

        <form class="task-form" onSubmit={handleSave}>
          <label>
            Title
            <input
              class="text-input"
              value={title()}
              onInput={(event) => setTitle(event.currentTarget.value)}
              required
            />
          </label>
          <label>
            Description
            <textarea
              class="text-input"
              rows={3}
              value={description()}
              onInput={(event) => setDescription(event.currentTarget.value)}
            />
          </label>
          <div class="edit-actions">
            <button type="button" class="ghost" onClick={handleBack}>
              Cancel
            </button>
            <button class="primary" type="submit" disabled={saving()}>
              {saving() ? "Saving..." : "Save"}
            </button>
          </div>
        </form>

      </Show>
    </section>
  );
};

export default TaskPage;

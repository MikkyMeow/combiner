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

const TasksPage = ({ jwtToken, onNotify }: TasksPageProps) => {
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

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

  return (
    <section class="tasks-card">
      <h1>Tasks</h1>
      <p class="helper-text">
        Tasks are now created and managed within project pages; this view only surfaces deadlines and overall status across every project.
      </p>

      <Show when={error()}>
        <p class="helper-text">{error()}</p>
      </Show>

      <Show when={loading()}>
        <p class="helper-text">Loading tasks...</p>
      </Show>

      <Show when={!loading() && tasks().length === 0}>
        <p class="helper-text">You currently have no tasks.</p>
      </Show>

      <div class="tasks-table-wrapper">
        <table class="tasks-table">
          <thead>
            <tr>
              <th>Title &amp; description</th>
              <th>Project</th>
              <th>Status</th>
              <th>Updated</th>
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

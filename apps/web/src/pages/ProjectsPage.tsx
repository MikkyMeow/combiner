import { createSignal, For, Show, onMount } from "solid-js";
import type { NotificationType } from "../components/notifications/useNotifications";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type Project = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  members: string[];
};

type ProjectsPageProps = {
  jwtToken: string | null;
  onNotify?: (message: string, type?: NotificationType) => void;
  onNavigate?: (path: string) => void;
};

const ProjectsPage = ({ jwtToken, onNotify, onNavigate }: ProjectsPageProps) => {
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [creating, setCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [newTitle, setNewTitle] = createSignal("");
  const [newDescription, setNewDescription] = createSignal("");
  const [isCreateModalOpen, setCreateModalOpen] = createSignal(false);

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
    const message = "Please authenticate before managing projects.";
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

  const fetchProjects = async () => {
    if (!jwtToken) {
      handleUnauthorized();
      return;
    }

    setLoading(true);
    setError(null);
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
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void fetchProjects();
  });

  const resetCreateForm = () => {
    setNewTitle("");
    setNewDescription("");
  };

  const openCreateModal = () => {
    setError(null);
    resetCreateForm();
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (creating()) return;
    setCreateModalOpen(false);
    resetCreateForm();
  };

  const handleCreateProject = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!jwtToken) {
      handleUnauthorized();
      return;
    }

    const title = newTitle().trim();
    if (!title) {
      const message = "Project title cannot be empty.";
      setError(message);
      notify(message, "warning");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/projects`, {
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

      const createdProject = (await response.json()) as Project;
      setProjects((current) => [createdProject, ...current]);
      notify("Project created", "success");
      closeCreateModal();
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to create project.";
      setError(message);
      notify(message, "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section class="tasks-card">
      <div class="projects-card-header">
        <h1>Projects</h1>
        <button
          type="button"
          class="primary projects-create-button"
          aria-label="Create project"
          onClick={openCreateModal}
        >
          +
        </button>
      </div>

      <Show when={error()}>
        <p class="helper-text">{error()}</p>
      </Show>

      <Show when={loading()}>
        <p class="helper-text">Loading projects...</p>
      </Show>

      <Show when={!loading() && projects().length === 0}>
        <p class="helper-text">You currently have no projects.</p>
      </Show>

      <Show when={!loading() && projects().length > 0}>
        <div class="projects-list">
          <For each={projects()}>
            {(project) => (
              <button
                type="button"
                class="project-card"
                onClick={() => onNavigate?.(`/projects/${project.id}`)}
              >
                <div>
                  <strong>{project.title}</strong>
                  <p class="project-description">
                    {project.description || "No description provided."}
                  </p>
                </div>
                <span class="project-updated">
                  Updated {new Date(project.updatedAt).toLocaleString()}
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={isCreateModalOpen()}>
        <div class="modal-container">
          <div class="modal-backdrop" role="presentation" onClick={closeCreateModal} />
          <section class="modal-panel" onClick={(event) => event.stopPropagation()}>
            <h2>New project</h2>
            <form onSubmit={handleCreateProject}>
              <label>
                Title
                <input
                  class="text-input"
                  value={newTitle()}
                  onInput={(event) => setNewTitle(event.currentTarget.value)}
                  placeholder="Short summary of the project"
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
              <div class="edit-actions">
                <button type="button" class="ghost" onClick={closeCreateModal} disabled={creating()}>
                  Cancel
                </button>
                <button class="primary" type="submit" disabled={creating()}>
                  {creating() ? "Saving..." : "Create project"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </Show>
    </section>
  );
};

export default ProjectsPage;

import { createEffect, createSignal, For, Show } from "solid-js";
import type { NotificationType } from "../components/notifications/useNotifications";
import type { UserRole } from "../types/user";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type Project = {
  id: string;
  title: string;
  description: string;
  owner: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
};

type TeamsPageProps = {
  jwtToken: string | null;
  userRole: UserRole | null;
  onNotify?: (message: string, type?: NotificationType) => void;
};

const formatDate = (value: string) => new Date(value).toLocaleString();

const TeamsPage = (props: TeamsPageProps) => {
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const allowed = () => props.userRole === "owner" || props.userRole === "employee";

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

  const handleFetchError = async (response: Response) => {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      /* ignore */
    }
    setError(message);
    setProjects([]);
    notify(message, "error");
  };

  const loadTeams = async () => {
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
      const payload = (await response.json()) as { projects: Project[] };
      setProjects(payload.projects ?? []);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load team data.";
      setError(message);
      setProjects([]);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (!allowed()) {
      setProjects([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!props.jwtToken) {
      setProjects([]);
      setLoading(false);
      setError("Please sign in to view the teams overview.");
      return;
    }

    void loadTeams();
  });

  return (
    <section class="profile-page">
      <div>
        <h1>Teams</h1>
        <p class="helper-text">
          Owners and employees can monitor active projects and the teammates assigned to them.
        </p>
      </div>

      <Show when={!allowed()}>
        <p class="helper-text">Teams insights are only available to owner and employee roles.</p>
      </Show>

      <Show when={allowed()}>
        <Show when={loading()}>
          <p class="helper-text">Loading team overview...</p>
        </Show>

        <Show when={!loading()}>
          <Show when={error()}>
            <p class="helper-text">{error()}</p>
          </Show>

          <Show when={!error()}>
            <Show when={projects().length > 0}>
              <div class="profile-grid">
                <For each={projects()}>
                  {(project) => (
                    <article class="profile-card profile-card--emphasis">
                      <header class="profile-item-heading">
                        <div>
                          <strong>{project.title}</strong>
                          <p class="helper-text">{project.description || "No description yet."}</p>
                        </div>
                        <span class="small-text">Updated {formatDate(project.updatedAt)}</span>
                      </header>
                      <p class="small-text helper-text">Owner: {project.owner}</p>
                      <p class="small-text">
                        Members: {project.members.length > 0 ? project.members.join(", ") : "No members yet."}
                      </p>
                    </article>
                  )}
                </For>
              </div>
            </Show>

            <Show when={projects().length === 0}>
              <p class="helper-text">No active teams yet.</p>
            </Show>
          </Show>
        </Show>
      </Show>
    </section>
  );
};

export default TeamsPage;

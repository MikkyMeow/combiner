import { createSignal, For, Show, onMount } from "solid-js";
import type { NotificationType } from "../components/notifications/useNotifications";

const apiUrl = () => import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type UserRole = "owner" | "user" | "employee";
const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  user: "User",
  employee: "Employee"
};

type UserProfile = {
  username: string;
  createdAt: string;
  updatedAt: string;
  role: UserRole;
  company: string | null;
};

type Task = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
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

type Project = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  members: string[];
};

type ProfilePayload = {
  user: UserProfile;
  tasks: Task[];
  notes: Note[];
  projects: Project[];
};

type ProfilePageProps = {
  jwtToken: string | null;
  onNotify?: (message: string, type?: NotificationType) => void;
};

const formatDate = (value: string) => new Date(value).toLocaleString();

const notePreview = (note: Note) => {
  const trimmed = note.content.trim();
  if (!trimmed) return "No content yet.";
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
};

const ProfilePage = ({ jwtToken, onNotify }: ProfilePageProps) => {
  const [profile, setProfile] = createSignal<ProfilePayload | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [oldPassword, setOldPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [updateMessage, setUpdateMessage] = createSignal<string | null>(null);
  const [isPasswordModalOpen, setPasswordModalOpen] = createSignal(false);

  const notify = (message: string, type: NotificationType = "info") => {
    if (message) {
      onNotify?.(message, type);
    }
  };

  const resetPasswordInputs = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const openPasswordModal = () => {
    resetPasswordInputs();
    setPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    resetPasswordInputs();
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
    const message = "Please sign in to view your profile.";
    setError(message);
    setProfile(null);
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
      /* ignore */
    }
    setError(message);
    notify(message, "error");
  };

  const handleUpdateProfile = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!jwtToken) {
      handleUnauthorized();
      return;
    }

    const trimmedCurrent = oldPassword().trim();
    if (!trimmedCurrent) {
      const message = "Current password is required.";
      setError(message);
      notify(message, "warning");
      return;
    }

    const trimmedPassword = newPassword().trim();
    if (!trimmedPassword) {
      const message = "New password is required.";
      setError(message);
      notify(message, "warning");
      return;
    }

    if (trimmedPassword !== confirmPassword()) {
      const message = "Passwords do not match.";
      setError(message);
      notify(message, "warning");
      return;
    }

    setSaving(true);
    setError(null);
    setUpdateMessage(null);
    try {
      const response = await fetch(`${apiUrl()}/me`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({
          currentPassword: trimmedCurrent,
          newPassword: trimmedPassword
        })
      });

      if (!response.ok) {
        await handleFetchError(response);
        return;
      }

      const payload = (await response.json()) as ProfilePayload;
      setProfile(payload);
      resetPasswordInputs();
      setUpdateMessage("Password updated successfully.");
      notify("Password updated", "success");
      closePasswordModal();
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to update profile.";
      setError(message);
      notify(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const fetchProfile = async () => {
    if (!jwtToken) {
      handleUnauthorized();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl()}/me`, {
        headers: getHeaders()
      });
      if (!response.ok) {
        await handleFetchError(response);
        return;
      }
      const payload = (await response.json()) as ProfilePayload;
      setProfile(payload);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load profile data.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void fetchProfile();
  });

  return (
    <section class="profile-page">
      <h1>Profile</h1>
      <p class="helper-text">View your account details, recent tasks, notes, and projects in one place.</p>

      <div class="profile-form">
        <div class="profile-form__title-row">
          <h2 class="profile-form__title">Security</h2>
          <button
            type="button"
            class="ghost profile-form__action"
            onClick={openPasswordModal}
          >
            Change password
          </button>
        </div>
        <p class="helper-text">
          Keep your account safe by rotating your password. Open the dialog to update it.
        </p>
        <Show when={updateMessage()}>
          <p class="helper-text">{updateMessage()}</p>
        </Show>
      </div>

      <Show when={error()}>
        <p class="helper-text">{error()}</p>
      </Show>

      <Show when={isPasswordModalOpen()}>
        <div
          class="modal-container"
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-modal-title"
          onClick={closePasswordModal}
        >
          <div class="modal-backdrop" role="presentation" />
          <form
            class="modal-panel"
            onSubmit={handleUpdateProfile}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="password-modal-title">Change password</h2>
            <label>
              Current password
              <input
                class="text-input"
                type="password"
                value={oldPassword()}
                onInput={(event) => setOldPassword(event.currentTarget.value)}
                required
                minlength={8}
              />
            </label>
            <label>
              New password
              <input
                class="text-input"
                type="password"
                value={newPassword()}
                onInput={(event) => setNewPassword(event.currentTarget.value)}
                required
                minlength={8}
              />
            </label>
            <label>
              Confirm new password
              <input
                class="text-input"
                type="password"
                value={confirmPassword()}
                onInput={(event) => setConfirmPassword(event.currentTarget.value)}
                required
                minlength={8}
              />
            </label>
            <div class="modal-actions">
              <button type="button" class="ghost" onClick={closePasswordModal}>
                Cancel
              </button>
              <button class="primary" type="submit" disabled={saving()}>
                {saving() ? "Updating..." : "Update password"}
              </button>
            </div>
          </form>
        </div>
      </Show>

      <Show when={loading()}>
        <p class="helper-text">Loading profile...</p>
      </Show>

      <Show when={!loading() && profile()}>
        {(accessor) => {
          const data = accessor();
          const projectMap = new Map(data.projects.map((project) => [project.id, project]));
          const getProjectLabel = (projectId: string | null) =>
            projectId ? projectMap.get(projectId)?.title ?? "Unknown project" : "Unassigned";

          const latestTask = data.tasks[0];
          const latestNote = data.notes[0];
          const latestProject = data.projects[0];
          return (
            <>
              <div class="profile-hero">
                <article class="profile-card profile-hero__identity">
                  <p class="profile-hero__tag">Account</p>
                  <h2>{data.user.username}</h2>
                  <p class="profile-hero__subtitle">Member since {formatDate(data.user.createdAt)}</p>
                  <div class="profile-hero__meta">
                    <span>Role {ROLE_LABELS[data.user.role]}</span>
                    <Show when={data.user.company}>
                      <span>Company {data.user.company}</span>
                    </Show>
                    <span>Last updated {formatDate(data.user.updatedAt)}</span>
                    <span>{data.tasks.length} tasks · {data.notes.length} notes · {data.projects.length} projects</span>
                  </div>
                </article>
                <div class="profile-hero__stats">
                  <article class="profile-card profile-stat">
                    <p>Tasks</p>
                    <strong>{data.tasks.length}</strong>
                    <p class="small-text">Latest: {latestTask ? latestTask.title : "—"}</p>
                  </article>
                  <article class="profile-card profile-stat">
                    <p>Notes</p>
                    <strong>{data.notes.length}</strong>
                    <p class="small-text">Latest: {latestNote ? notePreview(latestNote) : "—"}</p>
                  </article>
                  <article class="profile-card profile-stat">
                    <p>Projects</p>
                    <strong>{data.projects.length}</strong>
                    <p class="small-text">Latest: {latestProject ? latestProject.title : "—"}</p>
                  </article>
                </div>
              </div>
              <div class="profile-grid">
                <article class="profile-card profile-card--emphasis">
                  <h2>Recent tasks ({data.tasks.length})</h2>
                  <Show when={data.tasks.length > 0}>
                    <ul>
                      <For each={data.tasks.slice(0, 5)}>
                        {(task) => (
                          <li>
                            <div class="profile-item-heading">
                              <strong>{task.title}</strong>
                              <span class={`status-pill ${task.completed ? "completed" : ""}`}>
                                {task.completed ? "Completed" : "Pending"}
                              </span>
                            </div>
                            <p class="small-text">
                              Updated {formatDate(task.updatedAt)} · {getProjectLabel(task.projectId)}
                            </p>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                  <Show when={data.tasks.length === 0}>
                    <p class="helper-text">No tasks yet.</p>
                  </Show>
                </article>

                <article class="profile-card profile-card--emphasis">
                  <h2>Recent notes ({data.notes.length})</h2>
                  <Show when={data.notes.length > 0}>
                    <ul>
                      <For each={data.notes.slice(0, 5)}>
                        {(note) => (
                          <li>
                            <div class="profile-item-heading">
                              <strong>{note.title}</strong>
                              <span class="small-text">{formatDate(note.updatedAt)}</span>
                            </div>
                            <p class="small-text">
                              {note.content || "No content yet."}
                              <Show when={note.tags.length > 0}>
                                <span class="small-text"> · Tags: {note.tags.join(", ")}</span>
                              </Show>
                            </p>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                  <Show when={data.notes.length === 0}>
                    <p class="helper-text">No notes yet.</p>
                  </Show>
                </article>

                <article class="profile-card profile-card--emphasis">
                  <h2>Projects ({data.projects.length})</h2>
                  <Show when={data.projects.length > 0}>
                    <ul>
                      <For each={data.projects.slice(0, 5)}>
                        {(project) => (
                          <li>
                            <strong>{project.title}</strong>
                            <p class="small-text">
                              Owner {project.owner} · {project.members.length} members
                            </p>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                  <Show when={data.projects.length === 0}>
                    <p class="helper-text">No projects yet.</p>
                  </Show>
                </article>
              </div>
            </>
          );
        }}
      </Show>
    </section>
  );
};

export default ProfilePage;

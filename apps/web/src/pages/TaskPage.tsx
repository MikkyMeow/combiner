import { createEffect, createSignal, For, Show } from "solid-js";
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

type CompanyMember = {
  username: string;
  role: string;
  company: string | null;
};

const PRIORITY_OPTIONS = ["low", "normal", "high", "critical"] as const;

const toDateInputValue = (value: string | null) => {
  if (!value) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
};

const mergeTags = (current: string[], additions: string[]) => {
  const seen = new Set(current.map((tag) => tag.toLowerCase()));
  const merged = current.slice();
  additions.forEach((tag) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(trimmed);
  });
  return merged;
};

const TaskPage = (props: TaskPageProps) => {
  const [task, setTask] = createSignal<TaskRecord | null>(null);
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [status, setStatus] = createSignal<TaskStatus>(TASK_STATUS_OPTIONS[0]);
  const [statusOptions, setStatusOptions] = createSignal<string[]>(TASK_STATUS_OPTIONS);
  const [assignee, setAssignee] = createSignal("");
  const [priority, setPriority] = createSignal("");
  const [dueDate, setDueDate] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [tagInput, setTagInput] = createSignal("");
  const [comments, setComments] = createSignal<string[]>([]);
  const [commentInput, setCommentInput] = createSignal("");
  const [companyMembers, setCompanyMembers] = createSignal<CompanyMember[]>([]);
  const [membersLoading, setMembersLoading] = createSignal(false);
  const [membersError, setMembersError] = createSignal<string | null>(null);
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

  const handleMembersError = async (response: Response) => {
    if (response.status === 401) {
      props.onUnauthorized?.();
      return;
    }
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      /* ignore */
    }
    setMembersError(message);
    setCompanyMembers([]);
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
      if (found.projectId) {
        void loadProjectStatuses(found.projectId, found.status);
      } else {
        setStatusOptions(TASK_STATUS_OPTIONS);
      }
      setAssignee(found.assignee ?? "");
      setPriority(found.priority ?? "");
      setDueDate(toDateInputValue(found.dueDate ?? null));
      setTags(found.tags ?? []);
      setComments(found.comments ?? []);
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load task.";
      setError(message);
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyMembers = async () => {
    if (!props.jwtToken) {
      setCompanyMembers([]);
      setMembersError(null);
      return;
    }

    setMembersLoading(true);
    setMembersError(null);
    try {
      const response = await fetch(`${apiUrl()}/me/company/members`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        await handleMembersError(response);
        return;
      }

      const payload = (await response.json()) as { members: CompanyMember[] };
      setCompanyMembers(payload.members ?? []);
    } catch (fetchError) {
      const message =
        (fetchError as Error).message || "Unable to load company members.";
      setMembersError(message);
      setCompanyMembers([]);
    } finally {
      setMembersLoading(false);
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

  createEffect(() => {
    if (!props.jwtToken) {
      setCompanyMembers([]);
      setMembersError(null);
      return;
    }
    void loadCompanyMembers();
  });

  const updateTask = async (
    id: string,
    body: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      assignee: string | null;
      priority: string | null;
      dueDate: string | null;
      tags: string[];
      comments: string[];
    }>,
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
      setAssignee(updated.assignee ?? "");
      setPriority(updated.priority ?? "");
      setDueDate(toDateInputValue(updated.dueDate ?? null));
      setTags(updated.tags ?? []);
      setComments(updated.comments ?? []);
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
        {
          title: trimmedTitle,
          description: description().trim(),
          assignee: assignee().trim() || null,
          priority: priority().trim() || null,
          dueDate: dueDate().trim() || null,
          tags: tags(),
          comments: comments()
        },
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

  const loadProjectStatuses = async (projectId: string, currentStatus: string) => {
    if (!props.jwtToken) {
      setStatusOptions(TASK_STATUS_OPTIONS);
      return;
    }
    try {
      const response = await fetch(`${apiUrl()}/projects/${encodeURIComponent(projectId)}`, {
        headers: getHeaders()
      });
      if (!response.ok) {
        await handleFetchError(response);
        return;
      }
      const payload = (await response.json()) as { project: { taskStatuses?: string[] } };
      const list = payload.project?.taskStatuses ?? [];
      if (list.length > 0) {
        setStatusOptions(
          list.includes(currentStatus) ? list : [...list, currentStatus]
        );
      } else {
        setStatusOptions(TASK_STATUS_OPTIONS);
      }
    } catch (fetchError) {
      const message = (fetchError as Error).message || "Unable to load project statuses.";
      setError(message);
      notify(message, "error");
      setStatusOptions(TASK_STATUS_OPTIONS);
    }
  };

  const handleAddTag = async () => {
    const current = task();
    if (!current) return;

    const input = tagInput().trim();
    if (!input) return;
    const additions = input.split(",").map((tag) => tag.trim());
    const nextTags = mergeTags(tags(), additions);
    if (nextTags.length === tags().length) {
      setTagInput("");
      return;
    }

    setTagInput("");
    void updateTask(current.id, { tags: nextTags }, "Tags updated");
  };

  const handleTagInputKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void handleAddTag();
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const current = task();
    if (!current) return;
    const nextTags = tags().filter((tag) => tag.toLowerCase() !== tagToRemove.toLowerCase());
    void updateTask(current.id, { tags: nextTags }, "Tags updated");
  };

  const handleAddComment = () => {
    const current = task();
    if (!current) return;
    const text = commentInput().trim();
    if (!text) return;
    const nextComments = [...comments(), text];
    setCommentInput("");
    void updateTask(current.id, { comments: nextComments }, "Comment added");
  };

  const handleCommentKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void handleAddComment();
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

  const assigneeOptions = () => {
    const members = companyMembers().map((member) => member.username);
    const current = assignee().trim();
    if (current && !members.includes(current)) {
      return [current, ...members];
    }
    return members;
  };

  const todayDate = () => new Date().toISOString().slice(0, 10);

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
              <For each={statusOptions()}>
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
          <label>
            Tags
            <Show when={tags().length > 0} fallback={<span class="helper-text">No tags yet.</span>}>
              <div class="task-tags">
                <For each={tags()}>
                  {(tag) => (
                    <span class="task-tag">
                      {tag}
                      <button
                        type="button"
                        class="task-tag__remove"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                      >
                        x
                      </button>
                    </span>
                  )}
                </For>
              </div>
            </Show>
            <div class="task-tags-input">
              <input
                class="text-input"
                value={tagInput()}
                onInput={(event) => setTagInput(event.currentTarget.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Add tag (comma separated)"
              />
              <button
                type="button"
                class="ghost"
                onClick={handleAddTag}
                disabled={!tagInput().trim()}
              >
                Add
              </button>
            </div>
          </label>
          <label>
            Comments
            <Show when={comments().length > 0} fallback={<span class="helper-text">No comments yet.</span>}>
              <div class="task-comments">
                <For each={comments()}>
                  {(comment) => <p class="task-comment">{comment}</p>}
                </For>
              </div>
            </Show>
            <div class="task-comments-input">
              <input
                class="text-input"
                value={commentInput()}
                onInput={(event) => setCommentInput(event.currentTarget.value)}
                onKeyDown={handleCommentKeyDown}
                placeholder="Add comment"
              />
              <button
                type="button"
                class="ghost"
                onClick={handleAddComment}
                disabled={!commentInput().trim()}
              >
                Add
              </button>
            </div>
          </label>
          <label>
            Assignee
            <select
              class="text-input"
              value={assignee()}
              onInput={(event) => setAssignee(event.currentTarget.value)}
              disabled={membersLoading() || !!membersError()}
            >
              <option value="">Unassigned</option>
              <For each={assigneeOptions()}>
                {(member) => <option value={member}>{member}</option>}
              </For>
            </select>
            <Show when={membersLoading()}>
              <span class="helper-text">Loading team members...</span>
            </Show>
            <Show when={membersError()}>
              <span class="helper-text">{membersError()}</span>
            </Show>
          </label>
          <label>
            Priority
            <select
              class="text-input"
              value={priority()}
              onInput={(event) => setPriority(event.currentTarget.value)}
            >
              <option value="">Unspecified</option>
              <For each={PRIORITY_OPTIONS}>
                {(option) => <option value={option}>{option}</option>}
              </For>
            </select>
          </label>
          <label>
            Due date
            <input
              class="text-input"
              type="date"
              min={todayDate()}
              value={dueDate()}
              onInput={(event) => setDueDate(event.currentTarget.value)}
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
